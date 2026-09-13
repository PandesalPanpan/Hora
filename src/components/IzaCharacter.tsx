import { Pause, Play, Square } from 'lucide-react'
import type { Activity, ActiveSession } from '../features/timer/types'
import { formatDuration } from '../lib/time'
import './IzaCharacter.css'

type IzaCharacterProps = {
  active?: ActiveSession | null
  activity?: Activity
  elapsed?: number
  compact?: boolean
  mood?: 'idle' | 'encouraging' | 'resting'
  goalReached?: boolean
  onFinish?: () => void
  onPause?: () => void
  onResume?: () => void
  onStart?: () => void
}

function longDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function IzaCharacter({
  active = null,
  activity,
  elapsed = 0,
  compact = false,
  mood = 'idle',
  goalReached = false,
  onFinish,
  onPause,
  onResume,
  onStart,
}: IzaCharacterProps) {
  const paused = active?.status === 'paused'
  const state = compact ? mood : active ? paused ? 'paused' : goalReached ? 'goal-reached' : 'running' : mood
  const label = active ? `${active.activity.name} ${paused ? 'paused' : 'in progress'}` : compact ? 'Iza character' : 'Timer ready'

  return (
    <div className={`iza-character ${compact ? 'compact' : ''} ${state}`} aria-label={label}>
      {goalReached && !compact && <span className="character-sparkle sparkle-left" aria-hidden="true">✦</span>}
      {goalReached && !compact && <span className="character-sparkle sparkle-right" aria-hidden="true">✦</span>}
      <span className="ear ear-left" aria-hidden="true" />
      <span className="ear ear-right" aria-hidden="true" />
      <span className="arm arm-left" aria-hidden="true" />
      <span className="arm arm-right" aria-hidden="true" />
      <div className="character-body">
        <span className="sr-only">{label}</span>
        <div className="face" aria-hidden="true">
          <span className="eye eye-left" />
          <span className="smile" />
          <span className="eye eye-right" />
        </div>
        {!compact && <strong className="character-time" aria-label={`${formatDuration(elapsed)} elapsed`}>{longDuration(elapsed)}</strong>}
      </div>
      {!compact && <>
        <button className="character-foot stop-foot" type="button" onClick={onFinish} disabled={!active} aria-label="Finish session">
          <Square fill="currentColor" aria-hidden="true" />
        </button>
        {!active ? (
          <button className="character-foot play-foot" type="button" onClick={onStart} aria-label={`Start ${activity?.name ?? 'selected'} session`}>
            <Play fill="currentColor" aria-hidden="true" />
          </button>
        ) : paused ? (
          <button className="character-foot play-foot active-control" type="button" onClick={onResume} aria-label="Resume session">
            <Play fill="currentColor" aria-hidden="true" />
          </button>
        ) : (
          <button className="character-foot play-foot active-control" type="button" onClick={onPause} aria-label="Pause session">
            <Pause fill="currentColor" aria-hidden="true" />
          </button>
        )}
      </>}
    </div>
  )
}

