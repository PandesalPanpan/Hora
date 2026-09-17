export const updateConfig = {
  githubOwner: 'PandesalPanpan',
  githubRepository: 'Hora',
  manifestAssetName: 'update.json',
  applicationId: 'com.izatime.tracker',
  automaticCheckIntervalMs: 6 * 60 * 60 * 1000,
  requestTimeoutMs: 15_000,
} as const

export function latestReleaseUrl(): string {
  return `https://api.github.com/repos/${encodeURIComponent(updateConfig.githubOwner)}/${encodeURIComponent(updateConfig.githubRepository)}/releases/latest`
}
