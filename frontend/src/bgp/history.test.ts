import { describe, expect, it } from 'vitest'
import type { BGPDiffResponse } from '@/types/bgp'
import { alertDetail, analyzeDiff, normalizeAlert, snapshotMoment, snapshotOutcome, summarizeProvenance, timeTicks } from './history'
import {
  snapshotEmptyDiffScenario, snapshotIdenticalDiffScenario, snapshotImpossibleDiffScenario,
  snapshotObjectDiffScenario, snapshotPartialDiffScenario,
} from '@/pages/__fixtures__/bgpVisualScenarios'

describe('BGP Historian comparison states', () => {
  it('confirms identical data only when the backend reports all eight lists identical', () => {
    const analysis = analyzeDiff(snapshotIdenticalDiffScenario)
    expect(analysis.verdict).toBe('identical')
    expect(analysis.lists).toHaveLength(8)
    expect(analysis.lists.every(l => l.state === 'identical')).toBe(true)
    expect(analysis.notReported).toEqual([])
  })

  it('reports missing lists and never turns them into an identical verdict', () => {
    const analysis = analyzeDiff(snapshotPartialDiffScenario)
    expect(analysis.verdict).toBe('partial')
    expect(analysis.lists.filter(l => l.state === 'missing').map(l => l.label)).toEqual(['Peers IPv4', 'Peers IPv6'])
    expect(analysis.lists.filter(l => l.state === 'identical')).toHaveLength(6)
  })

  it('declares the comparison impossible when a snapshot cannot be decoded', () => {
    const analysis = analyzeDiff(snapshotImpossibleDiffScenario)
    expect(analysis.verdict).toBe('impossible')
    expect(analysis.decodeErrors).toEqual(['Snapshot avant : invalid character \'i\' looking for beginning of object key string'])
    expect(analysis.lists.every(l => l.state === 'error')).toBe(true)
    expect(analysis.sections).toHaveLength(0)
  })

  it('keeps confirmed changes visible next to lists that could not be compared', () => {
    const response: BGPDiffResponse = {
      ...snapshotObjectDiffScenario,
      diff: {
        ...snapshotObjectDiffScenario.diff,
        status: 'error',
        list_status: {
          ...snapshotIdenticalDiffScenario.diff.list_status,
          'prefixes.data.ipv4_prefixes': { status: 'changed' },
          'prefixes.data.ipv6_prefixes': { status: 'changed' },
          'peers.data.ipv4_peers': { status: 'changed' },
          'upstreams.data.ipv4_upstreams': { status: 'changed' },
          'downstreams.data.ipv4_downstreams': { status: 'error', older_error: 'downstreams.data: expected object' },
        },
      },
    }
    const analysis = analyzeDiff(response)
    expect(analysis.verdict).toBe('changed')
    expect(analysis.lists.find(l => l.field === 'ipv4_downstreams')).toMatchObject({ state: 'error', detail: 'downstreams.data: expected object' })
  })

  it('falls back to the old contract: omitted lists stay unreported, not identical', () => {
    const analysis = analyzeDiff(snapshotEmptyDiffScenario)
    expect(analysis.status).toBe('legacy')
    expect(analysis.verdict).toBe('unreported')
    expect(analysis.lists.every(l => l.state === 'unreported')).toBe(true)
  })
})

