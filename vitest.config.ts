import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
      '@services': fileURLToPath(new URL('./src/services', import.meta.url)),
      '@types': fileURLToPath(new URL('./src/types', import.meta.url)),
      '@hooks': fileURLToPath(new URL('./src/hooks', import.meta.url)),
      '@utils': fileURLToPath(new URL('./src/utils', import.meta.url)),
      '@contexts': fileURLToPath(new URL('./src/contexts', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    testTimeout: 30000,
    hookTimeout: 30000,
    include: [
      'src/**/*.{test,spec}.{js,jsx,ts,tsx}',
      'backend/**/*.{test,spec}.{js,ts}',
      'backend/__tests__/**/*.{test,spec}.{js,ts}',
    ],
    setupFiles: ['./src/__tests__/setup.ts'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      all: true,
      include: [
        'backend/modules/auth/authController.ts',
        'backend/integrations/ifood/ifoodAdapter.js',
        'backend/middleware/validateRequest.js',
        'backend/errors/RequestValidationError.js',
        'backend/validation/schemas.js',
      ],
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      reportsDirectory: './coverage/backend',
      exclude: [
        'node_modules/',
        'dist/',
        'dist-backend/',
        'coverage/',
        'legacy/',
        'backend/**/*.test.{js,ts}',
        'backend/**/__tests__/**',
        'backend/scripts/**',
        'backend/types/**',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
})
