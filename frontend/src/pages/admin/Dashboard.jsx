import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import api from '../../hooks/api';
import BrandingSettings from '../../components/admin/BrandingSettings';
import BannerManager from '../../components/admin/BannerManager';
import AnnouncementManager from '../../components/admin/AnnouncementManager';
import StickerManager from '../../components/admin/StickerManager';
import UserManager from '../../components/admin/UserManager';
import AnalyticsDashboard from '../../components/admin/AnalyticsDashboard';
import NotificationBell from '../../components/NotificationBell';
import ChatScreen from '../../components/chat/ChatScreen';
import ChatList from '../../components/chat/ChatList';
import LeadTable from '../../components/leads/LeadTable';
import LeadDetail from '../../components/leads/LeadDetail';
import { requestNotificationPermission } from '../../utils/notifications';
import { useBranding } from '../../context/BrandingContext';
import BroadcastManager from '../../components/admin/BroadcastManager';
import AgentActivityPanel from '../../components/admin/AgentActivityPanel';

const renderSidebarIcon = (key) => {
  const css = "w-4 h-4 flex-shrink-0";
  if (key === 'dashboard') {
    return (
      <svg className={css} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    );
  }
  if (key === 'chats') {
    return (
      <svg className={css} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    );
  }
  if (key === 'leads') {
    return (
      <svg className={css} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    );
  }
  if (key === 'branding') {
    return (
      <svg className={css} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    );
  }
  if (key === 'banners') {
    return (
      <svg className={css} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  if (key === 'announcements') {
    return (
      <svg className={css} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      </svg>
    );
  }
  if (key === 'stickers') {
    return (
      <svg className={css} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (key === 'agentActivity') {
    return (
      <svg className={css} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (key === 'broadcast') {
    return (
      <svg className={css} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v18c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
    );
  }
  return (
    <svg className={css} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
};

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const { branding } = useBranding();
  const { isConnected, reconnected, on, off, joinRoom } = useSocket();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);

  const loadChats = async () => {
    try {
      const res = await api.get('/api/chats');
      setChats(res.data.chats);
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLead = (lead) => {
    setSelectedLead(lead);
    setActiveChat(null);
  };

  useEffect(() => {
    loadChats();
    requestNotificationPermission();

    const handleOpenChat = (e) => {
      const chatId = e.detail?.chatId;
      if (chatId) {
        setActiveChat({ _id: chatId });
        setSelectedLead(null);
        setActiveSection('chats');
        if (isConnected) joinRoom(chatId);
      }
    };
    window.addEventListener('open-chat', handleOpenChat);
    return () => window.removeEventListener('open-chat', handleOpenChat);
  }, [isConnected, joinRoom]);

  useEffect(() => {
    if (reconnected > 0) loadChats();
  }, [reconnected]);

  useEffect(() => {
    const handleNewChatAvailable = () => loadChats();
    const handleNewChatAssigned = () => loadChats();
    const handleNewMessage = (message) => {
      setChats(prev => {
        const idx = prev.findIndex(c => c._id === message.chatId);
        if (idx === -1) { loadChats(); return prev; }
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          lastMessageAt: message.createdAt,
          lastMessage: { content: message.content },
        };
        updated.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
        return updated;
      });
    };
    const handleChatClosed = (data) => {
      setChats(prev => prev.map(c => c._id === data.chatId ? { ...c, status: 'closed' } : c));
    };
    const handleMessageRead = (data) => {
      setChats(prev => prev.map(c => c._id === data.chatId ? { ...c, unreadCount: 0 } : c));
    };

    on('new_chat_available', handleNewChatAvailable);
    on('new_chat_assigned', handleNewChatAssigned);
    on('new_message', handleNewMessage);
    on('chat_closed', handleChatClosed);
    on('message_read', handleMessageRead);

    return () => {
      off('new_chat_available', handleNewChatAvailable);
      off('new_chat_assigned', handleNewChatAssigned);
      off('new_message', handleNewMessage);
      off('chat_closed', handleChatClosed);
      off('message_read', handleMessageRead);
    };
  }, [on, off]);

  const sections = [
    { key: 'dashboard', label: 'Dashboard', group: 'Overview' },
    { key: 'chats', label: 'All Chats', group: 'Monitor' },
    { key: 'leads', label: 'Leads', group: 'Monitor' },
    { key: 'agentActivity', label: 'Agent Activity', group: 'Monitor' },
    { key: 'branding', label: 'Branding', group: 'Customization' },
    { key: 'banners', label: 'Banners', group: 'Customization' },
    { key: 'announcements', label: 'Announcements', group: 'Customization' },
    { key: 'broadcast', label: 'Broadcast', group: 'Communication' },
    { key: 'stickers', label: 'Stickers', group: 'Content' },
    { key: 'users', label: 'All Users', group: 'Users' },
    { key: 'agents', label: 'Agents', group: 'Users' },
    { key: 'managers', label: 'Managers', group: 'Users' },
  ];

  const renderContent = () => {
    if (selectedLead) {
      return (
        <LeadDetail
          leadId={selectedLead._id}
          onClose={() => setSelectedLead(null)}
          onUpdate={() => {}}
        />
      );
    }

    if (activeChat) {
      return (
        <div className="h-[calc(100vh-100px)]">
          <ChatScreen
            chatId={activeChat._id}
            onBack={() => setActiveChat(null)}
            onMenuClick={() => {}}
          />
        </div>
      );
    }

    switch (activeSection) {
      case 'dashboard': return <AnalyticsDashboard />;
      case 'chats': return (
        <div className="bg-surface rounded-lg shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-text-1">All Chats ({chats.length})</h3>
          </div>
          <ChatList
            chats={chats}
            activeChatId={activeChat?._id}
            onSelectChat={(chat) => setActiveChat(chat)}
            user={user}
          />
          {chats.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-text-3">No chats yet</p>
            </div>
          )}
        </div>
      );
      case 'leads': return <LeadTable onSelectLead={handleSelectLead} />;
      case 'branding': return <BrandingSettings />;
      case 'banners': return <BannerManager />;
      case 'announcements': return <AnnouncementManager />;
      case 'stickers': return <StickerManager />;
      case 'users': return <UserManager key="all-users" />;
      case 'agents': return <UserManager key="agents" initialFilter="agent" />;
      case 'managers': return <UserManager key="managers" initialFilter="manager" />;
      case 'agentActivity': return <AgentActivityPanel />;
      case 'broadcast': return <BroadcastManager />;
      default: return <AnalyticsDashboard />;
    }
  };

  const groupedSections = sections.reduce((acc, section) => {
    if (!acc[section.group]) acc[section.group] = [];
    acc[section.group].push(section);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-bg flex">
      <aside className="hidden md:flex w-60 bg-sidebar flex-col min-h-screen">
        <div className="p-4 border-b border-white/10 flex items-center gap-2">
          {branding.logo ? (
            <img src={branding.logo} alt={branding.companyName || 'DAFAX'} className="h-6 object-contain" />
          ) : (
            <div className="w-6 h-6 rounded bg-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-white">{(branding.companyName || 'DAFAX').charAt(0)}</span>
            </div>
          )}
          <h1 className="text-xs font-bold text-white uppercase tracking-wider">{branding.companyName || 'DAFAX'} Admin</h1>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {Object.entries(groupedSections).map(([group, items]) => (
            <div key={group}>
              <div className="px-3 py-2 pt-4 first:pt-0">
                <p className="text-[11px] font-semibold text-sidebar-text uppercase tracking-wider">{group}</p>
              </div>
              {items.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => {
                    setActiveSection(key);
                    setActiveChat(null);
                    setSelectedLead(null);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors ${
                    activeSection === key && !activeChat
                      ? 'bg-sidebar-active text-white border-l-2 border-primary'
                      : 'text-sidebar-text hover:bg-sidebar-active hover:text-white border-l-2 border-transparent'
                  }`}
                >
                  <span>{renderSidebarIcon(key)}</span>
                  {label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <span className="text-xs font-semibold text-white">
                {user?.fullName?.charAt(0) || 'A'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.fullName}</p>
              <p className="text-xs text-sidebar-text truncate">Super Admin</p>
            </div>
            <button onClick={logout} className="text-sidebar-text hover:text-white" aria-label="Logout">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="bg-surface border-b border-border h-11 flex items-center justify-between px-4 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            {(activeChat || selectedLead) && (
              <button
                onClick={() => { setActiveChat(null); setSelectedLead(null); }}
                className="btn-icon text-text-1 md:hidden"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-sm font-semibold text-text-1 capitalize">
              {activeChat ? 'Chat' : selectedLead ? 'Lead' : sections.find(s => s.key === activeSection)?.label || 'Dashboard'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success' : 'bg-danger'}`} />
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
