/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Theme-aware colors driven by CSS variables (see src/index.css).
        // :root holds the dark palette; :root[data-theme="light"] overrides it.
        // Because the existing classes (bg-navy-900, text-white, text-gray-400,
        // border-white/10, …) resolve through these variables, the whole app
        // re-themes centrally with no per-component changes.
        navy: {
          900: 'rgb(var(--navy-900) / <alpha-value>)',
          800: 'rgb(var(--navy-800) / <alpha-value>)',
          700: 'rgb(var(--navy-700) / <alpha-value>)',
        },
        // Primary foreground. `text-white` / `border-white/10` / `bg-white/5`
        // all flow through this, so they flip to dark-on-light automatically.
        white: 'rgb(var(--fg) / <alpha-value>)',
        // Muted text/border scale — remapped per theme for readable contrast.
        gray: {
          100: 'rgb(var(--gray-100) / <alpha-value>)',
          200: 'rgb(var(--gray-200) / <alpha-value>)',
          300: 'rgb(var(--gray-300) / <alpha-value>)',
          400: 'rgb(var(--gray-400) / <alpha-value>)',
          500: 'rgb(var(--gray-500) / <alpha-value>)',
          600: 'rgb(var(--gray-600) / <alpha-value>)',
          700: 'rgb(var(--gray-700) / <alpha-value>)',
        },
        brand: {
          green: '#22C55E',
          amber: '#F59E0B',
          red: '#EF4444',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
