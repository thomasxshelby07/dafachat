import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import api from '../../hooks/api';
import ChatScreen from '../../components/chat/ChatScreen';
import NotificationBell from '../../components/NotificationBell';
import { requestNotificationPermission } from '../../utils/notifications';
import { useBranding } from '../../context/BrandingContext';

const ISSUE_TYPES = [
  { key: 'deposit', label: 'Deposit Issue', desc: 'Payment not reflecting, failed deposit' },
  { key: 'withdrawal', label: 'Withdrawal Issue', desc: 'Withdrawal pending, failed, delayed' },
  { key: 'other', label: 'Other Issue', desc: 'Account, verification, general help' },
];

const renderIssueIcon = (key) => {
  if (key === 'deposit') {
    return (
      <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    );
  }
  if (key === 'withdrawal') {
    return (
      <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  return (
    <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
};

const formatTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'now';
  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const CustomerDashboard = () => {
  const { user, logout } = useAuth();
  const { branding, homepage } = useBranding();
  const { isConnected, reconnected, on, off, startChat, joinRoom, sendMessage } = useSocket();
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startingChat, setStartingChat] = useState(false);
  const [selectedIssueKey, setSelectedIssueKey] = useState(null);
  const [showIssueSelector, setShowIssueSelector] = useState(false);
  const [breakAlert, setBreakAlert] = useState(null);
  const [banners, setBanners] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [faqOpenIndex, setFaqOpenIndex] = useState(null);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [broadcasts, setBroadcasts] = useState([]);
  const [upgradedDafaId, setUpgradedDafaId] = useState(null);
  const pendingPrefilledMessageRef = useRef(false);

  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted') {
      setShowNotificationPrompt(true);
    }
  }, []);

  const handleAllowNotifications = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      setShowNotificationPrompt(false);
    }
  };

  const loadBannersAndAnnouncements = async () => {
    try {
      const [bannersRes, announcementsRes] = await Promise.all([
        api.get('/api/banners'),
        api.get('/api/announcements'),
      ]);
      setBanners(bannersRes.data.banners || []);
      setAnnouncements(announcementsRes.data.announcements || []);
    } catch (error) {
      console.error('Failed to load banners or announcements:', error);
    }
  };

  useEffect(() => {
    loadBannersAndAnnouncements();
  }, []);

  const loadBroadcasts = async () => {
    try {
      const res = await api.get('/api/broadcasts/active');
      setBroadcasts(res.data.broadcasts || []);
    } catch (e) {
      console.error('Failed to load broadcasts:', e);
    }
  };

  useEffect(() => {
    if (broadcasts.length > 0) {
      broadcasts.forEach(b => {
        if (!b.viewed) {
          api.post(`/api/broadcasts/${b._id}/view`).catch(() => {});
        }
      });
    }
  }, [broadcasts]);

  const handleBroadcastClick = async (broadcast) => {
    try {
      await api.post(`/api/broadcasts/${broadcast._id}/click`);
    } catch (e) {}
    window.open(broadcast.buttonLink, '_blank');
  };

  // Banner slideshow auto-play
  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setActiveBannerIndex(prev => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [banners]);

  const loadChats = async () => {
    try { const res = await api.get('/api/chats'); setChats(res.data.chats); }
    catch (error) { console.error('Failed to load chats:', error); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadChats();
    loadBroadcasts();
    requestNotificationPermission();
    const handleOpenChat = (e) => {
      const chatId = e.detail?.chatId;
      if (chatId) {
        setActiveChat({ _id: chatId });
        if (isConnected) joinRoom(chatId);
      }
    };
    window.addEventListener('open-chat', handleOpenChat);
    return () => window.removeEventListener('open-chat', handleOpenChat);
  }, [isConnected, joinRoom]);

  useEffect(() => { if (reconnected > 0) { loadChats(); loadBroadcasts(); } }, [reconnected]);

  useEffect(() => {
    if (user?.dafaxbetId && localStorage.getItem('leadSession') === 'true') {
      alert("You already have an ID. Please login on Customer Care.");
      logout();
      localStorage.removeItem('leadSession');
      window.location.href = '/login';
    }
  }, [user, logout]);

  useEffect(() => {
    const handleChatJoined = (data) => {
      setStartingChat(false);
      setSelectedIssueKey(null);
      setShowIssueSelector(false);
      loadChats();
      setActiveChat({ _id: data.chatId, ...data.chat });

      if (pendingPrefilledMessageRef.current) {
        sendMessage({
          chatId: data.chatId,
          content: "Sir, I need a manual ID. / सर, मुझे मैन्युअल आईडी चाहिए।",
          type: 'text',
          isInternal: false
        });
        pendingPrefilledMessageRef.current = false;
      }
    };
    const handleChatClosed = (data) => { loadChats(); };
    const handleAgentAssigned = () => loadChats();
    const handleAgentOnBreak = (data) => { setBreakAlert(data.message); setTimeout(() => setBreakAlert(null), 5000); };
    const handleNewMessage = (message) => { if (message.isInternal) return; loadChats(); };
    const handleChatRead = (data) => { loadChats(); };
    const handleError = () => {
      setStartingChat(false);
      setSelectedIssueKey(null);
      setShowIssueSelector(false);
    };
    const handleAnnouncementsChanged = () => loadBannersAndAnnouncements();
    const handleNewBroadcast = () => loadBroadcasts();
    const handleLeadUpgraded = async (data) => {
      setUpgradedDafaId(data.dafaxbetId);
      // Auto-login: use the mobile from the event (or fallback to current user's mobile)
      const mobile = data.mobile || user?.mobile;
      if (mobile && data.dafaxbetId) {
        try {
          // Small delay so customer sees the congrats message in chat first
          setTimeout(async () => {
            try {
              // Login as existing customer with the new Dafa ID
              await api.post('/api/auth/smart-login', {
                mobile: mobile,
                dafaxbetId: data.dafaxbetId,
                flow: 'existing',
              }).then(res => {
                const { user: newUser, accessToken } = res.data;
                localStorage.setItem('accessToken', accessToken);
                localStorage.removeItem('leadSession');
                // Hard redirect to customer care dashboard
                window.location.href = '/';
              });
            } catch (e) {
              // Fallback: just show upgrade screen, let them login manually
              console.warn('Auto-login failed, showing manual redirect:', e);
            }
          }, 3000);
        } catch (e) {}
      }
    };

    on('chat_joined', handleChatJoined);
    on('chat_closed', handleChatClosed);
    on('agent_assigned', handleAgentAssigned);
    on('agent_on_break', handleAgentOnBreak);
    on('new_message', handleNewMessage);
    on('chat_read', handleChatRead);
    on('message_read', handleChatRead);
    on('announcements_changed', handleAnnouncementsChanged);
    on('new_broadcast', handleNewBroadcast);
    on('lead_upgraded', handleLeadUpgraded);
    on('error', handleError);
    return () => {
      off('chat_joined', handleChatJoined);
      off('chat_closed', handleChatClosed);
      off('agent_assigned', handleAgentAssigned);
      off('agent_on_break', handleAgentOnBreak);
      off('new_message', handleNewMessage);
      off('chat_read', handleChatRead);
      off('message_read', handleChatRead);
      off('announcements_changed', handleAnnouncementsChanged);
      off('new_broadcast', handleNewBroadcast);
      off('lead_upgraded', handleLeadUpgraded);
      off('error', handleError);
    };
  }, [on, off]);

  const handleStartChat = async () => {
    if (!isConnected) { alert('Connecting to server, please wait...'); return; }
    await requestNotificationPermission();
    if (!user?.dafaxbetId || user.dafaxbetId.trim() === '') {
      handleManualIdStart();
    } else {
      setShowIssueSelector(true);
    }
  };

  const handleIssueSelect = (issueType) => {
    setSelectedIssueKey(issueType);
    setStartingChat(true);
    startChat(issueType);
  };

  const handleAutoIdRedirect = () => {
    const link = homepage.autoIdLink && homepage.autoIdLink !== '#' ? homepage.autoIdLink : 'https://dafaxbet.com/register';
    window.open(link, '_blank');
  };

  const handleManualIdStart = () => {
    if (!isConnected) { alert('Connecting to server, please wait...'); return; }
    pendingPrefilledMessageRef.current = true;
    setStartingChat(true);
    startChat('new_id');
  };

  const handleLinkExistingId = async () => {
    const dafaId = window.prompt("Enter your existing Dafa ID:");
    if (!dafaId || !dafaId.trim()) return;

    try {
      const res = await api.post('/api/leads/request-link', { dafaxbetId: dafaId.trim() });
      alert(`Verification Request Submitted!\n\nYour request to link Dafa ID: ${dafaId.trim()} has been sent to our agent. They will verify and link it shortly. Please check the support chat.`);
      if (res.data.chatId) {
        loadChats();
        if (isConnected) joinRoom(res.data.chatId);
      }
    } catch (error) {
      alert(error.response?.data?.error || "Failed to submit request");
    }
  };

  const handleSelectChat = (chat) => { setActiveChat(chat); if (isConnected) joinRoom(chat._id); };

  const brandingStyles = {
    '--primary': branding.primaryColor || '#B91C1C',
    '--primary-hover': branding.secondaryColor || '#991B1B',
    '--primary-light': `${branding.primaryColor || '#B91C1C'}10`,
    '--sidebar-bg': branding.headerBg || '#111827',
  };

  if (activeChat) {
    return (
      <div className="fixed inset-0 bg-bg flex justify-center" style={brandingStyles}>
        <div className="w-full max-w-lg h-full bg-surface border-x border-border flex flex-col shadow-float overflow-hidden">
          <ChatScreen 
            chatId={activeChat._id} 
            onBack={() => {
              setActiveChat(null);
              loadChats();
            }} 
            onMenuClick={() => {}} 
          />
        </div>

        {upgradedDafaId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-surface border border-border/60 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl animate-scale-in">
              <div className="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-4 border border-success/20 animate-bounce">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-text-1 mb-2">🎉 Account Upgraded!</h3>
              <p className="text-sm text-text-2 mb-4 leading-relaxed">
                Your Player ID has been successfully created.
              </p>
              <div className="bg-bg border border-border/80 rounded-lg p-3.5 mb-5 select-all">
                <span className="text-[11px] uppercase tracking-wider text-text-3 font-semibold block mb-1">Your Dafa ID</span>
                <span className="text-xl font-extrabold text-primary font-mono block tracking-wider animate-pulse" style={{ color: branding.primaryColor || '#B91C1C' }}>
                  {upgradedDafaId}
                </span>
              </div>
              <p className="text-[11px] text-text-3 mb-5 leading-normal">
                For security, please log out and log in again using <span className="font-semibold">Customer Care</span> with your Dafa ID and mobile number for further support, deposits, and withdrawals.
              </p>
              <button
                onClick={async () => {
                  await logout();
                  window.location.href = '/login';
                }}
                className="w-full py-3 px-4 font-bold rounded-xl text-white shadow-lg active:scale-95 transition-all text-sm cursor-pointer"
                style={{ backgroundColor: branding.primaryColor || '#B91C1C' }}
              >
                Continue to Login
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg" style={brandingStyles}>
      {breakAlert && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-warning/10 border border-warning/30 rounded-lg p-3 flex items-center gap-3 shadow-card">
          <span className="text-lg">⏰</span>
          <p className="text-sm text-text-1 flex-1">{breakAlert}</p>
        </div>
      )}

      {showNotificationPrompt && (
        <div className="bg-primary text-white px-4 py-3 flex items-center justify-between gap-3 text-xs md:text-sm font-semibold select-none shadow-md" style={{ backgroundColor: branding.primaryColor || '#B91C1C' }}>
          <div className="flex items-center gap-2">
            <span>🔔</span>
            <span>Please enable notifications to receive support replies instantly.</span>
          </div>
          <button 
            onClick={handleAllowNotifications}
            className="px-3 py-1 bg-white text-primary rounded-lg hover:bg-white/90 active:scale-95 transition-all text-xs font-bold"
            style={{ color: branding.primaryColor || '#B91C1C' }}
          >
            Allow
          </button>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 shadow-md" style={{ backgroundColor: branding.headerBg || '#111827' }}>
        <div className="max-w-lg mx-auto px-4 h-14 grid grid-cols-3 items-center">
          {/* Left: Logout */}
          <div className="flex items-center justify-start">
            <button onClick={logout} className="text-white/70 hover:text-white p-1.5 rounded hover:bg-white/10 transition-all" aria-label="Logout">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>

          {/* Center: Centered Logo or Title */}
          <div className="flex flex-col items-center justify-center text-center">
            {branding.logo ? (
              <img src={branding.logo} alt={branding.companyName || 'DAFAX'} className="h-8 object-contain" />
            ) : (
              <h1 className="text-sm font-extrabold text-white tracking-wider truncate max-w-[120px]">
                {branding.companyName || 'DAFAX'}
              </h1>
            )}
            <div className="flex items-center gap-1 mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-white/40'}`} />
              <span className="text-[9px] text-white/70 font-semibold tracking-wide uppercase">{isConnected ? 'Online' : 'Connecting...'}</span>
            </div>
          </div>

          {/* Right: Notification */}
          <div className="flex items-center justify-end">
            <NotificationBell className="text-white hover:text-white/80" />
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto pb-6">
        {showIssueSelector ? (
          <div className="px-4 pt-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-text-1 mb-1">What do you need help with?</h2>
              <p className="text-sm text-text-2">Select your issue and we'll connect you to the right expert.</p>
            </div>
            <div className="space-y-3">
              {ISSUE_TYPES.map(({ key, label, desc }) => (
                <button
                  key={key}
                  onClick={() => handleIssueSelect(key)}
                  disabled={startingChat}
                  className={`w-full flex items-center gap-4 p-4 bg-surface border hover:bg-bg/50 transition-all text-left rounded-xl shadow-sm ${
                    startingChat
                      ? selectedIssueKey === key
                        ? 'ring-1 ring-primary/30 opacity-100 font-bold'
                        : 'opacity-40 cursor-not-allowed border-border'
                      : 'border-border hover:border-primary/50'
                  }`}
                  style={
                    startingChat && selectedIssueKey === key
                      ? { borderColor: branding.primaryColor || '#B91C1C' }
                      : {}
                  }
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform"
                    style={{
                      backgroundColor: `${branding.primaryColor || '#B91C1C'}15`,
                      color: branding.primaryColor || '#B91C1C',
                    }}
                  >
                    {renderIssueIcon(key)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-text-1">{label}</h3>
                    <p className="text-xs text-text-3 mt-0.5">{desc}</p>
                  </div>
                  {startingChat && selectedIssueKey === key ? (
                    <div
                      className="animate-spin rounded-full h-5 w-5 border-2 border-t-transparent flex-shrink-0"
                      style={{ borderColor: branding.primaryColor || '#B91C1C', borderTopColor: 'transparent' }}
                    />
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-text-3 group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setShowIssueSelector(false); setSelectedIssueKey(null); }}
              disabled={startingChat}
              className="w-full mt-4 py-3 text-sm font-semibold text-text-2 hover:text-text-1 border border-border rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            {/* Scrolling Announcement Bar */}
            {announcements.length > 0 && (
              <div className="bg-primary/10 text-primary text-xs h-9 flex items-center border-b border-primary/20 overflow-hidden relative select-none">
                <div className="animate-marquee whitespace-nowrap flex gap-8 py-1.5">
                  {announcements.map((ann, idx) => (
                    <span key={ann._id || idx} className="flex items-center gap-1.5 px-2">
                      <svg className="w-3.5 h-3.5 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                      <span className="font-medium">{ann.content}</span>
                    </span>
                  ))}
                  {/* Duplicate for infinite marquee wrap */}
                  {announcements.map((ann, idx) => (
                    <span key={`dup-${ann._id || idx}`} className="flex items-center gap-1.5 px-2">
                      <svg className="w-3.5 h-3.5 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                      <span className="font-medium">{ann.content}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Banners Carousel / Fallback Header Banner */}
            <div className="relative h-[180px] w-full bg-gradient-to-r from-primary-light to-primary-light/50 overflow-hidden select-none border-b border-border">
              {banners.length > 0 ? (
                banners.map((banner, index) => (
                  <div
                    key={banner._id}
                    className={`absolute inset-0 transition-opacity duration-1000 ${
                      index === activeBannerIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                  >
                    <img src={banner.imageUrl} alt={banner.title} className="w-full h-full object-cover" />
                    {banner.title && (
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3 text-white">
                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-85">{banner.type}</p>
                        <h4 className="text-xs font-semibold mt-0.5">{banner.title}</h4>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                // Fallback elegant brand container if no banners are uploaded
                <div className="w-full h-full flex items-center justify-center p-6 text-center">
                  <div>
                    <h3 className="text-base font-extrabold text-text-1 tracking-wider uppercase">{branding.companyName || 'DAFAX Bet'}</h3>
                    <p className="text-xs text-text-2 mt-1">{homepage.supportHeader || 'Premium 24/7 Support Console'}</p>
                  </div>
                </div>
              )}

              {/* Banner indicators (dots) - centered */}
              {banners.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                  {banners.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setActiveBannerIndex(index)}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${
                        index === activeBannerIndex ? 'bg-white scale-125' : 'bg-white/40'
                      }`}
                      aria-label={`Go to slide ${index + 1}`}
                    />
                  ))}
                </div>
              )}

              {/* Play Now CTA Button - placed bottom right of banner frame */}
              {homepage.playNowUrl && (
                <a
                  href={homepage.playNowUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute bottom-3 right-3 z-20 px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wider rounded-lg shadow-float transition-all active:scale-95 flex items-center gap-1 hover:brightness-110"
                  style={{
                    backgroundColor: branding.playNowBgColor || branding.primaryColor || '#B91C1C',
                    color: branding.playNowTextColor || '#FFFFFF'
                  }}
                >
                  <span>{homepage.playNowLabel || 'Play Now'}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </a>
              )}
            </div>


            {/* Welcome message */}
            <div className="px-4 pt-5 pb-1">
              <h2 className="text-lg font-bold text-text-1">
                {!user?.dafaxbetId ? 'Get Your New ID' : (homepage.welcomeText || 'Welcome to Support')}
              </h2>
              <p className="text-xs text-text-2 mt-0.5">
                {!user?.dafaxbetId ? 'Connect with a specialist to set up your new account.' : (homepage.supportHeader || 'How can we help you?')}
              </p>
            </div>

            {/* Start Chat Button */}
            {!user?.dafaxbetId ? (
              <div className="px-4 py-2 flex flex-col gap-3">
                {/* Auto ID Button */}
                <button
                  onClick={handleAutoIdRedirect}
                  className="w-full text-white font-bold py-3.5 rounded-xl transition-all shadow active:scale-[0.98] flex items-center justify-center gap-2 border-0 cursor-pointer text-sm"
                  style={{ backgroundColor: branding.primaryColor || '#B91C1C' }}
                >
                  ⚡ AUTO CREATE ID
                </button>

                {/* Manual ID Button */}
                <button
                  onClick={handleManualIdStart}
                  disabled={startingChat}
                  className="w-full bg-surface text-text-1 font-bold py-3.5 border border-border rounded-xl transition-all shadow active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer text-sm"
                >
                  💬 CHAT FOR MANUAL ID
                </button>

                {/* I Already Have ID Button */}
                <button
                  onClick={handleLinkExistingId}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 border border-slate-200 rounded-xl transition-all shadow active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer text-sm"
                >
                  🔑 I ALREADY HAVE A DAFA ID
                </button>
              </div>
            ) : (
              <div className="px-4 py-2">
                <button
                  onClick={handleStartChat}
                  disabled={startingChat}
                  className="w-full text-white font-bold py-3.5 rounded-xl transition-all shadow active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 border-0 cursor-pointer text-sm"
                  style={{ backgroundColor: branding.primaryColor || '#B91C1C' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = branding.secondaryColor || '#991B1B'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = branding.primaryColor || '#B91C1C'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  Start New Chat
                </button>
              </div>
            )}

            {/* Active Chat Card */}
            {chats.filter(c => c.status === 'active').map(chat => (
              <div key={chat._id} className="px-4 py-2">
                <button onClick={() => handleSelectChat(chat)} className="w-full flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:shadow-card transition-all text-left">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white"
                    style={{ backgroundColor: branding.primaryColor || '#B91C1C' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-text-1">{branding.companyName ? `${branding.companyName.toUpperCase()} SUPPORT` : 'SUPPORT'}</h3>
                      {(chat.unreadCount || 0) > 0 && <span className="min-w-[20px] h-5 px-1.5 bg-danger rounded-full flex items-center justify-center"><span className="text-[10px] font-bold text-white">{chat.unreadCount > 9 ? '9+' : chat.unreadCount}</span></span>}
                    </div>
                    <p className="text-xs text-text-2 truncate mt-0.5">{chat.lastMessage?.content || 'Tap to open chat'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-[11px] text-text-3">{formatTime(chat.lastMessageAt)}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-text-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </div>
                </button>
              </div>
            ))}

            {/* Closed chats */}
            {chats.filter(c => c.status === 'closed').length > 0 && (
              <div className="px-4 mt-4">
                <p className="text-xs font-semibold text-text-3 uppercase tracking-wider mb-2">Past Conversations</p>
                {chats.filter(c => c.status === 'closed').map(chat => (
                  <div key={chat._id} className="py-2 border-b border-border last:border-0">
                    <button onClick={() => handleSelectChat(chat)} className="w-full flex items-center gap-3 text-left">
                      <div className="w-9 h-9 bg-bg rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-text-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-2 truncate">{chat.lastMessage?.content || 'Chat closed'}</p>
                      </div>
                      <span className="text-[11px] text-text-3 flex-shrink-0">{formatTime(chat.lastMessageAt)}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Broadcast Cards */}
            {broadcasts.length > 0 && (
              <div className="px-4 pt-5 pb-2 border-t border-border/60 mt-5">
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2">
                    <span className="w-1 h-3.5" style={{ backgroundColor: branding.primaryColor || '#B91C1C' }} />
                    <p className="text-xs font-bold text-text-1 uppercase tracking-wider">Announcements</p>
                  </div>
                  {broadcasts.filter(b => !b.viewed).length > 0 && (
                    <span className="px-2 py-0.5 bg-danger text-white rounded text-[8px] font-extrabold tracking-wider animate-pulse shadow-sm">
                      {broadcasts.filter(b => !b.viewed).length} NEW
                    </span>
                  )}
                </div>
                
                <div className="space-y-4">
                  {broadcasts.map(b => (
                    <div key={b._id} className="bg-surface border border-border rounded-none shadow-sm flex flex-col hover:shadow-md transition-shadow relative">
                      {!b.viewed && (
                        <div className="absolute top-3 left-3 z-10 px-2 py-0.5 bg-danger text-white rounded text-[8px] font-extrabold shadow-sm tracking-wide">
                          NEW
                        </div>
                      )}
                      
                      {b.image && (
                        <div className="relative w-full h-32 overflow-hidden bg-bg/50">
                          <img src={b.image} alt={b.title} className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
                        </div>
                      )}
                      
                      <div className="p-4 flex flex-col justify-between flex-1">
                        <div className="border-l-2 pl-3 mb-2" style={{ borderColor: branding.primaryColor || '#B91C1C' }}>
                          <h4 className="text-xs font-extrabold text-text-1 uppercase tracking-wide">{b.title}</h4>
                        </div>
                        
                        {b.content && (
                          <p className="text-[11px] text-text-2 leading-relaxed mb-3.5 pl-3">{b.content}</p>
                        )}
                        
                        {b.buttonText && b.buttonLink && (
                          <button
                            onClick={() => handleBroadcastClick(b)}
                            className="w-full btn-primary font-bold py-2.5 rounded-none text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 hover:brightness-110 active:scale-[0.98] transition-all shadow-sm"
                            style={{ backgroundColor: branding.primaryColor || '#B91C1C' }}
                          >
                            <span>{b.buttonText}</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Profile */}
            <div className="px-4 pt-4">
              <div className="bg-surface border border-border p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-light flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">{user?.fullName?.charAt(0) || 'U'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-1">{user?.fullName}</p>
                  <p className="text-xs text-text-2">{user?.mobile}</p>
                </div>
              </div>
            </div>

                {/* FAQ Accordion Section */}
                <div className="px-4 pt-6 pb-2">
                  <p className="text-xs font-semibold text-text-3 uppercase tracking-wider mb-3">Help & FAQ</p>
                  <div className="space-y-2">
                    {(homepage.faqs || [
                      { q: 'How do I make a deposit?', a: 'Click the "Play Now" button in the header, go to the deposit section, choose your payment method, and complete the transfer. If it does not reflect, start a "Deposit Issue" support chat.' },
                      { q: 'How long does a withdrawal take?', a: 'Withdrawals are processed within 15-30 minutes. If there is a delay, please contact support by opening a "Withdrawal Issue" chat.' },
                      { q: 'How do I verify my account?', a: 'Upload a clear copy of your Identity document in your profile settings or share it directly with our support agent in chat.' },
                      { q: 'Is my personal data secure?', a: 'Yes, we use global bank-grade encryption to protect all your account data.' },
                    ]).map((faq, idx) => (
                      <div key={idx} className="border border-border bg-surface">
                        <button
                          onClick={() => setFaqOpenIndex(faqOpenIndex === idx ? null : idx)}
                          className="w-full px-4 py-3 flex items-center justify-between text-left"
                        >
                          <span className="text-xs font-semibold text-text-1">{faq.q}</span>
                          <svg
                            className="w-4 h-4 text-text-3 ml-2 transition-transform duration-200"
                            style={{ transform: faqOpenIndex === idx ? 'rotate(180deg)' : 'rotate(0deg)' }}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {faqOpenIndex === idx && (
                          <div className="px-4 pb-3 pt-1 text-xs text-text-2 border-t border-border/50 bg-bg/30 leading-relaxed">
                            {faq.a}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
            
            <div className="px-4 py-4 text-center">
              <p className="text-[10px] text-text-3">{branding.footerText || `© ${new Date().getFullYear()} ${branding.companyName || 'DAFAX Bet'}. All rights reserved.`}</p>
            </div>
          </>
        )}
      </main>

      {upgradedDafaId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border/60 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
            <div className="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-4 border border-success/20 animate-bounce">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-text-1 mb-2">🎉 Account Upgraded!</h3>
            <p className="text-sm text-text-2 mb-4 leading-relaxed">
              Your Player ID has been successfully created.
            </p>
            <div className="bg-bg border border-border/80 rounded-lg p-3.5 mb-5 select-all">
              <span className="text-[11px] uppercase tracking-wider text-text-3 font-semibold block mb-1">Your Dafa ID</span>
              <span className="text-xl font-extrabold text-primary font-mono block tracking-wider animate-pulse" style={{ color: branding.primaryColor || '#B91C1C' }}>
                {upgradedDafaId}
              </span>
            </div>
            <p className="text-[11px] text-text-3 mb-5 leading-normal">
              For security, please log out and log in again using <span className="font-semibold">Customer Care</span> with your Dafa ID and mobile number for further support, deposits, and withdrawals.
            </p>
            <button
              onClick={async () => {
                await logout();
                window.location.href = '/login';
              }}
              className="w-full py-3 px-4 font-bold rounded-xl text-white shadow-lg active:scale-95 transition-all text-sm cursor-pointer"
              style={{ backgroundColor: branding.primaryColor || '#B91C1C' }}
            >
              Continue to Login
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerDashboard;
