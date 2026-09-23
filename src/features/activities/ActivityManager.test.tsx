import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { db } from '../../lib/db'
import { ActivityManager } from './ActivityManager'
import { plannedBlockDisplayColor } from '../planner/presentation'
import type { ActivityPreset } from './types'

afterEach(cleanup)

const activity = (id: string, order: number): ActivityPreset => ({
  id,
  name: id === 'read' ? 'Read' : 'Write',
  normalizedName: id,
  category: 'Focus',
  color: '#d92f6f',
  archived: false,
  order,
  createdAt: '2026-09-16T00:00:00.000Z',
  updatedAt: '2026-09-16T00:00:00.000Z',
})

it('offers menu-based sorting without exposing arrow controls', async () => {
  await db.activities.bulkPut([activity('read',0),activity('write',1)])
  await db.sessions.put({ id: 'linked', activity: { id: 'write', name: 'Write', color: '#d92f6f', category: 'Focus' }, status: 'completed', startedAt: '2026-09-16T00:00:00.000Z', finishedAt: '2026-09-16T00:30:00.000Z' })
  render(<ActivityManager onClose={vi.fn()}/>)
  fireEvent.click(await screen.findByRole('button',{name:'Actions for Write'}))
  expect(screen.queryByText('↑')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Move up'}))
  await waitFor(async () => expect((await db.activities.orderBy('order').toArray()).map(item => item.id)).toEqual(['write','read']))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

it('previews HEX input and preset colors before saving the canonical value', async () => {
  await db.activities.put(activity('read',0))
  render(<ActivityManager onClose={vi.fn()}/> )
  fireEvent.click(await screen.findByRole('button',{name:'Actions for Read'}))
  fireEvent.click(screen.getByRole('button',{name:'Edit activity'}))

  const hex = await screen.findByLabelText('HEX value')
  expect(screen.getByRole('button',{name:'Current #D92F6F'})).toHaveAttribute('aria-pressed','true')
  fireEvent.change(hex,{target:{value:'#4f46e5'}})
  expect(screen.getByText('#4F46E5')).toBeInTheDocument()
  expect(screen.getByLabelText('Choose a custom color')).toHaveAttribute('type','color')

  fireEvent.click(screen.getByRole('button',{name:'Teal #328E89'}))
  expect(screen.getByText('#328E89')).toBeInTheDocument()
  expect(screen.getByRole('button',{name:'Teal #328E89'})).toHaveAttribute('aria-pressed','true')
  fireEvent.click(screen.getByRole('button',{name:'Save activity'}))
  await waitFor(async () => expect((await db.activities.get('read'))?.color).toBe('#328E89'))
})

it('keeps an invalid HEX value from being saved', async () => {
  await db.activities.put(activity('read',0))
  render(<ActivityManager onClose={vi.fn()}/> )
  fireEvent.click(await screen.findByRole('button',{name:'Actions for Read'}))
  fireEvent.click(screen.getByRole('button',{name:'Edit activity'}))
  fireEvent.change(await screen.findByLabelText('HEX value'),{target:{value:'#GGGGGG'}})
  fireEvent.click(screen.getByRole('button',{name:'Save activity'}))

  expect(await screen.findByText('Enter a 3- or 6-digit HEX color.')).toBeInTheDocument()
  expect((await db.activities.get('read'))?.color).toBe('#d92f6f')
})

it('saves a HEX color while preserving a linked planned title', async () => {
  await db.activities.put(activity('read',0))
  await db.plannedBlocks.put({id:'biology',activityId:'read',title:'Biology Class',category:'Focus',color:'#D92F6F',startedAt:'2026-09-16T09:00:00.000Z',finishedAt:'2026-09-16T10:00:00.000Z'})
  render(<ActivityManager onClose={vi.fn()}/> )
  fireEvent.click(await screen.findByRole('button',{name:'Actions for Read'}))
  fireEvent.click(screen.getByRole('button',{name:'Edit activity'}))
  fireEvent.change(await screen.findByLabelText('HEX value'),{target:{value:'#22c55e'}})
  fireEvent.change(screen.getByLabelText('Apply changes to'),{target:{value:'all'}})
  fireEvent.click(screen.getByRole('button',{name:'Save activity'}))

  await waitFor(async () => expect((await db.activities.get('read'))?.color).toBe('#22C55E'))
  expect(await db.plannedBlocks.get('biology')).toMatchObject({activityId:'read',title:'Biology Class',color:'#22C55E'})
})

it('keeps custom titles and shows the current Activity color with Activity-only changes', async () => {
  await db.activities.put(activity('read',0))
  await db.plannedBlocks.put({id:'biology',activityId:'read',title:'Biology Class',category:'Focus',color:'#D92F6F',startedAt:'2026-09-16T09:00:00.000Z',finishedAt:'2026-09-16T10:00:00.000Z'})
  render(<ActivityManager onClose={vi.fn()}/> )
  fireEvent.click(await screen.findByRole('button',{name:'Actions for Read'}))
  fireEvent.click(screen.getByRole('button',{name:'Edit activity'}))
  fireEvent.change(await screen.findByLabelText('HEX value'),{target:{value:'#22C55E'}})
  fireEvent.click(screen.getByRole('button',{name:'Save activity'}))

  await waitFor(async () => expect((await db.activities.get('read'))?.color).toBe('#22C55E'))
  const plan = await db.plannedBlocks.get('biology')
  const savedActivity = await db.activities.get('read')
  expect(plan).toMatchObject({activityId:'read',title:'Biology Class',color:'#D92F6F'})
  expect(plannedBlockDisplayColor(plan!, [savedActivity!])).toBe('#22C55E')
})
