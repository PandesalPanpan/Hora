# Iza Time Tracker

A mobile-first working slice of the Adaptive Planner: track and pause activities, plan time, manage lightweight tasks, and review actual time across a URL-backed Capacitor-ready app shell.

## Run locally

Requires Node.js 22 or newer.

```powershell
npm install
npm run dev
```

Open the URL printed by Vite. Activity and session data is kept in the browser's local storage for this first slice.

## Run on Android

The repository includes a Capacitor Android project. Install Android Studio and an Android SDK, then run:

```powershell
npm run android:open
```

That command builds the web app, synchronizes it into `android/`, and opens the native project in Android Studio. Select an emulator or connected device and press Run.

For subsequent command-line runs:

```powershell
npm run android:run
```

To create a debug APK without opening Android Studio:

```powershell
npm run android:apk
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

The native application ID is `com.izatime.tracker`.

### Android updates

Android sideload updates use the public GitHub Releases API for `PandesalPanpan/Hora`. The app checks `releases/latest` in the background on Android, reads the exact `update.json` release asset, compares its numeric `versionCode` with the installed Android version, and downloads the named APK only after the user chooses to update. The current app remains usable when offline or when GitHub is unavailable.

The release and signing contract is documented in [docs/ANDROID_UPDATES.md](docs/ANDROID_UPDATES.md). Before publishing a release, configure the documented GitHub Actions secrets; never commit the release keystore or its passwords.

Once the signing secrets are configured and `gh auth login` has been completed, use `npm run release:doctor` to verify the release connection and `npm run release -- release --version 0.2.0 --version-code 2` to tag and start a signed GitHub release. The command requires a clean `main` worktree.

### Installed development emulator

This development machine has a hardware-accelerated Pixel 8 emulator running Android 16/API 36 with Google Play APIs. Start it with:

```powershell
npm run android:emulator
```

After Android reaches its home screen, install and launch the current app with `npm run android:run`.

## Quality checks

```powershell
npm test
npm run lint
npm run build
```

GitHub Actions runs these checks, plus an Android debug APK build, for pull requests and pushes to `main`. Tagged releases use the separate signed Android release workflow described in [docs/ANDROID_UPDATES.md](docs/ANDROID_UPDATES.md).

## Included now

- Responsive Today screen
- One-tap Study, Code, Exercise, and Reading timers
- Timestamp-based elapsed time (UI ticks are not authoritative)
- Active timer recovery after closing or reloading the page
- Finish-to-log workflow and today's tracked total
- Interactive day/week planner with dynamic date navigation
- Planned-block creation, persistence, and 15-minute resize handles
- Planned, completed, overlapping, and live Timeflow calendar states
- Planned-versus-actual session inspection
- Pause and resume with paused time excluded from actual duration
- URL-backed Timeflow, Tasks, Planner, Reports, and Settings screens
- Reusable Iza character states for timing, guidance, and empty states
- Android safe-area and dynamic-viewport layout behavior
- Unit and component coverage for duration and recovery
- Capacitor Android shell and repeatable build/sync scripts

The remaining product roadmap is in [docs/ADAPTIVE_PLANNER_MASTER_PLAN.md](docs/ADAPTIVE_PLANNER_MASTER_PLAN.md).
