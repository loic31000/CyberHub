import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Network, PenLine, ShieldAlert, ShieldBan, StickyNote, Terminal, Trash2, type LucideIcon } from 'lucide-react'
import type { EventType, InvestigationEvent } from '@/types/investigation'
import { EVENT_TYPE_LABEL, SEVERITY_LABEL, validDate } from './parts'

const TYPE_ICON: Record<EventType, LucideIcon> = {
  manual: PenLine, note: StickyNote, ioc: ShieldBan, cve: ShieldAlert, bgp: Network, mitre: Terminal, playbook: BookOpen,
}

const dayLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const clock = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

/*
 * A link to the source of an event, only when the reference says what it is:
 * a public CVE identifier (catalogue search), a local CVE record id (its
 * page), or an explicit ASN (its BGP Historian snapshots). Any other
 * reference stays plain text: a bare BGP number may be an alert, a snapshot
 * or an ASN, and no page is claimed for it.
 */
export function sourceLink(event: Pick<InvestigationEvent, 'source_module' | 'source_entity_id'>): string | null {
  const module = event.source_module.trim().toLowerCase()
  const ref = event.source_entity_id.trim()
  if (module === 'cve' && /^CVE-\d{4}-\d{4,}$/i.test(ref)) return `/cve?find=${encodeURIComponent(ref.toUpperCase())}`
  if (module === 'cve' && /^[1-9]\d*$/.test(ref)) return `/cve/${ref}`
  const asn = /^AS([1-9]\d*)$/i.exec(ref)
  if (module === 'bgp' && asn) return `/bgp/historian?asn=${asn[1]}`
  return null
}

/* Metadata kept as written: pretty JSON when it parses, the raw text otherwise. */
function Metadata({ value }: { value: string }) {
  const [open, setOpen] = useState(false)
  let text = value
  try { text = JSON.stringify(JSON.parse(value), null, 2) } catch { /* free text */ }
  return (
    <details className="iv26-meta" onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>Métadonnées</summary>
      {open && <pre>{text}</pre>}
    </details>
  )
}

function EventCard({ event, onDelete }: { event: InvestigationEvent; onDelete: (event: InvestigationEvent) => void }) {
  const Icon = TYPE_ICON[event.event_type] ?? PenLine
  const at = validDate(event.timestamp)
  const link = sourceLink(event)
  const source = [event.source_module, event.source_entity_id].filter(s => s.trim()).join(' · ')
  return (
    <li className="iv26-event" data-severity={event.severity}>
      <span className="iv26-event-dot" aria-hidden="true" />
      <article className="iv26-event-card" aria-labelledby={`iv26-event-${event.id}`}>
        <header>
          <time dateTime={event.timestamp}>{at ? clock.format(at) : '—'}</time>
          <span className="iv26-type"><Icon size={13} aria-hidden="true" />{EVENT_TYPE_LABEL[event.event_type] ?? event.event_type}</span>
          <span className="iv26-sev">{SEVERITY_LABEL[event.severity] ?? event.severity}</span>
          <button type="button" className="iv26-icon-btn is-danger" aria-label={`Supprimer l’événement ${event.title}`} title="Supprimer" onClick={() => onDelete(event)}><Trash2 size={14} /></button>
        </header>
        <h4 id={`iv26-event-${event.id}`}>{event.title}</h4>
        {event.description && <p>{event.description}</p>}
        {(source || event.metadata) && (
          <footer>
            {source && (link
              ? <Link to={link} className="iv26-source">Source : {source}</Link>
              : <span className="iv26-source">Source : {source}</span>)}
            {event.metadata && <Metadata value={event.metadata} />}
          </footer>
        )}
      </article>
    </li>
  )
}

/* Events grouped by local day, in the order the API returned them. */
export function groupByDay(events: InvestigationEvent[]) {
  const groups: { key: string; label: string; events: InvestigationEvent[] }[] = []
  for (const event of events) {
    const at = validDate(event.timestamp)
    const key = at ? `${at.getFullYear()}-${at.getMonth()}-${at.getDate()}` : 'unknown'
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.events.push(event)
    else groups.push({ key, label: at ? dayLabel.format(at) : 'Date inconnue', events: [event] })
  }
  return groups
}

export default function Timeline({ events, onDelete }: { events: InvestigationEvent[]; onDelete: (event: InvestigationEvent) => void }) {
  return (
    <div className="iv26-timeline">
      {groupByDay(events).map(group => (
        <section key={group.key} className="iv26-day" aria-label={group.label}>
          <h3>{group.label}<small>{group.events.length} événement{group.events.length > 1 ? 's' : ''}</small></h3>
          <ol>{group.events.map(event => <EventCard key={event.id} event={event} onDelete={onDelete} />)}</ol>
        </section>
      ))}
    </div>
  )
}
