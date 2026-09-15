import { describe, expect, it } from 'vitest'
import { normalizeActivityName } from './types'

describe('activity names', () => {
  it('trims and case-folds names for uniqueness including archived records', () => expect(normalizeActivityName('  Self Study ')).toBe(normalizeActivityName('self study')))
})
