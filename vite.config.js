import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { visualizer } from 'rollup-plugin-visualizer'
import { VitePWA } from 'vite-plugin-pwa'
import { optimizeImageAssets } from './scripts/optimize-images.mjs'

function imageOptimizationPlugin() {
  return {
    name: 'nexus10-image-optimization',
    apply: 'build',
    async buildStart() {
      await optimizeImageAssets({ silent: true })
    },
  }
}

export default defineConfig(({ mode }) => {
  const shouldAnalyze = mode === 'analyze'
  const resolvedRelease =
    process.env.VITE_SENTRY_RELEASE ||
    process.env.SENTRY_RELEASE ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.npm_package_version ||
    ''
  const shouldUploadSourcemaps = Boolean(
    process.env.SENTRY_AUTH_TOKEN &&
      process.env.SENTRY_ORG &&
      process.env.SENTRY_PROJECT &&
      resolvedRelease,
  )
  const featureChunkMatchers = [
    'charts-and-reports',
    'operations-workspace',
    'export-utils',
    'firebase-data',
    'sentry-vendor',
  ]

  return {
    plugins: [
      react(),
      imageOptimizationPlugin(),
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
          globPatterns: ['**/*.{js,css,html,svg,png,webp,avif,ico}'],
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
      shouldUploadSourcemaps
        ? sentryVitePlugin({
            authToken: process.env.SENTRY_AUTH_TOKEN,
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            release: {
              name: resolvedRelease,
            },
            sourcemaps: {
              assets: './dist/**',
            },
            telemetry: false,
          })
        : null,
    ].filter(Boolean),
    server: {
      port: 5173,
      proxy: {
        '/api': 'http://127.0.0.1:8787',
      },
    },
    define: {
      __NEXUS10_RELEASE__: JSON.stringify(resolvedRelease),
    },
    build: {
      minify: 'esbuild',
      cssMinify: true,
      cssCodeSplit: true,
      reportCompressedSize: true,
      assetsInlineLimit: 2048,
      sourcemap: shouldAnalyze || shouldUploadSourcemaps,
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

            if (id.includes('@sentry/') || id.includes('@sentry-internal/')) {
              return 'sentry-vendor'
            }

            if (id.includes('/node_modules/zod/')) {
              return 'validation-vendor'
            }

            if (id.includes('@tanstack/react-query') || id.includes('@tanstack/query-core')) {
              return 'query-vendor'
            }

            if (
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/scheduler/')
            ) {
              return 'react-vendor'
            }

            if (
              id.includes('react-router-dom') ||
              id.includes('react-router') ||
              id.includes('@remix-run/router')
            ) {
              return 'router-vendor'
            }

            return 'vendor'
          },
        },
      },
    },
  }
})
