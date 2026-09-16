import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { db } from '../../lib/db'
import { ActivityManager } from './ActivityManager'
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
