import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        linen: { DEFAULT: '#E7E3D8', deep: '#DCD7C9', pale: '#F1EEE6' },
        ink: { DEFAULT: '#191712', soft: '#4A453B', faint: '#7B7466' },
        rule: '#C4BEAE',
        nitisol: { DEFAULT: '#8A3C22', deep: '#6D2D18' },
        field: '#4E6636',
        ochre: '#B07A2E',
        hydro: '#2E5670',
        canvas: '#14150F',
      },
      fontFamily: {
        sheet: ['var(--font-fraunces)', 'Georgia', 'serif'],
        ui: ['var(--font-public-sans)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        micro: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
      },
      borderRadius: { sheet: '2px' },
      boxShadow: {
        sheet: '-1px 0 0 rgba(25,23,18,0.12), -18px 0 40px -28px rgba(0,0,0,0.6)',
        control: '0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -12px rgba(0,0,0,0.7)',
      },
    },
  },
  plugins: [],
}

export default config
