import { describe, expect, it } from 'vitest'
import { parseLocalEdit, toLocalInput } from './completionTime'
describe('precise local editing', () => {
  const original = new Date(2026, 8, 15, 14, 2, 37, 123).toISOString()
  it('preserves an untouched instant exactly', () => expect(parseLocalEdit(toLocalInput(original), original)).toBe(original))
  it('retains seconds and milliseconds on minute edits', () => {
    const result = new Date(parseLocalEdit('2026-09-16T09:12', original))
    expect([result.getDate(), result.getHours(), result.getMinutes(), result.getSeconds(), result.getMilliseconds()]).toEqual([16,9,12,37,123])
  })
  it.each(['00', '59'])('sets explicit seconds %s and clears milliseconds', (seconds) => {
    const result = new Date(parseLocalEdit(toLocalInput(original), original, seconds))
    expect(result.getSeconds()).toBe(Number(seconds)); expect(result.getMilliseconds()).toBe(0)
  })
  it.each(['60', '-1', '', '1.5'])('rejects invalid seconds %s', (seconds) => expect(() => parseLocalEdit(toLocalInput(original), original, seconds)).toThrow())
  it('rejects invalid dates', () => expect(() => parseLocalEdit('2026-02-30T12:00', original)).toThrow())
})
