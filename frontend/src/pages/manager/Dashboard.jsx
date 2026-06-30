import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import api from '../../hooks/api';
import ChatScreen from '../../components/chat/ChatScreen';
import ChatList from '../../components/chat/ChatList';
import LeadTable from '../../components/leads/LeadTable';
import LeadDetail from '../../components/leads/LeadDetail';
import NotificationBell from '../../components/NotificationBell';
import UserManager from '../../components/admin/UserManager';
import { requestNotificationPermission } from '../../utils/notifications';

const ManagerDashboard = () => {
  const { user, logout } = useAuth();
  const { isConnected, reconnected, on, off, joinRoom } = useSocket();
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [stats, setStats] = useState({
    totalAgents: 0,
    activeAgents: 0,
    awayAgents: 0,
    breakAgents: 0,
    offlineAgents: 0,
    totalLeads: 0,
    assignedLeads: 0,
    unassignedLeads: 0,
    openChats: 0,
    pendingChats: 0,
  });

  const loadStats = async () => {
    try {
      const [chatsRes, leadsRes, agentsRes] = await Promise.all([
        api.get('/api/chats'),
        api.get('/api/leads?limit=1000'),
        api.get('/api/users/agents'),
      ]);

      const chatList = chatsRes.data.chats || [];
      const leadList = leadsRes.data.leads || [];
      const agentList = agentsRes.data.agents || [];

      // Agent Stats
      const totalAgents = agentList.length;
      const activeAgents = agentList.filter(a => a.status === 'online').length;
      const awayAgents = agentList.filter(a => a.status === 'away').length;
      const breakAgents = agentList.filter(a => a.status === 'break').length;
      const offlineAgents = agentList.filter(a => !a.isActive || (!a.status || a.status === 'offline')).length;

      // Lead Stats
      const totalLeads = leadList.length;
      const assignedLeads = leadList.filter(l => l.assignedAgent).length;
      const unassignedLeads = totalLeads - assignedLeads;

      // Chat Stats
      const openChats = chatList.filter(c => c.status === 'active').length;
      const pendingChats = chatList.filter(c => c.status === 'active' && (c.unreadCount > 0)).length;

      setStats({
        totalAgents,
        activeAgents,
        awayAgents,
        breakAgents,
        offlineAgents,
        totalLeads,
        assignedLeads,
        unassignedLeads,
        openChats,
        pendingChats,
      });
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    }
  };

  useEffect(() => {
    loadChats();
    requestNotificationPermission();

    const handleOpenChat = (e) => {
      const chatId = e.detail?.chatId;
      if (chatId) {
        setActiveChat({ _id: chatId });
        setActiveTab('chats');
        if (isConnected) joinRoom(chatId);
      }
    };
    window.addEventListener('open-chat', handleOpenChat);
    return () => window.removeEventListener('open-chat', handleOpenChat);
  }, [isConnected, joinRoom]);

  useEffect(() => {
    loadStats();
  }, [activeTab, chats]);

  useEffect(() => {
    if (reconnected > 0) { loadChats(); }
  }, [reconnected]);

  useEffect(() => {
    const handleNewChatAvailable = () => loadChats();
    const handleNewChatAssigned = () => loadChats();
    const handleChatClosed = (data) => {
      setChats(prev => prev.map(c => c._id === data.chatId ? { ...c, status: 'closed' } : c));
    };

    const handleNewMessage = (message) => {
      setChats(prev => {
        const idx = prev.findIndex(c => c._id === message.chatId);
        if (idx === -1) { loadChats(); return prev; }
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          lastMessageAt: message.createdAt,
          lastMessage: { content: message.content },
          unreadCount: message.senderId?.toString() !== user?._id?.toString()
            ? (updated[idx].unreadCount || 0) + 1
            : updated[idx].unreadCount,
        };
        updated.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
        return updated;
      });
    };

    const handleMessageRead = (data) => {
      setChats(prev => prev.map(c => c._id === data.chatId ? { ...c, unreadCount: 0 } : c));
    };

    on('new_chat_available', handleNewChatAvailable);
    on('new_chat_assigned', handleNewChatAssigned);
    on('chat_closed', handleChatClosed);
    on('new_message', handleNewMessage);
    on('message_read', handleMessageRead);

    return () => {
      off('new_chat_available', handleNewChatAvailable);
      off('new_chat_assigned', handleNewChatAssigned);
      off('chat_closed', handleChatClosed);
      off('new_message', handleNewMessage);
      off('message_read', handleMessageRead);
    };
  }, [on, off, user]);

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

  const handleSelectChat = (chat) => {
    setActiveChat(chat);
  };

  const handleSelectLead = (lead) => {
    setSelectedLead(lead);
  };

  const filteredChats = chats.filter(chat => {
    if (filter === 'new') return chat.status === 'active' && !chat.agentId;
    if (filter === 'active') return chat.status === 'active';
    if (filter === 'unread') return (chat.unreadCount || 0) > 0;
    if (filter === 'done') return chat.status === 'closed';
    return true;
  }).filter(chat => {
    if (!searchQuery) return true;
    const name = chat.customerId?.fullName?.toLowerCase() || '';
    const id = chat.customerId?.customerId?.toLowerCase() || '';
    return name.includes(searchQuery.toLowerCase()) || id.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="h-screen bg-bg flex flex-col overflow-hidden">
      <header className="bg-surface border-b border-border h-14 flex-shrink-0 flex items-center justify-between px-6 z-10 shadow-sm">
        {/* Left: Brand logo & name */}
        <div className="flex items-center gap-3">
          <h1 className="text-base font-extrabold text-text-1 tracking-wider">MANAGER</h1>
          <span className="text-[10px] bg-primary-light text-primary font-bold px-2 py-0.5 border border-primary/20 rounded">WORKSPACE</span>
        </div>

        {/* Center: Tabs */}
        <div className="flex items-center gap-1 h-full">
          {[
            { key: 'dashboard', label: 'Dashboard' },
            { key: 'chats', label: 'Chats Workspace' },
            { key: 'leads', label: 'Leads' },
            { key: 'agents', label: 'Agents' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setActiveTab(key); if (key !== 'chats') setActiveChat(null); }}
              className={`px-4 h-full text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center ${
                activeTab === key
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-text-3 hover:text-text-1 hover:bg-bg/5'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Right: Actions and Live stats */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-bg border border-border px-2 py-1 rounded">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-danger'}`} />
            <span className="text-[10px] text-text-2 font-medium tracking-wide uppercase">{isConnected ? 'Live' : 'Offline'}</span>
          </div>
          <NotificationBell />
          <button onClick={logout} className="text-text-2 hover:text-primary transition-colors p-1" aria-label="Logout">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="flex-1 overflow-hidden flex flex-col bg-bg">
        {activeTab === 'dashboard' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-surface p-5 border border-border flex flex-col justify-between shadow-card rounded-lg">
                <div>
                  <p className="text-xs font-semibold text-text-3 uppercase tracking-wider mb-1">Total Leads</p>
                  <h3 className="text-2xl font-bold text-text-1">{stats.totalLeads}</h3>
                </div>
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-border/50 text-xs">
                  <span className="text-success font-medium">Assigned: {stats.assignedLeads}</span>
                  <span className="text-warning font-medium">Unassigned: {stats.unassignedLeads}</span>
                </div>
              </div>

              <div className="bg-surface p-5 border border-border flex flex-col justify-between shadow-card rounded-lg">
                <div>
                  <p className="text-xs font-semibold text-text-3 uppercase tracking-wider mb-1">Open Chats</p>
                  <h3 className="text-2xl font-bold text-text-1">{stats.openChats}</h3>
                </div>
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-border/50 text-xs">
                  <span className="text-primary font-medium">Unassigned Chats: {stats.pendingChats}</span>
                </div>
              </div>

              <div className="bg-surface p-5 border border-border flex flex-col justify-between shadow-card rounded-lg">
                <div>
                  <p className="text-xs font-semibold text-text-3 tracking-wider mb-1 uppercase">Active Agents</p>
                  <h3 className="text-2xl font-bold text-success">{stats.activeAgents}</h3>
                </div>
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50 text-xs text-text-2">
                  <span>Total Registered: {stats.totalAgents}</span>
                </div>
              </div>

              <div className="bg-surface p-5 border border-border flex flex-col justify-between shadow-card rounded-lg">
                <div>
                  <p className="text-xs font-semibold text-text-3 tracking-wider mb-1 uppercase">Agent Availability</p>
                  <h3 className="text-2xl font-bold text-text-1">
                    {stats.awayAgents + stats.breakAgents + stats.offlineAgents}
                  </h3>
                </div>
                <div className="flex gap-3 mt-4 pt-3 border-t border-border/50 text-xs text-text-2">
                  <span className="text-amber-600 font-semibold">Busy: {stats.awayAgents}</span>
                  <span className="text-red-500 font-semibold">Break: {stats.breakAgents}</span>
                  <span className="text-text-3 font-semibold">Offline: {stats.offlineAgents}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chats' && (
          <div className="flex-1 flex overflow-hidden h-full w-full">
            {/* Left sidebar chats list */}
            <div className="w-[280px] bg-surface border-r border-border flex flex-col flex-shrink-0 h-full overflow-hidden">
              <div className="p-3 border-b border-border">
                <div className="relative">
                  <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search chats..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-field pl-10 text-sm w-full"
                  />
                </div>
              </div>

              <div className="flex gap-0.5 p-1 border-b border-border overflow-x-auto scrollbar-hide">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'new', label: 'New' },
                  { key: 'active', label: 'Active' },
                  { key: 'unread', label: 'Unread' },
                  { key: 'done', label: 'Done' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`flex-1 px-1.5 py-1 text-[10px] font-bold transition-colors border ${
                      filter === key
                        ? 'bg-primary text-white border-primary'
                        : 'bg-surface border-border text-text-2 hover:bg-bg'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="space-y-0">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border animate-pulse">
                        <div className="w-10 h-10 bg-bg" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-bg rounded w-1/3" />
                          <div className="h-3 bg-bg rounded w-2/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ChatList
                    chats={filteredChats}
                    activeChatId={activeChat?._id}
                    onSelectChat={handleSelectChat}
                    user={user}
                  />
                )}
              </div>
            </div>

            {/* Right chat panel view */}
            <div className="flex-1 bg-bg flex flex-col min-w-0 h-full overflow-hidden relative">
              {activeChat ? (
                <div className="h-full flex flex-col relative bg-surface">
                  <ChatScreen
                    chatId={activeChat._id}
                    onBack={() => setActiveChat(null)}
                    onMenuClick={() => {}}
                  />
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center h-full bg-bg">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-primary-light flex items-center justify-center mx-auto mb-4 border border-border rounded-full">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <h3 className="text-base font-bold text-text-1 mb-1">Select a Conversation</h3>
                    <p className="text-xs text-text-3">Pick a customer session from the list to view context and chat</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'leads' && (
          <div className="flex-1 flex gap-4 p-6 overflow-hidden h-full w-full">
            <div className="flex-1 bg-surface border border-border flex flex-col overflow-y-auto h-full rounded-lg shadow-sm">
              <LeadTable onSelectLead={handleSelectLead} />
            </div>
            {selectedLead && (
              <div className="w-[420px] bg-surface border border-border flex flex-col overflow-y-auto h-full rounded-lg shadow-sm">
                <LeadDetail
                  leadId={selectedLead._id}
                  onClose={() => setSelectedLead(null)}
                  onUpdate={loadStats}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'agents' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <UserManager key="manager-agents" initialFilter="agent" />
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagerDashboard;
