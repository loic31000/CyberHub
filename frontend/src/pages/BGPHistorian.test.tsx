// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import BGPHistorian from './BGPHistorian'
import { bgpApi } from '@/api/client'
import type { BGPAlert, BGPSnapshot } from '@/types/bgp'
import { alertFeedScenario, snapshotTimelineScenario } from './__fixtures__/bgpVisualScenarios'

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
function RouteProbe() {
  const location = useLocation()
  return <p>Lookup route: {location.search}</p>
}

describe('BGP Historian presentation and navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

    expect(await screen.findByRole('heading', { name: 'Aucune alerte retournée' })).toBeTruthy()
    expect(screen.getByText(/ne permet pas de conclure qu’aucun snapshot n’existe/i)).toBeTruthy()
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
    expect(screen.queryByRole('heading', { name: 'Aucune alerte retournée' })).toBeNull()
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
    expect(await screen.findByText('Aucun changement entre ces deux snapshots.')).toBeTruthy()
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
    expect(await screen.findByText(`${alertFeedScenario.length} ALERTES`)).toBeTruthy()

    cleanup()
    api.getAlerts.mockRejectedValue(new Error('down'))
    render(<MemoryRouter initialEntries={['/bgp/historian']}><BGPHistorian /></MemoryRouter>)
    expect(await screen.findByText('FLUX INDISPONIBLE')).toBeTruthy()
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
