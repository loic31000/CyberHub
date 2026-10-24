// Pure helpers behind BGP Historian. They only reshape what the backend returns
// (snapshot lists, diffs, alerts); nothing here invents a value.
import type {
  BGPAlert, BGPAlertType, BGPComparisonStatus, BGPDataProvenanceMap, BGPDiffField, BGPDiffResponse,
  BGPProvenanceStatus, BGPSnapshot, BGPSnapshotResponse,
} from '@/types/bgp'

/* ------------------------------------------------------------------ alerts */

const ALERT_TYPES: readonly BGPAlertType[] = ['prefix_change', 'peer_change', 'upstream_change', 'downstream_change']

/*
 * The Go model behind GET /bgp/alerts has no json tags, so the API sends its
 * Go field names (AlertType, DetectedAt, ...). The documented snake_case shape
 * is accepted too, so the feed keeps working if the backend adds the tags.
 */
export function normalizeAlert(raw: unknown): BGPAlert | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const pick = (...keys: string[]) => keys.map(key => r[key]).find(value => value !== undefined && value !== null)
  const id = Number(pick('id', 'ID'))
  const asn = Number(pick('asn', 'ASN'))
  const type = pick('alert_type', 'AlertType', 'alertType')
  if (!Number.isSafeInteger(id) || !Number.isSafeInteger(asn)) return null
  return {
    id,
    asn,
    alert_type: (ALERT_TYPES as readonly unknown[]).includes(type) ? type as BGPAlertType : 'prefix_change',
    created_at: String(pick('created_at', 'CreatedAt', 'createdAt') ?? ''),
    detected_at: String(pick('detected_at', 'DetectedAt', 'detectedAt') ?? ''),
    old_value: String(pick('old_value', 'OldValue', 'oldValue') ?? ''),
    new_value: String(pick('new_value', 'NewValue', 'newValue') ?? ''),
    acknowledged: Boolean(pick('acknowledged', 'Acknowledged')),
  }
}

/* ----------------------------------------------------------- diff items */

/** Stable identity of a list item: a prefix, an ASN, or the item itself. */
export function itemKey(item: unknown): string {
  if (typeof item === 'string') return item
  if (item && typeof item === 'object') {
    const o = item as Record<string, unknown>
    if (typeof o.prefix === 'string' && o.prefix) return o.prefix
    if (typeof o.asn === 'number') return `AS${o.asn}`
  }
  return JSON.stringify(item)
}

/** Secondary text of an item, when the source gave one (RIPE often repeats "AS<n>"). */
export function itemDetail(item: unknown): string {
  if (!item || typeof item !== 'object') return ''
  const o = item as Record<string, unknown>
  const name = typeof o.name === 'string' ? o.name.trim() : ''
  const parts = [name && name !== itemKey(item) ? name : '', typeof o.country_code === 'string' ? o.country_code : '']
  return parts.filter(Boolean).join(' · ')
}

export interface DiffItem { key: string; detail: string; raw: unknown }
export interface FieldAnalysis {
  field: string
  label: string
  before: number
  after: number
  added: DiffItem[]
  removed: DiffItem[]
  /** Same key on both sides with different attributes (e.g. a renamed peer). */
  modified: { key: string; before: unknown; after: unknown }[]
}
export interface SectionAnalysis {
  section: string
  label: string
  fields: FieldAnalysis[]
  added: number
  removed: number
  modified: number
}

const toItems = (list: unknown[]): DiffItem[] => list.map(raw => ({ key: itemKey(raw), detail: itemDetail(raw), raw }))

export function analyzeField(field: string, data: BGPDiffField): FieldAnalysis {
  const added = toItems(data.added ?? [])
  const removed = toItems(data.removed ?? [])
  const removedByKey = new Map(removed.map(item => [item.key, item]))
  const modified = added.filter(item => removedByKey.has(item.key))
    .map(item => ({ key: item.key, before: removedByKey.get(item.key)!.raw, after: item.raw }))
  const modifiedKeys = new Set(modified.map(m => m.key))
  return {
    field,
    label: FIELD_LABEL[field] ?? field,
    before: (data.old ?? []).length,
    after: (data.new ?? []).length,
    added: added.filter(item => !modifiedKeys.has(item.key)),
    removed: removed.filter(item => !modifiedKeys.has(item.key)),
    modified,
  }
}

