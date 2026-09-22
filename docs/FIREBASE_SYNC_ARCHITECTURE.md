# Hora Firebase and offline-first architecture

Status: implemented in the web client; Firebase Console and Android OAuth registration remain deployment steps.

## Discovery snapshot

Hora is a React 19 + TypeScript + Vite application packaged for Android with Capacitor 8. The route shell is URL-backed through the hash, and the existing UI is local-first: pages read from Dexie live queries and the timer writes a local recovery mirror immediately.

The current durable local database is `iza-time-tracker` in `src/lib/db.ts`:

| Table | Product ownership | Current use |
| --- | --- | --- |
| `sessions` | user-owned | Running, paused, and completed Timeflow sessions. The active session is reconstructed from timestamps; UI intervals only refresh the display. |
| `plannedBlocks` | user-owned | Planned calendar blocks, including recurrence and reminder metadata. |
| `tasks` | user-owned | Open and completed tasks with ordering and optional estimates. |
| `activities` | user-owned | Built-in and custom activity presets, including archived custom presets. |
| `meta` | device-local | Migration markers, update-check metadata, and other local control state. It is never synchronized. |

Database versions 1 through 4 preserve the original localStorage data, add planner/task/activity indexes, and backfill task title snapshots into historical sessions. The migration must remain additive; it must not clear existing records.

The legacy localStorage keys remain a small compatibility mirror for active/completed sessions, planner blocks, and tasks. IndexedDB is the queryable source of truth. Native Android timer continuity is separately stored by the existing `TimerNotification` bridge and must not be replaced by cloud state.

Direct local writes currently exist in `localStore`, the task page, the planner page, the activity repository, backup restore, and the legacy migration. Reads are mostly Dexie live queries. The sync boundary therefore belongs beside Dexie: local writes gain ownership/version metadata and create a durable outbox entry in the same IndexedDB transaction; UI code continues to read local records.

## Firebase data model

Cloud records are isolated below the authenticated UID:

```text
users/{uid}/tasks/{id}
users/{uid}/sessions/{id}
users/{uid}/plannedBlocks/{id}
users/{uid}/activities/{id}
```

Each document has a small cloud envelope rather than exposing the Dexie representation as a permanent API. `ownerId` is the Firebase UID in Firestore; the local Dexie namespace remains `user:{uid}` so local and cloud ownership cannot be confused:

```text
{
  schemaVersion: 1,
  recordType: "tasks" | "sessions" | "plannedBlocks" | "activities",
  id,
  ownerId: uid,
  deviceId,
  createdAt,
  updatedAt,
  deletedAt,
  payload
}
```

`payload` is produced by an explicit serializer and is read through a matching deserializer. Timestamps are UTC ISO strings. Firebase configuration is read from Vite environment variables; no service-account credential or private key is shipped to the client.

## Ownership and offline authentication

Each local user-owned record has an `ownerId`:

- `local:{installationId}` for unlinked local data;
- `user:{firebaseUid}` after the data is linked to an account.

The first successful account sign-in on a device may claim existing unlinked local records so an established offline-first user does not lose their history. Once an account has been linked, a later account does not automatically claim any anonymous local records. Account A's records remain hidden when account B is active. Explicit logout leaves local account data intact and disables cloud sync; it does not destroy the local database.

The app stores a minimal last-known auth snapshot locally. If Firebase cannot refresh while offline, a previously authenticated user remains in `known offline user` mode and sees only that account's local records. Firestore operations wait until a real Firebase user is available. A new installation with no stored auth snapshot stays signed out and explains that first sign-in needs connectivity.

## Sync and conflict rules

Local mutations are authoritative for immediate UI behavior. They create or update one coalesced outbox row per `(localOwnerId, recordType, id)`. The row survives reload, app close, Android process death, and network failure.

Uploads use idempotent `setDoc` calls with deterministic document IDs. Before an upload, the engine compares the local envelope with the remote envelope. Record-level last-write-wins uses `(updatedAt, deviceId)` as the deterministic version key. A newer remote document is applied locally and retires the stale outbox row; a newer local document replaces the remote document. Equal versions are treated as already synchronized.

Tasks, planned blocks, activities, and completed sessions use this ordinary record-level rule. Active sessions use the same rule with an explicit invariant: one active logical session is shown per account, and the newest transition wins if two devices changed active state offline. The timer never writes per-second ticks to Firebase; start, pause, resume, phase transition, finish, edit, and cancel are the meaningful persisted transitions.

Deletes use tombstones. A local delete removes the record from the visible table, retains a durable tombstone, and queues a cloud document with `deletedAt`; the tombstone is not immediately hard-deleted from Firestore. A stale remote record cannot resurrect a tombstoned record. Restoring the same ID writes a newer live envelope and clears the local tombstone.

Remote snapshots are merged into Dexie by the sync engine. UI components never depend directly on Firestore snapshots. The settings card exposes whether the app is local-only, offline-known, syncing, pending, synced, or retryable-error.

## Local-only data

The following remain local and are deliberately excluded from cloud synchronization:

- Dexie `meta` records and sync bookkeeping;
- installation ID and last-known auth/offline snapshot;
- native Android timer continuity records and notification schedules;
- update-manager check/install metadata;
- transient UI state and browser caches.

## Lifecycle

Sync starts after a real Firebase auth state is available, and is attempted at startup, successful login, foreground/resume, the browser `online` signal, after local mutations, and from a manual retry. The `online` signal is only a hint; every Firestore operation still handles server failures and uses bounded exponential backoff.

## Android status

The repository application ID is `com.izatime.tracker`. The current debug signing report is:

- SHA-1: `AF:B1:F2:57:03:06:2F:40:4C:9C:AE:9D:C9:53:3B:1B:6B:AD:68:DA`
- SHA-256: `03:A0:93:67:FA:F2:3B:CB:25:4E:AA:C5:60:3A:CD:53:89:E6:30:55:23:0F:30:88:D0:55:43:4E:F4:56:DF:01`

The `v0.2.0` release APK established the release signing identity used by the updater:

- SHA-1: `25:7C:06:34:BD:A0:99:55:CB:55:9C:9C:CE:2B:96:0F:56:E5:C2:12`
- SHA-256: `12:4D:13:CA:B0:10:E0:0F:37:8F:CE:01:19:9C:6E:66:A1:39:C8:CF:FF:2D:84:0C:C4:AE:D1:E1:BA:51:5E:69`

The native Google provider uses the maintained Capacitor Firebase Authentication plugin. `android/app/google-services.json` is the real Firebase Android client configuration for project `hora-9e650` and package `com.izatime.tracker`; it is intentionally tracked because Firebase client configuration is public app metadata required by the native build. It contains no service-account credential. The release SHA-1 and SHA-256 must remain registered on the Firebase Android app for Google sign-in to work in release builds.

## Deployment checklist

1. Copy `.env.example` to `.env` for the `hora-9e650` web app values. The release and CI workflows do this automatically.
2. In Firebase Authentication, enable Google and email/password providers and register the web app and Android app (`com.izatime.tracker`).
3. Add the debug and release fingerprints above to the registered Android app.
4. Keep the downloaded Android client configuration at `android/app/google-services.json`; it is tracked because it is public client metadata. Never add service-account keys, signing keys, or passwords.
5. Create the Firestore database, deploy `firebase.json`/`firestore.rules`, and verify an authenticated user can write only under their own UID.

The Firebase web config is not a service credential. `.env` remains ignored, while `.env.example` supplies the public client values needed by reproducible CI/release builds. A build with missing Firebase values remains fully usable in local-only mode.
