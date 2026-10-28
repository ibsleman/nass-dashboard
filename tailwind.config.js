/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './lab/**/*.{html,jsx}', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        arabic: ['var(--font-ui)'],
      },
      colors: {
        // رموز «المعرض» (index.css) — الصفحات الجديدة تسحب منها حصراً
        page: token('page'),
        bg: token('bg'),
        surface: token('surface'),
        sunken: token('sunken'),
        ink: { DEFAULT: token('ink'), 2: token('ink2'), 3: token('ink3') },
        gold: { DEFAULT: token('gold'), on: token('on-gold') },
        warn: token('warn'),
        ok: token('ok'),
        // الصفحات القديمة تكلّمت بالرمادي و«brand» البنفسجي: صارا درجات المعرض الدافئة والذهبي،
        // فتلبس الهوية الجديدة قبل إعادة بنائها في مراحلها
        gray: {
          50: '#F5F1EA', 100: '#EFE9DF', 200: '#E3DCD0', 300: '#CFC6B8', 400: '#A39A8D',
          500: '#776E62', 600: '#5E564C', 700: '#3A352E', 800: '#26231E', 900: '#1A1815', 950: '#0E0D0B',
        },
        brand: {
          50: '#FBF6EA', 100: '#F5EACB', 200: '#ECD9A0', 300: '#E9C46A', 400: '#D4AE52',
          500: '#8A6416', 600: '#775612', 700: '#5F450F', 800: '#4A360C', 900: '#3A2A0A',
        },
      },
      borderRadius: {
        tile: '22px',
        card: '18px',
        field: '16px',
        thumb: '14px',
      },
    },
  },
  plugins: [],
}
