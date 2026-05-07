import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
      },
      keyframes: {
        'bookmark-move': {
          '0%':   { opacity: '1', transform: 'scale(1)',    boxShadow: '0 0 0 0px rgba(96,165,250,0)' },
          '25%':  { opacity: '1', transform: 'scale(1.04)', boxShadow: '0 0 0 3px rgba(96,165,250,0.55), 0 0 14px rgba(96,165,250,0.3)' },
          '100%': { opacity: '0', transform: 'scale(0.94)', boxShadow: '0 0 0 0px rgba(96,165,250,0)' },
        },
      },
      animation: {
        'bookmark-move': 'bookmark-move 0.4s ease-out forwards',
      },
    },
  },
  plugins: [],
}

export default config
