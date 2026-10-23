import { useState, useEffect, useCallback, useRef } from 'react'
import {
  CheckCheck, Loader2, AlertCircle,
  Network, ChevronRight, X, GitCompare, RefreshCw, Clock, AlertTriangle, Trash2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { bgpApi } from '@/api/client'
import { toast } from '@/store/toast'
import { ModuleHero } from '@/hero/ModuleHero'
import type {
  BGPAlert, BGPAlertType, BGPSnapshot,
  BGPDiffResponse, BGPDiffField,
} from '@/types/bgp'
import './bgp-console.css'

function alertLabel(type: BGPAlertType): string {
  const labels: Record<BGPAlertType, string> = {
    prefix_change: 'Changement préfixes',
    peer_change: 'Changement peers',
    upstream_change: 'Changement upstreams',
    downstream_change: 'Changement downstreams',
  }
  return labels[type] ?? type
}

function formatDate(iso: string): string {
  try {
    const date = new Date(iso)
    if (isNaN(date.getTime())) throw new Error('Invalid date')
    return date.toLocaleString('fr-FR', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return 'Date inconnue'
  }
}

function parseAlertPreview(alert: BGPAlert): string {
  try {
    if (!alert.old_value || !alert.new_value) return 'Données manquantes'
    const oldParsed = JSON.parse(alert.old_value) as Record<string, unknown>
    const newParsed = JSON.parse(alert.new_value) as Record<string, unknown>
    const oldData = (oldParsed?.data ?? oldParsed) as Record<string, unknown[]>
    const newData = (newParsed?.data ?? newParsed) as Record<string, unknown[]>
    const keys = Object.keys(newData).filter((k) => Array.isArray(newData[k]))
    if (keys.length === 0) return 'Changement générique'
    let totalAdded = 0; let totalRemoved = 0
    for (const k of keys) {
      const oldArr = (oldData[k] as unknown[]) ?? []
      const newArr = newData[k] as unknown[]
      const added = newArr.length - oldArr.length
      if (added > 0) totalAdded += added
      else totalRemoved += Math.abs(added)
    }
    const parts: string[] = []
    if (totalAdded > 0) parts.push(`+${totalAdded}`)
    if (totalRemoved > 0) parts.push(`-${totalRemoved}`)
    return parts.length > 0 ? parts.join(' / ') : 'Changement indéterminé'
  } catch {
    return 'Erreur de parsing (données corrompues ?)'
  }
}

function Spinner() {
  return (
    <div className="bgp-state bgp-state--loading" role="status" aria-live="polite">
      <Loader2 size={22} aria-hidden="true" />
      <span>Chargement des données BGP…</span>
    </div>
  )
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="bgp-state bgp-state--error" role="alert">
      <AlertCircle size={14} aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

const DIFF_TRUNCATE_THRESHOLD = 50

interface DiffModalProps {
  diffResponse: BGPDiffResponse
  onClose: () => void
}

function DiffPanel({ diffResponse, onClose }: DiffModalProps) {
  const { diff, older, newer } = diffResponse
  const dialogRef = useRef<HTMLElement>(null)
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

  const renderField = (fieldName: string, field: BGPDiffField) => {
    const addedCount = field.added?.length ?? 0
    const removedCount = field.removed?.length ?? 0
    const totalChanges = addedCount + removedCount

    return (
      <div key={fieldName} className="mb-4">
        <div className="text-[9px] font-mono text-[#4a6480] uppercase tracking-widest mb-2">
          {fieldName}
        </div>
        {totalChanges > DIFF_TRUNCATE_THRESHOLD ? (
          <div className="text-xs font-mono text-[#f59e0b] bg-[#f59e0b]/10 px-3 py-2 border-l-2 border-[#f59e0b]">
            Trop de changements ({totalChanges}) — affichage tronqué.{' '}
            <span className="text-[#4a6480]">+{addedCount} / -{removedCount}</span>
          </div>
        ) : (
          <div className="space-y-1">
            {(field.added ?? []).map((item, i) => (
              <div key={`add-${i}`} className="bgp-diff-change bgp-diff-change--added">
                + {typeof item === 'string' ? item : JSON.stringify(item)}
              </div>
            ))}
            {(field.removed ?? []).map((item, i) => (
              <div key={`rem-${i}`} className="bgp-diff-change bgp-diff-change--removed">
                - {typeof item === 'string' ? item : JSON.stringify(item)}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <section ref={dialogRef} className="bgp-diff-panel" role="region" aria-labelledby="bgp-diff-title" tabIndex={-1}>
        <div className="flex items-center justify-between p-4 border-b border-[#1e2d40] bg-[#0a0f16]">
          <div className="flex items-center gap-2">
            <GitCompare size={16} className="text-[#00d4ff]" />
            <h2 id="bgp-diff-title" className="font-mono font-bold text-xs uppercase tracking-widest text-[#f1f5f9]">Comparaison des snapshots</h2>
          </div>
          <div className="text-[10px] text-[#4a6480] font-mono flex items-center gap-2">
            <span className="text-[#ef4444]">#{older.id}</span>
            <ChevronRight size={12} />
            <span className="text-[#10b981]">#{newer.id}</span>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="p-1 hover:bg-[#1e2d40] text-[#4a6480] hover:text-[#f1f5f9] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]" aria-label="Fermer">
            <X size={16} />
          </button>
        </div>
        <div className="bgp-diff-meta">
          <div className="bgp-diff-state" data-state="before">
            <span>AVANT · #{older.id}</span>
            <time dateTime={older.created_at}>{formatDate(older.created_at)}</time>
          </div>
          <ChevronRight size={14} aria-hidden="true" />
          <div className="bgp-diff-state" data-state="after">
            <span>APRÈS · #{newer.id}</span>
            <time dateTime={newer.created_at}>{formatDate(newer.created_at)}</time>
          </div>
        </div>
        <div className="bgp-diff-panel-body">
          {diff.changed_fields.length === 0 ? (
            <div className="text-center font-mono text-xs text-[#4a6480] py-8 uppercase tracking-widest">
              No changes detected between these snapshots.
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                {diff.changed_fields.map(f => (
                  <span key={f} className="text-[9px] font-mono px-2 py-0.5 bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/20 uppercase tracking-widest">
                    {f}
                  </span>
                ))}
              </div>
              {Object.entries(diff.changes).map(([section, fields]) => (
                <div key={section} className="mb-6">
                  <h3 className="text-[10px] font-mono font-bold text-[#8a9ab0] mb-3 uppercase tracking-widest border-b border-[#1e2d40] pb-2">
                    {section}
                  </h3>
                  {Object.entries(fields as Record<string, BGPDiffField>).map(
                    ([fieldName, field]) => renderField(fieldName, field),
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
    </section>
  )
}

function AlertsSection({ onOpenSnapshots }: { onOpenSnapshots: () => void }) {
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState<BGPAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ackingId, setAckingId] = useState<number | null>(null)
  const [purging, setPurging] = useState(false)

  const loadAlerts = useCallback(() => {
    setLoading(true)
    setError(null)
    bgpApi.getAlerts(100, 0)
      .then(r => {
        const validAlerts = r.items.filter(alert => {
          try {
            const d = new Date(alert.detected_at)
            return !isNaN(d.getTime())
          } catch {
            return false
          }
        })
        setAlerts(validAlerts)
        if (validAlerts.length !== r.items.length) {
          const skipped = r.items.length - validAlerts.length
          console.warn(`${skipped} alerte(s) ignorée(s) à cause d'une date invalide`)
        }
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Erreur réseau'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadAlerts()
    const interval = setInterval(loadAlerts, 30000)
    return () => clearInterval(interval)
  }, [loadAlerts])

  const handleAck = async (id: number) => {
    setAckingId(id)
    try {
      await bgpApi.ackAlert(id)
      setAlerts(prev => prev.filter(a => a.id !== id))
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
      const corrupted = res.items.filter(alert => {
        try {
          const d = new Date(alert.detected_at)
          return isNaN(d.getTime())
        } catch {
          return true
        }
      })
      if (corrupted.length === 0) {
        toast.info('Aucune alerte corrompue trouvée')
        return
      }
      let count = 0
      for (const alert of corrupted) {
        await bgpApi.ackAlert(alert.id)
        count++
      }
      toast.success(`${count} alerte(s) corrompue(s) purgée(s)`)
      loadAlerts()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de la purge')
    } finally {
      setPurging(false)
    }
  }

  return (
    <div>
      <div className="bgp-section-heading">
        <h2>
          <AlertTriangle size={16} aria-hidden="true" /> Changements de routage
          {alerts.length > 0 && (
            <span className="bgp-count-badge">
              {alerts.length} alerte{alerts.length > 1 ? 's' : ''}
            </span>
          )}
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={purgeCorruptedAlerts}
            disabled={purging}
            className="bgp-icon-button"
            title="Purger les alertes corrompues (dates invalides)"
            aria-label="Supprimer les alertes corrompues"
          >
            {purging ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          </button>
          <button type="button" onClick={loadAlerts} disabled={loading} className="bgp-icon-button" title="Rafraîchir" aria-label="Actualiser">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading && <Spinner />}
      {error && <ErrorMessage message={error} />}

      {!loading && !error && alerts.length === 0 && (
        <div className="bgp-history-empty" data-state="no-alerts">
          <div className="bgp-history-empty-index" aria-hidden="true">01 <span>/ 02</span></div>
          <div className="bgp-history-empty-copy">
            <span className="bgp-kicker">FLUX D’ALERTES</span>
            <h3>Aucune alerte retournée</h3>
            <p>L’API ne rapporte pas d’alerte active. Cela ne permet pas de conclure qu’aucun snapshot n’existe : les deux historiques se consultent séparément.</p>
          </div>
          <div className="bgp-history-empty-actions">
            <button type="button" className="bgp-button bgp-button--primary" onClick={onOpenSnapshots}>
              <Clock size={14} aria-hidden="true" /> Consulter les snapshots
            </button>
            <span>La liste demande un ASN.</span>
          </div>
        </div>
      )}

      {!loading && !error && alerts.length > 0 && (
        <div className="bgp-alert-list bgp-event-stream">
          {alerts.map(alert => {
            return (
              <article key={alert.id} className="bgp-alert-row" data-alert-type={alert.alert_type}>
                <div className="bgp-event-time">
                  <span className="bgp-event-node" aria-hidden="true" />
                  <time className="bgp-alert-time" dateTime={alert.detected_at}>{formatDate(alert.detected_at)}</time>
                </div>
                <div className="bgp-alert-main">
                  <span className="bgp-alert-type">{alertLabel(alert.alert_type)}</span>
                  <strong>AS{alert.asn}</strong>
                  <span className="bgp-alert-preview">{parseAlertPreview(alert)}</span>
                </div>
                <div className="bgp-alert-actions">
                  <button type="button" onClick={() => navigate(`/bgp?asn=${alert.asn}`)} className="bgp-button">
                    <Network size={13} aria-hidden="true" /> Lookup
                  </button>
                  <button type="button" onClick={() => handleAck(alert.id)} disabled={ackingId === alert.id} className="bgp-icon-button" title="Acquitter" aria-label={`Acquitter l'alerte ${alert.id}`}>
                    {ackingId === alert.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SnapshotsSection() {
  const navigate = useNavigate()
  const [asnInput, setAsnInput] = useState('')
  const [currentASN, setCurrentASN] = useState<number | null>(null)
  const [snapshots, setSnapshots] = useState<BGPSnapshot[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [diffResponse, setDiffResponse] = useState<BGPDiffResponse | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)

  const loadSnapshots = useCallback(async (asn: number) => {
    setLoading(true)
    setError(null)
    setSnapshots([])
    setSelected([])
    try {
      const res = await bgpApi.getSnapshots(asn, 50, 0)
      const validSnapshots = res.items.filter(s => {
        try {
          const d = new Date(s.created_at)
          return !isNaN(d.getTime())
        } catch {
          return false
        }
      })
      setSnapshots(validSnapshots)
      setTotal(validSnapshots.length)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleLoad = () => {
    const asn = parseInt(asnInput.replace(/^AS/i, '').trim(), 10)
    if (isNaN(asn) || asn <= 0) { toast.error('ASN invalide'); return }
    setCurrentASN(asn)
    loadSnapshots(asn)
  }

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }

  const handleCompare = async () => {
    if (selected.length < 2 || currentASN === null) return
    const [a, b] = selected.sort((x, y) => x - y)
    setDiffLoading(true)
    try {
      const res = await bgpApi.getDiff(currentASN, a, b)
      setDiffResponse(res)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur diff')
    } finally {
      setDiffLoading(false)
    }
  }

  return (
    <div>
      <form className="bgp-snapshot-toolbar" onSubmit={event => { event.preventDefault(); handleLoad() }}>
        <div className="bgp-query-field">
          <label htmlFor="bgp-historian-asn">Numéro ASN</label>
        <input
          id="bgp-historian-asn"
          type="text"
          value={asnInput}
          onChange={e => setAsnInput(e.target.value)}
          placeholder="13335 ou AS13335"
          className="bgp-query-input"
        />
        </div>
        <button type="submit" disabled={loading} className="bgp-button bgp-button--primary">
          {loading ? <Loader2 size={14} aria-hidden="true" /> : <Network size={14} aria-hidden="true" />}
          Charger l’historique
        </button>
      </form>

      {loading && <Spinner />}
      {error && <ErrorMessage message={error} />}

      {!loading && !error && currentASN !== null && snapshots.length === 0 && (
        <div className="bgp-history-empty" data-state="no-snapshots">
          <div className="bgp-history-empty-index" aria-hidden="true">02 <span>/ 02</span></div>
          <div className="bgp-history-empty-copy">
            <span className="bgp-kicker">AS{currentASN} · SNAPSHOTS</span>
            <h3>Aucun snapshot retourné</h3>
            <p>L’API n’a renvoyé aucun snapshot pour cet ASN. Les alertes restent consultables dans leur propre vue.</p>
          </div>
          <div className="bgp-history-empty-actions">
            <button type="button" className="bgp-button" onClick={() => navigate(`/bgp?asn=${currentASN}`)}>Ouvrir dans BGP Lookup</button>
            <span>Un snapshot peut être créé depuis la fiche ASN.</span>
          </div>
        </div>
      )}

      {!loading && !error && snapshots.length > 0 && (
        <>
          <div className="bgp-snapshot-summary">
            <span className="bgp-tab-count">
              {total} snapshot(s) · AS{currentASN}
            </span>
            {selected.length === 2 && (
              <button type="button" onClick={handleCompare} disabled={diffLoading} className="bgp-button bgp-button--primary">
                {diffLoading ? <Loader2 size={14} aria-hidden="true" /> : <GitCompare size={14} aria-hidden="true" />}
                Comparer les snapshots
              </button>
            )}
            {selected.length === 1 && (
              <span className="bgp-query-help">
                Sélectionnez un second snapshot pour comparer
              </span>
            )}
          </div>

          <div className={`bgp-timeline-workspace${diffResponse ? ' is-comparing' : ''}`}>
            <div className="bgp-timeline-column">
              <div className="bgp-timeline-heading">
                <h3>Chronologie des observations</h3>
                <span>Sélectionnez deux états pour comparer</span>
              </div>
              <div className="bgp-timeline" aria-label="Chronologie des snapshots">
                {snapshots.map((snap, idx) => {
                  const isSelected = selected.includes(snap.id)
                  const isLatest = idx === 0
                  return (
                    <label key={snap.id} className="bgp-snapshot-item" data-selected={isSelected} data-latest={isLatest}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(snap.id)} aria-label={`Comparer le snapshot ${snap.id}`} />
                      <span className="bgp-snapshot-node" aria-hidden="true" />
                      <span className="bgp-snapshot-id">#{snap.id}</span>
                      <div className="bgp-snapshot-copy">
                        <time dateTime={snap.created_at}>{formatDate(snap.created_at)}</time>
                        <span>Capturé par {snap.taken_by || '—'}</span>
                      </div>
                      {isLatest && <span className="bgp-latest-badge">Le plus récent</span>}
                    </label>
                  )
                })}
              </div>
            </div>
            {diffResponse && <DiffPanel diffResponse={diffResponse} onClose={() => setDiffResponse(null)} />}
          </div>
        </>
      )}
    </div>
  )
}

export default function BGPHistorian() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'snapshots' | 'alerts'>('alerts')

  return (
    <div className="bgp-console bgp-historian">
      <header className="bgp-page-head">
        <ModuleHero breadcrumb="NETWORK / ROUTING INTELLIGENCE" title="BGP" accent="HISTORIAN"
          subtitle="Routing Timeline — Suivre alertes, snapshots et différences dans le temps."
          typeOnce="bgp-historian"
          index={{ label: 'ROUTING TIMELINE', lines: ['ALERTES', 'SNAPSHOTS', 'COMPARAISON'] }} />
        <div className="bgp-module-actions">
          <button type="button" onClick={() => navigate('/bgp')} className="bgp-button">
            <Network size={14} aria-hidden="true" /> BGP Lookup
          </button>
        </div>
      </header>

      <div className="bgp-content">
      <div className="bgp-main-tabs" role="group" aria-label="Sections de BGP Historian">
        {[
          { id: 'alerts' as const,    label: 'Alertes', icon: <AlertTriangle size={14} /> },
          { id: 'snapshots' as const, label: 'Snapshots', icon: <Clock size={14} /> },
        ].map(tab => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            aria-pressed={activeTab === tab.id}
            className="bgp-main-tab"
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <section className="bgp-panel bgp-panel-body bgp-historian-content" aria-label={activeTab === 'alerts' ? 'Changements de routage' : 'Snapshots BGP'}>
        {activeTab === 'alerts' && <AlertsSection onOpenSnapshots={() => setActiveTab('snapshots')} />}
        {activeTab === 'snapshots' && <SnapshotsSection />}
      </section>
      </div>
    </div>
  )
}
