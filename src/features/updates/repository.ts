import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { db } from '../../lib/db'
import { currentVersion, currentVersionCode } from '../releases/changelog'
import { updateConfig, latestReleaseUrl } from './config'
import { parseUpdateManifest } from './manifest'
import { AppUpdate, type NativeDownloadProgress, type NativeDownloadResult } from './native'
import type { AppVersion, UpdateCheckResult, UpdateInfo } from './types'
import { UpdateServiceError } from './types'

const LAST_CHECK_META_KEY = 'updates:last-check-at'

type GitHubAsset = {
  name: string
  browser_download_url: string
  content_type?: string
}

type GitHubRelease = {
  tag_name: string
  name?: string | null
  body?: string | null
  html_url?: string | null
  published_at?: string | null
  assets: GitHubAsset[]
}

function isAndroidPlatform(): boolean {
  return Capacitor.getPlatform() === 'android'
}

function assertHttpsUrl(value: string, label: string): URL {
  let parsed: URL
  try { parsed = new URL(value) } catch { throw new UpdateServiceError('metadata', `${label} is not a valid URL.`) }
  if (parsed.protocol !== 'https:') throw new UpdateServiceError('metadata', `${label} must use HTTPS.`)
  return parsed
}

function githubError(status: number): UpdateServiceError {
  if (status === 404) return new UpdateServiceError('github', 'No published GitHub release is available yet.')
  if (status === 403 || status === 429) return new UpdateServiceError('github', 'GitHub temporarily limited update checks. Try again later.')
  return new UpdateServiceError('github', `GitHub could not provide the release information (HTTP ${status}).`)
}

async function requestText(url: string, accept: string): Promise<string> {
  assertHttpsUrl(url, 'Update URL')

  if (isAndroidPlatform()) {
    try {
      const response = await CapacitorHttp.get({
        url,
        headers: { Accept: accept, 'User-Agent': 'Iza-Time-Tracker-Updater' },
        responseType: 'text',
        connectTimeout: updateConfig.requestTimeoutMs,
        readTimeout: updateConfig.requestTimeoutMs,
      })
      if (response.status < 200 || response.status >= 300) throw githubError(response.status)
      if (response.url) assertHttpsUrl(response.url, 'Update response URL')
      return typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
    } catch (error) {
      if (error instanceof UpdateServiceError) throw error
      throw new UpdateServiceError('network', 'GitHub could not be reached.')
    }
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), updateConfig.requestTimeoutMs)
  try {
    const response = await fetch(url, {
      headers: { Accept: accept, 'User-Agent': 'Iza-Time-Tracker-Updater' },
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) throw githubError(response.status)
    assertHttpsUrl(response.url || url, 'Update response URL')
    return await response.text()
  } catch (error) {
    if (error instanceof UpdateServiceError) throw error
    throw new UpdateServiceError('network', error instanceof DOMException && error.name === 'AbortError' ? 'The update check timed out.' : 'GitHub could not be reached.')
  } finally {
    window.clearTimeout(timeout)
  }
}

function parseRelease(value: unknown): GitHubRelease {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new UpdateServiceError('github', 'GitHub returned an unexpected release response.')
  const candidate = value as Record<string, unknown>
  if (typeof candidate.tag_name !== 'string' || !Array.isArray(candidate.assets)) throw new UpdateServiceError('github', 'GitHub returned incomplete release information.')

  const assets = candidate.assets.flatMap((asset): GitHubAsset[] => {
    if (!asset || typeof asset !== 'object' || Array.isArray(asset)) return []
    const item = asset as Record<string, unknown>
    if (typeof item.name !== 'string' || typeof item.browser_download_url !== 'string') return []
    return [{ name: item.name, browser_download_url: item.browser_download_url, content_type: typeof item.content_type === 'string' ? item.content_type : undefined }]
  })
  return {
    tag_name: candidate.tag_name,
    name: typeof candidate.name === 'string' ? candidate.name : null,
    body: typeof candidate.body === 'string' ? candidate.body : null,
    html_url: typeof candidate.html_url === 'string' ? candidate.html_url : null,
    published_at: typeof candidate.published_at === 'string' ? candidate.published_at : null,
    assets,
  }
}

function parseJson(text: string, label: string): unknown {
  try { return JSON.parse(text) as unknown } catch { throw new UpdateServiceError('metadata', `${label} is not valid JSON.`) }
}

function findAsset(release: GitHubRelease, name: string, label: string): GitHubAsset {
  const asset = release.assets.find((candidate) => candidate.name === name)
  if (!asset) throw new UpdateServiceError('metadata', `The release does not contain ${label} asset ${name}.`)
  assertHttpsUrl(asset.browser_download_url, `${label} download URL`)
  return asset
}

function releasePageUrl(release: GitHubRelease): string {
  if (release.html_url) {
    try {
      const parsed = new URL(release.html_url)
      if (parsed.protocol === 'https:' && parsed.hostname === 'github.com') return release.html_url
    } catch { /* use the predictable repository URL below */ }
  }
  return `https://github.com/${updateConfig.githubOwner}/${updateConfig.githubRepository}/releases/tag/${encodeURIComponent(release.tag_name)}`
}

export function compareVersionCodes(installed: number, remote: number): -1 | 0 | 1 {
  if (remote > installed) return 1
  if (remote < installed) return -1
  return 0
}

