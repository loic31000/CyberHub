import { useState, useEffect, useCallback } from 'react'
import {
  History, CheckCheck, Loader2, AlertCircle,
  Network, ChevronRight, X, GitCompare, RefreshCw, Clock, AlertTriangle, Trash2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { bgpApi } from '@/api/client'
import { toast } from '@/store/toast'
import type {
  BGPAlert, BGPAlertType, BGPSnapshot,
  BGPDiffResponse, BGPDiffField,
} from '@/types/bgp'

function alertLabel(type: BGPAlertType): string {
  const labels: Record<BGPAlertType, string> = {
    prefix_change: 'Changement préfixes',
    peer_change: 'Changement peers',
    upstream_change: 'Changement upstreams',
    downstream_change: 'Changement downstreams',
  }
  return labels[type] ?? type
}

function alertSeverityStyle(type: BGPAlertType): { border: string; text: string; bg: string } {
  const styles: Record<BGPAlertType, { border: string; text: string; bg: string }> = {
    prefix_change:    { border: 'border-[#ef4444]', text: 'text-[#ef4444]', bg: 'bg-[#ef4444]/5' },
    peer_change:      { border: 'border-[#f59e0b]', text: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/5' },
    upstream_change:  { border: 'border-[#f97316]', text: 'text-[#f97316]', bg: 'bg-[#f97316]/5' },
    downstream_change:{ border: 'border-[#3b82f6]', text: 'text-[#3b82f6]', bg: 'bg-[#3b82f6]/5' },
  }
  return styles[type] ?? { border: 'border-[#4a6480]', text: 'text-[#8a9ab0]', bg: 'bg-[#1e2d40]' }
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
    <div className="flex items-center justify-center py-10">
      <Loader2 size={24} className="animate-spin text-[#00d4ff]" />
    </div>
  )
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 p-3 border-l-2 border-[#ef4444] bg-[#ef4444]/5 text-[#ef4444] font-mono text-xs">
      <AlertCircle size={14} />
      <span>{message}</span>
    </div>
  )
}

const DIFF_TRUNCATE_THRESHOLD = 50

interface DiffModalProps {
  diffResponse: BGPDiffResponse
  onClose: () => void
}

function DiffModal({ diffResponse, onClose }: DiffModalProps) {
  const { diff, older, newer } = diffResponse

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
              <div key={`add-${i}`} className="text-xs font-mono bg-[#10b981]/10 text-[#10b981] px-2 py-1 border-l-2 border-[#10b981]">
                + {JSON.stringify(item)}
              </div>
            ))}
            {(field.removed ?? []).map((item, i) => (
              <div key={`rem-${i}`} className="text-xs font-mono bg-[#ef4444]/10 text-[#ef4444] px-2 py-1 border-l-2 border-[#ef4444]">
                - {JSON.stringify(item)}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-[#06080f] border border-[#1e2d40] w-full max-w-3xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#1e2d40] bg-[#0a0f16]">
          <div className="flex items-center gap-2">
            <GitCompare size={16} className="text-[#00d4ff]" />
            <span className="font-mono font-bold text-xs uppercase tracking-widest text-[#f1f5f9]">Differential Engine</span>
          </div>
          <div className="text-[10px] text-[#4a6480] font-mono flex items-center gap-2">
            <span className="text-[#ef4444]">#{older.id}</span>
            <ChevronRight size={12} />
            <span className="text-[#10b981]">#{newer.id}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#1e2d40] text-[#4a6480] hover:text-[#f1f5f9] transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="flex gap-4 px-4 py-2 bg-[#0a0f16]/50 border-b border-[#1e2d40] text-[10px] font-mono text-[#4a6480]">
          <span>OLDER: {formatDate(older.created_at)}</span>
          <span>NEWER: {formatDate(newer.created_at)}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
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
      </div>
    </div>
  )
}

function AlertsSection() {
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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-mono font-bold text-[#ef4444] flex items-center gap-2 uppercase tracking-widest">
          <AlertTriangle size={14} /> CRITICAL_EVENTS_STREAM
          {alerts.length > 0 && (
            <span className="px-2 py-0.5 bg-[#ef4444] text-white text-[9px] font-bold animate-pulse">
              {alerts.length} ACTIVE
            </span>
          )}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={purgeCorruptedAlerts}
            disabled={purging}
            className="p-1.5 hover:bg-[#ef4444]/10 text-[#ef4444] hover:text-[#ef4444] transition-colors rounded"
            title="Purger les alertes corrompues (dates invalides)"
          >
            {purging ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          </button>
          <button onClick={loadAlerts} disabled={loading} className="p-1.5 hover:bg-[#1e2d40] text-[#4a6480] hover:text-[#8a9ab0] transition-colors" title="Rafraîchir">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading && <Spinner />}
      {error && <ErrorMessage message={error} />}

      {!loading && !error && alerts.length === 0 && (
        <div className="text-center font-mono text-[10px] text-[#4a6480] py-6 flex flex-col items-center gap-2 uppercase tracking-widest">
          <CheckCheck size={20} className="text-[#10b981]" />
          No active threats detected
        </div>
      )}

      {!loading && !error && alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map(alert => {
            const style = alertSeverityStyle(alert.alert_type)
            return (
              <div key={alert.id} className={`flex items-center justify-between p-3 border-l-2 font-mono text-[11px] ${style.border} ${style.text} ${style.bg}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="opacity-60 shrink-0">[{formatDate(alert.detected_at)}]</span>
                  <span className="font-bold uppercase shrink-0">{alertLabel(alert.alert_type)}</span>
                  <span className="opacity-60">➔</span>
                  <span className="font-bold">AS{alert.asn}</span>
                  <span className="opacity-50 text-[9px] truncate">{parseAlertPreview(alert)}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <button onClick={() => navigate(`/bgp?asn=${alert.asn}`)} className="text-[9px] font-mono font-bold uppercase hover:underline opacity-70 hover:opacity-100 flex items-center gap-1">
                    <Network size={10} /> Investigate
                  </button>
                  <button onClick={() => handleAck(alert.id)} disabled={ackingId === alert.id} className="p-1 hover:bg-white/10 transition-colors opacity-70 hover:opacity-100" title="Acquitter">
                    {ackingId === alert.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SnapshotsSection() {
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
      {diffResponse && <DiffModal diffResponse={diffResponse} onClose={() => setDiffResponse(null)} />}

      <div className="flex gap-0 mb-6">
        <input
          type="text"
          value={asnInput}
          onChange={e => setAsnInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLoad()}
          placeholder="ENTER ASN... (ex: 13335)"
          className="flex-1 bg-[#0d131f] border border-[#1e2d40] px-4 py-3 font-mono text-sm text-[#f1f5f9] placeholder-[#334155] uppercase tracking-widest focus:outline-none focus:border-[#00d4ff]/50"
        />
        <button onClick={handleLoad} disabled={loading} className="bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 text-[#00d4ff] px-6 border border-l-0 border-[#1e2d40] text-xs font-mono font-bold uppercase tracking-widest transition-colors disabled:opacity-50 flex items-center gap-2">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Network size={14} />}
          LOAD
        </button>
      </div>

      {loading && <Spinner />}
      {error && <ErrorMessage message={error} />}

      {!loading && !error && currentASN !== null && snapshots.length === 0 && (
        <div className="text-center font-mono text-[10px] text-[#4a6480] py-10 uppercase tracking-widest">
          No valid snapshots for AS{currentASN} — take one from BGP Lookup.
        </div>
      )}

      {!loading && !error && snapshots.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono text-[#4a6480] uppercase tracking-widest">
              {total} SNAPSHOT(S) — AS{currentASN}
            </span>
            {selected.length === 2 && (
              <button onClick={handleCompare} disabled={diffLoading} className="flex items-center gap-2 px-3 py-1.5 bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/20 text-[10px] font-mono font-bold uppercase tracking-widest transition-colors disabled:opacity-50">
                {diffLoading ? <Loader2 size={10} className="animate-spin" /> : <GitCompare size={10} />}
                INITIALIZE_DIFF
              </button>
            )}
            {selected.length === 1 && (
              <span className="text-[10px] font-mono text-[#00d4ff]/60 uppercase tracking-widest">
                Select a 2nd snapshot to diff
              </span>
            )}
          </div>

          <div className="space-y-2">
            {snapshots.map((snap, idx) => {
              const isSelected = selected.includes(snap.id)
              const isLatest = idx === 0
              return (
                <div key={snap.id} onClick={() => toggleSelect(snap.id)} className={`group flex items-center gap-3 p-3 border cursor-pointer transition-all font-mono text-xs ${
                  isSelected
                    ? 'border-[#00d4ff]/50 bg-[#00d4ff]/5 text-[#00d4ff]'
                    : 'border-[#1e2d40] bg-[#0d131f] hover:border-[#00d4ff]/30 text-[#8a9ab0]'
                }`}>
                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(snap.id)} onClick={e => e.stopPropagation()} className="rounded border-[#4a6480] text-[#00d4ff] focus:ring-[#00d4ff] bg-[#06080f]" />
                  <span className="text-[#4a6480] text-[9px]">#{snap.id}</span>
                  <Clock size={10} className="text-[#4a6480]" />
                  <span>{formatDate(snap.created_at)}</span>
                  {isLatest && <span className="text-[9px] text-[#10b981]">● LATEST</span>}
                  <span className="ml-auto text-[9px] text-[#4a6480]">{snap.taken_by}</span>
                </div>
              )
            })}
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
    <div className="flex flex-col h-full bg-[#06080f] text-[#f1f5f9]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d40] bg-[#0a0f16]/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <History className="text-[#00d4ff]" size={20} />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#10b981] rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase">BGP HISTORIAN // LOG</h1>
            <p className="text-[10px] text-[#64748b] font-mono">Routing History Log — Temporal Snapshots &amp; Critical Events</p>
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px]">
          <span className="text-[#64748b]">STATUS</span>
          <span className="text-[#10b981]">ACTIVE</span>
          <button onClick={() => navigate('/bgp')} className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2d40] hover:bg-[#2a3f55] text-[10px] font-bold border border-[#334155] transition-colors">
            <Network size={12} /> BGP_LOOKUP
          </button>
        </div>
      </div>

      <div className="flex border-b border-[#1e2d40] bg-[#0a0f16]/50">
        {[
          { id: 'alerts' as const,    label: 'CRITICAL_EVENTS_STREAM', icon: <AlertTriangle size={12} /> },
          { id: 'snapshots' as const, label: 'TEMPORAL_SNAPSHOTS',     icon: <Clock size={12} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-[10px] font-mono font-bold uppercase tracking-widest border-b-2 transition-colors ${
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

      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'alerts' && <AlertsSection />}
        {activeTab === 'snapshots' && <SnapshotsSection />}
      </div>
    </div>
  )
}