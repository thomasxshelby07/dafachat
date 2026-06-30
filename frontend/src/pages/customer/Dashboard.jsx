import { useState, useEffect } from 'react';
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

  useEffect(() => { if (reconnected > 0) loadChats(); }, [reconnected]);

  useEffect(() => {
    const handleChatJoined = (data) => {
      setStartingChat(false);
      setSelectedIssueKey(null);
      setShowIssueSelector(false);
      loadChats();
      setActiveChat({ _id: data.chatId, ...data.chat });
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

    on('chat_joined', handleChatJoined);
    on('chat_closed', handleChatClosed);
    on('agent_assigned', handleAgentAssigned);
    on('agent_on_break', handleAgentOnBreak);
    on('new_message', handleNewMessage);
    on('chat_read', handleChatRead);
    on('message_read', handleChatRead);
    on('announcements_changed', handleAnnouncementsChanged);
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
      off('error', handleError);
    };
  }, [on, off]);

  const handleStartChat = async () => {
    if (!isConnected) { alert('Connecting to server, please wait...'); return; }
    await requestNotificationPermission();
    setShowIssueSelector(true);
  };

  const handleIssueSelect = (issueType) => {
    setSelectedIssueKey(issueType);
    setStartingChat(true);
    startChat(issueType);
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
      <div className="h-screen bg-bg flex justify-center" style={brandingStyles}>
        <div className="w-full max-w-lg h-full bg-surface border-x border-border flex flex-col shadow-float">
          <ChatScreen 
            chatId={activeChat._id} 
            onBack={() => {
              setActiveChat(null);
              loadChats();
            }} 
            onMenuClick={() => {}} 
          />
        </div>
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
              <h2 className="text-lg font-bold text-text-1">{homepage.welcomeText || 'Welcome to Support'}</h2>
              <p className="text-xs text-text-2 mt-0.5">{homepage.supportHeader || 'How can we help you?'}</p>
            </div>

            {/* Start Chat Button */}
            <div className="px-4 py-2">
              <button
                onClick={handleStartChat}
                disabled={startingChat}
                className="w-full text-white font-bold py-3.5 rounded-xl transition-all shadow active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: branding.primaryColor || '#B91C1C' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = branding.secondaryColor || '#991B1B'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = branding.primaryColor || '#B91C1C'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                Start New Chat
              </button>
            </div>

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
                      <h3 className="text-sm font-semibold text-text-1">DAFAXBET SUPPORT</h3>
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
                    {[
                      { q: 'How do I make a deposit?', a: 'Click the "Play Now" button in the header, go to the deposit section, choose your payment method, and complete the transfer. If it does not reflect, start a "Deposit Issue" support chat.' },
                      { q: 'How long does a withdrawal take?', a: 'Withdrawals are processed within 15-30 minutes. If there is a delay, please contact support by opening a "Withdrawal Issue" chat.' },
                      { q: 'How do I verify my account?', a: 'Upload a clear copy of your Identity document in your profile settings or share it directly with our support agent in chat.' },
                      { q: 'Is my personal data secure?', a: 'Yes, we use global bank-grade encryption to protect all your account data.' },
                    ].map((faq, idx) => (
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
    </div>
  );
};

export default CustomerDashboard;
