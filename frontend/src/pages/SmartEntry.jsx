import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';

const VIEW = { SELECT: 'select', EXISTING: 'existing', NEW: 'new' };

const SmartEntry = () => {
  const { smartLogin } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();

  const [view, setView] = useState(VIEW.EXISTING);
  const [dafaId, setDafaId] = useState('');
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState('');
  const [suggestSwitch, setSuggestSwitch] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const companyName = branding?.companyName || 'DAFA';

  const getBackgroundStyle = () => {
    if (branding?.authBgType === 'image' && branding?.authBgImage)
      return { backgroundImage: `url(${branding.authBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' };
    if (branding?.authBgType === 'gradient' && branding?.authBgGradient)
      return { background: branding.authBgGradient };
    return { backgroundColor: branding?.authBgColor || '#F8FAFC' };
  };

  const cardBg        = branding?.authCardBg       || '#FFFFFF';
  const cardTextColor = branding?.authCardTextColor || '#0F172A';
  const isDarkCard    = cardBg.toLowerCase() !== '#ffffff';
  const primaryColor  = branding?.primaryColor      || '#B91C1C';
  const btnBg         = branding?.authBtnBgColor    || primaryColor;
  const btnText       = branding?.authBtnTextColor  || '#FFFFFF';
  const linkColor     = branding?.authLinkColor     || primaryColor;

  const cardStyle = {
    backgroundColor: cardBg,
    color: cardTextColor,
    border: isDarkCard ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
  };

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

  const labelCls = `block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDarkCard ? 'text-slate-300' : 'text-text-1'}`;

  const resetForm = (targetView) => {
    setDafaId('');
    setMobile('');
    setError('');
    setSuggestSwitch(null);
    setView(targetView);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuggestSwitch(null);

    const trimMobile = mobile.trim();
    const trimDafa   = dafaId.trim();

    if (!trimDafa) {
      setError(`Please enter your ${companyName} ID.`);
      return;
    }
    if (!trimMobile || trimMobile.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsLoading(true);
    try {
      await smartLogin(trimMobile, trimDafa, view);
      localStorage.removeItem('leadSession');
      navigate('/customer');
    } catch (err) {
      const data = err.response?.data || {};
      setError(data.error || 'Something went wrong. Please try again.');
      if (data.suggestNew)      setSuggestSwitch('new');
      if (data.suggestExisting) setSuggestSwitch('existing');
    } finally {
      setIsLoading(false);
    }
  };

  const subtitle = {
    [VIEW.SELECT]:   'Customer Support',
    [VIEW.EXISTING]: 'Existing Customer',
    [VIEW.NEW]:      'New Customer',
  }[view];

  return (
    <div
      className="min-h-screen flex items-center justify-center sm:p-4 transition-all duration-300"
      style={getBackgroundStyle()}
    >
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full sm:max-w-[420px] min-h-screen sm:min-h-0 flex flex-col justify-center"
      >
        <div
          className="w-full flex-1 sm:flex-initial sm:rounded-2xl p-6 sm:p-8 backdrop-blur-md transition-all duration-300 flex flex-col justify-center shadow-card sm:shadow-sheet"
          style={cardStyle}
        >
          {/* ── Header ── */}
          <div className="text-center mb-6">
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
            <h1 className="text-2xl font-bold tracking-tight mb-1">
              {companyName} Support
            </h1>
            <p className={`text-sm ${isDarkCard ? 'text-slate-400' : 'text-text-2'}`}>
              {subtitle}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Error box */}
            {error && (
              <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-sm text-danger">
                <p>{error}</p>
              </div>
            )}

            {/* DAFA ID */}
            <div>
              <label htmlFor="input-dafa-id" className={labelCls}>
                {companyName} ID
              </label>
              <input
                id="input-dafa-id"
                type="text"
                value={dafaId}
                onChange={e => setDafaId(e.target.value)}
                placeholder={`Enter your ${companyName} ID`}
                className={textInputCls}
                autoComplete="off"
              />
            </div>

            {/* Mobile Number */}
            <div>
              <label htmlFor="input-mobile" className={labelCls}>
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
                  id="input-mobile"
                  type="text"
                  inputMode="numeric"
                  value={mobile}
                  onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="98765 43210"
                  maxLength={10}
                  autoComplete="off"
                  className={mobileInputCls}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2">
              <button
                type="submit"
                id="btn-continue"
                disabled={isLoading}
                className="w-full btn-primary min-h-[48px] rounded-xl text-base font-semibold border-0 cursor-pointer"
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
            </div>
          </form>

          <div className="text-center pt-5 text-xs">
            <span className="opacity-70">Need a new Dafa ID? </span>
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="font-bold underline hover:opacity-80 border-0 bg-transparent cursor-pointer ml-1 text-xs"
              style={{ color: linkColor }}
            >
              Register here
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SmartEntry;
