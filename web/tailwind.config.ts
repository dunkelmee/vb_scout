import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Kinetic Court palette
        surface: '#101415',
        'surface-dim': '#101415',
        'surface-bright': '#363a3b',
        'surface-low': '#191c1e',
        'surface-container': '#1d2022',
        'surface-high': '#272a2c',
        'surface-highest': '#323537',
        'on-surface': '#e0e3e5',
        'on-surface-variant': '#e4beb1',
        outline: '#ab897d',
        'outline-variant': '#5b4137',
        primary: '#ffb59a',
        'on-primary': '#5a1b00',
        'primary-container': '#ff5c00',
        'on-primary-container': '#521800',
        secondary: '#b9f1ff',
        'on-secondary': '#00363f',
        'secondary-container': '#00e0ff',
        tertiary: '#c1c6da',
        error: '#ffb4ab',
        'on-error': '#690005',
        'error-container': '#93000a',
        background: '#101415',
        'on-background': '#e0e3e5',
        // Convenience aliases
        orange: '#ff5c00',
        'orange-dim': '#ffb59a',
        blue: '#00e0ff',
        'blue-dim': '#b9f1ff',
        white: '#f8fafc',
        navy: '#1a1f2e',
      },
      fontFamily: {
        display: ['Montserrat', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      fontSize: {
        'display-lg': ['40px', { lineHeight: '48px', letterSpacing: '-0.02em', fontWeight: '800' }],
        'headline-lg': ['28px', { lineHeight: '34px', fontWeight: '700' }],
        'headline-lg-mobile': ['24px', { lineHeight: '30px', fontWeight: '700' }],
        'headline-md': ['20px', { lineHeight: '26px', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'label-bold': ['12px', { lineHeight: '16px', fontWeight: '700' }],
        'stat-value': ['22px', { lineHeight: '28px', letterSpacing: '0.05em', fontWeight: '800' }],
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.5rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.5rem',
        full: '9999px',
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
        'slide-up': 'slideUp 200ms ease-out',
        'rotation': 'rotationAnim 400ms ease-in-out',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        rotationAnim: {
          '0%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
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
