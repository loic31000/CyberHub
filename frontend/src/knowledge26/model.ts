import { cveApi, lolbinsApi, mitreApi } from '@/api/client'
import type { CVEEntry, CVEFilter, MITRETechnique, MITRETactic } from '@/types'
import type { CloakData } from '@/types/cloak'
import type { LOLBin } from '@/types/lolbins'
import { parseCommands, parseMitre, parseTags } from '@/lolbins26/parts'

/*
 * Knowledge Atlas data model. Four knowledge sources become one flat list of
 * KnowledgeItem so the Carousel, the Registry and the dossier can treat them
 * uniformly. ATT&CK Layers are deliberately NOT a source: they are user
 * workspaces (see layers/), never mixed with knowledge records.
 */

export const SOURCES = ['CVE', 'MITRE', 'CLOAK', 'LOLBINS'] as const
export type Source = typeof SOURCES[number]
export const SOURCE_LABEL: Record<Source, string> = { CVE: 'CVE', MITRE: 'ATT&CK', CLOAK: 'CLOAK', LOLBINS: 'LOLBINS' }

export interface KnowledgeItem {
  /** Stable across reloads: also the future favourite key (see FavoriteKey). */
  key: string; source: Source; id: string; title: string; description: string
  categories: string[]; signal: string; metadata: [string, string][]
  procedures?: { name: string; description: string }[]
  /* Facets drive the contextual filters ('|' separates multi-values); sort carries typed values. */
  facets: Record<string, string>
  sort: { cvss?: number; date?: string; severity?: number; tactic?: string; level?: string; kind?: number }
  href: string; original: unknown
}
/** Favourites are not implemented yet; they will be a Set of these keys. */
export type FavoriteKey = KnowledgeItem['key']

export interface Collection { items: KnowledgeItem[]; total: number; page?: number; limit?: number }
export interface CollectionRequest { page: number; limit: number; q?: string; tactic?: string; platform?: string; only_techniques?: boolean }
export const INITIAL_REQUEST: Readonly<CollectionRequest> = { page: 1, limit: 100 }
/** A text field as displayed: null, undefined, blank, "null" and "undefined" all read as empty. */
export const cleanText = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  const text = value.trim()
  return /^(null|undefined)$/i.test(text) ? '' : text
}
/** Splits a comma / newline list and keeps only real values. */
export const cleanList = (value: unknown): string[] => cleanText(value).split(/,|\n/).map(cleanText).filter(Boolean)
export const stringArray = (value: string): string[] => {
  try { const result: unknown = JSON.parse(value); return Array.isArray(result) ? result.map(cleanText).filter(Boolean) : [] } catch { return [] }
}

export const cloakRef = (item: KnowledgeItem) =>
  item.source === 'CLOAK' ? (item.original as { __ref?: string })?.__ref ?? '' : ''

const SEV_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, none: 0 }

