// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { bgpApi, connectorsApi } from '@/api/client'
import { MODULES } from '@/dashboard2026/environmentRegistry'
import BGPLookup from '@/pages/BGPLookup'
import BGPHistorian from '@/pages/BGPHistorian'
import NetworkWorkspace from './NetworkWorkspace'

/*
 * #82: Network / Routing links the two BGP instruments without absorbing them.
 * The three real pages on their real paths; only the API is mocked. The shell
 * routing itself (ConsoleRoutes) is covered by NetworkWorkspace.test.tsx.
 */

vi.mock('@/api/client', () => ({
  bgpApi: {
    lookupASN: vi.fn(), lookupASNPrefixes: vi.fn(), lookupASNPeers: vi.fn(), lookupASNUpstreams: vi.fn(),
    lookupASNDownstreams: vi.fn(), lookupIP: vi.fn(), getStatus: vi.fn(), search: vi.fn(), takeSnapshot: vi.fn(),
    getSnapshots: vi.fn(), getDiff: vi.fn(), getAlerts: vi.fn(), ackAlert: vi.fn(), exportIOC: vi.fn(),
  },
  connectorsApi: { list: vi.fn() },
}))

const api = vi.mocked(bgpApi)
const envelope = <T,>(data: T) => ({ status: 'ok', status_message: '', data })
const asnInfo = {
  asn: 13335, name: 'CLOUDFLARENET', description_short: 'Cloudflare, Inc.', description_full: [], country_code: 'US',
  website: '', email_contacts: [], abuse_contacts: [], looking_glass: null, traffic_estimation: '', traffic_ratio: '', owner_address: [],
  rir_allocation: { rir_name: 'ARIN', country_code: 'US', prefix: '', prefix_ip: '', prefix_cidr: 0, allocation_status: '' }, date_updated: '',
}

