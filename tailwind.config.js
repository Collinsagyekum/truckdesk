/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0A1628',
          800: '#0F2040',
          700: '#162B55',
        },
        brand: {
          green: '#22C55E',
          amber: '#F59E0B',
          red: '#EF4444',
        }
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      }
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
