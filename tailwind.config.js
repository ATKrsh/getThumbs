/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', '"SF Pro"', '"San Francisco"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        background: '#05070d',
        surface: '#090d16',
        'surface-elevated': '#0f1624',
        'surface-card': '#141d2f',
        accent: {
          DEFAULT: '#6366f1',
          hover: '#4f46e5',
          cyan: '#00f0ff',
          neon: '#00f5d4',
          magenta: '#f72585',
          amber: '#fbbf24',
        }
      },
      boxShadow: {
        'glow-cyan': '0 0 15px rgba(0, 240, 255, 0.35)',
        'glow-neon': '0 0 15px rgba(0, 245, 212, 0.35)',
        'glow-magenta': '0 0 15px rgba(247, 37, 133, 0.35)',
        'glow-accent': '0 0 20px rgba(99, 102, 241, 0.4)',
      }
    },
  },
  plugins: [],
}
