import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import api from '../../hooks/api';
import ChatHeader from './ChatHeader';
import ChatBubble from './ChatBubble';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';
import DateSeparator from './DateSeparator';

const ChatScreen = ({ chatId, onBack, onMenuClick, onChatWithSupportClick }) => {
  const { user } = useAuth();
  const { joinRoom, leaveRoom, sendMessage, startTyping, stopTyping, markRead, deleteMessage, on, off } = useSocket();
  const [messages, setMessages] = useState([]);
  const [chat, setChat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [typingUser, setTypingUser] = useState(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [zoomedImage, setZoomedImage] = useState(null);
  const [showNotesSidebar, setShowNotesSidebar] = useState(false);
  const prevMessagesLengthRef = useRef(0);
  const lastMessageIdRef = useRef(null);
  const [onlineAgents, setOnlineAgents] = useState([]);
  const [loadingOnlineAgents, setLoadingOnlineAgents] = useState(false);

  useEffect(() => {
    if (user?.role === 'customer' && chat?.agentId && (chat.agentId.status === 'offline' || chat.agentId.status === 'break')) {
      const fetchOnlineAgents = async () => {
        setLoadingOnlineAgents(true);
        try {
          const res = await api.get('/api/users/agents/online');
          setOnlineAgents(res.data.agents || []);
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingOnlineAgents(false);
        }
      };
      fetchOnlineAgents();
    }
  }, [chat?.agentId?.status, user?.role, chatId]);

  useEffect(() => {
    if (!chatId) return;

    const loadChat = async () => {
      try {
        const [chatRes, messagesRes] = await Promise.all([
          api.get(`/api/chats/${chatId}`),
          api.get(`/api/chats/${chatId}/messages?limit=50`),
        ]);

        setChat(chatRes.data.chat);
        setMessages(messagesRes.data.messages);
        setHasMore(messagesRes.data.hasMore);

        // Mark all unread messages as read
        const unreadIds = messagesRes.data.messages
          .filter(m => m.senderId?.toString() !== user?._id?.toString() && m.status !== 'read')
          .map(m => m._id);
        if (unreadIds.length > 0) {
          markRead({ chatId, messageIds: unreadIds });
        }
      } catch (error) {
        console.error('Failed to load chat:', error);
      } finally {
        setLoading(false);
      }
    };

    loadChat();
    joinRoom(chatId);

    return () => {
      leaveRoom(chatId);
    };
  }, [chatId, joinRoom, leaveRoom]);

  useEffect(() => {
    if (!chatId) return;

    const handleNewMessage = (message) => {
      if (message.isInternal && user?.role === 'customer') return;
      if (message.chatId === chatId) {
        setMessages(prev => {
          const filtered = prev.filter(m => {
            if (m.status === 'sending') {
              if (message.type === 'text' && m.type === 'text' && m.content === message.content) {
                return false;
              }
              if (message.type !== 'text' && m.type === message.type) {
                return false;
              }
            }
            return m._id !== message._id;
          });
          return [...filtered, message];
        });

        if (message.senderId?.toString() !== user?._id?.toString()) {
          markRead({ chatId, messageIds: [message._id] });
        }
      }
    };

    const handleUserTyping = (data) => {
      if (data.chatId === chatId && data.userId !== user?._id) {
        setTypingUser(data.fullName);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          setTypingUser(null);
        }, 3000);
      }
    };

    const handleUserTypingStopped = (data) => {
      if (data.chatId === chatId && data.userId !== user?._id) {
        setTypingUser(null);
      }
    };

    const handleMessageDelivered = (data) => {
      if (data.chatId === chatId && data.message) {
        setMessages(prev => {
          const filtered = prev.filter(m => {
            if (m.status === 'sending') {
              if (data.message.type === 'text' && m.type === 'text' && m.content === data.message.content) {
                return false;
              }
              if (data.message.type !== 'text' && m.type === data.message.type) {
                return false;
              }
            }
            return m._id !== data.message._id;
          });
          return [...filtered, {
            ...data.message,
            status: data.message.status || 'delivered',
            deliveredAt: data.message.deliveredAt || new Date()
          }];
        });
      }
    };

    const handleMessageRead = (data) => {
      if (data.chatId === chatId) {
        setMessages(prev =>
          prev.map(m =>
            data.messageIds.includes(m._id)
              ? { ...m, status: 'read', readAt: data.readAt || new Date() }
              : m
          )
        );
      }
    };

    const handleMessageStatusChanged = (data) => {
      if (data.chatId === chatId) {
        setMessages(prev =>
          prev.map(m =>
            data.messageIds.includes(m._id)
              ? { ...m, status: data.status, [data.status === 'read' ? 'readAt' : 'deliveredAt']: new Date() }
              : m
          )
        );
      }
    };

    const handleMessageDeleted = (data) => {
      if (data.chatId === chatId) {
        setMessages(prev => prev.filter(m => m._id !== data.messageId));
      }
    };

    const handleAgentAssignedSocket = (data) => {
      if (data.chatId === chatId) {
        api.get(`/api/chats/${chatId}`).then(res => {
          setChat(res.data.chat);
        }).catch(() => {});
      }
    };

    on('new_message', handleNewMessage);
    on('message_delivered', handleMessageDelivered);
    on('user_typing', handleUserTyping);
    on('user_typing_stopped', handleUserTypingStopped);
    on('message_read', handleMessageRead);
    on('message_status_changed', handleMessageStatusChanged);
    on('message_deleted', handleMessageDeleted);
    on('agent_assigned', handleAgentAssignedSocket);
    on('agent_on_break', handleAgentAssignedSocket);

    return () => {
      off('new_message', handleNewMessage);
      off('message_delivered', handleMessageDelivered);
      off('user_typing', handleUserTyping);
      off('user_typing_stopped', handleUserTypingStopped);
      off('message_read', handleMessageRead);
      off('message_status_changed', handleMessageStatusChanged);
      off('message_deleted', handleMessageDeleted);
      off('agent_assigned', handleAgentAssignedSocket);
      off('agent_on_break', handleAgentAssignedSocket);
    };
  }, [chatId, user, on, off, markRead]);

  useEffect(() => {
    if (loading) return;

    const currentLength = messages.length;
    const prevLength = prevMessagesLengthRef.current;
    
    // If it's the initial load, scroll instantly to bottom
    if (prevLength === 0 && currentLength > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    } else if (currentLength > prevLength) {
      // Check if new messages were appended (not prepended during load older)
      const lastMsg = messages[currentLength - 1];
      const isAppended = lastMsg?._id !== lastMessageIdRef.current;
      
      if (isAppended) {
        const isOwnMessage = lastMsg.senderId?.toString() === user?._id?.toString();
        const container = messagesContainerRef.current;
        const isNearBottom = container ? (container.scrollHeight - container.clientHeight - container.scrollTop < 250) : false;
        
        if (isOwnMessage || isNearBottom) {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
    
    prevMessagesLengthRef.current = currentLength;
    if (currentLength > 0) {
      lastMessageIdRef.current = messages[currentLength - 1]?._id;
    }
  }, [messages, loading, user?._id]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;

    setLoadingMore(true);
    try {
      const oldestMessage = messages[0];
      const res = await api.get(
        `/api/chats/${chatId}/messages?before=${oldestMessage.createdAt}&limit=50`
      );

      setMessages(prev => [...res.data.messages, ...prev]);
      setHasMore(res.data.hasMore);
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [chatId, messages, loadingMore, hasMore]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (container.scrollTop === 0 && hasMore && !loadingMore) {
        handleLoadMore();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleLoadMore, hasMore, loadingMore]);

  const handleSend = ({ content, type = 'text', mediaUrl, mediaPublicId, isInternal, file }) => {
    if (file) {
      const tempId = `temp-${Date.now()}`;
      const isImg = file.type.startsWith('image/');
      const isAud = file.type.startsWith('audio/');
      
      const tempMsg = {
        _id: tempId,
        chatId,
        senderId: user._id,
        senderRole: user.role,
        senderName: user.fullName,
        content: content || (isImg ? 'Sending image...' : isAud ? 'Sending voice note...' : 'Sending file...'),
        type: isImg ? 'image' : isAud ? 'audio' : 'file',
        mediaUrl: URL.createObjectURL(file),
        status: 'sending',
        createdAt: new Date().toISOString(),
      };
      
      setMessages(prev => [...prev, tempMsg]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

      const formData = new FormData();
      formData.append('file', file);

      api.post('/api/messages/media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(res => {
        setMessages(prev => prev.filter(m => m._id !== tempId));
        sendMessage({
          chatId,
          content,
          type: res.data.type || type,
          mediaUrl: res.data.mediaUrl,
          mediaPublicId: res.data.mediaPublicId,
          isInternal: false,
        });
      }).catch(err => {
        console.error('Media upload failed:', err);
        setMessages(prev => prev.map(m => m._id === tempId ? { ...m, status: 'error', content: 'Upload failed' } : m));
      });
    } else {
      const tempId = `temp-${Date.now()}`;
      const tempMsg = {
        _id: tempId,
        chatId,
        senderId: user._id,
        senderRole: user.role,
        senderName: user.fullName,
        content,
        type: type || 'text',
        mediaUrl: mediaUrl || '',
        mediaPublicId: mediaPublicId || '',
        status: 'sending',
        isInternal: isInternal || false,
        createdAt: new Date().toISOString(),
      };
      
      setMessages(prev => [...prev, tempMsg]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

      sendMessage({
        chatId,
        content,
        type,
        mediaUrl,
        mediaPublicId,
        isInternal,
      });
    }
  };

  const handleTypingStart = () => {
    startTyping({ chatId });
  };

  const handleTypingStop = () => {
    stopTyping({ chatId });
  };

  const handleDeleteMessage = (messageId) => {
    if (window.confirm('Delete this message?')) {
      deleteMessage(messageId);
    }
  };

  const shouldShowDateSeparator = (msg, prevMsg) => {
    if (!prevMsg) return true;
    const msgDate = new Date(msg.createdAt).toDateString();
    const prevDate = new Date(prevMsg.createdAt).toDateString();
    return msgDate !== prevDate;
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-bg">
        <div className="bg-surface border-b border-border h-11" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
        <div className="bg-surface border-t border-border h-14" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-bg overflow-hidden relative">
      {/* Left / Main Chat Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <ChatHeader
          chat={chat}
          user={user}
          onBack={onBack}
          onMenuClick={onMenuClick}
          onToggleNotes={() => setShowNotesSidebar(!showNotesSidebar)}
          showNotesActive={showNotesSidebar}
        />

        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto overscroll-contain min-h-0"
        >
          {loadingMore && (
            <div className="flex justify-center py-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
            </div>
          )}

          {hasMore && messages.length > 0 && (
            <button
              onClick={handleLoadMore}
              className="w-full py-2 text-xs text-text-3 hover:text-text-2"
            >
              Load older messages
            </button>
          )}

          {messages.map((msg, idx) => (
            <div key={msg._id}>
              {shouldShowDateSeparator(msg, messages[idx - 1]) && (
                <DateSeparator date={msg.createdAt} />
              )}
              <ChatBubble
                message={msg}
                isOwn={user?.role !== 'customer' ? msg.senderRole !== 'customer' : msg.senderId?.toString() === user?._id?.toString()}
                viewerRole={user?.role}
                onDelete={user?.role !== 'customer' ? handleDeleteMessage : null}
                onImageClick={setZoomedImage}
                onChatWithSupportClick={onChatWithSupportClick}
              />
            </div>
          ))}

          <TypingIndicator typingUser={typingUser} />
          <div ref={messagesEndRef} />
        </div>

        {user?.role === 'customer' && chat?.agentId && (chat.agentId.status === 'offline' || chat.agentId.status === 'break') ? (
          <div className="bg-surface border-t border-border p-4 space-y-3">
            <div className="bg-warning/10 border border-warning/30 text-warning px-3.5 py-3 rounded-lg text-xs flex gap-2.5 items-start">
              <svg className="w-5 h-5 text-warning shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="space-y-1">
                <p className="font-semibold text-text-1">This agent is offline/on break right now. You can connect with other active agents below:</p>
                <p className="font-semibold font-hindi text-text-1">यह एजेंट अभी ऑफलाइन/ब्रेक पर है। आप नीचे दिए गए सक्रिय (ऑनलाइन) एजेंटों से जुड़ सकते हैं:</p>
              </div>
            </div>
            
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {loadingOnlineAgents ? (
                <div className="text-center text-xs text-text-3 py-4">Checking online agents...</div>
              ) : onlineAgents.length === 0 ? (
                <div className="text-center text-xs text-text-3 py-4 italic">No other agents are online right now. DAFA SUPPORT will assist you shortly.</div>
              ) : (
                onlineAgents.map(ag => (
                  <div key={ag._id} className="flex items-center justify-between p-2.5 bg-bg/50 border border-border rounded-lg hover:bg-bg/85 transition-all">
                    <div className="flex items-center gap-3">
                      {ag.avatar ? (
                        <img src={ag.avatar} alt="" className="w-9 h-9 rounded-full object-cover border border-success/30" />
                      ) : (
                        <div className="w-9 h-9 bg-primary text-white text-xs font-bold rounded-full flex items-center justify-center">
                          {ag.fullName?.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-bold text-text-1">{ag.fullName}</div>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {(ag.permissions?.issueTypes && ag.permissions.issueTypes.length > 0 ? ag.permissions.issueTypes : ['deposit', 'withdrawal', 'other']).map(tag => (
                            <span key={tag} className="px-1.5 py-0.2 bg-primary/10 text-primary text-[8px] font-bold uppercase rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={async () => {
                        try {
                          await api.post(`/api/chats/${chatId}/transfer-self`, { agentId: ag._id });
                          const chatRes = await api.get(`/api/chats/${chatId}`);
                          setChat(chatRes.data.chat);
                        } catch (e) {
                          alert('Failed to connect to agent');
                        }
                      }}
                      className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-md hover:bg-primary-dark transition-all"
                    >
                      Connect / मुझे इससे बात करनी है
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <ChatInput
            onSend={handleSend}
            onTypingStart={handleTypingStart}
            onTypingStop={handleTypingStop}
            isAgent={user?.role !== 'customer'}
            showQuickReplies={user?.role !== 'customer'}
          />
        )}
      </div>

      {/* Right Sticky Internal Notes Sidebar */}
      {showNotesSidebar && user?.role !== 'customer' && (
        <div className="fixed inset-y-0 right-0 z-30 w-72 md:relative md:w-80 border-l border-border bg-surface flex flex-col h-full flex-shrink-0 animate-slideIn">
          <div className="p-3 border-b border-border flex items-center justify-between bg-bg/10">
            <div className="flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <h3 className="text-sm font-bold text-text-1">Internal Notes</h3>
            </div>
            <button onClick={() => setShowNotesSidebar(false)} className="text-text-3 hover:text-text-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.filter(m => m.isInternal && !m.isDeleted).length === 0 ? (
              <div className="text-center py-10 text-xs text-text-3 italic">
                No internal notes in this chat yet.
              </div>
            ) : (
              messages.filter(m => m.isInternal && !m.isDeleted).map(note => (
                <div key={note._id} className="p-3 bg-note border border-note-border rounded-lg text-left relative group">
                  <p className="text-xs text-text-1 whitespace-pre-wrap break-words pr-5">{note.content}</p>
                  <p className="text-[10px] text-text-3 mt-1.5 flex items-center justify-between">
                    <span>by {note.senderName || 'Staff'}</span>
                    <span>{new Date(note.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                  </p>
                  {user?.role !== 'customer' && (
                    <button
                      onClick={() => handleDeleteMessage(note._id)}
                      className="absolute top-2 right-2 text-text-3 hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete Note"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="p-3 border-t border-border bg-bg/15">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const noteVal = e.target.noteText.value.trim();
                if (!noteVal) return;
                handleSend({ content: noteVal, isInternal: true });
                e.target.reset();
              }}
              className="flex gap-2"
            >
              <input
                name="noteText"
                placeholder="Quick add note..."
                className="input-field py-1.5 text-xs flex-1"
                autoComplete="off"
              />
              <button type="submit" className="px-3 bg-warning text-white text-xs font-semibold hover:bg-warning-hover transition-colors rounded">
                Add
              </button>
            </form>
          </div>
        </div>
      )}

      {zoomedImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 cursor-zoom-out select-none animate-fadeIn"
          onClick={() => setZoomedImage(null)}
        >
          <button
            onClick={() => setZoomedImage(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded hover:bg-white/10 transition-colors"
            aria-label="Close image"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={zoomedImage}
            alt="Zoomed View"
            className="max-w-full max-h-full object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};

export default ChatScreen;
