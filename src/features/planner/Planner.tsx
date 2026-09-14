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
import type { PlannedBlock, PlannerCategory } from './types'
import { sessionSeconds } from '../../lib/time'
import './Planner.css'

type PlannerProps = {
  active: ActiveSession | null
  completed: CompletedSession[]
  elapsed: number
  onFinish: () => void
  onStart: (activity: Activity) => void
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
}

type DraftBlock = {
  date: string
  title: string
  category: PlannerCategory
  startTime: string
  endTime: string
}

const PLANNER_KEY = 'iza.planned-blocks.v1'
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
    category: 'Focus',
    startTime: `${pad(hour)}:00`,
    endTime,
  }
}

function combineDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00`)
}

export function Planner({ active, completed, elapsed, onFinish, onStart }: PlannerProps) {
  const [view, setView] = useState<'day' | 'week'>(() => window.matchMedia?.('(max-width: 600px)').matches ? 'day' : 'week')
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [planned, setPlanned] = useState<PlannedBlock[]>(loadBlocks)
  const [draft, setDraft] = useState<DraftBlock | null>(null)
  const [inspected, setInspected] = useState<CalendarEvent | null>(null)
  const [now, setNow] = useState(() => new Date())
  const scrollRef = useRef<HTMLDivElement>(null)

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
    const plannedEvents = planned.map((block) => ({
      id: block.id,
      kind: 'planned' as const,
      title: block.title,
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
      category: 'Timeflow',
      color: session.activity.color,
      start: new Date(session.startedAt),
      end: new Date(session.finishedAt),
      actualMinutes: Math.max(1, Math.round(sessionSeconds(session) / 60)),
    }))
    const liveEvent = active ? [{
      id: active.id,
      kind: 'live' as const,
      title: active.activity.name,
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
    return events
      .filter((event) => event.kind === 'planned' && sameDay(event.start, inspected.start))
      .sort((left, right) => {
        const leftTitle = left.title.toLowerCase() === inspected.title.toLowerCase() ? -1_000_000 : 0
        const rightTitle = right.title.toLowerCase() === inspected.title.toLowerCase() ? -1_000_000 : 0
        return leftTitle + Math.abs(left.start.getTime() - inspected.start.getTime()) - rightTitle - Math.abs(right.start.getTime() - inspected.start.getTime())
      })[0] ?? null
  }, [events, inspected])

  useEffect(() => {
    if (!scrollRef.current) return
    const current = new Date()
    const anchor = days.some((day) => sameDay(day, current)) ? minutesSinceMidnight(current) : 8 * 60
    scrollRef.current.scrollTop = Math.max(0, anchor / 60 * HOUR_HEIGHT - HOUR_HEIGHT * 1.5)
  }, [days, view])

  const moveDate = (direction: -1 | 1) => {
    setSelectedDate((current) => addDays(current, direction * (view === 'week' ? 7 : 1)))
  }

  const openDay = (date: Date) => {
    setSelectedDate(date)
    setView('day')
  }

  const savePlanned = () => {
    if (!draft?.title.trim()) return
    const start = combineDateTime(draft.date, draft.startTime)
    const end = combineDateTime(draft.date, draft.endTime)
    if (end <= start) end.setDate(end.getDate() + 1)
    const block: PlannedBlock = {
      id: crypto.randomUUID(),
      title: draft.title.trim(),
      category: draft.category,
      color: categories[draft.category],
      startedAt: start.toISOString(),
      finishedAt: end.toISOString(),
    }
    const next = [...planned, block]
    localStorage.setItem(PLANNER_KEY, JSON.stringify(next))
    setPlanned(next)
    setDraft(null)
  }

  const startViaTimeflow = () => {
    if (!draft?.title.trim() || active) return
    onStart({
      id: `planner-${crypto.randomUUID()}`,
      name: draft.title.trim(),
      color: categories[draft.category],
    })
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

    const onPointerMove = (event: PointerEvent) => {
      const rawMinutes = (event.clientY - originY) / HOUR_HEIGHT * 60
      const deltaMinutes = Math.round(rawMinutes / 15) * 15
      setPlanned((current) => current.map((block) => {
        if (block.id !== blockId) return block
        const start = new Date(originalStart)
        const end = new Date(originalEnd)
        if (edge === 'start') start.setMinutes(start.getMinutes() + deltaMinutes)
        else end.setMinutes(end.getMinutes() + deltaMinutes)
        if (end.getTime() - start.getTime() < 15 * 60_000) {
          if (edge === 'start') start.setTime(end.getTime() - 15 * 60_000)
          else end.setTime(start.getTime() + 15 * 60_000)
        }
        return { ...block, startedAt: start.toISOString(), finishedAt: end.toISOString() }
      }))
    }

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      setPlanned((current) => {
        localStorage.setItem(PLANNER_KEY, JSON.stringify(current))
        return current
      })
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  const eventStyle = (event: CalendarEvent, dayEvents: CalendarEvent[]) => {
    const overlapping = dayEvents.some((candidate) =>
      candidate.id !== event.id && candidate.start < event.end && candidate.end > event.start,
    )
    const actual = event.kind !== 'planned'
    return {
      '--event-color': event.color,
      top: `${minutesSinceMidnight(event.start) / 60 * HOUR_HEIGHT}px`,
      height: `${Math.max(38, durationMinutes(event.start, event.end) / 60 * HOUR_HEIGHT)}px`,
      left: overlapping ? (actual ? '50%' : '3px') : '3px',
      width: overlapping ? 'calc(50% - 5px)' : 'calc(100% - 6px)',
    } as React.CSSProperties
  }

  return (
    <section className="planner" aria-label="Planner calendar">
      <header className="planner-toolbar">
        <div>
          <p>{view === 'week' ? 'Your week' : selectedDate.toLocaleDateString(undefined, { weekday: 'long' })}</p>
          <h1>{selectedDate.toLocaleDateString(undefined, view === 'day' ? { month: 'long', day: 'numeric', year: 'numeric' } : { month: 'long', year: 'numeric' })}</h1>
        </div>
        <button className="add-block-button" type="button" onClick={() => setDraft(draftFor(selectedDate))}>
          <Plus aria-hidden="true" /> Add block
        </button>
      </header>

      <div className="planner-controls">
        <div className="date-navigation">
          <button type="button" onClick={() => moveDate(-1)} aria-label={`Previous ${view}`}><ChevronLeft /></button>
          <button type="button" onClick={() => setSelectedDate(new Date())}>Today</button>
          <button type="button" onClick={() => moveDate(1)} aria-label={`Next ${view}`}><ChevronRight /></button>
        </div>
        <div className="view-switch" aria-label="Calendar view">
          <button className={view === 'day' ? 'selected' : ''} type="button" onClick={() => setView('day')}>Day</button>
          <button className={view === 'week' ? 'selected' : ''} type="button" onClick={() => setView('week')}>Week</button>
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
            <div className="day-columns" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(${view === 'week' ? '6.5rem' : '15rem'}, 1fr))` }}>
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
                    {dayEvents.map((event) => (
                      <button
                        className={`calendar-event ${event.kind}`}
                        key={`${event.kind}-${event.id}`}
                        style={eventStyle(event, dayEvents)}
                        type="button"
                        onClick={() => setInspected(event)}
                      >
                        {event.kind === 'planned' && <><i className="resize-handle top" onPointerDown={(pointer) => resizePlanned(pointer, event.id, 'start')} /><i className="resize-handle bottom" onPointerDown={(pointer) => resizePlanned(pointer, event.id, 'end')} /></>}
                        <span className="event-title">{event.kind !== 'planned' && <TimerReset aria-hidden="true" />}{event.title}</span>
                        <span className="event-chip">{event.category}</span>
                        {event.kind === 'live' && <strong className="live-pill">Live · {pad(Math.floor(elapsed / 3600))}:{pad(Math.floor(elapsed % 3600 / 60))}:{pad(elapsed % 60)}</strong>}
                      </button>
                    ))}
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

      {draft && (
        <div className="popover-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setDraft(null)}>
          <form className="quick-add-popover" onSubmit={(event) => { event.preventDefault(); savePlanned() }}>
            <header><div><span>New time block</span><strong>{new Date(`${draft.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</strong></div><button type="button" onClick={() => setDraft(null)} aria-label="Close add block"><X /></button></header>
            <label>What are you planning?<input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="e.g. Review biology notes" /></label>
            <label>Category<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as PlannerCategory })}>{Object.keys(categories).map((category) => <option key={category}>{category}</option>)}</select></label>
            <div className="time-fields"><label>Starts<input type="time" value={draft.startTime} onChange={(event) => setDraft({ ...draft, startTime: event.target.value })} /></label><label>Ends<input type="time" value={draft.endTime} onChange={(event) => setDraft({ ...draft, endTime: event.target.value })} /></label></div>
            <div className="popover-actions"><button type="submit">Save as planned</button><button type="button" disabled={Boolean(active) || !draft.title.trim()} onClick={startViaTimeflow}><TimerReset /> Start via Timeflow</button></div>
          </form>
        </div>
      )}

      {inspected && (
        <div className="popover-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setInspected(null)}>
          <section className="event-inspector" aria-label={`${inspected.title} details`}>
            <header><div><span>{inspected.kind === 'planned' ? 'Planned block' : inspected.kind === 'live' ? 'Live Timeflow' : 'Completed Timeflow'}</span><h2>{inspected.title}</h2></div><button type="button" onClick={() => setInspected(null)} aria-label="Close details"><X /></button></header>
            <p><Clock3 /> {inspected.start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} - {inspected.end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</p>
            <div className="comparison-row"><span>Planned<strong>{inspected.plannedMinutes ? formatDuration(inspected.plannedMinutes) : linkedPlan ? formatDuration(durationMinutes(linkedPlan.start, linkedPlan.end)) : 'No linked plan'}</strong></span><span>Actual logged<strong>{inspected.kind === 'planned' ? 'Not tracked yet' : formatDuration(inspected.actualMinutes ?? durationMinutes(inspected.start, inspected.end))}</strong></span></div>
            {inspected.kind === 'live' && <button className="stop-live-button" type="button" onClick={() => { onFinish(); setInspected(null) }}><Square fill="currentColor" /> Stop Timeflow</button>}
          </section>
        </div>
      )}
    </section>
  )
}
