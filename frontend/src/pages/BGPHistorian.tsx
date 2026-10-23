import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertCircle, AlertTriangle, ArrowRight, CheckCheck, Clock, GitCompare, Loader2,
  Network, RefreshCw, Trash2, X,
} from 'lucide-react'
import { bgpApi } from '@/api/client'
import { toast } from '@/store/toast'
import { ModuleHero } from '@/hero/ModuleHero'
import { TimelineMotif } from '@/bgp/BgpMotifs'
import type { BGPAlert, BGPAlertType, BGPDiffField, BGPDiffResponse, BGPSnapshot } from '@/types/bgp'
import {
  dayKey, formatClock, formatDateTime, formatDay, formatGap, formatShortDay, isValidASN,
  isValidDate, stripASN,
} from '@/bgp/format'
import '@/bgp/bgp.css'

const ALERT_LABEL: Record<BGPAlertType, string> = {
  prefix_change: 'Préfixes',
  peer_change: 'Peers',
  upstream_change: 'Upstreams',
  downstream_change: 'Downstreams',
}
const ALERT_TYPES = Object.keys(ALERT_LABEL) as BGPAlertType[]
const REFRESH_MS = 30_000
const DIFF_ITEM_LIMIT = 50

type AlertDelta = { added: number; removed: number } | { note: string }

/** Size change of each list between the old and new values stored on the alert. */
function alertDelta(alert: BGPAlert): AlertDelta {
  try {
    if (!alert.old_value || !alert.new_value) return { note: 'Données manquantes' }
    const oldParsed = JSON.parse(alert.old_value) as Record<string, unknown>
    const newParsed = JSON.parse(alert.new_value) as Record<string, unknown>
    const oldData = (oldParsed?.data ?? oldParsed) as Record<string, unknown[]>
    const newData = (newParsed?.data ?? newParsed) as Record<string, unknown[]>
    const keys = Object.keys(newData ?? {}).filter(k => Array.isArray(newData[k]))
    if (keys.length === 0) return { note: 'Changement générique' }
    let added = 0
    let removed = 0
    for (const k of keys) {
      const diff = newData[k].length - ((oldData?.[k] as unknown[]) ?? []).length
      if (diff > 0) added += diff
      else removed -= diff
    }
    return added || removed ? { added, removed } : { note: 'Changement de contenu, effectif inchangé' }
  } catch {
    return { note: 'Valeurs illisibles (données corrompues ?)' }
  }
}

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

/* ---------------------------------------------------------------- alerts */

/** What the page knows about the alert feed, for the hero status line. */
type FeedStatus = { count: number } | { failed: true }

