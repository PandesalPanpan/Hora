import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Planner } from './Planner'
import { db } from '../../lib/db'
afterEach(cleanup)
it('makes every hidden collision reachable in the overflow sheet', async () => {
  window.history.replaceState(null,'','#/planner?view=day&date=2026-09-15')
  Object.defineProperty(window,'innerWidth',{value:320,configurable:true})
  await db.plannedBlocks.bulkPut(['a','b','c','d'].map(id => ({id,title:`Plan ${id}`,category:'Focus' as const,color:'#b92f60',startedAt:new Date(2026,8,15,14).toISOString(),finishedAt:new Date(2026,8,15,15).toISOString()})))
  render(<Planner active={null} completed={[]} elapsed={0} onFinish={vi.fn()} onStart={vi.fn()}/> )
  fireEvent.click(await screen.findByRole('button',{name:/Show 2 more events/}))
  const dialog = screen.getByRole('dialog',{name:'Overlapping events'})
  expect(within(dialog).getAllByRole('button')).toHaveLength(5)
  fireEvent.click(within(dialog).getByRole('button',{name:/Plan d/}))
  expect(screen.getByRole('region',{name:'Plan d details'})).toBeInTheDocument()
})
it('opens route-backed recurring occurrences after loading records', async () => {
  window.history.replaceState(null,'','#/planner?view=day&date=2026-09-15&block=series%3A2026-09-15')
  await db.plannedBlocks.put({id:'series',title:'Class',category:'Focus',color:'#b92f60',startedAt:new Date(2026,8,14,14).toISOString(),finishedAt:new Date(2026,8,14,15).toISOString(),recurrence:{frequency:'daily',endsOn:'2026-09-16'}})
  render(<Planner active={null} completed={[]} elapsed={0} onFinish={vi.fn()} onStart={vi.fn()}/> )
  expect(await screen.findByRole('region',{name:'Class details'})).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Edit planned block'}))
  expect(screen.getByLabelText('Apply changes')).toHaveValue('one')
})
it('keeps planned and completed Timeflow notes available from calendar events', async () => {
  window.history.replaceState(null,'','#/planner?view=day&date=2026-09-15')
  await db.plannedBlocks.put({id:'plan-note',title:'Read chapter',note:'Bring the blue workbook',category:'Focus',color:'#b92f60',startedAt:new Date(2026,8,15,9).toISOString(),finishedAt:new Date(2026,8,15,10).toISOString()})
  render(<Planner active={null} completed={[{id:'log-note',activity:{id:'study',name:'Study',color:'#b92f60'},startedAt:new Date(2026,8,15,11).toISOString(),finishedAt:new Date(2026,8,15,12).toISOString(),note:'Reviewed chapter five'}]} elapsed={0} onFinish={vi.fn()} onStart={vi.fn()}/> )
  fireEvent.click(await screen.findByRole('button',{name:/Read chapter Planned/}))
  expect(within(screen.getByRole('region',{name:'Read chapter details'})).getByText('Bring the blue workbook')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Close details'}))
  fireEvent.click(screen.getByRole('button',{name:/Study Tracked/}))
  expect(within(screen.getByRole('region',{name:'Study details'})).getByText('Reviewed chapter five')).toBeInTheDocument()
})
it('opens the time-log editor action for a completed Planner event', async () => {
  window.history.replaceState(null,'','#/planner?view=day&date=2026-09-15')
  const session = {id:'log-edit',activity:{id:'study',name:'Study',color:'#b92f60'},startedAt:new Date(2026,8,15,11).toISOString(),finishedAt:new Date(2026,8,15,12).toISOString()}
  const review = vi.fn()
  render(<Planner active={null} completed={[session]} elapsed={0} onFinish={vi.fn()} onStart={vi.fn()} onReview={review}/> )
  fireEvent.click(await screen.findByRole('button',{name:/Study Tracked/}))
  fireEvent.click(screen.getByRole('button',{name:'Edit time log'}))
  expect(review).toHaveBeenCalledWith(session)
})
it('persists an optional planned-block reminder without changing the block model', async () => {
  window.history.replaceState(null,'','#/planner?view=day&date=2026-09-15')
  render(<Planner active={null} completed={[]} elapsed={0} onFinish={vi.fn()} onStart={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Add block' }))
  fireEvent.change(screen.getByLabelText('What are you planning?'), { target: { value: 'Review biology notes' } })
  fireEvent.change(screen.getByLabelText('Remind me'), { target: { value: '15' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save as planned' }))
  await screen.findByRole('button', { name: 'Review biology notes Planned' })
  expect(await db.plannedBlocks.count()).toBe(1)
  expect((await db.plannedBlocks.toArray())[0]).toMatchObject({ title: 'Review biology notes', reminderMinutesBefore: 15 })
})