export async function getInstalledVersion(): Promise<AppVersion> {
  if (!isAndroidPlatform()) return { versionCode: currentVersionCode, versionName: currentVersion }
  try {
    const info = await CapacitorApp.getInfo()
    const versionCode = Number(info.build)
    if (!Number.isSafeInteger(versionCode) || versionCode < 1) throw new Error('invalid version code')
    return { versionCode, versionName: info.version }
  } catch {
    throw new UpdateServiceError('metadata', 'The installed Android version could not be read.')
  }
}

export async function fetchLatestRelease(): Promise<UpdateInfo> {
  const release = parseRelease(parseJson(await requestText(latestReleaseUrl(), 'application/vnd.github+json'), 'GitHub release response'))
  const manifestAsset = findAsset(release, updateConfig.manifestAssetName, 'update manifest')
  const manifest = parseUpdateManifest(parseJson(await requestText(manifestAsset.browser_download_url, 'application/json'), 'Update manifest'))
  const apkAsset = findAsset(release, manifest.apk, 'APK')
  return {
    versionCode: manifest.versionCode,
    versionName: manifest.versionName,
    releaseNotes: release.body?.trim() ?? '',
    releaseName: release.name?.trim() || release.tag_name,
    releaseUrl: releasePageUrl(release),
    ...(release.published_at ? { publishedAt: release.published_at } : {}),
    apkFileName: apkAsset.name,
    apkUrl: apkAsset.browser_download_url,
    ...(manifest.sha256 ? { checksumSha256: manifest.sha256 } : {}),
  }
}

export async function getLastUpdateCheckAt(): Promise<number | null> {
  const record = await db.meta.get(LAST_CHECK_META_KEY)
  const timestamp = record ? Number(record.value) : NaN
  return Number.isFinite(timestamp) ? timestamp : null
}

export async function isAutomaticUpdateCheckDue(now = Date.now()): Promise<boolean> {
  const lastCheckAt = await getLastUpdateCheckAt()
  return lastCheckAt === null || now - lastCheckAt >= updateConfig.automaticCheckIntervalMs
}

export async function checkForUpdate(options: { force?: boolean; now?: number; installed?: AppVersion } = {}): Promise<UpdateCheckResult> {
  const now = options.now ?? Date.now()
  const installed = options.installed ?? await getInstalledVersion()
  const due = options.force || await isAutomaticUpdateCheckDue(now)
  if (!due) {
    return { installed, update: null, checkedAt: (await getLastUpdateCheckAt()) ?? now, skipped: true }
  }

  const remote = await fetchLatestRelease()
  await db.meta.put({ key: LAST_CHECK_META_KEY, value: String(now) })
  return { installed, update: compareVersionCodes(installed.versionCode, remote.versionCode) > 0 ? remote : null, checkedAt: now, skipped: false }
}

function nativeErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : undefined
}

function normalizeNativeError(error: unknown): UpdateServiceError {
  if (error instanceof UpdateServiceError) return error
  const code = nativeErrorCode(error)
  const message = error instanceof Error ? error.message : 'The Android update could not be completed.'
  if (code === 'INSTALL_PERMISSION_REQUIRED') return new UpdateServiceError('install-permission', 'Allow Iza to install unknown apps, then try again.')
  if (code === 'CHECKSUM_MISMATCH') return new UpdateServiceError('checksum', 'The downloaded update failed its checksum verification.')
  if (code === 'INVALID_APK') return new UpdateServiceError('invalid-apk', 'The downloaded file was not a valid Iza update.')
  if (code === 'DOWNLOAD_FAILED') return new UpdateServiceError('download', message)
  return new UpdateServiceError('download', message)
}

export async function downloadUpdate(update: UpdateInfo, onProgress: (progress: NativeDownloadProgress) => void): Promise<NativeDownloadResult> {
  if (!isAndroidPlatform()) throw new UpdateServiceError('unsupported', 'APK installation is available in the Android app.')
  try {
    const listener = await AppUpdate.addListener('downloadProgress', onProgress)
    try {
      return await AppUpdate.downloadApk({
        url: update.apkUrl,
        fileName: update.apkFileName,
        ...(update.checksumSha256 ? { expectedSha256: update.checksumSha256 } : {}),
        expectedPackageId: updateConfig.applicationId,
        expectedVersionCode: update.versionCode,
      })
    } finally {
      await listener.remove()
    }
  } catch (error) {
    throw normalizeNativeError(error)
  }
}

export async function installDownloadedUpdate(update: UpdateInfo): Promise<'started' | 'permission-required'> {
  if (!isAndroidPlatform()) throw new UpdateServiceError('unsupported', 'APK installation is available in the Android app.')
  try {
    const permission = await AppUpdate.canInstallPackages()
    if (!permission.canInstall) return 'permission-required'
    await AppUpdate.installApk({ fileName: update.apkFileName, expectedPackageId: updateConfig.applicationId, expectedVersionCode: update.versionCode })
    return 'started'
  } catch (error) {
    const normalized = normalizeNativeError(error)
    if (normalized.code === 'install-permission') return 'permission-required'
    throw normalized
  }
}

export async function openInstallSettings(): Promise<void> {
  if (!isAndroidPlatform()) throw new UpdateServiceError('unsupported', 'Android install settings are unavailable here.')
  try { await AppUpdate.openInstallSettings() } catch (error) { throw normalizeNativeError(error) }
}
