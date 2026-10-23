import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useNavigationType, useSearchParams } from 'react-router-dom'
import {
  Activity, AlertCircle, ArrowUpRight, Camera, Check, ChevronRight, Copy, Globe, History,
  Loader2, ShieldBan,
} from 'lucide-react'
import { bgpApi } from '@/api/client'
import { toast } from '@/store/toast'
import { ModuleHero } from '@/hero/ModuleHero'
import { AtlasMotif } from '@/bgp/BgpMotifs'
import type {
  ASNInfo, BGPPeer, BGPStatusResponse, IPInfo, PrefixListData, SearchASN,
} from '@/types/bgp'
import { formatShortDay, isValidASN, parseAPIError, stripASN } from '@/bgp/format'
import {
  AtlasSchematic, EmptyState, PrefixTable, RelationAtlas, RelationTable, VisitMark, visitLabel, visitState,
  type RelationGroup, type VisitLens,
} from '@/bgp/LookupParts'
import { readVisits, recordVisit, writeVisits } from '@/bgp/visits'
import { rememberSnapshotASN } from '@/bgp/snapshotShortcuts'
import '@/bgp/bgp.css'

type SearchMode = 'asn' | 'ip' | 'search'
type View = 'atlas' | 'ipv4' | 'ipv6' | 'peers' | 'upstreams' | 'downstreams'

const MODE_LABEL: Record<SearchMode, string> = { asn: 'ASN', ip: 'IP', search: 'Recherche' }
const FIELD_LABEL: Record<SearchMode, string> = { asn: 'Système autonome', ip: 'Adresse IP', search: 'Organisation, ASN ou préfixe' }
const PLACEHOLDER: Record<SearchMode, string> = { asn: '13335', ip: '1.1.1.1', search: 'Cloudflare, AS13335, préfixe…' }
const GLYPH: Record<SearchMode, string> = { asn: 'AS', ip: 'IP', search: '⌕' }

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success('Copié !'))
}

