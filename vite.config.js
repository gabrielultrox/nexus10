import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const shouldAnalyze = mode === 'analyze'
  const featureChunkMatchers = [
    'charts-and-reports',
    'operations-workspace',
    'export-utils',
    'firebase-data',
  ]

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'icons/icon-192.svg',
          'icons/icon-512.svg',
          'icons/maskable-512.svg',
          'icons/apple-touch-icon.svg',
        ],
        manifest: {
          name: 'Nexus 10 ERP',
          short_name: 'Nexus10',
          description: 'ERP operacional delivery com pedidos, vendas e operacao em tempo real.',
          theme_color: '#050816',
          background_color: '#050816',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/icons/icon-192.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
            },
            {
              src: '/icons/icon-512.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
            },
            {
              src: '/icons/maskable-512.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'maskable',
            },
            {
              src: '/icons/apple-touch-icon.svg',
              sizes: '180x180',
              type: 'image/svg+xml',
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          navigateFallback: '/index.html',
          globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.destination === 'document',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'pages-cache',
                networkTimeoutSeconds: 3,
              },
            },
            {
              urlPattern: ({ request }) => request.destination === 'image',
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-cache',
                expiration: {
                  maxEntries: 40,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
          ],
        },
      }),
      shouldAnalyze
        ? visualizer({
            filename: 'output/bundle-report.html',
            template: 'treemap',
            gzipSize: true,
            brotliSize: true,
            open: false,
          })
        : null,
    ].filter(Boolean),
    server: {
      port: 5173,
      proxy: {
        '/api': 'http://127.0.0.1:8787',
      },
    },
    build: {
      minify: 'esbuild',
      cssMinify: true,
      cssCodeSplit: true,
      reportCompressedSize: true,
      assetsInlineLimit: 2048,
      sourcemap: shouldAnalyze,
      modulePreload: {
        resolveDependencies(_filename, dependencies, context) {
          if (context.hostType !== 'html') {
            return dependencies
          }

          return dependencies.filter(
            (dependency) =>
              !featureChunkMatchers.some((chunkName) => dependency.includes(chunkName)),
          )
        },
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes('/src/components/ui/') ||
              id.includes('/src/components/common/') ||
              id.includes('/src/components/system/')
            ) {
              return 'ui-system'
            }

            if (
              id.includes('/src/components/dashboard/') ||
              id.includes('/src/modules/reports/components/')
            ) {
              return 'charts-and-reports'
            }

            if (id.includes('/src/modules/operations/components/')) {
              return 'operations-workspace'
            }

            if (!id.includes('node_modules')) {
              return undefined
            }

            if (id.includes('firebase/auth')) {
              return 'firebase-auth'
            }

            if (id.includes('firebase/firestore') || id.includes('firebase/app')) {
              return 'firebase-data'
            }

            if (id.includes('html-to-image')) {
              return 'export-utils'
            }

            if (id.includes('@tanstack/react-query')) {
              return 'query-vendor'
            }

            if (
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/scheduler/')
            ) {
              return 'react-vendor'
            }

            if (id.includes('react-router-dom') || id.includes('react-router')) {
              return 'router-vendor'
            }

            return 'vendor'
          },
        },
      },
    },
  }
})
