/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        casino: {
          bg: '#0a0a0f',
          card: '#151520',
          border: '#2a2a3a',
          accent: '#ffd700',
          neon: '#00ff88',
          pink: '#ff00aa',
          purple: '#8b5cf6',
        },
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        body: ['Rajdhani', 'sans-serif'],
      },
      boxShadow: {
        neon: '0 0 20px rgba(0, 255, 136, 0.5)',
        'neon-pink': '0 0 20px rgba(255, 0, 170, 0.5)',
        gold: '0 0 20px rgba(255, 215, 0, 0.5)',
      },
    },
  },
  plugins: [],
}

