import type { CorrelationCVE, CorrelationPlaybook, CorrelationResult, CorrelationTechnique } from '@/types/correlation'

export type IntelligenceGroupId = 'mitre' | 'cve' | 'playbooks'

export interface IntelligenceTechnique extends CorrelationTechnique {
  tactics: string[]
}

export interface IntelligenceData {
  techniques: IntelligenceTechnique[]
  cves: CorrelationCVE[]
  playbooks: CorrelationPlaybook[]
  groups: { id: IntelligenceGroupId; label: string; count: number }[]
}

export function readableTactics(raw?: string): string[] {
  const value = raw?.trim()
  if (!value) return []
  let tactics: string[] = []
  try {
    const parsed: unknown = JSON.parse(value)
    tactics = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : typeof parsed === 'string' ? [parsed] : []
  } catch {
    if (value.startsWith('[') && value.endsWith(']')) {
      const quoted = [...value.matchAll(/['"]([^'"]+)['"]/g)].map(match => match[1])
      tactics = quoted.length > 0 ? quoted : value.slice(1, -1).split(',')
    } else tactics = [value]
  }
  return tactics.map(tactic => tactic.trim()).filter(Boolean).map(tactic =>
    /^[a-z][a-z-]*$/.test(tactic)
      ? tactic.split('-').map((word, index) => index > 0 && word === 'and' ? word : word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
      : tactic
  )
}

export function prepareIntelligenceData(result: CorrelationResult): IntelligenceData {
  const techniques = result.techniques.map(technique => ({ ...technique, tactics: readableTactics(technique.tactic) }))
  const cves = result.cves
  const playbooks = result.playbooks
  return {
    techniques, cves, playbooks,
    groups: [
      { id: 'mitre', label: 'MITRE ATT&CK', count: techniques.length },
      { id: 'cve', label: 'CVE', count: cves.length },
      { id: 'playbooks', label: 'Playbooks', count: playbooks.length },
    ],
  }
}
