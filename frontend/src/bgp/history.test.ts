import { describe, expect, it } from 'vitest'
import { alertDetail, analyzeDiff, normalizeAlert, timeTicks } from './history'
import { snapshotEmptyDiffScenario, snapshotObjectDiffScenario } from '@/pages/__fixtures__/bgpVisualScenarios'

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
