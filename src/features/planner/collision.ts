type TimedEvent = { id: string; start: Date; end: Date }
export type CollisionItem<T> = { event: T; lane: number; top: number; height: number }
export type CollisionGroup<T> = { items: CollisionItem<T>[]; lanes: number; top: number; bottom: number }
export function collisionGroups<T extends TimedEvent>(events: T[], pixelsPerMinute = 68 / 60, minimumHeight = 58): CollisionGroup<T>[] {
  const ordered = [...events].sort((a,b) => +a.start - +b.start || (+b.end - +b.start) - (+a.end - +a.start) || a.id.localeCompare(b.id))
  const groups: CollisionGroup<T>[] = []
  let laneEnds: number[] = []
  for (const event of ordered) {
    const top = (event.start.getHours() * 60 + event.start.getMinutes() + event.start.getSeconds() / 60) * pixelsPerMinute
    const height = Math.max(minimumHeight, (+event.end - +event.start) / 60000 * pixelsPerMinute)
    let group = groups.at(-1)
    if (!group || top >= group.bottom) { group = { items: [], lanes: 0, top, bottom: top + height }; groups.push(group); laneEnds = [] }
    let lane = laneEnds.findIndex(end => end <= top)
    if (lane < 0) lane = laneEnds.length
    laneEnds[lane] = top + height
    group.items.push({ event, lane, top, height }); group.lanes = laneEnds.length; group.bottom = Math.max(group.bottom, top + height)
  }
  return groups
}
export function visibleGroup<T>(group: CollisionGroup<T>, limit: number) {
  return { visible: group.items.filter(item => item.lane < limit), hidden: group.items.filter(item => item.lane >= limit) }
}
