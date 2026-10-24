// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import BGPHistorian from './BGPHistorian'
import { bgpApi } from '@/api/client'
import type { BGPAlert, BGPDiffResponse, BGPSnapshot } from '@/types/bgp'
import {
  alertFeedScenario, snapshotEmptyDiffScenario, snapshotIdenticalDiffScenario, snapshotImpossibleDiffScenario,
  snapshotObjectDiffScenario, snapshotPartialDiffScenario, snapshotProvenanceScenario, snapshotTimelineScenario,
} from './__fixtures__/bgpVisualScenarios'

vi.mock('@/api/client', () => ({
  bgpApi: {
    lookupASN: vi.fn(), lookupASNPrefixes: vi.fn(), lookupASNPeers: vi.fn(),
    lookupASNUpstreams: vi.fn(), lookupASNDownstreams: vi.fn(), lookupIP: vi.fn(),
    getStatus: vi.fn(), search: vi.fn(), takeSnapshot: vi.fn(), getSnapshots: vi.fn(),
    getDiff: vi.fn(), getAlerts: vi.fn(), ackAlert: vi.fn(), exportIOC: vi.fn(),
  },
}))
vi.mock('@/store/toast', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const api = vi.mocked(bgpApi)
const snapshot = (id: number): BGPSnapshot => ({
  id, created_at: `2026-10-0${id}T12:00:00Z`, asn: 13335,
  snapshot_date: `2026-10-0${id}`, taken_by: 'analyst',
})
const alert: BGPAlert = {
  id: 9, created_at: '2026-10-23T12:00:00Z', detected_at: '2026-10-23T12:00:00Z',
  asn: 64500, alert_type: 'prefix_change', old_value: '[]', new_value: '[]', acknowledged: false,
}
function HistorianURL() {
  const location = useLocation()
  return <span data-testid="url">{location.search}</span>
}

function RouteProbe() {
  const location = useLocation()
  return <p>Lookup route: {location.search}</p>
}

describe('BGP Historian presentation and navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    api.getAlerts.mockResolvedValue({ items: [], total: 0, limit: 100, offset: 0 })
  })
  afterEach(cleanup)

  it('opens the selected ASN in BGP Lookup from an alert', async () => {
    api.getAlerts.mockResolvedValue({ items: [alert], total: 1, limit: 100, offset: 0 })
    render(
      <MemoryRouter initialEntries={['/bgp/historian']}>
        <Routes>
          <Route path="/bgp/historian" element={<BGPHistorian />} />
          <Route path="/bgp" element={<RouteProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'BGP HISTORIAN' })).toBeTruthy()
    expect(await screen.findByText('AS64500')).toBeTruthy()
    expect(document.querySelector('[data-alert-type="prefix_change"]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Lookup' }))
    expect(await screen.findByText('Lookup route: ?asn=64500')).toBeTruthy()
  })

  it('distinguishes an empty alert feed from an ASN with no snapshots', async () => {
    api.getSnapshots.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 })
    render(<MemoryRouter initialEntries={['/bgp/historian']}><BGPHistorian /></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: 'Aucune alerte non acquittée' })).toBeTruthy()
    expect(screen.getByText(/Un flux vide ne prouve pas qu’aucun changement n’a eu lieu/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Consulter les snapshots/ }))
    fireEvent.change(screen.getByLabelText('Numéro ASN'), { target: { value: 'AS64496' } })
    fireEvent.click(screen.getByRole('button', { name: /Charger l.historique/ }))

    expect(await screen.findByRole('heading', { name: 'Aucun snapshot retourné' })).toBeTruthy()
    expect(screen.getByText(/L’API n’a renvoyé aucun snapshot pour cet ASN/)).toBeTruthy()
    expect(api.getSnapshots).toHaveBeenCalledWith(64496, 50, 0)
  })

  it('renders a long fixture feed on a real event rail and keeps the hero free of topology', async () => {
    api.getAlerts.mockResolvedValue({ items: alertFeedScenario, total: alertFeedScenario.length, limit: 100, offset: 0 })
    render(<MemoryRouter initialEntries={['/bgp/historian']}><BGPHistorian /></MemoryRouter>)

    expect(await screen.findByText('AS64496')).toBeTruthy()
    expect(document.querySelectorAll('.bgp-event-node')).toHaveLength(alertFeedScenario.length)
    expect(document.querySelector('.bgp-page-head .bgp-route-motif')).toBeNull()
    expect(document.querySelectorAll('.bgp-route-motif')).toHaveLength(0)
  })

  it('exposes alert loading failures as recoverable errors', async () => {
    api.getAlerts.mockRejectedValue(new Error('Historian indisponible'))
    render(<MemoryRouter initialEntries={['/bgp/historian']}><BGPHistorian /></MemoryRouter>)

    expect((await screen.findByRole('alert')).textContent).toContain('Historian indisponible')
    expect(screen.getByRole('button', { name: 'Actualiser' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Aucune alerte non acquittée' })).toBeNull()
  })

  it('loads snapshots and compares additions and removals', async () => {
    api.getSnapshots.mockResolvedValue({ items: [snapshot(2), snapshot(1)], total: 2, limit: 50, offset: 0 })
    api.getDiff.mockResolvedValue({
      older: { id: 1, created_at: snapshot(1).created_at, asn: 13335 },
      newer: { id: 2, created_at: snapshot(2).created_at, asn: 13335 },
      diff: {
        changed_fields: ['prefixes'],
        changes: {
          prefixes: {
            ipv4_prefixes: {
              old: ['198.51.100.0/24'], new: ['203.0.113.0/24'],
              added: ['203.0.113.0/24'], removed: ['198.51.100.0/24'],
            },
          },
        },
      },
    })
    render(<MemoryRouter initialEntries={['/bgp/historian']}><BGPHistorian /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: 'Snapshots' }))
    fireEvent.change(screen.getByLabelText('Numéro ASN'), { target: { value: 'AS13335' } })
    fireEvent.click(screen.getByRole('button', { name: 'Charger l’historique' }))

    expect(await screen.findByLabelText('Comparer le snapshot 1')).toBeTruthy()
    expect(api.getSnapshots).toHaveBeenCalledWith(13335, 50, 0)
    fireEvent.click(screen.getByLabelText('Comparer le snapshot 1'))
    fireEvent.click(screen.getByLabelText('Comparer le snapshot 2'))
    fireEvent.click(screen.getByRole('button', { name: 'Comparer les snapshots' }))

    expect(await screen.findByRole('region', { name: 'Comparaison des snapshots' })).toBeTruthy()
    expect(document.querySelectorAll('.bgp-snapshot-item')).toHaveLength(2)
    expect(screen.getByText('AVANT · #1')).toBeTruthy()
    expect(screen.getByText('APRÈS · #2')).toBeTruthy()
    expect(screen.getByText('+ 203.0.113.0/24')).toBeTruthy()
    expect(screen.getByText('- 198.51.100.0/24')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fermer' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('region', { name: 'Comparaison des snapshots' })).toBeNull()
  })

  it('keeps a long snapshot fixture on the timeline in chronological order', async () => {
    api.getSnapshots.mockResolvedValue({ items: snapshotTimelineScenario, total: snapshotTimelineScenario.length, limit: 50, offset: 0 })
    render(<MemoryRouter initialEntries={['/bgp/historian']}><BGPHistorian /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: 'Snapshots' }))
    fireEvent.change(screen.getByLabelText('Numéro ASN'), { target: { value: 'AS64496' } })
    fireEvent.click(screen.getByRole('button', { name: /Charger l.historique/ }))

    expect(await screen.findByLabelText('Comparer le snapshot 212')).toBeTruthy()
    expect(document.querySelectorAll('.bgp-snapshot-item')).toHaveLength(snapshotTimelineScenario.length)
    expect(screen.getByText('12 snapshot(s) · AS64496')).toBeTruthy()
    expect(screen.getByText(/ne fournit ni leur âge ni l’heure de collecte source/)).toBeTruthy()
  })

  it('orders the comparison by snapshot date, whatever the selection order', async () => {
    api.getSnapshots.mockResolvedValue({ items: [snapshot(2), snapshot(1)], total: 2, limit: 50, offset: 0 })
    api.getDiff.mockResolvedValue({
      older: { id: 1, created_at: snapshot(1).created_at, asn: 13335 },
      newer: { id: 2, created_at: snapshot(2).created_at, asn: 13335 },
      diff: { changed_fields: [], changes: {} },
    })
    render(<MemoryRouter initialEntries={['/bgp/historian']}><BGPHistorian /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: 'Snapshots' }))
    fireEvent.change(screen.getByLabelText('Numéro ASN'), { target: { value: '13335' } })
    fireEvent.click(screen.getByRole('button', { name: 'Charger l’historique' }))
    fireEvent.click(await screen.findByLabelText('Comparer le snapshot 2'))
    fireEvent.click(screen.getByLabelText('Comparer le snapshot 1'))

    expect(screen.getByText('avant').closest('label')?.textContent).toContain('#1')
    expect(screen.getByText('après').closest('label')?.textContent).toContain('#2')
    fireEvent.click(screen.getByRole('button', { name: 'Comparer les snapshots' }))
    expect(await screen.findByText('Aucune différence n’est renvoyée par l’API.')).toBeTruthy()
    expect(api.getDiff).toHaveBeenCalledWith(13335, 1, 2)
  })

  it('opens the snapshots of the ASN given in the URL', async () => {
    api.getSnapshots.mockResolvedValue({ items: [snapshot(1)], total: 1, limit: 50, offset: 0 })
    render(<MemoryRouter initialEntries={['/bgp/historian?asn=AS13335']}><BGPHistorian /></MemoryRouter>)

    expect(await screen.findByLabelText('Comparer le snapshot 1')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Snapshots' }).getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByLabelText('Numéro ASN') as HTMLInputElement).value).toBe('13335')
    expect(api.getSnapshots).toHaveBeenCalledWith(13335, 50, 0)
  })

  it('reports the real alert feed in the hero status, also from the Snapshots tab', async () => {
    api.getAlerts.mockResolvedValue({ items: alertFeedScenario, total: alertFeedScenario.length, limit: 100, offset: 0 })
    render(<MemoryRouter initialEntries={['/bgp/historian?asn=64496']}><BGPHistorian /></MemoryRouter>)
    api.getSnapshots.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 })
    expect(await screen.findByText(`${alertFeedScenario.length} ALERTES NON ACQUITTÉES`)).toBeTruthy()

    cleanup()
    api.getAlerts.mockRejectedValue(new Error('down'))
    render(<MemoryRouter initialEntries={['/bgp/historian']}><BGPHistorian /></MemoryRouter>)
    expect(await screen.findByText('FLUX INDISPONIBLE')).toBeTruthy()
  })

  it('shows alerts sent with the Go field names and opens their exact changes', async () => {
    // Go's encoding/json uses these exported field names: BGPAlert has no json tags.
    const goShaped = {
      ID: 41, CreatedAt: '2026-10-23T12:00:00Z', ASN: 64496, AlertType: 'prefix_change', Acknowledged: false, DetectedAt: '2026-10-23T12:00:00Z',
      OldValue: JSON.stringify({ status: 'ok', data: { ipv4_prefixes: [{ prefix: '192.0.2.0/24' }], ipv6_prefixes: [] } }),
      NewValue: JSON.stringify({ status: 'ok', data: { ipv4_prefixes: [{ prefix: '203.0.113.0/24' }], ipv6_prefixes: [] } }),
    }
    api.getAlerts.mockResolvedValue({ items: [goShaped as unknown as BGPAlert], total: 1, limit: 100, offset: 0 })
    render(<MemoryRouter initialEntries={['/bgp/historian']}><BGPHistorian /></MemoryRouter>)

    expect(await screen.findByText('AS64496')).toBeTruthy()
    expect(screen.getByText('+1')).toBeTruthy()
    expect(screen.getByText('−1')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Détails' }))
    expect(screen.getByText('+ 203.0.113.0/24')).toBeTruthy()
    expect(screen.getByText('- 192.0.2.0/24')).toBeTruthy()
    expect(api.ackAlert).not.toHaveBeenCalled()
  })

  it('labels the API total as unacknowledged and distinguishes it from loaded rows', async () => {
    api.getAlerts.mockResolvedValue({ items: [alert], total: 101, limit: 100, offset: 0 })
    render(<MemoryRouter initialEntries={['/bgp/historian']}><BGPHistorian /></MemoryRouter>)

    expect(await screen.findByText(/1 affichée sur 101 alertes non acquittées/)).toBeTruthy()
    expect(screen.getByText('101 ALERTES NON ACQUITTÉES')).toBeTruthy()
  })

  it('filters the alert stream by change type', async () => {
    api.getAlerts.mockResolvedValue({ items: alertFeedScenario, total: alertFeedScenario.length, limit: 100, offset: 0 })
    render(<MemoryRouter initialEntries={['/bgp/historian']}><BGPHistorian /></MemoryRouter>)
    await screen.findByText('AS64496')

    fireEvent.click(screen.getByRole('button', { name: /^Préfixes/ }))
    expect(screen.getByRole('button', { name: /^Préfixes/ }).getAttribute('aria-pressed')).toBe('false')
    expect(document.querySelectorAll('.bgp-event[data-alert-type="prefix_change"]')).toHaveLength(0)
    expect(document.querySelectorAll('.bgp-event')).toHaveLength(3)
  })

  it('opens the snapshots of an alert ASN and keeps it in the URL', async () => {
    api.getAlerts.mockResolvedValue({ items: [alert], total: 1, limit: 100, offset: 0 })
    api.getSnapshots.mockResolvedValue({ items: [snapshot(1)], total: 1, limit: 50, offset: 0 })
    render(
      <MemoryRouter initialEntries={['/bgp/historian']}>
        <Routes><Route path="/bgp/historian" element={<><BGPHistorian /><HistorianURL /></>} /></Routes>
      </MemoryRouter>,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Snapshots de AS64500' }))
    expect(await screen.findByLabelText('Comparer le snapshot 1')).toBeTruthy()
    expect(api.getSnapshots).toHaveBeenCalledWith(64500, 50, 0)
    expect(screen.getByTestId('url').textContent).toBe('?asn=64500')
    expect(screen.getByRole('button', { name: 'Explorer AS64500 dans Network Atlas' })).toBeTruthy()
  })

  it('does not treat omitted diff lists as proof that snapshots are identical', async () => {
    api.getSnapshots.mockResolvedValue({ items: [snapshot(2), snapshot(1)], total: 2, limit: 50, offset: 0 })
    api.getDiff.mockResolvedValue(snapshotEmptyDiffScenario)
    render(<MemoryRouter initialEntries={['/bgp/historian?asn=64496']}><BGPHistorian /></MemoryRouter>)

    fireEvent.click(await screen.findByRole('button', { name: 'Comparer les deux plus récentes' }))
    expect(await screen.findByText('Aucune différence n’est renvoyée par l’API.')).toBeTruthy()
    expect(screen.getByText(/ne peuvent pas être déclarées identiques ou absentes/)).toBeTruthy()
    expect(screen.getByText(/Non renseignées dans ce diff/).parentElement?.textContent).toContain('Préfixes IPv4')
    expect(screen.getByText('AVANT · #211')).toBeTruthy()
    expect(screen.getByText('APRÈS · #212')).toBeTruthy()
    expect(screen.getByText(/Non comparés par l’API/)).toBeTruthy()
  })

  it('compares an observation with the previous one and shows volumes and attribute changes', async () => {
    api.getSnapshots.mockResolvedValue({ items: [snapshot(3), snapshot(2), snapshot(1)], total: 3, limit: 50, offset: 0 })
    api.getDiff.mockResolvedValue(snapshotObjectDiffScenario)
    render(<MemoryRouter initialEntries={['/bgp/historian?asn=64496']}><BGPHistorian /></MemoryRouter>)

    fireEvent.click(await screen.findByRole('button', { name: 'Comparer le snapshot 3 au précédent (#2) · AS64496' }))
    expect(api.getDiff).toHaveBeenCalledWith(64496, 2, 3)
    expect(await screen.findByRole('region', { name: 'Comparaison des snapshots' })).toBeTruthy()
    expect(screen.getByLabelText('Volume : 3 avant, 4 après')).toBeTruthy()
    expect(screen.getByText('~ AS64498')).toBeTruthy()
    expect(screen.getByText('+ AS64500')).toBeTruthy()
    expect(screen.getByText(/Non renseignées dans ce diff/).parentElement?.textContent).toContain('Downstreams IPv4')
    expect(screen.getByLabelText('Comparer le snapshot 3')).toHaveProperty('checked', true)
    expect(screen.getByLabelText('Comparer le snapshot 2')).toHaveProperty('checked', true)
  })

  it('ignores a comparison that answers after the selection changed', async () => {
    let answer: (value: BGPDiffResponse) => void = () => {}
    api.getSnapshots.mockResolvedValue({ items: [snapshot(3), snapshot(2), snapshot(1)], total: 3, limit: 50, offset: 0 })
    api.getDiff.mockImplementation(() => new Promise(resolve => { answer = resolve }))
    render(<MemoryRouter initialEntries={['/bgp/historian?asn=64496']}><BGPHistorian /></MemoryRouter>)

    fireEvent.click(await screen.findByRole('button', { name: 'Comparer les deux plus récentes' }))
    fireEvent.click(screen.getByLabelText('Comparer le snapshot 1'))
    answer(snapshotObjectDiffScenario)
    await Promise.resolve()
    expect(screen.queryByRole('region', { name: 'Comparaison des snapshots' })).toBeNull()
  })

  it('loads older observations on demand without losing the selection', async () => {
    const page1 = Array.from({ length: 50 }, (_, i) => ({ ...snapshot(1), id: 200 - i, created_at: new Date(Date.UTC(2026, 9, 23) - i * 86_400_000).toISOString() }))
    const page2 = [{ ...snapshot(1), id: 100, created_at: '2026-01-01T00:00:00Z' }]
    api.getSnapshots.mockResolvedValueOnce({ items: page1, total: 51, limit: 50, offset: 0 }).mockResolvedValueOnce({ items: page2, total: 51, limit: 50, offset: 50 })
    render(<MemoryRouter initialEntries={['/bgp/historian?asn=64496']}><BGPHistorian /></MemoryRouter>)

    fireEvent.click(await screen.findByLabelText('Comparer le snapshot 200'))
    expect(screen.getByText('50 plus récentes sur 51')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Charger 1 observation/ }))
    expect(await screen.findByLabelText('Comparer le snapshot 100')).toBeTruthy()
    expect(api.getSnapshots).toHaveBeenLastCalledWith(64496, 50, 50)
    expect(screen.getByLabelText('Comparer le snapshot 200')).toHaveProperty('checked', true)
  })

  it('lets the keyboard walk the timeline and select observations', async () => {
    api.getSnapshots.mockResolvedValue({ items: [snapshot(3), snapshot(2), snapshot(1)], total: 3, limit: 50, offset: 0 })
    render(<MemoryRouter initialEntries={['/bgp/historian?asn=64496']}><BGPHistorian /></MemoryRouter>)

    const newest = await screen.findByRole('button', { name: /^Observation #3,/ })
    expect(newest.getAttribute('tabindex')).toBe('0')
    newest.focus()
    fireEvent.keyDown(newest, { key: 'ArrowLeft' })
    const middle = screen.getByRole('button', { name: /^Observation #2,/ })
    expect(document.activeElement).toBe(middle)
    fireEvent.click(middle)
    fireEvent.click(screen.getByRole('button', { name: /^Observation #3,/ }))
    expect(screen.getByRole('button', { name: /^Observation #2, .*, avant$/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /^Observation #3, .*, après$/ })).toBeTruthy()
  })

  it('offers one-click shortcuts to ASNs whose snapshots were loaded or that appear in alerts', async () => {
    api.getAlerts.mockResolvedValue({ items: [alert], total: 1, limit: 100, offset: 0 })
    api.getSnapshots.mockResolvedValue({ items: [snapshot(2), snapshot(1)], total: 2, limit: 50, offset: 0 })
    const first = render(<MemoryRouter initialEntries={['/bgp/historian?asn=13335']}><BGPHistorian /></MemoryRouter>)
    await screen.findByLabelText('Comparer le snapshot 2')
    first.unmount()

    render(
      <MemoryRouter initialEntries={['/bgp/historian']}>
        <Routes><Route path="/bgp/historian" element={<><BGPHistorian /><HistorianURL /></>} /></Routes>
      </MemoryRouter>,
    )
    await screen.findByText('AS64500')
    fireEvent.click(screen.getByRole('button', { name: 'Snapshots' }))
    const shortcuts = screen.getByRole('navigation', { name: 'Accès rapide aux snapshots' })
    expect(shortcuts.textContent).toContain('AS13335')
    expect(shortcuts.textContent).toContain('2 snapshots')
    expect(shortcuts.textContent).toContain('AS64500')
    expect(shortcuts.textContent).toContain('alerte')

    fireEvent.click(within(shortcuts).getByRole('button', { name: /AS13335/ }))
    expect(await screen.findByLabelText('Comparer le snapshot 2')).toBeTruthy()
    expect(screen.getByTestId('url').textContent).toBe('?asn=13335')
  })

  describe('backend comparison and provenance contract', () => {
    const openComparison = async (diff: BGPDiffResponse) => {
      api.getSnapshots.mockResolvedValue({ items: snapshotProvenanceScenario, total: 3, limit: 50, offset: 0 })
      api.getDiff.mockResolvedValue(diff)
      render(<MemoryRouter initialEntries={['/bgp/historian?asn=64496']}><BGPHistorian /></MemoryRouter>)
      fireEvent.click(await screen.findByRole('button', { name: 'Comparer les deux plus récentes' }))
      return screen.findByRole('region', { name: 'Comparaison des snapshots' })
    }

    it('confirms identical data only from the eight list states, with each side’s provenance', async () => {
      const region = await openComparison(snapshotIdenticalDiffScenario)
      expect(within(region).getByText('Données identiques.')).toBeTruthy()
      const states = within(region).getByRole('list', { name: 'État des listes comparées' })
      expect(within(states).getAllByRole('listitem')).toHaveLength(8)
      expect(states.textContent).not.toMatch(/manquante|illisible|non renseignée/)
      expect(region.querySelector('[data-state="before"] .bgp-prov-note')?.textContent).toMatch(/^Cache \(Peers\) · récupéré à .* · âge 4 min à la prise$/)
      expect(region.querySelector('[data-state="after"] .bgp-prov-note')?.textContent).toMatch(/^Cache périmé \(Peers\) · récupéré à .* · âge 3 h 30 min à la prise$/)
      expect(within(region).queryByText(/Non renseignées dans ce diff/)).toBeNull()
    })

    it('reports missing lists without calling the snapshots identical, and unknown provenance', async () => {
      const region = await openComparison(snapshotPartialDiffScenario)
      expect(within(region).getByText('Aucune différence sur les listes comparables.')).toBeTruthy()
      expect(region.textContent).toContain('2 listes n’ont pas pu être comparées (Peers IPv4, Peers IPv6)')
      expect(within(region).queryByText('Données identiques.')).toBeNull()
      expect(region.querySelectorAll('.bgp-list-states li[data-state="missing"]')).toHaveLength(2)
      expect(region.querySelector('[data-state="before"] .bgp-prov-note')?.textContent).toContain('Provenance inconnue')
    })

    it('declares the comparison impossible when a snapshot is unreadable', async () => {
      const region = await openComparison(snapshotImpossibleDiffScenario)
      expect(within(region).getByText('Comparaison impossible.')).toBeTruthy()
      expect(region.textContent).toContain('Snapshot avant : invalid character')
      expect(region.textContent).not.toMatch(/Aucune différence|Données identiques/)
      expect(region.querySelectorAll('.bgp-list-states li[data-state="error"]')).toHaveLength(8)
    })

    it('tags stale, cached and unknown provenance on the observations', async () => {
      api.getSnapshots.mockResolvedValue({ items: snapshotProvenanceScenario, total: 3, limit: 50, offset: 0 })
      render(<MemoryRouter initialEntries={['/bgp/historian?asn=64496']}><BGPHistorian /></MemoryRouter>)
      await screen.findByLabelText('Comparer le snapshot 312')
      const tags = [...document.querySelectorAll('.bgp-snapshot-item .bgp-prov-tag')].map(t => [t.getAttribute('data-state'), t.textContent])
      expect(tags).toEqual([['stale', 'Cache périmé'], ['cache', 'Cache'], ['unknown', 'Provenance inconnue']])
      expect(document.querySelector('.bgp-axis-mark[data-provenance="stale"]')).not.toBeNull()
      expect(screen.getByText(/« provenance inconnue » marque les snapshots antérieurs/)).toBeTruthy()
    })
  })

  it('keeps the alert list on screen while it refreshes', async () => {
    api.getAlerts.mockResolvedValueOnce({ items: alertFeedScenario, total: alertFeedScenario.length, limit: 100, offset: 0 })
    render(<MemoryRouter initialEntries={['/bgp/historian']}><BGPHistorian /></MemoryRouter>)
    expect(await screen.findByText('AS64496')).toBeTruthy()

    api.getAlerts.mockReturnValueOnce(new Promise(() => {}))
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }))

    expect(screen.getByText('AS64496')).toBeTruthy()
    expect(screen.queryByText('Chargement des données BGP…')).toBeNull()
    expect(document.querySelectorAll('.bgp-event')).toHaveLength(alertFeedScenario.length)
  })
})
