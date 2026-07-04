import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';

const VIEW = { WELCOME: 'welcome', NEW_ID: 'new_id', EXISTING_ID: 'existing_id' };

const SmartEntry = () => {
  const { customerRegisterLead, customerVerify } = useAuth();
  const { branding, homepage } = useBranding();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEmbed = true;

  const [view, setView] = useState(() => {
    const viewParam = searchParams.get('view');
    if (viewParam === 'existing_id') return VIEW.EXISTING_ID;
    if (viewParam === 'new_id') return VIEW.NEW_ID;
    return VIEW.WELCOME;
  });
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
  const btnBg = branding?.authBtnBgColor || primaryColor;
  const btnText = branding?.authBtnTextColor || '#FFFFFF';
  const linkColor = branding?.authLinkColor || primaryColor;

  const getBackgroundStyle = () => {
    if (isEmbed) {
      return { backgroundColor: cardBg };
    }
    if (branding?.authBgType === 'image' && branding?.authBgImage)
      return { backgroundImage: `url(${branding.authBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' };
    if (branding?.authBgType === 'gradient' && branding?.authBgGradient)
      return { background: branding.authBgGradient };
    return { backgroundColor: branding?.authBgColor || '#F8FAFC' };
  };

  const cardStyle = {
    backgroundColor: cardBg,
    color: cardTextColor,
    border: isDarkCard ? '1px solid rgba(251, 191, 36, 0.15)' : '1px solid rgba(0,0,0,0.06)',
  };

  const mobileInputCls = `flex-1 border-[1.5px] rounded-r-xl px-3.5 py-2.5 text-sm font-normal min-h-[42px] outline-none transition-all duration-300 ${
    isDarkCard
      ? 'bg-black/25 border-white/10 text-white placeholder-white/30 focus:border-amber-400 focus:bg-black/40 focus:ring-1 focus:ring-amber-400/20'
      : 'bg-slate-50 border-slate-200 text-text-1 placeholder-text-3 focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary/20'
  }`;

  const textInputCls = `w-full border-[1.5px] rounded-xl px-3.5 py-2.5 text-sm font-normal min-h-[42px] outline-none transition-all duration-300 ${
    isDarkCard
      ? 'bg-black/25 border-white/10 text-white placeholder-white/30 focus:border-amber-400 focus:bg-black/40 focus:ring-1 focus:ring-amber-400/20'
      : 'bg-slate-50 border-slate-200 text-text-1 placeholder-text-3 focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary/20'
  }`;

  const labelCls = `block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDarkCard ? 'text-amber-400' : 'text-text-1'}`;

  const cardButtonCls = `w-full flex items-center p-4 rounded-2xl transition-all duration-300 border outline-none text-left cursor-pointer group transform hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] ${
    isDarkCard
      ? 'bg-white/[0.03] border-white/10 hover:bg-white/[0.08] hover:border-amber-400/30 text-slate-100 shadow-sm'
      : 'bg-white border-slate-200/80 hover:bg-slate-50 hover:border-primary/30 text-slate-700 shadow-sm'
  }`;

  const iconCls = `w-5 h-5 transition-colors ${
    isDarkCard ? 'text-amber-400 group-hover:text-amber-300' : 'text-slate-500 group-hover:text-primary'
  }`;

  const resetForm = (targetView) => {
    setFullName('');
    setMobile('');
    setDafaId('');
    setError('');
    setView(targetView);
  };

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
      className="min-h-screen w-full flex items-center justify-center p-3 transition-all duration-300 select-none"
      style={getBackgroundStyle()}
    >
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full sm:max-w-[420px] flex flex-col justify-center"
      >
        <div
          className={isEmbed ? "w-full p-4 flex flex-col justify-start" : "w-full flex-1 sm:flex-initial sm:rounded-2xl p-6 sm:p-8 backdrop-blur-md transition-all duration-300 flex flex-col justify-center shadow-card sm:shadow-sheet"}
          style={{
            ...cardStyle,
            border: isEmbed ? 'none' : cardStyle.border,
            boxShadow: isEmbed ? 'none' : undefined,
          }}
        >
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              {branding?.logo ? (
                <img src={branding.logo} alt="Logo" className="h-10 object-contain" />
              ) : (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xl font-bold"
                  style={{ backgroundColor: primaryColor }}
                >
                  {companyName.charAt(0)}
                </div>
              )}
            </div>
            <h1 className="text-xl font-bold tracking-tight mb-1 text-white">
              {companyName} Customer Support
            </h1>
            <p className={`text-xs ${isDarkCard ? 'text-amber-200/70' : 'text-text-2'}`}>
              Select an option to connect to our support team
            </p>
          </div>

          {error && (
            <div className="p-3 mb-4 bg-red-50/10 border border-red-200/30 text-red-200 text-xs rounded-xl font-medium animate-shake">
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {view === VIEW.WELCOME && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="space-y-3.5"
              >
                <button onClick={() => resetForm(VIEW.NEW_ID)} className={cardButtonCls}>
                  <div 
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: isDarkCard ? `${primaryColor}20` : `${primaryColor}10` }}
                  >
                    <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0 ml-3">
                    <span className={`text-sm font-bold block ${isDarkCard ? 'text-white' : 'text-slate-800'}`}>New ID</span>
                    <span className={`text-[10px] mt-0.5 block leading-normal ${isDarkCard ? 'text-slate-300/70' : 'text-text-3'}`}>
                      Create a new player account on Dafa Gaming
                    </span>
                  </div>
                  <div className="flex-shrink-0 text-slate-400 group-hover:text-amber-400 transition-colors pl-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                <button onClick={() => resetForm(VIEW.EXISTING_ID)} className={cardButtonCls}>
                  <div 
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: isDarkCard ? `${primaryColor}20` : `${primaryColor}10` }}
                  >
                    <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0 ml-3">
                    <span className={`text-sm font-bold block ${isDarkCard ? 'text-white' : 'text-slate-800'}`}>Already Have a Dafa Gaming ID</span>
                    <span className={`text-[10px] mt-0.5 block leading-normal ${isDarkCard ? 'text-slate-300/70' : 'text-text-3'}`}>
                      Verify and log in to connect to support teams
                    </span>
                  </div>
                  <div className="flex-shrink-0 text-slate-400 group-hover:text-amber-400 transition-colors pl-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </motion.div>
            )}

            {view === VIEW.NEW_ID && (
              <motion.form
                key="new_id"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleManualIdCreation}
                className="space-y-3.5"
              >
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs rounded-xl flex items-start gap-2 leading-relaxed">
                  <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Deposit, withdrawal, and other support services are only available after verification.</span>
                </div>

                <div>
                  <label htmlFor="lead-name" className={labelCls}>Your Full Name</label>
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

                <div>
                  <label htmlFor="lead-mobile" className={labelCls}>Mobile Number</label>
                  <div className="flex">
                    <span className={`inline-flex items-center px-3.5 rounded-l-xl border-[1.5px] border-r-0 text-sm font-semibold select-none ${
                      isDarkCard ? 'bg-black/45 border-white/10 text-amber-400' : 'bg-slate-100 border-slate-200 text-text-3'
                    }`}>+91</span>
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

                <div className="pt-1.5 space-y-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full text-white font-extrabold py-3 px-4 rounded-full transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 border-0 cursor-pointer text-xs tracking-wider uppercase shadow-md"
                    style={{ background: `linear-gradient(135deg, ${primaryColor}, ${branding?.secondaryColor || '#991B1B'})` }}
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span>Chat for Manual ID</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleAutoIdRegistration}
                    className="w-full text-white font-extrabold py-3 px-4 rounded-full transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer text-xs tracking-wider uppercase bg-gradient-to-r from-[#1e293b] to-[#0f172a] hover:from-[#334155] hover:to-[#1e293b] border border-slate-700/60 shadow-md"
                  >
                    <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Auto Site Registration</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => resetForm(VIEW.WELCOME)}
                    className="w-full min-h-[36px] text-[11px] font-bold hover:underline bg-transparent border-0 cursor-pointer text-center text-amber-400"
                  >
                    Back to Welcome
                  </button>
                </div>
              </motion.form>
            )}

            {view === VIEW.EXISTING_ID && (
              <motion.form
                key="existing_id"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleVerifyDafaId}
                className="space-y-3.5"
              >
                <div>
                  <label htmlFor="dafa-id" className={labelCls}>{companyName} Gaming ID</label>
                  <input
                    id="dafa-id"
                    type="text"
                    value={dafaId}
                    onChange={(e) => setDafaId(e.target.value)}
                    placeholder={`Enter your ${companyName} ID`}
                    className={textInputCls}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="existing-mobile" className={labelCls}>Registered Mobile Number</label>
                  <div className="flex">
                    <span className={`inline-flex items-center px-3.5 rounded-l-xl border-[1.5px] border-r-0 text-sm font-semibold select-none ${
                      isDarkCard ? 'bg-black/45 border-white/10 text-amber-400' : 'bg-slate-100 border-slate-200 text-text-3'
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

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label htmlFor="verify-name" className={labelCls}>Full Name</label>
                    <span className="text-[10px] text-amber-200/50 font-medium lowercase italic">Only for first-time verification</span>
                  </div>
                  <input
                    id="verify-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter full name if new customer"
                    className={textInputCls}
                  />
                </div>

                <div className="pt-1.5 space-y-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full text-white font-extrabold py-3 px-4 rounded-full transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 border-0 cursor-pointer text-xs tracking-wider uppercase shadow-md"
                    style={{ background: `linear-gradient(135deg, ${primaryColor}, ${branding?.secondaryColor || '#991B1B'})` }}
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <span>Verify & Login</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => resetForm(VIEW.WELCOME)}
                    className="w-full min-h-[36px] text-[11px] font-bold hover:underline bg-transparent border-0 cursor-pointer text-center text-amber-400"
                  >
                    Back to Welcome
                  </button>
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
