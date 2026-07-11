import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';

const VIEW = { NEW_ID: 'new_id', EXISTING_ID: 'existing_id' };

const SmartEntry = ({ defaultView }) => {
  const { customerRegisterLead, customerVerify } = useAuth();
  const { branding, homepage } = useBranding();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Dynamic embed detection
  const isEmbed = searchParams.get('embed') === 'true';

  // Determine initial view based on props, paths, or search parameters
  const [view, setView] = useState(() => {
    if (defaultView === 'new_id') return VIEW.NEW_ID;
    if (defaultView === 'existing_id') return VIEW.EXISTING_ID;
    
    if (location.pathname === '/register') return VIEW.NEW_ID;
    if (location.pathname === '/login') return VIEW.EXISTING_ID;

    const viewParam = searchParams.get('view');
    if (viewParam === 'existing_id') return VIEW.EXISTING_ID;
    return VIEW.NEW_ID; // default fallback
  });

  // Sync state if navigation or props update
  useEffect(() => {
    if (defaultView === 'new_id') {
      setView(VIEW.NEW_ID);
    } else if (defaultView === 'existing_id') {
      setView(VIEW.EXISTING_ID);
    } else if (location.pathname === '/register') {
      setView(VIEW.NEW_ID);
    } else if (location.pathname === '/login') {
      setView(VIEW.EXISTING_ID);
    }
  }, [defaultView, location.pathname]);

  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [dafaId, setDafaId] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const companyName = branding?.companyName || 'DAFA';
  const primaryColor = branding?.primaryColor || '#B91C1C';
  const cardBg = branding?.authCardBg || '#FFFFFF';
  const cardTextColor = branding?.authCardTextColor || '#0F172A';
  const isDarkCard = cardBg.toLowerCase() !== '#ffffff';

  const getBackgroundStyle = () => {
    if (isEmbed) {
      return { backgroundColor: cardBg };
    }
    if (branding?.authBgType === 'image' && branding?.authBgImage) {
      return { backgroundImage: `url(${branding.authBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' };
    }
    if (branding?.authBgType === 'gradient' && branding?.authBgGradient) {
      return { background: branding.authBgGradient };
    }
    return { backgroundColor: branding?.authBgColor || '#F8FAFC' };
  };

  const cardStyle = {
    backgroundColor: cardBg,
    color: cardTextColor,
    border: isDarkCard ? '1px solid rgba(251, 191, 36, 0.12)' : '1px solid rgba(0,0,0,0.06)',
  };

  // Styled input wrapper (behaves like a single premium field)
  const inputWrapperCls = `flex items-center gap-3 border-[1.5px] rounded-xl px-4 py-3 transition-all duration-300 ${
    isDarkCard
      ? 'bg-black/35 border-white/10 text-white focus-within:border-amber-400 focus-within:bg-black/50 focus-within:ring-1 focus-within:ring-amber-400/20'
      : 'bg-slate-50 border-slate-200 text-slate-800 focus-within:border-primary focus-within:bg-white focus-within:ring-1 focus-within:ring-primary/20'
  }`;

  const baseInputCls = `w-full bg-transparent border-none outline-none text-sm font-medium p-0 transition-colors ${
    isDarkCard ? 'text-white placeholder-white/30' : 'text-slate-800 placeholder-slate-400'
  }`;

  const iconCls = `w-5 h-5 shrink-0 transition-colors duration-300 ${
    isDarkCard ? 'text-amber-400/80 group-focus-within:text-amber-400' : 'text-slate-400 group-focus-within:text-primary'
  }`;

  const labelCls = `block text-[11px] font-bold uppercase tracking-wider mb-2 ${
    isDarkCard ? 'text-amber-400/90' : 'text-slate-700'
  }`;

  const handleManualIdCreation = async (e) => {
    e.preventDefault();
    setError('');

    const trimName = fullName.trim();
    const trimMobile = mobile.trim();

    if (!trimName) {
      setError('Please enter your full name.');
      return;
    }
    if (!trimMobile || trimMobile.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsLoading(true);
    try {
      await customerRegisterLead(trimName, trimMobile);
      navigate(isEmbed ? '/customer?embed=true' : '/customer');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoIdRegistration = () => {
    const link = homepage?.autoIdLink && homepage.autoIdLink !== '#' ? homepage.autoIdLink : 'https://dafaxbet.com/register';
    window.open(link, '_blank');
  };

  const handleVerifyDafaId = async (e) => {
    e.preventDefault();
    setError('');

    const trimDafa = dafaId.trim();
    const trimMobile = mobile.trim();
    const trimName = fullName.trim();

    if (!trimDafa) {
      setError(`Please enter your ${companyName} Gaming ID.`);
      return;
    }
    if (!trimMobile || trimMobile.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsLoading(true);
    try {
      await customerVerify(trimName, trimMobile, trimDafa);
      navigate(isEmbed ? '/customer?embed=true' : '/customer');
    } catch (err) {
      setError(err.response?.data?.error || 'Verification request failed. Please check your details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 transition-all duration-300 select-none overflow-y-auto"
      style={getBackgroundStyle()}
    >
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full sm:max-w-[420px] flex flex-col justify-center my-auto"
      >
        <div
          className={
            isEmbed
              ? "w-full p-4 flex flex-col justify-start"
              : "w-full flex-1 sm:flex-initial sm:rounded-3xl p-8 sm:p-9 backdrop-blur-xl transition-all duration-300 flex flex-col justify-center shadow-2xl relative overflow-hidden"
          }
          style={{
            ...cardStyle,
            border: isEmbed ? 'none' : cardStyle.border,
            boxShadow: isEmbed ? 'none' : '0 25px 50px -12px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.05)',
          }}
        >
          {/* Top subtle decorative neon glow lines for Standalone cards */}
          {!isEmbed && isDarkCard && (
            <>
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
              <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-red-500/10 blur-3xl pointer-events-none" />
            </>
          )}

          {/* Logo & Header */}
          <div className="text-center mb-7">
            <div className="flex justify-center mb-4">
              {branding?.logo ? (
                <img src={branding.logo} alt="Logo" className="h-11 object-contain transition-transform hover:scale-105" />
              ) : (
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${primaryColor}, ${branding?.secondaryColor || '#991B1B'})`,
                  }}
                >
                  {companyName.charAt(0)}
                </div>
              )}
            </div>
            <h1 className={`text-xl font-extrabold tracking-tight mb-2 ${isDarkCard ? 'text-white' : 'text-slate-900'}`}>
              {view === VIEW.NEW_ID ? 'Create Gaming ID' : `${companyName} Customer Support`}
            </h1>
            <p className={`text-xs leading-relaxed max-w-[280px] mx-auto ${isDarkCard ? 'text-slate-400/90' : 'text-slate-500'}`}>
              {view === VIEW.NEW_ID
                ? 'Register your mobile number to get a new player ID and play instantly.'
                : 'Enter your gaming account details below to verify and start chat.'}
            </p>
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="p-3.5 mb-5 bg-red-950/20 border border-red-500/30 text-red-200 text-xs rounded-xl font-semibold flex items-center gap-2.5 animate-shake shadow-inner">
                  <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{error}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Core Content Forms */}
          <AnimatePresence mode="wait">
            {view === VIEW.NEW_ID ? (
              <motion.form
                key="new_id"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.25 }}
                onSubmit={handleManualIdCreation}
                className="space-y-5"
              >
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-200 text-[11px] rounded-xl flex items-start gap-2.5 leading-relaxed">
                  <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Deposit, withdrawal, and player dashboard functions will unlock immediately post registration.</span>
                </div>

                <div>
                  <label htmlFor="lead-name" className={labelCls}>Your Full Name</label>
                  <div className={`${inputWrapperCls} group`}>
                    <svg className={iconCls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <input
                      id="lead-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your first and last name"
                      className={baseInputCls}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="lead-mobile" className={labelCls}>Mobile Number</label>
                  <div className={`${inputWrapperCls} group`}>
                    <div className={`flex items-center gap-1.5 pr-2.5 border-r font-bold text-sm select-none shrink-0 ${
                      isDarkCard ? 'border-white/10 text-amber-400' : 'border-slate-200 text-slate-500'
                    }`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span>+91</span>
                    </div>
                    <input
                      id="lead-mobile"
                      type="text"
                      inputMode="numeric"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="98765 43210"
                      maxLength={10}
                      required
                      className={baseInputCls}
                    />
                  </div>
                </div>

                <div className="pt-2 space-y-3.5">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full text-white font-extrabold py-3.5 px-4 rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-xl hover:shadow-red-950/20 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 border-0 cursor-pointer text-xs tracking-wider uppercase shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${primaryColor}, ${branding?.secondaryColor || '#991B1B'})` }}
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Requesting Agent...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span>Chat for Manual ID</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleAutoIdRegistration}
                    className="w-full text-white font-extrabold py-3.5 px-4 rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-xl hover:shadow-slate-900/30 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer text-xs tracking-wider uppercase bg-gradient-to-r from-slate-800 to-slate-950 hover:from-slate-700 hover:to-slate-900 border border-slate-700/60 shadow-lg"
                  >
                    <svg className="w-5 h-5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Auto Site Registration</span>
                  </button>

                  <div className="text-center pt-2">
                    <p className={`text-xs ${isDarkCard ? 'text-slate-400' : 'text-slate-500'}`}>
                      Already registered?{' '}
                      <Link
                        to={`/login${isEmbed ? '?embed=true' : ''}`}
                        className="font-bold underline transition-colors duration-200 hover:brightness-110"
                        style={{ color: isDarkCard ? '#fbbf24' : primaryColor }}
                      >
                        Verify & Chat
                      </Link>
                    </p>
                  </div>
                </div>
              </motion.form>
            ) : (
              <motion.form
                key="existing_id"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.25 }}
                onSubmit={handleVerifyDafaId}
                className="space-y-5"
              >
                <div>
                  <label htmlFor="dafa-id" className={labelCls}>{companyName} Gaming ID</label>
                  <div className={`${inputWrapperCls} group`}>
                    <svg className={iconCls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    <input
                      id="dafa-id"
                      type="text"
                      value={dafaId}
                      onChange={(e) => setDafaId(e.target.value)}
                      placeholder={`Enter your ${companyName} Gaming ID`}
                      className={baseInputCls}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="existing-mobile" className={labelCls}>Registered Mobile Number</label>
                  <div className={`${inputWrapperCls} group`}>
                    <div className={`flex items-center gap-1.5 pr-2.5 border-r font-bold text-sm select-none shrink-0 ${
                      isDarkCard ? 'border-white/10 text-amber-400' : 'border-slate-200 text-slate-500'
                    }`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span>+91</span>
                    </div>
                    <input
                      id="existing-mobile"
                      type="text"
                      inputMode="numeric"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="98765 43210"
                      maxLength={10}
                      required
                      className={baseInputCls}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label htmlFor="verify-name" className={labelCls}>Full Name</label>
                    <span className={`text-[10px] font-semibold italic ${isDarkCard ? 'text-amber-300/40' : 'text-slate-400'}`}>
                      Only required for first verification
                    </span>
                  </div>
                  <div className={`${inputWrapperCls} group`}>
                    <svg className={iconCls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <input
                      id="verify-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter full name if linking first time"
                      className={baseInputCls}
                    />
                  </div>
                </div>

                <div className="pt-2 space-y-3.5">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full text-white font-extrabold py-3.5 px-4 rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-xl hover:shadow-red-950/20 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 border-0 cursor-pointer text-xs tracking-wider uppercase shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${primaryColor}, ${branding?.secondaryColor || '#991B1B'})` }}
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Verifying Account...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <span>Verify & Start Chat</span>
                      </>
                    )}
                  </button>

                  <div className="text-center pt-2">
                    <p className={`text-xs ${isDarkCard ? 'text-slate-400' : 'text-slate-500'}`}>
                      Need a new player account?{' '}
                      <Link
                        to={`/register${isEmbed ? '?embed=true' : ''}`}
                        className="font-bold underline transition-colors duration-200 hover:brightness-110"
                        style={{ color: isDarkCard ? '#fbbf24' : primaryColor }}
                      >
                        Create New ID
                      </Link>
                    </p>
                  </div>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default SmartEntry;
