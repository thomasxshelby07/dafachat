import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../hooks/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setLoading(false);
        return;
      }

      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const response = await api.get('/api/auth/me');
      setUser(response.data.user);
    } catch (error) {
      localStorage.removeItem('accessToken');
      delete api.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (mobile, password) => {
    const response = await api.post('/api/auth/login', { mobile, password });
    const { user, accessToken } = response.data;
    localStorage.setItem('accessToken', accessToken);
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    setUser(user);
    return user;
  };

  const register = async (fullName, mobile, password, dafaxbetId, securityPin) => {
    const response = await api.post('/api/auth/register', { fullName, mobile, password, dafaxbetId, securityPin });
    const { user, accessToken } = response.data;
    localStorage.setItem('accessToken', accessToken);
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    setUser(user);
    return user;
  };

  const smartLogin = async (mobile, dafaxbetId, flow) => {
    const response = await api.post('/api/auth/smart-login', { mobile, dafaxbetId, flow });
    const { user, accessToken } = response.data;
    localStorage.setItem('accessToken', accessToken);
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    setUser(user);
    return response.data; // includes isNewUser, message
  };

  const adminLogin = async (email, password) => {
    const response = await api.post('/api/auth/admin-login', { email, password });
    const { user, accessToken } = response.data;
    localStorage.setItem('accessToken', accessToken);
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    setUser(user);
    return user;
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      // Ignore error
    } finally {
      localStorage.removeItem('accessToken');
      delete api.defaults.headers.common['Authorization'];
      setUser(null);
    }
  };

  const updateUser = useCallback((updatedUser) => {
    setUser(prev => prev ? { ...prev, ...updatedUser } : updatedUser);
  }, []);

  const value = {
    user,
    loading,
    login,
    adminLogin,
    register,
    smartLogin,
    logout,
    updateUser,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
