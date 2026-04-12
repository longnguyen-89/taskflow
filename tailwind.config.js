/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          900: '#312E81',
        },
        success: { light: '#E1F5EE', DEFAULT: '#1D9E75', dark: '#0F6E56' },
        warning: { light: '#FAEEDA', DEFAULT: '#EF9F27', dark: '#854F0B' },
        danger:  { light: '#FCEBEB', DEFAULT: '#E24B4A', dark: '#A32D2D' },
        info:    { light: '#E6F1FB', DEFAULT: '#378ADD', dark: '#185FA5' },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