export function fromCVE(c: CVEEntry): KnowledgeItem {
  return {
    key: `CVE:${c.id}`, source: 'CVE', id: c.cve_id, title: c.cve_id, description: c.description,
    categories: [c.severity || 'Unknown'], signal: c.kev_exploited ? 'KEV' : `CVSS ${c.cvss_score ?? '—'}`,
    metadata: [['Sévérité', c.severity], ['CVSS', String(c.cvss_score ?? '—')], ['Statut', c.status], ['Produits', c.products], ['Publication', c.published_at || 'Non renseignée']],
    facets: { severity: c.severity || 'none', status: c.status || 'na', kev: c.kev_exploited ? 'KEV' : 'Non-KEV' },
    sort: { cvss: typeof c.cvss_score === 'number' ? c.cvss_score : -1, date: c.published_at || '', severity: SEV_RANK[c.severity] ?? 0 },
    href: `/knowledge?source=cve&id=${encodeURIComponent(c.cve_id)}`, original: c,
  }
}
export function fromMITRE(t: MITRETechnique, tactics: MITRETactic[]): KnowledgeItem {
  const categories = stringArray(t.tactics).map(key => tactics.find(a => a.short_name === key || a.tactic_id === key)?.name || key)
  const platforms = stringArray(t.platforms)
  const kind = t.is_subtechnique ? 'Sous-technique' : 'Technique'
  return {
    key: `MITRE:${t.technique_id}`, source: 'MITRE', id: t.technique_id, title: t.name, description: cleanText(t.description),
    categories: categories.length ? categories : ['Non classée'], signal: platforms.join(' / '),
    metadata: [['Tactiques', categories.join(' / ')], ['Plateformes', platforms.join(' / ')], ['Niveau', t.is_subtechnique && cleanText(t.parent_id) ? `Sous-technique de ${cleanText(t.parent_id)}` : t.is_subtechnique ? 'Sous-technique' : 'Technique'], ['Détection', cleanText(t.detection) || 'Non disponible dans cet extrait']],
    facets: { tactic: categories.join('|') || 'Non classée', platform: platforms.join('|') || '—', kind },
    sort: { tactic: categories[0] || '', kind: t.is_subtechnique ? 1 : 0 },
    href: `/knowledge?source=mitre&id=${encodeURIComponent(t.technique_id)}`, original: t,
  }
}
export function fromCLOAK(data: CloakData): KnowledgeItem[] {
  if (!data || !Array.isArray(data.tactics)) throw new Error('Invalid CLOAK collection')
  const structural = new Set(['unknown', 'technique', 'techniques', 'sub-technique', 'sub-techniques'])
  const isStructural = (value: string) => structural.has(value.trim().toLocaleLowerCase())
  const hasKnowledge = (entry: { name: string; description: string; procedures?: unknown[]; subtechniques?: unknown[] }) =>
    !isStructural(entry.name || '') && (!!entry.description?.trim() || !!entry.procedures?.length || !!entry.subtechniques?.length)

  /*
   * The dataset groups some entries under synthetic containers whose IDs are
   * not numeric: "TL-n" (procedures tied to the tactic itself) and "UL-ST-n"
   * (sub-techniques without a parent technique). A container is never shown as
   * a technique nor offered as a parent: its sub-techniques become orphans.
   * Atlas has no tactic dossier yet, so tactic-level procedures are not
   * exposed at all rather than attached to an invented record. Annotation refs
   * keep the dataset path so existing notes still match.
   */
  const isContainer = (t: { id: unknown }) => !/^\d+$/.test(String(t.id))
  const KIND = ['Technique', 'Sous-technique'] as const

  return data.tactics.flatMap(tactic => {
    if (isStructural(tactic.name || '')) return []
    return (tactic.techniques || []).flatMap(t => {
      const container = isContainer(t)
      return [
        ...(!container && hasKnowledge(t) ? [{ t, id: `TE-${t.id}`, level: 'Technique', kind: 0, ref: `tac-${tactic.id}:te-${t.id}`, key: `${tactic.id}:${t.id}`, parentId: undefined as number | undefined }] : []),
        ...(t.subtechniques || []).filter(hasKnowledge).map(sub => ({
          t: sub, id: `ST-${sub.id}`, level: container ? 'Sous-technique sans technique parent' : `Sous-technique de TE-${t.id}`, kind: 1,
          ref: `tac-${tactic.id}:te-${t.id}:sub-${sub.id}`, key: `${tactic.id}:${t.id}:${sub.id}`, parentId: container ? undefined : t.id as number,
        })),
      ]
    }).map(({ t: entry, id, level, kind, ref, key, parentId }) => ({
      key: `CLOAK:${key}`, source: 'CLOAK' as const, id, title: entry.name, description: entry.description || '', categories: [tactic.name], signal: entry.type || 'Non renseigné',
      metadata: [['Tactique', tactic.name], ['Niveau', level], ['Type', entry.type || 'Non renseigné']],
      facets: { tactic: tactic.name, level: entry.type || 'Non renseigné', kind: KIND[kind] },
      sort: { tactic: tactic.name, level: entry.type || '', kind },
      procedures: entry.procedures || [], href: `/knowledge?source=cloak&id=${encodeURIComponent(id)}`, original: { ...entry, __ref: ref, __parentId: parentId },
    }))
  })
}
export function fromLOLBIN(bin: LOLBin): KnowledgeItem {
  const mitre = parseMitre(bin.mitre_tech)
  const tags = parseTags(bin.tags)
  const count = typeof bin.command_count === 'number' ? bin.command_count : parseCommands(bin.commands).length
  const os = bin.os === 'linux' ? 'Linux' : 'Windows'
  const category = bin.category || 'Non classé'
  return {
    key: `LOLBINS:${bin.os}:${bin.id}`, source: 'LOLBINS', id: bin.name, title: bin.name, description: bin.description || '',
    categories: [category], signal: `${count} commande${count > 1 ? 's' : ''}`,
    metadata: [['OS', os], ['Catégorie', category], ['Chemin', bin.full_path || '—'], ['ATT&CK', mitre.join(' · ') || '—'], ['Tags', tags.join(' · ')]],
    facets: { os, category, mitre: mitre.join('|') || '—' },
    sort: { tactic: category, kind: bin.os === 'linux' ? 1 : 0 },
    href: `/knowledge?source=lolbins&id=${encodeURIComponent(bin.name)}`, original: bin,
  }
}

