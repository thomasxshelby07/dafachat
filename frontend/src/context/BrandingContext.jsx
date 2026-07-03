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
    companyName: 'DAFAXBET',
    logo: '',
    favicon: '',
    primaryColor: '#B91C1C',
    secondaryColor: '#991B1B',
    headerBg: '#111827',
    footerText: '© 2026 DAFAXBET. All rights reserved.',
    playNowBgColor: '#B91C1C',
    playNowTextColor: '#FFFFFF',
    authLinkColor: '#B91C1C',
    authBtnBgColor: '#B91C1C',
    authBtnTextColor: '#FFFFFF',
  });

  const [homepage, setHomepage] = useState({
    welcomeText: 'Welcome to DAFAXBET Support',
    supportHeader: 'How can we help you?',
    playNowLabel: 'Play Now',
    playNowUrl: '#',
    autoIdLink: '#',
    siteLoginLink: '#',
    helpText: 'Our support team is available 24/7 to assist you.',
    faqs: [
      { q: 'How do I make a deposit?', a: 'Click the "Play Now" button in the header, go to the deposit section, choose your payment method, and complete the transfer. If it does not reflect, start a "Deposit Issue" support chat.' },
      { q: 'How long does a withdrawal take?', a: 'Withdrawals are processed within 15-30 minutes. If there is a delay, please contact support by opening a "Withdrawal Issue" chat.' },
      { q: 'How do I verify my account?', a: 'Upload a clear copy of your Identity document in your profile settings or share it directly with our support agent in chat.' },
      { q: 'Is my personal data secure?', a: 'Yes, we use global bank-grade encryption to protect all your account data.' },
    ],
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
