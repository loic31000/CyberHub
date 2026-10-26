// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import ConsoleRoutes from '@/ConsoleRoutes'
import { useAuthStore } from '@/store/auth'
import { bgpApi, connectorsApi } from '@/api/client'
import { NAV_ITEMS, breadcrumbFor, navItemFor } from '@/shell/navigation'
import { MODULES } from '@/dashboard2026/environmentRegistry'
import type { ConnectorSnapshot } from '@/types/connector'

vi.mock('@/api/client', () => ({
  bgpApi: { getAlerts: vi.fn() },
  connectorsApi: { list: vi.fn() },
}))
// The BGP pages are covered by their own suites; here only their routes matter.
vi.mock('@/pages/BGPLookup', () => ({ default: () => <p>Page BGP Lookup</p> }))
vi.mock('@/pages/BGPHistorian', () => ({ default: () => <p>Page BGP Historian</p> }))

const connectors = vi.mocked(connectorsApi)
const bgp = vi.mocked(bgpApi)

function Probe() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <output aria-label="Chemin courant">{location.pathname}</output>
      <button type="button" onClick={() => navigate(-1)}>Précédent</button>
      <button type="button" onClick={() => navigate(1)}>Suivant</button>
    </>
  )
}

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}><ConsoleRoutes /><Probe /></MemoryRouter>,
)
const path = () => screen.getByLabelText('Chemin courant').textContent
const tabs = () => within(screen.getByRole('navigation', { name: 'Espaces Network' }))

const snapshot = (over: Partial<ConnectorSnapshot>): ConnectorSnapshot => ({
  id: 'netalertx', name: 'NetAlertX', type: 'network_inventory', source: 'netalertx', capabilities: ['read'],
  permissions: { local_read: false, network_read: true, internet: false, local_write: false },
  inputs: [{ kind: 'local_api', format: 'API' }], outputs: [{ kind: 'asset' }], natural_entity_ref: true,
  enabled_by_default: false, limits: { timeout_ms: 15000, max_payload_bytes: 1024, streaming: false },
  enabled: true, status: 'ready', last_sync: null, last_success: null, never_synced: true, stale: false, last_error: null,
  ...over,
})

