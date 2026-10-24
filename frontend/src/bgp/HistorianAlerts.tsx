import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, AlertTriangle, CheckCheck, ChevronDown, Clock, History, Loader2, Network, RefreshCw, Trash2 } from 'lucide-react'
import { bgpApi } from '@/api/client'
import { toast } from '@/store/toast'
import type { BGPAlert, BGPAlertType } from '@/types/bgp'
import { dayKey, formatClock, formatDateTime, formatDay, isValidDate } from './format'
import { alertDetail, normalizeAlert, type AlertDetail } from './history'

export const ALERT_LABEL: Record<BGPAlertType, string> = {
  prefix_change: 'Préfixes',
  peer_change: 'Peers',
  upstream_change: 'Upstreams',
  downstream_change: 'Downstreams',
}
const ALERT_TYPES = Object.keys(ALERT_LABEL) as BGPAlertType[]
const REFRESH_MS = 30_000
const DETAIL_LIMIT = 30

/** What the page knows about the alert feed, for the hero status line. */
export type FeedStatus = { count: number; asns: number[] } | { failed: true }

function DetailList({ detail }: { detail: Extract<AlertDetail, { changes: unknown }> }) {
  return (
    <div className="bgp-event-detail">
      {detail.changes.map(change => (
        <div key={change.field} className="bgp-event-detail-field">
          <h4>{change.label}</h4>
          {(['removed', 'added'] as const).map(kind => change[kind].length > 0 && (
            <ul key={kind} className={`bgp-keys is-${kind}`} aria-label={`${kind === 'added' ? 'Ajoutés' : 'Retirés'} · ${change.label}`}>
              {change[kind].slice(0, DETAIL_LIMIT).map(item => (
                <li key={item.key}>{kind === 'added' ? '+' : '-'} {item.key}</li>
              ))}
              {change[kind].length > DETAIL_LIMIT && <li className="is-more">… {change[kind].length - DETAIL_LIMIT} de plus (comparer les snapshots pour la liste complète)</li>}
            </ul>
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * Unacknowledged alerts, newest first, grouped by day and filterable by type.
 * Background refreshes keep the list on screen; the parsed content of each
 * alert is kept per id, so a refresh does not parse unchanged alerts again.
 */
export function AlertStream({ onOpenSnapshots, onOpenASNSnapshots, onFeed }: {
  onOpenSnapshots: () => void
  onOpenASNSnapshots: (asn: number) => void
  onFeed: (status: FeedStatus) => void
}) {
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState<BGPAlert[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadedAt, setLoadedAt] = useState<Date | null>(null)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [ackingId, setAckingId] = useState<number | null>(null)
  const [purging, setPurging] = useState(false)
  const [hiddenTypes, setHiddenTypes] = useState<ReadonlySet<BGPAlertType>>(new Set())
  const [openId, setOpenId] = useState<number | null>(null)
  const sequence = useRef(0)
  const details = useRef(new Map<number, AlertDetail>())

  const loadAlerts = useCallback(() => {
    const request = ++sequence.current
    setLoading(true)
    bgpApi.getAlerts(100, 0)
      .then(r => {
        if (request !== sequence.current) return
        const parsed = (r.items as unknown[]).map(normalizeAlert)
        const normalized = parsed.filter((a): a is BGPAlert => a !== null)
        const valid = normalized.filter(alert => isValidDate(alert.detected_at))
        const unrecognized = parsed.length - normalized.length
        const invalidDates = normalized.length - valid.length
        if (unrecognized > 0) console.warn(`${unrecognized} alerte(s) non affichée(s) : format JSON non reconnu`)
        if (invalidDates > 0) console.warn(`${invalidDates} alerte(s) non affichée(s) : horodatage invalide`)
        valid.sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime())
        setAlerts(valid)
        setTotalCount(r.total ?? valid.length)
        setError(null)
        setLoadedAt(new Date())
        onFeed({ count: r.total ?? valid.length, asns: [...new Set(valid.map(a => a.asn))] })
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

  const detailOf = useCallback((alert: BGPAlert) => {
    let detail = details.current.get(alert.id)
    if (!detail) {
      detail = alertDetail(alert)
      details.current.set(alert.id, detail)
    }
    return detail
  }, [])

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
      const corrupted = (res.items as unknown[]).map(normalizeAlert)
        .filter((alert): alert is BGPAlert => alert !== null && !isValidDate(alert.detected_at))
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

  const byType = useMemo(() => ALERT_TYPES.map(type => ({
    type, count: (alerts ?? []).filter(alert => alert.alert_type === type).length,
  })), [alerts])

  const visible = useMemo(() => (alerts ?? []).filter(a => !hiddenTypes.has(a.alert_type)), [alerts, hiddenTypes])

  const days = useMemo(() => {
    const groups: { key: string; label: string; items: BGPAlert[] }[] = []
    for (const alert of visible) {
      const key = dayKey(alert.detected_at)
      const last = groups[groups.length - 1]
      if (last?.key === key) last.items.push(alert)
      else groups.push({ key, label: formatDay(alert.detected_at), items: [alert] })
    }
    return groups
  }, [visible])

  const toggleType = (type: BGPAlertType) => setHiddenTypes(prev => {
    const next = new Set(prev)
    if (next.has(type)) next.delete(type)
    else next.add(type)
    return next
  })

  return (
    <div className="bgp-stream">
      <header className="bgp-stream-head">
        <div>
          <h2><AlertTriangle size={16} aria-hidden="true" /> Changements de routage</h2>
          <p>
            {alerts ? (alerts.length === (totalCount ?? alerts.length)
              ? `${totalCount ?? alerts.length} alerte${(totalCount ?? alerts.length) > 1 ? 's' : ''} non acquittée${(totalCount ?? alerts.length) > 1 ? 's' : ''}`
              : `${alerts.length} affichée${alerts.length > 1 ? 's' : ''} sur ${totalCount} alerte${(totalCount ?? 0) > 1 ? 's' : ''} non acquittée${(totalCount ?? 0) > 1 ? 's' : ''}`)
              : error ? 'Flux indisponible · nouvel essai toutes les 30 s' : 'Flux en cours de chargement'}
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
        <div className="bgp-type-strip" role="group" aria-label="Filtrer par type de changement">
          {byType.map(({ type, count }) => (
            <button
              type="button"
              key={type}
              data-alert-type={type}
              data-empty={count === 0}
              aria-pressed={!hiddenTypes.has(type)}
              disabled={count === 0}
              onClick={() => toggleType(type)}
            >
              <i aria-hidden="true" /><span>{ALERT_LABEL[type]}</span><b>{count}</b>
            </button>
          ))}
        </div>
      )}

      {loading && !alerts && !error && (
        <div className="bgp-state" role="status" aria-live="polite">
          <Loader2 size={20} className="bgp-spin" aria-hidden="true" /><span>Chargement des données BGP…</span>
        </div>
      )}
      {error && <div className="bgp-state is-error" role="alert"><AlertCircle size={16} aria-hidden="true" /><span>{error}</span></div>}

      {!error && alerts?.length === 0 && (
        <div className="bgp-history-empty" data-state="no-alerts">
          <Clock size={22} aria-hidden="true" />
          <div>
            <h3>{totalCount === 0 ? 'Aucune alerte non acquittée' : 'Aucune alerte affichable parmi les éléments reçus'}</h3>
            <p>{totalCount === 0
              ? 'L’API exclut les alertes acquittées. Un flux vide ne prouve pas qu’aucun changement n’a eu lieu : les snapshots par ASN et leurs comparaisons restent consultables.'
              : `L’API indique ${totalCount} alerte(s) non acquittée(s), mais aucun élément reçu n’a pu être affiché. Rien n’a été acquitté ni supprimé ici.`}</p>
          </div>
          <button type="button" className="bgp-button is-primary" onClick={onOpenSnapshots}>
            <Clock size={14} aria-hidden="true" /> Consulter les snapshots
          </button>
        </div>
      )}

      {!error && alerts && alerts.length > 0 && visible.length === 0 && (
        <p className="bgp-snapshot-hint">Tous les types sont masqués par le filtre.</p>
      )}

      {!error && days.length > 0 && (
        <div className="bgp-days">
          {days.map(day => (
            <section key={day.key} className="bgp-day" aria-label={day.label}>
              <h3 className="bgp-day-label"><span>{day.label}</span><b>{day.items.length}</b></h3>
              <ol className="bgp-events">
                {day.items.map(alert => {
                  const detail = detailOf(alert)
                  const open = openId === alert.id
                  return (
                    <li key={alert.id} className="bgp-event" data-alert-type={alert.alert_type} data-open={open}>
                      <time className="bgp-event-time" dateTime={alert.detected_at} title={formatDateTime(alert.detected_at)}>{formatClock(alert.detected_at)}</time>
                      <span className="bgp-event-node" aria-hidden="true" />
                      <span className="bgp-event-type">{ALERT_LABEL[alert.alert_type] ?? alert.alert_type}</span>
                      <strong className="bgp-event-asn">AS{alert.asn}</strong>
                      <span className="bgp-event-delta">
                        {'note' in detail ? <em>{detail.note}</em> : (
                          <>
                            {detail.added > 0 && <span className="is-added">+{detail.added}</span>}
                            {detail.removed > 0 && <span className="is-removed">−{detail.removed}</span>}
                            <small>{detail.changes.map(c => c.label).join(' · ')}</small>
                          </>
                        )}
                      </span>
                      <div className="bgp-event-actions">
                        {'changes' in detail && (
                          <button type="button" className="bgp-icon-button is-labelled" aria-expanded={open} onClick={() => setOpenId(open ? null : alert.id)}>
                            <span>Détails</span><ChevronDown size={13} className="bgp-chevron" aria-hidden="true" />
                          </button>
                        )}
                        <button type="button" className="bgp-button is-quiet" onClick={() => onOpenASNSnapshots(alert.asn)} aria-label={`Snapshots de AS${alert.asn}`}>
                          <History size={13} aria-hidden="true" /> Snapshots
                        </button>
                        <button type="button" className="bgp-button is-quiet" onClick={() => navigate(`/bgp?asn=${alert.asn}`)}>
                          <Network size={13} aria-hidden="true" /> Lookup
                        </button>
                        <button type="button" className="bgp-icon-button" onClick={() => handleAck(alert.id)} disabled={ackingId === alert.id} title="Acquitter" aria-label={`Acquitter l'alerte ${alert.id}`}>
                          {ackingId === alert.id ? <Loader2 size={13} className="bgp-spin" /> : <CheckCheck size={13} />}
                        </button>
                      </div>
                      {open && 'changes' in detail && <DetailList detail={detail} />}
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
