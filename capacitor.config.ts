import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.izatime.tracker',
  appName: 'Iza Time Tracker',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_hora',
      iconColor: '#D92F6F',
    },
  },
}

export default config
