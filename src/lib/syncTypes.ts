/** Metadata shared by records that can be synchronized to cloud storage. */
export type SyncMetadata = {
  ownerId?: string
  createdAt?: string
  updatedAt?: string
  deletedAt?: string | null
  deviceId?: string
  syncSchemaVersion?: number
}
