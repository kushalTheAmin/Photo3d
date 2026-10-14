/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cinema: {
          950: '#07080b',
          900: '#0c0e13',
          850: '#11141b',
          800: '#161a23',
          700: '#1f2430',
          600: '#2b3242',
          500: '#3d4559',
        },
        accent: {
          DEFAULT: '#e5484d',
          soft: '#ff6b6f',
          muted: '#7a2a2d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(229,72,77,0.35), 0 8px 40px -8px rgba(229,72,77,0.35)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-up': 'slide-up 180ms ease-out',
      },
    },
  },
  plugins: [],
};
