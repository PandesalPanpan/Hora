/** Normalize supported CSS hex colors to the app's canonical #RRGGBB form. */
export function normalizeHexColor(value: string): string | null {
  const input = value.trim()
  const digits = input.startsWith('#') ? input.slice(1) : input
  if (!/^(?:[\da-f]{3}|[\da-f]{6})$/i.test(digits)) return null
  const expanded = digits.length === 3
    ? [...digits].map(character => `${character}${character}`).join('')
    : digits
  return `#${expanded.toUpperCase()}`
}

/** Blend HEX colors like CSS `color-mix(in srgb, color weight%, other)`. */
export function mixHexColors(colorValue: string, otherValue: string, colorWeight: number): string | null {
  const color = normalizeHexColor(colorValue)
  const other = normalizeHexColor(otherValue)
  if (!color || !other || !Number.isFinite(colorWeight)) return null
  const weight = Math.max(0, Math.min(1, colorWeight))
  const channels = [1, 3, 5].map(index => {
    const first = Number.parseInt(color.slice(index, index + 2), 16)
    const second = Number.parseInt(other.slice(index, index + 2), 16)
    return Math.round(first * weight + second * (1 - weight)).toString(16).padStart(2, '0')
  })
  return `#${channels.join('')}`.toUpperCase()
}

/** Pick whichever monochrome foreground has the stronger WCAG contrast. */
export function readableColorForeground(value: string): '#000000' | '#FFFFFF' {
  const color = normalizeHexColor(value)
  if (!color) return '#000000'

  const channels = [1, 3, 5].map(index => Number.parseInt(color.slice(index, index + 2), 16) / 255)
  const luminance = channels
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0)
  const blackContrast = (luminance + 0.05) / 0.05
  const whiteContrast = 1.05 / (luminance + 0.05)
  return blackContrast >= whiteContrast ? '#000000' : '#FFFFFF'
}
