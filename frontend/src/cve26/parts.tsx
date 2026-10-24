import type { ReactNode } from 'react'
import { Flame } from 'lucide-react'
import type { CVESeverity, CVEStatus } from '@/types'

/*
 * Shared pieces of CVE & KEV 2026. CVSS, CISA KEV and EPSS answer different
 * questions (technical severity, confirmed exploitation, probability of
 * exploitation) and each keeps its own visual language.
 */

export const SEVERITIES: CVESeverity[] = ['critical', 'high', 'medium', 'low', 'none']
export const STATUSES: CVEStatus[] = ['new', 'analyzed', 'patched', 'na']

export const SEVERITY_LABEL: Record<CVESeverity, string> = {
  critical: 'Critique', high: 'Élevée', medium: 'Moyenne', low: 'Faible', none: 'Non évaluée',
}

export const STATUS_LABELS: Record<CVEStatus, string> = {
  new: 'NOUVEAU', analyzed: 'ANALYSÉ', patched: 'PATCHÉ', na: 'N/A',
}

export function SeverityBadge({ severity }: { severity: CVESeverity }) {
  return <span className="cv26-sev" data-severity={severity}><i aria-hidden="true" />{SEVERITY_LABEL[severity] ?? severity}</span>
}

export function StatusBadge({ status }: { status: CVEStatus }) {
  return <span className="cv26-status" data-status={status}>{STATUS_LABELS[status] ?? status}</span>
}

/** Ten cells, lit up to the CVSS score; "—" when no score was recorded. */
export function CvssMeter({ score, severity }: { score: number; severity: CVESeverity }) {
  if (!(score > 0)) return <span className="cv26-cvss is-none">—<small>sans score</small></span>
  const lit = Math.round(score)
  return (
    <span className="cv26-cvss" data-severity={severity} aria-label={`CVSS ${score.toFixed(1)} sur 10`}>
      <b>{score.toFixed(1)}</b>
      <span className="cv26-cvss-cells" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => <i key={i} data-on={i < lit} />)}
      </span>
    </span>
  )
}

/** The badge reads "KEV" only; the explanation goes in a sibling for screen readers. */
export function KevBadge({ title }: { title: string }) {
  return (
    <span className="cv26-kev-wrap">
      <span className="cv26-kev" title={title}><Flame size={11} aria-hidden="true" />KEV</span>
      <span className="cv26-sr"> exploitée activement selon CISA</span>
    </span>
  )
}

export function splitProducts(products: string | undefined): string[] {
  return [...new Set((products ?? '').split(',').map(p => p.trim()).filter(Boolean))]
}

/** A date from the API, or null for empty values and Go zero times. */
export function validDate(iso: string | undefined | null): Date | null {
  if (!iso || iso.startsWith('0001')) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

const day = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
export const formatDay = (iso: string | undefined | null) => { const d = validDate(iso); return d ? day.format(d) : '—' }

/** A labelled panel used by the detail page for each independent signal. */
export function SignalPanel({ kind, title, source, children }: { kind: 'cvss' | 'kev' | 'epss'; title: string; source: string; children: ReactNode }) {
  return (
    <section className="cv26-signal" data-kind={kind} aria-label={title}>
      <header><span>{title}</span><small>{source}</small></header>
      {children}
    </section>
  )
}