/*
 * The LOLBins API returns at most 100 rows per request and has no paging, so
 * the catalog is gathered per (OS, category) and de-duplicated; the honest
 * total comes from the backend's per-OS counters.
 */
async function loadLOLBins(): Promise<Collection> {
  const [first, categories] = await Promise.all([lolbinsApi.list(), lolbinsApi.getCategories().catch(() => [])])
  const pages = await Promise.all(categories.filter(c => c.count > 0).map(c => lolbinsApi.list({ os: c.os, category: c.category }).catch(() => null)))
  const byId = new Map<number, LOLBin>()
  for (const page of [first, ...pages]) for (const bin of page?.items ?? []) byId.set(bin.id, bin)
  return { items: [...byId.values()].map(fromLOLBIN), total: (first.win_count + first.linux_count) || first.total }
}

export async function loadCollection(source: Source, signal: AbortSignal, request: CollectionRequest = INITIAL_REQUEST): Promise<Collection> {
  if (source === 'CVE') {
    const query: CVEFilter & CollectionRequest = { ...request }
    const result = await cveApi.list(query, signal)
    return { items: (result.cves || []).map(fromCVE), total: result.count, page: request.page, limit: request.limit }
  }
  if (source === 'MITRE') {
    const [result, tactics] = await Promise.all([mitreApi.techniques(request), mitreApi.tactics()])
    return { items: result.items.map(t => fromMITRE(t, tactics)), total: result.total, page: result.page, limit: result.limit }
  }
  if (source === 'LOLBINS') return loadLOLBins()
  const response = await fetch('/data/cloak.json', { signal })
  if (!response.ok) throw new Error('CLOAK unavailable')
  const items = fromCLOAK(await response.json())
  return { items, total: items.length }
}

/* ---- search + contextual filters ---- */
export type FacetState = Record<string, Set<string>>
const corpus = (item: KnowledgeItem) =>
  [item.id, item.title, item.description, ...item.categories, item.signal, ...item.metadata.map(m => m[1]), ...(item.procedures || []).flatMap(p => [p.name, p.description])].join(' ').toLocaleLowerCase()

export function filterItems(items: KnowledgeItem[], source: Source | 'TOUT', query: string, facets?: FacetState) {
  const needle = query.trim().toLocaleLowerCase()
  return items.filter(item => {
    if (source !== 'TOUT' && item.source !== source) return false
    if (facets) for (const [facet, values] of Object.entries(facets)) {
      if (values.size && ![...values].some(value => item.facets[facet]?.split('|').includes(value))) return false
    }
    return !needle || corpus(item).includes(needle)
  })
}

export interface FacetDef { key: string; label: string }
export function facetDefs(source: Source | 'TOUT'): FacetDef[] {
  if (source === 'CVE') return [{ key: 'severity', label: 'Sévérité' }, { key: 'status', label: 'Statut' }, { key: 'kev', label: 'KEV' }]
  if (source === 'MITRE') return [{ key: 'tactic', label: 'Tactique' }, { key: 'platform', label: 'Plateforme' }, { key: 'kind', label: 'Niveau' }]
  if (source === 'CLOAK') return [{ key: 'tactic', label: 'Tactique' }, { key: 'level', label: 'Niveau' }, { key: 'kind', label: 'Type' }]
  if (source === 'LOLBINS') return [{ key: 'os', label: 'OS' }, { key: 'category', label: 'Catégorie' }, { key: 'mitre', label: 'Technique ATT&CK' }]
  return []
}

