export function toLocalInput(iso: string): string {
  const date = new Date(iso)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

/** Retain the original instant (including ambiguous DST offsets) for untouched inputs. */
export function parseLocalEdit(value: string, original: string, seconds?: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Invalid local time')
  if (seconds !== undefined && (!/^\d{1,2}$/.test(seconds) || Number(seconds) > 59)) throw new Error('Seconds must be 0–59')
  if (value === toLocalInput(original) && seconds === undefined) return original
  const date = new Date(value)
  if (!Number.isFinite(date.getTime()) || toLocalInput(date.toISOString()) !== value) throw new Error('Invalid local time')
  const previous = new Date(original)
  date.setSeconds(seconds === undefined ? previous.getSeconds() : Number(seconds), seconds === undefined ? previous.getMilliseconds() : 0)
  return date.toISOString()
}
