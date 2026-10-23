/**
 * Development-only fixture harness. This file is not imported by the app entry
 * and dev-preview.html is not copied by the production Vite build.
 */
import ReactDOM from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { bgpApi } from '@/api/client'
import BGPLookup from '@/pages/BGPLookup'
import BGPHistorian from '@/pages/BGPHistorian'
import type { ASNInfo, BGPAlert, BGPDiffResponse, BGPSnapshot } from '@/types/bgp'
import {
  alertFeedScenario, asnInfoScenario, asnSearchListScenario,
  downstreamScenario, peerScenario, prefixScenario, snapshotDiffScenario,
  snapshotTimelineScenario, upstreamScenario,
} from '@/pages/__fixtures__/bgpVisualScenarios'
import '@/index.css'
import './BGPVisualPreview.css'

type PreviewScenario =
  | 'lookup-empty' | 'lookup-asn' | 'lookup-prefixes' | 'lookup-peers'
  | 'lookup-loading' | 'lookup-error' | 'lookup-partial' | 'historian-snapshots'
  | 'historian-diff' | 'historian-empty' | 'historian-loading' | 'historian-error'

const scenarios: { id: PreviewScenario; label: string }[] = [
  { id: 'lookup-empty', label: 'Lookup · initial' },
  { id: 'lookup-asn', label: 'Lookup · ASN complet' },
  { id: 'lookup-prefixes', label: 'Lookup · préfixes' },
  { id: 'lookup-peers', label: 'Lookup · peers' },
  { id: 'lookup-loading', label: 'Lookup · chargement' },
  { id: 'lookup-error', label: 'Lookup · erreur réseau' },
  { id: 'lookup-partial', label: 'Lookup · réponse partielle' },
  { id: 'historian-snapshots', label: 'Historian · snapshots' },
  { id: 'historian-diff', label: 'Historian · comparaison' },
  { id: 'historian-empty', label: 'Historian · vide' },
  { id: 'historian-loading', label: 'Historian · chargement' },
  { id: 'historian-error', label: 'Historian · erreur réseau' },
]

const query = new URLSearchParams(window.location.search)
const requestedScenario = query.get('scenario')
const scenario = scenarios.some(item => item.id === requestedScenario)
  ? requestedScenario as PreviewScenario
  : 'lookup-empty'
const isHistorian = scenario.startsWith('historian-')
const isLoading = scenario.endsWith('-loading')
const asnEnvelope = (data: ASNInfo) => ({ status: 'ok', status_message: '', data })
const collectionEnvelope = <T,>(data: T) => ({ status: 'ok', status_message: '', data })
const never = new Promise<never>(() => undefined)

// Replace only the imported API object in this isolated, development-only entry.
// All navigation and selection remains in the real BGP pages.
Object.assign(bgpApi, {
  getStatus: async () => ({
    available: true,
    primary: 'Fixture locale',
    message: 'Données fictives réservées à la prévisualisation.',
    cache_available: false,
    cache_age_seconds: 0,
  }),
  lookupASN: async (asn: number) => {
    if (scenario === 'lookup-loading') return never
    if (scenario === 'lookup-error') throw new Error('Échec réseau simulé · source de prévisualisation')
    return asnEnvelope({ ...asnInfoScenario, asn })
  },
  lookupASNPrefixes: async () => collectionEnvelope({ ipv4_prefixes: prefixScenario, ipv6_prefixes: [] }),
  lookupASNPeers: async () => collectionEnvelope({ ipv4_peers: peerScenario, ipv6_peers: [] }),
  lookupASNUpstreams: async () => collectionEnvelope({ ipv4_upstreams: upstreamScenario, ipv6_upstreams: [] }),
  lookupASNDownstreams: async () => {
    if (scenario === 'lookup-partial') throw new Error('Downstream indisponible dans cette fixture')
    return collectionEnvelope({ ipv4_downstreams: downstreamScenario, ipv6_downstreams: [] })
  },
  lookupIP: async () => { throw new Error('Aucune fixture IP dans ce scénario') },
  search: async () => collectionEnvelope({ asns: asnSearchListScenario, ipv4_prefixes: [], ipv6_prefixes: [] }),
  takeSnapshot: async () => ({ snapshot: snapshotTimelineScenario[0], alerts: [] }),
  exportIOC: async () => ({}),
  getAlerts: async (): Promise<{ items: BGPAlert[]; total: number; limit: number; offset: number }> => {
    if (isHistorian && isLoading) return never
    if (scenario === 'historian-error') throw new Error('Échec réseau simulé · flux Historian')
    const items = scenario === 'historian-empty' ? [] : alertFeedScenario
    return { items, total: items.length, limit: 100, offset: 0 }
  },
  ackAlert: async () => ({}),
  getSnapshots: async (): Promise<{ items: BGPSnapshot[]; total: number; limit: number; offset: number }> => {
    if (isHistorian && isLoading) return never
    if (scenario === 'historian-error') throw new Error('Échec réseau simulé · snapshots')
    const items = scenario === 'historian-empty' ? [] : snapshotTimelineScenario
    return { items, total: items.length, limit: 50, offset: 0 }
  },
  getDiff: async (): Promise<BGPDiffResponse> => snapshotDiffScenario,
})

function PreviewHarness() {
  const changeScenario = (next: string) => {
    window.location.search = `?scenario=${encodeURIComponent(next)}`
  }

  return (
    <>
      <aside className="bgp-fixture-banner" aria-label="Mode de prévisualisation">
        <strong>PRÉVISUALISATION LOCALE</strong>
        <span>Données fictives · aucune requête réelle</span>
        <label>
          <span className="sr-only">Scénario de prévisualisation</span>
          <select value={scenario} onChange={event => changeScenario(event.target.value)}>
            {scenarios.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
      </aside>
      <MemoryRouter initialEntries={[isHistorian ? '/bgp/historian' : scenario === 'lookup-empty' ? '/bgp' : '/bgp?asn=64496']}>
        {isHistorian ? <BGPHistorian /> : <BGPLookup />}
      </MemoryRouter>
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<PreviewHarness />)