/** Every list the backend compares (handlers/bgp.go, bgpSectionComparisons). */
export const COMPARED_SECTIONS: readonly { section: string; label: string; fields: readonly string[] }[] = [
  { section: 'prefixes', label: 'Préfixes', fields: ['ipv4_prefixes', 'ipv6_prefixes'] },
  { section: 'peers', label: 'Peers', fields: ['ipv4_peers', 'ipv6_peers'] },
  { section: 'upstreams', label: 'Upstreams', fields: ['ipv4_upstreams', 'ipv6_upstreams'] },
  { section: 'downstreams', label: 'Downstreams', fields: ['ipv4_downstreams', 'ipv6_downstreams'] },
]

const FIELD_LABEL: Record<string, string> = Object.fromEntries(COMPARED_SECTIONS.flatMap(s =>
  s.fields.map(f => [f, `${s.label} ${f.startsWith('ipv6') ? 'IPv6' : 'IPv4'}`])))

/**
 * identical / changed / missing (absent on one side) / error (unreadable) come
 * from the backend's list_status; unreported means the response did not say,
 * as with backends older than list_status.
 */
export type ListState = 'identical' | 'changed' | 'missing' | 'error' | 'unreported'
export interface ListReport { section: string; field: string; label: string; state: ListState; detail?: string }

/**
 * changed: at least one confirmed change · identical: the eight lists were
 * compared and are equal · partial: no change among the lists that could be
 * compared, others could not · impossible: nothing could be compared ·
 * unreported: old contract, omitted lists prove nothing.
 */
export type ComparisonVerdict = 'changed' | 'identical' | 'partial' | 'impossible' | 'unreported'

export interface DiffAnalysis {
  sections: SectionAnalysis[]
  /** Every compared list with its state, in a fixed order. */
  lists: ListReport[]
  verdict: ComparisonVerdict
  /** Backend status, or "legacy" when the response predates it. */
  status: BGPComparisonStatus | 'legacy'
  decodeErrors: string[]
  /** Lists the response says nothing about; the API does not say whether they were empty or identical. */
  notReported: string[]
  added: number
  removed: number
  modified: number
}

const LIST_STATE: Record<string, ListState> = {
  identical: 'identical', changed: 'changed', 'missing/unavailable': 'missing', error: 'error',
}

function listReports(response: BGPDiffResponse): ListReport[] {
  const changes = response.diff.changes as Record<string, Record<string, unknown> | undefined>
  const statuses = response.diff.list_status ?? {}
  return COMPARED_SECTIONS.flatMap(({ section, fields }) => fields.map(field => {
    const reported = statuses[`${section}.data.${field}`]
    const state: ListState = changes[section]?.[field] ? 'changed' : (reported && LIST_STATE[reported.status]) || 'unreported'
    const detail = [reported?.older_error, reported?.newer_error].filter(Boolean).join(' · ') || undefined
    return { section, field, label: FIELD_LABEL[field], state, ...(detail && { detail }) }
  }))
}

function verdictOf(lists: ListReport[], decodeErrors: string[]): ComparisonVerdict {
  if (decodeErrors.length > 0 || lists.every(l => l.state === 'error')) return 'impossible'
  if (lists.some(l => l.state === 'changed')) return 'changed'
  if (lists.every(l => l.state === 'identical')) return 'identical'
  if (lists.every(l => l.state === 'unreported')) return 'unreported'
  return 'partial'
}

export function analyzeDiff(response: BGPDiffResponse): DiffAnalysis {
  const changes = response.diff.changes as Record<string, Record<string, BGPDiffField> | undefined>
  const decode = response.diff.decode_errors ?? {}
  const decodeErrors = [
    decode.older && `Snapshot avant : ${decode.older}`,
    decode.newer && `Snapshot après : ${decode.newer}`,
  ].filter((e): e is string => Boolean(e))
  const lists = listReports(response)
  const sections: SectionAnalysis[] = []
  for (const { section, label } of COMPARED_SECTIONS) {
    const fields = Object.entries(changes[section] ?? {}).map(([field, data]) => analyzeField(field, data))
    if (fields.length === 0) continue
    sections.push({
      section, label, fields,
      added: fields.reduce((n, f) => n + f.added.length, 0),
      removed: fields.reduce((n, f) => n + f.removed.length, 0),
      modified: fields.reduce((n, f) => n + f.modified.length, 0),
    })
  }
  return {
    sections,
    lists,
    verdict: verdictOf(lists, decodeErrors),
    status: response.diff.status ?? 'legacy',
    decodeErrors,
    notReported: lists.filter(l => l.state === 'unreported').map(l => l.label),
    added: sections.reduce((n, s) => n + s.added, 0),
    removed: sections.reduce((n, s) => n + s.removed, 0),
    modified: sections.reduce((n, s) => n + s.modified, 0),
  }
}