function Spinner() {
  return (
    <div className="bgp-state" role="status" aria-live="polite">
      <Loader2 size={20} className="bgp-spin" aria-hidden="true" />
      <span>Chargement des données de routage…</span>
    </div>
  )
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="bgp-state is-error" role="alert">
      <AlertCircle size={16} aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

/*
 * Relation and prefix responses of the ASNs opened during this visit. Going
 * back to an ASN shows them at once instead of repeating four requests; the
 * ASN identity itself is always requested again.
 */
type DossierCache = Map<string, { at: number; value: unknown }>
const CACHE_MS = 5 * 60_000

interface Resource<T> { data: T | null; loading: boolean; error: string | null }

function useDossierResource<T>(cache: DossierCache, key: string, load: () => Promise<{ data: T } | undefined>): Resource<T> {
  const [state, setState] = useState<Resource<T>>(() => {
    const hit = cache.get(key)
    return hit && Date.now() - hit.at < CACHE_MS
      ? { data: hit.value as T, loading: false, error: null }
      : { data: null, loading: true, error: null }
  })
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    if (!state.loading) return
    let active = true
    Promise.resolve()
      .then(() => loadRef.current())
      .then(response => {
        if (!response?.data) throw new Error('Réponse vide')
        cache.set(key, { at: Date.now(), value: response.data })
        if (active) setState({ data: response.data, loading: false, error: null })
      })
      .catch((error: unknown) => { if (active) setState({ data: null, loading: false, error: parseAPIError(error) }) })
    return () => { active = false }
    // The dossier is keyed by ASN: one load per mounted resource.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cache, key])

  return state
}

const group = <T,>(resource: Resource<T>, pick: (data: T) => BGPPeer[][]): RelationGroup => ({
  items: resource.data ? pick(resource.data).flatMap(list => list ?? []) : null,
  loading: resource.loading,
  error: resource.error,
})

function ASNDossier({ asn, info, cache, visited, onOpenASN }: {
  asn: number
  info: ASNInfo
  cache: DossierCache
  visited: ReadonlySet<number>
  onOpenASN: (asn: number) => void
}) {
  const navigate = useNavigate()
  const [view, setView] = useState<View>('atlas')
  const [snapping, setSnapping] = useState(false)

  const prefixes = useDossierResource<PrefixListData>(cache, `${asn}:prefixes`, () => bgpApi.lookupASNPrefixes(asn))
  const peerData = useDossierResource(cache, `${asn}:peers`, () => bgpApi.lookupASNPeers(asn))
  const upstreamData = useDossierResource(cache, `${asn}:upstreams`, () => bgpApi.lookupASNUpstreams(asn))
  const downstreamData = useDossierResource(cache, `${asn}:downstreams`, () => bgpApi.lookupASNDownstreams(asn))

  const peers = group(peerData, d => [d.ipv4_peers, d.ipv6_peers])
  const upstreams = group(upstreamData, d => [d.ipv4_upstreams, d.ipv6_upstreams])
  const downstreams = group(downstreamData, d => [d.ipv4_downstreams, d.ipv6_downstreams])

  const handleSnapshot = async () => {
    setSnapping(true)
    try {
      const result = await bgpApi.takeSnapshot(asn)
      rememberSnapshotASN({ asn, last: new Date().toISOString() })
      const alertCount = result.alerts?.length ?? 0
      if (alertCount > 0) toast.warning(`Snapshot pris — ${alertCount} changement(s) détecté(s) !`)
      else toast.success('Snapshot pris avec succès')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur snapshot')
    } finally {
      setSnapping(false)
    }
  }

  // Exports a prefix of this ASN; the backend builds the "BGP Lookup — AS<N>" source from `asn`.
  const handleExportIOC = async (prefix: string) => {
    try {
      await bgpApi.exportIOC({ type: 'cidr', value: prefix, asn })
      toast.success(`IOC créé : ${prefix}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur export IOC')
    }
  }

  const prefixCount = (family: 'ipv4_prefixes' | 'ipv6_prefixes') =>
    prefixes.loading ? '…' : prefixes.data ? String(prefixes.data[family].length) : '—'
  const relationCount = (g: RelationGroup) => (g.loading ? '…' : g.items ? String(g.items.length) : '—')

  const views: { id: View; label: string; figure?: string }[] = [
    { id: 'atlas', label: 'Atlas' },
    { id: 'ipv4', label: 'Préfixes IPv4', figure: prefixCount('ipv4_prefixes') },
    { id: 'ipv6', label: 'Préfixes IPv6', figure: prefixCount('ipv6_prefixes') },
    { id: 'peers', label: 'Peers', figure: relationCount(peers) },
    { id: 'upstreams', label: 'Upstreams', figure: relationCount(upstreams) },
    { id: 'downstreams', label: 'Downstreams', figure: relationCount(downstreams) },
  ]

  const listView = (resource: { loading: boolean; error: string | null }, content: () => React.ReactElement) => {
    if (resource.loading) return <Spinner />
    if (resource.error) return <ErrorMessage message={resource.error} />
    return content()
  }

  const website = /^https?:\/\//i.test(info.website ?? '') ? info.website : null
  const facts: { label: string; value: React.ReactNode }[] = [
    { label: 'Description', value: info.description_full?.filter(Boolean).join(' ') || info.description_short || 'Aucune description retournée' },
    { label: 'Pays', value: info.country_code || 'Non renseigné' },
    { label: 'Registre', value: info.rir_allocation?.rir_name || 'Non renseigné' },
    { label: 'Allocation', value: info.rir_allocation?.prefix ? `${info.rir_allocation.prefix}${info.rir_allocation.allocation_status ? ` · ${info.rir_allocation.allocation_status}` : ''}` : 'Non renseignée' },
    { label: 'Site web', value: website ? <a href={website} target="_blank" rel="noopener noreferrer">{website.replace(/^https?:\/\//i, '')}<ArrowUpRight size={12} aria-hidden="true" /></a> : (info.website || 'Non renseigné') },
    { label: 'Mise à jour', value: info.date_updated ? formatShortDay(info.date_updated) : 'Non renseignée' },
  ]

  return (
    <div className="bgp-dossier">
      <nav className="bgp-views" aria-label="Informations BGP de l'ASN">
        {views.map(item => (
          <button type="button" key={item.id} className="bgp-view" aria-pressed={view === item.id} onClick={() => setView(item.id)}>
            <span>{item.label}</span>
            {item.figure !== undefined && <>{' '}<b>{item.figure}</b></>}
          </button>
        ))}
      </nav>

      {view === 'atlas' && (
        <div className="bgp-atlas-layout">
          <RelationAtlas
            asn={asn}
            name={info.name}
            upstreams={upstreams}
            downstreams={downstreams}
            peers={peers}
            visited={visited}
            onOpen={onOpenASN}
            onShowAll={setView}
          />
          <aside className="bgp-operator" aria-labelledby="bgp-operator-title">
            <header className="bgp-section-head">
              <h3 id="bgp-operator-title">Fiche opérateur</h3>
              <span>Réponse ASN</span>
            </header>
            <dl className="bgp-facts">
              {facts.map(({ label, value }) => (
                <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
              ))}
            </dl>
            {info.abuse_contacts?.length > 0 && (
              <div className="bgp-abuse">
                <span>Contacts abus</span>
                {info.abuse_contacts.map(contact => <code key={contact}>{contact}</code>)}
              </div>
            )}
            <div className="bgp-operator-actions">
              <button type="button" className="bgp-button is-primary" onClick={handleSnapshot} disabled={snapping}>
                {snapping ? <Loader2 size={14} className="bgp-spin" aria-hidden="true" /> : <Camera size={14} aria-hidden="true" />}
                Prendre un snapshot
              </button>
              <button type="button" className="bgp-button" onClick={() => navigate(`/bgp/historian?asn=${asn}`)}>
                <History size={14} aria-hidden="true" /> Historique de l’ASN
              </button>
            </div>
          </aside>
        </div>
      )}

      {(view === 'ipv4' || view === 'ipv6') && listView(prefixes, () => (
        <PrefixTable
          family={view === 'ipv4' ? 4 : 6}
          prefixes={prefixes.data![view === 'ipv4' ? 'ipv4_prefixes' : 'ipv6_prefixes']}
          onCopy={copyToClipboard}
          onExport={handleExportIOC}
        />
      ))}
      {view === 'peers' && listView(peers, () => <RelationTable label="Peers" relations={peers.items ?? []} current={asn} visited={visited} onCopy={copyToClipboard} onOpen={onOpenASN} />)}
      {view === 'upstreams' && listView(upstreams, () => <RelationTable label="Upstreams" relations={upstreams.items ?? []} current={asn} visited={visited} onCopy={copyToClipboard} onOpen={onOpenASN} />)}
      {view === 'downstreams' && listView(downstreams, () => <RelationTable label="Downstreams" relations={downstreams.items ?? []} current={asn} visited={visited} onCopy={copyToClipboard} onOpen={onOpenASN} />)}
    </div>
  )
}

export default function BGPLookup() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<SearchMode>('asn')
  const [inputValue, setInputValue] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const navigationType = useNavigationType()
  const asnParam = searchParams.get('asn')
  const prefillParam = searchParams.get('prefill')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [asnInfo, setAsnInfo] = useState<ASNInfo | null>(null)
  const [currentASN, setCurrentASN] = useState<number | null>(null)
  const [ipInfo, setIpInfo] = useState<IPInfo | null>(null)
  const [searchResults, setSearchResults] = useState<SearchASN[] | null>(null)
  const [bgpStatus, setBGPStatus] = useState<BGPStatusResponse | null>(null)
  const [statusFailed, setStatusFailed] = useState(false)
  const [asnReloadKey, setAsnReloadKey] = useState(0)
  // The only exploration record: ASNs actually opened (their identity answered), newest first.
  const [visits, setVisits] = useState<number[]>(readVisits)
  const requestSequence = useRef(0)
  const dossierCache = useRef<DossierCache>(new Map()).current

  useEffect(() => { writeVisits(visits) }, [visits])

  // The URL is the source of truth for the explored ASN (links, back and forward).
  useEffect(() => {
    if (!asnParam) {
      if (navigationType === 'POP') {
        requestSequence.current += 1
        setLoading(false)
        setError(null)
        setAsnInfo(null)
        setCurrentASN(null)
        setIpInfo(null)
        setSearchResults(null)
        if (!prefillParam) setInputValue('')
      }
      if (prefillParam) {
        setInputValue(prefillParam)
        setMode(prefillParam.includes('/') ? 'search' : 'ip')
      }
      return
    }

    setMode('asn')
    setInputValue(asnParam.replace(/^AS/i, ''))
    const sequence = ++requestSequence.current
    const asn = stripASN(asnParam)
    setError(null)
    setAsnInfo(null)
    setCurrentASN(null)
    setIpInfo(null)
    setSearchResults(null)

    if (!isValidASN(asn)) {
      setLoading(false)
      setError('ASN invalide. Entrez un numéro (ex: 13335 ou AS13335)')
      return
    }

    let active = true
    setLoading(true)
    bgpApi.lookupASN(asn)
      .then(result => {
        if (active && requestSequence.current === sequence) {
          setAsnInfo(result.data)
          setCurrentASN(asn)
          setVisits(list => recordVisit(list, asn))
        }
      })
      .catch((e: unknown) => {
        if (active && requestSequence.current === sequence) setError(parseAPIError(e))
      })
      .finally(() => {
        if (active && requestSequence.current === sequence) setLoading(false)
      })

    return () => { active = false }
  }, [asnParam, prefillParam, asnReloadKey, navigationType])

  const handleSearch = useCallback(async () => {
    const val = inputValue.trim()
    if (!val) return

    if (mode === 'asn') {
      const asn = stripASN(val)
      requestSequence.current += 1
      if (!isValidASN(asn)) {
        setLoading(false)
        setError('ASN invalide. Entrez un numéro (ex: 13335 ou AS13335)')
        return
      }
      setError(null)
      if (asnParam && stripASN(asnParam) === asn) setAsnReloadKey(version => version + 1)
      else setSearchParams({ asn: String(asn) })
      return
    }

    const sequence = ++requestSequence.current
    setSearchParams({}, { replace: true })
    setLoading(true)
    setError(null)
    setAsnInfo(null)
    setCurrentASN(null)
    setIpInfo(null)
    setSearchResults(null)
    try {
      if (mode === 'ip') {
        const res = await bgpApi.lookupIP(val)
        if (res.status !== 'ok') throw new Error(res.status_message || 'Erreur BGPView')
        if (!res.data || !res.data.ip) throw new Error('Aucune donnée IP disponible')
        if (requestSequence.current === sequence) setIpInfo(res)
      } else {
        const res = await bgpApi.search(val)
        if (requestSequence.current === sequence) setSearchResults(res.data.asns)
      }
    } catch (e: unknown) {
      if (requestSequence.current === sequence) setError(parseAPIError(e))
    } finally {
      if (requestSequence.current === sequence) setLoading(false)
    }
  }, [mode, inputValue, asnParam, setSearchParams])

  useEffect(() => {
    bgpApi.getStatus().then(setBGPStatus).catch(() => { setBGPStatus(null); setStatusFailed(true) })
  }, [])

  const navigateToASN = useCallback((asn: number) => {
    requestSequence.current += 1
    setMode('asn')
    setInputValue(String(asn))
    setError(null)
    setLoading(true)
    setAsnInfo(null)
    setCurrentASN(null)
    setIpInfo(null)
    setSearchResults(null)
    if (asnParam && stripASN(asnParam) === asn) setAsnReloadKey(version => version + 1)
    else setSearchParams({ asn: String(asn) })
  }, [asnParam, setSearchParams])

  const visited = useMemo(() => new Set(visits), [visits])
  const trail = visits.filter(asn => asn !== currentASN).slice(0, 4)
  const lens: VisitLens = { current: currentASN, visited }

  const handleModeChange = (nextMode: SearchMode) => {
    setMode(nextMode)
    setError(null)
  }

  const prefillExample = (nextMode: SearchMode, value: string) => {
    setMode(nextMode)
    setInputValue(value)
  }

  // Exports a prefix found by IP lookup, with its origin ASN and an explicit "IP Lookup" source.
  const handleExportIPPrefix = async (prefix: string, asn: number) => {
    try {
      await bgpApi.exportIOC({ type: 'cidr', value: prefix, asn, source: `IP Lookup — AS${asn}` })
      toast.success(`IOC créé : ${prefix}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur export IOC')
    }
  }

  const sourceState = bgpStatus ? (bgpStatus.available ? 'available' : 'unavailable') : 'unknown'
  const idle = !loading && !error && !asnInfo && !ipInfo && !searchResults

  return (
    <div className="bgp-console bgp-lookup">
      <div className="bgp-frame">
        <ModuleHero
          breadcrumb="NETWORK / ROUTING INTELLIGENCE" title="BGP" accent="LOOKUP" typeOnce="bgp-lookup"
          subtitle="Network Atlas — explorer un système autonome, ses annonces et son voisinage."
          motif={<AtlasMotif />}
          index={{
            label: 'NETWORK ATLAS',
            lines: ['ASN · PRÉFIXES', 'PEERS · TRANSIT', 'IOC · SNAPSHOTS'],
            status: bgpStatus
              ? bgpStatus.available
                ? { text: 'EN LIGNE', mark: bgpStatus.primary?.toUpperCase().slice(0, 14) }
                : { text: bgpStatus.cache_available ? 'CACHE SEUL' : 'HORS LIGNE', tone: 'warn' }
              : statusFailed ? { text: 'ÉTAT INCONNU', tone: 'warn' } : undefined,
          }}
        />

        <form className="bgp-command" onSubmit={event => { event.preventDefault(); void handleSearch() }}>
          <div className="bgp-modes" role="group" aria-label="Mode de recherche">
            {(['asn', 'ip', 'search'] as SearchMode[]).map(m => (
              <button type="button" key={m} className="bgp-mode" aria-pressed={mode === m} onClick={() => handleModeChange(m)}>
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
          <div className="bgp-field">
            <label htmlFor="bgp-query">{FIELD_LABEL[mode]}</label>
            <div className="bgp-input">
              <span aria-hidden="true">{GLYPH[mode]}</span>
              <input
                id="bgp-query"
                type="text"
                value={inputValue}
                onChange={event => setInputValue(event.target.value)}
                placeholder={PLACEHOLDER[mode]}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>
          <button type="submit" className="bgp-run" disabled={!inputValue.trim()} aria-label={loading ? 'Remplacer la recherche en cours' : 'Explorer'}>
            {loading ? <Loader2 size={17} className="bgp-spin" aria-hidden="true" /> : <Activity size={17} aria-hidden="true" />}
            <span>{loading ? 'Remplacer' : 'Explorer'}</span>
          </button>
          <div className="bgp-command-side">
            <div className="bgp-source" aria-label="Provenance des données BGP">
              <i data-state={sourceState} aria-hidden="true" />
              <span className="bgp-source-name">{bgpStatus?.primary || 'Source non renseignée'}</span>
              <span className="bgp-source-state">{bgpStatus ? (bgpStatus.available ? 'Disponible' : 'Indisponible') : 'État inconnu'}</span>
              {bgpStatus?.cache_available && <span className="bgp-source-cache">Cache · {Math.max(0, Math.floor(bgpStatus.cache_age_seconds / 60))} min</span>}
            </div>
            <button type="button" className="bgp-link" onClick={() => navigate('/bgp/historian')}>
              <History size={14} aria-hidden="true" /> BGP Historian
            </button>
          </div>
        </form>

        {bgpStatus && !bgpStatus.available && (
          <div className="bgp-notice" role="status">
            <strong>Source BGP indisponible.</strong>{' '}
            {bgpStatus.cache_available ? 'Affichage de la dernière version mise en cache.' : 'Aucune version mise en cache disponible.'}
            {bgpStatus.message && <span> {bgpStatus.message}</span>}
          </div>
        )}

        <section className="bgp-stage" aria-label="Résultats BGP">
          {loading && <Spinner />}
          {!loading && error && <ErrorMessage message={error} />}

          {idle && (
            <div className="bgp-start">
              <div className="bgp-start-copy">
                <span className="bgp-kicker">Point de départ</span>
                <h2>Explorer un système autonome</h2>
                <p>Saisissez un ASN, une adresse IP ou le nom d’une organisation. L’atlas place ensuite ses fournisseurs de transit, ses clients et ses peers tels que la source les déclare.</p>
                <div className="bgp-examples" aria-label="Exemples de recherche">
                  <button type="button" onClick={() => prefillExample('asn', '13335')}>ASN <strong>AS13335</strong></button>
                  <button type="button" onClick={() => prefillExample('ip', '1.1.1.1')}>IP <strong>1.1.1.1</strong></button>
                  <button type="button" onClick={() => prefillExample('search', 'Cloudflare')}>Organisation <strong>Cloudflare</strong></button>
                </div>
              </div>
              <AtlasSchematic />
            </div>
          )}

          {!loading && !error && asnInfo && currentASN !== null && (
            <article className="bgp-result" aria-labelledby="bgp-asn-name">
              <header className="bgp-identity">
                <div className="bgp-asn-number">AS{currentASN}</div>
                <div className="bgp-identity-copy">
                  <h2 id="bgp-asn-name">{asnInfo.name || 'Nom non renseigné'}</h2>
                  {asnInfo.description_short && <p>{asnInfo.description_short}</p>}
                </div>
                <div className="bgp-identity-tags">
                  {asnInfo.country_code && <span>{asnInfo.country_code}</span>}
                  {asnInfo.rir_allocation?.rir_name && <span>{asnInfo.rir_allocation.rir_name}</span>}
                </div>
                {trail.length > 0 && (
                  <nav className="bgp-trail" aria-label="ASN précédemment explorés">
                    <span>Exploré avant</span>
                    {trail.map(asn => (
                      <button type="button" key={asn} onClick={() => navigateToASN(asn)} aria-label={`Retour à AS${asn}`}>
                        <Check size={11} aria-hidden="true" /> AS{asn}
                      </button>
                    ))}
                  </nav>
                )}
              </header>
              <ASNDossier key={currentASN} asn={currentASN} info={asnInfo} cache={dossierCache} visited={visited} onOpenASN={navigateToASN} />
            </article>
          )}

          {!loading && !error && ipInfo?.data && (
            <article className="bgp-result" aria-labelledby="bgp-ip-title">
              <header className="bgp-identity is-ip">
                <Globe size={22} aria-hidden="true" />
                <div className="bgp-identity-copy">
                  <h2 id="bgp-ip-title" className="bgp-ip">{ipInfo.data.ip}</h2>
                  <p>Origine de l’adresse selon la source BGP</p>
                </div>
              </header>
              <dl className="bgp-facts is-row">
                {[
                  { label: 'PTR', value: ipInfo.data.ptr_record || '—' },
                  { label: 'Registre', value: ipInfo.data.rir_allocation?.rir_name || '—' },
                  { label: 'Allocation', value: ipInfo.data.rir_allocation?.prefix || '—' },
                  { label: 'Pays', value: ipInfo.data.rir_allocation?.country_code || '—' },
                ].map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
              </dl>
              <header className="bgp-section-head">
                <h3>Préfixes annonçant cette adresse</h3>
                <span>{ipInfo.data.prefixes?.length ?? 0} préfixe(s)</span>
              </header>
              {ipInfo.data.prefixes?.length ? (
                <ul className="bgp-ip-prefixes">
                  {ipInfo.data.prefixes.map(p => (
                    <li key={p.prefix}>
                      <code>{p.prefix}</code>
                      {p.asn && p.asn.asn !== 0 ? (
                        <button type="button" className="bgp-origin" data-visit={visitState(p.asn.asn, lens)} onClick={() => navigateToASN(p.asn.asn)} aria-label={visitLabel(`Ouvrir AS${p.asn.asn} ${p.asn.name}`, visitState(p.asn.asn, lens))}>
                          <strong>AS{p.asn.asn}</strong><span>{p.asn.name}</span><VisitMark state={visitState(p.asn.asn, lens)} /><ChevronRight size={13} aria-hidden="true" />
                        </button>
                      ) : <span className="bgp-cell-muted">Origine non retournée</span>}
                      <div className="bgp-row-actions">
                        <button type="button" className="bgp-icon-button" onClick={() => copyToClipboard(p.prefix)} aria-label={`Copier le préfixe ${p.prefix}`}><Copy size={13} /></button>
                        {p.asn && p.asn.asn !== 0 && (
                          <button type="button" className="bgp-icon-button" onClick={() => handleExportIPPrefix(p.prefix, p.asn.asn)} aria-label={`Exporter ${p.prefix} en IOC`}><ShieldBan size={13} /></button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState label="Aucun préfixe retourné par la source pour cette IP" />}
            </article>
          )}

          {!loading && !error && searchResults && (
            <article className="bgp-result" aria-labelledby="bgp-search-title">
              <header className="bgp-section-head">
                <h2 id="bgp-search-title">Systèmes correspondants</h2>
                <span className="bgp-table-count">{searchResults.length} résultat(s)</span>
              </header>
              {searchResults.length === 0 ? <EmptyState label="Aucun ASN trouvé" /> : (
                <div className="bgp-search-results">
                  {searchResults.map(a => (
                    <button type="button" key={a.asn} className="bgp-search-result" data-visit={visitState(a.asn, lens)} onClick={() => navigateToASN(a.asn)}>
                      <strong>AS{a.asn}</strong>
                      <span>{a.name}</span>
                      <VisitMark state={visitState(a.asn, lens)} />
                      <small>{a.country_code}</small>
                      <ChevronRight size={14} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </article>
          )}
        </section>
      </div>
    </div>
  )
}
