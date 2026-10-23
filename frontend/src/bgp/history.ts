// Pure helpers behind BGP Historian. They only reshape what the backend returns
// (snapshot lists, diffs, alerts); nothing here invents a value.
import type { BGPAlert, BGPAlertType, BGPDiffField, BGPDiffResponse } from '@/types/bgp'

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

export interface DiffAnalysis {
  sections: SectionAnalysis[]
  /** Lists omitted by the diff response; the API does not say whether they were empty or identical. */
  notReported: string[]
  added: number
  removed: number
  modified: number
}

export function analyzeDiff(response: BGPDiffResponse): DiffAnalysis {
  const changes = response.diff.changes as Record<string, Record<string, BGPDiffField> | undefined>
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
  const notReported = COMPARED_SECTIONS.flatMap(({ section, fields }) => {
    const returnedFields = new Set(Object.keys(changes[section] ?? {}))
    return fields.filter(field => !returnedFields.has(field)).map(field => FIELD_LABEL[field])
  })
  return {
    sections,
    notReported,
    added: sections.reduce((n, s) => n + s.added, 0),
    removed: sections.reduce((n, s) => n + s.removed, 0),
    modified: sections.reduce((n, s) => n + s.modified, 0),
  }
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
