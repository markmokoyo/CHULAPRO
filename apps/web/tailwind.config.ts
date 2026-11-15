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
        pastel: {
          sky: '#0EA5E9',
          skySoft: '#E0F2FE',
          mint: '#10B981',
          mintSoft: '#D1FAE5',
          violet: '#8B5CF6',
          violetSoft: '#EDE9FE',
          amber: '#F59E0B',
          amberSoft: '#FEF3C7',
          plum: '#2B2135',
        },
      },
    },
  },
  plugins: [],
};

export default config;
