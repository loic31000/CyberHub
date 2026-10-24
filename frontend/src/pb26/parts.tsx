import type { Playbook, PlaybookStep } from '@/types'

/* Shared pieces of Playbooks 2026: scenario labels, progress and dates. */

/* Labels for the scenarios the backend seeds; any other slug shows as typed. */
export const SCENARIO_LABEL: Record<string, string> = {
  ransomware: 'Ransomware',
  phishing: 'Phishing',
  'brute-force': 'Brute force',
  'active-directory': 'Active Directory',
  'data-exfiltration': 'Exfiltration',
  'web-shell': 'Web shell',
  'supply-chain': 'Supply chain',
  ddos: 'DDoS',
  'insider-threat': 'Menace interne',
  'cloud-breach': 'Cloud',
  'zero-day': 'Zero-day',
  'lateral-movement': 'Mouvement latéral',
  'privilege-escalation': 'Escalade de privilèges',
  'sql-injection': 'Injection SQL',
  malware: 'Malware',
  'api-breach': 'API / tokens',
  'pentest-web': 'Pentest web',
}

export const scenarioLabel = (slug: string | undefined) =>
  slug ? SCENARIO_LABEL[slug] ?? slug : 'Sans scénario'

/* Scenario slugs as the form stores them: lower case, dashes, no accents. */
export function toSlug(value: string): string {
  return value
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 48)
}

export type ProgressState = 'empty' | 'todo' | 'active' | 'done'

export const PROGRESS_LABEL: Record<ProgressState, string> = {
  empty: 'Sans étape', todo: 'Non démarré', active: 'En cours', done: 'Terminé',
}

export interface Progress { done: number; total: number; pct: number; state: ProgressState }

/* Progress counts the checked steps only; a playbook without steps is never "done". */
export function progressOf(steps: PlaybookStep[] | undefined | null): Progress {
  const list = steps ?? []
  const total = list.length
  const done = list.filter(s => s.checked).length
  const pct = total ? Math.round((done / total) * 100) : 0
  const state: ProgressState = !total ? 'empty' : done === 0 ? 'todo' : done === total ? 'done' : 'active'
  return { done, total, pct, state }
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/* Search covers title, scenario (slug and label), description and step text. */
export function matchesQuery(pb: Playbook, query: string): boolean {
  const q = fold(query.trim())
  if (!q) return true
  const haystack = [pb.title, pb.scenario, scenarioLabel(pb.scenario), pb.description, ...(pb.steps ?? []).map(s => s.content)]
  return q.split(/\s+/).every(term => haystack.some(h => fold(h ?? '').includes(term)))
}

/* Steps in their checklist order, whatever order the API sent them in. */
export const orderedSteps = (steps: PlaybookStep[] | undefined | null) =>
  [...(steps ?? [])].sort((a, b) => a.order - b.order || a.id - b.id)

/* A thin trace that fills with the checked share; the numbers carry the meaning. */
export function ProgressMeter({ progress, label }: { progress: Progress; label?: string }) {
  return (
    <div className="pb26-meter" data-progress={progress.state} role={label ? 'img' : undefined} aria-label={label}>
      <span className="pb26-meter-track" aria-hidden="true"><i style={{ width: `${progress.pct}%` }} /></span>
    </div>
  )
}

/* The state as a dot and a word, quiet unless the playbook is under way. */
export function ProgressBadge({ state }: { state: ProgressState }) {
  return <span className="pb26-badge" data-progress={state}><i aria-hidden="true" />{PROGRESS_LABEL[state]}</span>
}

/** A date from the API, or null for empty values and Go zero times. */
export function validDate(iso: string | undefined | null): Date | null {
  if (!iso || iso.startsWith('0001')) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

const day = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
export const formatDay = (iso: string | undefined | null) => { const d = validDate(iso); return d ? day.format(d) : '—' }

/* The backend's own message when it sent one, else the fallback. */
export function apiError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { error?: unknown } } })?.response?.data?.error
  return typeof message === 'string' && message.trim() ? message : fallback
}

export const isNotFound = (err: unknown) => (err as { response?: { status?: number } })?.response?.status === 404
