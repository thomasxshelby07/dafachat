import { useBranding } from '../../context/BrandingContext';

const ChatList = ({ chats, activeChatId, onSelectChat, user }) => {
  const { branding } = useBranding();

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

  const getStatusBadgeClass = (status) => {
    const classes = {
      new: 'bg-blue-100 text-blue-700',
      assigned: 'bg-purple-100 text-purple-700',
      in_progress: 'bg-amber-100 text-amber-700',
      follow_up: 'bg-cyan-100 text-cyan-700',
      interested: 'bg-emerald-100 text-emerald-700',
      converted: 'bg-green-100 text-green-700',
      closed: 'bg-gray-100 text-gray-500',
    };
    return classes[status] || 'bg-gray-100 text-gray-500';
  };

  const formatStatus = (status) => {
    return status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'New';
  };

  const getDisplayName = (chat, isCustomerView) => {
    if (isCustomerView) return branding.companyName ? `${branding.companyName.toUpperCase()} SUPPORT` : 'SUPPORT';
    return chat.customerId?.fullName || 'Unknown';
  };

  const isCustomerView = user?.role === 'customer';

  return (
    <div className="divide-y divide-border">
      {chats.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="w-16 h-16 bg-bg rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-text-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-text-1 mb-1">No chats yet</h3>
          <p className="text-xs text-text-2">
            {isCustomerView ? 'Start a new chat to get help' : 'New leads will appear here when assigned'}
          </p>
        </div>
      ) : (
        chats.map((chat) => {
          const chatUser = isCustomerView ? chat.agentId : chat.customerId;
          const displayName = getDisplayName(chat, isCustomerView);
          const isActive = chat._id === activeChatId;
          const unread = chat.unreadCount || 0;
          const lastMsg = chat.lastMessage?.content || 'No messages yet';

          return (
            <button
              key={chat._id}
              onClick={() => onSelectChat(chat)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 transition-all text-left ${
                isActive ? 'bg-primary-light' : 'hover:bg-bg active:bg-bg'
              }`}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {chatUser?.avatar ? (
                  <img
                    src={chatUser.avatar}
                    alt={displayName}
                    className="w-9 h-9 object-cover flex-shrink-0 border border-border"
                  />
                ) : (
                  <div className="w-9 h-9 bg-primary flex items-center justify-center">
                    <span className="text-xs font-bold text-white">
                      {isCustomerView ? 'D' : (displayName.charAt(0) || '?')}
                    </span>
                  </div>
                )}
                {!isCustomerView && chatUser?.isOnline && (
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-success border-2 border-surface" />
                )}
                {unread > 0 && (
                  <div className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 bg-danger flex items-center justify-center rounded-full">
                    <span className="text-[8px] font-bold text-white">{unread > 99 ? '99+' : unread}</span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1.5">
                  <h3 className={`text-xs truncate ${unread > 0 ? 'font-bold text-text-1' : 'font-medium text-text-1'}`}>
                    {displayName}
                  </h3>
                  <span className={`text-[10px] flex-shrink-0 ${unread > 0 ? 'text-primary font-semibold' : 'text-text-3'}`}>
                    {formatTime(chat.lastMessageAt)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-1.5 mt-0.5">
                  <p className={`text-[11px] truncate ${unread > 0 ? 'font-medium text-text-1' : 'text-text-2'}`}>
                    {isCustomerView && lastMsg !== 'No messages yet' ? `💬 ${lastMsg}` : lastMsg}
                  </p>
                </div>

                {!isCustomerView && (
                  <div className="flex items-center gap-1 mt-0.5">
                    {chat.issueType && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 border border-current/20 ${
                        chat.issueType === 'deposit' ? 'bg-blue-50 text-blue-600' :
                        chat.issueType === 'withdrawal' ? 'bg-amber-50 text-amber-600' :
                        chat.issueType === 'new_id' ? 'bg-emerald-50 text-emerald-600' :
                        chat.issueType === 'verify_id' ? 'bg-indigo-50 text-indigo-600' :
                        'bg-purple-50 text-purple-600'
                      }`}>
                        {chat.issueType === 'deposit' ? '💳' :
                         chat.issueType === 'withdrawal' ? '💸' :
                         chat.issueType === 'new_id' ? '🆕' :
                         chat.issueType === 'verify_id' ? '🔍' : '💬'} {
                          chat.issueType === 'new_id' ? 'new id' :
                          chat.issueType === 'verify_id' ? 'verify id' : chat.issueType
                         }
                      </span>
                    )}
                    {chat.customerId?.leadStatus && (
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 border border-current/20 ${getStatusBadgeClass(chat.customerId.leadStatus)}`}>
                        {formatStatus(chat.customerId.leadStatus)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })
      )}
    </div>
  );
};

export default ChatList;