/* ------------------------------------------------- snapshot provenance */

const SECTION_LABEL: Record<string, string> = {
  info: 'Fiche ASN', prefixes: 'Préfixes', peers: 'Peers', upstreams: 'Upstreams', downstreams: 'Downstreams',
}
const SNAPSHOT_SECTIONS = Object.keys(SECTION_LABEL)

/** ripe: all live · cache: some from the fresh cache · stale: some from a stale cache · unknown: not recorded. */
export type ProvenanceState = 'ripe' | 'cache' | 'stale' | 'unknown'

export interface ProvenanceSummary {
  state: ProvenanceState
  staleSections: string[]
  cachedSections: string[]
  /** Sections without a recognised provenance. */
  missingSections: string[]
  /** Oldest backend retrieval time among the sections. */
  oldestFetchedAt: string | null
  maxAgeSeconds: number | null
}

export function summarizeProvenance(status: BGPProvenanceStatus | undefined, map: BGPDataProvenanceMap | null | undefined): ProvenanceSummary {
  const known = status !== 'unknown' && map ? map : {}
  const pick = (source: string) => SNAPSHOT_SECTIONS.filter(s => known[s]?.source === source).map(s => SECTION_LABEL[s])
  const recognised = SNAPSHOT_SECTIONS.filter(s => ['ripe', 'cache', 'cache-stale'].includes(known[s]?.source ?? ''))
  const fetched = recognised.map(s => known[s].fetched_at).filter((t): t is string => Boolean(t) && !Number.isNaN(Date.parse(t!)))
  const ages = recognised.map(s => known[s].age_seconds).filter((a): a is number => typeof a === 'number')
  const staleSections = pick('cache-stale')
  const cachedSections = pick('cache')
  return {
    state: recognised.length === 0 ? 'unknown' : staleSections.length ? 'stale' : cachedSections.length ? 'cache' : 'ripe',
    staleSections,
    cachedSections,
    missingSections: recognised.length === 0 ? [] : SNAPSHOT_SECTIONS.filter(s => !recognised.includes(s)).map(s => SECTION_LABEL[s]),
    oldestFetchedAt: fetched.length ? fetched.reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b)) : null,
    maxAgeSeconds: ages.length ? Math.max(...ages) : null,
  }
}

/** The moment a snapshot stands for: snapshot_date, as the backend orders them, else created_at. */
export function snapshotMoment(s: Pick<BGPSnapshot, 'snapshot_date' | 'created_at'>): string {
  return s.snapshot_date && !Number.isNaN(Date.parse(s.snapshot_date)) ? s.snapshot_date : s.created_at
}

/** The toast shown after taking a snapshot, from what the backend actually compared. */
export function snapshotOutcome(result: BGPSnapshotResponse): { tone: 'success' | 'warning'; message: string } {
  const alerts = result.alerts?.length ?? 0
  const found = `${alerts} changement(s) détecté(s)`
  const previous = `le snapshot #${result.comparison?.previous_snapshot_id}`
  let tone: 'success' | 'warning' = alerts > 0 ? 'warning' : 'success'
  let message: string
  switch (result.comparison?.status) {
    case 'no_previous':
      message = 'Snapshot pris — premier snapshot de cet ASN, rien à comparer'
      break
    case 'complete':
      message = alerts > 0 ? `Snapshot pris — ${found} par rapport au snapshot #${result.comparison.previous_snapshot_id} !` : `Snapshot pris — identique au snapshot #${result.comparison.previous_snapshot_id} sur les 8 listes comparées`
      break
    case 'incomplete':
      tone = 'warning'
      message = `Snapshot pris — comparaison partielle avec ${previous} : certaines listes manquent d’un côté. ${found} sur les listes comparables.`
      break
    case 'error':
      tone = 'warning'
      message = `Snapshot pris — comparaison impossible avec ${previous} (données illisibles) : aucune alerte n’a pu être calculée.`
      break
    default:
      message = alerts > 0 ? `Snapshot pris — ${found} !` : 'Snapshot pris avec succès'
  }
  const stale = summarizeProvenance('known', result.data_provenance).staleSections
  if (stale.length > 0) {
    tone = 'warning'
    message += ` Cache périmé : ${stale.join(', ')} (RIPE Stat indisponible).`
  }
  return { tone, message }
}

