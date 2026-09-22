import packageMetadata from '../../../package.json'

export type ReleaseNote = {
  version: string
  date: string
  title: string
  summary: string
  changes: string[]
}

export const currentVersion = packageMetadata.version
export const currentVersionCode = packageMetadata.androidVersionCode

export const releaseNotes: ReleaseNote[] = [
  {
    version: '0.3.1',
    date: '2026-09-22',
    title: 'Google sign-in on Android',
    summary: 'The Android release now includes Firebase configuration for the published signing certificate.',
    changes: [
      'Updated the Android Firebase client configuration with the release signing certificate used by Hora updates.',
      'Kept the existing authentication and offline-first Firestore sync behavior unchanged.',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-09-22',
    title: 'Your time, wherever you are',
    summary: 'Firebase accounts and offline-first sync keep your Hora data available across devices.',
    changes: [
      'Sign in with Google or email and password from Settings.',
      'Keep tracking, planning, and editing locally when you are offline; changes wait safely for a connection.',
      'Sync activities, sessions, planned blocks, and tasks across devices after reconnecting.',
      'See whether your account is signed in, known offline, syncing, waiting, or retrying.',
      'Account ownership keeps one person’s local and cloud data separate from another account on the same device.',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-09-21',
    title: 'A timer that stays with you',
    summary: 'Active Android sessions stay visible and actionable even when Hora is in the background.',
    changes: [
      'The active timer now has one quiet Android notification with a system chronometer, so elapsed and remaining time stay accurate without per-second app updates.',
      'Pause, Resume, and Finish are available from the notification, and Pomodoro phase changes are explicit with Start break or Start focus actions.',
      'Timer actions are saved locally first and recovered through a versioned continuity snapshot when the WebView is paused, reclaimed, or reopened.',
      'Dismissing the notification never pauses or finishes a session, and native milestone fallback keeps the active card current while Hora is asleep.',
    ],
  },
  {
    version: '0.1.2',
    date: '2026-09-21',
    title: 'Reminders that stay with you',
    summary: 'Android alerts now keep timer milestones and planned blocks visible beyond the open app.',
    changes: [
      'Timeflow goals and Pomodoro phase milestones can schedule native Android notifications without automatically stopping or advancing the session.',
      'Planned blocks can remind you at the start time or before it, including recurring occurrences, and notification taps open the relevant planner day and block.',
      'Settings now shows notification and precise-alarm access, offers Android permission controls, and includes a test alert.',
      'Notifications are reconciled after foregrounding, planner edits, and backup restore so stale reminders are cleaned up.',
      'A live session can change its optional goal to 25, 30, or 60 minutes, or remove the goal without stopping.',
      'The primary timer and Android notification/app-icon artwork now use Hora’s PNG clock character.',
    ],
  },
  {
    version: '0.1.1',
    date: '2026-09-17',
    title: 'A simpler start',
    summary: 'The ready Flowtime timer is less crowded, so starting a session takes less visual effort.',
    changes: [
      'Removed the repeated activity label above the ready timer while keeping activity selection clear below it.',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-09-16',
    title: 'A clearer way to track your day',
    summary: 'Activities, History, and timer setup now feel more connected and easier to change.',
    changes: [
      'Activity categories are clearly labeled as filters, while the selected activity stays visible above the timer.',
      'Today so far now shows timeline-style entries with notes and durations.',
      'Activities can be reordered or moved between categories by dragging, with a choice to preserve or update linked history.',
      'Archived activities are recoverable and remain linked to existing time logs.',
      'Reports now includes a direct History view with faster date navigation and editable notes.',
      'Completed planner entries can open their time log for corrections.',
      'Pomodoro fields can be cleared while typing and are safely clamped when editing finishes.',
      'The Hora clock character is now used consistently in the timer and Android app icon.',
    ],
  },
]
