import { useLiveQuery } from 'dexie-react-hooks'
import { collisionGroups, visibleGroup } from './collision'
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  Square,
  TimerReset,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ActiveSession, Activity, CompletedSession } from '../timer/types'
import type { TimerStartOptions } from '../timer/useTimer'
import type { PlannedBlock, PlannerCategory } from './types'
import { sessionSeconds } from '../../lib/time'
import { db, legacyKeys, migrateLegacyLocalStorage } from '../../lib/db'
import './Planner.css'
import { changeOccurrence, expandRecurringBlock } from './recurrence'
import { reconcilePlannedBlockReminders } from '../../lib/notifications'

type PlannerProps = {
  active: ActiveSession | null
  completed: CompletedSession[]
  elapsed: number
  onFinish: () => void
  onStart: (activity: Activity, targetMinutes?: number | null, options?: TimerStartOptions) => void
  onReview?: (session: CompletedSession) => void
}

type CalendarEvent = {
  id: string
  kind: 'planned' | 'completed' | 'live'
  title: string
  category: string
  color: string
  start: Date
  end: Date
  plannedMinutes?: number
  actualMinutes?: number
  plannedBlockId?: string
  note?: string
}

type DraftBlock = {
  activityId?: string
  date: string
  title: string
  note: string
  category: PlannerCategory
  startTime: string
  endTime: string
  repeat: 'none' | 'daily' | 'weekdays'
  weekdays: number[]
  endsOn: string
  reminderMinutesBefore: number | null
}

const PLANNER_KEY = legacyKeys.PLANNER_KEY
const HOUR_HEIGHT = 68
const categories: Record<PlannerCategory, string> = {
  Focus: '#d92f6f',
  Leisure: '#dda1aa',
  Others: '#ff8b45',
  Rest: '#4d862a',
}

const hours = Array.from({ length: 24 }, (_, hour) => hour)
const pad = (value: number) => String(value).padStart(2, '0')
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const sameDay = (left: Date, right: Date) => dateKey(left) === dateKey(right)
const minutesSinceMidnight = (date: Date) => date.getHours() * 60 + date.getMinutes()
const durationMinutes = (start: Date, end: Date) => Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000))

function startOfWeek(date: Date) {
  const result = new Date(date)
  const mondayOffset = (result.getDay() + 6) % 7
  result.setDate(result.getDate() - mondayOffset)
  result.setHours(0, 0, 0, 0)
  return result
}

function addDays(date: Date, amount: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + amount)
  return result
}

function displayHour(hour: number) {
  if (hour === 0) return '12 AM'
  if (hour === 12) return '12 PM'
  return `${hour > 12 ? hour - 12 : hour} ${hour > 11 ? 'PM' : 'AM'}`
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return `${hours} hr${hours === 1 ? '' : 's'}${remainder ? ` ${remainder} min` : ''}`
}

function loadBlocks(): PlannedBlock[] {
  try {
    return JSON.parse(localStorage.getItem(PLANNER_KEY) ?? '[]') as PlannedBlock[]
  } catch {
    return []
  }
}

function draftFor(date: Date, hour = 9): DraftBlock {
  const endTime = hour === 23 ? '23:59' : `${pad(hour + 1)}:00`
  return {
    date: dateKey(date),
    title: '',
    note: '',
    category: 'Focus',
    startTime: `${pad(hour)}:00`,
    endTime,
    repeat: 'none',
    weekdays: [1, 2, 3, 4, 5],
    endsOn: dateKey(addDays(date, 7)),
    reminderMinutesBefore: null,
  }
}

function combineDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00`)
}

export function Planner({ active, completed, elapsed, onFinish, onStart, onReview }: PlannerProps) {
  const params = new URLSearchParams(window.location.hash.split('?')[1])
  const [view, setView] = useState<'day' | 'week'>(() => params.get('view') === 'week' ? 'week' : 'day')
  const [wide, setWide] = useState(() => window.innerWidth >= 768)
  const [overflow, setOverflow] = useState<CalendarEvent[] | null>(null)
  const [selectedDate, setSelectedDate] = useState(() => params.get('date') ? new Date(`${params.get('date')}T12:00:00`) : new Date())
  const [planned, setPlanned] = useState<PlannedBlock[]>(loadBlocks)
  const presets = useLiveQuery(() => db.activities.orderBy('order').toArray()) ?? []
  const [editingBlock, setEditingBlock] = useState<PlannedBlock | null>(null)
  const [editScope, setEditScope] = useState<'one' | 'future'>('one')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [saveError, setSaveError] = useState('')
  const saveLock = useRef(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<DraftBlock | null>(null)
  const [inspected, setInspected] = useState<CalendarEvent | null>(null)
  const [now, setNow] = useState(() => new Date())
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    void migrateLegacyLocalStorage().then(() => db.plannedBlocks.orderBy('startedAt').toArray()).then((blocks) => {
      if (!cancelled) setPlanned(blocks)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(interval)
  }, [])

  const days = useMemo(() => {
    if (view === 'day') return [selectedDate]
    const monday = startOfWeek(selectedDate)
    return Array.from({ length: 7 }, (_, index) => addDays(monday, index))
  }, [selectedDate, view])

  const events = useMemo<CalendarEvent[]>(() => {
    const plannedEvents = planned.flatMap(expandRecurringBlock).map((block) => ({
      id: block.id,
      kind: 'planned' as const,
      title: block.title,
      note: block.note,
      category: block.category,
      color: block.color,
      start: new Date(block.startedAt),
      end: new Date(block.finishedAt),
      plannedMinutes: durationMinutes(new Date(block.startedAt), new Date(block.finishedAt)),
    }))
    const completedEvents = completed.map((session) => ({
      id: session.id,
      kind: 'completed' as const,
      title: session.activity.name,
      note: session.note,
      category: 'Timeflow',
      color: session.activity.color,
      start: new Date(session.startedAt),
      end: new Date(session.finishedAt),
      actualMinutes: Math.max(1, Math.round(sessionSeconds(session) / 60)),
      plannedBlockId: session.plannedBlockId,
    }))
    const liveEvent = active ? [{
      id: active.id,
      kind: 'live' as const,
      title: active.activity.name,
      note: active.note,
      category: 'Timeflow',
      color: active.activity.color,
      start: new Date(active.startedAt),
      end: active.status === 'paused' && active.pausedAt ? new Date(active.pausedAt) : now,
      actualMinutes: Math.max(1, Math.round(elapsed / 60)),
    }] : []
    return [...plannedEvents, ...completedEvents, ...liveEvent]
  }, [active, completed, elapsed, now, planned])

  const linkedPlan = useMemo(() => {
    if (!inspected || inspected.kind === 'planned') return null
    if (!inspected.plannedBlockId) return null
    return events.find((event) => event.kind === 'planned' && event.id === inspected.plannedBlockId) ?? null
  }, [events, inspected])

  useEffect(() => {
    if (!scrollRef.current) return
    const current = new Date()
    const anchor = days.some((day) => sameDay(day, current)) ? minutesSinceMidnight(current) : 8 * 60
    scrollRef.current.scrollTop = Math.max(0, anchor / 60 * HOUR_HEIGHT - HOUR_HEIGHT * 1.5)
  }, [days, view])

  const moveDate = (direction: -1 | 1) => {
    routeDate(addDays(selectedDate, direction * (view === 'week' ? 7 : 1)))
  }

  const openDay = (date: Date) => {
    routeDate(date, 'day')
  }

  const savePlanned = async () => {
    if (saveLock.current) return
    if (!draft?.title.trim()) return
    const start = combineDateTime(draft.date, draft.startTime)
    const end = combineDateTime(draft.date, draft.endTime)
    if (end <= start) end.setDate(end.getDate() + 1)
    if (draft.repeat !== 'none' && (!draft.endsOn || draft.endsOn < draft.date || (draft.repeat === 'weekdays' && !draft.weekdays.length))) { setSaveError('Choose repeat days and an end date on or after the first block.'); return }
    const block: PlannedBlock = {
      activityId: draft.activityId,
      id: crypto.randomUUID(),
      title: draft.title.trim(),
      note: draft.note.trim() || undefined,
      category: draft.category,
      color: categories[draft.category],
      startedAt: start.toISOString(),
      finishedAt: end.toISOString(),
      reminderMinutesBefore: draft.reminderMinutesBefore ?? undefined,
      recurrenceSeriesId: draft.repeat === 'none' ? undefined : crypto.randomUUID(),
      recurrence: draft.repeat === 'none' ? undefined : { frequency: draft.repeat === 'daily' ? 'daily' : 'weekdays', weekdays: draft.repeat === 'weekdays' ? draft.weekdays : undefined, endsOn: draft.endsOn },
    }
    saveLock.current = true
    setSaving(true)
    try {
      const source = editingBlock && planned.find(item => item.id === editingBlock.id || (item.recurrence && (item.recurrenceSeriesId ?? item.id) === editingBlock.recurrenceSeriesId))
      const replacements = source ? changeOccurrence(source, editingBlock?.occurrenceDate ?? draft.date, editScope, block) : [block]
      await db.transaction('rw', db.plannedBlocks, async () => { if (source) await db.plannedBlocks.delete(source.id); await db.plannedBlocks.bulkPut(replacements) })
      setPlanned(await db.plannedBlocks.toArray()); setDraft(null); setEditingBlock(null); setInspected(null); setSaveError('')
      void reconcilePlannedBlockReminders(Date.now(), { requestPermission: Boolean(block.reminderMinutesBefore !== undefined) })
    } catch { setSaveError('This block could not be saved. Try again.') } finally { saveLock.current = false; setSaving(false) }
  }

  const inspectBlock = inspected ? planned.flatMap(expandRecurringBlock).find(item => item.id === inspected.id) : undefined
  const editPlanned = () => {
    if (!inspectBlock) return
    const start = new Date(inspectBlock.startedAt), end = new Date(inspectBlock.finishedAt)
    setEditingBlock(inspectBlock); setEditScope('one'); setInspected(null)
    setDraft({ ...draftFor(start), activityId: inspectBlock.activityId, title: inspectBlock.title, note: inspectBlock.note ?? '', category: inspectBlock.category, startTime: `${pad(start.getHours())}:${pad(start.getMinutes())}`, endTime: `${pad(end.getHours())}:${pad(end.getMinutes())}`, repeat: inspectBlock.recurrence?.frequency ?? 'none', weekdays: inspectBlock.recurrence?.weekdays ?? [1,2,3,4,5], endsOn: inspectBlock.recurrence?.endsOn ?? dateKey(start), reminderMinutesBefore: inspectBlock.reminderMinutesBefore ?? null })
  }
  const deletePlanned = async () => {
    if (!inspectBlock || saving) return
    const source = planned.find(item => item.id === inspectBlock.id || (item.recurrence && (item.recurrenceSeriesId ?? item.id) === inspectBlock.recurrenceSeriesId))
    if (!source) return
    saveLock.current = true
    setSaving(true)
    try {
      const replacements = changeOccurrence(source, inspectBlock.occurrenceDate ?? dateKey(new Date(inspectBlock.startedAt)), editScope)
      await db.transaction('rw', db.plannedBlocks, async () => { await db.plannedBlocks.delete(source.id); if (replacements.length) await db.plannedBlocks.bulkPut(replacements) })
      setPlanned(await db.plannedBlocks.toArray()); setInspected(null); setDeleteConfirm(false); setSaveError('')
      void reconcilePlannedBlockReminders()
    } catch { setSaveError('This block could not be deleted. Try again.') } finally { saveLock.current = false; setSaving(false) }
  }

  const startViaTimeflow = () => {
    if (!draft?.title.trim() || active) return
    onStart({
      id: `planner-${crypto.randomUUID()}`,
      name: draft.title.trim(),
      color: categories[draft.category],
    }, null, { timerMode: 'flowtime', note: draft.note.trim() || undefined })
    setDraft(null)
  }

  const resizePlanned = (pointerDown: React.PointerEvent, blockId: string, edge: 'start' | 'end') => {
    const original = planned.find((block) => block.id === blockId)
    if (!original) return
    pointerDown.preventDefault()
    pointerDown.stopPropagation()
    const originY = pointerDown.clientY
    const originalStart = new Date(original.startedAt)
    const originalEnd = new Date(original.finishedAt)

    let resized = original
    const onPointerMove = (event: PointerEvent) => {
      const deltaMinutes = Math.round((event.clientY - originY) / HOUR_HEIGHT * 4) * 15
      const start = new Date(originalStart), end = new Date(originalEnd)
      if (edge === 'start') start.setMinutes(start.getMinutes() + deltaMinutes)
      else end.setMinutes(end.getMinutes() + deltaMinutes)
      if (+end - +start < 15 * 60_000) {
        if (edge === 'start') start.setTime(+end - 15 * 60_000)
        else end.setTime(+start + 15 * 60_000)
      }
      resized = { ...original, startedAt: start.toISOString(), finishedAt: end.toISOString() }
      setPlanned(current => current.map(block => block.id === blockId ? resized : block))
    }
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      void db.plannedBlocks.put(resized).then(() => reconcilePlannedBlockReminders()).catch(() => {
        setPlanned(current => current.map(block => block.id === blockId ? original : block))
        setSaveError('The resized block could not be saved. Try again.')
      })
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  useEffect(() => {
    const resize = () => setWide(window.innerWidth >= 768)
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  const routeBlockOpened = useRef<string | null>(null)
  useEffect(() => {
    const block = new URLSearchParams(window.location.hash.split('?')[1]).get('block')
    if (block && routeBlockOpened.current !== block) { const event = events.find(event => event.id === block); if (event) { routeBlockOpened.current = block; setInspected(event) } }
  }, [events])

  const routeDate = (date: Date, nextView = view) => {
    setSelectedDate(date); setView(nextView)
    window.history.replaceState(null, '', `#/planner?view=${nextView}&date=${dateKey(date)}`)
  }

  return (
    <section className="planner" aria-label="Planner calendar">
      {saveError && !draft && !inspected && <p role="alert">{saveError}</p>}
      <header className="planner-toolbar">
        <div>
          <p>{view === 'week' ? 'Your week' : selectedDate.toLocaleDateString(undefined, { weekday: 'long' })}</p>
          <h1>{selectedDate.toLocaleDateString(undefined, view === 'day' ? { month: 'long', day: 'numeric', year: 'numeric' } : { month: 'long', year: 'numeric' })}</h1>
        </div>
        <button className="add-block-button" type="button" onClick={() => { setEditingBlock(null); setDraft(draftFor(selectedDate)) }}>
          <Plus aria-hidden="true" /> Add block
        </button>
      </header>

      <div className="planner-controls">
        <div className="date-navigation">
          <button type="button" onClick={() => moveDate(-1)} aria-label={`Previous ${view}`}><ChevronLeft /></button>
          <button type="button" onClick={() => routeDate(new Date())}>Today</button>
          <button type="button" onClick={() => moveDate(1)} aria-label={`Next ${view}`}><ChevronRight /></button>
        </div>
        <div className="view-switch" aria-label="Calendar view">
          <button className={view === 'day' ? 'selected' : ''} type="button" onClick={() => routeDate(selectedDate, 'day')}>Day</button>
          <button className={view === 'week' ? 'selected' : ''} type="button" onClick={() => routeDate(selectedDate, 'week')}>Week</button>
        </div>
      </div>

      <div className={`calendar-frame ${view}-calendar`}>
        <div className="calendar-scroll" ref={scrollRef}>
          <div className="date-strip">
            <span aria-hidden="true" />
            {days.map((day) => {
              const today = sameDay(day, now)
              const selected = sameDay(day, selectedDate)
              return (
                <button
                  key={dateKey(day)}
                  className={`${today ? 'today' : ''} ${selected ? 'active' : ''}`}
                  type="button"
                  onClick={() => openDay(day)}
                  aria-label={`Open ${day.toLocaleDateString(undefined, { dateStyle: 'full' })}`}
                >
                  <span>{day.toLocaleDateString(undefined, { weekday: view === 'week' ? 'short' : 'long' })}</span>
                  <strong>{day.getDate()}</strong>
                </button>
              )
            })}
          </div>
          <div className="calendar-body">
            <div className="time-rail" aria-hidden="true">
              {hours.map((hour) => <span key={hour} style={{ top: `${hour * HOUR_HEIGHT}px` }}>{displayHour(hour)}</span>)}
            </div>
            <div className="day-columns" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(${view === 'week' ? '10rem' : '0px'}, 1fr))` }}>
              {days.map((day) => {
                const dayEvents = events.filter((event) => sameDay(event.start, day))
                return (
                  <div
                    className="day-column"
                    key={dateKey(day)}
                    onClick={(event) => {
                      if (event.target !== event.currentTarget) return
                      const bounds = event.currentTarget.getBoundingClientRect()
                      const clickedHour = Math.min(23, Math.max(0, Math.floor((event.clientY - bounds.top) / HOUR_HEIGHT)))
                      setSelectedDate(day)
                      setDraft(draftFor(day, clickedHour))
                    }}
                  >
                    {hours.map((hour) => <span className="hour-line" key={hour} style={{ top: `${hour * HOUR_HEIGHT}px` }} />)}
                    {hours.map((hour) => <span className="half-hour-line" key={hour} style={{ top: `${hour * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }} />)}
                    {sameDay(day, now) && (
                      <span className="current-time-line" style={{ top: `${minutesSinceMidnight(now) / 60 * HOUR_HEIGHT}px` }}>
                        <i />
                      </span>
                    )}
                    {collisionGroups(dayEvents).map((group) => {
                      const limit = view === 'day' ? (wide ? group.lanes : 2) : (wide ? 2 : 1)
                      const { visible, hidden } = visibleGroup(group, limit)
                      const lanes = Math.min(limit, group.lanes)
                      return <div key={group.items[0].event.id}>{visible.map(({ event, lane, top, height }) => (
                      <div
                        className={`calendar-event ${event.kind}`}
                        key={`${event.kind}-${event.id}`}
                        style={{ '--event-color': event.color, top, height, left: `calc(${lane / lanes * 100}% - ${(hidden.length ? 64 : 0) * lane / lanes}px + 3px)`, width: `calc(${100 / lanes}% - ${(hidden.length ? 64 : 0) / lanes + 6}px)` } as React.CSSProperties}
                      >
                        {event.kind === 'planned' && planned.some(block => block.id === event.id && !block.recurrence) && <><i className="resize-handle top" onPointerDown={(pointer) => resizePlanned(pointer, event.id, 'start')} /><i className="resize-handle bottom" onPointerDown={(pointer) => resizePlanned(pointer, event.id, 'end')} /></>}
                        <button className="event-open" type="button" onClick={() => { setDeleteConfirm(false); setEditScope('one'); setInspected(event) }}>
                          <span className="event-title">{event.kind !== 'planned' && <TimerReset aria-hidden="true" />}{event.title}</span>
                          <span className="event-chip">{event.kind === 'planned' ? 'Planned' : event.kind === 'live' ? 'Live' : 'Tracked'}</span>
                          {event.note && <span className={`event-note-preview ${view === 'week' ? 'indicator-only' : ''}`} aria-label={`Note: ${event.note}`}>{view === 'week' ? 'Note' : event.note}</span>}
                          {event.kind === 'live' && <strong className="live-pill">Live · {pad(Math.floor(elapsed / 3600))}:{pad(Math.floor(elapsed % 3600 / 60))}:{pad(elapsed % 60)}</strong>}
                        </button>
                        {event.kind === 'live' && <button className="live-stop-inline" type="button" onClick={onFinish} aria-label={`Stop ${event.title}`}><Square fill="currentColor" /></button>}
                      </div>
                    ))}{hidden.length > 0 && <button className="collision-more" type="button" style={{ top: group.top, right: 0 }} aria-label={`Show ${hidden.length} more events from ${group.items[0].event.start.toLocaleTimeString()}`} onClick={() => setOverflow(group.items.map(item => item.event))}>+{hidden.length} more</button>}</div>
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="planner-legend" aria-label="Calendar legend">
        <span><i className="planned-key" /> Planned</span>
        <span><i className="actual-key" /> Timeflow</span>
        <span><i className="live-key" /> Live now</span>
      </div>

      {overflow && <div className="popover-backdrop"><section className="event-inspector" role="dialog" aria-modal="true" aria-label="Overlapping events"><header><h2>Events at this time</h2><button type="button" aria-label="Close events" onClick={() => setOverflow(null)}><X /></button></header>{overflow.map(event => <button className="overflow-event" type="button" key={event.id} onClick={() => { setInspected(event); setOverflow(null) }}><strong>{event.title}</strong><span>{event.kind === 'planned' ? 'Planned' : event.kind === 'live' ? 'Live' : 'Tracked'} · {event.start.toLocaleTimeString()} – {event.end.toLocaleTimeString()}</span></button>)}</section></div>}
      {draft && (
        <div className="popover-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setDraft(null)}>
          <form className="quick-add-popover" onSubmit={(event) => { event.preventDefault(); savePlanned() }}>
            <header><div><span>New time block</span><strong>{new Date(`${draft.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</strong></div><button type="button" onClick={() => setDraft(null)} aria-label="Close add block"><X /></button></header>
            {editingBlock?.recurrence && <label>Apply changes<select value={editScope} onChange={event => setEditScope(event.target.value as 'one' | 'future')}><option value="one">Only this block</option><option value="future">This and future blocks</option></select></label>}
            <label>Activity<select value={draft.activityId ?? ''} onChange={event => { const preset = presets.find(item => item.id === event.target.value); setDraft({ ...draft, activityId: preset?.id, title: preset?.name ?? draft.title, category: preset ? preset.category === 'Life' ? 'Others' : preset.category : draft.category }) }}><option value="">Choose an activity (optional)</option>{presets.filter(item => !item.archived).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label>What are you planning?<input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="e.g. Review biology notes" /></label>
            <label>Note <span>(optional)</span><textarea value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="Add details you will need later" /></label>
            <label>Category<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as PlannerCategory })}>{Object.keys(categories).map((category) => <option key={category}>{category}</option>)}</select></label>
            <label>Date<input type="date" required value={draft.date} onChange={event => setDraft({ ...draft, date: event.target.value })} /></label>
            <div className="time-fields"><label>Starts<input type="time" value={draft.startTime} onChange={(event) => setDraft({ ...draft, startTime: event.target.value })} /></label><label>Ends<input type="time" value={draft.endTime} onChange={(event) => setDraft({ ...draft, endTime: event.target.value })} /></label></div>
            <label>Repeat<select value={draft.repeat} onChange={(event) => setDraft({ ...draft, repeat: event.target.value as DraftBlock['repeat'] })}><option value="none">Does not repeat</option><option value="daily">Every day</option><option value="weekdays">Selected weekdays</option></select></label>
            {draft.repeat === 'weekdays' && <fieldset className="weekday-picker"><legend>Repeat on</legend>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, day) => <button type="button" key={day} aria-pressed={draft.weekdays.includes(day)} onClick={() => setDraft({ ...draft, weekdays: draft.weekdays.includes(day) ? draft.weekdays.filter((item) => item !== day) : [...draft.weekdays, day] })}>{label}</button>)}</fieldset>}
            {draft.repeat !== 'none' && <label>Ends on<input required type="date" min={draft.date} value={draft.endsOn} onChange={(event) => setDraft({ ...draft, endsOn: event.target.value })} /></label>}
            <label>Remind me<select aria-label="Remind me" value={draft.reminderMinutesBefore === null ? '' : String(draft.reminderMinutesBefore)} onChange={(event) => setDraft({ ...draft, reminderMinutesBefore: event.target.value === '' ? null : Number(event.target.value) })}><option value="">No reminder</option><option value="0">At start time</option><option value="5">5 minutes before</option><option value="10">10 minutes before</option><option value="15">15 minutes before</option><option value="30">30 minutes before</option><option value="60">1 hour before</option></select></label>
            {saveError && <p role="alert">{saveError}</p>}
            <div className="popover-actions"><button type="submit" disabled={saving}>Save as planned</button><button type="button" disabled={Boolean(active) || !draft.title.trim()} onClick={startViaTimeflow}><TimerReset /> Start via Timeflow</button></div>
          </form>
        </div>
      )}

      {inspected && (
        <div className="popover-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setInspected(null)}>
          <section className="event-inspector" aria-label={`${inspected.title} details`}>
            <header><div><span>{inspected.kind === 'planned' ? 'Planned block' : inspected.kind === 'live' ? 'Live Timeflow' : 'Completed Timeflow'}</span><h2>{inspected.title}</h2></div><button type="button" onClick={() => setInspected(null)} aria-label="Close details"><X /></button></header>
            <p><Clock3 /> {inspected.start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })} - {inspected.end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</p>
            {inspected.note && <section className="event-note"><strong>Note</strong><p>{inspected.note}</p></section>}
            <div className="comparison-row"><span>Planned<strong>{inspected.plannedMinutes ? formatDuration(inspected.plannedMinutes) : linkedPlan ? formatDuration(durationMinutes(linkedPlan.start, linkedPlan.end)) : 'No linked plan'}</strong></span><span>Actual logged<strong>{inspected.kind === 'planned' ? 'Not tracked yet' : formatDuration(inspected.actualMinutes ?? durationMinutes(inspected.start, inspected.end))}</strong></span></div>
            {saveError && <p role="alert">{saveError}</p>}
            {inspectBlock && <div className="planned-edit-actions"><button type="button" onClick={editPlanned}>Edit planned block</button>{!deleteConfirm ? <button type="button" onClick={() => setDeleteConfirm(true)}>Delete planned block</button> : <><p>Delete this planned block?</p>{inspectBlock.recurrence && <label>Delete<select value={editScope} onChange={event => setEditScope(event.target.value as 'one' | 'future')}><option value="one">Only this block</option><option value="future">This and future blocks</option></select></label>}<button type="button" disabled={saving} onClick={() => void deletePlanned()}>Confirm delete</button><button type="button" onClick={() => setDeleteConfirm(false)}>Keep block</button></>}</div>}
            {inspected.kind === 'completed' && onReview && <button className="stop-live-button" type="button" onClick={() => { const session = completed.find(item => item.id === inspected.id); if (session) { setInspected(null); onReview(session) } }}>Edit time log</button>}
            {inspected.kind === 'live' && <button className="stop-live-button" type="button" onClick={() => { onFinish(); setInspected(null) }}><Square fill="currentColor" /> Stop Timeflow</button>}
            {inspected.kind === 'planned' && <button className="stop-live-button" type="button" disabled={Boolean(active)} onClick={() => { onStart({ id: `planner-${inspected.id}`, name: inspected.title, color: inspected.color }, null, { plannedBlockId: inspected.id, timerMode: 'flowtime', note: inspected.note }); setInspected(null) }}><TimerReset /> Start this block</button>}
          </section>
        </div>
      )}
    </section>
  )
}
