import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  define: {
    '__BUILD_TIME__': JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',  // Use custom service worker
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',  // User controls when to update
      injectRegister: false,   // We handle registration in main.tsx
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Discount Fence Hub',
        short_name: 'Fence Hub',
        description: 'Sales and operations management for discount fence installation',
        theme_color: '#2563eb',
        background_color: '#2563eb',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        // Handle external links properly - preserve URL when PWA is launched
        launch_handler: {
          client_mode: ['navigate-existing', 'auto']
        },
        icons: [
          {
            src: '/Logo-DF-Transparent.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/Logo-DF-Transparent.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB (to handle Survey.js bundle)
      },
      devOptions: {
        enabled: true,
        type: 'module',
      }
    })
  ],
})