describe('Network workspace', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({ token: 't', isAuthenticated: true })
    connectors.list.mockResolvedValue({ items: [], total: 0 })
    bgp.getAlerts.mockResolvedValue({ items: [], total: 0, limit: 1, offset: 0 } as never)
  })
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('opens Overview on /network with the four domains and no invented source', async () => {
    renderAt('/network')
    expect(await screen.findByRole('heading', { name: 'Domaines' })).toBeTruthy()
    expect(tabs().getByRole('link', { name: 'Overview' }).getAttribute('aria-current')).toBe('page')
    // The spine states each missing source once; nothing is invented.
    await waitFor(() => expect(screen.getAllByText('Source non configurée')).toHaveLength(3))
    const rail = within(screen.getByRole('region', { name: 'État des domaines' }))
    expect(rail.getAllByText('Source non configurée')).toHaveLength(3)
    expect(rail.getByText('Aucune alerte locale')).toBeTruthy()
    expect(screen.getByText('Aucune alerte BGP enregistrée.')).toBeTruthy()
    expect(screen.getByText('NetAlertX prévu')).toBeTruthy()
    // No ready badge, no device, no alert is made up.
    expect(screen.queryByText('Disponible')).toBeNull()
    expect(screen.getByText('Observé')).toBeTruthy()
    expect(screen.getByText('Déduit')).toBeTruthy()
  })

  it.each([
    ['/network/devices', 'Devices', 'Appareils', 'NetAlertX'],
    ['/network/traffic', 'Traffic', 'Trafic', 'Zeek'],
    ['/network/detections', 'Detections', 'Détections', 'Suricata'],
  ])('deep-links %s to its workspace with an honest empty state', async (url, tab, title, planned) => {
    renderAt(url)
    expect(await screen.findByRole('heading', { name: title })).toBeTruthy()
    expect(tabs().getByRole('link', { name: tab }).getAttribute('aria-current')).toBe('page')
    expect(tabs().getByRole('link', { name: 'Overview' }).getAttribute('aria-current')).toBeNull()
    expect(await screen.findByText(`Aucune donnée disponible. Intégration prévue : ${planned}.`)).toBeTruthy()
  })

  it('deep-links /network/routing to the existing BGP tools without moving them', async () => {
    bgp.getAlerts.mockResolvedValue({ items: [], total: 3, limit: 1, offset: 0 } as never)
    renderAt('/network/routing')
    expect(await screen.findByRole('heading', { name: 'Routage' })).toBeTruthy()
    const panel = within(await screen.findByRole('region', { name: 'Routage' }))
    expect(await panel.findByText('3')).toBeTruthy()
    expect(panel.getByText('alertes BGP enregistrées.')).toBeTruthy()
    expect(panel.getByText('Source : BGP Historian · base locale CyberHub')).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'État des domaines' })).getByText('3 alertes locales')).toBeTruthy()
    const routing = within(screen.getByRole('region', { name: 'Routage' }))
    expect(routing.getByRole('link', { name: /BGP Lookup/ }).getAttribute('href')).toBe('/bgp')
    expect(routing.getByRole('link', { name: /BGP Historian/ }).getAttribute('href')).toBe('/bgp/historian')
    fireEvent.click(routing.getByRole('link', { name: /BGP Historian/ }))
    expect(await screen.findByText('Page BGP Historian')).toBeTruthy()
  })

  it('switches workspace through real links and keeps browser history', async () => {
    renderAt('/network')
    await screen.findByRole('heading', { name: 'Domaines' })
    fireEvent.click(tabs().getByRole('link', { name: 'Traffic' }))
    expect(await screen.findByRole('heading', { name: 'Trafic' })).toBeTruthy()
    expect(path()).toBe('/network/traffic')
    fireEvent.click(tabs().getByRole('link', { name: 'Routing' }))
    await screen.findByRole('heading', { name: 'Routage' })
    fireEvent.click(screen.getByRole('button', { name: 'Précédent' }))
    await waitFor(() => expect(path()).toBe('/network/traffic'))
    expect(screen.getByRole('heading', { name: 'Trafic' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Précédent' }))
    await waitFor(() => expect(path()).toBe('/network'))
    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }))
    await waitFor(() => expect(path()).toBe('/network/traffic'))
  })

  it('exposes workspaces as keyboard-reachable links in order', async () => {
    renderAt('/network')
    const links = tabs().getAllByRole('link')
    expect(links.map((l) => l.textContent)).toEqual(['00Overview', '01Devices', '02Traffic', '03Detections', '04Routing'])
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/network', '/network/devices', '/network/traffic', '/network/detections', '/network/routing'])
    for (const link of links) {
      link.focus()
      expect(document.activeElement).toBe(link)
    }
    await screen.findByRole('heading', { name: 'Domaines' })
  })

  it('sends an unknown workspace back to Overview', async () => {
    renderAt('/network/topology')
    await waitFor(() => expect(path()).toBe('/network'))
  })

  it('says the source state is unknown when the connectors API fails', async () => {
    connectors.list.mockRejectedValue(new Error('down'))
    bgp.getAlerts.mockRejectedValue(new Error('down'))
    renderAt('/network/devices')
    expect(await screen.findByText('État des sources inconnu')).toBeTruthy()
    expect(screen.queryByText('Source non configurée')).toBeNull()
    expect(within(screen.getByRole('region', { name: 'État des domaines' })).getAllByText('État inconnu')).toHaveLength(3)
  })

  it('shows only what a real connector reports: status, staleness, last error', async () => {
    connectors.list.mockResolvedValue({
      total: 3,
      items: [
        snapshot({ id: 'netalertx', status: 'unavailable', enabled: true }),
        snapshot({ id: 'lan', name: 'LAN', source: 'lan', status: 'ready', never_synced: false, last_success: '2026-10-01T08:00:00Z', stale: true }),
        snapshot({ id: 'old', name: 'Ancien', source: 'old', status: 'error', never_synced: false, last_success: '2026-10-01T08:00:00Z', last_error: { code: 'parse_failed', message: 'Réponse illisible', at: '2026-10-02T08:00:00Z' } }),
      ],
    })
    renderAt('/network/devices')
    expect(await screen.findByText('Indisponible')).toBeTruthy()
    expect(screen.getByText('Disponible')).toBeTruthy()
    expect(screen.getByText('Erreur')).toBeTruthy()
    // Staleness only where the source reports it.
    expect(screen.getAllByText('Données anciennes')).toHaveLength(1)
    expect(screen.getByText('Aucune donnée synchronisée.')).toBeTruthy()
    expect(screen.getByText('Dernière erreur : Réponse illisible')).toBeTruthy()
    // Other domains stay empty: the inventory connector does not leak there.
    fireEvent.click(tabs().getByRole('link', { name: 'Traffic' }))
    expect(await screen.findByText('Aucune donnée disponible. Intégration prévue : Zeek.')).toBeTruthy()
  })

  it('shows a disabled connector as disabled', async () => {
    connectors.list.mockResolvedValue({ total: 1, items: [snapshot({ type: 'network_detection', enabled: false, status: 'disabled' })] })
    renderAt('/network/detections')
    const panel = within(await screen.findByRole('region', { name: 'Détections' }))
    expect(await panel.findByText('Désactivé')).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'État des domaines' })).getByText('Désactivé')).toBeTruthy()
  })

  it('keeps /bgp and /bgp/historian working as before', async () => {
    renderAt('/bgp')
    expect(await screen.findByText('Page BGP Lookup')).toBeTruthy()
    cleanup()
    renderAt('/bgp/historian')
    expect(await screen.findByText('Page BGP Historian')).toBeTruthy()
  })
})

describe('Network in the module registry', () => {
  it('is a canonical module next to the BGP modules kept until their consolidation', () => {
    expect(MODULES.map((m) => m.id)).toEqual(expect.arrayContaining(['network', 'bgp', 'bgp-historian']))
    expect(NAV_ITEMS.find((i) => i.id === 'network')?.route).toBe('/network')
    expect(navItemFor('/network/devices')?.id).toBe('network')
    expect(navItemFor('/bgp/historian')?.id).toBe('bgp-historian')
    expect(navItemFor('/bgp')?.id).toBe('bgp')
    expect(breadcrumbFor('/network/routing')).toEqual({ section: 'OPS', label: 'Network' })
    expect(MODULES.find((m) => m.id === 'network')?.category).toBe('ops')
    expect(MODULES.find((m) => m.id === 'bgp')?.category).toBe('misc')
    expect(MODULES.find((m) => m.id === 'bgp-historian')?.category).toBe('misc')
  })
})