/* ---- sorting ---- */
export type SortKey = 'relevance' | 'id-asc' | 'id-desc' | 'name-asc' | 'name-desc' | 'source' | 'cvss-desc' | 'cvss-asc' | 'recent' | 'old' | 'severity' | 'tactic' | 'kind'
export interface SortOption { key: SortKey; label: string }
const COMMON: SortOption[] = [
  { key: 'relevance', label: 'Pertinence' },
  { key: 'id-asc', label: 'Identifiant A→Z' }, { key: 'id-desc', label: 'Identifiant Z→A' },
  { key: 'name-asc', label: 'Nom A→Z' }, { key: 'name-desc', label: 'Nom Z→A' },
]
export function sortOptions(source: Source | 'TOUT'): SortOption[] {
  if (source === 'CVE') return [...COMMON, { key: 'cvss-desc', label: 'CVSS décroissant' }, { key: 'cvss-asc', label: 'CVSS croissant' }, { key: 'recent', label: 'Plus récentes' }, { key: 'old', label: 'Plus anciennes' }, { key: 'severity', label: 'Sévérité' }]
  if (source === 'MITRE' || source === 'CLOAK') return [...COMMON, { key: 'tactic', label: 'Tactique' }, { key: 'kind', label: 'Technique / sous-technique' }]
  if (source === 'LOLBINS') return [...COMMON, { key: 'tactic', label: 'Catégorie' }, { key: 'kind', label: 'Windows / Linux' }]
  return [...COMMON, { key: 'source', label: 'Source' }]
}

/* Ranks a record against the search: exact ID, then title, then prefixes, then content. */
export function relevance(item: KnowledgeItem, query: string): number {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return 0
  const id = item.id.toLocaleLowerCase(), title = item.title.toLocaleLowerCase()
  if (id === needle) return 100
  if (title === needle) return 90
  if (id.startsWith(needle)) return 80
  if (title.startsWith(needle)) return 70
  if (id.includes(needle)) return 60
  if (title.includes(needle)) return 50
  if (item.categories.join(' ').toLocaleLowerCase().includes(needle)) return 30
  if (item.description.toLocaleLowerCase().includes(needle)) return 20
  return 10
}

const byStr = (a: string, b: string) => a.localeCompare(b, 'fr', { numeric: true })
export function sortItems(items: KnowledgeItem[], key: SortKey, query = ''): KnowledgeItem[] {
  const copy = items.slice()
  switch (key) {
    case 'relevance': {
      const score = new Map(copy.map(item => [item.key, relevance(item, query)]))
      // Without a search every record ties: fall back to the product order
      // (CVE → ATT&CK → CLOAK → LOLBins), then ID. A search keeps its ranking.
      const bySource = query.trim() ? () => 0 : (a: KnowledgeItem, b: KnowledgeItem) => SOURCES.indexOf(a.source) - SOURCES.indexOf(b.source)
      return copy.sort((a, b) => score.get(b.key)! - score.get(a.key)! || bySource(a, b) || byStr(a.id, b.id))
    }
    case 'id-asc': return copy.sort((a, b) => byStr(a.id, b.id))
    case 'id-desc': return copy.sort((a, b) => byStr(b.id, a.id))
    case 'name-asc': return copy.sort((a, b) => byStr(a.title, b.title))
    case 'name-desc': return copy.sort((a, b) => byStr(b.title, a.title))
    case 'source': return copy.sort((a, b) => SOURCES.indexOf(a.source) - SOURCES.indexOf(b.source) || byStr(a.id, b.id))
    case 'cvss-desc': return copy.sort((a, b) => (b.sort.cvss ?? -1) - (a.sort.cvss ?? -1))
    case 'cvss-asc': return copy.sort((a, b) => (a.sort.cvss ?? Infinity) - (b.sort.cvss ?? Infinity))
    case 'recent': return copy.sort((a, b) => byStr(b.sort.date ?? '', a.sort.date ?? ''))
    case 'old': return copy.sort((a, b) => byStr(a.sort.date ?? '', b.sort.date ?? ''))
    case 'severity': return copy.sort((a, b) => (b.sort.severity ?? 0) - (a.sort.severity ?? 0))
    case 'tactic': return copy.sort((a, b) => byStr(a.sort.tactic ?? '', b.sort.tactic ?? '') || byStr(a.id, b.id))
    case 'kind': return copy.sort((a, b) => (a.sort.kind ?? 0) - (b.sort.kind ?? 0) || byStr(a.id, b.id))
    default: return copy
  }
}

/** Groups a sorted list by source, keeping the sort order inside each group. */
export function groupBySource(items: KnowledgeItem[]): { source: Source; items: KnowledgeItem[] }[] {
  return SOURCES.map(source => ({ source, items: items.filter(item => item.source === source) })).filter(group => group.items.length)
}
