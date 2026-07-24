/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          green: '#00FF66',
          'green-dim': '#00E55C',
          'green-glow': '#00FF6633',
          'green-border': '#00FF6620',
        },
        obsidian: {
          950: '#050709',
          900: '#0A0D0F',
          800: '#0F1317',
          700: '#121619',
          600: '#171C20',
          500: '#1E2428',
          400: '#252D33',
          300: '#2E3840',
        },
        glass: {
          DEFAULT: 'rgba(255,255,255,0.04)',
          border: 'rgba(255,255,255,0.08)',
          hover: 'rgba(255,255,255,0.07)',
          strong: 'rgba(255,255,255,0.09)',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
      },
      backgroundImage: {
        'cyber-grid': `
          linear-gradient(rgba(0,255,102,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,255,102,0.03) 1px, transparent 1px)
        `,
        'cyber-gradient': 'linear-gradient(135deg, #0A0D0F 0%, #0F1317 50%, #0A0D0F 100%)',
        'cyber-glow-radial': 'radial-gradient(ellipse at 50% 0%, rgba(0,255,102,0.12) 0%, transparent 70%)',
        'card-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
        'vip-gradient': 'linear-gradient(135deg, #00FF66 0%, #00B846 100%)',
        'hero-gradient': 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,255,102,0.2) 0%, transparent 100%)',
      },
      backgroundSize: {
        'grid-sm': '20px 20px',
        'grid-md': '40px 40px',
        'grid-lg': '60px 60px',
      },
      boxShadow: {
        'cyber-sm': '0 0 10px rgba(0,255,102,0.15)',
        'cyber-md': '0 0 20px rgba(0,255,102,0.2)',
        'cyber-lg': '0 0 40px rgba(0,255,102,0.25)',
        'cyber-xl': '0 0 60px rgba(0,255,102,0.3)',
        'glass': '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        'glass-lg': '0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        'card': '0 4px 24px rgba(0,0,0,0.3)',
        'card-hover': '0 8px 40px rgba(0,0,0,0.4), 0 0 20px rgba(0,255,102,0.1)',
      },
      dropShadow: {
        'cyber': '0 0 8px rgba(0,255,102,0.6)',
        'cyber-lg': '0 0 16px rgba(0,255,102,0.8)',
      },
      animation: {
        'pulse-cyber': 'pulse-cyber 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'scan-line': 'scan-line 2s linear infinite',
        'grid-move': 'grid-move 20s linear infinite',
        'ticker': 'ticker 30s linear infinite',
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
        'particle': 'particle 8s linear infinite',
      },
      keyframes: {
        'pulse-cyber': {
          '0%, 100%': { boxShadow: '0 0 10px rgba(0,255,102,0.2)' },
          '50%': { boxShadow: '0 0 30px rgba(0,255,102,0.5)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'grid-move': {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '40px 40px' },
        },
        'ticker': {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'particle': {
          '0%': { transform: 'translateY(100vh) translateX(0px)', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { transform: 'translateY(-100px) translateX(50px)', opacity: '0' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}
