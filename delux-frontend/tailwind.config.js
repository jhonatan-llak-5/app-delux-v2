/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Bricolage Grotesque"', '"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: {
          25:  "#fafbfc",
          50:  '#f5f6f8', 100: '#e9ebef', 200: '#cdd1d9', 300: '#a4abb7',
          400: '#737c8c', 500: '#4c5466', 600: '#363c4d', 700: '#252a39',
          800: '#171b27', 900: '#0b0e16', 950: '#06080f',
        },
        accent: {
          50:  '#ecfeff', 100: '#cffafe', 200: '#a5f3fc', 300: '#67e8f9',
          400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2', 700: '#0e7490',
          800: '#155e75', 900: '#164e63',
        },
        brand: {
          orange:  '#ff7849',
          magenta: '#e0399a',
          violet:  '#7c3aed',
          teal:    '#14b8a6',
        },
      },
      boxShadow: {
        soft: '0 10px 30px -10px rgba(2, 6, 23, 0.25)',
        glow: '0 0 40px -10px rgba(34, 211, 238, 0.55)',
        'glow-lg': '0 0 80px -10px rgba(34, 211, 238, 0.65)',
        'editorial': '0 30px 60px -20px rgba(0,0,0,0.6)',
      },
      letterSpacing: {
        tightest: '-0.04em',
        ultra: '0.5em',
      },
      animation: {
        'fluid-drift':    'fluidDrift 14s ease-in-out infinite',
        'liquid-wave':    'liquidWave 8s ease-in-out infinite',
        'marquee':        'marquee 30s linear infinite',
        'marquee-rev':    'marquee 40s linear infinite reverse',
        'float':          'float 5s ease-in-out infinite',
        'tilt-float':     'tiltFloat 7s ease-in-out infinite',
        'spin-slow':      'spin 30s linear infinite',
        'fade-in':        'fadeIn 0.7s ease-out forwards',
        'fade-in-slow':   'fadeIn 1.4s ease-out forwards',
        'slide-up':       'slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up-late':  'slideUp 1s 0.2s cubic-bezier(0.16, 1, 0.3, 1) backwards',
        'slide-up-later': 'slideUp 1s 0.4s cubic-bezier(0.16, 1, 0.3, 1) backwards',
        'slide-down':     'slideDown 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'product-enter':  'productEnter 0.9s cubic-bezier(0.34, 1.36, 0.64, 1) forwards',
        'halo-pulse':     'haloPulse 6s ease-in-out infinite',
        'shimmer':        'shimmer 3s ease-in-out infinite',
        'splash-logo':    'splashLogo 1.6s cubic-bezier(0.34, 1.36, 0.64, 1) forwards',
        'splash-text':    'splashText 1.2s 0.4s cubic-bezier(0.16, 1, 0.3, 1) backwards',
        'splash-out':     'splashOut 0.9s 2.2s cubic-bezier(0.7, 0, 0.3, 1) forwards',
        'wordmark-rise':  'wordmarkRise 1.6s 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards',
        'cta-pulse':      'ctaPulse 2.5s ease-in-out infinite',
        'gradient-pan':   'gradientPan 16s ease-in-out infinite',
        'zoom-fade':      'zoomFade 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'orbit':          'orbit 24s linear infinite',
        'ticker-up':      'tickerUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'reveal-line':    'revealLine 1.2s 0.3s cubic-bezier(0.16, 1, 0.3, 1) backwards',
      },
      keyframes: {
        fluidDrift: {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1) rotate(0deg)', filter: 'hue-rotate(0deg)' },
          '33%':     { transform: 'translate3d(-3%,2%,0) scale(1.08) rotate(2deg)', filter: 'hue-rotate(15deg)' },
          '66%':     { transform: 'translate3d(2%,-2%,0) scale(0.95) rotate(-2deg)', filter: 'hue-rotate(-10deg)' },
        },
        liquidWave: {
          '0%,100%': { transform: 'skewX(0deg) skewY(0deg) scale(1)' },
          '25%':     { transform: 'skewX(2deg) skewY(-1deg) scale(1.02)' },
          '50%':     { transform: 'skewX(-1deg) skewY(2deg) scale(0.98)' },
          '75%':     { transform: 'skewX(1deg) skewY(-2deg) scale(1.01)' },
        },
        gradientPan: {
          '0%,100%': { backgroundPosition: '0% 50%', filter: 'hue-rotate(0deg)' },
          '50%':     { backgroundPosition: '100% 50%', filter: 'hue-rotate(45deg)' },
        },
        marquee: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%':     { transform: 'translateY(-18px)' },
        },
        tiltFloat: {
          '0%,100%': { transform: 'translateY(0) rotate(-2deg)' },
          '50%':     { transform: 'translateY(-22px) rotate(2deg)' },
        },
        fadeIn: { 'from': { opacity: '0' }, 'to': { opacity: '1' } },
        slideUp: {
          'from': { opacity: '0', transform: 'translateY(40px)' },
          'to':   { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          'from': { opacity: '0', transform: 'translateY(-30px)' },
          'to':   { opacity: '1', transform: 'translateY(0)' },
        },
        productEnter: {
          '0%':   { opacity: '0', transform: 'translateX(80px) scale(0.85) rotate(8deg)' },
          '60%':  { opacity: '1' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1) rotate(0deg)' },
        },
        haloPulse: {
          '0%,100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%':     { opacity: '0.75', transform: 'scale(1.12)' },
        },
        shimmer: {
          '0%,100%': { backgroundPosition: '0% 50%' },
          '50%':     { backgroundPosition: '100% 50%' },
        },
        splashLogo: {
          '0%':   { opacity: '0', transform: 'scale(0.3) rotate(-12deg)' },
          '60%':  { opacity: '1', transform: 'scale(1.15) rotate(8deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
        },
        splashText: {
          '0%':   { opacity: '0', letterSpacing: '0.6em', transform: 'translateY(20px)' },
          '100%': { opacity: '1', letterSpacing: '0.02em', transform: 'translateY(0)' },
        },
        splashOut: {
          '0%':   { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(1.4)', visibility: 'hidden' },
        },
        wordmarkRise: {
          '0%':   { opacity: '0', transform: 'translateY(60px) scale(0.85)', letterSpacing: '0.3em' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)', letterSpacing: '-0.02em' },
        },
        ctaPulse: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(34,211,238,0.6), 0 10px 30px -10px rgba(34,211,238,0.55)' },
          '50%':     { boxShadow: '0 0 0 18px rgba(34,211,238,0), 0 10px 30px -10px rgba(34,211,238,0.85)' },
        },
        zoomFade: {
          'from': { opacity: '0', transform: 'scale(0.94)' },
          'to':   { opacity: '1', transform: 'scale(1)' },
        },
        orbit: {
          'from': { transform: 'rotate(0deg)' },
          'to':   { transform: 'rotate(360deg)' },
        },
        tickerUp: {
          'from': { opacity: '0', transform: 'translateY(20px)' },
          'to':   { opacity: '1', transform: 'translateY(0)' },
        },
        revealLine: {
          'from': { transform: 'scaleX(0)', transformOrigin: 'left' },
          'to':   { transform: 'scaleX(1)', transformOrigin: 'left' },
        },
      },
    },
  },
  plugins: [],
};
