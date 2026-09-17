import type { PluginListenerHandle } from '@capacitor/core'
import { registerPlugin } from '@capacitor/core'

export type NativeDownloadProgress = {
  bytesDownloaded: number
  totalBytes: number
  percent: number
}

export type NativeDownloadOptions = {
  url: string
  fileName: string
  expectedSha256?: string
  expectedPackageId: string
  expectedVersionCode: number
}

export type NativeDownloadResult = {
  fileName: string
  bytes: number
  sha256: string
}

export type NativeInstallOptions = {
  fileName: string
  expectedPackageId: string
  expectedVersionCode: number
}

export interface AppUpdatePlugin {
  downloadApk(options: NativeDownloadOptions): Promise<NativeDownloadResult>
  canInstallPackages(): Promise<{ canInstall: boolean }>
  openInstallSettings(): Promise<void>
  installApk(options: NativeInstallOptions): Promise<void>
  addListener(eventName: 'downloadProgress', listenerFunc: (progress: NativeDownloadProgress) => void): Promise<PluginListenerHandle>
}

export const AppUpdate = registerPlugin<AppUpdatePlugin>('AppUpdate')
