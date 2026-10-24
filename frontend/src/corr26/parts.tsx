import type { CorrelationResult } from '@/types/correlation'

/* Shared pieces of Correlation 2026: IOC types, confidence wording, dates. */

export type IOCType = 'ip' | 'domain' | 'hash' | 'url' | 'email' | 'cidr'

export const IOC_TYPES: { value: IOCType; label: string; example: string }[] = [
  { value: 'ip', label: 'IP', example: '203.0.113.42' },
  { value: 'domain', label: 'Domaine', example: 'exemple-malveillant.test' },
  { value: 'hash', label: 'Hash', example: 'SHA-256, SHA-1 ou MD5' },
  { value: 'url', label: 'URL', example: 'https://exemple.test/payload' },
  { value: 'email', label: 'E-mail', example: 'expediteur@exemple.test' },
  { value: 'cidr', label: 'CIDR', example: '198.51.100.0/24' },
]

export const typeLabel = (type: string) => IOC_TYPES.find(t => t.value === type)?.label ?? type.toUpperCase()

/* The same thresholds and wording as the IOC module, so a score reads the same everywhere. */
export function confidenceOf(confidence: number | undefined) {
  const pct = Math.round((confidence ?? 0) * 100)
  const level = pct >= 60 ? 'high' : pct >= 30 ? 'medium' : 'low'
  const label = level === 'high' ? 'Confiance forte' : level === 'medium' ? 'Confiance modérée' : 'Confiance faible'
  return { pct, level, label } as const
}

export type GroupId = 'mitre' | 'cve' | 'playbooks' | 'investigations' | 'layers' | 'tools' | 'lolbins' | 'cloak' | 'notes'

/* Every result group, in reading order, with its count; empty groups are listed apart. */
export function groupsOf(result: CorrelationResult): { id: GroupId; label: string; count: number }[] {
  return [
    { id: 'mitre', label: 'Techniques MITRE', count: result.techniques?.length ?? 0 },
    { id: 'cve', label: 'CVE', count: result.cves?.length ?? 0 },
    { id: 'playbooks', label: 'Playbooks', count: result.playbooks?.length ?? 0 },
    { id: 'investigations', label: 'Investigations', count: result.investigations?.length ?? 0 },
    { id: 'layers', label: 'Layers ATT&CK', count: result.attack_layers?.length ?? 0 },
    { id: 'tools', label: 'Outils', count: result.tools?.length ?? 0 },
    { id: 'lolbins', label: 'LOLBins', count: result.lolbins?.length ?? 0 },
    { id: 'cloak', label: 'CLOAK OpSec', count: result.cloak_tactics?.length ?? 0 },
    { id: 'notes', label: 'Notes', count: result.notes?.length ?? 0 },
  ]
}

/** A date from the API, or null for empty values and Go zero times. */
export function validDate(iso: string | undefined | null): Date | null {
  if (!iso || iso.startsWith('0001')) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

const dayTime = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
export const formatDayTime = (iso: string | undefined | null) => { const d = validDate(iso); return d ? dayTime.format(d) : '—' }
