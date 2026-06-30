/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          light: 'var(--primary-light)',
        },
        surface: '#FFFFFF',
        bg: '#F9FAFB',
        sidebar: {
          DEFAULT: 'var(--sidebar-bg)',
          active: 'var(--sidebar-active)',
          text: 'var(--sidebar-text)',
          'text-active': 'var(--sidebar-text-active)',
        },
        text: {
          1: '#0F172A',
          2: '#64748B',
          3: '#94A3B8',
        },
        border: '#E5E7EB',
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#DC2626',
        info: '#3B82F6',
        bubble: {
          agent: 'var(--bubble-agent)',
          'agent-text': 'var(--bubble-agent-text)',
          customer: 'var(--bubble-customer)',
          'customer-text': 'var(--bubble-customer-text)',
        },
        note: {
          DEFAULT: 'var(--note-bg, #FEFCE8)',
          border: 'var(--note-border, #FDE68A)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'sm': 'var(--radius-sm, 0px)',
        'md': 'var(--radius-md, 0px)',
        'lg': 'var(--radius-lg, 0px)',
        'bubble': 'var(--radius-bubble, 0px)',
        'pill': 'var(--radius-pill, 0px)',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'sheet': '0 4px 24px rgba(0,0,0,0.10)',
        'float': '0 8px 32px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
}
