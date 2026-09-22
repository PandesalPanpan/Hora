# Android updates and release publishing

Iza is distributed as a sideloaded APK, so updates use GitHub Releases rather than Google Play APIs.

## Release metadata contract

The update source is configured in `src/features/updates/config.ts`:

- owner: `PandesalPanpan`
- repository: `Hora`
- API endpoint: `https://api.github.com/repos/PandesalPanpan/Hora/releases/latest`

Every published release must attach these two assets:

1. `app-release.apk` — the signed APK.
2. `update.json` — a manifest whose `apk` value exactly matches the APK asset name.

The manifest format is:

```json
{
  "versionCode": 4,
  "versionName": "0.2.0",
  "apk": "app-release.apk",
  "sha256": "<64 lowercase hexadecimal characters>"
}
```

`package.json` is the canonical version source. Increase both `version` and `androidVersionCode` for a release, with `androidVersionCode` always increasing. Release dates and version-name string ordering are not used for update decisions. Release tags are human-facing and must match `v<package.json version>`; the tag is not the version comparison source.

The `scripts/create-update-manifest.mjs` script generates the manifest from `package.json` and a calculated SHA-256 value. The checked-in workflow uses it for every release.

## App behavior

On Android, the app performs a delayed asynchronous check when the device is online. Successful automatic checks are cached for six hours in the existing Dexie metadata table. A failed background check is silent and is not throttled, so a later network transition can retry it; it cannot prevent the app from launching or being used offline. Settings → About Iza → Check for updates always forces a fresh check.

An available update appears as an inline card near the top of the existing shell. It includes the current and available versions, expandable GitHub release notes, Later, and Update now. Later suppresses that version for the current session. The manual check can show an up-to-date or recoverable error message in Settings.

The Android-only native plugin streams the APK to `cache/updates/`, reports progress, verifies the SHA-256 checksum when present, verifies the APK archive and package ID/version code, and removes incomplete temporary files. Installation uses the existing AndroidX FileProvider and a `content://` URI; no deprecated `file://` URI is used. Android presents its normal confirmation UI. If the app is not allowed to install unknown apps, the UI opens the app-specific Android setting so the user can grant that permission and retry.

The updater accepts HTTPS metadata/download URLs, requires the exact manifest/APK asset names, does not open arbitrary downloaded files, and rejects APKs that do not match `com.izatime.tracker` or the manifest version code. Android itself additionally enforces the signing-certificate match during replacement.

## Signing requirement

Every future release APK must use all three of these properties:

- application/package ID: `com.izatime.tracker`
- a higher `androidVersionCode`
- the same signing certificate/keystore as the installed release

If any of these changes, Android will not treat the APK as an update. The updater does not and cannot bypass Android's signing check. Updating preserves the existing app data because the package ID remains the same; uninstalling is not part of this flow.

No signing secret or keystore belongs in source control. This repository did not previously contain a release signing configuration, so `android/app/build.gradle` now reads the signing values only from environment variables (or local Gradle properties):

- `ANDROID_KEYSTORE_PATH`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Without those values, local `assembleRelease` intentionally produces an unsigned APK. That is useful for build verification but must not be published as an update.

## GitHub Actions

`.github/workflows/ci.yml` is the continuous-integration workflow. It runs for pull requests targeting `main` and pushes to `main`, then executes the web tests, lint, production build, Capacitor synchronization, and Android debug APK build.

`.github/workflows/android-release.yml` runs for a `v*` tag or manual dispatch. It:

1. validates the tag against `package.json`;
2. builds and synchronizes the web app;
3. decodes the keystore into the runner's temporary directory;
4. builds the signed release APK;
5. calculates SHA-256 and generates `update.json`;
6. verifies the APK with `apksigner`; and
7. creates the GitHub Release with both assets.

Configure these GitHub Actions Secrets before using the workflow:

- `ANDROID_KEYSTORE_BASE64` — base64-encoded PKCS12/JKS release keystore;
- `ANDROID_KEYSTORE_PASSWORD`;
- `ANDROID_KEY_ALIAS`; and
- `ANDROID_KEY_PASSWORD`.

For the generated PKCS12 keystore used for this setup, the store password and key password are the same. A different keystore must use that keystore's own password values.

The workflow uses the automatically provided `GITHUB_TOKEN` only to publish the release. The repository is public, so no GitHub personal access token is embedded in the APK or needed for update checks. If the repository becomes private, do not put a PAT in the application. Replace the source with a secure backend or public, authenticated update manifest designed for that deployment.

The first release must be published before `releases/latest` can return update metadata. A debug APK installed during development is signed with the Android debug key and cannot be upgraded in place by the generated release keystore; uninstall the debug build (after backing up data if needed) before installing the first release build.

## Release CLI

The repository includes a guarded GitHub CLI wrapper. Authenticate once with a token that can push to the repository and read Actions secrets:

```powershell
gh auth login --web --git-protocol https
npm run release:doctor
```

`release:doctor` verifies GitHub authentication, the target repository, and all four signing secrets without printing their values. After the release changes are committed to `main`, cut a release with:

```powershell
# First release from the current package metadata:
npm run release -- release --initial --dry-run
npm run release -- release --initial

# This release:
npm run release -- release --version 0.3.0 --version-code 5 --dry-run
npm run release -- release --version 0.3.0 --version-code 5
```

The command requires a clean `main` worktree, checks that the version code is higher than the current one, runs tests/lint/web build, updates `package.json` and `package-lock.json`, creates the matching annotated tag, and pushes the commit and tag. The tag starts `.github/workflows/android-release.yml`; it does not upload an unsigned local APK. Do not use `--allow-dirty` or bypass the checks: release only after the intended product changes are committed.

## Generated local signing key

A release keystore was generated outside this repository for the initial setup. Keep it backed up securely, convert/copy it to the CI secret `ANDROID_KEYSTORE_BASE64`, and store its passwords in GitHub Actions Secrets or a local secret manager. Do not move it into `android/`, commit it, or put the passwords in Gradle files.