describe('BGP snapshot provenance', () => {
  it('marks snapshots without recorded provenance as unknown', () => {
    expect(summarizeProvenance('unknown', null).state).toBe('unknown')
    expect(summarizeProvenance(undefined, undefined).state).toBe('unknown')
  })

  it('reports the worst source, the stale sections and the oldest retrieval time', () => {
    const summary = summarizeProvenance('known', {
      info: { source: 'ripe', fetched_at: '2026-10-24T10:00:00Z', age_seconds: 0 },
      prefixes: { source: 'cache', fetched_at: '2026-10-24T09:55:00Z', age_seconds: 300 },
      peers: { source: 'cache-stale', fetched_at: '2026-10-24T07:00:00Z', age_seconds: 10_800 },
      upstreams: { source: 'cache-stale', fetched_at: '2026-10-24T08:00:00Z', age_seconds: 7_200 },
    })
    expect(summary.state).toBe('stale')
    expect(summary.staleSections).toEqual(['Peers', 'Upstreams'])
    expect(summary.missingSections).toEqual(['Downstreams'])
    expect(summary.oldestFetchedAt).toBe('2026-10-24T07:00:00Z')
    expect(summary.maxAgeSeconds).toBe(10_800)
  })

  it('distinguishes direct RIPE data from a fresh cache', () => {
    const all = (source: string) => Object.fromEntries(['info', 'prefixes', 'peers', 'upstreams', 'downstreams']
      .map(s => [s, { source, fetched_at: '2026-10-24T10:00:00Z', age_seconds: source === 'ripe' ? 0 : 120 }]))
    expect(summarizeProvenance('known', all('ripe')).state).toBe('ripe')
    expect(summarizeProvenance('known', all('cache')).state).toBe('cache')
  })

  it('orders snapshots by snapshot_date, falling back to created_at', () => {
    expect(snapshotMoment({ snapshot_date: '2026-10-24T10:00:00Z', created_at: '2026-10-25T10:00:00Z' })).toBe('2026-10-24T10:00:00Z')
    expect(snapshotMoment({ snapshot_date: '', created_at: '2026-10-25T10:00:00Z' })).toBe('2026-10-25T10:00:00Z')
  })
})

describe('BGP snapshot outcome message', () => {
  it('describes each comparison status without claiming more than the backend knows', () => {
    expect(snapshotOutcome({ snapshot: {}, alerts: [], comparison: { status: 'no_previous', previous_snapshot_id: null } }))
      .toEqual({ tone: 'success', message: 'Snapshot pris — premier snapshot de cet ASN, rien à comparer' })
    expect(snapshotOutcome({ snapshot: {}, alerts: [], comparison: { status: 'complete', previous_snapshot_id: 4 } }).message)
      .toBe('Snapshot pris — identique au snapshot #4 sur les 8 listes comparées')
    expect(snapshotOutcome({ snapshot: {}, alerts: [], comparison: { status: 'incomplete', previous_snapshot_id: 4 } }))
      .toMatchObject({ tone: 'warning', message: expect.stringContaining('comparaison partielle avec le snapshot #4') })
    expect(snapshotOutcome({ snapshot: {}, alerts: [], comparison: { status: 'error', previous_snapshot_id: 4 } }))
      .toMatchObject({ tone: 'warning', message: expect.stringContaining('comparaison impossible avec le snapshot #4') })
  })

  it('flags stale cache data and keeps the old message for an old backend', () => {
    const stale = snapshotOutcome({
      snapshot: {}, alerts: [], comparison: { status: 'complete', previous_snapshot_id: 4 },
      data_provenance: { peers: { source: 'cache-stale', fetched_at: '2026-10-24T07:00:00Z', age_seconds: 10_800 } },
    })
    expect(stale.tone).toBe('warning')
    expect(stale.message).toContain('Cache périmé : Peers')
    expect(snapshotOutcome({ snapshot: {}, alerts: [] })).toEqual({ tone: 'success', message: 'Snapshot pris avec succès' })
    expect(snapshotOutcome({ snapshot: {}, alerts: [{} as never, {} as never] }).message).toBe('Snapshot pris — 2 changement(s) détecté(s) !')
  })
})