/* ----------------------------------------------------- alert contents */

export interface AlertChange { field: string; label: string; added: DiffItem[]; removed: DiffItem[] }
export type AlertDetail = { changes: AlertChange[]; added: number; removed: number } | { note: string }

/*
 * An alert stores the whole section before and after ({status, data: {...}}).
 * The exact items added and removed are recomputed from both lists by key.
 */
export function alertDetail(alert: BGPAlert): AlertDetail {
  if (!alert.old_value || !alert.new_value) return { note: 'Valeurs avant / après absentes de l’alerte' }
  try {
    const unwrap = (value: string) => {
      const parsed = JSON.parse(value) as Record<string, unknown> | null
      return ((parsed && typeof parsed.data === 'object' ? parsed.data : parsed) ?? {}) as Record<string, unknown>
    }
    const before = unwrap(alert.old_value)
    const after = unwrap(alert.new_value)
    const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .filter(f => Array.isArray(before[f]) || Array.isArray(after[f]))
    if (fields.length === 0) return { note: 'Aucune liste comparable dans l’alerte' }
    const changes = fields.map(field => {
      const oldItems = toItems((before[field] as unknown[]) ?? [])
      const newItems = toItems((after[field] as unknown[]) ?? [])
      const oldKeys = new Set(oldItems.map(i => i.key))
      const newKeys = new Set(newItems.map(i => i.key))
      return {
        field,
        label: FIELD_LABEL[field] ?? field,
        added: newItems.filter(i => !oldKeys.has(i.key)),
        removed: oldItems.filter(i => !newKeys.has(i.key)),
      }
    }).filter(c => c.added.length || c.removed.length)
    if (changes.length === 0) return { note: 'Mêmes éléments, attributs modifiés' }
    return {
      changes,
      added: changes.reduce((n, c) => n + c.added.length, 0),
      removed: changes.reduce((n, c) => n + c.removed.length, 0),
    }
  } catch {
    return { note: 'Valeurs illisibles (données corrompues ?)' }
  }
}

/* ------------------------------------------------------------ time axis */

const HOUR = 3_600_000
const DAY = 24 * HOUR
const STEPS = [HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR, DAY, 2 * DAY, 7 * DAY, 14 * DAY, 30 * DAY, 91 * DAY, 182 * DAY, 365 * DAY]

export interface TimeTick { t: number; label: string }

/** Tick dates for a time axis, on local calendar boundaries, about `target` of them. */
export function timeTicks(min: number, max: number, target = 7): TimeTick[] {
  const span = Math.max(max - min, HOUR)
  const step = STEPS.find(s => span / s <= target) ?? STEPS[STEPS.length - 1]
  const start = new Date(min)
  if (step >= DAY) start.setHours(0, 0, 0, 0)
  else start.setMinutes(0, 0, 0)
  if (step >= 30 * DAY) start.setDate(1)
  const fmt = new Intl.DateTimeFormat('fr-FR', step < DAY
    ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
    : step < 30 * DAY ? { day: 'numeric', month: 'short' } : { month: 'short', year: 'numeric' })
  const ticks: TimeTick[] = []
  const cursor = new Date(start)
  while (cursor.getTime() <= max && ticks.length < 40) {
    if (cursor.getTime() >= min) ticks.push({ t: cursor.getTime(), label: fmt.format(cursor) })
    if (step >= 30 * DAY) cursor.setMonth(cursor.getMonth() + Math.round(step / (30 * DAY)))
    else cursor.setTime(cursor.getTime() + step)
  }
  return ticks
}
