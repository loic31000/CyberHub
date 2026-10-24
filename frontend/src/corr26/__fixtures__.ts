import type { CorrelationResult } from '@/types/correlation'

/* Fictional correlation results for tests and previews; documentation addresses only (RFC 5737). */

export const correlationResult = (overrides: Partial<CorrelationResult> = {}): CorrelationResult => ({
  ioc_type: 'ip',
  ioc_value: '203.0.113.42',
  techniques: [
    { technique_id: 'T1071', name: 'Application Layer Protocol', tactic: '["command-and-control"]' },
    { technique_id: 'T1041', name: 'Exfiltration Over C2 Channel', tactic: 'exfiltration' },
  ],
  cloak_tactics: [{ name: 'Infrastructure dédiée', description: 'Isoler les outils d’analyse du réseau de production.' }],
  tools: [{ name: 'Wireshark', category: 'Réseau' }],
  playbooks: [{ id: 3, title: 'Réponse Ransomware' }],
  cves: [
    { cve_id: 'CVE-2026-0001', description: 'Vulnérabilité fictive d’exécution de code à distance dans un service exposé.', cvss_score: 9.8 },
    { cve_id: 'CVE-2026-0002', description: 'Contournement d’authentification fictif.', cvss_score: 7.5 },
  ],
  lolbins: [],
  investigations: [{ id: 8, title: 'Campagne fictive APT-TEST', status: 'open' }],
  attack_layers: [{ id: 2, name: 'Couverture C2' }],
  notes: [],
  confidence: 0.72,
  rationale: 'L’adresse apparaît dans deux techniques de commande et contrôle et une investigation ouverte.',
  next_actions: ['Bloquer l’adresse sur le pare-feu périmétrique', 'Rechercher les connexions sortantes des 7 derniers jours'],
  generated_at: '2026-10-24T09:30:00Z',
  from_cache: false,
  ...overrides,
})

export const deferred = <T,>() => {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
