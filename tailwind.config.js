/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Coco Pro palette — v2 design system
        ink:    { DEFAULT: '#123524', 2: '#1F3A2A', 3: '#3A4A3F' },
        bone:   { DEFAULT: '#F8F5EE', soft: '#F3EFE4' },
        gold:   { DEFAULT: '#D4A24C', soft: '#FAF1DC', warm: '#F5E7C3' },
        accent: { DEFAULT: '#2E6F4C', soft: '#E8F1EC' },
        line:   { DEFAULT: '#E8E2D5', soft: '#F0EBE0' },
        // Legacy "brand" keeps existing Tailwind utility classes working — now maps to ink/accent
        brand: {
          50: '#E8F1EC',
          100: '#D3E4D9',
          500: '#2E6F4C',
          600: '#2E6F4C',
          700: '#1F3A2A',
          900: '#123524',
        },
        success: { light: '#E8F1EC', DEFAULT: '#2E6F4C', dark: '#1F3A2A' },
        warning: { light: '#FAF1DC', DEFAULT: '#C8963E', dark: '#8B6A23' },
        danger:  { light: '#FAEAE7', DEFAULT: '#B5443A', dark: '#8B2E26' },
        info:    { light: '#F0EDF5', DEFAULT: '#6B5B95', dark: '#4A3F6B' },
      },
      fontFamily: {
        sans: ['Inter', 'DM Sans', 'system-ui', 'sans-serif'],
        display: ['Inter', 'Outfit', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 2px rgba(18,53,36,.05)',
        'card-hover': '0 4px 12px rgba(18,53,36,.08)',
        'sheet': '-8px 0 40px rgba(18,53,36,.15)',
        'pop': '0 20px 40px -10px rgba(18,53,36,.2), 0 1px 2px rgba(18,53,36,.06)',
      },
      borderRadius: {
        'xl2': '14px',
      },
    },
  },
  plugins: [],
};
