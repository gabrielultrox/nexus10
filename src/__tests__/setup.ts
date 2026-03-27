import '@testing-library/jest-dom/vitest'
import 'vitest-axe/extend-expect'
import { expect } from 'vitest'
import * as axeMatchers from 'vitest-axe/matchers'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

expect.extend(axeMatchers)

const frontendEnvDefaults = {
  VITE_APP_ENV: 'test',
  VITE_FIREBASE_PROJECT_ID: 'nexus10-test',
  VITE_FIREBASE_APP_ID: '1:1234567890:web:test',
  VITE_FIREBASE_AUTH_DOMAIN: 'nexus10-test.firebaseapp.com',
  VITE_FIREBASE_API_KEY: 'test-api-key',
  VITE_API_BASE_URL: 'http://127.0.0.1:8787/api',
  VITE_LOG_LEVEL: 'info',
  VITE_SENTRY_DSN: '',
  VITE_SENTRY_RELEASE: '',
  VITE_SENTRY_TRACES_SAMPLE_RATE: '0',
  VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE: '0',
  VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE: '0',
  VITE_FIREBASE_STORAGE_BUCKET: '',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '',
  VITE_FIREBASE_USE_EMULATORS: 'false',
  VITE_FIREBASE_FIRESTORE_EMULATOR_HOST: '',
  VITE_FIREBASE_AUTH_EMULATOR_HOST: '',
} as const

Object.entries(frontendEnvDefaults).forEach(([key, value]) => {
  vi.stubEnv(key, value)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const localStorageMock = {
  getItem: vi.fn((key: string) =>
    key in localStorageMock.store ? localStorageMock.store[key] : null,
  ),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageMock.store[key]
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {}
  }),
  store: {} as Record<string, string>,
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  })

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: 'mock-app' })),
  getApps: vi.fn(() => []),
  getApp: vi.fn(() => ({ name: 'mock-app' })),
}))

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({ name: 'mock-firestore' })),
  collection: vi.fn(() => ({ path: 'collection' })),
  doc: vi.fn(() => ({ path: 'doc' })),
  addDoc: vi.fn(async () => ({ id: 'mock-doc-id' })),
  setDoc: vi.fn(async () => undefined),
  updateDoc: vi.fn(async () => undefined),
  deleteDoc: vi.fn(async () => undefined),
  getDoc: vi.fn(async () => ({ exists: () => true, data: () => ({}) })),
  getDocs: vi.fn(async () => ({ docs: [], forEach: vi.fn() })),
  onSnapshot: vi.fn(() => vi.fn()),
  query: vi.fn((...args) => args),
  where: vi.fn((...args) => args),
  orderBy: vi.fn((...args) => args),
  limit: vi.fn((...args) => args),
  serverTimestamp: vi.fn(() => 'server-timestamp'),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date() })),
    fromDate: vi.fn((date: Date) => ({ toDate: () => date })),
  },
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(async () => undefined),
  })),
  runTransaction: vi.fn(async (_db, updateFunction) =>
    updateFunction({
      get: vi.fn(async () => ({ exists: () => true, data: () => ({}) })),
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    }),
  ),
  enableIndexedDbPersistence: vi.fn(async () => undefined),
}))
