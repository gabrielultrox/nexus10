import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

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
