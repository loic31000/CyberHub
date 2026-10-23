import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Network, Search, Camera, Copy, ShieldBan,
  ChevronRight, Globe, Server, ArrowUpCircle,
  ArrowDownCircle, Users, Loader2, AlertCircle, History,
  Activity, Database,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { bgpApi } from '@/api/client'
import { toast } from '@/store/toast'
import { ModuleHero } from '@/hero/ModuleHero'
import BGPRouteMotif from './BGPRouteMotif'
import type {
  ASNInfo, IPv4Prefix, IPv6Prefix, BGPPeer, BGPUpstream, BGPDownstream,
  IPInfo, SearchASN, PrefixListData, PeerListData,
  UpstreamListData, DownstreamListData, BGPStatusResponse,
} from '@/types/bgp'
import './bgp-console.css'

function parseAPIError(error: unknown): string {
  if (error instanceof Error) {
    const axiosError = error as {
      response?: { data?: { error?: string }; status?: number }
    }
    return axiosError.response?.data?.error || error.message
  }
  return 'Erreur réseau'
}

type SearchMode = 'asn' | 'ip' | 'search'
type ASNTab = 'info' | 'ipv4' | 'ipv6' | 'peers' | 'upstreams' | 'downstreams'

const PAGE_SIZE = 20

function stripASN(raw: string): number {
  return parseInt(raw.replace(/^AS/i, '').trim(), 10)
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success('Copié !'))
}

function countryFlag(code: string) {
  if (!code) return ''
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join('')
}

