/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  readonly VITE_API_BASE_URL: string
  readonly VITE_API_URL?: string
  readonly VITE_APP_ENV?: 'dev' | 'development' | 'staging' | 'prod' | 'production' | 'test'
  readonly VITE_LOG_LEVEL?: 'trace' | 'debug' | 'info' | 'warn' | 'error'
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_SENTRY_RELEASE?: string
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE?: string
  readonly VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE?: string
  readonly VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE?: string
  readonly VITE_FIREBASE_USE_EMULATORS?: string
  readonly VITE_FIREBASE_FIRESTORE_EMULATOR_HOST?: string
  readonly VITE_FIREBASE_AUTH_EMULATOR_HOST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
