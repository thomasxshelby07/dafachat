import { useState, useEffect, useRef } from 'react';
import api from '../hooks/api';

const WidgetDemo = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [branding, setBranding] = useState({
    companyName: 'DAFA Gaming',
    logo: '',
    primaryColor: '#B91C1C',
    headerBg: '#111827',
  });

  const [unreadCount, setUnreadCount] = useState(0);
  const iframeRef = useRef(null);

  useEffect(() => {
    // Load public branding settings to match colors
    api.get('/api/settings/public')
      .then((res) => {
        if (res.data.settings?.branding) {
          setBranding(prev => ({
            ...prev,
            ...res.data.settings.branding
          }));
        }
      })
      .catch((err) => console.error('Failed to load branding:', err));
  }, []);

  useEffect(() => {
    // Listen for unread count updates from iframe customer app
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'UPDATE_UNREAD_COUNT') {
        setUnreadCount(event.data.count || 0);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    // Post widget open/close state to the iframe
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'WIDGET_OPEN_STATE', isOpen }, '*');
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      return;
    }

    const fetchUnreadCount = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setUnreadCount(0);
        return;
      }
      try {
        const res = await api.get('/api/chats/unread-count', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUnreadCount(res.data.unreadCount || 0);
      } catch (err) {
        console.error('Failed to fetch unread count:', err);
        if (err.response?.status === 401) {
          setUnreadCount(0);
        }
      }
    };

    fetchUnreadCount();

    const interval = setInterval(fetchUnreadCount, 5000);
    return () => clearInterval(interval);
  }, [isOpen]);

  return (
    <div className="min-h-screen bg-[#0a0f18] text-[#f1f5f9] font-sans overflow-x-hidden relative selection:bg-[#fbbf24] selection:text-[#0f172a]">
      {/* Mock Header */}
      <header className="border-b border-[#1e293b]/70 sticky top-0 z-30 bg-[#0f172a]/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding.logo ? (
              <img src={branding.logo} alt={branding.companyName} className="h-9 object-contain" />
            ) : (
              <span className="text-lg font-black tracking-wider text-white" style={{ color: branding.primaryColor }}>
                {branding.companyName.toUpperCase()}
              </span>
            )}
            <span className="hidden sm:inline-block px-2.5 py-0.5 text-[10px] font-bold bg-[#10b981]/15 text-[#10b981] rounded-full uppercase border border-[#10b981]/25">
              Online
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-[#94a3b8]">
            <a href="#sports" className="hover:text-white transition-colors">Sportsbook</a>
            <a href="#live" className="hover:text-white transition-colors">Live Dealer</a>
            <a href="#slots" className="text-white border-b-2 border-amber-500 pb-5 pt-5">Casino Slots</a>
            <a href="#promos" className="hover:text-[#fbbf24] transition-colors flex items-center gap-1">
              <span>Promotions</span>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <button className="px-4 py-2 text-xs font-bold rounded-lg border border-[#1e293b] hover:bg-[#1e293b] transition-colors">
              Login
            </button>
            <button 
              className="px-4 py-2 text-xs font-bold rounded-lg text-white shadow-lg active:scale-95 transition-all"
              style={{ backgroundColor: branding.primaryColor }}
            >
              Join Now
            </button>
          </div>
        </div>
      </header>

      {/* Mock Content */}
      <main className="max-w-6xl mx-auto px-4 py-8 pb-24">
        {/* Mock Promo Hero */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-red-950 via-slate-900 to-black border border-red-900/20 p-6 md:p-12 mb-8 shadow-xl">
          <div className="max-w-md relative z-10 space-y-4">
            <span className="inline-block px-2.5 py-1 text-[10px] font-extrabold bg-[#fbbf24]/10 text-[#fbbf24] rounded border border-[#fbbf24]/20 uppercase tracking-widest">
              Exclusive Welcome Offer
            </span>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight text-white">
              Get Up To <span className="text-[#fbbf24]">150% Bonus</span> On Your First Deposit
            </h1>
            <p className="text-xs md:text-sm text-[#94a3b8] leading-relaxed">
              Verify your Dafa Gaming ID or connect with our support agents instantly to lock in your extra joining bonus credits.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button 
                className="px-6 py-3 text-xs font-black uppercase tracking-wider rounded-xl text-white shadow-xl hover:brightness-110 active:scale-95 transition-all"
                style={{ backgroundColor: branding.primaryColor }}
              >
                Claim Now
              </button>
              <button className="px-5 py-3 text-xs font-bold rounded-xl border border-[#1e293b] hover:bg-[#1e293b] transition-colors">
                Terms Apply
              </button>
            </div>
          </div>
          {/* Background decorative graphic */}
          <div className="absolute right-0 bottom-0 top-0 w-1/2 opacity-25 md:opacity-45 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/10 via-red-500/5 to-transparent z-0" />
        </div>

        {/* Mock Games Showcase */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <span className="w-1 h-5 rounded" style={{ backgroundColor: branding.primaryColor }} />
                Popular Slots & Table Games
              </h2>
              <p className="text-xs text-[#94a3b8] mt-0.5">Top-rated matches from our gaming lobby.</p>
            </div>
            <a href="#all" className="text-xs font-bold text-amber-500 hover:underline">View All</a>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { title: 'Super Cricket 777', cat: 'Slots', multiplier: '98.5% RTP', img: '🏏' },
              { title: 'Blackjack Royale', cat: 'Live Dealer', multiplier: '99.2% RTP', img: '🃏' },
              { title: 'Golden Baccarat', cat: 'Table Games', multiplier: '98.9% RTP', img: '🏆' },
              { title: 'Roulette Master', cat: 'Wheel Spin', multiplier: '97.3% RTP', img: '🎡' },
            ].map((game, i) => (
              <div 
                key={i} 
                className="group bg-[#0f172a] border border-[#1e293b]/70 hover:border-amber-500/40 rounded-xl p-4 transition-all duration-300 hover:-translate-y-1 shadow-md hover:shadow-lg relative overflow-hidden"
              >
                <div className="w-12 h-12 rounded-lg bg-[#1e293b] flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                  {game.img}
                </div>
                <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">{game.title}</h3>
                <p className="text-[10px] text-[#94a3b8] mt-0.5">{game.cat}</p>
                <div className="mt-3 flex items-center justify-between border-t border-[#1e293b]/60 pt-3">
                  <span className="text-[9px] font-bold text-[#10b981]">{game.multiplier}</span>
                  <button className="text-[10px] font-black text-amber-500 uppercase tracking-wider group-hover:underline">
                    Play
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Embedded Bot Widget Iframe Modal overlay */}
      <div 
        className={isFullscreen 
          ? "fixed inset-0 z-50 p-0 sm:p-4 bg-black/75 flex flex-col justify-center items-center pointer-events-auto transition-all duration-300"
          : "fixed bottom-0 right-0 sm:bottom-6 sm:right-6 w-full sm:w-[385px] h-[88%] sm:h-[620px] bg-transparent z-50 transition-all duration-300 ease-out p-0 sm:p-2 flex flex-col justify-end pointer-events-auto"
        }
        style={{ display: isOpen ? 'flex' : 'none' }}
      >
        {/* Main Iframe Card container */}
        <div 
          className={isFullscreen
            ? "w-full h-full sm:max-w-5xl sm:max-h-[85vh] bg-[#0f172a] border border-[#1e293b] shadow-2xl flex flex-col overflow-hidden sm:rounded-3xl relative animate-scale-in"
            : "w-full h-full bg-[#0f172a] border border-[#1e293b] shadow-2xl flex flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl relative animate-slide-up"
          }
        >
          {/* Top Widget Close Bar */}
          <div className="h-11 bg-[#111827] px-4 border-b border-[#1e293b] flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Live Support Chat</span>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-all cursor-pointer"
                title={isFullscreen ? "Restore Window" : "Maximize Window"}
              >
                {isFullscreen ? (
                  <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M4 16l4-4m0 0l-4-4m4 4h12" />
                  </svg>
                ) : (
                  <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                )}
              </button>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded hover:bg-slate-800 transition-all cursor-pointer"
                title="Minimize Chat"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Embedded Customer Chat App */}
          <div className="flex-1 w-full relative bg-[#0f172a] overflow-hidden">
            <iframe 
              ref={iframeRef}
              src="/login?embed=true" 
              title="Customer Support Chat"
              className="absolute inset-0 w-full h-full border-none block"
              allow="microphone; camera"
            />
          </div>
        </div>
      </div>

      {/* Floating Chat Bubble Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full shadow-3xl flex items-center justify-center hover:scale-110 active:scale-95 hover:shadow-[0_8px_30px_rgb(0,0,0,0.4)] transition-all duration-300 cursor-pointer focus:outline-none group border-2 border-white/10"
          style={{ 
            background: `linear-gradient(135deg, ${branding.primaryColor || '#B91C1C'}, ${branding.secondaryColor || '#991B1B'})`,
            boxShadow: `0 10px 25px -5px ${branding.primaryColor || '#B91C1C'}50, 0 8px 10px -6px ${branding.primaryColor || '#B91C1C'}50`
          }}
          aria-label="Toggle live support chat"
        >
          <div className="relative flex items-center justify-center w-10 h-10">
            <svg 
              className="w-7 h-7 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)] group-hover:scale-105 transition-transform duration-300" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
              />
            </svg>
            
            {unreadCount > 0 ? (
              <span 
                className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 bg-red-600 border-2 border-white rounded-full flex items-center justify-center shadow-lg animate-bounce scale-110 animate-pulse"
              >
                <span className="text-[9px] font-black text-white tracking-tighter">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              </span>
            ) : (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-md flex-shrink-0 animate-pulse" />
            )}
          </div>
        </button>
      )}
    </div>
  );
};

export default WidgetDemo;
