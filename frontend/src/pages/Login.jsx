import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import api from '../hooks/api';

const Login = () => {
  const { login } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Forgot password flow states
  const [view, setView] = useState('login'); // 'login' or 'forgot'
  const [forgotStep, setForgotStep] = useState(1); // 1, 2, 3 or 'success'
  const [forgotDafaxbetId, setForgotDafaxbetId] = useState('');
  const [forgotPin, setForgotPin] = useState('');
  const [forgotPassword, setForgotPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setError('');
    setIsLoading(true);

    const formattedMobile = `+91${data.mobile.trim()}`;

    try {
      const user = await login(formattedMobile, data.password);
      const dashboardRoute = {
        customer: '/customer',
        agent: '/agent',
        manager: '/manager',
        super_admin: '/admin',
      };
      navigate(dashboardRoute[user.role] || '/customer');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');
    
    if (forgotStep === 1) {
      if (!forgotDafaxbetId.trim()) {
        setForgotError('Dafaxbet ID is required');
        return;
      }
      setForgotStep(2);
      return;
    }
    
    if (forgotStep === 2) {
      if (forgotPin.length !== 4) {
        setForgotError('Security PIN must be exactly 4 digits');
        return;
      }
      setForgotStep(3);
      return;
    }
    
    if (forgotStep === 3) {
      if (forgotPassword.length < 6) {
        setForgotError('Password must be at least 6 characters');
        return;
      }
      if (forgotPassword !== forgotConfirmPassword) {
        setForgotError('Passwords do not match');
        return;
      }
      
      setForgotLoading(true);
      try {
        await api.post('/api/auth/reset-password', {
          dafaxbetId: forgotDafaxbetId,
          securityPin: forgotPin,
          newPassword: forgotPassword
        });
        setForgotStep('success');
      } catch (err) {
        setForgotError(err.response?.data?.error || 'Incorrect Dafaxbet ID or Security PIN');
        setForgotStep(1); // Return to step 1 on fail to protect account enumeration
      } finally {
        setForgotLoading(false);
      }
    }
  };

  const getBackgroundStyle = () => {
    if (branding.authBgType === 'image' && branding.authBgImage) {
      return {
        backgroundImage: `url(${branding.authBgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }
    if (branding.authBgType === 'gradient' && branding.authBgGradient) {
      return {
        background: branding.authBgGradient,
      };
    }
    return {
      backgroundColor: branding.authBgColor || '#F8FAFC',
    };
  };

  const cardBg = branding.authCardBg || '#FFFFFF';
  const cardTextColor = branding.authCardTextColor || '#0F172A';
  const isDarkCard = cardBg.toLowerCase() !== '#ffffff';

  const cardStyle = {
    backgroundColor: cardBg,
    color: cardTextColor,
    border: isDarkCard ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)',
  };

  return (
    <div className="min-h-screen flex items-center justify-center sm:p-4 transition-all duration-300" style={getBackgroundStyle()}>
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
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              {branding.logo ? (
                <img src={branding.logo} alt="Logo" className="h-12 object-contain" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white text-xl font-bold" style={{ backgroundColor: branding.primaryColor || '#B91C1C' }}>
                  {branding.companyName ? branding.companyName.charAt(0) : 'D'}
                </div>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">
              {branding.companyName || 'DAFAX Bet'} Support
            </h1>
            <p className={`text-sm ${isDarkCard ? 'text-slate-400' : 'text-text-2'}`}>
              {view === 'login' ? 'Sign in to your account' : 'Reset your password'}
            </p>
          </div>

          {view === 'login' ? (
            <>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-4 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-sm text-danger"
                >
                  {error}
                </motion.div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDarkCard ? 'text-slate-300' : 'text-text-1'}`}>
                    Mobile Number
                  </label>
                  <div className="flex relative">
                    <span className={`inline-flex items-center px-3.5 rounded-l-xl border-y border-l text-base sm:text-sm font-semibold border-[1.5px] border-r-0 select-none ${
                      isDarkCard
                        ? 'bg-slate-900/30 border-slate-700/50 text-slate-400'
                        : 'bg-slate-50 border-border text-text-3'
                    }`}>
                      +91
                    </span>
                    <input
                      type="tel"
                      placeholder="98765 43210"
                      maxLength={10}
                      pattern="[0-9]*"
                      inputMode="numeric"
                      className={`w-full border-[1.5px] rounded-r-xl px-4 py-3 text-base sm:text-sm font-normal min-h-[48px] outline-none transition-all ${
                        isDarkCard 
                          ? 'bg-slate-900/50 border-slate-700/50 text-white placeholder-slate-500 focus:border-primary' 
                          : 'bg-bg border-border text-text-1 placeholder-text-3 focus:border-primary'
                      }`}
                      {...register('mobile', {
                        required: 'Mobile number is required',
                        pattern: {
                          value: /^\d{10}$/,
                          message: 'Please enter a valid 10-digit mobile number',
                        },
                      })}
                    />
                  </div>
                  {errors.mobile && (
                    <p className="mt-1 text-xs text-danger">{errors.mobile.message}</p>
                  )}
                </div>

                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDarkCard ? 'text-slate-300' : 'text-text-1'}`}>
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder="Enter your password"
                    className={`w-full border-[1.5px] rounded-xl px-4 py-3 text-base sm:text-sm font-normal min-h-[48px] outline-none transition-all ${
                      isDarkCard 
                        ? 'bg-slate-900/50 border-slate-700/50 text-white placeholder-slate-500 focus:border-primary' 
                        : 'bg-bg border-border text-text-1 placeholder-text-3 focus:border-primary'
                    }`}
                    {...register('password', {
                      required: 'Password is required',
                      minLength: {
                        value: 6,
                        message: 'Password must be at least 6 characters',
                      },
                    })}
                  />
                  {errors.password && (
                    <p className="mt-1 text-xs text-danger">{errors.password.message}</p>
                  )}
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => { setView('forgot'); setForgotStep(1); setForgotError(''); setError(''); }}
                    className="text-xs font-bold hover:opacity-85"
                    style={{ color: branding.authLinkColor || branding.primaryColor || '#B91C1C' }}
                  >
                    Forgot Password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary w-full mt-2 min-h-[48px] rounded-xl text-base"
                  style={{ 
                    backgroundColor: branding.authBtnBgColor || branding.primaryColor || '#B91C1C',
                    color: branding.authBtnTextColor || '#FFFFFF'
                  }}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Signing in...
                    </span>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className={`text-sm ${isDarkCard ? 'text-slate-400' : 'text-text-2'}`}>
                  Don't have an account?{' '}
                  <Link to="/register" className="font-bold hover:opacity-85" style={{ color: branding.authLinkColor || branding.primaryColor || '#B91C1C' }}>
                    Register
                  </Link>
                </p>
              </div>
            </>
          ) : (
            <>
              {forgotError && (
                <div className="mb-4 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-sm text-danger text-center">
                  {forgotError}
                </div>
              )}

              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                {/* Fake inputs to bait aggressive browser autocomplete */}
                <input type="text" style={{ display: 'none' }} autoComplete="username" />
                <input type="password" style={{ display: 'none' }} autoComplete="new-password" />

                {forgotStep === 1 && (
                  <div className="space-y-4">
                    <div>
                      <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDarkCard ? 'text-slate-300' : 'text-text-1'}`}>
                        {branding.companyName || 'DAFAX Bet'} ID
                      </label>
                      <input
                        type="text"
                        placeholder={`Enter your ${branding.companyName || 'DAFAX Bet'} ID`}
                        value={forgotDafaxbetId}
                        onChange={(e) => setForgotDafaxbetId(e.target.value)}
                        className={`w-full border-[1.5px] rounded-xl px-4 py-3 text-base sm:text-sm font-normal min-h-[48px] outline-none transition-all ${
                          isDarkCard 
                            ? 'bg-slate-900/50 border-slate-700/50 text-white placeholder-slate-500 focus:border-primary' 
                            : 'bg-bg border-border text-text-1 placeholder-text-3 focus:border-primary'
                        }`}
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => { setView('login'); setForgotError(''); }}
                        className={`flex-1 border-[1.5px] min-h-[48px] rounded-xl text-sm font-semibold transition-all ${
                          isDarkCard 
                            ? 'border-slate-700 text-slate-300 hover:bg-slate-800' 
                            : 'border-border text-text-2 hover:bg-bg'
                        }`}
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        className="flex-[2] btn-primary min-h-[48px] rounded-xl text-base"
                        style={{ 
                          backgroundColor: branding.authBtnBgColor || branding.primaryColor || '#B91C1C',
                          color: branding.authBtnTextColor || '#FFFFFF'
                        }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

                {forgotStep === 2 && (
                  <div className="space-y-4">
                    <div>
                      <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDarkCard ? 'text-slate-300' : 'text-text-1'}`}>
                        Enter 4-Digit Security PIN
                      </label>
                      <input
                        type="text"
                        maxLength={4}
                        pattern="[0-9]*"
                        inputMode="numeric"
                        placeholder="xxxx"
                        value={forgotPin}
                        onChange={(e) => setForgotPin(e.target.value)}
                        autoComplete="new-password"
                        style={{ WebkitTextSecurity: 'disc', textSecurity: 'disc' }}
                        className={`w-full border-[1.5px] text-center rounded-xl px-4 py-3 text-lg font-bold min-h-[48px] tracking-[0.5em] outline-none transition-all ${
                          isDarkCard 
                            ? 'bg-slate-900/50 border-slate-700/50 text-white placeholder-slate-500 focus:border-primary' 
                            : 'bg-bg border-border text-text-1 placeholder-text-3 focus:border-primary'
                        }`}
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => { setForgotStep(1); setForgotError(''); }}
                        className={`flex-1 border-[1.5px] min-h-[48px] rounded-xl text-sm font-semibold transition-all ${
                          isDarkCard 
                            ? 'border-slate-700 text-slate-300 hover:bg-slate-800' 
                            : 'border-border text-text-2 hover:bg-bg'
                        }`}
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        className="flex-[2] btn-primary min-h-[48px] rounded-xl text-base"
                        style={{ 
                          backgroundColor: branding.authBtnBgColor || branding.primaryColor || '#B91C1C',
                          color: branding.authBtnTextColor || '#FFFFFF'
                        }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

                {forgotStep === 3 && (
                  <div className="space-y-4">
                    <div>
                      <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDarkCard ? 'text-slate-300' : 'text-text-1'}`}>
                        New Password
                      </label>
                      <input
                        type="password"
                        placeholder="Enter new password"
                        value={forgotPassword}
                        onChange={(e) => setForgotPassword(e.target.value)}
                        className={`w-full border-[1.5px] rounded-xl px-4 py-3 text-base sm:text-sm font-normal min-h-[48px] outline-none transition-all ${
                          isDarkCard 
                            ? 'bg-slate-900/50 border-slate-700/50 text-white placeholder-slate-500 focus:border-primary' 
                            : 'bg-bg border-border text-text-1 placeholder-text-3 focus:border-primary'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDarkCard ? 'text-slate-300' : 'text-text-1'}`}>
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        placeholder="Confirm new password"
                        value={forgotConfirmPassword}
                        onChange={(e) => setForgotConfirmPassword(e.target.value)}
                        className={`w-full border-[1.5px] rounded-xl px-4 py-3 text-base sm:text-sm font-normal min-h-[48px] outline-none transition-all ${
                          isDarkCard 
                            ? 'bg-slate-900/50 border-slate-700/50 text-white placeholder-slate-500 focus:border-primary' 
                            : 'bg-bg border-border text-text-1 placeholder-text-3 focus:border-primary'
                        }`}
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => { setForgotStep(2); setForgotError(''); }}
                        className={`flex-1 border-[1.5px] min-h-[48px] rounded-xl text-sm font-semibold transition-all ${
                          isDarkCard 
                            ? 'border-slate-700 text-slate-300 hover:bg-slate-800' 
                            : 'border-border text-text-2 hover:bg-bg'
                        }`}
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={forgotLoading}
                        className="flex-[2] btn-primary min-h-[48px] rounded-xl text-base"
                        style={{ 
                          backgroundColor: branding.authBtnBgColor || branding.primaryColor || '#B91C1C',
                          color: branding.authBtnTextColor || '#FFFFFF'
                        }}
                      >
                        {forgotLoading ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Resetting...
                          </span>
                        ) : (
                          'Reset Password'
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {forgotStep === 'success' && (
                  <div className="space-y-4 text-center">
                    <div className="w-12 h-12 bg-success-light text-success rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-text-1">Success!</h3>
                    <p className={`text-sm ${isDarkCard ? 'text-slate-400' : 'text-text-3'} leading-relaxed`}>
                      Your password has been successfully reset. You can now sign in using your new credentials.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setView('login');
                        setForgotStep(1);
                        setForgotDafaxbetId('');
                        setForgotPin('');
                        setForgotPassword('');
                        setForgotConfirmPassword('');
                        setForgotError('');
                      }}
                      className="btn-primary w-full min-h-[48px] rounded-xl text-base"
                      style={{ 
                        backgroundColor: branding.authBtnBgColor || branding.primaryColor || '#B91C1C',
                        color: branding.authBtnTextColor || '#FFFFFF'
                      }}
                    >
                      Back to Sign In
                    </button>
                  </div>
                )}
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
