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
      'The Iza clock is now a crisp vector illustration and the Android app icon.',
    ],
  },
]
