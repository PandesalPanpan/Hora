import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Capacitor } from '@capacitor/core'
import { updateConfig, latestReleaseUrl } from './config'
import { checkForUpdate, compareVersionCodes, fetchLatestRelease, getLastUpdateCheckAt, isAutomaticUpdateCheckDue } from './repository'

const releaseUrl = 'https://github.com/PandesalPanpan/Hora/releases/tag/v0.2.0'
const manifestUrl = 'https://github.com/PandesalPanpan/Hora/releases/download/v0.2.0/update.json'
const apkUrl = 'https://github.com/PandesalPanpan/Hora/releases/download/v0.2.0/app-release.apk'

function response(body: unknown, url: string, status = 200) {
  return { ok: status >= 200 && status < 300, status, url, text: async () => typeof body === 'string' ? body : JSON.stringify(body) } as unknown as Response
}

function mockRelease(versionCode: number, versionName = '0.2.0') {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === latestReleaseUrl()) return response({
      tag_name: `v${versionName}`,
      name: `Iza ${versionName}`,
      body: '- A softer update flow',
      html_url: releaseUrl,
      published_at: '2026-09-17T00:00:00Z',
      assets: [
        { name: updateConfig.manifestAssetName, browser_download_url: manifestUrl, content_type: 'application/json' },
        { name: 'app-release.apk', browser_download_url: apkUrl, content_type: 'application/vnd.android.package-archive' },
      ],
    }, latestReleaseUrl())
    return response({ versionCode, versionName, apk: 'app-release.apk', sha256: 'a'.repeat(64) }, manifestUrl)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('update repository', () => {
  beforeEach(() => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('web')
  })

  it('compares only numeric Android version codes', () => {
    expect(compareVersionCodes(14, 15)).toBe(1)
    expect(compareVersionCodes(15, 15)).toBe(0)
    expect(compareVersionCodes(16, 15)).toBe(-1)
  })

  it('reports the same remote version as up to date', async () => {
    mockRelease(1, '0.1.0')
    const result = await checkForUpdate({ force: true, now: 1000, installed: { versionCode: 1, versionName: '0.1.0' } })
    expect(result.update).toBeNull()
    expect(result.skipped).toBe(false)
  })

  it('does not offer a lower remote version', async () => {
    mockRelease(1, '0.1.0')
    const result = await checkForUpdate({ force: true, now: 1000, installed: { versionCode: 2, versionName: '0.2.0' } })
    expect(result.update).toBeNull()
  })

  it('returns a higher release with its notes, asset and checksum', async () => {
    const fetchMock = mockRelease(2)
    const result = await checkForUpdate({ force: true, now: 1000, installed: { versionCode: 1, versionName: '0.1.0' } })
    expect(result.update).toMatchObject({
      versionCode: 2,
      versionName: '0.2.0',
      releaseNotes: '- A softer update flow',
      apkFileName: 'app-release.apk',
      apkUrl,
      checksumSha256: 'a'.repeat(64),
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('caches automatic checks for the configured interval', async () => {
    const fetchMock = mockRelease(2)
    await checkForUpdate({ force: true, now: 10_000, installed: { versionCode: 1, versionName: '0.1.0' } })
    fetchMock.mockClear()
    const result = await checkForUpdate({ now: 10_000 + updateConfig.automaticCheckIntervalMs - 1, installed: { versionCode: 1, versionName: '0.1.0' } })
    expect(result.skipped).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await getLastUpdateCheckAt()).toBe(10_000)
    expect(await isAutomaticUpdateCheckDue(10_000 + updateConfig.automaticCheckIntervalMs - 1)).toBe(false)
    expect(await isAutomaticUpdateCheckDue(10_000 + updateConfig.automaticCheckIntervalMs)).toBe(true)
  })

  it('does not throttle a failed check', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    await expect(checkForUpdate({ force: true, now: 1000, installed: { versionCode: 1, versionName: '0.1.0' } })).rejects.toThrow('GitHub could not be reached')
    expect(await getLastUpdateCheckAt()).toBeNull()
  })

  it('rejects a release whose APK URL is not HTTPS', async () => {
    mockRelease(2)
    vi.mocked(fetch).mockImplementationOnce(async () => response({
      tag_name: 'v0.2.0',
      assets: [
        { name: 'update.json', browser_download_url: manifestUrl },
        { name: 'app-release.apk', browser_download_url: 'http://example.com/app-release.apk' },
      ],
    }, latestReleaseUrl())).mockImplementationOnce(async () => response({ versionCode: 2, versionName: '0.2.0', apk: 'app-release.apk' }, manifestUrl))
    await expect(fetchLatestRelease()).rejects.toThrow('must use HTTPS')
  })

  it('fails when a release manifest is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ tag_name: 'v0.2.0', assets: [] }, latestReleaseUrl())))
    await expect(fetchLatestRelease()).rejects.toThrow('update manifest')
  })
})
