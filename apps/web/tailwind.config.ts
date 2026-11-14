import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-noto-thai)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      colors: {
        chula: {
          50: '#FFEFF4',
          100: '#FFD1DF',
          200: '#FF9EB8',
          300: '#FF8FAB',
          400: '#FB6F92',
          500: '#E13C6C',
          600: '#EC3D6A',
          700: '#CC6B92',
          blush: '#FFC7CF',
          lilac: '#F2B5D4',
          border: '#F2C4D0',
        },
      },
    },
  },
  plugins: [],
};

export default config;
