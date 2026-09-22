import { Capacitor } from '@capacitor/core'
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { browserLocalPersistence, browserPopupRedirectResolver, browserSessionPersistence, getAuth, indexedDBLocalPersistence, initializeAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const requiredConfigKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'] as const

export const isFirebaseConfigured = requiredConfigKeys.every((key) => Boolean(firebaseConfig[key]))

let app: FirebaseApp | null = null
let auth: Auth | null = null
let firestore: Firestore | null = null

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null
  if (!app) app = getApps().length ? getApp() : initializeApp(firebaseConfig)
  return app
}

export function getFirebaseAuth(): Auth | null {
  const firebaseApp = getFirebaseApp()
  if (!firebaseApp) return null
  if (auth) return auth
  if (Capacitor.isNativePlatform()) {
    try {
      auth = initializeAuth(firebaseApp, { persistence: indexedDBLocalPersistence })
    } catch {
      auth = getAuth(firebaseApp)
    }
  } else {
    try {
      auth = initializeAuth(firebaseApp, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
        popupRedirectResolver: browserPopupRedirectResolver,
      })
    } catch {
      auth = getAuth(firebaseApp)
    }
  }
  return auth
}

export function getFirebaseFirestore(): Firestore | null {
  const firebaseApp = getFirebaseApp()
  if (!firebaseApp) return null
  if (!firestore) firestore = getFirestore(firebaseApp)
  return firestore
}

export { firebaseConfig }
