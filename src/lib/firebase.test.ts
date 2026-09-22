import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  app: { name: 'hora-app' },
  auth: { name: 'hora-auth' },
  browserLocalPersistence: { name: 'local' },
  browserPopupRedirectResolver: { name: 'browser-popup-resolver' },
  browserSessionPersistence: { name: 'session' },
  indexedDBLocalPersistence: { name: 'indexed-db' },
  getApp: vi.fn(),
  getApps: vi.fn(),
  initializeApp: vi.fn(),
  getAuth: vi.fn(),
  initializeAuth: vi.fn(),
  isNativePlatform: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mocks.isNativePlatform },
}))

vi.mock('firebase/app', () => ({
  getApp: mocks.getApp,
  getApps: mocks.getApps,
  initializeApp: mocks.initializeApp,
}))

vi.mock('firebase/auth', () => ({
  browserLocalPersistence: mocks.browserLocalPersistence,
  browserPopupRedirectResolver: mocks.browserPopupRedirectResolver,
  browserSessionPersistence: mocks.browserSessionPersistence,
  getAuth: mocks.getAuth,
  indexedDBLocalPersistence: mocks.indexedDBLocalPersistence,
  initializeAuth: mocks.initializeAuth,
}))

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
}))

import { browserLocalPersistence, browserPopupRedirectResolver, browserSessionPersistence, indexedDBLocalPersistence } from 'firebase/auth'
import { getFirebaseAuth } from './firebase'

describe('Firebase Auth initialization', () => {
  beforeEach(() => {
    mocks.isNativePlatform.mockReturnValue(false)
    mocks.getApps.mockReturnValue([mocks.app])
    mocks.getApp.mockReturnValue(mocks.app)
    mocks.initializeAuth.mockReturnValue(mocks.auth)
    mocks.getAuth.mockReturnValue(mocks.auth)
  })

  it('configures the browser popup resolver with all browser persistence layers', () => {
    expect(getFirebaseAuth()).toBe(mocks.auth)
    expect(mocks.initializeAuth).toHaveBeenCalledWith(mocks.app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    })
  })
})
