import { ArrowLeft, Sparkles } from 'lucide-react'
import { currentVersion, releaseNotes } from '../features/releases/changelog'

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' })

export function ChangelogPage({ onBack }: { onBack: () => void }) {
  return (
    <section className="hora-page changelog-page">
      <header className="changelog-heading">
        <button type="button" onClick={onBack} aria-label="Back to your gentle corner"><ArrowLeft /></button>
        <div><span>Version {currentVersion}</span><h1>What’s new</h1><p>A gentle record of how Iza is growing.</p></div>
      </header>
      <div className="release-list">
        {releaseNotes.map((release, index) => (
          <article className="release-card" key={release.version}>
            <div className="release-marker"><Sparkles aria-hidden="true" /></div>
            <header><span>{index === 0 ? 'Latest' : 'Earlier'} · v{release.version}</span><time dateTime={release.date}>{dateFormatter.format(new Date(`${release.date}T12:00:00`))}</time></header>
            <h2>{release.title}</h2>
            <p>{release.summary}</p>
            <ul>{release.changes.map((change) => <li key={change}>{change}</li>)}</ul>
          </article>
        ))}
      </div>
    </section>
  )
}
