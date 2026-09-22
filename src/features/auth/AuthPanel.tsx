import { useState } from 'react'
import { LogOut, Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from './context'
import { describeAuthError } from './service'

export function AuthPanel() {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'create'>('signin')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      if (mode === 'create') await auth.createAccount(email, password)
      else await auth.signInEmail(email, password)
    } catch (error) {
      setMessage(describeAuthError(error))
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    setBusy(true)
    setMessage('')
    try {
      await auth.signInGoogle()
    } catch (error) {
      setMessage(describeAuthError(error))
    } finally {
      setBusy(false)
    }
  }

  if (!auth.configured) {
    return <section className="auth-card" aria-labelledby="cloud-sync-title"><header><ShieldCheck /><div><h2 id="cloud-sync-title">Cloud sync</h2><p>Local tracking is ready. Add the Firebase environment values to enable account sync.</p></div></header></section>
  }

  if (auth.status === 'authenticated' || auth.status === 'offline-known') {
    return <section className="auth-card" aria-labelledby="cloud-sync-title"><header><ShieldCheck /><div><h2 id="cloud-sync-title">{auth.status === 'offline-known' ? 'Your account, offline' : 'Cloud sync is on'}</h2><p>{auth.user?.displayName || auth.user?.email || 'Signed-in account'}{auth.status === 'offline-known' ? ' · changes will wait for internet' : ' · your local data syncs in the background'}</p></div></header><button className="secondary-sheet-action auth-signout" type="button" onClick={() => void auth.signOut()}><LogOut aria-hidden="true" />Sign out</button></section>
  }

  return <section className="auth-card" aria-labelledby="cloud-sync-title"><header><ShieldCheck /><div><h2 id="cloud-sync-title">Back up across devices</h2><p>On a new device, first sign-in needs internet. Hora still works locally without it.</p></div></header><button className="google-auth-button" type="button" onClick={() => void google()} disabled={busy}><span className="google-mark" aria-hidden="true">G</span>{busy ? 'Connecting…' : 'Continue with Google'}</button><div className="auth-divider"><span>or use email</span></div><form onSubmit={(event) => void submit(event)}><label className="note-field">Email<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label><label className="note-field">Password<input type="password" autoComplete={mode === 'create' ? 'new-password' : 'current-password'} minLength={6} required value={password} onChange={event => setPassword(event.target.value)} /></label>{message && <p className="auth-message" role="alert">{message}</p>}<button className="save-log" type="submit" disabled={busy}><Mail aria-hidden="true" />{mode === 'create' ? 'Create account' : 'Sign in'}</button></form><button className="auth-mode-toggle" type="button" onClick={() => { setMode(mode === 'create' ? 'signin' : 'create'); setMessage('') }}>{mode === 'create' ? 'Already have an account? Sign in' : 'New here? Create an account'}</button></section>
}
