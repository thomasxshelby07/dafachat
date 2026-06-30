import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const BrandingContext = createContext(null);

const getApiUrl = () => {
  // In production (Vercel), VITE_API_URL is set to Railway backend URL
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  const host = window.location.hostname;
  return `http://${host}:5000`;
};

export const BrandingProvider = ({ children }) => {
  const [branding, setBranding] = useState({
    companyName: 'DAFAX Bet',
    logo: '',
    favicon: '',
    primaryColor: '#B91C1C',
    secondaryColor: '#991B1B',
    headerBg: '#111827',
    footerText: '© 2026 DAFAX Bet. All rights reserved.',
    playNowBgColor: '#B91C1C',
    playNowTextColor: '#FFFFFF',
    authLinkColor: '#B91C1C',
    authBtnBgColor: '#B91C1C',
    authBtnTextColor: '#FFFFFF',
  });

  const [homepage, setHomepage] = useState({
    welcomeText: 'Welcome to DAFAX Support',
    supportHeader: 'How can we help you?',
    playNowLabel: 'Play Now',
    playNowUrl: '#',
    helpText: 'Our support team is available 24/7 to assist you.',
  });

  const [loading, setLoading] = useState(true);

  const fetchBranding = async () => {
    try {
      const res = await axios.get(`${getApiUrl()}/api/settings/public`);
      const { settings } = res.data;
      if (settings) {
        if (settings.branding) {
          setBranding(prev => ({ ...prev, ...settings.branding }));
          applyBrandingStyles(settings.branding);
        }
        if (settings.homepage) {
          setHomepage(prev => ({ ...prev, ...settings.homepage }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch public settings:', error);
      // Apply default styling on failure
      applyBrandingStyles(branding);
    } finally {
      setLoading(false);
    }
  };

  const applyBrandingStyles = (brand) => {
    // Update document title if needed
    if (brand.companyName) {
      document.title = `${brand.companyName} Support`;
    }
    
    // Update favicon if set
    if (brand.favicon) {
      const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = brand.favicon;
      document.getElementsByTagName('head')[0].appendChild(link);
    }
  };

  useEffect(() => {
    fetchBranding();

    const socket = io(getApiUrl(), {
      transports: ['polling', 'websocket'],
    });

    socket.on('settings_updated', () => {
      fetchBranding();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <BrandingContext.Provider value={{ branding, homepage, loading, refreshBranding: fetchBranding }}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
};
