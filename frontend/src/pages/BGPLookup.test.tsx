// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
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

const infoForASN = (asn: number): ASNInfo => ({ ...asnInfo, asn, name: `Network AS${asn}` })

function LocationProbe() {
  const location = useLocation()
  return <span aria-label="URL courante">{location.search}</span>
}

function BrowserBackProbe() {
  const navigate = useNavigate()
  return <button type="button" onClick={() => navigate(-1)}>Historique navigateur précédent</button>
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

const renderPage = (entry = '/bgp') => render(<MemoryRouter initialEntries={[entry]}><BGPLookup /></MemoryRouter>)

describe('BGP Lookup presentation and navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    localStorage.clear()
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
    expect(await screen.findByLabelText("Informations BGP de l'ASN")).toBeDefined()
    expect(document.querySelector('.bgp-asn-number')?.textContent).toContain('13335')
    fireEvent.click(screen.getByRole('button', { name: /^Préfixes IPv4/ }))
    expect(await screen.findByText('203.0.113.0')).toBeTruthy()
    expect(screen.getByText('/24')).toBeTruthy()
    expect(api.lookupASNPrefixes).toHaveBeenCalledWith(13335)
  })

  it('navigates AS22773 → AS1299 → AS3356 and returns through the compact ASN history', async () => {
    api.lookupASN.mockImplementation(async asn => envelope(infoForASN(asn)))
    api.lookupASNPeers.mockImplementation(async asn => envelope({
      ipv4_peers: asn === 22773
        ? [{ asn: 1299, name: 'Arelion', description: 'Transit', country_code: 'SE' }]
        : asn === 1299
          ? [{ asn: 3356, name: 'Lumen', description: 'Transit', country_code: 'US' }]
          : [],
      ipv6_peers: [],
    }))
    render(
      <MemoryRouter initialEntries={['/bgp?asn=AS22773']}>
        <LocationProbe />
        <BGPLookup />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('button', { name: 'Ouvrir AS1299 Arelion' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir AS1299 Arelion' }))
    expect(await screen.findByRole('button', { name: 'Ouvrir AS3356 Lumen' })).toBeTruthy()
    expect(screen.getByLabelText('URL courante').textContent).toBe('?asn=1299')

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir AS3356 Lumen' }))
    await waitFor(() => expect(document.querySelector('.bgp-asn-number')?.textContent).toBe('AS3356'))
    expect(screen.getByRole('button', { name: 'Retour à AS1299' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Retour à AS1299' }))
    await waitFor(() => expect(document.querySelector('.bgp-asn-number')?.textContent).toBe('AS1299'))
    expect(screen.getByLabelText('URL courante').textContent).toBe('?asn=1299')
    expect(api.lookupASN.mock.calls.map(([asn]) => asn)).toEqual([22773, 1299, 3356, 1299])
  })

  it('restores the previous ASN when browser history moves back', async () => {
    api.lookupASN.mockImplementation(async asn => envelope(infoForASN(asn)))
    api.lookupASNPeers.mockImplementation(async asn => envelope({
      ipv4_peers: asn === 22773 ? [{ asn: 1299, name: 'Arelion', description: 'Transit', country_code: 'SE' }] : [],
      ipv6_peers: [],
    }))
    render(
      <MemoryRouter initialEntries={['/bgp?asn=22773']}>
        <BrowserBackProbe />
        <LocationProbe />
        <BGPLookup />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Ouvrir AS1299 Arelion' }))
    await waitFor(() => expect(document.querySelector('.bgp-asn-number')?.textContent).toBe('AS1299'))
    fireEvent.click(screen.getByRole('button', { name: 'Historique navigateur précédent' }))

    await waitFor(() => expect(document.querySelector('.bgp-asn-number')?.textContent).toBe('AS22773'))
    expect(screen.getByLabelText('URL courante').textContent).toBe('?asn=22773')
    expect(screen.getByRole('button', { name: 'Retour à AS1299' })).toBeTruthy()
  })

  it('keeps the latest ASN when an earlier lookup resolves after it', async () => {
    const slowASN = deferred<Awaited<ReturnType<typeof bgpApi.lookupASN>>>()
    api.lookupASN.mockImplementation(asn => asn === 22773
      ? slowASN.promise
      : Promise.resolve(envelope(infoForASN(asn))))
    render(
      <MemoryRouter initialEntries={['/bgp']}>
        <LocationProbe />
        <BGPLookup />
      </MemoryRouter>,
    )

    const input = screen.getByLabelText('Système autonome')
    fireEvent.change(input, { target: { value: 'AS22773' } })
    fireEvent.click(screen.getByRole('button', { name: 'Explorer' }))
    expect(await screen.findByText('Chargement des données de routage…')).toBeTruthy()

    fireEvent.change(input, { target: { value: 'AS1299' } })
    fireEvent.click(screen.getByRole('button', { name: 'Remplacer la recherche en cours' }))
    await waitFor(() => expect(document.querySelector('.bgp-asn-number')?.textContent).toBe('AS1299'))
    slowASN.resolve(envelope(infoForASN(22773)))

    await waitFor(() => expect(screen.getByLabelText('URL courante').textContent).toBe('?asn=1299'))
    expect(document.querySelector('.bgp-asn-number')?.textContent).toBe('AS1299')
    expect(screen.queryByText('Network AS22773')).toBeNull()
    expect(api.lookupASN.mock.calls.map(([asn]) => asn)).toEqual([22773, 1299])
  })

  it('resets tab-specific data when the selected ASN changes', async () => {
    api.lookupASN.mockImplementation(async asn => envelope(infoForASN(asn)))
    api.lookupASNPrefixes.mockResolvedValue(envelope({ ipv4_prefixes: [], ipv6_prefixes: [] }))
    renderPage('/bgp?asn=AS22773')

    await screen.findAllByText('Network AS22773')
    fireEvent.click(screen.getByRole('button', { name: /^Préfixes IPv4/ }))
    expect(await screen.findByText('Aucune donnée')).toBeTruthy()
    const input = screen.getByLabelText('Système autonome')
    fireEvent.change(input, { target: { value: 'AS1299' } })
    fireEvent.click(screen.getByRole('button', { name: 'Explorer' }))

    await screen.findAllByText('Network AS1299')
    expect(screen.getByRole('button', { name: 'Atlas' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /^Préfixes IPv4/ }).getAttribute('aria-pressed')).toBe('false')
  })

  it('keeps the search modes keyboard-operable as native buttons', () => {
    renderPage()
    const ipMode = screen.getByRole('button', { name: 'IP' })
    fireEvent.click(ipMode)
    expect(ipMode.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByLabelText('Adresse IP')).toBeTruthy()
  })

  it('shows a labelled, static reading guide and prefills example queries', () => {
    renderPage()
    expect(screen.getByText('Schéma de lecture · aucun état réseau représenté')).toBeTruthy()
    expect(document.querySelectorAll('.bgp-atlas-schematic')).toHaveLength(1)
    expect(document.querySelector('.chh .bgp-atlas-schematic')).toBeNull()
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
    expect(document.querySelectorAll('.bgp-atlas-schematic')).toHaveLength(0)
  })

  it('builds the ASN relation atlas only from returned peer and direction data', async () => {
    api.lookupASN.mockResolvedValue(envelope(asnInfo))
    api.lookupASNPeers.mockResolvedValue(envelope({ ipv4_peers: peerScenario, ipv6_peers: [] }))
    api.lookupASNUpstreams.mockResolvedValue(envelope({ ipv4_upstreams: upstreamScenario, ipv6_upstreams: [] }))
    api.lookupASNDownstreams.mockResolvedValue(envelope({ ipv4_downstreams: downstreamScenario, ipv6_downstreams: [] }))
    renderPage('/bgp?asn=AS13335')

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

    expect(await screen.findByRole('button', { name: /Ouvrir AS64497 Example Exchange West/ })).toBeTruthy()
    expect(await screen.findByText('Relation indisponible')).toBeTruthy()
    expect(document.querySelector('[data-direction="downstream"]')?.getAttribute('data-has-relations')).toBe('false')
    expect(document.querySelectorAll('[data-direction="downstream"] .bgp-relation-node')).toHaveLength(0)
  })

  it('keeps the result frame stable and announces a pending lookup', async () => {
    let finishLookup: (response: Awaited<ReturnType<typeof bgpApi.lookupASN>>) => void = () => {}
    api.lookupASN.mockImplementation(() => new Promise(resolve => { finishLookup = resolve }))
    renderPage('/bgp?asn=AS13335')

    expect(await screen.findByText('Chargement des données de routage…')).toBeTruthy()
    finishLookup(envelope(asnInfo))
    expect(await screen.findByLabelText("Informations BGP de l'ASN")).toBeTruthy()
  })

  it('shows the API error in the result surface and exposes cache provenance honestly', async () => {
    api.lookupASN
      .mockRejectedValueOnce(new Error('Source unavailable'))
      .mockResolvedValueOnce(envelope(asnInfo))
    api.getStatus.mockResolvedValue({ available: false, primary: 'BGPView', message: 'indisponible', cache_available: true, cache_age_seconds: 720 })
    renderPage('/bgp?asn=AS13335')

    expect(await screen.findByText('Cache · 12 min')).toBeTruthy()
    expect((await screen.findByRole('alert')).textContent).toContain('Source unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Explorer' }))
    expect(await screen.findByRole('heading', { name: 'CLOUDFLARENET' })).toBeTruthy()
    expect(api.lookupASN).toHaveBeenCalledTimes(2)
  })

  it('reuses relation responses when returning to an ASN, but refreshes its identity', async () => {
    api.lookupASN.mockImplementation(async asn => envelope(infoForASN(asn)))
    api.lookupASNPrefixes.mockResolvedValue(envelope({ ipv4_prefixes: [], ipv6_prefixes: [] }))
    api.lookupASNPeers.mockImplementation(async asn => envelope({
      ipv4_peers: asn === 22773 ? [{ asn: 1299, name: 'Arelion', description: 'Transit', country_code: 'SE' }] : [],
      ipv6_peers: [],
    }))
    renderPage('/bgp?asn=22773')

    fireEvent.click(await screen.findByRole('button', { name: 'Ouvrir AS1299 Arelion' }))
    await waitFor(() => expect(document.querySelector('.bgp-asn-number')?.textContent).toBe('AS1299'))
    fireEvent.click(screen.getByRole('button', { name: 'Retour à AS22773' }))

    expect(await screen.findByRole('button', { name: 'Ouvrir AS1299 Arelion, déjà visité' })).toBeTruthy()
    expect(api.lookupASN.mock.calls.map(([asn]) => asn)).toEqual([22773, 1299, 22773])
    expect(api.lookupASNPeers.mock.calls.map(([asn]) => asn)).toEqual([22773, 1299])
    expect(api.lookupASNPrefixes.mock.calls.map(([asn]) => asn)).toEqual([22773, 1299])
  })

  it('marks opened ASNs as visited in the atlas and the relation tables, and the current one as explored', async () => {
    api.lookupASN.mockImplementation(async asn => envelope(infoForASN(asn)))
    api.lookupASNPrefixes.mockResolvedValue(envelope({ ipv4_prefixes: [], ipv6_prefixes: [] }))
    // 22773 peers with 1299 and 3356; 1299 lists 22773 back.
    api.lookupASNPeers.mockImplementation(async asn => envelope({
      ipv4_peers: asn === 22773
        ? [{ asn: 1299, name: 'Arelion', description: '', country_code: 'SE' }, { asn: 3356, name: 'Lumen', description: '', country_code: 'US' }]
        : [{ asn: 22773, name: 'Cox', description: '', country_code: 'US' }],
      ipv6_peers: [],
    }))
    renderPage('/bgp?asn=22773')

    // Nothing opened yet besides the current ASN: neighbours look normal.
    expect(await screen.findByRole('button', { name: 'Ouvrir AS1299 Arelion' })).toBeTruthy()
    expect(document.querySelectorAll('.bgp-relation-node[data-visit]')).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir AS1299 Arelion' }))
    const back = await screen.findByRole('button', { name: 'Ouvrir AS22773 Cox, déjà visité' })
    expect(back.getAttribute('data-visit')).toBe('visited')
    expect(back.textContent).toContain('visité')

    fireEvent.click(back)
    const opened = await screen.findByRole('button', { name: 'Ouvrir AS1299 Arelion, déjà visité' })
    expect(opened.textContent).toContain('visité')
    // Listed but never opened: not visited.
    expect(screen.getByRole('button', { name: 'Ouvrir AS3356 Lumen' }).getAttribute('data-visit')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /^Peers/ }))
    const row = screen.getByRole('button', { name: "Ouvrir l'ASN 1299, déjà visité" }).closest('tr')
    expect(row?.getAttribute('data-visit')).toBe('visited')
    expect(screen.getByRole('button', { name: "Ouvrir l'ASN 3356" }).closest('tr')?.getAttribute('data-visit')).toBeNull()
    expect(screen.getByRole('button', { name: "Ouvrir l'ASN 1299, déjà visité" })).toBeTruthy()
  })

  it('does not count an overtaken lookup as visited', async () => {
    const slowASN = deferred<Awaited<ReturnType<typeof bgpApi.lookupASN>>>()
    api.lookupASN.mockImplementation(asn => asn === 22773 ? slowASN.promise : Promise.resolve(envelope(infoForASN(asn))))
    api.lookupASNPrefixes.mockResolvedValue(envelope({ ipv4_prefixes: [], ipv6_prefixes: [] }))
    api.lookupASNPeers.mockResolvedValue(envelope({ ipv4_peers: [{ asn: 22773, name: 'Cox', description: '', country_code: 'US' }], ipv6_peers: [] }))
    renderPage()

    const input = screen.getByLabelText('Système autonome')
    fireEvent.change(input, { target: { value: '22773' } })
    fireEvent.click(screen.getByRole('button', { name: 'Explorer' }))
    fireEvent.change(input, { target: { value: '1299' } })
    fireEvent.click(screen.getByRole('button', { name: 'Remplacer la recherche en cours' }))
    await waitFor(() => expect(document.querySelector('.bgp-asn-number')?.textContent).toBe('AS1299'))
    slowASN.resolve(envelope(infoForASN(22773)))

    expect(await screen.findByRole('button', { name: 'Ouvrir AS22773 Cox' })).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: 'ASN précédemment explorés' })).toBeNull()
    expect(JSON.parse(sessionStorage.getItem('cyberhub.bgp.visited') ?? '[]')).toEqual([1299])
  })

  it('keeps visit marks through browser back and across a remount of the page', async () => {
    api.lookupASN.mockImplementation(async asn => envelope(infoForASN(asn)))
    api.lookupASNPrefixes.mockResolvedValue(envelope({ ipv4_prefixes: [], ipv6_prefixes: [] }))
    api.lookupASNPeers.mockImplementation(async asn => envelope({
      ipv4_peers: asn === 22773 ? [{ asn: 1299, name: 'Arelion', description: '', country_code: 'SE' }] : [],
      ipv6_peers: [],
    }))
    const view = render(
      <MemoryRouter initialEntries={['/bgp?asn=22773']}>
        <BrowserBackProbe />
        <BGPLookup />
      </MemoryRouter>,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Ouvrir AS1299 Arelion' }))
    await waitFor(() => expect(document.querySelector('.bgp-asn-number')?.textContent).toBe('AS1299'))
    fireEvent.click(screen.getByRole('button', { name: 'Historique navigateur précédent' }))
    expect(await screen.findByRole('button', { name: 'Ouvrir AS1299 Arelion, déjà visité' })).toBeTruthy()

    view.unmount()
    renderPage('/bgp?asn=22773')
    expect(await screen.findByRole('button', { name: 'Ouvrir AS1299 Arelion, déjà visité' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retour à AS1299' })).toBeTruthy()
  })

  it('remembers an ASN once a snapshot is taken, for the Historian shortcuts', async () => {
    api.lookupASN.mockResolvedValue(envelope(asnInfo))
    api.lookupASNPrefixes.mockResolvedValue(envelope({ ipv4_prefixes: [], ipv6_prefixes: [] }))
    api.takeSnapshot.mockResolvedValue({ snapshot: { id: 1, created_at: '', asn: 13335, snapshot_date: '', taken_by: 'local' }, alerts: [] })
    renderPage('/bgp?asn=13335')

    fireEvent.click(await screen.findByRole('button', { name: /Prendre un snapshot/ }))
    await waitFor(() => expect(JSON.parse(localStorage.getItem('cyberhub.bgp.snapshot-asns') ?? '[]')[0]?.asn).toBe(13335))
  })

  it('shows the BGP source state in the hero status line', async () => {
    renderPage()
    expect(await screen.findByText('EN LIGNE')).toBeTruthy()
    expect(screen.getByText('BGPVIEW')).toBeTruthy()
  })

  it('marks visited ASNs in search results', async () => {
    api.lookupASN.mockImplementation(async asn => envelope(infoForASN(asn)))
    api.lookupASNPrefixes.mockResolvedValue(envelope({ ipv4_prefixes: [], ipv6_prefixes: [] }))
    api.search.mockResolvedValue(envelope({ asns: asnSearchListScenario, ipv4_prefixes: [], ipv6_prefixes: [] }))
    renderPage('/bgp?asn=64497')
    await waitFor(() => expect(document.querySelector('.bgp-asn-number')?.textContent).toBe('AS64497'))

    fireEvent.click(screen.getByRole('button', { name: 'Recherche' }))
    fireEvent.change(screen.getByLabelText('Organisation, ASN ou préfixe'), { target: { value: 'Example' } })
    fireEvent.click(screen.getByRole('button', { name: /Explorer/ }))

    expect((await screen.findByRole('button', { name: /AS64497Example Exchange West/ })).getAttribute('data-visit')).toBe('visited')
    expect(screen.getByRole('button', { name: /AS64496Example Transit North/ }).getAttribute('data-visit')).toBeNull()
  })

  it('shows relation counts in the dossier views and opens the full list from the atlas', async () => {
    api.lookupASN.mockResolvedValue(envelope(asnInfo))
    api.lookupASNPrefixes.mockResolvedValue(envelope({ ipv4_prefixes: [], ipv6_prefixes: [] }))
    const manyPeers = Array.from({ length: 12 }, (_, i) => ({ asn: 64500 + i, name: `Peer ${i}`, description: '', country_code: 'FR' }))
    api.lookupASNPeers.mockResolvedValue(envelope({ ipv4_peers: manyPeers, ipv6_peers: [] }))
    renderPage('/bgp?asn=13335')

    expect(await screen.findByRole('button', { name: 'Peers 12' })).toBeTruthy()
    expect(document.querySelectorAll('.bgp-peering .bgp-relation-node')).toHaveLength(9)
    fireEvent.click(screen.getByRole('button', { name: /voir les 12 peers/ }))
    expect(screen.getByRole('button', { name: 'Peers 12' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('table', { name: 'Peers' })).toBeTruthy()
  })
})
