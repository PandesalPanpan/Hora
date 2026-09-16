import { ChevronDown, GripVertical, MoreVertical } from 'lucide-react'
import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { activityCounts, moveActivity, saveActivity } from './repository'
import type { ActivityPreset } from './types'
import { activityGroups, categoryColors, type ActivityGroup } from './catalog'

type PendingMove = { activity: ActivityPreset; category: ActivityGroup; index: number; counts: { sessions: number; plans: number } }

export function ActivityManager({ onClose }: { onClose: () => void }) {
  const presets = useLiveQuery(() => db.activities.orderBy('order').toArray()) ?? []
  const [editing, setEditing] = useState<ActivityPreset | null>(null)
  const [everywhere, setEverywhere] = useState(false)
  const [counts, setCounts] = useState({ sessions: 0, plans: 0 })
  const [error, setError] = useState('')
  const locked = useRef(false)
  const [busy, setBusy] = useState(false)
  const [menu, setMenu] = useState<string | null>(null)
  const [archivedOpen, setArchivedOpen] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragTarget, setDragTarget] = useState<ActivityGroup | null>(null)
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)
  const run = async (action: () => Promise<unknown>) => { if (locked.current) return; locked.current = true; setBusy(true); try { await action(); setError('') } catch (e) { setError(e instanceof Error ? e.message : 'Activity could not be saved. Try again.') } finally { locked.current = false; setBusy(false) } }
  const edit = async (preset: ActivityPreset) => { setCounts(await activityCounts(preset.id)); setEverywhere(false); setEditing(preset) }
  const grouped = (Object.keys(activityGroups) as ActivityGroup[]).map(category => ({ category, items: presets.filter(item => !item.archived && item.category === category).sort((a,b) => a.order-b.order || a.name.localeCompare(b.name)) }))
  const archived = presets.filter(item => item.archived).sort((a,b) => a.name.localeCompare(b.name))
  const requestMove = async (activity: ActivityPreset, category: ActivityGroup, index: number) => {
    if (activity.category === category) {
      const current = grouped.find(group => group.category === category)?.items ?? []
      if (current[index]?.id === activity.id || current.indexOf(activity) === index) return
    }
    const linked = await activityCounts(activity.id)
    if (linked.sessions || linked.plans) setPendingMove({ activity, category, index, counts: linked })
    else void run(() => moveActivity(activity.id, category, index))
  }
  const pointerTarget = (clientX: number, clientY: number) => {
    const node = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-category-drop]')
    if (!node) return null
    const category = node.dataset.categoryDrop as ActivityGroup
    const row = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-activity-row]')
    const ids = grouped.find(group => group.category === category)?.items.filter(item => item.id !== dragging).map(item => item.id) ?? []
    return { category, index: row?.dataset.activityId ? Math.max(0, ids.indexOf(row.dataset.activityId)) : ids.length }
  }
  const finishDrag = (event: React.PointerEvent<HTMLButtonElement>, activity: ActivityPreset) => {
    const target = pointerTarget(event.clientX, event.clientY)
    setDragging(null); setDragTarget(null)
    if (target) void requestMove(activity, target.category, target.index)
  }
  const restore = (activity: ActivityPreset) => {
    const order = presets.filter(item => !item.archived && item.category === activity.category).length
    void run(() => saveActivity({ ...activity, archived: false, order }))
  }
  return <div className="completion-backdrop"><section className="completion-sheet activity-manager" role="dialog" aria-modal="true" aria-label="Manage activities"><header><div><h1>Activities</h1><p>Drag activities to reorder them or move them into another category.</p></div><button className="sheet-close" type="button" onClick={onClose} aria-label="Close activities">×</button></header>{error && <p role="alert">{error}</p>}
    {editing ? <form onSubmit={event => { event.preventDefault(); void run(async () => { await saveActivity(editing, everywhere); setEditing(null) }) }}>
      <label className="note-field">Name<input required value={editing.name} onChange={event => setEditing({ ...editing, name: event.target.value })} /></label>
      {presets.some(item => item.id === editing.id) ? <div className="activity-category-readonly"><span>Category</span><strong>{editing.category}</strong><small>Drag this activity in the list to change its category.</small></div> : <label className="note-field">Category<select value={editing.category} onChange={event => setEditing({ ...editing, category: event.target.value as ActivityGroup })}>{Object.keys(categoryColors).map(name => <option key={name}>{name}</option>)}</select></label>}
      <label className="note-field">Color<input type="color" value={editing.color} onChange={event => setEditing({ ...editing, color: event.target.value })} /></label>
      <label className="note-field">Apply changes<select value={everywhere ? 'all' : 'future'} onChange={event => setEverywhere(event.target.value === 'all')}><option value="future">Future use only</option><option value="all">Update everywhere</option></select></label>
      {everywhere && <p>Saving updates {counts.sessions} completed sessions and {counts.plans} planned blocks linked to this activity.</p>}
      <button className="save-log" disabled={busy}>Save activity</button><button className="secondary-sheet-action" type="button" onClick={() => setEditing(null)}>Cancel editing</button>
    </form> : <div className="activity-manager-body"><button className="save-log create-activity" type="button" onClick={() => { setEverywhere(false); setCounts({ sessions: 0, plans: 0 }); setEditing({ id: crypto.randomUUID(), name: '', normalizedName: '', category: 'Focus', color: '#d92f6f', archived: false, order: presets.length, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }) }}>Create activity</button>
      <div className="activity-groups">{grouped.map(({category,items}) => <section className={`activity-group ${dragTarget === category ? 'drag-target' : ''}`} data-category-drop={category} key={category}><header><i style={{ background: categoryColors[category] }} /><h2>{category}</h2><span>{items.length}</span></header><div>{items.map(activity => <article className={dragging === activity.id ? 'dragging' : ''} data-activity-row data-activity-id={activity.id} key={activity.id}><button className="activity-drag-handle" type="button" aria-label={`Drag ${activity.name} to reorder or change category`} disabled={busy} onPointerDown={event => { setDragging(activity.id); event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={event => { if (!dragging) return; const target=pointerTarget(event.clientX,event.clientY); setDragTarget(target?.category ?? null) }} onPointerUp={event => finishDrag(event,activity)} onPointerCancel={() => { setDragging(null); setDragTarget(null) }}><GripVertical /></button><div><strong>{activity.name}</strong><small>{category}</small></div><button className="activity-menu-trigger" type="button" aria-label={`Actions for ${activity.name}`} aria-expanded={menu === activity.id} onClick={() => setMenu(menu === activity.id ? null : activity.id)}><MoreVertical /></button>{menu === activity.id && <div className="activity-row-menu"><button type="button" onClick={() => { setMenu(null); void edit(activity) }}>Edit activity</button><button type="button" onClick={() => { setMenu(null); void run(() => saveActivity({ ...activity, archived: true })) }}>Archive activity</button><span>Move to</span>{(Object.keys(activityGroups) as ActivityGroup[]).filter(value => value !== category).map(value => <button type="button" key={value} onClick={() => { setMenu(null); void requestMove(activity,value,grouped.find(group => group.category === value)?.items.length ?? 0) }}>{value}</button>)}</div>}</article>)}</div>{!items.length && <p>Drop an activity here.</p>}</section>)}</div>
      {archived.length > 0 && <section className="archived-activities"><button type="button" aria-expanded={archivedOpen} onClick={() => setArchivedOpen(!archivedOpen)}><span>Archived activities</span><b>{archived.length}</b><ChevronDown /></button>{archivedOpen && <div>{archived.map(activity => <article key={activity.id}><span><strong>{activity.name}</strong><small>{activity.category}</small></span><button type="button" onClick={() => restore(activity)}>Restore</button></article>)}</div>}</section>}
      {pendingMove && <div className="nested-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="move-activity-title"><section><h2 id="move-activity-title">Move {pendingMove.activity.name} to {pendingMove.category}?</h2><p>This activity is linked to {pendingMove.counts.sessions} completed {pendingMove.counts.sessions === 1 ? 'session' : 'sessions'} and {pendingMove.counts.plans} planned {pendingMove.counts.plans === 1 ? 'block' : 'blocks'}.</p><button type="button" onClick={() => { const move=pendingMove; setPendingMove(null); void run(() => moveActivity(move.activity.id,move.category,move.index)) }}>Future use only</button><button className="primary" type="button" onClick={() => { const move=pendingMove; setPendingMove(null); void run(() => moveActivity(move.activity.id,move.category,move.index,true)) }}>Update existing records</button><button type="button" onClick={() => setPendingMove(null)}>Cancel move</button></section></div>}
    </div>}
  </section></div>
}
