import type { PlannedBlock } from './types'

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export type RecurrenceExpansionOptions = {
  from?: Date
  until?: Date
}

export function expandRecurringBlock(block: PlannedBlock, options: RecurrenceExpansionOptions | number = {}): PlannedBlock[] {
  if (!block.recurrence) return [block]
  const expansion = typeof options === 'number' ? {} : options
  const start = new Date(block.startedAt); const end = new Date(block.finishedAt)
  const finalDate = new Date(`${block.recurrence.endsOn}T23:59:59`); const result: PlannedBlock[] = []
  for (const day = new Date(start); day <= finalDate && (!expansion.until || day <= expansion.until); day.setDate(day.getDate() + 1)) {
    if (block.recurrence.frequency === 'weekdays' && !block.recurrence.weekdays?.includes(day.getDay())) continue
    const occurrenceStart = new Date(day); occurrenceStart.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds())
    if (expansion.from && occurrenceStart < expansion.from) continue
    const key = dateKey(occurrenceStart)
    if (block.excludedDates?.includes(key)) continue
    const occurrenceEnd = new Date(day); occurrenceEnd.setHours(end.getHours(), end.getMinutes(), end.getSeconds(), end.getMilliseconds()); if (occurrenceEnd <= occurrenceStart) occurrenceEnd.setDate(occurrenceEnd.getDate() + 1)
    result.push({ ...block, id: `${block.id}:${key}`, recurrenceSeriesId: block.recurrenceSeriesId ?? block.id, occurrenceDate: key, startedAt: occurrenceStart.toISOString(), finishedAt: occurrenceEnd.toISOString() })
  }
  return result
}

export function splitRecurringBlock(block: PlannedBlock, fromDate: string, patch: Partial<PlannedBlock>) {
  if (!block.recurrence) return { past: block, future: { ...block, ...patch } }
  const dayBefore = new Date(`${fromDate}T12:00:00`); dayBefore.setDate(dayBefore.getDate() - 1)
  const occurrence = expandRecurringBlock({ ...block, excludedDates: [] }).find(item => item.occurrenceDate === fromDate)
  if (!occurrence) throw new Error('Occurrence is outside this series')
  const id = crypto.randomUUID()
  return {
    past: { ...block, recurrence: { ...block.recurrence, endsOn: dateKey(dayBefore) }, excludedDates: block.excludedDates?.filter(date => date < fromDate) },
    future: { ...block, startedAt: occurrence.startedAt, finishedAt: occurrence.finishedAt, ...patch, id, recurrenceSeriesId: id, occurrenceDate: undefined, excludedDates: block.excludedDates?.filter(date => date >= fromDate) },
  }
}

/** Return replacements for one source record; detached exceptions remain separate records. */
export function changeOccurrence(block: PlannedBlock, date: string, scope: 'one' | 'future', patch?: Partial<PlannedBlock>): PlannedBlock[] {
  if (!block.recurrence) return patch ? [{ ...block, ...patch, id: block.id }] : []
  if (scope === 'future') {
    const { past, future } = splitRecurringBlock(block, date, patch ?? {})
    return patch ? [past, future] : [past]
  }
  const original = expandRecurringBlock(block).find(item => item.occurrenceDate === date)
  if (!original) throw new Error('Occurrence is no longer available')
  const parent = { ...block, excludedDates: [...new Set([...(block.excludedDates ?? []), date])] }
  return patch ? [parent, { ...original, ...patch, id: crypto.randomUUID(), recurrence: undefined, excludedDates: undefined, detachedFromSeries: true }] : [parent]
}
