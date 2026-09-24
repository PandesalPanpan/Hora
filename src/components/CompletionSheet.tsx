import { parseLocalEdit, toLocalInput } from '../lib/completionTime'
import { useRef, useState } from 'react'
import { ChevronDown, Clock3 } from 'lucide-react'
import { activityGroups } from '../features/activities/catalog'
import type { CompletedSession } from '../features/timer/types'
import { formatCompactDuration, sessionSeconds } from '../lib/time'

type CompletionSheetProps = {
  session: CompletedSession
  onSave: (session: CompletedSession, patch: Pick<CompletedSession, 'activity' | 'note' | 'mood' | 'startedAt' | 'finishedAt'>) => Promise<void>
  onDelete?: (session: CompletedSession) => void
  onClose?: () => void
}

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

export function CompletionSheet({ session, onSave, onDelete, onClose }: CompletionSheetProps) {
  const choices = [activityGroups.Focus[0], activityGroups.Focus[1], activityGroups.Life[0]]
  const [activity, setActivity] = useState(session.activity)
  const [note, setNote] = useState(session.note ?? '')
  const [mood, setMood] = useState<CompletedSession['mood']>(session.mood)
  const [startedAt, setStartedAt] = useState(toLocalInput(session.startedAt))
  const [finishedAt, setFinishedAt] = useState(toLocalInput(session.finishedAt))
  const locked = useRef(false)
  const [editSeconds, setEditSeconds] = useState(false)
  const [startSeconds, setStartSeconds] = useState<string>()
  const [finishSeconds, setFinishSeconds] = useState<string>()
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  const showSecondCorrection = new Date(session.finishedAt).getTime() - new Date(session.startedAt).getTime() < 60_000

  const save = async () => {
    if (locked.current) return
    let start: Date, finish: Date
    try {
      start = new Date(parseLocalEdit(startedAt, session.startedAt, startSeconds))
      finish = new Date(parseLocalEdit(finishedAt, session.finishedAt, finishSeconds))
    } catch { setError('Enter a valid local time and seconds from 0 to 59.'); return }
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(finish.getTime()) || finish <= start) {
      setError('Finish time must be after the start time.')
      return
    }
    setError('')
    locked.current = true
    setSaving(true)
    try {
      await onSave(session, { activity, note: note.trim(), mood, startedAt: start.toISOString(), finishedAt: finish.toISOString() })
    } catch {
      setError('Changes could not be saved on this device. Try again.')
      locked.current = false
      setSaving(false)
    }
  }

  return (
    <div className="completion-backdrop" role="presentation">
      <form className="completion-sheet" aria-label="Complete time log" onSubmit={(event) => { event.preventDefault(); save() }}>
        <header><div><h1>Check your time log</h1><p>Your time is already safely logged.</p></div>{onClose && <button className="sheet-close" type="button" onClick={onClose} aria-label="Close time log">×</button>}</header>
        <section className="session-summary"><span>Session complete</span><strong>{formatCompactDuration(sessionSeconds(session))}</strong><small>{timeFormatter.format(new Date(session.startedAt))} – {timeFormatter.format(new Date(session.finishedAt))}</small></section>
        <fieldset><legend>What were you doing?</legend><p>Pick one or keep the current label.</p><div className="choice-row">{choices.map((choice) => <button type="button" key={choice.id} className={activity.id === choice.id ? 'selected' : ''} onClick={() => setActivity(choice)}>{choice.name}{activity.id === choice.id ? ' ✓' : ''}</button>)}</div></fieldset>
        <label className="note-field"><span>Optional note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="What did you get done?" /></label>
        <fieldset><legend>Correct the time</legend><div className="datetime-fields"><label>Started<input type="datetime-local" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} /></label><label>Finished<input type="datetime-local" value={finishedAt} onChange={(event) => setFinishedAt(event.target.value)} /></label></div>{showSecondCorrection && <><button type="button" className="correction-disclosure" aria-expanded={editSeconds} onClick={() => setEditSeconds(!editSeconds)}><Clock3/><span><strong>Edit seconds</strong><small>{startSeconds ?? String(new Date(session.startedAt).getSeconds()).padStart(2, '0')} start · {finishSeconds ?? String(new Date(session.finishedAt).getSeconds()).padStart(2, '0')} finish</small></span><ChevronDown /></button>{editSeconds && <div className="datetime-fields seconds-fields"><label>Started seconds<input type="number" min="0" max="59" value={startSeconds ?? new Date(session.startedAt).getSeconds()} onChange={(event) => setStartSeconds(event.target.value)} /></label><label>Finished seconds<input type="number" min="0" max="59" value={finishSeconds ?? new Date(session.finishedAt).getSeconds()} onChange={(event) => setFinishSeconds(event.target.value)} /></label></div>}</>}{error && <p className="form-error" role="alert">{error}</p>}</fieldset>
        <fieldset><legend>How did it feel? <small>Optional</small></legend><div className="choice-row moods">{(['calm', 'focused', 'tired'] as const).map((choice) => <button type="button" key={choice} aria-pressed={mood === choice} className={mood === choice ? 'selected' : ''} onClick={() => setMood(choice)}>{choice === 'calm' ? '☁' : choice === 'focused' ? '✦' : '☕'} {choice}{mood === choice ? ' ✓' : ''}</button>)}</div>{mood && <button type="button" className="seconds-toggle" onClick={() => setMood(undefined)}>Clear feeling</button>}</fieldset>
        <button className="save-log" type="submit" disabled={saving}>{saving ? 'Saving changes…' : 'Save changes'}</button>
        {onDelete && (!confirmDelete ? <button className="delete-log" type="button" onClick={() => setConfirmDelete(true)}>Delete this session</button> : <div className="confirm-delete"><span>Delete this session?</span><button type="button" onClick={() => setConfirmDelete(false)}>Keep it</button><button type="button" onClick={() => onDelete(session)}>Delete</button></div>)}
      </form>
    </div>
  )
}
