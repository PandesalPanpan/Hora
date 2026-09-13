import { BellRing, Database, Smartphone } from 'lucide-react'
import { IzaCharacter } from '../components/IzaCharacter'

export function SettingsPage() {
  return (
    <section className="feature-page settings-page">
      <header className="feature-heading"><div><p>Make Iza yours</p><h1>Settings</h1></div></header>
      <div className="settings-intro"><IzaCharacter compact mood="encouraging" /><p>Iza is ready for mobile. Native notification controls will appear here when goal reminders are connected.</p></div>
      <div className="settings-list">
        <article><Smartphone /><div><strong>Android app</strong><span>Capacitor shell configured</span></div><b>Ready</b></article>
        <article><Database /><div><strong>Offline data</strong><span>Stored on this device first</span></div><b>Local</b></article>
        <article><BellRing /><div><strong>Goal reminders</strong><span>Native integration is the next device milestone</span></div><b>Next</b></article>
      </div>
    </section>
  )
}
