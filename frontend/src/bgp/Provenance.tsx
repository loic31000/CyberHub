import type { BGPDataProvenanceMap, BGPProvenanceStatus } from '@/types/bgp'
import { formatAge, formatDateTime } from './format'
import { summarizeProvenance, type ProvenanceSummary } from './history'

const STATE_LABEL = { ripe: 'RIPE Stat', cache: 'Cache', stale: 'Cache périmé', unknown: 'Provenance inconnue' } as const

/**
 * Where the data of a snapshot came from, in words. Times are when the
 * CyberHub backend retrieved the data ("récupéré à"), never a RIPE
 * publication date.
 */
export function provenanceText(summary: ProvenanceSummary): string {
  if (summary.state === 'unknown') return 'Provenance inconnue : snapshot antérieur au suivi de l’origine des données'
  const parts: string[] = [
    summary.state === 'stale' ? `Cache périmé (${summary.staleSections.join(', ')})`
      : summary.state === 'cache' ? `Cache (${summary.cachedSections.join(', ')})` : 'RIPE Stat en direct',
  ]
  if (summary.oldestFetchedAt) parts.push(`récupéré à ${formatDateTime(summary.oldestFetchedAt)}`)
  if (summary.state !== 'ripe' && summary.maxAgeSeconds !== null) parts.push(`âge ${formatAge(summary.maxAgeSeconds)} à la prise`)
  if (summary.missingSections.length) parts.push(`provenance absente : ${summary.missingSections.join(', ')}`)
  return parts.join(' · ')
}

/** A short tag for lists; nothing for data fetched live from RIPE Stat. */
export function ProvenanceTag({ status, map }: { status?: BGPProvenanceStatus; map?: BGPDataProvenanceMap | null }) {
  const summary = summarizeProvenance(status, map)
  if (summary.state === 'ripe' && summary.missingSections.length === 0) return null
  return <span className="bgp-prov-tag" data-state={summary.state} title={provenanceText(summary)}>{STATE_LABEL[summary.state]}</span>
}

/** The full provenance line, for the comparison interval. */
export function ProvenanceNote({ status, map }: { status?: BGPProvenanceStatus; map?: BGPDataProvenanceMap | null }) {
  const summary = summarizeProvenance(status, map)
  return <small className="bgp-prov-note" data-state={summary.state}>{provenanceText(summary)}</small>
}
