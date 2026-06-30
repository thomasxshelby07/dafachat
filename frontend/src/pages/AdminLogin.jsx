import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';

const AdminLogin = () => {
  const { adminLogin } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setError('');
    setIsLoading(true);

    try {
      const user = await adminLogin(data.email, data.password);
      const dashboardRoute = {
        customer: '/customer',
        agent: '/agent',
        manager: '/manager',
        super_admin: '/admin',
      };
      navigate(dashboardRoute[user.role] || '/admin');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
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
      backgroundColor: branding.authBgColor || '#F7F8FC',
    };
  };

  const cardBg = branding.authCardBg || '#FFFFFF';
  const cardTextColor = branding.authCardTextColor || '#0F172A';
  const isDarkCard = cardBg.toLowerCase() !== '#ffffff';

  const cardStyle = {
    backgroundColor: cardBg,
    color: cardTextColor,
    border: isDarkCard ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
    boxShadow: isDarkCard 
      ? '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)'
      : '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
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
            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-2" style={{ backgroundColor: `${branding.primaryColor || '#B91C1C'}15`, color: branding.primaryColor || '#B91C1C' }}>
              Staff Portal
            </span>
            <p className={`text-sm ${isDarkCard ? 'text-slate-400' : 'text-text-2'}`}>Sign in with your email</p>
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
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDarkCard ? 'text-slate-300' : 'text-text-1'}`}>
                Email Address
              </label>
              <input
                type="email"
                placeholder="name@example.com"
                className={`w-full border-[1.5px] rounded-xl px-4 py-3 text-base sm:text-sm font-normal min-h-[48px] outline-none transition-all ${
                  isDarkCard 
                    ? 'bg-slate-900/50 border-slate-700/50 text-white placeholder-slate-500 focus:border-primary' 
                    : 'bg-bg border-border text-text-1 placeholder-text-3 focus:border-primary'
                }`}
                {...register('email', {
                  required: 'Email address is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Please enter a valid email address',
                  },
                })}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-danger">{errors.email.message}</p>
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
                })}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-danger">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full mt-2 min-h-[48px] rounded-xl text-base"
              style={{ backgroundColor: branding.primaryColor || '#B91C1C' }}
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
              Are you a customer?{' '}
              <Link to="/login" className="font-bold hover:opacity-85" style={{ color: branding.primaryColor || '#B91C1C' }}>
                Customer Login
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
