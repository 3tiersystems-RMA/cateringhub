/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FDFAF5',
          100: '#FAF7F2',
          200: '#F5F0E8',
          300: '#EDE7DA',
          400: '#E0D8CC',
          500: '#DDD5C8',
        },
        terra: {
          50: '#FBF0EA',
          100: '#F5D9CC',
          200: '#E9AA8A',
          300: '#D97B4A',
          400: '#C4622D',
          500: '#A04E22',
          600: '#7D3C19',
        },
        gold: {
          400: '#D4A853',
          500: '#BF9440',
        },
        warm: {
          900: '#1A1612',
          800: '#2C2520',
          700: '#3D342D',
          600: '#5C5347',
          500: '#7A6F65',
          400: '#8C8278',
          300: '#B5ADA5',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        '10xl': ['10rem', { lineHeight: '0.85' }],
        '9xl': ['8rem', { lineHeight: '0.85' }],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        warm: '0 4px 24px rgba(26,22,18,0.08)',
        card: '0 2px 16px rgba(26,22,18,0.06)',
        terra: '0 8px 32px rgba(196,98,45,0.25)',
        'terra-lg': '0 16px 48px rgba(196,98,45,0.30)',
        glass: '0 8px 32px rgba(26,22,18,0.12), inset 0 1px 0 rgba(255,255,255,0.4)',
      },
      backgroundImage: {
        'terra-gradient': 'linear-gradient(135deg, #C4622D 0%, #D97B4A 50%, #D4A853 100%)',
        'dark-gradient': 'linear-gradient(135deg, #1A1612 0%, #2C2520 100%)',
        'cream-gradient': 'linear-gradient(180deg, #F5F0E8 0%, #EDE7DA 100%)',
      },
      animation: {
        'spin-slow': 'spin 8s linear infinite',
        'float': 'float-gentle 5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};