import { UpdateServiceError } from './types'

export type UpdateManifest = {
  versionCode: number
  versionName: string
  apk: string
  sha256?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function parseUpdateManifest(value: unknown): UpdateManifest {
  if (!isRecord(value)) throw new UpdateServiceError('invalid-manifest', 'The release manifest is not a JSON object.')

  const versionCode = value.versionCode
  const versionName = value.versionName
  const apk = value.apk
  const sha256 = value.sha256

  if (typeof versionCode !== 'number' || !Number.isSafeInteger(versionCode) || versionCode < 1) {
    throw new UpdateServiceError('invalid-manifest', 'The release manifest has an invalid version code.')
  }
  if (typeof versionName !== 'string' || !versionName.trim() || versionName.length > 100) {
    throw new UpdateServiceError('invalid-manifest', 'The release manifest has an invalid version name.')
  }
  if (typeof apk !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,180}\.apk$/i.test(apk)) {
    throw new UpdateServiceError('invalid-manifest', 'The release manifest does not name a safe APK asset.')
  }
  if (sha256 !== undefined && (typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(sha256))) {
    throw new UpdateServiceError('invalid-manifest', 'The release manifest has an invalid SHA-256 checksum.')
  }

  return {
    versionCode,
    versionName: versionName.trim(),
    apk,
    ...(sha256 ? { sha256: sha256.toLowerCase() } : {}),
  }
}
