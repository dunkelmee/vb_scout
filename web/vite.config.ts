import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir:     'src',
      filename:   'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores:  ['**/live_logging_header.png'],
      },
      manifest: {
        name:             'Courtside',
        short_name:       'Courtside',
        description:      'Volleyball match logging and scouting',
        theme_color:      '#101415',
        background_color: '#101415',
        display:          'standalone',
        orientation:      'portrait',
        start_url:        '/',
        scope:            '/',
        icons: [
          { src: 'pwa-64x64.png',          sizes: '64x64',   type: 'image/png' },
          { src: 'pwa-192x192.png',         sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png',         sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: {
        enabled: true,
        type:    'module',
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target:       'http://localhost:3005',
        changeOrigin: true,
      },
    },
  },
})