function Spinner() {
  return (
    <div className="bgp-state bgp-state--loading" role="status" aria-live="polite">
      <Loader2 size={24} aria-hidden="true" />
      <span>Chargement des données de routage…</span>
    </div>
  )
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="bgp-state bgp-state--error" role="alert">
      <AlertCircle size={16} aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

function EmptyState({ label = 'Aucune donnée' }: { label?: string }) {
  return (
    <div className="bgp-results-empty">
      <Database size={22} aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}

interface PagedTableProps<T> {
  items: T[]
  renderRow: (item: T, idx: number) => React.ReactNode
  headers: string[]
}

function PagedTable<T>({ items, renderRow, headers }: PagedTableProps<T>) {
  const [page, setPage] = useState(1)
  const totalPages = Math.ceil(items.length / PAGE_SIZE)
  const slice = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div>
      <div className="bgp-table-scroll">
        <table aria-label={headers.join(', ')}>
          <thead>
            <tr className="border-b border-[#1e2d40]">
              {headers.map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 ? (
              <tr>
                <td colSpan={headers.length}>
                  Aucune donnée
                </td>
              </tr>
            ) : (
              slice.map((item, i) => renderRow(item, i))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="bgp-pagination" aria-label="Pagination">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="Page précédente"
            className="bgp-button"
          >
            ←
          </button>
          <span className="text-[#4a6480]" aria-live="polite">{page} / {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            aria-label="Page suivante"
            className="bgp-button"
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}

interface ASNTabsProps {
  asn: number
  info: ASNInfo
  onNavigatePeer: (asn: number) => void
  lastSnapshotDate: string | null
}

function ASNTabs({ asn, info, onNavigatePeer, lastSnapshotDate }: ASNTabsProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<ASNTab>('info')
  const [snapping, setSnapping] = useState(false)

  const [prefixData, setPrefixData] = useState<PrefixListData | null>(null)
  const [prefixLoading, setPrefixLoading] = useState(false)
  const [prefixError, setPrefixError] = useState<string | null>(null)

  const [peerData, setPeerData] = useState<PeerListData | null>(null)
  const [peerLoading, setPeerLoading] = useState(false)
  const [peerError, setPeerError] = useState<string | null>(null)

  const [upstreamData, setUpstreamData] = useState<UpstreamListData | null>(null)
  const [upstreamLoading, setUpstreamLoading] = useState(false)
  const [upstreamError, setUpstreamError] = useState<string | null>(null)

  const [downstreamData, setDownstreamData] = useState<DownstreamListData | null>(null)
  const [downstreamLoading, setDownstreamLoading] = useState(false)
  const [downstreamError, setDownstreamError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setPeerData(null)
    setUpstreamData(null)
    setDownstreamData(null)
    setPeerError(null)
    setUpstreamError(null)
    setDownstreamError(null)
    setPeerLoading(true)
    setUpstreamLoading(true)
    setDownstreamLoading(true)

    bgpApi.lookupASNPeers(asn)
      .then(result => { if (active) setPeerData(result.data) })
      .catch((error: unknown) => { if (active) setPeerError(error instanceof Error ? error.message : 'Erreur réseau') })
      .finally(() => { if (active) setPeerLoading(false) })
    bgpApi.lookupASNUpstreams(asn)
      .then(result => { if (active) setUpstreamData(result.data) })
      .catch((error: unknown) => { if (active) setUpstreamError(error instanceof Error ? error.message : 'Erreur réseau') })
      .finally(() => { if (active) setUpstreamLoading(false) })
    bgpApi.lookupASNDownstreams(asn)
      .then(result => { if (active) setDownstreamData(result.data) })
      .catch((error: unknown) => { if (active) setDownstreamError(error instanceof Error ? error.message : 'Erreur réseau') })
      .finally(() => { if (active) setDownstreamLoading(false) })

    return () => { active = false }
  }, [asn])

  const handleTabClick = useCallback(
    (tab: ASNTab) => {
      setActiveTab(tab)
      if ((tab === 'ipv4' || tab === 'ipv6') && !prefixData && !prefixLoading) {
        setPrefixLoading(true)
        setPrefixError(null)
        bgpApi.lookupASNPrefixes(asn)
          .then((r) => setPrefixData(r.data))
          .catch((e: unknown) => setPrefixError(e instanceof Error ? e.message : 'Erreur réseau'))
          .finally(() => setPrefixLoading(false))
      }
      if (tab === 'peers' && !peerData && !peerLoading) {
        setPeerLoading(true)
        setPeerError(null)
        bgpApi.lookupASNPeers(asn)
          .then((r) => setPeerData(r.data))
          .catch((e: unknown) => setPeerError(e instanceof Error ? e.message : 'Erreur réseau'))
          .finally(() => setPeerLoading(false))
      }
      if (tab === 'upstreams' && !upstreamData && !upstreamLoading) {
        setUpstreamLoading(true)
        setUpstreamError(null)
        bgpApi.lookupASNUpstreams(asn)
          .then((r) => setUpstreamData(r.data))
          .catch((e: unknown) => setUpstreamError(e instanceof Error ? e.message : 'Erreur réseau'))
          .finally(() => setUpstreamLoading(false))
      }
      if (tab === 'downstreams' && !downstreamData && !downstreamLoading) {
        setDownstreamLoading(true)
        setDownstreamError(null)
        bgpApi.lookupASNDownstreams(asn)
          .then((r) => setDownstreamData(r.data))
          .catch((e: unknown) => setDownstreamError(e instanceof Error ? e.message : 'Erreur réseau'))
          .finally(() => setDownstreamLoading(false))
      }
    },
    [asn, prefixData, prefixLoading, peerData, peerLoading, upstreamData, upstreamLoading, downstreamData, downstreamLoading],
  )

  const handleSnapshot = async () => {
    setSnapping(true)
    try {
      const result = await bgpApi.takeSnapshot(asn)
      const alertCount = result.alerts?.length ?? 0
      if (alertCount > 0) {
        toast.warning(`Snapshot pris — ${alertCount} changement(s) détecté(s) !`)
      } else {
        toast.success('Snapshot pris avec succès')
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur snapshot')
    } finally {
      setSnapping(false)
    }
  }

  /**
   * Export d'un préfixe BGP (onglets IPv4 / IPv6) vers l'IOC Manager.
   * - Envoie l'ASN courant pour que le backend génère la source "BGP Lookup — AS<N>".
   * - N'envoie jamais le numéro ASN comme valeur CIDR.
   */
  const handleExportIOC = async (prefix: string) => {
    try {
      await bgpApi.exportIOC({ type: 'cidr', value: prefix, asn })
      toast.success(`IOC créé : ${prefix}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur export IOC')
    }
  }

  const tabs: { id: ASNTab; label: string; icon: React.ReactNode }[] = [
    { id: 'info', label: 'Infos', icon: <Server size={12} /> },
    { id: 'ipv4', label: 'Préfixes IPv4', icon: <Globe size={12} /> },
    { id: 'ipv6', label: 'Préfixes IPv6', icon: <Globe size={12} /> },
    { id: 'peers', label: 'Peers', icon: <Users size={12} /> },
    { id: 'upstreams', label: 'Upstreams', icon: <ArrowUpCircle size={12} /> },
    { id: 'downstreams', label: 'Downstreams', icon: <ArrowDownCircle size={12} /> },
  ]

  const renderPrefixTable = (prefixes: (IPv4Prefix | IPv6Prefix)[]) => (
    <PagedTable
      items={prefixes}
      headers={['Préfixe', 'Nom', 'Pays', 'Actions']}
      renderRow={(p, i) => (
        <tr key={i} className="border-b border-[#1e2d40] hover:bg-[#0d131f] transition-colors">
          <td className="py-2 px-3 text-[#00d4ff]">{p.prefix}</td>
          <td className="py-2 px-3 text-[#8a9ab0]">{p.name || '—'}</td>
          <td className="py-2 px-3 text-[#4a6480]">
            {p.country_code ? `${countryFlag(p.country_code)} ${p.country_code}` : '—'}
          </td>
          <td>
            <div className="bgp-row-actions">
              <button
                type="button"
                onClick={() => copyToClipboard(p.prefix)}
                className="bgp-icon-button"
                title="Copier"
                aria-label={`Copier le préfixe ${p.prefix}`}
              >
                <Copy size={12} />
              </button>
              <button
                type="button"
                onClick={() => handleExportIOC(p.prefix)}
                className="bgp-icon-button"
                title="Exporter en IOC"
                aria-label={`Exporter ${p.prefix} en IOC`}
              >
                <ShieldBan size={12} />
                <span className="hidden sm:inline">IOC</span>
              </button>
            </div>
          </td>
        </tr>
      )}
    />
  )

  const renderASNTable = (peers: (BGPPeer | BGPUpstream | BGPDownstream)[]) => (
    <PagedTable
      items={peers}
      headers={['ASN', 'Nom', 'Pays', 'Actions']}
      renderRow={(p, i) => (
        <tr key={i} className="border-b border-[#1e2d40] hover:bg-[#0d131f] transition-colors">
          <td className="py-2 px-3 text-[#00d4ff]">AS{p.asn}</td>
          <td className="py-2 px-3 text-[#8a9ab0]">{p.name || '—'}</td>
          <td className="py-2 px-3 text-[#4a6480]">
            {p.country_code ? `${countryFlag(p.country_code)} ${p.country_code}` : '—'}
          </td>
          <td>
            <div className="bgp-row-actions">
              <button
                type="button"
                onClick={() => copyToClipboard(String(p.asn))}
                className="bgp-icon-button"
                title="Copier ASN"
                aria-label={`Copier l'ASN ${p.asn}`}
              >
                <Copy size={12} />
              </button>
              <button
                type="button"
                onClick={() => onNavigatePeer(p.asn)}
                className="bgp-icon-button"
                title="Rechercher ce AS"
                aria-label={`Ouvrir l'ASN ${p.asn}`}
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </td>
        </tr>
      )}
    />
  )

  const renderRelationNodes = (items: (BGPPeer | BGPUpstream | BGPDownstream)[] | undefined, loading: boolean, error: string | null) => {
    if (loading) return <span className="bgp-relation-state">Chargement…</span>
    if (error) return <span className="bgp-relation-state" role="status">Relation indisponible</span>
    if (!items?.length) return <span className="bgp-relation-state">Aucune relation retournée</span>
    return (
      <div className="bgp-relation-nodes">
        {items.slice(0, 4).map(item => (
          <button type="button" key={item.asn} className="bgp-relation-node" onClick={() => onNavigatePeer(item.asn)} aria-label={`Ouvrir AS${item.asn} ${item.name}`}>
            <strong>AS{item.asn}</strong>
            <span>{item.name || 'Nom non renseigné'}</span>
            {item.country_code && <small>{item.country_code}</small>}
          </button>
        ))}
        {items.length > 4 && <span className="bgp-relation-overflow">+{items.length - 4} dans la liste</span>}
      </div>
    )
  }

  return (
    <div className="bgp-asn-workstation">
      <nav className="bgp-asn-tabs" aria-label="Informations BGP de l'ASN">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            aria-pressed={activeTab === tab.id}
            className="bgp-asn-tab"
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="bgp-asn-workspace">
      {activeTab === 'info' && (
        <div className="bgp-atlas-overview">
          <div className="bgp-atlas-facts">
            <div className="bgp-atlas-overview-heading">
              <div>
                <span className="bgp-kicker">Fiche opérateur</span>
                <h3>Identité & provenance</h3>
              </div>
              <span className="bgp-asn-rir">{info.rir_allocation?.rir_name || 'RIR non renseigné'}</span>
            </div>
            <dl className="bgp-asn-facts">
              {[
                { label: 'ASN', value: `AS${info.asn}` },
                { label: 'Organisation', value: info.name || 'Nom non renseigné' },
                { label: 'Description', value: info.description_short || 'Aucune description retournée' },
                { label: 'Pays', value: info.country_code ? `${countryFlag(info.country_code)} ${info.country_code}` : 'Non renseigné' },
                { label: 'Site web', value: info.website || 'Non renseigné' },
                { label: 'Registre', value: info.rir_allocation?.rir_name || 'Non renseigné' },
              ].map(({ label, value }) => (
                <div key={label} className="bgp-fact">
                  <dt>{label}</dt>
                  <dd title={String(value)}>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="bgp-action-row">
            <button
              type="button"
              onClick={handleSnapshot}
              disabled={snapping}
              className="flex items-center gap-2 px-4 py-2 bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/20 text-[10px] font-bold tracking-widest uppercase transition-colors disabled:opacity-50"
            >
              {snapping ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
              Prendre un snapshot
            </button>
            <button
              type="button"
              onClick={() => navigate('/bgp/historian')}
              className="flex items-center gap-2 px-4 py-2 bg-[#1e2d40] hover:bg-[#2a3f55] text-[#8a9ab0] border border-[#2a3f55] text-[10px] font-bold tracking-widest uppercase transition-colors"
            >
              <History size={12} />
              Voir l'historique
            </button>
            {lastSnapshotDate && (
            <span className="bgp-last-snapshot">
                Dernier snapshot :{' '}
                {new Date(lastSnapshotDate).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </span>
            )}
          </div>

            <p className="bgp-atlas-provenance">Provenance affichée depuis les champs de la réponse ASN. Les relations ci-contre proviennent des réponses peers, upstreams et downstreams.</p>
          </div>

          <section className="bgp-network-atlas" aria-labelledby="bgp-network-atlas-title">
            <div className="bgp-network-atlas-heading">
              <div>
                <span className="bgp-kicker">Voisinage retourné par l’API</span>
                <h3 id="bgp-network-atlas-title">Relations BGP observées</h3>
              </div>
              <span className="bgp-network-atlas-note">Chaque lien relie l’ASN étudié à une relation déclarée.</span>
            </div>
            <div className="bgp-network-axis">
              <div className="bgp-relation-lane" data-direction="upstream" data-has-relations={Boolean(upstreamData?.ipv4_upstreams.length || upstreamData?.ipv6_upstreams.length)}>
                <div className="bgp-relation-lane-label"><span>AMONT</span><ArrowUpCircle size={14} aria-hidden="true" /></div>
                {renderRelationNodes(upstreamData?.ipv4_upstreams.concat(upstreamData.ipv6_upstreams), upstreamLoading, upstreamError)}
              </div>
              <div className="bgp-network-root">
                <span>ASN ÉTUDIÉ</span>
                <strong>AS{asn}</strong>
                <small>{info.name || 'Nom non renseigné'}</small>
              </div>
              <div className="bgp-relation-lane" data-direction="downstream" data-has-relations={Boolean(downstreamData?.ipv4_downstreams.length || downstreamData?.ipv6_downstreams.length)}>
                <div className="bgp-relation-lane-label"><span>AVAL</span><ArrowDownCircle size={14} aria-hidden="true" /></div>
                {renderRelationNodes(downstreamData?.ipv4_downstreams.concat(downstreamData.ipv6_downstreams), downstreamLoading, downstreamError)}
              </div>
            </div>
            <div className="bgp-peer-band">
              <div className="bgp-relation-lane-label"><span>PEERING</span><Users size={14} aria-hidden="true" /></div>
              {renderRelationNodes(peerData?.ipv4_peers.concat(peerData.ipv6_peers), peerLoading, peerError)}
            </div>
          </section>

          {info.abuse_contacts?.length > 0 && (
            <div className="bg-[#0a0f16] border border-[#1e2d40] p-3">
              <div className="text-[9px] font-bold text-[#4a6480] mb-2 uppercase tracking-widest">Contacts abus</div>
              <div className="flex flex-wrap gap-2">
                {info.abuse_contacts.map((c) => (
                  <span key={c} className="text-[10px] font-mono bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20 px-2 py-0.5">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'ipv4' && (
        <>
          {prefixLoading && <Spinner />}
          {prefixError && <ErrorMessage message={prefixError} />}
          {!prefixLoading && !prefixError && prefixData && (
            <>
              <div className="text-[10px] font-mono text-[#4a6480] mb-3 uppercase tracking-widest">
                {prefixData.ipv4_prefixes.length} préfixe(s) IPv4
              </div>
              {prefixData.ipv4_prefixes.length === 0 ? <EmptyState /> : renderPrefixTable(prefixData.ipv4_prefixes)}
            </>
          )}
        </>
      )}

      {activeTab === 'ipv6' && (
        <>
          {prefixLoading && <Spinner />}
          {prefixError && <ErrorMessage message={prefixError} />}
          {!prefixLoading && !prefixError && prefixData && (
            <>
              <div className="text-[10px] font-mono text-[#4a6480] mb-3 uppercase tracking-widest">
                {prefixData.ipv6_prefixes.length} préfixe(s) IPv6
              </div>
              {prefixData.ipv6_prefixes.length === 0 ? <EmptyState /> : renderPrefixTable(prefixData.ipv6_prefixes)}
            </>
          )}
        </>
      )}

      {activeTab === 'peers' && (
        <>
          {peerLoading && <Spinner />}
          {peerError && <ErrorMessage message={peerError} />}
          {!peerLoading && !peerError && peerData && (
            <>
              <div className="text-[10px] font-mono text-[#4a6480] mb-3 uppercase tracking-widest">
                {peerData.ipv4_peers.length + peerData.ipv6_peers.length} peer(s)
              </div>
              {peerData.ipv4_peers.length + peerData.ipv6_peers.length === 0 ? (
                <EmptyState />
              ) : (
                renderASNTable([...peerData.ipv4_peers, ...peerData.ipv6_peers])
              )}
            </>
          )}
        </>
      )}

      {activeTab === 'upstreams' && (
        <>
          {upstreamLoading && <Spinner />}
          {upstreamError && <ErrorMessage message={upstreamError} />}
          {!upstreamLoading && !upstreamError && upstreamData && (
            <>
              <div className="text-[10px] font-mono text-[#4a6480] mb-3 uppercase tracking-widest">
                {upstreamData.ipv4_upstreams.length + upstreamData.ipv6_upstreams.length} upstream(s)
              </div>
              {upstreamData.ipv4_upstreams.length + upstreamData.ipv6_upstreams.length === 0 ? (
                <EmptyState />
              ) : (
                renderASNTable([...upstreamData.ipv4_upstreams, ...upstreamData.ipv6_upstreams])
              )}
            </>
          )}
        </>
      )}

      {activeTab === 'downstreams' && (
        <>
          {downstreamLoading && <Spinner />}
          {downstreamError && <ErrorMessage message={downstreamError} />}
          {!downstreamLoading && !downstreamError && downstreamData && (
            <>
              <div className="text-[10px] font-mono text-[#4a6480] mb-3 uppercase tracking-widest">
                {downstreamData.ipv4_downstreams.length + downstreamData.ipv6_downstreams.length} downstream(s)
              </div>
              {downstreamData.ipv4_downstreams.length + downstreamData.ipv6_downstreams.length === 0 ? (
                <EmptyState />
              ) : (
                renderASNTable([...downstreamData.ipv4_downstreams, ...downstreamData.ipv6_downstreams])
              )}
            </>
          )}
        </>
      )}
      </div>
    </div>
  )
}

export default function BGPLookup() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<SearchMode>('asn')
  const [inputValue, setInputValue] = useState('')
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const asn = searchParams.get('asn')
    const prefill = searchParams.get('prefill')
    if (asn) {
      setInputValue(asn.replace(/^AS/i, ''))
      setMode('asn')
    } else if (prefill) {
      setInputValue(prefill)
      setMode(prefill.includes('/') ? 'search' : 'ip')
    }
  }, [searchParams])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [asnInfo, setAsnInfo] = useState<ASNInfo | null>(null)
  const [currentASN, setCurrentASN] = useState<number | null>(null)
  const [ipInfo, setIpInfo] = useState<IPInfo | null>(null)
  const [searchResults, setSearchResults] = useState<SearchASN[] | null>(null)
  const [bgpStatus, setBGPStatus] = useState<BGPStatusResponse | null>(null)
  const [lastSnapshotDate] = useState<string | null>(null)

  const handleSearch = useCallback(async () => {
    const val = inputValue.trim()
    if (!val) return
    setLoading(true)
    setError(null)
    setAsnInfo(null)
    setIpInfo(null)
    setSearchResults(null)
    try {
      if (mode === 'asn') {
        const asn = stripASN(val)
        if (isNaN(asn) || asn <= 0) {
          setError('ASN invalide. Entrez un numéro (ex: 13335 ou AS13335)')
          return
        }
        const res = await bgpApi.lookupASN(asn)
        setAsnInfo(res.data)
        setCurrentASN(asn)
      } else if (mode === 'ip') {
        const res = await bgpApi.lookupIP(val)
        if (res.status !== 'ok') throw new Error(res.status_message || 'Erreur BGPView')
        if (!res.data || !res.data.ip) throw new Error('Aucune donnée IP disponible')
        setIpInfo(res)
      } else {
        const res = await bgpApi.search(val)
        setSearchResults(res.data.asns)
      }
    } catch (e: unknown) {
      setError(parseAPIError(e))
    } finally {
      setLoading(false)
    }
  }, [mode, inputValue])

  useEffect(() => {
    bgpApi.getStatus().then(setBGPStatus).catch(() => setBGPStatus(null))
  }, [])

  const navigateToASN = useCallback((asn: number) => {
    setMode('asn')
    setInputValue(String(asn))
    setLoading(true)
    setError(null)
    setAsnInfo(null)
    setIpInfo(null)
    setSearchResults(null)
    bgpApi.lookupASN(asn)
      .then((r) => { setAsnInfo(r.data); setCurrentASN(asn) })
      .catch((e: unknown) => setError(parseAPIError(e)))
      .finally(() => setLoading(false))
  }, [])

  /**
   * Export d'un préfixe depuis le mode IP Lookup vers l'IOC Manager.
   * - Envoie l'ASN d'origine du préfixe ET une source explicite "IP Lookup — AS<N>"
   *   pour distinguer ce cas du lookup ASN direct côté backend.
   */
  const handleExportIPPrefix = async (prefix: string, asn: number) => {
    try {
      await bgpApi.exportIOC({
        type: 'cidr',
        value: prefix,
        asn,
        source: `IP Lookup — AS${asn}`,
      })
      toast.success(`IOC créé : ${prefix}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur export IOC')
    }
  }

  return (
    <div className="bgp-console bgp-lookup">
      <header className="bgp-page-head">
        <ModuleHero breadcrumb="NETWORK / ROUTING INTELLIGENCE" title="BGP" accent="LOOKUP"
          subtitle="Network Atlas — Explorer les systèmes autonomes et leurs annonces."
          typeOnce="bgp-lookup"
          index={{ label: 'NETWORK ATLAS', lines: ['ASN · PRÉFIXES', 'PEERS · ROUTES'] }} />
        <div className="bgp-module-actions">
          <button
            type="button"
            onClick={() => navigate('/bgp/historian')}
            className="bgp-button"
          >
            <History size={14} aria-hidden="true" /> BGP Historian
          </button>
        </div>
      </header>

      <div className="bgp-content">
        {bgpStatus && !bgpStatus.available && (
          <div className="bgp-notice" role="status">
            <strong>Source BGP indisponible</strong>
            <div className="text-[#8a9ab0]">
              {bgpStatus.cache_available ? 'Affichage de la dernière version mise en cache.' : 'Aucune version mise en cache disponible.'}
            </div>
            <div className="opacity-70 mt-0.5">{bgpStatus.message}</div>
          </div>
        )}

        <form className="bgp-search-station bgp-atlas-search" onSubmit={(event) => { event.preventDefault(); void handleSearch() }}>
          <div className="bgp-search-rail">
            <div className="bgp-kicker"><span>NETWORK ATLAS</span></div>
            <div className="bgp-mode-strip" role="group" aria-label="Mode de recherche">
              {(['asn', 'ip', 'search'] as SearchMode[]).map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => { setMode(m); setError(null) }}
                  aria-pressed={mode === m}
                  className="bgp-mode-button"
                >
                  {m === 'asn' ? 'ASN' : m === 'ip' ? 'IP' : 'Recherche'}
                </button>
              ))}
            </div>
            <span className="bgp-key-hint"><kbd>↵</kbd> Explorer</span>
          </div>

          <div className="bgp-command-field">
            <label htmlFor="bgp-query">{mode === 'asn' ? 'Système autonome' : mode === 'ip' ? 'Adresse IP' : 'Organisation, ASN ou préfixe'}</label>
            <div className="bgp-command-input-row">
              <Search size={19} aria-hidden="true" />
              <input
                id="bgp-query"
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={mode === 'asn' ? '13335 ou AS13335' : mode === 'ip' ? '1.1.1.1' : 'Cloudflare, AS13335, préfixe…'}
                className="bgp-query-input"
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" disabled={loading || !inputValue.trim()} className="bgp-search-submit">
                {loading ? <Loader2 size={17} aria-hidden="true" /> : <Activity size={17} aria-hidden="true" />}
                <span>{loading ? 'Analyse…' : 'Explorer'}</span>
                <kbd>↵</kbd>
              </button>
            </div>
            <p className="bgp-query-help">La recherche interroge les sources configurées. Les résultats précédents sont remplacés après réponse.</p>
          </div>
        </form>

        {error && <ErrorMessage message={error} />}

        <div className="bgp-workspace">
          <section className="bgp-panel bgp-results-panel" aria-labelledby="bgp-results-heading">
            <div className="bgp-panel-heading bgp-results-heading">
              <div>
                <div className="bgp-kicker"><span>02</span> / Surface d’exploration</div>
                <h2 id="bgp-results-heading">{asnInfo ? 'Identité réseau' : ipInfo ? 'Origine de l’adresse' : searchResults ? 'Systèmes correspondants' : 'Données de routage'}</h2>
              </div>
              <div className="bgp-provenance" aria-label="Provenance des données BGP">
                <span className="bgp-provenance-mark" data-state={bgpStatus ? (bgpStatus.available ? 'available' : 'unavailable') : 'unknown'} aria-hidden="true" />
                <span className="bgp-provenance-source">{bgpStatus?.primary || 'Source non renseignée'}</span>
                <span className="bgp-provenance-state">{bgpStatus ? (bgpStatus.available ? 'Disponible' : 'Indisponible') : 'État inconnu'}</span>
                {bgpStatus?.cache_available && <span className="bgp-provenance-cache">Cache · {Math.max(0, Math.floor(bgpStatus.cache_age_seconds / 60))} min</span>}
              </div>
            </div>

            {loading && <Spinner />}

            {!loading && !error && !asnInfo && !ipInfo && !searchResults && (
              <div className="bgp-observatory-empty">
                <div className="bgp-observatory-empty-copy">
                  <span className="bgp-kicker">En attente d’une requête</span>
                  <h3>Suivre une annonce<br />jusqu’à son origine.</h3>
                  <p>Commencez par un ASN, une adresse IP ou une organisation. Les relations affichées proviendront des données retournées par l’API.</p>
                  <div className="bgp-query-examples" aria-label="Exemples de recherche">
                    <button type="button" onClick={() => { setMode('asn'); setInputValue('13335') }}>ASN <strong>AS13335</strong></button>
                    <button type="button" onClick={() => { setMode('ip'); setInputValue('1.1.1.1') }}>IP <strong>1.1.1.1</strong></button>
                    <button type="button" onClick={() => { setMode('search'); setInputValue('Cloudflare') }}>Organisation <strong>Cloudflare</strong></button>
                  </div>
                </div>
                <div className="bgp-observatory-empty-figure">
                  <BGPRouteMotif />
                  <span>Schéma conceptuel · aucun état réseau représenté</span>
                </div>
              </div>
            )}

            {!loading && !error && asnInfo && currentASN !== null && (
              <div className="bgp-panel-body bgp-result-body">
                <div className="bgp-asn-summary">
                  <div className="bgp-asn-number">AS{currentASN}</div>
                  <div className="bgp-asn-copy">
                    <strong>{asnInfo.name || 'Nom non renseigné'}</strong>
                    <span>{asnInfo.description_short}</span>
                  </div>
                  {asnInfo.country_code && (
                    <span className="bgp-asn-country" aria-label={`Pays ${asnInfo.country_code}`}>{countryFlag(asnInfo.country_code)}</span>
                  )}
                  <span className="bgp-asn-country-code">{asnInfo.country_code || 'Pays inconnu'}</span>
                </div>
                <ASNTabs
                  asn={currentASN}
                  info={asnInfo}
                  onNavigatePeer={navigateToASN}
                  lastSnapshotDate={lastSnapshotDate}
                />
              </div>
            )}

            {!loading && !error && ipInfo && ipInfo.data && (
              <div className="bgp-panel-body space-y-3">
                <div className="flex items-center gap-3 pb-3 border-b border-[#1e2d40]">
                  <Network size={18} className="text-[#00d4ff]" />
                  <div className="text-lg font-bold font-mono text-[#00d4ff]">{ipInfo.data.ip}</div>
                </div>
                <dl className="bgp-asn-facts">
                  {[
                    { label: 'PTR', value: ipInfo.data.ptr_record || '—' },
                    { label: 'RIR', value: ipInfo.data.rir_allocation?.rir_name || '—' },
                    { label: 'Allocation', value: ipInfo.data.rir_allocation?.prefix || '—' },
                    { label: 'Country', value: ipInfo.data.rir_allocation?.country_code || '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="bgp-fact">
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>

                <div>
                  <div className="text-[10px] font-bold text-[#4a6480] uppercase tracking-widest mb-2">Préfixes associés</div>
                  {ipInfo.data.prefixes && ipInfo.data.prefixes.length > 0 ? (
                    <div className="bgp-search-results">
                      {ipInfo.data.prefixes.map((p, i) => (
                        <div key={i} className="flex items-center justify-between bg-[#0d131f] border border-[#1e2d40] px-3 py-2">
                          <div>
                            <span className="font-mono text-xs text-[#00d4ff]">{p.prefix}</span>
                            {p.asn && p.asn.asn !== 0 && (
                              <span className="ml-3 text-[10px] text-[#4a6480]">
                                AS{p.asn.asn} — {p.asn.name}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => copyToClipboard(p.prefix)} className="p-1 hover:bg-[#1e2d40] text-[#4a6480] hover:text-[#00d4ff] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]" aria-label="Copier">
                              <Copy size={12} />
                            </button>
                            {p.asn && p.asn.asn !== 0 && (
                              <>
                                <button onClick={() => handleExportIPPrefix(p.prefix, p.asn!.asn)} className="p-1 hover:bg-[#1e2d40] text-[#4a6480] hover:text-[#ef4444] transition-colors">
                                  <ShieldBan size={12} />
                                </button>
                                <button onClick={() => navigateToASN(p.asn!.asn)} className="p-1 hover:bg-[#1e2d40] text-[#4a6480] hover:text-[#00d4ff] transition-colors">
                                  <ChevronRight size={12} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] font-mono text-[#4a6480] bg-[#0d131f] border border-[#1e2d40] p-3">
                      Aucun préfixe retourné par RIPE pour cette IP
                    </div>
                  )}
                </div>
              </div>
            )}

            {!loading && !error && searchResults && (
              <div className="bgp-panel-body">
                <div className="bgp-tab-count">
                  {searchResults.length} résultat(s)
                </div>
                {searchResults.length === 0 ? (
                  <EmptyState label="Aucun ASN trouvé" />
                ) : (
                    <div className="bgp-search-results">
                    {searchResults.map((a) => (
                      <button
                        type="button"
                        key={a.asn}
                        className="bgp-search-result"
                        onClick={() => navigateToASN(a.asn)}
                      >
                        <div className="bgp-search-result__identity">
                          <strong>AS{a.asn}</strong>
                          <span>{a.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-[#4a6480]">
                          {a.country_code && (
                            <span>{countryFlag(a.country_code)} {a.country_code}</span>
                          )}
                          <ChevronRight size={12} className="text-[#4a6480]" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  )
}
