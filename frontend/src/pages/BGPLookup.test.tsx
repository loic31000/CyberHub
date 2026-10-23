// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BGPLookup from './BGPLookup'
import { bgpApi } from '@/api/client'
import type { ASNInfo } from '@/types/bgp'
import {
  asnSearchListScenario, downstreamScenario, peerScenario, upstreamScenario,
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
const envelope = <T,>(data: T) => ({ status: 'ok', status_message: '', data })
const asnInfo = {
  asn: 13335, name: 'CLOUDFLARENET', description_short: 'Cloudflare, Inc.',
  description_full: [], country_code: 'US', website: 'https://cloudflare.com',
  email_contacts: [], abuse_contacts: [], looking_glass: null, traffic_estimation: '',
  traffic_ratio: '', owner_address: [],
  rir_allocation: { rir_name: 'ARIN', country_code: 'US', prefix: '', prefix_ip: '', prefix_cidr: 0, allocation_status: '' },
  date_updated: '',
} satisfies ASNInfo

const renderPage = (entry = '/bgp') => render(<MemoryRouter initialEntries={[entry]}><BGPLookup /></MemoryRouter>)

describe('BGP Lookup presentation and navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getStatus.mockResolvedValue({ available: true, primary: 'BGPView', message: '', cache_available: false, cache_age_seconds: 0 })
    api.lookupASNPeers.mockResolvedValue(envelope({ ipv4_peers: [], ipv6_peers: [] }))
    api.lookupASNUpstreams.mockResolvedValue(envelope({ ipv4_upstreams: [], ipv6_upstreams: [] }))
    api.lookupASNDownstreams.mockResolvedValue(envelope({ ipv4_downstreams: [], ipv6_downstreams: [] }))
  })
  afterEach(cleanup)

  it('opens an ASN from the Historian query and navigates between ASN details', async () => {
    api.lookupASN.mockResolvedValue(envelope(asnInfo))
    api.lookupASNPrefixes.mockResolvedValue(envelope({
      ipv4_prefixes: [{ prefix: '203.0.113.0/24', ip: '203.0.113.0', cidr: 24, name: 'Example Net', country_code: 'US', description: '', parent: { prefix: '', ip: '', cidr: 0, rir_name: '', allocation_status: '' } }],
      ipv6_prefixes: [],
    }))

    renderPage('/bgp?asn=AS13335')

    expect(screen.getByRole('heading', { name: 'BGP LOOKUP' })).toBeTruthy()
    expect((screen.getByLabelText('Système autonome') as HTMLInputElement).value).toBe('13335')
    expect(await screen.findByText('BGPView')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Explorer/ }))

    expect(await screen.findByLabelText("Informations BGP de l'ASN")).toBeDefined()
    expect(document.querySelector('.bgp-asn-number')?.textContent).toContain('13335')
    fireEvent.click(screen.getByRole('button', { name: 'Préfixes IPv4' }))
    expect(await screen.findByText('203.0.113.0/24')).toBeTruthy()
    expect(api.lookupASNPrefixes).toHaveBeenCalledWith(13335)
  })

  it('keeps the search modes keyboard-operable as native buttons', () => {
    renderPage()
    const ipMode = screen.getByRole('button', { name: 'IP' })
    fireEvent.click(ipMode)
    expect(ipMode.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByLabelText('Adresse IP')).toBeTruthy()
  })

  it('shows an explicitly illustrative network map and prefills example queries', () => {
    renderPage()
    expect(screen.getByText('Schéma conceptuel · aucun état réseau représenté')).toBeTruthy()
    expect(document.querySelectorAll('.bgp-route-motif')).toHaveLength(1)
    expect(document.querySelector('.bgp-page-head .bgp-route-motif')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /IP 1\.1\.1\.1/ }))
    expect(screen.getByRole('button', { name: 'IP' }).getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByLabelText('Adresse IP') as HTMLInputElement).value).toBe('1.1.1.1')
    expect(api.lookupIP).not.toHaveBeenCalled()
  })

  it('keeps a long ASN result list scannable in the atlas surface', async () => {
    api.search.mockResolvedValue(envelope({ asns: asnSearchListScenario, ipv4_prefixes: [], ipv6_prefixes: [] }))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Recherche' }))
    fireEvent.change(screen.getByLabelText('Organisation, ASN ou préfixe'), { target: { value: 'Example' } })
    fireEvent.click(screen.getByRole('button', { name: /Explorer/ }))

    expect(await screen.findByText('6 résultat(s)')).toBeTruthy()
    expect(screen.getByRole('button', { name: /AS64496Example Transit North/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /AS64501Example Peering Lab/ })).toBeTruthy()
    expect(document.querySelectorAll('.bgp-route-motif')).toHaveLength(0)
  })

  it('builds the ASN relation atlas only from returned peer and direction data', async () => {
    api.lookupASN.mockResolvedValue(envelope(asnInfo))
    api.lookupASNPeers.mockResolvedValue(envelope({ ipv4_peers: peerScenario, ipv6_peers: [] }))
    api.lookupASNUpstreams.mockResolvedValue(envelope({ ipv4_upstreams: upstreamScenario, ipv6_upstreams: [] }))
    api.lookupASNDownstreams.mockResolvedValue(envelope({ ipv4_downstreams: downstreamScenario, ipv6_downstreams: [] }))
    renderPage('/bgp?asn=AS13335')

    fireEvent.click(screen.getByRole('button', { name: /Explorer/ }))

    expect(await screen.findByRole('heading', { name: 'Relations BGP observées' })).toBeTruthy()
    expect(await screen.findByRole('button', { name: /Ouvrir AS64497 Example Exchange West/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Ouvrir AS64501 Example Peering Lab/ })).toBeTruthy()
    expect(document.querySelector('[data-direction="upstream"] .bgp-relation-node')?.textContent).toContain('AS64501')
    expect(document.querySelector('[data-direction="downstream"] .bgp-relation-node')?.textContent).toContain('AS64499')
    expect(api.lookupASNPeers).toHaveBeenCalledWith(13335)
    expect(api.lookupASNUpstreams).toHaveBeenCalledWith(13335)
    expect(api.lookupASNDownstreams).toHaveBeenCalledWith(13335)
  })

  it('keeps available relations visible when one API relation group fails', async () => {
    api.lookupASN.mockResolvedValue(envelope(asnInfo))
    api.lookupASNPeers.mockResolvedValue(envelope({ ipv4_peers: peerScenario, ipv6_peers: [] }))
    api.lookupASNUpstreams.mockResolvedValue(envelope({ ipv4_upstreams: upstreamScenario, ipv6_upstreams: [] }))
    api.lookupASNDownstreams.mockRejectedValue(new Error('Downstream unavailable'))
    renderPage('/bgp?asn=AS13335')

    fireEvent.click(screen.getByRole('button', { name: /Explorer/ }))

    expect(await screen.findByRole('button', { name: /Ouvrir AS64497 Example Exchange West/ })).toBeTruthy()
    expect(await screen.findByText('Relation indisponible')).toBeTruthy()
    expect(document.querySelector('[data-direction="downstream"]')?.getAttribute('data-has-relations')).toBe('false')
    expect(document.querySelectorAll('[data-direction="downstream"] .bgp-relation-node')).toHaveLength(0)
  })

  it('keeps the result frame stable and announces a pending lookup', async () => {
    let finishLookup: (response: Awaited<ReturnType<typeof bgpApi.lookupASN>>) => void = () => {}
    api.lookupASN.mockImplementation(() => new Promise(resolve => { finishLookup = resolve }))
    renderPage('/bgp?asn=AS13335')

    fireEvent.click(screen.getByRole('button', { name: /Explorer/ }))
    expect(screen.getByRole('status').textContent).toContain('Chargement des données de routage')
    finishLookup(envelope(asnInfo))
    expect(await screen.findByLabelText("Informations BGP de l'ASN")).toBeTruthy()
  })

  it('shows the API error in the result surface and exposes cache provenance honestly', async () => {
    api.lookupASN.mockRejectedValue(new Error('Source unavailable'))
    api.getStatus.mockResolvedValue({ available: false, primary: 'BGPView', message: 'indisponible', cache_available: true, cache_age_seconds: 720 })
    renderPage('/bgp?asn=AS13335')

    expect(await screen.findByText('Cache · 12 min')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Explorer/ }))
    expect((await screen.findByRole('alert')).textContent).toContain('Source unavailable')
  })
})
