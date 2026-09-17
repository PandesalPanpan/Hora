export type AppVersion = {
  versionCode: number
  versionName: string
}

export type UpdateInfo = {
  versionCode: number
  versionName: string
  releaseNotes: string
  releaseName: string
  releaseUrl: string
  publishedAt?: string
  apkFileName: string
  apkUrl: string
  checksumSha256?: string
}

export type UpdateCheckResult = {
  installed: AppVersion
  update: UpdateInfo | null
  checkedAt: number
  skipped: boolean
}

export type UpdateErrorCode =
  | 'network'
  | 'github'
  | 'metadata'
  | 'invalid-manifest'
  | 'invalid-apk'
  | 'checksum'
  | 'download'
  | 'install-permission'
  | 'unsupported'

export class UpdateServiceError extends Error {
  constructor(public readonly code: UpdateErrorCode, message: string) {
    super(message)
    this.name = 'UpdateServiceError'
  }
}
