import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Design tokens ─────────────────────────────────────────────────────
        pitch: {
          950: '#101415',   // page / body background
          900: '#070600',   // app shell
          800: '#0F0E0C',   // top bars, nav bars, sticky chrome
          700: '#161412',   // card surfaces
          600: '#1E1C18',   // elevated surfaces inside cards
          500: '#252320',   // inner panels, track backgrounds
          400: '#2F2D28',   // borders, dividers
          300: '#3D3B35',   // muted dividers
        },
        turq: {
          600: '#0F6E8A',   // deep turquoise
          500: '#23B5D3',   // Turquoise Surf — primary accent
          400: '#4EC8E4',   // lighter turquoise
          300: '#8DDFF0',   // pale turquoise
        },
        bell: {
          600: '#0F5A9A',   // deep blue
          500: '#279AF1',   // Blue Bell — secondary accent
          400: '#5BB4F5',   // lighter blue
          300: '#9DD2FA',   // pale blue
        },
        bubb: {
          700: '#A82848',   // deep pink — heavy loss / critical
          500: '#EA526F',   // Bubblegum Pink — loss / error / alert
          400: '#F07A90',   // lighter pink
          300: '#F8AABB',   // pale pink
        },
        ghost: {
          100: '#F7F7FF',   // Ghost White — primary text
          200: '#C8C8D8',   // secondary text
          300: '#8A8A9A',   // muted text
          400: '#4A4A5A',   // very muted — section labels, metadata
        },

        // ── Backward-compat aliases (old token names → new values) ────────────
        background:              '#101415',
        surface:                 '#161412',
        'surface-dim':           '#161412',
        'surface-bright':        '#3D3B35',
        'surface-low':           '#0F0E0C',
        'surface-container':     '#0F0E0C',
        'surface-high':          '#1E1C18',
        'surface-highest':       '#252320',
        'on-surface':            '#F7F7FF',
        'on-surface-variant':    '#8A8A9A',
        outline:                 '#2F2D28',
        'outline-variant':       '#3D3B35',
        primary:                 '#23B5D3',
        'on-primary':            '#000000',
        'primary-container':     '#23B5D3',
        'on-primary-container':  '#000000',
        secondary:               '#9DD2FA',
        'on-secondary':          '#000000',
        'secondary-container':   '#279AF1',
        error:                   '#EA526F',
        'on-error':              '#000000',
        'error-container':       '#A82848',
        // Convenience
        orange:      '#23B5D3',
        'orange-dim':'#4EC8E4',
        blue:        '#279AF1',
        'blue-dim':  '#9DD2FA',
        white:       '#F7F7FF',
        navy:        '#0F0E0C',
      },
      fontFamily: {
        sans:    ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Montserrat', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
        harabara:['Harabara', 'sans-serif'],
      },
      fontSize: {
        'display-lg':        ['40px', { lineHeight: '48px', letterSpacing: '-0.02em', fontWeight: '800' }],
        'headline-lg':       ['28px', { lineHeight: '34px', fontWeight: '700' }],
        'headline-lg-mobile':['24px', { lineHeight: '30px', fontWeight: '700' }],
        'headline-md':       ['20px', { lineHeight: '26px', fontWeight: '600' }],
        'body-lg':           ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-md':           ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'label-bold':        ['12px', { lineHeight: '16px', fontWeight: '700' }],
        'stat-value':        ['22px', { lineHeight: '28px', letterSpacing: '0.05em', fontWeight: '800' }],
      },
      borderRadius: {
        sm:      '0.25rem',
        DEFAULT: '0.5rem',
        md:      '0.75rem',
        lg:      '1rem',
        xl:      '1.5rem',
        full:    '9999px',
        pill:    '999px',
      },
      spacing: {
        xs: '8px',
        sm: '12px',
        md: '16px',
        lg: '24px',
        xl: '32px',
      },
      animation: {
        'pulse-slow': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up':   'slideUp 200ms ease-out',
        'rotation':   'rotationAnim 400ms ease-in-out',
      },
      keyframes: {
        slideUp: {
          '0%':   { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        rotationAnim: {
          '0%':   { transform: 'translateY(0)' },
          '50%':  { transform: 'translateY(-4px)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
      backdropBlur: {
        xs: '4px',
      },
    },
  },
  plugins: [],
} satisfies Config
