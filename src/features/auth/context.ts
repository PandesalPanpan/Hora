import { createContext, useContext } from 'react'
import type { AuthUserSnapshot } from './service'
import { isFirebaseConfigured } from './service'

export type AuthStatus = 'loading' | 'signed-out' | 'authenticated' | 'offline-known'

export type AuthState = {
  status: AuthStatus
  user: AuthUserSnapshot | null
  configured: boolean
}

export type AuthContextValue = AuthState & {
  signInEmail: (email: string, password: string) => Promise<void>
  createAccount: (email: string, password: string) => Promise<void>
  signInGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

export const fallbackAuth: AuthContextValue = {
  status: 'signed-out',
  user: null,
  configured: isFirebaseConfigured,
  signInEmail: async () => { throw new Error('Sign-in is not available here.') },
  createAccount: async () => { throw new Error('Sign-in is not available here.') },
  signInGoogle: async () => { throw new Error('Sign-in is not available here.') },
  signOut: async () => undefined,
}

export const AuthContext = createContext<AuthContextValue>(fallbackAuth)

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}

export function authStatusLabel(state: Pick<AuthState, 'status' | 'user'>): string {
  if (state.status === 'authenticated') return state.user?.displayName || state.user?.email || 'Signed in'
  if (state.status === 'offline-known') return 'Using local data offline'
  if (state.status === 'loading') return 'Checking sign-in'
  return 'Not signed in'
}
