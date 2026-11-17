import type { Config } from 'tailwindcss'

const slateShades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const

// A escala slate é dirigida por variáveis CSS para que o tema do painel
// (.gm-shell em globals.css) possa repintar as telas sem tocar em cada classe.
const slate = Object.fromEntries(
  slateShades.map(shade => [shade, `rgb(var(--slate-${shade}) / <alpha-value>)`])
)

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        slate,
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#312e81',
          950: '#1e1b4b',
        },
        gm: {
          bg: 'rgb(var(--gm-bg) / <alpha-value>)',
          surface: 'rgb(var(--gm-surface) / <alpha-value>)',
          raised: 'rgb(var(--gm-raised) / <alpha-value>)',
          line: 'rgb(var(--gm-line) / <alpha-value>)',
          text: 'rgb(var(--gm-text) / <alpha-value>)',
          muted: 'rgb(var(--gm-muted) / <alpha-value>)',
          accent: 'rgb(var(--gm-accent) / <alpha-value>)',
          glow: 'rgb(var(--gm-glow) / <alpha-value>)',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-dot': 'pulseDot 1.4s ease-in-out infinite',
        'gm-enter': 'gmEnter 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) backwards',
        'gm-drawer': 'gmDrawer 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) both',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseDot: {
          '0%, 80%, 100%': { transform: 'scale(0)', opacity: '0.5' },
          '40%': { transform: 'scale(1)', opacity: '1' },
        },
        gmEnter: {
          '0%': { transform: 'translateY(12px)', opacity: '0', filter: 'blur(6px)' },
          '100%': { transform: 'translateY(0)', opacity: '1', filter: 'blur(0)' },
        },
        gmDrawer: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
