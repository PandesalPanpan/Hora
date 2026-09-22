import { CloudOff, Cloud, LoaderCircle, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/context'
import { syncNow } from './engine'
import { useSyncStatus } from './status'

export function SyncIndicator() {
  const auth = useAuth()
  const sync = useSyncStatus()
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  if (!auth.configured || auth.status === 'signed-out' || auth.status === 'loading') {
    return <span className="sync-indicator local" aria-label="Local data mode"><CloudOff aria-hidden="true" /><span>Local only</span></span>
  }

  if (auth.status === 'offline-known' || !online) {
    return <span className="sync-indicator offline" aria-label="Offline; changes are saved locally"><CloudOff aria-hidden="true" /><span>{sync.pending ? `${sync.pending} changes pending` : 'Offline · saved locally'}</span></span>
  }

  if (sync.phase === 'syncing') {
    return <span className="sync-indicator syncing" aria-label="Syncing changes"><LoaderCircle className="spin" aria-hidden="true" /><span>Syncing</span></span>
  }

  if (sync.phase === 'error') {
    return <button className="sync-indicator error" type="button" onClick={() => void syncNow()} aria-label="Retry cloud sync"><RefreshCw aria-hidden="true" /><span>{sync.pending ? `${sync.pending} pending · retry` : 'Sync error · retry'}</span></button>
  }

  if (sync.pending) {
    return <button className="sync-indicator pending" type="button" onClick={() => void syncNow()} aria-label="Sync pending changes"><Cloud aria-hidden="true" /><span>{sync.pending} {sync.pending === 1 ? 'change' : 'changes'} pending</span></button>
  }

  return <span className="sync-indicator synced" aria-label="Synced"><Cloud aria-hidden="true" /><span>Synced</span></span>
}
