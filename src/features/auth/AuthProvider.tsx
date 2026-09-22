import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { resetToLocalOwner, setCurrentOwnerId, userOwnerId } from '../../lib/ownership'
import { claimUnlinkedLocalData } from './accountScope'
import { AuthContext, type AuthState } from './context'
import {
  clearExplicitSignOut,
  createEmailAccount,
  getPersistedAuthSession,
  isFirebaseConfigured,
  markExplicitSignOut,
  persistAuthUser,
  signInWithEmail,
  signInWithGoogle,
  signOutEverywhere,
  subscribeToFirebaseAuth,
  type AuthUserSnapshot,
} from './service'

async function adoptFirebaseUser(user: import('firebase/auth').User): Promise<AuthUserSnapshot> {
  await claimUnlinkedLocalData(user.uid)
  clearExplicitSignOut()
  const snapshot = persistAuthUser(user)
  setCurrentOwnerId(userOwnerId(user.uid))
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('iza-firebase-user-changed', { detail: user.uid }))
  return snapshot.user
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const persisted = getPersistedAuthSession()
  const initialKnown = persisted && !persisted.explicitlySignedOut ? persisted.user : null
  const initialKnownUid = initialKnown?.uid ?? null
  const [state, setState] = useState<AuthState>({ status: initialKnown ? 'offline-known' : 'loading', user: initialKnown, configured: isFirebaseConfigured })

  useEffect(() => {
    let disposed = false
    const known = getPersistedAuthSession()
    if (known && !known.explicitlySignedOut) setCurrentOwnerId(userOwnerId(known.user.uid))
    else resetToLocalOwner()

    const unsubscribe = subscribeToFirebaseAuth((user) => {
      void (async () => {
        if (disposed) return
        if (user) {
          const next = await adoptFirebaseUser(user)
          if (!disposed) setState({ status: 'authenticated', user: next, configured: isFirebaseConfigured })
          return
        }
        const latest = getPersistedAuthSession()
        if (!disposed && latest && !latest.explicitlySignedOut) {
          setCurrentOwnerId(userOwnerId(latest.user.uid))
          setState({ status: 'offline-known', user: latest.user, configured: isFirebaseConfigured })
        } else if (!disposed) {
          resetToLocalOwner()
          setState({ status: 'signed-out', user: null, configured: isFirebaseConfigured })
        }
        if (!disposed && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('iza-firebase-user-changed', { detail: null }))
      })().catch(() => {
        if (!disposed) setState(current => ({ ...current, status: current.user ? 'offline-known' : 'signed-out' }))
      })
    })
    if (!unsubscribe) {
      setState(current => ({ ...current, status: initialKnownUid ? 'offline-known' : 'signed-out' }))
    }
    return () => { disposed = true; unsubscribe?.() }
  }, [initialKnownUid])

  const signInEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmail(email, password)
  }, [])
  const createAccount = useCallback(async (email: string, password: string) => {
    await createEmailAccount(email, password)
  }, [])
  const signInGoogleAction = useCallback(async () => {
    await signInWithGoogle()
  }, [])
  const signOut = useCallback(async () => {
    markExplicitSignOut()
    await signOutEverywhere()
    resetToLocalOwner()
    setState({ status: 'signed-out', user: null, configured: isFirebaseConfigured })
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('iza-firebase-user-changed', { detail: null }))
  }, [])

  const value = useMemo(() => ({ ...state, signInEmail, createAccount, signInGoogle: signInGoogleAction, signOut }), [state, signInEmail, createAccount, signInGoogleAction, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
