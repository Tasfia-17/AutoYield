/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Tabibito palette adapted for DeFi
        cream: '#FFFBF0',
        sand: '#F5E6C8',
        amber: {
          50: '#FFFBEB', 100: '#FEF3C7', 200: '#FDE68A',
          300: '#FCD34D', 400: '#FBBF24', 500: '#F59E0B', 600: '#D97706',
        },
        matcha: '#7CB87C',   // positive / gain
        sakura: '#F4A261',   // warning
        torii: '#E76F51',    // danger / loss
        ink: '#1A1A2E',      // primary dark
        mist: 'rgba(255,255,255,0.15)',
        // DeFi overlay
        vault: '#0F0E17',
        panel: '#1C1B2E',
      },
      fontFamily: {
        display: ['"Fredoka One"', 'cursive'],
        body: ['"Nunito"', 'sans-serif'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'float 9s ease-in-out infinite',
        'spin-slow': 'spin 20s linear infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'slide-up': 'slideUp 0.6s ease-out forwards',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'breathe': 'breathe 3.5s ease-in-out infinite',
        'bg-shift': 'bgShift 14s ease infinite',
        'ticker': 'ticker 30s linear infinite',
      },
      keyframes: {
        float: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-18px)' },
        },
        pulseGlow: {
          '0%,100%': { boxShadow: '0 0 20px rgba(251,191,36,0.4)' },
          '50%': { boxShadow: '0 0 45px rgba(251,191,36,0.8)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(30px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        breathe: {
          '0%,100%': { transform: 'scale(1) translateY(0)' },
          '50%': { transform: 'scale(1.03) translateY(-5px)' },
        },
        bgShift: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        ticker: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
};