function Probe() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <output aria-label="URL">{location.pathname + location.search}</output>
      <button type="button" onClick={() => navigate(-1)}>Précédent navigateur</button>
    </>
  )
}
const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/network/*" element={<NetworkWorkspace />} />
      <Route path="/bgp" element={<BGPLookup />} />
      <Route path="/bgp/historian" element={<BGPHistorian />} />
    </Routes>
    <Probe />
  </MemoryRouter>,
)
const url = () => screen.getByLabelText('URL').textContent
// A loaded test run can render a page in more than the default second.
const LAZY = { timeout: 5000 }
const page = (name: string) => screen.findByRole('heading', { name }, LAZY)

describe('Network / Routing ↔ BGP Lookup ↔ BGP Historian', { timeout: 20000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    vi.mocked(connectorsApi.list).mockResolvedValue({ items: [], total: 0 })
    api.getAlerts.mockResolvedValue({ items: [], total: 2, limit: 1, offset: 0 } as never)
    api.getStatus.mockResolvedValue({ available: true, primary: 'RIPE Stat', message: '', cache_available: false, cache_age_seconds: 0 })
    api.lookupASN.mockResolvedValue(envelope(asnInfo) as never)
    api.lookupASNPrefixes.mockResolvedValue(envelope({ ipv4_prefixes: [], ipv6_prefixes: [] }) as never)
    api.lookupASNPeers.mockResolvedValue(envelope({ ipv4_peers: [], ipv6_peers: [] }) as never)
    api.lookupASNUpstreams.mockResolvedValue(envelope({ ipv4_upstreams: [], ipv6_upstreams: [] }) as never)
    api.lookupASNDownstreams.mockResolvedValue(envelope({ ipv4_downstreams: [], ipv6_downstreams: [] }) as never)
    api.getSnapshots.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 } as never)
    api.takeSnapshot.mockResolvedValue({ snapshot: { id: 1, created_at: '', asn: 13335, snapshot_date: '', taken_by: 'local' }, alerts: [] } as never)
  })
  afterEach(cleanup)

  it('presents both BGP instruments in Routing, with the real local alerts', async () => {
    renderAt('/network/routing')
    const routing = within(await screen.findByRole('region', { name: 'Routage' }, LAZY))
    expect(await routing.findByText('alertes BGP enregistrées.')).toBeTruthy()
    expect(routing.getByText('Source : BGP Historian · base locale CyberHub')).toBeTruthy()
    expect(routing.getByRole('link', { name: 'Ouvrir BGP Lookup' }).getAttribute('href')).toBe('/bgp')
    expect(routing.getByRole('link', { name: 'Ouvrir BGP Historian' }).getAttribute('href')).toBe('/bgp/historian')
    // No ASN is offered when none was opened in this session.
    expect(routing.queryByText(/Dernier ASN ouvert/)).toBeNull()
    expect(api.getStatus).not.toHaveBeenCalled()
  })

  it('offers the last ASN really opened in BGP Lookup as a pivot', async () => {
    sessionStorage.setItem('cyberhub.bgp.visited', JSON.stringify([13335, 1299]))
    renderAt('/network/routing')
    const routing = within(await screen.findByRole('region', { name: 'Routage' }, LAZY))
    expect(routing.getByText('AS13335')).toBeTruthy()
    expect(routing.getByRole('link', { name: 'Lookup' }).getAttribute('href')).toBe('/bgp?asn=13335')
    expect(routing.getByRole('link', { name: 'Historique' }).getAttribute('href')).toBe('/bgp/historian?asn=13335')
  })

  it('opens Lookup and Historian from Routing, and comes back with the browser', async () => {
    renderAt('/network/routing')
    fireEvent.click(await screen.findByRole('link', { name: 'Ouvrir BGP Lookup' }))
    expect(await page('BGP LOOKUP')).toBeTruthy()
    expect(url()).toBe('/bgp')
    fireEvent.click(screen.getByRole('button', { name: 'Précédent navigateur' }))
    fireEvent.click(await screen.findByRole('link', { name: 'Ouvrir BGP Historian' }))
    expect(await page('BGP HISTORIAN')).toBeTruthy()
    expect(url()).toBe('/bgp/historian')
  })

  it('keeps Lookup → snapshot → Historian → back on the same ASN', async () => {
    renderAt('/bgp?asn=13335')
    fireEvent.click(await screen.findByRole('button', { name: /Prendre un snapshot/ }))
    await waitFor(() => expect(api.takeSnapshot).toHaveBeenCalledWith(13335))
    fireEvent.click(screen.getByRole('button', { name: /Historique de l’ASN/ }))
    expect(await page('BGP HISTORIAN')).toBeTruthy()
    expect(url()).toBe('/bgp/historian?asn=13335')
    fireEvent.click(screen.getByRole('button', { name: 'Précédent navigateur' }))
    expect(await page('BGP LOOKUP')).toBeTruthy()
    expect(url()).toBe('/bgp?asn=13335')
    expect(await page('CLOUDFLARENET')).toBeTruthy()
  })

  it('keeps the loaded ASN in the Lookup header link to Historian', async () => {
    renderAt('/bgp?asn=13335')
    await page('CLOUDFLARENET')
    fireEvent.click(screen.getByRole('button', { name: /^BGP Historian$/ }))
    await waitFor(() => expect(url()).toBe('/bgp/historian?asn=13335'), LAZY)
  })

  it('opens plain Historian from an idle Lookup', async () => {
    renderAt('/bgp')
    fireEvent.click(await screen.findByRole('button', { name: /^BGP Historian$/ }))
    await waitFor(() => expect(url()).toBe('/bgp/historian'), LAZY)
  })

  it('opens Lookup on the same ASN from Historian, and back', async () => {
    renderAt('/bgp/historian?asn=13335')
    expect(await page('BGP HISTORIAN')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^BGP Lookup$/ }))
    expect(await page('BGP LOOKUP')).toBeTruthy()
    expect(url()).toBe('/bgp?asn=13335')
    fireEvent.click(screen.getByRole('button', { name: 'Précédent navigateur' }))
    await waitFor(() => expect(url()).toBe('/bgp/historian?asn=13335'), LAZY)
  })

  // Only Historian has room for it without changing its layout; Lookup is left as is.
  it('returns from Historian to Network / Routing', async () => {
    renderAt('/bgp/historian')
    fireEvent.click(await screen.findByRole('button', { name: 'Network / Routing' }))
    expect(await screen.findByRole('region', { name: 'Routage' }, LAZY)).toBeTruthy()
    expect(url()).toBe('/network/routing')
  })

  it('keeps Network, BGP Lookup and BGP Historian as modules', () => {
    const routes = Object.fromEntries(MODULES.map((m) => [m.id, m.route]))
    expect(routes).toMatchObject({ network: '/network', bgp: '/bgp', 'bgp-historian': '/bgp/historian' })
  })
})
