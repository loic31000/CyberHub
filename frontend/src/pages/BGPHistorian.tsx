import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, AlertTriangle, Clock, GitCompare, Loader2, Network } from 'lucide-react'
import { bgpApi } from '@/api/client'
import { toast } from '@/store/toast'
import { ModuleHero } from '@/hero/ModuleHero'
import { TimelineMotif } from '@/bgp/BgpMotifs'
import type { BGPDiffResponse, BGPSnapshot } from '@/types/bgp'
import { formatShortDay, isValidASN, isValidDate, parseAPIError, stripASN } from '@/bgp/format'
import { AlertStream, type FeedStatus } from '@/bgp/HistorianAlerts'
import { snapshotMoment } from '@/bgp/history'
import { ComparisonSurface } from '@/bgp/HistorianDiff'
import { ObservationList, TimeInstrument, type Role } from '@/bgp/HistorianTimeline'
import { readShortcuts, rememberSnapshotASN, type SnapshotShortcut } from '@/bgp/snapshotShortcuts'
import '@/bgp/bgp.css'

const PAGE = 50
// Same chronology as the backend: snapshot_date, then created_at for older rows.
const time = (s: BGPSnapshot) => new Date(snapshotMoment(s)).getTime()

function Spinner() {
  return (
    <div className="bgp-state" role="status" aria-live="polite">
      <Loader2 size={20} className="bgp-spin" aria-hidden="true" />
      <span>Chargement des données BGP…</span>
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

/* ------------------------------------------------------------- snapshots */

/**
 * The snapshots of one ASN. The ASN comes from the URL (?asn=), so links from
 * Network Atlas, reloads and the browser history all land on the same view.
 */
function SnapshotWorkspace({ asn, alertASNs, onLoadASN }: { asn: number | null; alertASNs: number[]; onLoadASN: (asn: number) => void }) {
  const navigate = useNavigate()
  const [asnInput, setAsnInput] = useState(asn ? String(asn) : '')
  const [snapshots, setSnapshots] = useState<BGPSnapshot[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [diffResponse, setDiffResponse] = useState<BGPDiffResponse | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [diffError, setDiffError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [shortcuts, setShortcuts] = useState<SnapshotShortcut[]>(readShortcuts)
  const loadSequence = useRef(0)
  const diffSequence = useRef(0)

  useEffect(() => {
    if (asn) setAsnInput(String(asn))
  }, [asn])

  useEffect(() => {
    const request = ++loadSequence.current
    diffSequence.current += 1
    setSnapshots([])
    setTotal(0)
    setSelected([])
    setDiffResponse(null)
    setDiffError(null)
    setError(null)
    setDiffLoading(false)
    if (!asn) { setLoading(false); return }
    setLoading(true)
    bgpApi.getSnapshots(asn, PAGE, 0)
      .then(res => {
        if (request !== loadSequence.current) return
        const items = res.items.filter(s => isValidDate(s.created_at))
        setSnapshots(items)
        setTotal(res.total ?? res.items.length)
        if (items.length > 0) setShortcuts(rememberSnapshotASN({ asn, count: res.total ?? items.length, last: items[0].created_at }))
      })
      .catch((e: unknown) => { if (request === loadSequence.current) setError(parseAPIError(e)) })
      .finally(() => { if (request === loadSequence.current) setLoading(false) })
    return () => { loadSequence.current += 1; diffSequence.current += 1 }
  }, [asn, reloadKey])

  const loadMore = async () => {
    if (!asn) return
    const request = loadSequence.current
    setLoadingMore(true)
    try {
      const res = await bgpApi.getSnapshots(asn, PAGE, snapshots.length)
      if (request !== loadSequence.current) return
      setSnapshots(prev => {
        const known = new Set(prev.map(s => s.id))
        return [...prev, ...res.items.filter(s => isValidDate(s.created_at) && !known.has(s.id))]
      })
      setTotal(res.total ?? total)
    } catch (e) {
      if (request === loadSequence.current) toast.error(parseAPIError(e))
    } finally {
      if (request === loadSequence.current) setLoadingMore(false)
    }
  }

  const handleLoad = () => {
    const next = stripASN(asnInput)
    if (!isValidASN(next)) { toast.error('ASN invalide'); return }
    if (next === asn) setReloadKey(k => k + 1)
    else onLoadASN(next)
  }

  const resetComparison = useCallback(() => {
    diffSequence.current += 1
    setDiffResponse(null)
    setDiffError(null)
    setDiffLoading(false)
  }, [])

  const toggleSelect = useCallback((id: number) => {
    resetComparison()
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }, [resetComparison])

  // Before / after follow the snapshot dates, not the order of the clicks.
  const ordered = useMemo(
    () => snapshots.filter(s => selected.includes(s.id)).sort((a, b) => time(a) - time(b)),
    [snapshots, selected],
  )
  const roleOf = useCallback((id: number): Role | null => (
    ordered.length === 2 ? (ordered[0].id === id ? 'before' : ordered[1].id === id ? 'after' : null) : null
  ), [ordered])

  const compare = useCallback(async (older: BGPSnapshot, newer: BGPSnapshot) => {
    if (!asn) return
    const request = ++diffSequence.current
    setDiffLoading(true)
    setDiffError(null)
    setDiffResponse(null)
    try {
      const res = await bgpApi.getDiff(asn, older.id, newer.id)
      if (request === diffSequence.current) setDiffResponse(res)
    } catch (e) {
      if (request === diffSequence.current) setDiffError(parseAPIError(e))
    } finally {
      if (request === diffSequence.current) setDiffLoading(false)
    }
  }, [asn])

  const compareWithPrevious = useCallback((newer: BGPSnapshot, older: BGPSnapshot) => {
    setSelected([older.id, newer.id])
    void compare(older, newer)
  }, [compare])

  const latestPair = () => {
    const [newer, older] = snapshots
    if (newer && older) compareWithPrevious(newer, older)
  }

  return (
    <div className="bgp-snapshots">
      <form className="bgp-snapshot-form" onSubmit={event => { event.preventDefault(); handleLoad() }}>
        <div className="bgp-field">
          <label htmlFor="bgp-historian-asn">Numéro ASN</label>
          <div className="bgp-input">
            <span aria-hidden="true">AS</span>
            <input id="bgp-historian-asn" type="text" value={asnInput} onChange={e => setAsnInput(e.target.value)} placeholder="13335" autoComplete="off" spellCheck={false} />
          </div>
        </div>
        <button type="submit" disabled={loading} className="bgp-run">
          {loading ? <Loader2 size={16} className="bgp-spin" aria-hidden="true" /> : <Clock size={16} aria-hidden="true" />}
          <span>Charger l’historique</span>
        </button>
        {asn && (
          <button type="button" className="bgp-link bgp-snapshot-lookup" onClick={() => navigate(`/bgp?asn=${asn}`)}>
            <Network size={14} aria-hidden="true" /> Explorer AS{asn} dans Network Atlas
          </button>
        )}
      </form>

      <SnapshotShortcuts shortcuts={shortcuts} alertASNs={alertASNs} current={asn} onOpen={next => (next === asn ? setReloadKey(k => k + 1) : onLoadASN(next))} />

      {!asn && !loading && (
        <p className="bgp-snapshot-hint">Les snapshots se consultent par ASN. Chacun fige les préfixes et relations retournés au moment de sa prise ; deux snapshots se comparent pour isoler ajouts et retraits. Un snapshot se prend depuis la fiche d’un ASN dans Network Atlas.</p>
      )}

      {loading && <Spinner />}
      {error && <ErrorMessage message={error} />}

      {!loading && !error && asn && snapshots.length === 0 && (
        <div className="bgp-history-empty" data-state="no-snapshots">
          <Clock size={22} aria-hidden="true" />
          <div>
            <h3>Aucun snapshot retourné</h3>
            <p>L’API n’a renvoyé aucun snapshot pour cet ASN. Les alertes restent consultables dans leur propre vue.</p>
          </div>
          <button type="button" className="bgp-button" onClick={() => navigate(`/bgp?asn=${asn}`)}>Ouvrir dans BGP Lookup</button>
        </div>
      )}

      {!loading && !error && snapshots.length > 0 && (
        <>
          <p className="bgp-snapshot-hint">
            {snapshots.some(s => s.provenance_status === 'known')
              ? 'La frise indique l’horodatage du snapshot enregistré par CyberHub. Chaque observation signale si ses données viennent du cache ou d’un cache périmé, avec l’heure à laquelle CyberHub les a récupérées ; « provenance inconnue » marque les snapshots antérieurs à ce suivi.'
              : 'La frise indique l’horodatage du snapshot enregistré par CyberHub. Les réponses BGP peuvent venir du cache ou d’un repli périmé ; l’API ne fournit ni leur âge ni l’heure de collecte source.'}
          </p>
          <TimeInstrument snapshots={snapshots} total={total} selected={selected} roleOf={roleOf} onToggle={toggleSelect} />

          <div className="bgp-investigation">
            <div className="bgp-observations">
              <header className="bgp-observations-head">
                <h3>Observations</h3>
                <span className="bgp-table-count">{snapshots.length} snapshot(s) · AS{asn}</span>
              </header>
              <ObservationList
                snapshots={snapshots}
                asn={asn!}
                selected={selected}
                roleOf={roleOf}
                onToggle={toggleSelect}
                onCompareWithPrevious={compareWithPrevious}
              />
              {snapshots.length < total && (
                <button type="button" className="bgp-button is-quiet bgp-load-more" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore && <Loader2 size={13} className="bgp-spin" aria-hidden="true" />}
                  Charger {Math.min(PAGE, total - snapshots.length)} observation(s) plus ancienne(s)
                </button>
              )}
            </div>

            <div className="bgp-comparison">
              {diffResponse ? (
                <ComparisonSurface diffResponse={diffResponse} onClose={resetComparison} />
              ) : (
                <div className="bgp-compare-guide">
                  <GitCompare size={20} aria-hidden="true" />
                  <h3>Comparaison avant / après</h3>
                  {ordered.length === 2 ? (
                    <p>
                      <b>AVANT</b> {formatShortDay(snapshotMoment(ordered[0]))} · #{ordered[0].id} → <b>APRÈS</b> {formatShortDay(snapshotMoment(ordered[1]))} · #{ordered[1].id}
                    </p>
                  ) : (
                    <p>{selected.length === 0 ? 'Sélectionnez deux observations sur la frise ou dans la liste.' : 'Sélectionnez un second snapshot pour comparer.'}</p>
                  )}
                  {diffError && <ErrorMessage message={diffError} />}
                  <div className="bgp-compare-actions">
                    {ordered.length === 2 && (
                      <button type="button" onClick={() => compare(ordered[0], ordered[1])} disabled={diffLoading} className="bgp-button is-primary">
                        {diffLoading ? <Loader2 size={14} className="bgp-spin" aria-hidden="true" /> : <GitCompare size={14} aria-hidden="true" />}
                        Comparer les snapshots
                      </button>
                    )}
                    {ordered.length < 2 && snapshots.length >= 2 && (
                      <button type="button" onClick={latestPair} disabled={diffLoading} className="bgp-button">
                        Comparer les deux plus récentes
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** One click back to an ASN known to have snapshots: remembered here, or present in the alert feed. */
function SnapshotShortcuts({ shortcuts, alertASNs, current, onOpen }: {
  shortcuts: SnapshotShortcut[]
  alertASNs: number[]
  current: number | null
  onOpen: (asn: number) => void
}) {
  const fromAlerts = alertASNs.filter(asn => !shortcuts.some(s => s.asn === asn)).slice(0, 8)
  if (shortcuts.length === 0 && fromAlerts.length === 0) return null
  const chip = (asn: number, meta: string, title: string) => (
    <button key={asn} type="button" className="bgp-shortcut" aria-current={asn === current ? 'true' : undefined} onClick={() => onOpen(asn)} title={title}>
      <strong>AS{asn}</strong><small>{meta}</small>
    </button>
  )
  return (
    <nav className="bgp-shortcuts" aria-label="Accès rapide aux snapshots">
      <span>Accès rapide</span>
      {shortcuts.map(s => chip(
        s.asn,
        s.count !== undefined ? `${s.count} snapshot${s.count > 1 ? 's' : ''}${s.last ? ` · ${formatShortDay(s.last)}` : ''}` : s.last ? `pris le ${formatShortDay(s.last)}` : 'snapshot pris',
        s.count !== undefined ? 'Historique déjà consulté dans ce navigateur' : 'Snapshot pris depuis Network Atlas dans ce navigateur',
      ))}
      {fromAlerts.map(asn => chip(asn, 'alerte', 'ASN présent dans le flux d’alertes : au moins deux snapshots'))}
    </nav>
  )
}

/* ------------------------------------------------------------------ page */

export default function BGPHistorian() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const asnParam = searchParams.get('asn')
  const asn = asnParam && isValidASN(stripASN(asnParam)) ? stripASN(asnParam) : null
  const [activeTab, setActiveTab] = useState<'snapshots' | 'alerts'>(asn ? 'snapshots' : 'alerts')
  const [feed, setFeed] = useState<FeedStatus | null>(null)
  const alertASNs = useMemo(() => (feed && 'asns' in feed ? feed.asns : []), [feed])
  const openSnapshots = useCallback(() => setActiveTab('snapshots'), [])

  const loadASN = useCallback((next: number) => {
    setSearchParams({ asn: String(next) })
    setActiveTab('snapshots')
  }, [setSearchParams])

  return (
    <div className="bgp-console bgp-historian">
      <div className="bgp-frame">
        <ModuleHero
          breadcrumb="NETWORK / ROUTING INTELLIGENCE" title="BGP" accent="HISTORIAN" typeOnce="bgp-historian"
          subtitle="Routing Timeline — suivre les alertes et comparer les états d’un ASN."
          motif={<TimelineMotif />}
          index={{
            label: 'ROUTING TIMELINE',
            // Two domain lines, so the two-line status below keeps the hero at the height of the other modules.
            lines: ['ALERTES · SNAPSHOTS', 'AVANT · APRÈS'],
            status: !feed ? undefined
              : 'failed' in feed ? { text: 'FLUX INDISPONIBLE', tone: 'warn' }
              : { text: `${feed.count} ALERTE${feed.count === 1 ? '' : 'S'} NON ACQUITTÉE${feed.count === 1 ? '' : 'S'}`, mark: 'FLUX 30 S' },
          }}
        />

        <div className="bgp-historian-bar">
          <div className="bgp-tabs" role="group" aria-label="Sections de BGP Historian">
            <button type="button" className="bgp-tab" aria-pressed={activeTab === 'alerts'} onClick={() => setActiveTab('alerts')}>
              <AlertTriangle size={15} aria-hidden="true" /> Flux d’alertes
            </button>
            <button type="button" className="bgp-tab" aria-pressed={activeTab === 'snapshots'} onClick={() => setActiveTab('snapshots')}>
              <Clock size={15} aria-hidden="true" /> Snapshots
            </button>
          </div>
          <button type="button" className="bgp-link" onClick={() => navigate(asn ? `/bgp?asn=${asn}` : '/bgp')}>
            <Network size={14} aria-hidden="true" /> BGP Lookup
          </button>
        </div>

        <section className="bgp-stage is-timeline" aria-label={activeTab === 'alerts' ? 'Changements de routage' : 'Snapshots BGP'}>
          {/* The feed stays mounted so the hero status keeps reporting it from the Snapshots tab. */}
          <div hidden={activeTab !== 'alerts'}>
            <AlertStream onOpenSnapshots={openSnapshots} onOpenASNSnapshots={loadASN} onFeed={setFeed} />
          </div>
          {activeTab === 'snapshots' && <SnapshotWorkspace asn={asn} alertASNs={alertASNs} onLoadASN={loadASN} />}
        </section>
      </div>
    </div>
  )
}
