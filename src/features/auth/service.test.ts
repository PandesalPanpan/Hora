import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: { name: 'auth' },
  credential: vi.fn(() => ({ provider: 'google-credential' })),
  firebaseSignInWithCredential: vi.fn(),
  firebaseSignInWithPopup: vi.fn(),
  nativeSignInWithGoogle: vi.fn(),
  isNativePlatform: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mocks.isNativePlatform },
}))

vi.mock('@capacitor-firebase/authentication', () => ({
  FirebaseAuthentication: { signInWithGoogle: mocks.nativeSignInWithGoogle },
}))

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class MockGoogleAuthProvider {
    static credential = mocks.credential
  },
  signInWithCredential: mocks.firebaseSignInWithCredential,
  signInWithPopup: mocks.firebaseSignInWithPopup,
}))

vi.mock('../../lib/firebase', () => ({
  getFirebaseAuth: () => mocks.auth,
  isFirebaseConfigured: true,
}))

import { signInWithGoogle } from './service'

describe('Google sign-in mechanism', () => {
  beforeEach(() => {
    mocks.isNativePlatform.mockReturnValue(false)
    mocks.nativeSignInWithGoogle.mockReset()
    mocks.firebaseSignInWithCredential.mockReset()
    mocks.firebaseSignInWithPopup.mockReset().mockResolvedValue({ user: { uid: 'web-user' } })
    mocks.credential.mockClear()
  })

  it('uses Firebase browser popup sign-in on the web', async () => {
    await expect(signInWithGoogle()).resolves.toMatchObject({ uid: 'web-user' })

    expect(mocks.firebaseSignInWithPopup).toHaveBeenCalledWith(mocks.auth, expect.anything())
    expect(mocks.nativeSignInWithGoogle).not.toHaveBeenCalled()
    expect(mocks.firebaseSignInWithCredential).not.toHaveBeenCalled()
  })

  it('keeps native Capacitor Google sign-in on the credential path', async () => {
    mocks.isNativePlatform.mockReturnValue(true)
    mocks.nativeSignInWithGoogle.mockResolvedValue({ credential: { idToken: 'native-id-token' } })
    mocks.firebaseSignInWithCredential.mockResolvedValue({ user: { uid: 'native-user' } })

    await expect(signInWithGoogle()).resolves.toMatchObject({ uid: 'native-user' })

    expect(mocks.nativeSignInWithGoogle).toHaveBeenCalledWith({ skipNativeAuth: true, useCredentialManager: true })
    expect(mocks.credential).toHaveBeenCalledWith('native-id-token')
    expect(mocks.firebaseSignInWithCredential).toHaveBeenCalledWith(mocks.auth, { provider: 'google-credential' })
    expect(mocks.firebaseSignInWithPopup).not.toHaveBeenCalled()
  })
})
