import { describe, expect, it } from 'vitest'
import type { BGPDiffResponse, BGPSnapshot, BGPSnapshotResponse, PaginatedResponse } from '@/types/bgp'
import { analyzeDiff, normalizeAlert, snapshotOutcome, summarizeProvenance } from './history'
// Real responses of the Go handlers, written by TestBGPHistorianHTTPContracts
// (backend/internal/api/handlers/bgp_contract_test.go). No RIPE call involved.
import snapshots from './__contracts__/snapshots.json'
import diffIdentical from './__contracts__/diff-identical.json'
import diffChanged from './__contracts__/diff-changed.json'
import diffPartial from './__contracts__/diff-partial.json'
import diffImpossible from './__contracts__/diff-impossible.json'
import alerts from './__contracts__/alerts.json'
import postFirst from './__contracts__/post-snapshot-first.json'
import postUnreadable from './__contracts__/post-snapshot-unreadable-previous.json'

const diff = (contract: { body: unknown }) => contract.body as BGPDiffResponse

describe('BGP Historian against the real backend contract', () => {
  it('reads the four comparison outcomes the backend can produce', () => {
    expect(analyzeDiff(diff(diffIdentical)).verdict).toBe('identical')
    expect(analyzeDiff(diff(diffPartial))).toMatchObject({ verdict: 'partial', status: 'incomplete' })
    expect(analyzeDiff(diff(diffImpossible))).toMatchObject({ verdict: 'impossible', status: 'error' })
    const changed = analyzeDiff(diff(diffChanged))
    expect(changed.verdict).toBe('changed')
    expect(changed.sections[0].fields[0].added.map(i => i.key)).toEqual(['203.0.113.0/24'])
    expect(changed.sections[0].fields[0].removed.map(i => i.key)).toEqual(['192.0.2.0/24'])
  })

  it('never reads a backend response as identical unless all eight lists say so', () => {
    for (const contract of [diffPartial, diffImpossible, diffChanged]) {
      const analysis = analyzeDiff(diff(contract))
      expect(analysis.verdict).not.toBe('identical')
      expect(analysis.lists).toHaveLength(8)
      expect(analysis.notReported).toEqual([])
    }
  })

  it('orders the backend list by snapshot date and reads each provenance', () => {
    const items = (snapshots.body as PaginatedResponse<BGPSnapshot>).items
    expect(items.map(s => s.id)).toEqual([4, 3, 2, 5, 1])
    expect(items.map(s => summarizeProvenance(s.provenance_status, s.data_provenance).state)).toEqual(['stale', 'stale', 'stale', 'unknown', 'unknown'])
    expect(summarizeProvenance(items[0].provenance_status, items[0].data_provenance)).toMatchObject({
      staleSections: ['Peers'], cachedSections: ['Préfixes'], oldestFetchedAt: '2026-10-23T05:30:00Z', maxAgeSeconds: 12600,
    })
    const older = diff(diffPartial).older
    expect(summarizeProvenance(older.provenance_status, older.data_provenance).state).toBe('unknown')
  })

  it('reads alerts in the backend format and keeps them unacknowledged', () => {
    const items = (alerts.body as { items: unknown[] }).items.map(normalizeAlert)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ asn: 64496, alert_type: 'prefix_change', acknowledged: false })
  })

  it('describes the comparison reported after a snapshot', () => {
    expect(snapshotOutcome(postFirst.body as BGPSnapshotResponse)).toEqual({ tone: 'success', message: 'Snapshot pris — premier snapshot de cet ASN, rien à comparer' })
    const unreadable = snapshotOutcome(postUnreadable.body as BGPSnapshotResponse)
    expect(unreadable.tone).toBe('warning')
    expect(unreadable.message).toContain('comparaison impossible')
    expect(postUnreadable.body.alerts).toBeNull()
  })
})
