/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          bg: '#0A0C16',
          surface: '#12162A',
          border: 'rgba(255,255,255,0.08)',
        },
        amber: {
          glow: '#FFB020',
          deep: '#FF7A2E',
        },
        violet: {
          glow: '#7C5CFF',
          deep: '#4A2FD6',
        },
        ink: {
          primary: '#F3F4FA',
          muted: '#8B90A8',
          faint: '#5B6080',
        },
      },
      fontFamily: {
        display: ['"Sora"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 40px rgba(255, 176, 32, 0.35)',
        'glow-violet': '0 0 40px rgba(124, 92, 255, 0.35)',
        glass: '0 8px 32px rgba(0,0,0,0.4)',
      },
      backgroundImage: {
        'coin-gradient': 'radial-gradient(circle at 35% 30%, #FFD873, #FFB020 45%, #FF7A2E 100%)',
        'app-gradient': 'radial-gradient(circle at 50% 0%, #1A1F3A 0%, #0A0C16 60%)',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.95)', opacity: '0.6' },
          '70%': { transform: 'scale(1.35)', opacity: '0' },
          '100%': { transform: 'scale(1.35)', opacity: '0' },
        },
        'float-up': {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-60px)', opacity: '0' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.6s cubic-bezier(0.2,0.6,0.4,1) infinite',
        'float-up': 'float-up 0.9s ease-out forwards',
      },
    },
  },
  plugins: [],
}