describe('BGP Historian helpers', () => {
  it('normalizes the Go API JSON fields and accepts snake_case or camelCase aliases', () => {
    const detectedAt = '2026-10-23T12:00:00Z'
    const pascal = normalizeAlert({ ID: 7, CreatedAt: detectedAt, ASN: 64496, AlertType: 'peer_change', OldValue: '{}', NewValue: '{}', DetectedAt: detectedAt, Acknowledged: false })
    expect(pascal).toEqual({ id: 7, created_at: detectedAt, asn: 64496, alert_type: 'peer_change', old_value: '{}', new_value: '{}', detected_at: detectedAt, acknowledged: false })
    expect(normalizeAlert({ id: 8, asn: 1, alert_type: 'prefix_change', detected_at: detectedAt })?.detected_at).toBe(detectedAt)
    expect(normalizeAlert({ id: 9, asn: 2, alertType: 'upstream_change', detectedAt })?.alert_type).toBe('upstream_change')
    expect(normalizeAlert({ foo: 1 })).toBeNull()
  })

  it('splits real additions, removals and attribute changes and keeps before / after volumes', () => {
    const analysis = analyzeDiff(snapshotObjectDiffScenario)
    expect(analysis.sections.map(s => s.label)).toEqual(['Préfixes', 'Peers', 'Upstreams'])
    expect(analysis.notReported).toEqual(['Peers IPv6', 'Upstreams IPv6', 'Downstreams IPv4', 'Downstreams IPv6'])
    const v4 = analysis.sections[0].fields.find(f => f.field === 'ipv4_prefixes')!
    expect([v4.before, v4.after]).toEqual([3, 4])
    expect(v4.added.map(i => i.key)).toEqual(['203.0.113.0/24', '203.0.113.128/25'])
    expect(v4.removed.map(i => i.key)).toEqual(['192.0.2.0/24'])
    const peers = analysis.sections[1].fields[0]
    expect(peers.modified.map(m => m.key)).toEqual(['AS64498'])
    expect(peers.added.map(i => i.key)).toEqual(['AS64500'])
    expect(peers.removed).toHaveLength(0)
    expect([analysis.added, analysis.removed, analysis.modified]).toEqual([4, 2, 1])
  })

  it('does not claim omitted lists are identical in an empty diff response', () => {
    const analysis = analyzeDiff(snapshotEmptyDiffScenario)
    expect(analysis.sections).toHaveLength(0)
    expect(analysis.notReported).toEqual([
      'Préfixes IPv4', 'Préfixes IPv6', 'Peers IPv4', 'Peers IPv6',
      'Upstreams IPv4', 'Upstreams IPv6', 'Downstreams IPv4', 'Downstreams IPv6',
    ])
  })

  it('recomputes the exact items of an alert from its stored sections', () => {
    const detail = alertDetail({
      id: 1, asn: 1, alert_type: 'prefix_change', created_at: '', detected_at: '', acknowledged: false,
      old_value: JSON.stringify({ status: 'ok', data: { ipv4_prefixes: [{ prefix: '192.0.2.0/24' }], ipv6_prefixes: [] } }),
      new_value: JSON.stringify({ status: 'ok', data: { ipv4_prefixes: [{ prefix: '203.0.113.0/24' }], ipv6_prefixes: [] } }),
    })
    expect(detail).toMatchObject({ added: 1, removed: 1 })
    expect('changes' in detail && detail.changes[0].label).toBe('Préfixes IPv4')
    expect(alertDetail({ id: 2, asn: 1, alert_type: 'prefix_change', created_at: '', detected_at: '', acknowledged: false, old_value: '{', new_value: '{}' }))
      .toEqual({ note: 'Valeurs illisibles (données corrompues ?)' })
  })

  it('places calendar ticks inside the range, in order', () => {
    const min = Date.UTC(2025, 0, 1)
    const max = Date.UTC(2026, 9, 23)
    const ticks = timeTicks(min, max)
    expect(ticks.length).toBeGreaterThan(2)
    expect(ticks.length).toBeLessThanOrEqual(12)
    expect(ticks.every((t, i) => t.t >= min && t.t <= max && (i === 0 || t.t > ticks[i - 1].t))).toBe(true)
  })
})
