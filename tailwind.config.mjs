/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class', // Use class strategy for more control
  theme: {
    extend: {
      colors: {
        dark: {
          100: '#1E1E1E',
          200: '#252525',
          300: '#2D2D2D',
          400: '#353535',
          500: '#3F3F3F',
          600: '#474747',
          700: '#595959',
          800: '#696969',
          900: '#818181',
        },
        accent: {
          primary: '#4F6BFF',
          hover: '#3D59E0',
          secondary: '#8A63D2',
          success: '#10B981',
          danger: '#EF4444',
          warning: '#F59E0B',
        }
      },
    },
  },
}
