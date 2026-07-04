import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import api from '../../hooks/api';
import ChatScreen from '../../components/chat/ChatScreen';
import ChatList from '../../components/chat/ChatList';
import NotificationBell from '../../components/NotificationBell';
import { requestNotificationPermission, showBrowserNotification, playNotificationSound } from '../../utils/notifications';
import useIdleTimer from '../../hooks/useIdleTimer';

const ISSUE_LABELS = { deposit: '💳 Deposit', withdrawal: '💸 Withdrawal', other: '💬 General' };

const AgentDashboard = () => {
  const { user, logout, updateUser } = useAuth();
  const { isConnected, reconnected, on, off, joinRoom } = useSocket();
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(user?.status || 'online');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState(user?.fullName || '');
  const [profileAvatar, setProfileAvatar] = useState(user?.avatar || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);


  useEffect(() => {
    if (user) {
      setProfileName(user.fullName || '');
      setProfileAvatar(user.avatar || '');
    }
  }, [user, showProfileModal]);

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/api/messages/media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProfileAvatar(res.data.mediaUrl);
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      alert('Failed to upload profile picture');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    try {
      const res = await api.patch('/api/users/profile', {
        fullName: profileName.trim(),
        avatar: profileAvatar,
      });
      updateUser(res.data.user);
      setShowProfileModal(false);
    } catch (error) {
      console.error('Failed to save profile:', error);
      alert('Failed to save profile changes');
    }
  };
  const activeChatRef = useRef(activeChat);
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  const chatsRef = useRef(chats);
  chatsRef.current = chats;

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const agentIssueTypes = user?.permissions?.issueTypes || [];

  const loadChats = async () => {
    try {
      const res = await api.get('/api/chats');
      setChats(res.data.chats);
      if (activeChatRef.current?._id) {
        const freshActive = res.data.chats.find(c => c._id === activeChatRef.current._id);
        if (freshActive) {
          setActiveChat(freshActive);
        }
      }
    }
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
    const handleLeadStatusChanged = () => {
      loadChats();
    };
    window.addEventListener('open-chat', handleOpenChat);
    window.addEventListener('lead-status-changed', handleLeadStatusChanged);
    return () => {
      window.removeEventListener('open-chat', handleOpenChat);
      window.removeEventListener('lead-status-changed', handleLeadStatusChanged);
    };
  }, [isConnected, joinRoom]);

  useEffect(() => { if (reconnected > 0) loadChats(); }, [reconnected]);

  useEffect(() => {
    const handleNewChatAvailable = () => loadChats();
    const handleNewChatAssigned = (data) => { loadChats(); if (data.chatId) { api.get('/api/chats').then(res => { const f = res.data.chats?.find(c => c._id === data.chatId); if (f) { setActiveChat(f); if (isConnected) joinRoom(data.chatId); } }); } };
    const handleChatClosed = (data) => { setChats(prev => prev.map(c => c._id === data.chatId ? { ...c, status: 'closed' } : c)); };
    const handleNewMessage = (message) => {
      setChats(prev => {
        const idx = prev.findIndex(c => c._id === message.chatId);
        if (idx === -1) { loadChats(); return prev; }
        const updated = [...prev];
        updated[idx] = { ...updated[idx], lastMessageAt: message.createdAt, lastMessage: { content: message.content }, unreadCount: message.senderRole === 'customer' ? (updated[idx].unreadCount || 0) + 1 : updated[idx].unreadCount };
        updated.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
        return updated;
      });
      setActiveChat(prev => prev && prev._id === message.chatId ? { ...prev, lastMessageAt: message.createdAt, lastMessage: { content: message.content } } : prev);

      // Trigger real-time sound and desktop notification for agent ONLY if it is from the customer
      // AND either assigned to me or unassigned in my category queue
      const chatObj = chatsRef.current.find(c => c._id === message.chatId);
      const isAssignedToMe = chatObj && (
        (chatObj.agentId === userRef.current?._id) ||
        (chatObj.agentId?._id === userRef.current?._id)
      );
      const isUnassignedSpecialist = chatObj && !chatObj.agentId && (
        userRef.current?.permissions?.issueTypes?.includes(chatObj.issueType)
      );

      if (message.senderRole === 'customer' && (isAssignedToMe || isUnassignedSpecialist)) {
        playNotificationSound();
        if (document.hidden || activeChatRef.current?._id !== message.chatId) {
          showBrowserNotification(message.senderName || 'New Client Message', {
            body: message.content || 'Sent an attachment',
            tag: message.chatId,
          });
        }
      }
    };
    const handleAgentStatusChanged = (data) => { 
      setChats(prev => prev.map(c => c.agentId?._id === data.userId ? { ...c, agentId: { ...c.agentId, status: data.status } } : c)); 
      if (data.userId === user?._id) {
        setCurrentStatus(data.status);
      }
    };
    const handleMessageRead = (data) => { setChats(prev => prev.map(c => c._id === data.chatId ? { ...c, unreadCount: 0 } : c)); };
    const handleLeadReassigned = (data) => {
      loadChats();
      setActiveChat(prev => {
        if (prev && prev._id === data.chatId) {
          alert(`This lead has been reassigned to ${data.newAgent || 'another agent'} due to category changes.`);
          return null;
        }
        return prev;
      });
    };

    on('new_chat_available', handleNewChatAvailable);
    on('new_chat_assigned', handleNewChatAssigned);
    on('chat_closed', handleChatClosed);
    on('new_message', handleNewMessage);
    on('agent_status_changed', handleAgentStatusChanged);
    on('message_read', handleMessageRead);
    on('lead_reassigned', handleLeadReassigned);
    return () => {
      off('new_chat_available', handleNewChatAvailable);
      off('new_chat_assigned', handleNewChatAssigned);
      off('chat_closed', handleChatClosed);
      off('new_message', handleNewMessage);
      off('agent_status_changed', handleAgentStatusChanged);
      off('message_read', handleMessageRead);
      off('lead_reassigned', handleLeadReassigned);
    };
  }, [on, off, user, isConnected, joinRoom]);

  const handleStatusChange = async (status) => { try { await api.patch('/api/users/status', { status }); setCurrentStatus(status); setShowStatusMenu(false); } catch (error) { console.error('Failed to update status:', error); } };
  
  useIdleTimer({
    currentStatus,
    onStatusChange: handleStatusChange,
  });
  const handleSelectChat = (chat) => { setActiveChat(chat); if (isConnected) joinRoom(chat._id); };

  const filteredChats = chats.filter(chat => {
    if (filter === 'new') return chat.status === 'active' && !chat.agentId;
    if (filter === 'active') return chat.status === 'active';
    if (filter === 'unread') return (chat.unreadCount || 0) > 0;
    if (filter === 'done') return chat.status === 'closed';
    return true;
  }).filter(chat => !searchQuery || (chat.customerId?.fullName?.toLowerCase() || '').includes(searchQuery.toLowerCase()));

  const activeChatsCount = chats.filter(c => c.status === 'active').length;
  const unreadChatsCount = chats.filter(c => (c.unreadCount || 0) > 0).length;
  const totalUnread = chats.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  const statusColors = { online: 'bg-emerald-500', away: 'bg-amber-500', break: 'bg-amber-500', offline: 'bg-gray-500' };
  const statusLabels = { online: 'Online', away: 'Away', break: 'On Break', offline: 'Offline' };

  return (
    <div className="h-screen flex bg-bg overflow-hidden relative">
      {/* Sidebar */}
      <div className={`w-full md:w-[320px] bg-surface border-r border-border flex flex-col flex-shrink-0 transition-all duration-300 ${
        activeChat ? 'hidden md:flex' : 'flex'
      }`}>
        {/* Agent Header */}
        <div className="bg-primary px-5 py-4 flex-shrink-0" style={{ backgroundColor: 'var(--primary)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {user?.avatar ? (
                <img src={user.avatar} alt="Avatar" className="w-11 h-11 object-cover rounded-full border-2 border-white/30 shadow-md" />
              ) : (
                <div className="w-11 h-11 bg-white/10 rounded-full border border-white/20 flex items-center justify-center shadow-inner">
                  <span className="text-base font-bold text-white">{user?.fullName?.charAt(0) || 'A'}</span>
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-white truncate">{user?.fullName}</h1>
                <p className="text-[11px] text-white/60 truncate">{agentIssueTypes.length > 0 ? agentIssueTypes.map(t => ISSUE_LABELS[t]).join(', ') : 'All Categories'}</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <NotificationBell className="text-white hover:text-white/80" align="left" />
              <button
                onClick={() => setShowProfileModal(true)}
                className="w-9 h-9 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all rounded-full cursor-pointer bg-transparent border-0 outline-none"
                title="Edit Profile"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <button onClick={logout} className="w-9 h-9 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all rounded-full cursor-pointer bg-transparent border-0 outline-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
          </div>

          {/* Status + Stats */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <button onClick={() => setShowStatusMenu(!showStatusMenu)} className="flex items-center gap-2 px-3.5 py-2 text-xs font-extrabold bg-white/10 border border-white/15 hover:bg-white/20 rounded-xl transition-all w-full text-left outline-none cursor-pointer">
                <div className={`w-2.5 h-2.5 rounded-full ${statusColors[currentStatus]}`} />
                <span className="text-white/90">{statusLabels[currentStatus]}</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white/40 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showStatusMenu && (
                <div className="absolute left-0 top-full mt-1.5 w-full bg-surface border border-border shadow-float rounded-xl z-50 overflow-hidden backdrop-blur-md">
                  {[
                    { key: 'online', label: 'Online', color: 'bg-emerald-500' },
                    { key: 'break', label: 'On Break', color: 'bg-amber-500' },
                    { key: 'offline', label: 'Offline', color: 'bg-gray-500' }
                  ].map(({ key, label, color }) => (
                    <button key={key} onClick={() => handleStatusChange(key)} className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-bg transition-colors cursor-pointer border-0 bg-transparent outline-none ${currentStatus === key ? 'bg-primary-light' : ''}`}>
                      <div className={`w-2.5 h-2.5 rounded-full ${color}`} /><span className="text-text-1 font-bold">{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 px-3 py-1.5 bg-white/10 border border-white/15 rounded-xl select-none">
              <div className="text-center">
                <p className="text-xs font-extrabold text-white leading-none">{activeChatsCount}</p>
                <p className="text-[9px] text-white/60 font-semibold mt-0.5 uppercase tracking-wider">Active</p>
              </div>
              {totalUnread > 0 && (
                <div className="text-center">
                  <p className="text-xs font-extrabold text-white leading-none">{totalUnread}</p>
                  <p className="text-[9px] text-white/60 font-semibold mt-0.5 uppercase tracking-wider">Unread</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-3.5 py-2.5 border-b border-border bg-bg/5">
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="Search conversations..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-bg border border-border rounded-xl text-sm placeholder-text-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
          </div>
        </div>

        {/* Filter Tabs */}
        <div 
          className="flex gap-1.5 px-3.5 py-2 border-b border-border overflow-x-auto bg-surface/50 flex-nowrap whitespace-nowrap [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active', count: activeChatsCount },
            { key: 'unread', label: 'Unread', count: unreadChatsCount },
            { key: 'new', label: 'New' },
            { key: 'done', label: 'Done' }
          ].map(({ key, label, count }) => (
            <button 
              key={key} 
              onClick={() => setFilter(key)} 
              className={`px-3.5 py-1.5 text-[10px] font-extrabold rounded-full transition-all whitespace-nowrap flex-shrink-0 cursor-pointer border ${
                filter === key 
                  ? 'bg-primary text-white border-primary shadow-sm hover:brightness-110' 
                  : 'bg-bg text-text-2 hover:text-text-1 border-border/80 hover:border-border'
              }`}
              style={filter === key ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' } : {}}
            >
              {label.toUpperCase()}{count > 0 && <span className="ml-1 px-1.5 py-0.2 bg-white/20 rounded-full text-[9px] font-bold">{count}</span>}
            </button>
          ))}
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-0">{[1, 2, 3].map(i => (<div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border animate-pulse"><div className="w-11 h-11 bg-bg rounded-xl" /><div className="flex-1 space-y-2"><div className="h-4 bg-bg rounded w-1/3" /><div className="h-3 bg-bg rounded w-2/3" /></div></div>))}</div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-16 h-16 bg-bg flex items-center justify-center mb-4 rounded-2xl border border-border"><svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-text-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg></div>
              <h3 className="text-sm font-bold text-text-1 mb-1">No chats yet</h3>
              <p className="text-xs text-text-3 leading-relaxed">New leads will appear here when assigned</p>
            </div>
          ) : (
            <ChatList chats={filteredChats} activeChatId={activeChat?._id} onSelectChat={handleSelectChat} user={user} />
          )}
        </div>
      </div>

      {/* Right Side */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
        !activeChat ? 'hidden md:flex' : 'flex'
      }`}>
        {activeChat ? (
          <div className="h-full"><ChatScreen chatId={activeChat._id} onBack={() => setActiveChat(null)} onMenuClick={() => {}} /></div>
        ) : (
          <div className="flex-1 flex items-center justify-center h-full bg-bg">
            <div className="text-center animate-fade-in select-none">
              <div className="w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-5 border border-primary/20" style={{ backgroundColor: `rgba(var(--primary), 0.1)` }}><svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--primary)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg></div>
              <h3 className="text-base font-extrabold text-text-1 mb-1 tracking-wide uppercase">Select a conversation</h3>
              <p className="text-xs text-text-3 font-semibold mt-1">Choose a chat from the sidebar to start helping clients</p>
            </div>
          </div>
        )}
      </div>

      {/* Profile Settings Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface max-w-sm w-full p-6 shadow-float border border-border rounded-2xl animate-scale-in">
            <h2 className="text-base font-extrabold text-text-1 mb-4 uppercase tracking-wide">Edit Profile</h2>
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div className="flex flex-col items-center gap-3">
                <div className="w-20 h-20 bg-bg border border-border flex items-center justify-center overflow-hidden relative rounded-full shadow-inner">
                  {profileAvatar ? (
                    <img src={profileAvatar} alt="Avatar Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-text-3">{profileName.charAt(0) || 'A'}</span>
                  )}
                  {uploadingAvatar && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin" />
                    </div>
                  )}
                </div>
                <label className="text-xs text-primary hover:text-primary-hover font-bold cursor-pointer uppercase tracking-wider">
                  {uploadingAvatar ? 'Uploading...' : 'Change Photo'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled={uploadingAvatar} />
                </label>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-text-2 mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full border border-border rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-text-2 mb-1.5">Mobile Number (Login ID)</label>
                <input
                  type="text"
                  disabled
                  value={user?.mobile || ''}
                  className="w-full border border-border rounded-xl px-3.5 py-2 text-sm bg-bg text-text-3 cursor-not-allowed font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-text-2 mb-1.5">Assigned Categories</label>
                <input
                  type="text"
                  disabled
                  value={agentIssueTypes.length > 0 ? agentIssueTypes.join(', ').toUpperCase() : 'ALL CATEGORIES'}
                  className="w-full border border-border rounded-xl px-3.5 py-2 text-sm bg-bg text-text-3 cursor-not-allowed font-semibold text-xs"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-border mt-5">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-4 py-2 border border-border text-xs font-bold text-text-2 hover:text-text-1 hover:bg-bg transition-colors rounded-xl cursor-pointer bg-transparent"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={uploadingAvatar}
                  className="px-4 py-2 bg-primary hover:bg-primary/95 text-white text-xs font-bold transition-colors disabled:opacity-50 rounded-xl cursor-pointer"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  SAVE CHANGES
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentDashboard;
