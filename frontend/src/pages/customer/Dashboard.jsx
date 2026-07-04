import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import api from '../../hooks/api';
import ChatScreen from '../../components/chat/ChatScreen';
import NotificationBell from '../../components/NotificationBell';
import { requestNotificationPermission, showBrowserNotification, playNotificationSound } from '../../utils/notifications';
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
  const { user, logout, updateUser } = useAuth();
  const { branding, homepage } = useBranding();
  const { isConnected, reconnected, on, off, startChat, joinRoom, sendMessage } = useSocket();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEmbed = true;
  const isIframe = window.self !== window.top;
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
  const [isExistingIdUpgrade, setIsExistingIdUpgrade] = useState(false);
  const pendingPrefilledMessageRef = useRef(false);

  const [fallbackAgents, setFallbackAgents] = useState([]);
  const [showFallbackSelector, setShowFallbackSelector] = useState(false);
  const [pendingIssueType, setPendingIssueType] = useState('other');
  const [isWidgetOpen, setIsWidgetOpen] = useState(true);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'WIDGET_OPEN_STATE') {
        setIsWidgetOpen(event.data.isOpen);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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
    try { 
      const res = await api.get('/api/chats'); 
      const chatList = res.data.chats || [];
      setChats(chatList); 

      // Send unreadCount update to the parent window if running inside iframe
      const totalUnread = chatList.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      window.parent.postMessage({ type: 'UPDATE_UNREAD_COUNT', count: totalUnread }, '*');
    }
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
          content: typeof pendingPrefilledMessageRef.current === 'string'
            ? pendingPrefilledMessageRef.current
            : "Sir, I need a manual ID. / सर, मुझे मैन्युअल आईडी चाहिए।",
          type: 'text',
          isInternal: false
        });
        pendingPrefilledMessageRef.current = null;
      }
    };
    const handleChatClosed = (data) => { loadChats(); };
    const handleAgentAssigned = () => loadChats();
    const handleAgentOnBreak = (data) => { setBreakAlert(data.message); setTimeout(() => setBreakAlert(null), 5000); };
    const handleNewMessage = (message) => { 
      if (message.isInternal) return; 
      loadChats(); 

      if (message.senderId?.toString() !== user?._id?.toString()) {
        playNotificationSound();

        if (document.hidden || !isWidgetOpen) {
          showBrowserNotification(branding.companyName ? `${branding.companyName.toUpperCase()} SUPPORT` : 'SUPPORT', {
            body: message.content || 'Sent an attachment',
            tag: message.chatId,
          });
        }
      }
    };
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
      setIsExistingIdUpgrade(!!user?.requestedDafaId);
      const mobile = data.mobile || user?.mobile;
      if (mobile && data.dafaxbetId) {
        try {
          // Silent session refresh to update session token without logging them out
          const res = await api.post('/api/auth/customer-verify', {
            mobile: mobile,
            dafaxbetId: data.dafaxbetId,
          });
          const { user: newUser, accessToken } = res.data;
          localStorage.setItem('accessToken', accessToken);
          api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          
          if (typeof updateUser === 'function') {
            updateUser(newUser);
          }
        } catch (e) {
          console.warn('Silent session refresh failed:', e);
        }
      }
    };

    const handleLeadVerificationFailed = () => {
      if (typeof updateUser === 'function') {
        updateUser({ leadStatus: 'verification_failed' });
      }
    };

    const handleNoAgentsForCategory = (data) => {
      setFallbackAgents(data.onlineAgents || []);
      setShowFallbackSelector(true);
      setStartingChat(false);
      setPendingIssueType(data.issueType || 'other');
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
    on('lead_verification_failed', handleLeadVerificationFailed);
    on('no_agents_for_category', handleNoAgentsForCategory);
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
      off('lead_verification_failed', handleLeadVerificationFailed);
      off('no_agents_for_category', handleNoAgentsForCategory);
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
    const welcomeMessages = {
      deposit: 'Hello sir, I have a deposit issue. My payment is not reflecting in my account.',
      withdrawal: 'Hello sir, I have a withdrawal issue. My withdrawal is pending/failed.',
      other: 'Hello sir, I need support.'
    };
    pendingPrefilledMessageRef.current = welcomeMessages[issueType] || 'Hello sir';
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
    pendingPrefilledMessageRef.current = "Sir, I need a manual ID. / सर, मुझे मैन्युअल आईडी चाहिए।";
    setStartingChat(true);
    startChat('new_id');
  };

  const handleRedirectToVerify = async () => {
    await logout();
    navigate(isEmbed ? '/login?view=existing_id&embed=true' : '/login?view=existing_id');
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
      <div 
        className={isIframe 
          ? "h-screen w-full flex flex-col overflow-hidden bg-bg" 
          : "min-h-screen w-full bg-[#0a0f18] flex justify-center items-center p-0 sm:p-4"
        } 
        style={{
          ...brandingStyles,
          paddingTop: isIframe ? '0px' : 'calc(env(safe-area-inset-top, 0px) + 12px)',
          paddingBottom: isIframe ? '0px' : 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
        }}
      >
        <div 
          className={isIframe 
            ? "w-full h-full bg-surface flex flex-col overflow-hidden" 
            : "w-full max-w-[420px] h-screen sm:h-[720px] bg-surface sm:border sm:border-border/60 sm:rounded-[28px] sm:shadow-2xl flex flex-col overflow-hidden relative"
          }
        >
          <ChatScreen 
            chatId={activeChat._id} 
            onBack={() => {
              setActiveChat(null);
              loadChats();
            }} 
            onChatWithSupportClick={() => {
              setActiveChat(null);
              setShowIssueSelector(true);
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
               <h3 className="text-lg font-bold text-text-1 mb-2">Account Upgraded</h3>
              <p className="text-sm text-text-2 mb-4 leading-relaxed">
                Your Player ID has been successfully verified!
              </p>
              <div className="bg-bg border border-border/80 rounded-lg p-3.5 mb-5 select-all">
                <span className="text-[11px] uppercase tracking-wider text-text-3 font-semibold block mb-1">Your Dafa ID</span>
                <span className="text-xl font-extrabold text-primary font-mono block tracking-wider animate-pulse" style={{ color: branding.primaryColor || '#B91C1C' }}>
                  {upgradedDafaId}
                </span>
              </div>
              <p className="text-xs text-text-3 mb-5 font-medium leading-normal">
                Now you can chat with customer care.
              </p>
              <button
                onClick={() => {
                  setUpgradedDafaId(null);
                  if (isExistingIdUpgrade) {
                    setActiveChat(null);
                    setShowIssueSelector(true);
                  }
                  loadChats();
                }}
                className="w-full text-white font-extrabold py-3.5 px-4 rounded-full transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 border-0 cursor-pointer text-sm shadow-md"
                style={{ backgroundColor: branding.primaryColor || '#B91C1C' }}
              >
                Start Chatting
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      className={isIframe 
        ? "h-screen w-full bg-bg overflow-hidden relative" 
        : "min-h-screen w-full bg-[#0a0f18] flex justify-center items-center p-0 sm:p-4"
      } 
      style={brandingStyles}
    >
      <div 
        className={isIframe 
          ? "w-full h-full bg-bg flex flex-col overflow-y-auto overflow-x-hidden relative scrollbar-none" 
          : "w-full max-w-[420px] h-screen sm:h-[720px] bg-bg sm:border sm:border-border/60 sm:rounded-[28px] sm:shadow-2xl flex flex-col overflow-y-auto overflow-x-hidden relative scrollbar-none"
        }
      >
      {breakAlert && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-warning/10 border border-warning/30 rounded-lg p-3 flex items-center gap-3 shadow-card animate-slide-in">
          <svg className="w-5 h-5 text-warning shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-text-1 flex-1">{breakAlert}</p>
        </div>
      )}

      {showNotificationPrompt && (
        <div className="bg-primary text-white px-4 py-3 flex items-center justify-between gap-3 text-xs md:text-sm font-semibold select-none shadow-md" style={{ backgroundColor: branding.primaryColor || '#B91C1C' }}>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
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
      {!isEmbed && (
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
      )}

      <main className="w-full max-w-lg mx-auto pb-6">
        {showFallbackSelector ? (
          <div className="px-4 pt-6">
            <div className="mb-5">
              <h2 className="text-base font-bold text-text-1 mb-1 flex items-center gap-1.5 text-warning" style={{ color: branding.primaryColor || '#B91C1C' }}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {pendingIssueType.toUpperCase()} Team is Offline
              </h2>
              <p className="text-xs text-text-2 leading-relaxed">
                All our {pendingIssueType} experts are currently busy or offline. You can connect and chat with one of our other active online agents below:
              </p>
            </div>
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {fallbackAgents.map(ag => (
                <button
                  key={ag._id}
                  onClick={() => {
                    setStartingChat(true);
                    setShowFallbackSelector(false);
                    setShowIssueSelector(false);
                    startChat(pendingIssueType, ag._id);
                  }}
                  disabled={startingChat}
                  className="w-full flex items-center justify-between p-3.5 bg-surface border border-border hover:border-primary/50 hover:bg-bg/40 transition-all text-left rounded-xl shadow-sm outline-none cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    {ag.avatar ? (
                      <img src={ag.avatar} alt="" className="w-10 h-10 rounded-full object-cover border border-success/30 animate-pulse" />
                    ) : (
                      <div className="w-10 h-10 bg-primary/10 text-primary text-sm font-extrabold rounded-full flex items-center justify-center border border-primary/25" style={{ backgroundColor: `${branding.primaryColor || '#B91C1C'}15`, color: branding.primaryColor || '#B91C1C' }}>
                        {ag.fullName?.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-bold text-text-1">{ag.fullName}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(ag.permissions?.issueTypes && ag.permissions.issueTypes.length > 0 ? ag.permissions.issueTypes : ['deposit', 'withdrawal', 'other']).map(tag => (
                          <span key={tag} className="px-1.5 py-0.2 bg-primary/10 text-primary text-[8px] font-extrabold uppercase rounded" style={{ backgroundColor: `${branding.primaryColor || '#B91C1C'}15`, color: branding.primaryColor || '#B91C1C' }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="px-3 py-1.5 bg-primary text-white text-[10px] font-extrabold rounded-lg uppercase shadow-sm group-hover:brightness-110 active:scale-95 transition-all" style={{ backgroundColor: branding.primaryColor || '#B91C1C' }}>
                    Connect
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => { setShowFallbackSelector(false); setSelectedIssueKey(null); }}
              disabled={startingChat}
              className="w-full mt-4 py-3 text-sm font-semibold text-text-2 hover:text-text-1 border border-border rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : showIssueSelector ? (
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
            {!isEmbed && announcements.length > 0 && (
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
            {!isEmbed && (
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
            )}


            {/* Welcome message */}
            <div className="px-4 pt-5 pb-1">
              <h2 className="text-lg font-bold text-text-1">
                {user?.requestedDafaId 
                  ? 'Verifying Your ID' 
                  : !user?.dafaxbetId 
                    ? 'Get Your New ID' 
                    : (homepage.welcomeText || 'Welcome to Support')}
              </h2>
              <p className="text-xs text-text-2 mt-0.5">
                {user?.requestedDafaId 
                  ? 'We are currently checking your gaming account details.' 
                  : !user?.dafaxbetId 
                    ? 'Connect with a specialist to set up your new account.' 
                    : (homepage.supportHeader || 'How can we help you?')}
              </p>
            </div>

            {/* Start Chat Button */}
            {!user?.dafaxbetId ? (
              <div className="px-4 py-2 flex flex-col gap-3">
                {/* If verification is pending */}
                {(user?.leadStatus === 'verification_pending' || (user?.leadStatus && ['new', 'assigned', 'in_progress', 'follow_up'].includes(user.leadStatus) && user.requestedDafaId)) ? (
                  user?.requestedDafaId ? (
                    /* Flow B: Already has Dafa ID and is verifying */
                    <div className="space-y-4">
                      <div className="p-4.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs leading-relaxed shadow-sm flex flex-col gap-2.5">
                        <div className="flex items-start gap-3">
                          <div className="relative flex-shrink-0 mt-0.5">
                            <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500" />
                          </div>
                          <div>
                            <span className="font-extrabold text-emerald-800 block mb-1 uppercase tracking-wider">Checking ID: {user.requestedDafaId}</span>
                            <span className="text-emerald-700 font-semibold">
                              Wait 2 minutes, we are checking your ID then we will connect you to customer support for further issues.
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Flow A: Wants New ID */
                    <div className="space-y-3.5">
                      <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-xs leading-relaxed shadow-sm flex items-start gap-2.5">
                        <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <span className="font-extrabold text-amber-800 block mb-0.5">Verification In Process</span>
                          <span className="text-amber-700 font-medium">
                            Verification is under process. Please wait while our team verifies your details. You will receive full Customer Support access once the verification is completed.
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={handleManualIdStart}
                        disabled={startingChat}
                        className="w-full text-white font-extrabold py-3 px-4 rounded-full transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 border-0 cursor-pointer text-xs tracking-wider uppercase shadow-md"
                        style={{ background: `linear-gradient(135deg, ${branding.primaryColor || '#B91C1C'}, ${branding.secondaryColor || '#991B1B'})` }}
                      >
                        <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span>Chat with New ID Team</span>
                      </button>
                    </div>
                  )
                ) : user?.leadStatus === 'verification_failed' ? (
                  <div className="space-y-3.5">
                    <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-xs leading-relaxed shadow-sm flex items-start gap-2.5">
                      <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <span className="font-extrabold text-red-800 block mb-0.5">Verification Failed</span>
                        <span className="text-red-700 font-medium">
                          We couldn't verify your details. Please check your Dafa Gaming ID and registered mobile number, or contact our support team for assistance.
                        </span>
                      </div>
                    </div>
                    
                    <button
                      onClick={handleManualIdStart}
                      disabled={startingChat}
                      className="w-full text-white font-extrabold py-3 px-4 rounded-full transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 border-0 cursor-pointer text-xs tracking-wider uppercase shadow-md"
                      style={{ background: `linear-gradient(135deg, ${branding.primaryColor || '#B91C1C'}, ${branding.secondaryColor || '#991B1B'})` }}
                    >
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <span>Chat with Support Agent</span>
                    </button>
                    
                    <button
                      onClick={handleLinkExistingId}
                      className="w-full text-white font-extrabold py-3 px-4 rounded-full transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer text-xs tracking-wider uppercase bg-gradient-to-r from-[#1e293b] to-[#0f172a] hover:from-[#334155] hover:to-[#1e293b] border border-slate-700/60 shadow-md"
                    >
                      <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      <span>Re-submit Dafa ID for Verification</span>
                    </button>
                  </div>
                ) : (
                  // Normal New Lead
                  <>
                    <div className="p-3.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-2xl text-xs font-semibold leading-relaxed flex flex-col gap-2 shadow-sm">
                      <div className="flex items-start gap-2.5">
                        <svg className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>You are currently unverified. Deposit, withdrawal, and other support services will be available immediately after your Gaming ID is created or verified.</span>
                      </div>
                      <div className="pl-7 mt-0.5">
                        <span className="text-slate-600">Already have a Dafa ID? </span>
                        <button 
                          onClick={handleRedirectToVerify}
                          className="text-amber-600 hover:text-amber-700 underline font-bold cursor-pointer bg-transparent border-0 p-0 text-xs inline ml-1"
                        >
                          Verify it here
                        </button>
                      </div>
                    </div>
                    {/* Manual ID Button */}
                    <button
                      onClick={handleManualIdStart}
                      disabled={startingChat}
                      className="w-full text-white font-extrabold py-3 px-4 rounded-full transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 border-0 cursor-pointer text-xs tracking-wider uppercase shadow-md"
                      style={{ background: `linear-gradient(135deg, ${branding.primaryColor || '#B91C1C'}, ${branding.secondaryColor || '#991B1B'})` }}
                    >
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <span>CHAT WITH NEW ID TEAM</span>
                    </button>
                    
                    {/* Auto ID Button */}
                    <button
                      onClick={handleAutoIdRedirect}
                      className="w-full text-white font-extrabold py-3 px-4 rounded-full transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer text-xs tracking-wider uppercase bg-gradient-to-r from-[#1e293b] to-[#0f172a] hover:from-[#334155] hover:to-[#1e293b] border border-slate-700/60 shadow-md"
                    >
                      <svg className="w-5 h-5 text-amber-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>AUTO SITE REGISTRATION</span>
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="px-4 py-2">
                <button
                  onClick={handleStartChat}
                  disabled={startingChat}
                  className="w-full text-white font-extrabold py-3 px-4 rounded-full transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 border-0 cursor-pointer text-sm tracking-wider uppercase shadow-md"
                  style={{ background: `linear-gradient(135deg, ${branding.primaryColor || '#B91C1C'}, ${branding.secondaryColor || '#991B1B'})` }}
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
              <div className="bg-surface border border-border p-4 flex items-center justify-between gap-3 rounded-2xl shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold"
                    style={{ backgroundColor: `${branding.primaryColor || '#B91C1C'}15`, color: branding.primaryColor || '#B91C1C' }}
                  >
                    {user?.fullName?.charAt(0) || 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-text-1 truncate">{user?.fullName}</p>
                    <p className="text-xs text-text-2 mt-0.5">{user?.mobile}</p>
                  </div>
                </div>
                
                <button 
                  onClick={logout}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/15 text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 flex-shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Logout</span>
                </button>
              </div>
            </div>

                {/* FAQ Accordion Section */}
                {!isEmbed && (
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
                )}
            
            <div className="px-4 py-4 text-center">
              <p className="text-[10px] text-text-3">{branding.footerText || `© ${new Date().getFullYear()} ${branding.companyName || 'DAFAX Bet'}. All rights reserved.`}</p>
            </div>
          </>
        )}
      </main>
      </div>
    </div>
  );
};

export default CustomerDashboard;
