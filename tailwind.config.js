/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#0D0D0D', 2: '#141414', 3: '#1A1A1A', 4: '#222' },
        green: { DEFAULT: '#6BAF45', 2: '#7DC952', dim: 'rgba(107,175,69,0.12)' },
        border: { DEFAULT: 'rgba(255,255,255,0.06)', 2: 'rgba(255,255,255,0.11)' },
        text: { DEFAULT: '#E8E8E8', 2: '#888', 3: '#555' }
      },
      fontFamily: { sans: ['DM Sans', 'sans-serif'] }
    }
  },
  plugins: []
}
