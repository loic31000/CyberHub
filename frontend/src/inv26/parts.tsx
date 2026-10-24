import type { EventSeverity, EventType, InvestigationStatus } from '@/types/investigation'

/* Shared pieces of Investigations 2026: labels follow the API's own values only. */

export const STATUSES: InvestigationStatus[] = ['open', 'closed', 'archived']

export const STATUS_LABEL: Record<InvestigationStatus, string> = {
  open: 'Ouverte', closed: 'Clôturée', archived: 'Archivée',
}

export const SEVERITIES: EventSeverity[] = ['critical', 'high', 'medium', 'low', 'info']

export const SEVERITY_LABEL: Record<EventSeverity, string> = {
  critical: 'Critique', high: 'Élevée', medium: 'Moyenne', low: 'Faible', info: 'Info',
}

export const EVENT_TYPES: EventType[] = ['manual', 'note', 'ioc', 'cve', 'bgp', 'mitre', 'playbook']

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  manual: 'Manuel', note: 'Note', ioc: 'IOC', cve: 'CVE', bgp: 'BGP', mitre: 'MITRE', playbook: 'Playbook',
}

export function StatusBadge({ status }: { status: InvestigationStatus }) {
  return <span className="iv26-status" data-status={status}><i aria-hidden="true" />{STATUS_LABEL[status] ?? status}</span>
}

/* Tags are free text in the API; commas, semicolons and spaces after "#" separate them. */
export function splitTags(tags: string | undefined): string[] {
  return [...new Set((tags ?? '').split(/[,;]/).map(t => t.trim().replace(/^#/, '')).filter(Boolean))]
}

export function Tags({ tags, max = 4 }: { tags: string; max?: number }) {
  const list = splitTags(tags)
  if (!list.length) return <span className="iv26-muted">—</span>
  return (
    <span className="iv26-tags">
      {list.slice(0, max).map(t => <span key={t}>{t}</span>)}
      {list.length > max && <small>+{list.length - max}</small>}
    </span>
  )
}

/** A date from the API, or null for empty values and Go zero times. */
export function validDate(iso: string | undefined | null): Date | null {
  if (!iso || iso.startsWith('0001')) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

const day = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const dayTime = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
export const formatDay = (iso: string | undefined | null) => { const d = validDate(iso); return d ? day.format(d) : '—' }
export const formatDayTime = (iso: string | undefined | null) => { const d = validDate(iso); return d ? dayTime.format(d) : '—' }
