/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        bg2: 'var(--bg2)',
        bg3: 'var(--bg3)',
        bg4: 'var(--bg4)',
        bg5: 'var(--bg5)',
        green: {
          DEFAULT: 'var(--green)',
          2: 'var(--green2)',
          dark: 'var(--green-dark)',
          dim: 'var(--green-dim)',
          glow: 'var(--green-glow)'
        },
        text: {
          DEFAULT: 'var(--text)',
          2: 'var(--text2)',
          3: 'var(--text3)'
        },
        border: {
          DEFAULT: 'var(--border)',
          2: 'var(--border2)'
        },
        red: 'var(--red)',
        yellow: 'var(--yellow)',
        blue: 'var(--blue)',
        indigo: 'var(--indigo)'
      },
      fontFamily: {
        sans: ['"DM Sans"', 'sans-serif']
      },
      borderRadius: {
        card: '10px',
        modal: '12px',
        input: '8px'
      }
    }
  },
  plugins: []
}
