import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import api from '../hooks/api';

const MODE = { REGISTER: 'register', LOGIN: 'login', EXISTING: 'existing' };

const RegisterLead = () => {
  const { login, register } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();

  const [mode, setMode] = useState(MODE.REGISTER);
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [dafaId, setDafaId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [banners, setBanners] = useState([]);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);

  const companyName = branding?.companyName || 'DAFA';
  const primaryColor = branding?.primaryColor || '#B91C1C';
  const cardBg = branding?.authCardBg || '#FFFFFF';
  const cardTextColor = branding?.authCardTextColor || '#0F172A';
  const isDarkCard = cardBg.toLowerCase() !== '#ffffff';
  const btnBg = branding?.authBtnBgColor || primaryColor;
  const btnText = branding?.authBtnTextColor || '#FFFFFF';
  const linkColor = branding?.authLinkColor || primaryColor;

  // Load public banners on mount
  useEffect(() => {
    const loadPublicBanners = async () => {
      try {
        const res = await api.get('/api/banners/public');
        setBanners(res.data.banners || []);
      } catch (err) {
        console.error('Failed to load public banners:', err);
      }
    };
    loadPublicBanners();
  }, []);

  // Banner slideshow auto-play
  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setActiveBannerIndex((prev) => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [banners]);

  const getBackgroundStyle = () => {
    if (branding?.authBgType === 'image' && branding?.authBgImage)
      return { backgroundImage: `url(${branding.authBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' };
    if (branding?.authBgType === 'gradient' && branding?.authBgGradient)
      return { background: branding.authBgGradient };
    return { backgroundColor: branding?.authBgColor || '#F8FAFC' };
  };

  const handleCustomerCareRedirect = () => {
    // If user is already authenticated and has a dafaxbetId (meaning they are a full client), send to dashboard
    const token = localStorage.getItem('accessToken');
    if (token) {
      api.get('/api/auth/me').then(res => {
        const userObj = res.data.user;
        if (userObj?.role === 'customer' && userObj?.dafaxbetId) {
          navigate('/customer');
        } else {
          navigate('/login');
        }
      }).catch(() => {
        navigate('/login');
      });
    } else {
      navigate('/login');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimName = fullName.trim();
    const trimMobile = mobile.trim();

    if (!trimName) {
      setError('Please enter your name.');
      return;
    }
    if (!trimMobile || trimMobile.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.post('/api/auth/lead-register', {
        fullName: trimName,
        mobile: trimMobile
      });
      // Store token and update user state
      const { accessToken, user } = res.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('leadSession', 'true');
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      window.location.href = '/customer'; // Force reload/redirect to dashboard to trigger socket connection properly
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimMobile = mobile.trim();

    if (!trimMobile || trimMobile.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.post('/api/auth/lead-login', {
        mobile: trimMobile
      });
      const { accessToken } = res.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('leadSession', 'true');
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      window.location.href = '/customer'; // Force reload/redirect to dashboard to trigger socket connection properly
    } catch (err) {
      const data = err.response?.data || {};
      if (data.isClient) {
        setError(`${data.error}`);
      } else {
        setError(data.error || 'Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for "I Already Have a Dafa ID" flow
  const handleExistingId = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimDafaId = dafaId.trim();
    const trimMobile = mobile.trim();

    if (!trimDafaId) { setError('Please enter your Dafa ID.'); return; }
    if (!trimMobile || trimMobile.length < 10) { setError('Please enter a valid 10-digit mobile number.'); return; }

    setIsLoading(true);
    try {
      // First register as a lead (name = dafaId for identification)
      const regRes = await api.post('/api/auth/lead-register', {
        fullName: trimDafaId,
        mobile: trimMobile,
      });
      const { accessToken } = regRes.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('leadSession', 'true');
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

      // Then submit the link verification request
      await api.post('/api/leads/request-link', { dafaxbetId: trimDafaId });

      setSuccess('✅ Request submitted! Our agent will verify your Dafa ID and link it shortly. Please wait in the chat...');
      setTimeout(() => {
        window.location.href = '/customer';
      }, 2000);
    } catch (err) {
      // If already registered as lead, try login + submit request
      if (err.response?.status === 409) {
        try {
          const loginRes = await api.post('/api/auth/lead-login', { mobile: trimMobile });
          const { accessToken } = loginRes.data;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('leadSession', 'true');
          api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          await api.post('/api/leads/request-link', { dafaxbetId: trimDafaId });
          setSuccess('✅ Request submitted! Our agent will verify your Dafa ID and link it shortly. Please wait in the chat...');
          setTimeout(() => { window.location.href = '/customer'; }, 2000);
        } catch (e2) {
          setError(e2.response?.data?.error || 'Failed to submit request. Please try again.');
        }
      } else {
        setError(err.response?.data?.error || 'Failed to submit request. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const labelCls = `block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDarkCard ? 'text-slate-300' : 'text-text-1'}`;

  const mobileInputCls = `flex-1 border-[1.5px] rounded-r-xl px-4 py-3 text-base sm:text-sm font-normal min-h-[48px] outline-none transition-all ${
    isDarkCard
      ? 'bg-slate-900/50 border-slate-700/50 text-white placeholder-slate-500 focus:border-primary'
      : 'bg-bg border-border text-text-1 placeholder-text-3 focus:border-primary'
  }`;

  const textInputCls = `w-full border-[1.5px] rounded-xl px-4 py-3 text-base sm:text-sm font-normal min-h-[48px] outline-none transition-all ${
    isDarkCard
      ? 'bg-slate-900/50 border-slate-700/50 text-white placeholder-slate-500 focus:border-primary'
      : 'bg-bg border-border text-text-1 placeholder-text-3 focus:border-primary'
  }`;

  return (
    <div
      className="min-h-screen flex items-center justify-center sm:p-4 transition-all duration-300 relative"
      style={getBackgroundStyle()}
    >
      {/* Top Right Customer Care Button */}
      <div className="absolute top-4 right-4 z-40">
        <button
          onClick={handleCustomerCareRedirect}
          className="flex items-center gap-1.5 px-4 py-2 bg-white/90 hover:bg-white text-slate-800 rounded-full text-xs font-bold shadow-md transition-all hover:scale-105 border border-slate-200"
        >
          <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: primaryColor }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          Customer Care
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full sm:max-w-[420px] min-h-screen sm:min-h-0 flex flex-col justify-center py-6"
      >
        <div
          className="w-full flex-1 sm:flex-initial sm:rounded-2xl backdrop-blur-md transition-all duration-300 flex flex-col overflow-hidden shadow-card sm:shadow-sheet"
          style={{ backgroundColor: cardBg, color: cardTextColor, border: isDarkCard ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)' }}
        >
          {/* ── Banner Area ── */}
          {banners.length > 0 ? (
            <div className="w-full relative overflow-hidden bg-slate-900 border-b border-border/10">
              {banners.map((banner, index) => (
                <div
                  key={banner._id}
                  className={`transition-opacity duration-700 ${
                    index === activeBannerIndex ? 'relative z-10 opacity-100' : 'absolute inset-0 opacity-0 pointer-events-none'
                  }`}
                >
                  <img src={banner.imageUrl} alt={banner.title} className="w-full h-auto block opacity-85" />
                  {banner.title && (
                    <div className="absolute bottom-2 left-3 right-3 text-white drop-shadow-md">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-primary-light" style={{ color: primaryColor }}>
                        {banner.type}
                      </p>
                      <h4 className="text-xs font-bold leading-tight">{banner.title}</h4>
                    </div>
                  )}
                </div>
              ))}
              {/* Carousel Dots */}
              {banners.length > 1 && (
                <div className="absolute bottom-2 right-3 z-30 flex gap-1">
                  {banners.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setActiveBannerIndex(index)}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${
                        index === activeBannerIndex ? 'bg-white scale-125' : 'bg-white/40'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-[180px] bg-gradient-to-r from-red-600 to-red-800 flex flex-col justify-center items-center px-6 text-white text-center" style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)` }}>
              <h2 className="text-xl font-bold">Register for a New ID</h2>
              <p className="text-xs opacity-75 mt-1">Connect directly with a support agent to create your new player account.</p>
            </div>
          )}

          {/* Form Content Area */}
          <div className="p-6 sm:p-8">
            <div className="flex justify-center mb-4">
              {branding?.logo ? (
                <img src={branding.logo} alt="Logo" className="h-12 object-contain" />
              ) : (
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold"
                  style={{ backgroundColor: primaryColor }}
                >
                  {companyName.charAt(0)}
                </div>
              )}
            </div>

            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold tracking-tight mb-1">
                {companyName} ID Support
              </h1>
              <p className={`text-sm ${isDarkCard ? 'text-slate-400' : 'text-text-2'}`}>
                {mode === MODE.REGISTER ? 'Register for a New ID' : 'Login using Mobile Number'}
              </p>
            </div>

            {error && (
              <div className="p-3 mb-4 bg-red-50 border border-red-200 text-danger text-sm rounded-lg">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg font-medium">
                {success}
              </div>
            )}

            <AnimatePresence mode="wait">
              {mode === MODE.REGISTER ? (
                <motion.form
                  key="register"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  onSubmit={handleRegister}
                  className="space-y-4"
                >
                  {/* Name Input */}
                  <div>
                    <label htmlFor="lead-name" className={labelCls}>
                      Your Name
                    </label>
                    <input
                      id="lead-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                      className={textInputCls}
                      required
                    />
                  </div>

                  {/* Mobile Input */}
                  <div>
                    <label htmlFor="lead-mobile" className={labelCls}>
                      Mobile Number
                    </label>
                    <div className="flex">
                      <span
                        className={`inline-flex items-center px-3.5 rounded-l-xl border-[1.5px] border-r-0 text-base sm:text-sm font-semibold select-none ${
                          isDarkCard
                            ? 'bg-slate-900/30 border-slate-700/50 text-slate-400'
                            : 'bg-slate-50 border-border text-text-3'
                        }`}
                      >
                        +91
                      </span>
                      <input
                        id="lead-mobile"
                        type="text"
                        inputMode="numeric"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="98765 43210"
                        maxLength={10}
                        required
                        className={mobileInputCls}
                      />
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full btn-primary min-h-[48px] rounded-xl text-base font-semibold transition-all hover:opacity-95 flex items-center justify-center gap-2 mt-2"
                    style={{ backgroundColor: btnBg, color: btnText }}
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Please wait...
                      </span>
                    ) : (
                      'Register for New ID'
                    )}
                  </button>

                  {/* I Already Have a Dafa ID Button */}
                  <button
                    type="button"
                    onClick={() => { setMode(MODE.EXISTING); setMobile(''); setDafaId(''); setError(''); }}
                    className={`w-full min-h-[44px] rounded-xl text-sm font-semibold border-[1.5px] transition-all hover:opacity-90 flex items-center justify-center gap-2 mt-1 ${
                      isDarkCard ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-border text-text-2 hover:bg-slate-50'
                    }`}
                  >
                    🔑 I Already Have a Dafa ID
                  </button>

                  <div className="text-center pt-2 text-xs">
                    <span className="opacity-70">Already registered? </span>
                    <button
                      type="button"
                      onClick={() => {
                        setMode(MODE.LOGIN);
                        setMobile('');
                        setError('');
                      }}
                      className="font-bold underline hover:opacity-80"
                      style={{ color: linkColor }}
                    >
                      Login here
                    </button>
                  </div>
                </motion.form>
              ) : mode === MODE.LOGIN ? (
                <motion.form
                  key="login"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onSubmit={handleLogin}
                  className="space-y-4"
                >
                  {/* Mobile Input */}
                  <div>
                    <label htmlFor="lead-mobile-login" className={labelCls}>
                      Mobile Number
                    </label>
                    <div className="flex">
                      <span
                        className={`inline-flex items-center px-3.5 rounded-l-xl border-[1.5px] border-r-0 text-base sm:text-sm font-semibold select-none ${
                          isDarkCard
                            ? 'bg-slate-900/30 border-slate-700/50 text-slate-400'
                            : 'bg-slate-50 border-border text-text-3'
                        }`}
                      >
                        +91
                      </span>
                      <input
                        id="lead-mobile-login"
                        type="text"
                        inputMode="numeric"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="98765 43210"
                        maxLength={10}
                        required
                        className={mobileInputCls}
                      />
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full btn-primary min-h-[48px] rounded-xl text-base font-semibold transition-all hover:opacity-95 flex items-center justify-center gap-2 mt-2"
                    style={{ backgroundColor: btnBg, color: btnText }}
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Please wait...
                      </span>
                    ) : (
                      'Login'
                    )}
                  </button>

                  <div className="text-center pt-2 text-xs">
                    <span className="opacity-70">Need a new ID? </span>
                    <button
                      type="button"
                      onClick={() => {
                        setMode(MODE.REGISTER);
                        setMobile('');
                        setFullName('');
                        setError('');
                      }}
                      className="font-bold underline hover:opacity-80"
                      style={{ color: linkColor }}
                    >
                      Register here
                    </button>
                  </div>
                </motion.form>
              ) : (
                <motion.form
                  key="existing"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onSubmit={handleExistingId}
                  className="space-y-4"
                >
                  <div className={`p-3 rounded-xl text-xs border ${
                    isDarkCard ? 'bg-amber-950/20 border-amber-800/40 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}>
                    <span className="font-semibold">🔑 Already have a Dafa ID?</span> Enter your ID and mobile number. Our agent will verify and link your account to Customer Care.
                  </div>

                  {/* Dafa ID Input */}
                  <div>
                    <label htmlFor="existing-dafa-id" className={labelCls}>Your Dafa ID</label>
                    <input
                      id="existing-dafa-id"
                      type="text"
                      value={dafaId}
                      onChange={(e) => setDafaId(e.target.value)}
                      placeholder={`Enter your ${companyName} ID`}
                      className={textInputCls}
                      required
                    />
                  </div>

                  {/* Mobile Input */}
                  <div>
                    <label htmlFor="existing-mobile" className={labelCls}>Mobile Number</label>
                    <div className="flex">
                      <span className={`inline-flex items-center px-3.5 rounded-l-xl border-[1.5px] border-r-0 text-base sm:text-sm font-semibold select-none ${
                        isDarkCard ? 'bg-slate-900/30 border-slate-700/50 text-slate-400' : 'bg-slate-50 border-border text-text-3'
                      }`}>+91</span>
                      <input
                        id="existing-mobile"
                        type="text"
                        inputMode="numeric"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="98765 43210"
                        maxLength={10}
                        required
                        className={mobileInputCls}
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full btn-primary min-h-[48px] rounded-xl text-base font-semibold transition-all hover:opacity-95 flex items-center justify-center gap-2 mt-2"
                    style={{ backgroundColor: btnBg, color: btnText }}
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Submitting...
                      </span>
                    ) : (
                      'Submit Verification Request'
                    )}
                  </button>

                  <div className="text-center pt-2 text-xs">
                    <button
                      type="button"
                      onClick={() => { setMode(MODE.REGISTER); setMobile(''); setDafaId(''); setError(''); }}
                      className="font-bold underline hover:opacity-80"
                      style={{ color: linkColor }}
                    >
                      ← Back to Register
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default RegisterLead;
