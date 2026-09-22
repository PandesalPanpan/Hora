import { Capacitor } from '@capacitor/core'
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
  type Unsubscribe,
} from 'firebase/auth'
import { getFirebaseAuth, isFirebaseConfigured } from '../../lib/firebase'

export type AuthUserSnapshot = {
  uid: string
  displayName: string | null
  email: string | null
  photoURL: string | null
  providerIds: string[]
}

export type PersistedAuthSession = {
  user: AuthUserSnapshot
  explicitlySignedOut: boolean
  savedAt: string
}

const AUTH_SESSION_KEY = 'iza.auth-session.v1'

function userSnapshot(user: User): AuthUserSnapshot {
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
    providerIds: user.providerData.map(provider => provider.providerId),
  }
}

export function getPersistedAuthSession(): PersistedAuthSession | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) ?? '') as Partial<PersistedAuthSession>
    if (!parsed.user || typeof parsed.user.uid !== 'string') return null
    return {
      user: {
        uid: parsed.user.uid,
        displayName: parsed.user.displayName ?? null,
        email: parsed.user.email ?? null,
        photoURL: parsed.user.photoURL ?? null,
        providerIds: Array.isArray(parsed.user.providerIds) ? parsed.user.providerIds.filter((value): value is string => typeof value === 'string') : [],
      },
      explicitlySignedOut: parsed.explicitlySignedOut === true,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function persistAuthUser(user: User): PersistedAuthSession {
  const session: PersistedAuthSession = { user: userSnapshot(user), explicitlySignedOut: false, savedAt: new Date().toISOString() }
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session))
  return session
}

export function markExplicitSignOut(): void {
  const previous = getPersistedAuthSession()
  if (previous) localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ ...previous, explicitlySignedOut: true, savedAt: new Date().toISOString() }))
  else localStorage.removeItem(AUTH_SESSION_KEY)
}

export function clearExplicitSignOut(): void {
  const previous = getPersistedAuthSession()
  if (previous) localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ ...previous, explicitlySignedOut: false, savedAt: new Date().toISOString() }))
}

export function subscribeToFirebaseAuth(listener: (user: User | null) => void): Unsubscribe | null {
  const auth = getFirebaseAuth()
  return auth ? onAuthStateChanged(auth, listener) : null
}

function authUnavailable(): Error {
  return new Error('Cloud sign-in is not configured on this build yet.')
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const auth = getFirebaseAuth()
  if (!auth) throw authUnavailable()
  return (await signInWithEmailAndPassword(auth, email.trim(), password)).user
}

export async function createEmailAccount(email: string, password: string): Promise<User> {
  const auth = getFirebaseAuth()
  if (!auth) throw authUnavailable()
  return (await createUserWithEmailAndPassword(auth, email.trim(), password)).user
}

export async function signInWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth()
  if (!auth) throw authUnavailable()

  if (Capacitor.isNativePlatform()) {
    const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true, useCredentialManager: true })
    const idToken = result.credential?.idToken
    if (!idToken) throw new Error('Google sign-in did not return a Firebase credential.')
    return (await signInWithCredential(auth, GoogleAuthProvider.credential(idToken))).user
  }

  return (await signInWithPopup(auth, new GoogleAuthProvider())).user
}

export async function signOutEverywhere(): Promise<void> {
  const auth = getFirebaseAuth()
  markExplicitSignOut()
  if (Capacitor.isNativePlatform()) await FirebaseAuthentication.signOut().catch(() => undefined)
  if (auth) await firebaseSignOut(auth)
}

export function describeAuthError(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : ''
  switch (code) {
    case 'auth/invalid-email': return 'Enter a valid email address.'
    case 'auth/missing-password': return 'Enter your password.'
    case 'auth/weak-password': return 'Use a password with at least six characters.'
    case 'auth/email-already-in-use': return 'That email already has an account. Try signing in instead.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'That email or password does not match.'
    case 'auth/popup-closed-by-user': return 'Google sign-in was closed before it finished.'
    case 'auth/popup-blocked': return 'Your browser blocked the Google sign-in window. Allow pop-ups and try again.'
    case 'auth/network-request-failed': return 'The internet connection failed. Your local data is still safe.'
    case 'auth/too-many-requests': return 'Too many attempts. Wait a little and try again.'
    case 'auth/operation-not-allowed': return 'This sign-in method is not enabled in Firebase yet.'
    default: return error instanceof Error && error.message ? error.message : 'Sign-in could not be completed. Try again.'
  }
}

export const authStorageKeys = { AUTH_SESSION_KEY }
export { isFirebaseConfigured }
