import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

const getSocketUrl = () => {
  // In production (Vercel), use the Railway backend HTTPS URL
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  const host = window.location.hostname;
  return `http://${host}:5000`;
};

let globalSocket = null;
let globalListeners = {};
let connectHandler = null;

export const useSocket = () => {
  const { user, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(() => globalSocket?.connected || false);
  const [reconnected, setReconnected] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (globalSocket) {
        globalSocket.removeAllListeners();
        globalSocket.disconnect();
        globalSocket = null;
        globalListeners = {};
      }
      setIsConnected(false);
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    if (globalSocket && globalSocket.connected) {
      setIsConnected(true);
      return;
    }

    if (globalSocket) {
      globalSocket.removeAllListeners();
      globalSocket.disconnect();
      globalSocket = null;
    }

    const socket = io(getSocketUrl(), {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    });

    globalSocket = socket;

    const onConnect = () => {
      setIsConnected(true);
      Object.entries(globalListeners).forEach(([event, cbs]) => {
        cbs.forEach(cb => {
          socket.off(event, cb);
          socket.on(event, cb);
        });
      });
      setReconnected(prev => prev + 1);
    };

    const onDisconnect = (reason) => {
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        const newToken = localStorage.getItem('accessToken');
        if (newToken) {
          socket.auth.token = newToken;
          socket.connect();
        }
      }
    };

    const onConnectError = () => {
      setIsConnected(false);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    // Immediately trigger listener binding if socket is already connected
    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
  }, [isAuthenticated, user]);

  const joinRoom = useCallback((roomId) => {
    if (globalSocket?.connected) {
      globalSocket.emit('join_chat', roomId);
    }
  }, []);

  const leaveRoom = useCallback((roomId) => {
    if (globalSocket?.connected) {
      globalSocket.emit('leave_chat', roomId);
    }
  }, []);

  const sendMessage = useCallback((data) => {
    if (globalSocket?.connected) {
      globalSocket.emit('send_message', data);
    }
  }, []);

  const startChat = useCallback((issueType) => {
    if (globalSocket?.connected) {
      globalSocket.emit('start_chat', { issueType: issueType || 'other' });
    }
  }, []);

  const agentJoinChat = useCallback((chatId) => {
    if (globalSocket?.connected) {
      globalSocket.emit('agent_join_chat', { chatId });
    }
  }, []);

  const closeChat = useCallback((chatId) => {
    if (globalSocket?.connected) {
      globalSocket.emit('close_chat', { chatId });
    }
  }, []);

  const startTyping = useCallback((data) => {
    if (globalSocket?.connected) {
      globalSocket.emit('typing_start', data);
    }
  }, []);

  const stopTyping = useCallback((data) => {
    if (globalSocket?.connected) {
      globalSocket.emit('typing_stop', data);
    }
  }, []);

  const markRead = useCallback((data) => {
    if (globalSocket?.connected) {
      globalSocket.emit('mark_read', data);
    }
  }, []);

  const deleteMessage = useCallback((messageId) => {
    if (globalSocket?.connected) {
      globalSocket.emit('delete_message', { messageId });
    }
  }, []);

  const on = useCallback((event, callback) => {
    if (!globalListeners[event]) globalListeners[event] = new Set();
    if (!globalListeners[event].has(callback)) {
      globalListeners[event].add(callback);
      if (globalSocket?.connected) {
        globalSocket.on(event, callback);
      }
    }
  }, []);

  const off = useCallback((event, callback) => {
    if (globalListeners[event]) {
      globalListeners[event].delete(callback);
    }
    globalSocket?.off(event, callback);
  }, []);

  return {
    socket: globalSocket,
    isConnected,
    reconnected,
    joinRoom,
    leaveRoom,
    sendMessage,
    startChat,
    agentJoinChat,
    closeChat,
    startTyping,
    stopTyping,
    markRead,
    deleteMessage,
    on,
    off,
  };
};
