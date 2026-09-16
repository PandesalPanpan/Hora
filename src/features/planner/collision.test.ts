import { describe, expect, it } from 'vitest'
import { collisionGroups, visibleGroup } from './collision'
const event = (id: string, start: number, end: number, kind = 'planned') => ({ id, start: new Date(start * 60000), end: new Date(end * 60000), kind })
describe('calendar collision layout', () => {
  it('assigns same-kind and mixed events deterministic lanes', () => {
    const items = [event('c', 0, 60, 'live'), event('b', 0, 60, 'completed'), event('a', 0, 90)]
    expect(collisionGroups(items, 1, 0)[0].items.map(x => [x.event.id, x.lane])).toEqual([['a',0],['b',1],['c',2]])
    expect(collisionGroups([...items].reverse(), 1, 0)).toEqual(collisionGroups(items, 1, 0))
  })
  it('groups transitive collisions and reuses lanes', () => {
    const groups = collisionGroups([event('a',0,30),event('b',20,50),event('c',40,70)],1,0)
    expect(groups).toHaveLength(1); expect(groups[0].lanes).toBe(2)
  })
  it('keeps exact boundaries separate', () => expect(collisionGroups([event('a',0,30),event('b',30,60)],1,0)).toHaveLength(2))
  it('accounts for short visual boxes without changing real times', () => {
    const groups = collisionGroups([event('a',0,5),event('b',10,15)],1,44)
    expect(groups).toHaveLength(1); expect(groups[0].items[0].event.end.getTime()).toBe(300000)
  })
  it('reports every hidden entry', () => {
    const group = collisionGroups([event('a',0,60),event('b',0,60),event('c',0,60)],1,44)[0]
    const result = visibleGroup(group,2)
    expect(result.visible).toHaveLength(2); expect(result.hidden).toHaveLength(1)
  })
})
