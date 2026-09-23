import { describe, expect, it } from 'vitest'
import { plannedBlockDisplayColor, plannedBlockDisplayTitle } from './presentation'

const study = { id: 'study', name: 'Study', color: '#22c55e' }

describe('planned block presentation', () => {
  it('keeps a custom block title while using the current linked Activity color', () => {
    const block = { title: 'Biology Class', activityId: 'study', color: '#B92F60' }
    expect(plannedBlockDisplayTitle(block, [study])).toBe('Biology Class')
    expect(plannedBlockDisplayColor(block, [study])).toBe('#22C55E')
  })

  it('uses the current Activity name only as a display fallback', () => {
    const block = { title: '', activityId: 'study', color: '#B92F60' }
    expect(plannedBlockDisplayTitle(block, [study])).toBe('Study')
    expect(block.title).toBe('')
    expect(plannedBlockDisplayTitle({ ...block, activityId: undefined }, [])).toBe('Planned block')
  })

  it('keeps an unlinked block color and its explicit title', () => {
    const block = { title: 'Quiet reading', activityId: undefined, color: '#AABBCC' }
    expect(plannedBlockDisplayTitle(block, [study])).toBe('Quiet reading')
    expect(plannedBlockDisplayColor(block, [study])).toBe('#AABBCC')
  })
})
