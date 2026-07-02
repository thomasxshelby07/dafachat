import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import api from '../hooks/api';

const Register = () => {
  const { register: registerUser } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);

  const { register, handleSubmit, trigger, watch, formState: { errors } } = useForm();
  const securityPin = watch('securityPin');

  const onSubmit = async (data) => {
    setError('');
    setIsLoading(true);

    const formattedMobile = `+91${data.mobile.trim()}`;

    try {
      await registerUser(data.fullName, formattedMobile, data.password, data.dafaxbetId, data.securityPin);
      navigate('/customer');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextStep = async () => {
    setError('');
    const isValid = await trigger(['fullName', 'mobile', 'dafaxbetId', 'password']);
    if (!isValid) return;

    setIsLoading(true);
    try {
      const mobileVal = watch('mobile');
      const dafaVal = watch('dafaxbetId');

      await api.post('/api/auth/check-availability', {
        mobile: mobileVal,
        dafaxbetId: dafaVal
      });

      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Validation failed');
    } finally {
      setIsLoading(false);
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
            <p className={`text-sm ${isDarkCard ? 'text-slate-400' : 'text-text-2'}`}>Create your account</p>
          </div>

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
            {/* Fake inputs to bait aggressive browser autocomplete */}
            <input type="text" style={{ display: 'none' }} autoComplete="username" />
            <input type="password" style={{ display: 'none' }} autoComplete="new-password" />

            {step === 1 ? (
              <div className="space-y-4">
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDarkCard ? 'text-slate-300' : 'text-text-1'}`}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    className={`w-full border-[1.5px] rounded-xl px-4 py-3 text-base sm:text-sm font-normal min-h-[48px] outline-none transition-all ${
                      isDarkCard 
                        ? 'bg-slate-900/50 border-slate-700/50 text-white placeholder-slate-500 focus:border-primary' 
                        : 'bg-bg border-border text-text-1 placeholder-text-3 focus:border-primary'
                    }`}
                    {...register('fullName', {
                      required: 'Full name is required',
                      minLength: {
                        value: 2,
                        message: 'Name must be at least 2 characters',
                      },
                    })}
                  />
                  {errors.fullName && (
                    <p className="mt-1 text-xs text-danger">{errors.fullName.message}</p>
                  )}
                </div>

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
                    {branding.companyName || 'DAFAX Bet'} ID
                  </label>
                  <input
                    type="text"
                    placeholder={`Enter your ${branding.companyName || 'DAFAX Bet'} ID`}
                    className={`w-full border-[1.5px] rounded-xl px-4 py-3 text-base sm:text-sm font-normal min-h-[48px] outline-none transition-all ${
                      isDarkCard 
                        ? 'bg-slate-900/50 border-slate-700/50 text-white placeholder-slate-500 focus:border-primary' 
                        : 'bg-bg border-border text-text-1 placeholder-text-3 focus:border-primary'
                    }`}
                    {...register('dafaxbetId', {
                      required: `${branding.companyName || 'DAFAX Bet'} ID is required`,
                      minLength: {
                        value: 3,
                        message: `${branding.companyName || 'DAFAX Bet'} ID must be at least 3 characters`,
                      },
                    })}
                  />
                  {errors.dafaxbetId && (
                    <p className="mt-1 text-xs text-danger">{errors.dafaxbetId.message}</p>
                  )}
                </div>

                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDarkCard ? 'text-slate-300' : 'text-text-1'}`}>
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder="Create a password"
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

                <button
                  type="button"
                  onClick={handleNextStep}
                  className="btn-primary w-full mt-4 min-h-[48px] rounded-xl text-base"
                  style={{ 
                    backgroundColor: branding.authBtnBgColor || branding.primaryColor || '#B91C1C',
                    color: branding.authBtnTextColor || '#FFFFFF'
                  }}
                >
                  Continue
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Security PIN Warning Info */}
                <div className={`p-4 rounded-xl mb-4 text-xs leading-relaxed border ${
                  isDarkCard 
                    ? 'bg-blue-950/20 border-blue-800/40 text-blue-200' 
                    : 'bg-blue-50 border-blue-200 text-blue-800'
                }`}>
                  <div className="font-semibold flex items-center gap-1.5 mb-1 text-[13px] text-primary">
                    <span>🛡️</span> Security Notice
                  </div>
                  <p className="opacity-95 leading-normal font-medium">
                    This 4-digit Security PIN is required to reset your password in the future. Please remember it carefully.
                  </p>
                </div>

                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDarkCard ? 'text-slate-300' : 'text-text-1'}`}>
                    Create 4-Digit Security PIN
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    pattern="[0-9]*"
                    inputMode="numeric"
                    placeholder="xxxx"
                    autoComplete="one-time-code"
                    style={{ WebkitTextSecurity: 'disc', textSecurity: 'disc' }}
                    className={`w-full border-[1.5px] text-center rounded-xl px-4 py-3 text-lg font-bold min-h-[48px] tracking-[0.5em] outline-none transition-all ${
                      isDarkCard 
                        ? 'bg-slate-900/50 border-slate-700/50 text-white placeholder-slate-500 focus:border-primary' 
                        : 'bg-bg border-border text-text-1 placeholder-text-3 focus:border-primary'
                    }`}
                    {...register('securityPin', {
                      required: 'Security PIN is required',
                      pattern: {
                        value: /^\d{4}$/,
                        message: 'Security PIN must be exactly 4 digits',
                      },
                    })}
                  />
                  {errors.securityPin && (
                    <p className="mt-1 text-xs text-danger text-center">{errors.securityPin.message}</p>
                  )}
                </div>

                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDarkCard ? 'text-slate-300' : 'text-text-1'}`}>
                    Confirm 4-Digit Security PIN
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    pattern="[0-9]*"
                    inputMode="numeric"
                    placeholder="xxxx"
                    autoComplete="one-time-code"
                    style={{ WebkitTextSecurity: 'disc', textSecurity: 'disc' }}
                    className={`w-full border-[1.5px] text-center rounded-xl px-4 py-3 text-lg font-bold min-h-[48px] tracking-[0.5em] outline-none transition-all ${
                      isDarkCard 
                        ? 'bg-slate-900/50 border-slate-700/50 text-white placeholder-slate-500 focus:border-primary' 
                        : 'bg-bg border-border text-text-1 placeholder-text-3 focus:border-primary'
                    }`}
                    {...register('confirmSecurityPin', {
                      required: 'Confirm Security PIN is required',
                      validate: value => value === securityPin || 'Security PINs do not match',
                    })}
                  />
                  {errors.confirmSecurityPin && (
                    <p className="mt-1 text-xs text-danger text-center">{errors.confirmSecurityPin.message}</p>
                  )}
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
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
                    disabled={isLoading}
                    className="flex-[2] btn-primary min-h-[48px] rounded-xl text-base"
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
                        Creating account...
                      </span>
                    ) : (
                      'Create Account'
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>

          <div className="mt-6 text-center">
            <p className={`text-sm ${isDarkCard ? 'text-slate-400' : 'text-text-2'}`}>
              Already have an account?{' '}
              <Link to="/login" className="font-bold hover:opacity-85" style={{ color: branding.authLinkColor || branding.primaryColor || '#B91C1C' }}>
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;
