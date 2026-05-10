import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Network, Search, Camera, Copy, ShieldBan,
  ChevronRight, Globe, Server, ArrowUpCircle,
  ArrowDownCircle, Users, Loader2, AlertCircle, History,
  Activity, Database, ShieldCheck,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { bgpApi } from '@/api/client'
import { toast } from '@/store/toast'
import type {
  ASNInfo, IPv4Prefix, IPv6Prefix, BGPPeer, BGPUpstream, BGPDownstream,
  IPInfo, SearchASN, PrefixListData, PeerListData,
  UpstreamListData, DownstreamListData, BGPStatusResponse,
} from '@/types/bgp'

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
    <div className="flex items-center justify-center py-12">
      <Loader2 size={28} className="animate-spin text-[#00d4ff]" />
    </div>
  )
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 p-4 rounded bg-[#ef4444]/5 border-l-2 border-[#ef4444] text-[#ef4444] font-mono text-xs">
      <AlertCircle size={16} />
      <span>{message}</span>
    </div>
  )
}

function EmptyState({ label = 'Aucune donnée' }: { label?: string }) {
  return (
    <div className="text-center py-10 font-mono text-xs text-[#4a6480]">
      {label.toUpperCase()}
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
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-[#1e2d40]">
              {headers.map((h) => (
                <th key={h} className="text-left py-2 px-3 text-[#4a6480] font-bold tracking-widest uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="text-center py-8 text-[#4a6480]">
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
        <div className="flex items-center justify-center gap-2 mt-4 text-xs font-mono">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 bg-[#1e2d40] text-[#8a9ab0] disabled:opacity-40 hover:bg-[#2a3f55] transition-colors border border-[#2a3f55]"
          >
            ←
          </button>
          <span className="text-[#4a6480]">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 bg-[#1e2d40] text-[#8a9ab0] disabled:opacity-40 hover:bg-[#2a3f55] transition-colors border border-[#2a3f55]"
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
          <td className="py-2 px-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => copyToClipboard(p.prefix)}
                className="p-1 hover:bg-[#1e2d40] text-[#4a6480] hover:text-[#00d4ff] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]"
                title="Copier"
                aria-label="Copier"
              >
                <Copy size={12} />
              </button>
              <button
                onClick={() => handleExportIOC(p.prefix)}
                className="p-1 hover:bg-[#1e2d40] text-[#4a6480] hover:text-[#ef4444] transition-colors flex items-center gap-1"
                title="Exporter en IOC"
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
          <td className="py-2 px-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => copyToClipboard(String(p.asn))}
                className="p-1 hover:bg-[#1e2d40] text-[#4a6480] hover:text-[#00d4ff] transition-colors"
                title="Copier ASN"
              >
                <Copy size={12} />
              </button>
              <button
                onClick={() => onNavigatePeer(p.asn)}
                className="p-1 hover:bg-[#1e2d40] text-[#4a6480] hover:text-[#00d4ff] transition-colors"
                title="Rechercher ce AS"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </td>
        </tr>
      )}
    />
  )

  return (
    <div>
      <div className="flex items-center gap-0 border-b border-[#1e2d40] mb-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold whitespace-nowrap border-b-2 tracking-widest uppercase transition-colors ${
              activeTab === tab.id
                ? 'border-[#00d4ff] text-[#00d4ff] bg-[#00d4ff]/5'
                : 'border-transparent text-[#4a6480] hover:text-[#8a9ab0]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'info' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleSnapshot}
              disabled={snapping}
              className="flex items-center gap-2 px-4 py-2 bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/20 text-[10px] font-bold tracking-widest uppercase transition-colors disabled:opacity-50"
            >
              {snapping ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
              Prendre un snapshot
            </button>
            <button
              onClick={() => navigate('/bgp/historian')}
              className="flex items-center gap-2 px-4 py-2 bg-[#1e2d40] hover:bg-[#2a3f55] text-[#8a9ab0] border border-[#2a3f55] text-[10px] font-bold tracking-widest uppercase transition-colors"
            >
              <History size={12} />
              Voir l'historique
            </button>
            {lastSnapshotDate && (
              <span className="text-[10px] font-mono text-[#4a6480]">
                LAST_SNAP:{' '}
                {new Date(lastSnapshotDate).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {[
              { label: 'ASN', value: `AS${info.asn}` },
              { label: 'Nom', value: info.name },
              { label: 'Description', value: info.description_short },
              { label: 'Pays', value: info.country_code ? `${countryFlag(info.country_code)} ${info.country_code}` : '—' },
              { label: 'Site web', value: info.website || '—' },
              { label: 'RIR', value: info.rir_allocation?.rir_name || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#0a0f16] border border-[#1e2d40] p-3">
                <div className="text-[9px] font-bold text-[#4a6480] mb-1 uppercase tracking-widest">{label}</div>
                <div className="text-xs font-mono text-[#f1f5f9] truncate" title={value}>{value}</div>
              </div>
            ))}
          </div>

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
  )
}

export default function BGPLookup() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<SearchMode>('asn')
  const [inputValue, setInputValue] = useState('')
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const prefill = searchParams.get('prefill')
    if (prefill) {
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
    <div className="flex flex-col h-full bg-[#06080f] text-[#f1f5f9]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d40] bg-[#0a0f16]/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Globe className="text-[#00d4ff]" size={20} />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#10b981] rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase">BGP Signal Acquisition</h1>
            <p className="text-[10px] text-[#64748b] font-mono">GLOBAL ROUTING TABLE // REAL-TIME INTERROGATION</p>
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px]">
          {bgpStatus && (
            <div className="flex flex-col items-end">
              <span className="text-[#64748b]">UPSTREAM</span>
              <span className={bgpStatus.available ? 'text-[#10b981]' : 'text-[#ef4444]'}>
                {bgpStatus.available ? 'CONNECTED' : 'DEGRADED'}
              </span>
            </div>
          )}
          <button
            onClick={() => navigate('/bgp/historian')}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2d40] hover:bg-[#2a3f55] text-[10px] font-bold border border-[#334155] transition-colors"
          >
            <History size={12} /> HISTORIAN
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {bgpStatus && !bgpStatus.available && (
          <div className="border-l-2 border-[#f59e0b] bg-[#f59e0b]/5 p-4 font-mono text-[11px] text-[#f59e0b]">
            <div className="font-bold mb-1">⚠ BGP DATA UNAVAILABLE</div>
            <div className="text-[#8a9ab0]">
              {bgpStatus.cache_available ? 'Affichage de la dernière version mise en cache.' : 'Aucune version mise en cache disponible.'}
            </div>
            <div className="opacity-70 mt-0.5">{bgpStatus.message}</div>
          </div>
        )}

        <div className="max-w-4xl mx-auto">
          <div className="flex gap-0 mb-0 border-b border-[#1e2d40]">
            {(['asn', 'ip', 'search'] as SearchMode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null) }}
                className={`px-4 py-2 text-[10px] font-bold tracking-widest uppercase border-b-2 transition-colors ${
                  mode === m
                    ? 'border-[#00d4ff] text-[#00d4ff] bg-[#00d4ff]/5'
                    : 'border-transparent text-[#4a6480] hover:text-[#8a9ab0]'
                }`}
              >
                {m === 'asn' ? 'ASN' : m === 'ip' ? 'IP' : 'Recherche'}
              </button>
            ))}
          </div>

          <div className="relative group mt-0">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#00d4ff]/20 to-transparent rounded-lg blur opacity-25 group-focus-within:opacity-100 transition duration-500" />
            <div className="relative flex items-center bg-[#0d131f] border border-[#1e2d40] overflow-hidden">
              <div className="pl-4 text-[#4a6480]"><Search size={18} /></div>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={
                  mode === 'asn' ? 'ENTER ASN... (ex: 13335 or AS13335)'
                  : mode === 'ip' ? 'ENTER IP ADDRESS... (ex: 8.8.8.8)'
                  : 'SEARCH KEYWORD... (ex: cloudflare)'
                }
                className="w-full bg-transparent border-none py-4 px-4 text-sm font-mono focus:ring-0 placeholder-[#334155] uppercase tracking-widest outline-none"
              />
              <button
                onClick={handleSearch}
                disabled={loading}
                className="bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 text-[#00d4ff] px-6 py-4 border-l border-[#1e2d40] text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
                EXECUTE_QUERY
              </button>
            </div>
          </div>
        </div>

        {error && <ErrorMessage message={error} />}

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8 bg-[#0a0f16] border border-[#1e2d40] overflow-hidden">
            <div className="bg-[#1e2d40]/30 px-4 py-2 border-b border-[#1e2d40] flex justify-between items-center">
              <span className="text-[10px] font-bold tracking-widest text-[#8a9ab0]">ROUTING_DETAILS</span>
              <Activity size={12} className="text-[#00d4ff]" />
            </div>

            {loading && <Spinner />}

            {!loading && !error && !asnInfo && !ipInfo && !searchResults && (
              <div className="p-12 text-center">
                <Database size={40} className="mx-auto text-[#1e2d40] mb-4" />
                <p className="text-xs font-mono text-[#4a6480]">AWAITING COMMAND INPUT...</p>
              </div>
            )}

            {!loading && !error && asnInfo && currentASN !== null && (
              <div className="p-4">
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#1e2d40]">
                  <div className="text-xl font-bold font-mono text-[#00d4ff]">AS{currentASN}</div>
                  <div>
                    <div className="text-sm font-bold text-[#f1f5f9]">{asnInfo.name}</div>
                    <div className="text-[10px] text-[#4a6480] font-mono">{asnInfo.description_short}</div>
                  </div>
                  {asnInfo.country_code && (
                    <span className="ml-auto text-lg">{countryFlag(asnInfo.country_code)}</span>
                  )}
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
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3 pb-3 border-b border-[#1e2d40]">
                  <Network size={18} className="text-[#00d4ff]" />
                  <div className="text-lg font-bold font-mono text-[#00d4ff]">{ipInfo.data.ip}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'PTR', value: ipInfo.data.ptr_record || '—' },
                    { label: 'RIR', value: ipInfo.data.rir_allocation?.rir_name || '—' },
                    { label: 'Allocation', value: ipInfo.data.rir_allocation?.prefix || '—' },
                    { label: 'Country', value: ipInfo.data.rir_allocation?.country_code || '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-[#0d131f] border border-[#1e2d40] p-3">
                      <div className="text-[9px] font-bold text-[#4a6480] uppercase tracking-widest mb-1">{label}</div>
                      <div className="text-xs font-mono text-[#f1f5f9] truncate">{value}</div>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="text-[10px] font-bold text-[#4a6480] uppercase tracking-widest mb-2">Préfixes associés</div>
                  {ipInfo.data.prefixes && ipInfo.data.prefixes.length > 0 ? (
                    <div className="space-y-2">
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
              <div className="p-4">
                <div className="text-[10px] font-mono text-[#4a6480] uppercase tracking-widest mb-3">
                  {searchResults.length} résultat(s)
                </div>
                {searchResults.length === 0 ? (
                  <EmptyState label="Aucun ASN trouvé" />
                ) : (
                  <div className="space-y-2">
                    {searchResults.map((a) => (
                      <div
                        key={a.asn}
                        className="flex items-center justify-between bg-[#0d131f] border border-[#1e2d40] hover:border-[#00d4ff]/30 px-3 py-2 cursor-pointer transition-colors"
                        onClick={() => navigateToASN(a.asn)}
                      >
                        <div>
                          <span className="font-mono text-xs text-[#00d4ff]">AS{a.asn}</span>
                          <span className="ml-3 text-xs text-[#8a9ab0]">{a.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-[#4a6480]">
                          {a.country_code && (
                            <span>{countryFlag(a.country_code)} {a.country_code}</span>
                          )}
                          <ChevronRight size={12} className="text-[#4a6480]" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="col-span-12 lg:col-span-4 space-y-4">
            <div className="bg-[#0a0f16] border border-[#1e2d40] p-4">
              <h3 className="text-[10px] font-bold text-[#64748b] mb-4 uppercase tracking-tighter flex items-center gap-2">
                <ShieldCheck size={14} className="text-[#10b981]" /> RPKI VALIDATION STATUS
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-[#8a9ab0]">VALID</span>
                  <span className="text-[#10b981]">98.2%</span>
                </div>
                <div className="w-full bg-[#1e2d40] h-1 overflow-hidden">
                  <div className="bg-[#10b981] h-full shadow-[0_0_8px_#10b981]" style={{ width: '98%' }} />
                </div>
              </div>
            </div>

            <div className="bg-[#0a0f16] border border-[#1e2d40] p-4">
              <h3 className="text-[10px] font-bold text-[#64748b] mb-4 uppercase tracking-tighter">TRANSIT_DIVERSITY</h3>
              <div className="flex flex-wrap gap-2">
                {['LEVEL3', 'COGENT', 'GTT', 'HE'].map(isp => (
                  <span key={isp} className="text-[9px] font-mono px-2 py-1 bg-[#1e2d40] text-[#8a9ab0] border border-[#2a3f55]">
                    {isp}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-[#0a0f16] border border-[#1e2d40] p-4 font-mono text-[10px] text-[#4a6480]">
              <p className="uppercase tracking-widest">Powered by BGPView</p>
              <p className="mt-1 text-[9px]">usage légal uniquement</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