function AlertStream({ onOpenSnapshots, onFeed }: { onOpenSnapshots: () => void; onFeed: (status: FeedStatus) => void }) {
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState<BGPAlert[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadedAt, setLoadedAt] = useState<Date | null>(null)
  const [ackingId, setAckingId] = useState<number | null>(null)
  const [purging, setPurging] = useState(false)
  const sequence = useRef(0)

  // Background refreshes keep the current list on screen; only the first load shows a spinner.
  const loadAlerts = useCallback(() => {
    const request = ++sequence.current
    setLoading(true)
    bgpApi.getAlerts(100, 0)
      .then(r => {
        if (request !== sequence.current) return
        const valid = r.items.filter(alert => isValidDate(alert.detected_at))
        if (valid.length !== r.items.length) console.warn(`${r.items.length - valid.length} alerte(s) ignorée(s) à cause d'une date invalide`)
        setAlerts(valid)
        setError(null)
        setLoadedAt(new Date())
        onFeed({ count: valid.length })
      })
      .catch((e: unknown) => {
        if (request !== sequence.current) return
        setError(e instanceof Error ? e.message : 'Erreur réseau')
        onFeed({ failed: true })
      })
      .finally(() => { if (request === sequence.current) setLoading(false) })
  }, [onFeed])

  useEffect(() => {
    loadAlerts()
    const interval = setInterval(loadAlerts, REFRESH_MS)
    return () => {
      clearInterval(interval)
      sequence.current += 1
    }
  }, [loadAlerts])

  const handleAck = async (id: number) => {
    setAckingId(id)
    try {
      await bgpApi.ackAlert(id)
      setAlerts(prev => prev?.filter(a => a.id !== id) ?? prev)
      toast.success('Alerte acquittée')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur acquittement')
    } finally {
      setAckingId(null)
    }
  }

  const purgeCorruptedAlerts = async () => {
    if (!confirm('⚠️ Purger toutes les alertes avec des dates corrompues ?\nCette action les acquittera définitivement.')) return
    setPurging(true)
    try {
      const res = await bgpApi.getAlerts(1000, 0)
      const corrupted = res.items.filter(alert => !isValidDate(alert.detected_at))
      if (corrupted.length === 0) {
        toast.info('Aucune alerte corrompue trouvée')
        return
      }
      for (const alert of corrupted) await bgpApi.ackAlert(alert.id)
      toast.success(`${corrupted.length} alerte(s) corrompue(s) purgée(s)`)
      loadAlerts()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de la purge')
    } finally {
      setPurging(false)
    }
  }

  const days = useMemo(() => {
    const groups: { key: string; label: string; items: BGPAlert[] }[] = []
    for (const alert of alerts ?? []) {
      const key = dayKey(alert.detected_at)
      const last = groups[groups.length - 1]
      if (last?.key === key) last.items.push(alert)
      else groups.push({ key, label: formatDay(alert.detected_at), items: [alert] })
    }
    return groups
  }, [alerts])

  const byType = useMemo(() => ALERT_TYPES.map(type => ({
    type, count: (alerts ?? []).filter(alert => alert.alert_type === type).length,
  })), [alerts])

  return (
    <div className="bgp-stream">
      <header className="bgp-stream-head">
        <div>
          <h2><AlertTriangle size={16} aria-hidden="true" /> Changements de routage</h2>
          <p>
            {alerts ? `${alerts.length} alerte${alerts.length > 1 ? 's' : ''} non acquittée${alerts.length > 1 ? 's' : ''}` : 'Flux en cours de chargement'}
            {loadedAt && <> · actualisé à {loadedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}, puis toutes les 30 s</>}
          </p>
        </div>
        <div className="bgp-stream-tools">
          <button type="button" onClick={purgeCorruptedAlerts} disabled={purging} className="bgp-icon-button" title="Purger les alertes corrompues (dates invalides)" aria-label="Supprimer les alertes corrompues">
            {purging ? <Loader2 size={14} className="bgp-spin" /> : <Trash2 size={14} />}
          </button>
          <button type="button" onClick={loadAlerts} disabled={loading} className="bgp-icon-button" title="Rafraîchir" aria-label="Actualiser">
            <RefreshCw size={14} className={loading ? 'bgp-spin' : undefined} />
          </button>
        </div>
      </header>

      {alerts && alerts.length > 0 && (
        <ul className="bgp-type-strip" aria-label="Répartition par type">
          {byType.map(({ type, count }) => (
            <li key={type} data-alert-type={type} data-empty={count === 0}>
              <i aria-hidden="true" /><span>{ALERT_LABEL[type]}</span><b>{count}</b>
            </li>
          ))}
        </ul>
      )}

      {loading && !alerts && !error && <Spinner />}
      {error && <ErrorMessage message={error} />}

      {!error && alerts?.length === 0 && (
        <div className="bgp-history-empty" data-state="no-alerts">
          <Clock size={22} aria-hidden="true" />
          <div>
            <h3>Aucune alerte retournée</h3>
            <p>L’API ne rapporte pas d’alerte active. Cela ne permet pas de conclure qu’aucun snapshot n’existe : les deux historiques se consultent séparément.</p>
          </div>
          <button type="button" className="bgp-button is-primary" onClick={onOpenSnapshots}>
            <Clock size={14} aria-hidden="true" /> Consulter les snapshots
          </button>
        </div>
      )}

      {!error && days.length > 0 && (
        <div className="bgp-days">
          {days.map(day => (
            <section key={day.key} className="bgp-day" aria-label={day.label}>
              <h3 className="bgp-day-label"><span>{day.label}</span><b>{day.items.length}</b></h3>
              <ol className="bgp-events">
                {day.items.map(alert => {
                  const delta = alertDelta(alert)
                  return (
                    <li key={alert.id} className="bgp-event" data-alert-type={alert.alert_type}>
                      <time className="bgp-event-time" dateTime={alert.detected_at}>{formatClock(alert.detected_at)}</time>
                      <span className="bgp-event-node" aria-hidden="true" />
                      <span className="bgp-event-type">{ALERT_LABEL[alert.alert_type] ?? alert.alert_type}</span>
                      <strong className="bgp-event-asn">AS{alert.asn}</strong>
                      <span className="bgp-event-delta">
                        {'note' in delta ? <em>{delta.note}</em> : (
                          <>
                            {delta.added > 0 && <span className="is-added">+{delta.added}</span>}
                            {delta.removed > 0 && <span className="is-removed">−{delta.removed}</span>}
                            <small>éléments</small>
                          </>
                        )}
                      </span>
                      <div className="bgp-event-actions">
                        <button type="button" className="bgp-button is-quiet" onClick={() => navigate(`/bgp?asn=${alert.asn}`)}>
                          <Network size={13} aria-hidden="true" /> Lookup
                        </button>
                        <button type="button" className="bgp-icon-button" onClick={() => handleAck(alert.id)} disabled={ackingId === alert.id} title="Acquitter" aria-label={`Acquitter l'alerte ${alert.id}`}>
                          {ackingId === alert.id ? <Loader2 size={13} className="bgp-spin" /> : <CheckCheck size={13} />}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------- snapshots */

function DiffPanel({ diffResponse, onClose }: { diffResponse: BGPDiffResponse; onClose: () => void }) {
  const { diff, older, newer } = diffResponse
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus()
    }
  }, [])

  const column = (kind: 'removed' | 'added', items: unknown[]) => (
    <div className={`bgp-diff-col is-${kind}`}>
      <h5>{kind === 'added' ? 'Ajoutés' : 'Retirés'} <b>{items.length}</b></h5>
      {items.length === 0 ? <p className="bgp-diff-none">Aucun</p> : (
        <ul>
          {items.slice(0, DIFF_ITEM_LIMIT).map((item, i) => (
            <li key={`${kind}-${i}`}>{kind === 'added' ? '+' : '-'} {typeof item === 'string' ? item : JSON.stringify(item)}</li>
          ))}
          {items.length > DIFF_ITEM_LIMIT && <li className="bgp-diff-more">… {items.length - DIFF_ITEM_LIMIT} de plus non affichés</li>}
        </ul>
      )}
    </div>
  )

  return (
    <section className="bgp-diff" role="region" aria-labelledby="bgp-diff-title">
      <header className="bgp-diff-head">
        <GitCompare size={16} aria-hidden="true" />
        <h2 id="bgp-diff-title">Comparaison des snapshots</h2>
        <button ref={closeButtonRef} type="button" className="bgp-icon-button" onClick={onClose} aria-label="Fermer"><X size={15} /></button>
      </header>
      <div className="bgp-diff-span">
        <div data-state="before">
          <span>AVANT · #{older.id}</span>
          <time dateTime={older.created_at}>{formatDateTime(older.created_at)}</time>
        </div>
        <div className="bgp-diff-gap"><ArrowRight size={14} aria-hidden="true" /><small>{formatGap(older.created_at, newer.created_at)}</small></div>
        <div data-state="after">
          <span>APRÈS · #{newer.id}</span>
          <time dateTime={newer.created_at}>{formatDateTime(newer.created_at)}</time>
        </div>
      </div>
      <div className="bgp-diff-body">
        {diff.changed_fields.length === 0 ? (
          <p className="bgp-diff-none is-block">Aucun changement entre ces deux snapshots.</p>
        ) : Object.entries(diff.changes).map(([section, fields]) => (
          <section key={section} className="bgp-diff-section">
            <h3>{section}</h3>
            {Object.entries(fields as Record<string, BGPDiffField>).map(([fieldName, field]) => (
              <div key={fieldName} className="bgp-diff-field">
                <h4>{fieldName}</h4>
                <div className="bgp-diff-cols">
                  {column('removed', field.removed ?? [])}
                  {column('added', field.added ?? [])}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </section>
  )
}

/** Snapshot dates placed on a proportional time axis (oldest left, newest right). */
function TimeRuler({ snapshots, selected }: { snapshots: BGPSnapshot[]; selected: number[] }) {
  const times = snapshots.map(s => new Date(s.created_at).getTime())
  const min = Math.min(...times)
  const max = Math.max(...times)
  const oldest = snapshots[times.indexOf(min)]
  const newest = snapshots[times.indexOf(max)]
  return (
    <div className="bgp-ruler" aria-hidden="true">
      <div className="bgp-ruler-track">
        {snapshots.map((snap, i) => {
          const left = max === min ? (snapshots.length === 1 ? 50 : (i / (snapshots.length - 1)) * 100) : ((times[i] - min) / (max - min)) * 100
          return <span key={snap.id} className="bgp-ruler-tick" data-selected={selected.includes(snap.id)} style={{ left: `${left}%` }} />
        })}
      </div>
      <div className="bgp-ruler-ends">
        <span>{formatShortDay(oldest.created_at)}</span>
        <span>{formatGap(oldest.created_at, newest.created_at)} d’observation</span>
        <span>{formatShortDay(newest.created_at)}</span>
      </div>
    </div>
  )
}

function SnapshotTimeline({ initialASN }: { initialASN: number | null }) {
  const navigate = useNavigate()
  const [asnInput, setAsnInput] = useState(initialASN ? String(initialASN) : '')
  const [currentASN, setCurrentASN] = useState<number | null>(null)
  const [snapshots, setSnapshots] = useState<BGPSnapshot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [diffResponse, setDiffResponse] = useState<BGPDiffResponse | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const loadSequence = useRef(0)
  const diffSequence = useRef(0)

  const loadSnapshots = useCallback(async (asn: number) => {
    const request = ++loadSequence.current
    diffSequence.current += 1
    setCurrentASN(asn)
    setLoading(true)
    setError(null)
    setSnapshots([])
    setSelected([])
    setDiffResponse(null)
    try {
      const res = await bgpApi.getSnapshots(asn, 50, 0)
      if (request === loadSequence.current) setSnapshots(res.items.filter(s => isValidDate(s.created_at)))
    } catch (e) {
      if (request === loadSequence.current) setError(e instanceof Error ? e.message : 'Erreur réseau')
    } finally {
      if (request === loadSequence.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialASN) void loadSnapshots(initialASN)
    return () => { loadSequence.current += 1; diffSequence.current += 1 }
  }, [initialASN, loadSnapshots])

  const handleLoad = () => {
    const asn = stripASN(asnInput)
    if (!isValidASN(asn)) { toast.error('ASN invalide'); return }
    void loadSnapshots(asn)
  }

  const toggleSelect = (id: number) => {
    diffSequence.current += 1
    setDiffResponse(null)
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }

  // Before / after follow the snapshot dates, not the order of the clicks.
  const ordered = useMemo(() => {
    const picked = snapshots.filter(s => selected.includes(s.id))
    return picked.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }, [snapshots, selected])

  const handleCompare = async () => {
    if (ordered.length < 2 || currentASN === null) return
    const request = ++diffSequence.current
    setDiffLoading(true)
    try {
      const res = await bgpApi.getDiff(currentASN, ordered[0].id, ordered[1].id)
      if (request === diffSequence.current) setDiffResponse(res)
    } catch (e) {
      if (request === diffSequence.current) toast.error(e instanceof Error ? e.message : 'Erreur diff')
    } finally {
      if (request === diffSequence.current) setDiffLoading(false)
    }
  }

  const roleOf = (id: number) => (ordered.length === 2 ? (ordered[0].id === id ? 'before' : ordered[1].id === id ? 'after' : null) : null)

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
      </form>

      {currentASN === null && !loading && (
        <p className="bgp-snapshot-hint">Les snapshots se consultent par ASN. Chacun fige les préfixes et relations retournés au moment de sa prise ; deux snapshots se comparent pour isoler ajouts et retraits.</p>
      )}

      {loading && <Spinner />}
      {error && <ErrorMessage message={error} />}

      {!loading && !error && currentASN !== null && snapshots.length === 0 && (
        <div className="bgp-history-empty" data-state="no-snapshots">
          <Clock size={22} aria-hidden="true" />
          <div>
            <h3>Aucun snapshot retourné</h3>
            <p>L’API n’a renvoyé aucun snapshot pour cet ASN. Les alertes restent consultables dans leur propre vue.</p>
          </div>
          <button type="button" className="bgp-button" onClick={() => navigate(`/bgp?asn=${currentASN}`)}>Ouvrir dans BGP Lookup</button>
        </div>
      )}

      {!loading && !error && snapshots.length > 0 && (
        <>
          <header className="bgp-timeline-head">
            <div>
              <h3>Chronologie des observations</h3>
              <span className="bgp-table-count">{snapshots.length} snapshot(s) · AS{currentASN}</span>
            </div>
            <div className="bgp-compare-bar">
              {selected.length < 2 && (
                <span className="bgp-compare-hint">{selected.length === 0 ? 'Sélectionnez deux snapshots à comparer' : 'Sélectionnez un second snapshot pour comparer'}</span>
              )}
              {selected.length === 2 && (
                <button type="button" onClick={handleCompare} disabled={diffLoading} className="bgp-button is-primary">
                  {diffLoading ? <Loader2 size={14} className="bgp-spin" aria-hidden="true" /> : <GitCompare size={14} aria-hidden="true" />}
                  Comparer les snapshots
                </button>
              )}
            </div>
          </header>

          <TimeRuler snapshots={snapshots} selected={selected} />

          <div className={`bgp-timeline-workspace${diffResponse ? ' is-comparing' : ''}`}>
            <ol className="bgp-timeline" aria-label="Chronologie des snapshots">
              {snapshots.map((snap, idx) => {
                const role = roleOf(snap.id)
                return (
                  <li key={snap.id}>
                    <label className="bgp-snapshot-item" data-selected={selected.includes(snap.id)} data-latest={idx === 0}>
                      <input type="checkbox" checked={selected.includes(snap.id)} onChange={() => toggleSelect(snap.id)} aria-label={`Comparer le snapshot ${snap.id}`} />
                      <span className="bgp-snapshot-node" aria-hidden="true" />
                      <span className="bgp-snapshot-copy">
                        <time dateTime={snap.created_at}>{formatDateTime(snap.created_at)}</time>
                        <span>#{snap.id} · capturé par {snap.taken_by || '—'}</span>
                      </span>
                      {role && <span className="bgp-snapshot-role" data-role={role}>{role === 'before' ? 'avant' : 'après'}</span>}
                      {idx === 0 && !role && <span className="bgp-latest-badge">Le plus récent</span>}
                    </label>
                  </li>
                )
              })}
            </ol>
            {diffResponse && <DiffPanel diffResponse={diffResponse} onClose={() => setDiffResponse(null)} />}
          </div>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ page */

export default function BGPHistorian() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const asnParam = searchParams.get('asn')
  const initialASN = asnParam && isValidASN(stripASN(asnParam)) ? stripASN(asnParam) : null
  const [activeTab, setActiveTab] = useState<'snapshots' | 'alerts'>(initialASN ? 'snapshots' : 'alerts')
  const [feed, setFeed] = useState<FeedStatus | null>(null)
  const openSnapshots = useCallback(() => setActiveTab('snapshots'), [])

  return (
    <div className="bgp-console bgp-historian">
      <div className="bgp-frame">
        <ModuleHero
          breadcrumb="NETWORK / ROUTING INTELLIGENCE" title="BGP" accent="HISTORIAN" typeOnce="bgp-historian"
          subtitle="Routing Timeline — suivre les alertes et comparer les états d’un ASN."
          motif={<TimelineMotif />}
          index={{
            label: 'ROUTING TIMELINE',
            lines: ['ALERTES', 'SNAPSHOTS', 'AVANT · APRÈS'],
            status: !feed ? undefined
              : 'failed' in feed ? { text: 'FLUX INDISPONIBLE', tone: 'warn' }
              : { text: `${feed.count} ALERTE${feed.count > 1 ? 'S' : ''}`, mark: 'FLUX 30 S' },
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
          <button type="button" className="bgp-link" onClick={() => navigate('/bgp')}>
            <Network size={14} aria-hidden="true" /> BGP Lookup
          </button>
        </div>

        <section className="bgp-stage is-timeline" aria-label={activeTab === 'alerts' ? 'Changements de routage' : 'Snapshots BGP'}>
          {/* The feed stays mounted so the hero status keeps reporting it from the Snapshots tab. */}
          <div hidden={activeTab !== 'alerts'}><AlertStream onOpenSnapshots={openSnapshots} onFeed={setFeed} /></div>
          {activeTab === 'snapshots' && <SnapshotTimeline initialASN={initialASN} />}
        </section>
      </div>
    </div>
  )
}
