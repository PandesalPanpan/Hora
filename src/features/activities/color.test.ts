import { describe, expect, it } from 'vitest'
import { mixHexColors, normalizeHexColor, readableColorForeground } from './color'

describe('activity colors', () => {
  it('normalizes six-digit input with or without a hash', () => {
    expect(normalizeHexColor('#22c55e')).toBe('#22C55E')
    expect(normalizeHexColor('6366f1')).toBe('#6366F1')
  })

  it('expands three-digit shorthand and rejects malformed values', () => {
    expect(normalizeHexColor('#a3f')).toBe('#AA33FF')
    for (const value of ['#GGGGGG', '#12345', 'banana', '#12345678', '']) {
      expect(normalizeHexColor(value)).toBeNull()
    }
  })

  it('chooses a high-contrast foreground for dark and light colors', () => {
    expect(readableColorForeground('#4F46E5')).toBe('#FFFFFF')
    expect(readableColorForeground('#F5C8B8')).toBe('#000000')
  })

  it('calculates accessible text against the rendered live-event blend', () => {
    const liveBackground = mixHexColors('#777777', '#6C203E', 0.88)
    expect(liveBackground).toBe('#766D70')
    expect(readableColorForeground(liveBackground!)).toBe('#FFFFFF')
  })

  it('chooses readable text for color-tinted history badges', () => {
    const badgeBackground = mixHexColors('#000000', '#FFFFFF', 0.32)
    expect(badgeBackground).toBe('#ADADAD')
    expect(readableColorForeground(badgeBackground!)).toBe('#000000')
  })
})
