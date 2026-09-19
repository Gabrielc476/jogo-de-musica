import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-outfit)', 'Outfit', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      colors: {
        spotify: {
          green: '#1ed760',
          dark: '#121212',
          card: '#181818',
          elevated: '#242424',
          highlight: '#2a2a2a',
          subtext: '#a7a7a7',
        },
      },
      animation: {
        'spin-slow': 'spin 7s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
