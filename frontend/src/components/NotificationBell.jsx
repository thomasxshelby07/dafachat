import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import api from '../hooks/api';
import { showBrowserNotification, requestNotificationPermission, playNotificationSound } from '../utils/notifications';
import { useAuth } from '../context/AuthContext';

const NotificationBell = ({ className = 'text-text-2', align = 'right' }) => {
  const { on, off, isConnected } = useSocket();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(localStorage.getItem('muteNotifications') === 'true');
  const dropdownRef = useRef(null);
  const handlersRef = useRef({});

  const isCustomer = user?.role === 'customer';

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const res = await api.get('/api/notifications');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  useEffect(() => {
    handlersRef.current.handleNotification = (data) => {
      setNotifications(prev => {
        const exists = prev.some(n => n._id === data._id);
        if (exists) return prev;
        return [data, ...prev];
      });
      setUnreadCount(prev => prev + 1);
      
      if (localStorage.getItem('muteNotifications') !== 'true') {
        playNotificationSound();
        showBrowserNotification(data.title || 'New Notification', {
          body: data.body || '',
          tag: data._id || `notif-${Date.now()}`,
        });
      }
    };

    handlersRef.current.handleChatRead = () => {
      loadNotifications();
    };

    handlersRef.current.handleMessageRead = () => {
      loadNotifications();
    };

    on('new_notification', handlersRef.current.handleNotification);
    on('chat_read', handlersRef.current.handleChatRead);
    on('message_read', handlersRef.current.handleMessageRead);

    return () => {
      off('new_notification', handlersRef.current.handleNotification);
      off('chat_read', handlersRef.current.handleChatRead);
      off('message_read', handlersRef.current.handleMessageRead);
    };
  }, [on, off]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    localStorage.setItem('muteNotifications', String(nextMuted));
  };

  const handleNotificationClick = async (notif) => {
    try {
      if (!notif.isRead) {
        await api.patch(`/api/notifications/${notif._id}/read`);
        setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, isRead: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      setIsOpen(false);
      if (notif.metadata?.chatId) {
        const event = new CustomEvent('open-chat', { detail: { chatId: notif.metadata.chatId } });
        window.dispatchEvent(event);
      }
    } catch (error) {
      console.error('Failed to read notification:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/api/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const handleClearAll = async () => {
    try {
      await api.delete('/api/notifications/clear');
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  };

  const formatTime = (date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return d.toLocaleDateString();
  };

  const getNotificationIcon = (type) => {
    const icons = {
      new_chat: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
      new_message: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
      lead_assigned: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
      agent_assigned: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    };
    return icons[type] || <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-text-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) loadNotifications(); requestNotificationPermission(); }}
        className={`btn-icon ${className} relative`}
        aria-label="Notifications"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-danger rounded-full flex items-center justify-center animate-pulse">
            <span className="text-[10px] font-semibold text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} top-full mt-2 w-80 bg-surface border border-border rounded-lg shadow-float z-50`}>
          <div className="flex flex-col border-b border-border">
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <h3 className="text-sm font-semibold text-text-1">Notifications</h3>
              <div className="flex gap-2.5">
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className="text-xs text-primary hover:text-primary-hover font-semibold">
                    Mark all read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button onClick={handleClearAll} className="text-xs text-danger hover:text-danger-hover font-semibold">
                    Clear All
                  </button>
                )}
              </div>
            </div>
            {!isCustomer && (
              <div className="px-4 pb-3 flex items-center justify-between border-t border-border/50 pt-2 bg-bg/20">
                <span className="text-xs text-text-2 font-medium">Browser Alerts</span>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!isMuted}
                    onChange={toggleMute}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-border rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4" />
                </label>
              </div>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-text-2">No notifications</div>
            ) : (
              notifications.slice(0, 20).map((notif) => (
                <div
                  key={notif._id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`px-4 py-3 border-b border-border cursor-pointer hover:bg-bg transition-colors ${!notif.isRead ? 'bg-primary/5' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">{getNotificationIcon(notif.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-1">{notif.title}</p>
                      <p className="text-xs text-text-2 mt-0.5 line-clamp-2">{notif.body}</p>
                      <p className="text-[11px] text-text-3 mt-1">{formatTime(notif.createdAt)}</p>
                    </div>
                    {!notif.isRead && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
