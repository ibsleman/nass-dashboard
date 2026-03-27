/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        arabic: ['Cairo', 'Tajawal', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#fdf4ff',
          100: '#fae8ff',
          200: '#f3d0fe',
          300: '#e9a8fd',
          400: '#d872f9',
          500: '#c44df0',
          600: '#a82dd5',
          700: '#8b21b0',
          800: '#731e8f',
          900: '#5e1a72',
        },
      },
    },
  },
  plugins: [],
}
