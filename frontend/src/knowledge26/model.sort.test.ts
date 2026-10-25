import { describe, expect, it } from 'vitest'
import { filterItems, fromCLOAK, fromCVE, fromLOLBIN, fromMITRE, sortItems, type KnowledgeItem } from './model'
import type { CVEEntry, MITRETechnique } from '@/types'
import type { LOLBin } from '@/types/lolbins'

/*
 * #95 — default ALL order. With the default "Pertinence" sort and no search
 * every record ties, so the product order CVE → ATT&CK → CLOAK → LOLBins
 * decides, then the ID. A search keeps its ranking and the explicit sorts
 * are untouched.
 */

const cve = (id: number, cveId: string) => fromCVE({ id, cve_id: cveId, description: 'Synthetic', severity: 'high', cvss_score: 7, status: 'new', products: '' } as CVEEntry)
const technique = (id: string, name: string) => fromMITRE({ technique_id: id, name, description: '', tactics: '["execution"]', platforms: '[]', is_subtechnique: false } as MITRETechnique, [])
const cloak = fromCLOAK({ tactics: [{ id: 1, name: 'Anonymous browsing', description: '', type: '', techniques: [
  { id: 20, name: 'Anti-fingerprinting', description: 'Tor browser', type: 'Technical', procedures: [], subtechniques: [{ id: 21, name: 'Isolate sessions', description: 'Session', type: 'Technical', procedures: [] }] },
] }] } as never)
const lolbin = (id: number, name: string) => fromLOLBIN({ id, name, os: 'linux', description: 'Binary', full_path: `/usr/bin/${name}`, commands: '[]', mitre_tech: '[]', tags: '[]', category: 'Shell', command_count: 0 } as LOLBin)

// Shuffled on purpose, with IDs that sort before "CVE-" alphabetically (awk, base64, Certutil).
const mixed: KnowledgeItem[] = [lolbin(1, 'awk'), cloak[1], technique('T1105', 'Ingress'), cve(2, 'CVE-2026-0002'), lolbin(2, 'Certutil.exe'), technique('T1059', 'Interpreter'), cloak[0], cve(1, 'CVE-2025-0001'), lolbin(3, 'base64')]
const ids = (items: KnowledgeItem[]) => items.map(item => item.id)
const sources = (items: KnowledgeItem[]) => items.map(item => item.source)

describe('Knowledge default order (#95)', () => {
  it('orders ALL CVE → ATT&CK → CLOAK → LOLBins with the default sort and no search', () => {
    expect(sources(sortItems(mixed, 'relevance', ''))).toEqual(['CVE', 'CVE', 'MITRE', 'MITRE', 'CLOAK', 'CLOAK', 'LOLBINS', 'LOLBINS', 'LOLBINS'])
  })

  it('keeps a stable ID order inside each source', () => {
    expect(ids(sortItems(mixed, 'relevance', ''))).toEqual(['CVE-2025-0001', 'CVE-2026-0002', 'T1059', 'T1105', 'ST-21', 'TE-20', 'awk', 'base64', 'Certutil.exe'])
    expect(ids(sortItems([...mixed].reverse(), 'relevance', ''))).toEqual(ids(sortItems(mixed, 'relevance', '')))
  })

  it('treats a blank search as no search', () => {
    expect(ids(sortItems(mixed, 'relevance', '   '))).toEqual(ids(sortItems(mixed, 'relevance', '')))
  })

  it('lets relevance win during a search, even over CVE', () => {
    const results = sortItems(filterItems(mixed, 'TOUT', 'awk'), 'relevance', 'awk')
    expect(results[0].id).toBe('awk')
    const broad = sortItems(mixed, 'relevance', 'curl') // no match: ties keep the ID tie-break, not the source order
    expect(broad[0].id).toBe('awk')
  })

  it('starts with ATT&CK when there is no CVE, then CLOAK, then LOLBins', () => {
    const noCve = mixed.filter(item => item.source !== 'CVE')
    expect(sortItems(noCve, 'relevance', '')[0].source).toBe('MITRE')
    expect(sortItems(noCve.filter(item => item.source !== 'MITRE'), 'relevance', '')[0].source).toBe('CLOAK')
    expect(ids(sortItems(mixed.filter(item => item.source === 'LOLBINS'), 'relevance', ''))).toEqual(['awk', 'base64', 'Certutil.exe'])
  })

  it('leaves the explicit id-asc sort unchanged', () => {
    expect(ids(sortItems(mixed, 'id-asc'))).toEqual(['awk', 'base64', 'Certutil.exe', 'CVE-2025-0001', 'CVE-2026-0002', 'ST-21', 'T1059', 'T1105', 'TE-20'])
  })

  it('leaves the explicit source sort unchanged', () => {
    expect(ids(sortItems(mixed, 'source'))).toEqual(['CVE-2025-0001', 'CVE-2026-0002', 'T1059', 'T1105', 'ST-21', 'TE-20', 'awk', 'base64', 'Certutil.exe'])
  })

  it('does not change a single-source view', () => {
    const onlyMitre = filterItems(mixed, 'MITRE', '')
    expect(ids(sortItems(onlyMitre, 'relevance', ''))).toEqual(ids(sortItems(onlyMitre, 'id-asc')))
    const onlyLolbins = filterItems(mixed, 'LOLBINS', '')
    expect(ids(sortItems(onlyLolbins, 'relevance', ''))).toEqual(ids(sortItems(onlyLolbins, 'id-asc')))
  })
})
