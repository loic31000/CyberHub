import { useState, useCallback, useEffect } from 'react'
import {
  Network, Search, Camera, Copy, ShieldBan,
  ChevronRight, Globe, Server, ArrowUpCircle,
  ArrowDownCircle, Users, Loader2, AlertCircle, History,
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

// ─────────────────────────────────────────────
// Types internes
// ─────────────────────────────────────────────
type SearchMode = 'asn' | 'ip' | 'search'
type ASNTab = 'info' | 'ipv4' | 'ipv6' | 'peers' | 'upstreams' | 'downstreams'

const PAGE_SIZE = 20

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// Composants génériques
// ─────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 size={28} className="animate-spin text-cyan-400" />
    </div>
  )
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 p-4 rounded-lg bg-red-900/20 border border-red-500/30 text-red-400">
      <AlertCircle size={18} />
      <span className="text-sm">{message}</span>
    </div>
  )
}

function EmptyState({ label = 'Aucune donnée' }: { label?: string }) {
  return (
    <div className="text-center py-10 text-gray-500 text-sm">{label}</div>
  )
}

// ─────────────────────────────────────────────
// Pagination locale (client-side, PAGE_SIZE items)
// ─────────────────────────────────────────────
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
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              {headers.map((h) => (
                <th key={h} className="text-left py-2 px-3 text-gray-400 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="text-center py-8 text-gray-500">
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
        <div className="flex items-center justify-center gap-2 mt-4 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 rounded bg-gray-700 text-gray-300 disabled:opacity-40 hover:bg-gray-600 transition-colors"
          >
            ←
          </button>
          <span className="text-gray-400">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 rounded bg-gray-700 text-gray-300 disabled:opacity-40 hover:bg-gray-600 transition-colors"
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Onglets ASN — lazy load
// ─────────────────────────────────────────────

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

  // Lazy data
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
        bgpApi
          .lookupASNPrefixes(asn)
          .then((r) => setPrefixData(r.data))
          .catch((e: unknown) =>
            setPrefixError(e instanceof Error ? e.message : 'Erreur réseau'),
          )
          .finally(() => setPrefixLoading(false))
      }
      if (tab === 'peers' && !peerData && !peerLoading) {
        setPeerLoading(true)
        setPeerError(null)
        bgpApi
          .lookupASNPeers(asn)
          .then((r) => setPeerData(r.data))
          .catch((e: unknown) =>
            setPeerError(e instanceof Error ? e.message : 'Erreur réseau'),
          )
          .finally(() => setPeerLoading(false))
      }
      if (tab === 'upstreams' && !upstreamData && !upstreamLoading) {
        setUpstreamLoading(true)
        setUpstreamError(null)
        bgpApi
          .lookupASNUpstreams(asn)
          .then((r) => setUpstreamData(r.data))
          .catch((e: unknown) =>
            setUpstreamError(e instanceof Error ? e.message : 'Erreur réseau'),
          )
          .finally(() => setUpstreamLoading(false))
      }
      if (tab === 'downstreams' && !downstreamData && !downstreamLoading) {
        setDownstreamLoading(true)
        setDownstreamError(null)
        bgpApi
          .lookupASNDownstreams(asn)
          .then((r) => setDownstreamData(r.data))
          .catch((e: unknown) =>
            setDownstreamError(e instanceof Error ? e.message : 'Erreur réseau'),
          )
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

  const handleExportIOC = async (prefix: string) => {
    try {
      await bgpApi.exportIOC({ type: 'cidr', value: prefix, source: `AS${asn}` })
      toast.success(`IOC créé : ${prefix}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur export IOC')
    }
  }

  const tabs: { id: ASNTab; label: string; icon: React.ReactNode }[] = [
    { id: 'info', label: 'Infos', icon: <Server size={14} /> },
    { id: 'ipv4', label: 'Préfixes IPv4', icon: <Globe size={14} /> },
    { id: 'ipv6', label: 'Préfixes IPv6', icon: <Globe size={14} /> },
    { id: 'peers', label: 'Peers', icon: <Users size={14} /> },
    { id: 'upstreams', label: 'Upstreams', icon: <ArrowUpCircle size={14} /> },
    { id: 'downstreams', label: 'Downstreams', icon: <ArrowDownCircle size={14} /> },
  ]

  const renderPrefixTable = (prefixes: (IPv4Prefix | IPv6Prefix)[]) => (
    <PagedTable
      items={prefixes}
      headers={['Préfixe', 'Nom', 'Pays', 'Actions']}
      renderRow={(p, i) => (
        <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50">
          <td className="py-2 px-3 font-mono text-cyan-300 text-xs">{p.prefix}</td>
          <td className="py-2 px-3 text-gray-300 text-xs">{p.name || '—'}</td>
          <td className="py-2 px-3 text-gray-400 text-xs">
            {p.country_code ? `${countryFlag(p.country_code)} ${p.country_code}` : '—'}
          </td>
          <td className="py-2 px-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => copyToClipboard(p.prefix)}
                className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-cyan-400 transition-colors"
                title="Copier"
              >
                <Copy size={12} />
              </button>
              <button
                onClick={() => handleExportIOC(p.prefix)}
                className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-red-400 transition-colors text-xs flex items-center gap-1"
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

  const renderASNTable = (
    peers: (BGPPeer | BGPUpstream | BGPDownstream)[],
  ) => (
    <PagedTable
      items={peers}
      headers={['ASN', 'Nom', 'Pays', 'Actions']}
      renderRow={(p, i) => (
        <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50">
          <td className="py-2 px-3 font-mono text-cyan-300 text-xs">AS{p.asn}</td>
          <td className="py-2 px-3 text-gray-300 text-xs">{p.name || '—'}</td>
          <td className="py-2 px-3 text-gray-400 text-xs">
            {p.country_code ? `${countryFlag(p.country_code)} ${p.country_code}` : '—'}
          </td>
          <td className="py-2 px-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => copyToClipboard(String(p.asn))}
                className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-cyan-400 transition-colors"
                title="Copier ASN"
              >
                <Copy size={12} />
              </button>
              <button
                onClick={() => onNavigatePeer(p.asn)}
                className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-cyan-400 transition-colors"
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
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-700 mb-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'info' && (
        <div className="space-y-4">
          {/* Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleSnapshot}
              disabled={snapping}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-colors text-sm disabled:opacity-50"
            >
              {snapping ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Camera size={14} />
              )}
              Prendre un snapshot
            </button>
            <button
              onClick={() => navigate('/bgp/historian')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors text-sm"
            >
              <History size={14} />
              Voir l'historique
            </button>
            {lastSnapshotDate && (
              <span className="text-xs text-gray-500">
                Dernier snapshot :{' '}
                {new Date(lastSnapshotDate).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            )}
          </div>

          {/* Infos principales */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {[
              { label: 'ASN', value: `AS${info.asn}` },
              { label: 'Nom', value: info.name },
              { label: 'Description', value: info.description_short },
              { label: 'Pays', value: info.country_code ? `${countryFlag(info.country_code)} ${info.country_code}` : '—' },
              { label: 'Site web', value: info.website || '—' },
              { label: 'RIR', value: info.rir_allocation?.rir_name || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">{label}</div>
                <div className="text-sm text-gray-200 font-medium truncate" title={value}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Contacts */}
          {info.abuse_contacts?.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-2">Contacts abus</div>
              <div className="flex flex-wrap gap-2">
                {info.abuse_contacts.map((c) => (
                  <span key={c} className="text-xs bg-red-900/30 text-red-300 px-2 py-0.5 rounded">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'ipv4' && (
        <div>
          {prefixLoading && <Spinner />}
          {prefixError && <ErrorMessage message={prefixError} />}
          {!prefixLoading && !prefixError && prefixData && (
            <>
              <div className="text-xs text-gray-500 mb-3">
                {prefixData.ipv4_prefixes.length} préfixe(s) IPv4
              </div>
              {prefixData.ipv4_prefixes.length === 0 ? (
                <EmptyState />
              ) : (
                renderPrefixTable(prefixData.ipv4_prefixes)
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'ipv6' && (
        <div>
          {prefixLoading && <Spinner />}
          {prefixError && <ErrorMessage message={prefixError} />}
          {!prefixLoading && !prefixError && prefixData && (
            <>
              <div className="text-xs text-gray-500 mb-3">
                {prefixData.ipv6_prefixes.length} préfixe(s) IPv6
              </div>
              {prefixData.ipv6_prefixes.length === 0 ? (
                <EmptyState />
              ) : (
                renderPrefixTable(prefixData.ipv6_prefixes)
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'peers' && (
        <div>
          {peerLoading && <Spinner />}
          {peerError && <ErrorMessage message={peerError} />}
          {!peerLoading && !peerError && peerData && (
            <>
              <div className="text-xs text-gray-500 mb-3">
                {peerData.ipv4_peers.length + peerData.ipv6_peers.length} peer(s)
              </div>
              {peerData.ipv4_peers.length + peerData.ipv6_peers.length === 0 ? (
                <EmptyState />
              ) : (
                renderASNTable([...peerData.ipv4_peers, ...peerData.ipv6_peers])
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'upstreams' && (
        <div>
          {upstreamLoading && <Spinner />}
          {upstreamError && <ErrorMessage message={upstreamError} />}
          {!upstreamLoading && !upstreamError && upstreamData && (
            <>
              <div className="text-xs text-gray-500 mb-3">
                {upstreamData.ipv4_upstreams.length + upstreamData.ipv6_upstreams.length} upstream(s)
              </div>
              {upstreamData.ipv4_upstreams.length + upstreamData.ipv6_upstreams.length === 0 ? (
                <EmptyState />
              ) : (
                renderASNTable([
                  ...upstreamData.ipv4_upstreams,
                  ...upstreamData.ipv6_upstreams,
                ])
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'downstreams' && (
        <div>
          {downstreamLoading && <Spinner />}
          {downstreamError && <ErrorMessage message={downstreamError} />}
          {!downstreamLoading && !downstreamError && downstreamData && (
            <>
              <div className="text-xs text-gray-500 mb-3">
                {downstreamData.ipv4_downstreams.length + downstreamData.ipv6_downstreams.length} downstream(s)
              </div>
              {downstreamData.ipv4_downstreams.length + downstreamData.ipv6_downstreams.length === 0 ? (
                <EmptyState />
              ) : (
                renderASNTable([
                  ...downstreamData.ipv4_downstreams,
                  ...downstreamData.ipv6_downstreams,
                ])
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Page principale BGPLookup
// ─────────────────────────────────────────────

export default function BGPLookup() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<SearchMode>('asn')
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Résultats
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
        if (res.status !== 'ok') {
          throw new Error(res.status_message || 'Erreur BGPView')
        }
        if (!res.data || !res.data.ip) {
          throw new Error('Aucune donnée IP disponible')
        }
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
    bgpApi.getStatus()
      .then(setBGPStatus)
      .catch(() => {
        setBGPStatus(null)
      })
  }, [])

  const navigateToASN = useCallback((asn: number) => {
    setMode('asn')
    setInputValue(String(asn))
    setLoading(true)
    setError(null)
    setAsnInfo(null)
    setIpInfo(null)
    setSearchResults(null)
    bgpApi
      .lookupASN(asn)
      .then((r) => {
        setAsnInfo(r.data)
        setCurrentASN(asn)
      })
      .catch((e: unknown) => setError(parseAPIError(e)))
      .finally(() => setLoading(false))
  }, [])

  const handleExportIPPrefix = async (prefix: string, asn: number) => {
    try {
      await bgpApi.exportIOC({ type: 'cidr', value: prefix, source: `IP lookup AS${asn}` })
      toast.success(`IOC créé : ${prefix}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur export IOC')
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-cyan-400/10">
          <Network size={22} className="text-cyan-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-100">BGP / AS Lookup</h1>
          <p className="text-xs text-gray-500">Powered by BGPView — usage légal uniquement</p>
        </div>
        <button
          onClick={() => navigate('/bgp/historian')}
          className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors text-sm"
        >
          <History size={14} />
          Historian
        </button>
      </div>

      {bgpStatus && !bgpStatus.available && (
        <div className="mb-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-200">
          <div className="font-semibold text-yellow-100">
            Les données BGP en direct ne sont pas disponibles actuellement.
          </div>
          <div className="mt-1 text-xs text-yellow-200">
            {bgpStatus.cache_available
              ? 'Affichage de la dernière version mise en cache.'
              : 'Aucune version mise en cache disponible, certaines requêtes BGP peuvent échouer.'}
          </div>
          <div className="mt-1 text-xs text-yellow-300 opacity-80">{bgpStatus.message}</div>
        </div>
      )}

      {/* Search bar */}
      <div className="bg-gray-800 rounded-xl p-4 mb-6 border border-gray-700">
        {/* Mode selector */}
        <div className="flex gap-2 mb-3">
          {(['asn', 'ip', 'search'] as SearchMode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m)
                setError(null)
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mode === m
                  ? 'bg-cyan-400/20 text-cyan-400 border border-cyan-400/40'
                  : 'bg-gray-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              {m === 'asn' ? 'ASN' : m === 'ip' ? 'IP' : 'Recherche'}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={
              mode === 'asn'
                ? 'Ex: 13335 ou AS13335'
                : mode === 'ip'
                ? 'Ex: 8.8.8.8'
                : 'Ex: cloudflare'
            }
            className="flex-1 px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-gray-200 text-sm focus:outline-none focus:border-cyan-500 placeholder-gray-600"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-cyan-500 text-gray-900 font-semibold text-sm hover:bg-cyan-400 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Go
          </button>
        </div>
      </div>

      {/* Results */}
      {error && <ErrorMessage message={error} />}

      {/* ASN mode */}
      {!loading && !error && asnInfo && currentASN !== null && (
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-2xl font-bold text-cyan-400">AS{currentASN}</div>
            <div>
              <div className="text-lg font-semibold text-gray-100">{asnInfo.name}</div>
              <div className="text-sm text-gray-400">{asnInfo.description_short}</div>
            </div>
            {asnInfo.country_code && (
              <div className="ml-auto text-2xl" title={asnInfo.country_code}>
                {countryFlag(asnInfo.country_code)}
              </div>
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

      {/* IP mode */}
      {!loading && !error && ipInfo && ipInfo.data && (
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <Globe size={18} className="text-cyan-400" />
            <h2 className="text-lg font-semibold text-gray-100">
              {ipInfo.data.ip ?? 'IP inconnue'}
            </h2>
            {ipInfo.data.ptr_record && (
              <span className="text-sm text-gray-400">→ {ipInfo.data.ptr_record}</span>
            )}
          </div>

          {ipInfo.data.prefixes.length === 0 ? (
            <EmptyState label="Aucun préfixe trouvé pour cette IP" />
          ) : (
            <div className="space-y-3">
              {ipInfo.data.prefixes.map((p, i) => (
                <div
                  key={i}
                  className="border border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="font-mono text-cyan-300 font-semibold">
                        {p.prefix}
                      </div>
                      <div className="text-sm text-gray-400 mt-1">{p.description}</div>
                      {p.country_code && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {countryFlag(p.country_code)} {p.country_code}
                        </div>
                      )}
                    </div>
                    {p.asn && (
                      <div className="text-right">
                        <div className="text-xs text-gray-500 mb-1">AS parent</div>
                        <button
                          onClick={() => navigateToASN(p.asn.asn)}
                          className="text-cyan-400 font-mono font-semibold hover:underline text-sm"
                        >
                          AS{p.asn.asn}
                        </button>
                        <div className="text-xs text-gray-400">{p.asn.name}</div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => copyToClipboard(p.prefix)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-gray-700 text-gray-400 hover:text-cyan-400 text-xs transition-colors"
                    >
                      <Copy size={11} /> Copier
                    </button>
                    <button
                      onClick={() => handleExportIPPrefix(p.prefix, p.asn?.asn ?? 0)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-gray-700 text-gray-400 hover:text-red-400 text-xs transition-colors"
                    >
                      <ShieldBan size={11} /> IOC
                    </button>
                    {p.asn && (
                      <button
                        onClick={() => navigateToASN(p.asn.asn)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-gray-700 text-gray-400 hover:text-cyan-400 text-xs transition-colors"
                      >
                        <ChevronRight size={11} /> Voir AS{p.asn.asn}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search mode */}
      {!loading && !error && searchResults !== null && (
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="text-sm text-gray-400 mb-3">
            {searchResults.length} résultat(s) trouvé(s)
          </div>
          {searchResults.length === 0 ? (
            <EmptyState label="Aucun AS trouvé" />
          ) : (
            <div className="divide-y divide-gray-700">
              {searchResults.map((asn) => (
                <button
                  key={asn.asn}
                  onClick={() => navigateToASN(asn.asn)}
                  className="w-full flex items-center gap-4 py-3 hover:bg-gray-700/50 px-2 rounded transition-colors text-left"
                >
                  <div className="font-mono text-cyan-400 font-semibold w-20 shrink-0">
                    AS{asn.asn}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-200 truncate">
                      {asn.name}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{asn.description}</div>
                  </div>
                  <div className="text-lg shrink-0">
                    {asn.country_code ? countryFlag(asn.country_code) : ''}
                  </div>
                  <ChevronRight size={16} className="text-gray-600 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Loading spinner */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
