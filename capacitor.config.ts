/// <reference types="@capacitor-firebase/authentication" />

import type { CapacitorConfig } from '@capacitor/cli'
import { loadEnv } from 'vite'

const capacitorEnv = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), 'VITE_')

const config: CapacitorConfig = {
  appId: 'com.izatime.tracker',
  appName: 'Iza Time Tracker',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_hora',
      iconColor: '#D92F6F',
    },
    FirebaseAuthentication: {
      authDomain: capacitorEnv.VITE_FIREBASE_AUTH_DOMAIN,
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
}

export default config
