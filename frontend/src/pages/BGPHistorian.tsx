import { useState, useEffect, useCallback } from 'react'
import {
  History, Bell, CheckCheck, Loader2, AlertCircle,
  Network, ChevronRight, X, GitCompare, RefreshCw,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { bgpApi } from '@/api/client'
import { toast } from '@/store/toast'
import type {
  BGPAlert, BGPAlertType, BGPSnapshot,
  BGPDiffResponse, BGPDiffField,
} from '@/types/bgp'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function alertLabel(type: BGPAlertType): string {
  const labels: Record<BGPAlertType, string> = {
    prefix_change: 'Changement préfixes',
    peer_change: 'Changement peers',
    upstream_change: 'Changement upstreams',
    downstream_change: 'Changement downstreams',
  }
  return labels[type] ?? type
}

function alertColor(type: BGPAlertType): string {
  const colors: Record<BGPAlertType, string> = {
    prefix_change: 'bg-red-900/30 text-red-400 border-red-500/30',
    peer_change: 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30',
    upstream_change: 'bg-orange-900/30 text-orange-400 border-orange-500/30',
    downstream_change: 'bg-blue-900/30 text-blue-400 border-blue-500/30',
  }
  return colors[type] ?? 'bg-gray-800 text-gray-400 border-gray-700'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function parseAlertPreview(alert: BGPAlert): string {
  try {
    const oldParsed = JSON.parse(alert.old_value) as Record<string, unknown>
    const newParsed = JSON.parse(alert.new_value) as Record<string, unknown>

    const oldData = (oldParsed?.data ?? oldParsed) as Record<string, unknown[]>
    const newData = (newParsed?.data ?? newParsed) as Record<string, unknown[]>

    const keys = Object.keys(newData).filter((k) => Array.isArray(newData[k]))
    if (keys.length === 0) return 'Changement détecté'

    let totalAdded = 0
    let totalRemoved = 0
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
    return parts.length > 0 ? parts.join(' / ') : 'Changement détecté'
  } catch {
    return 'Changement détecté'
  }
}

// ─────────────────────────────────────────────
// Composants génériques
// ─────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <Loader2 size={24} className="animate-spin text-cyan-400" />
    </div>
  )
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-900/20 border border-red-500/30 text-red-400 text-sm">
      <AlertCircle size={16} />
      <span>{message}</span>
    </div>
  )
}

// ─────────────────────────────────────────────
// Modal Diff
// ─────────────────────────────────────────────

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
        <div className="text-xs text-gray-400 font-mono mb-2 uppercase tracking-wide">
          {fieldName}
        </div>
        {totalChanges > DIFF_TRUNCATE_THRESHOLD ? (
          <div className="text-sm text-yellow-400 bg-yellow-900/20 px-3 py-2 rounded border border-yellow-500/30">
            Trop de changements ({totalChanges}) — affichage tronqué.
            <span className="text-gray-400 ml-2">
              +{addedCount} / -{removedCount}
            </span>
          </div>
        ) : (
          <div className="space-y-1">
            {(field.added ?? []).map((item, i) => (
              <div
                key={`add-${i}`}
                className="text-xs font-mono bg-green-900/20 text-green-300 px-2 py-1 rounded border border-green-500/20"
              >
                + {JSON.stringify(item)}
              </div>
            ))}
            {(field.removed ?? []).map((item, i) => (
              <div
                key={`rem-${i}`}
                className="text-xs font-mono bg-red-900/20 text-red-300 px-2 py-1 rounded border border-red-500/20"
              >
                - {JSON.stringify(item)}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <GitCompare size={18} className="text-cyan-400" />
            <span className="font-semibold text-gray-200">Diff Snapshots</span>
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <span className="text-red-400">#{older.id}</span>
            <ChevronRight size={12} />
            <span className="text-green-400">#{newer.id}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Dates */}
        <div className="flex gap-4 px-4 py-2 bg-gray-800/50 text-xs text-gray-500">
          <span>Ancien : {formatDate(older.created_at)}</span>
          <span>Récent : {formatDate(newer.created_at)}</span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {diff.changed_fields.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              Aucun changement détecté entre ces deux snapshots.
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                {diff.changed_fields.map((f) => (
                  <span
                    key={f}
                    className="text-xs px-2 py-0.5 rounded-full bg-cyan-400/10 text-cyan-400 border border-cyan-400/20"
                  >
                    {f}
                  </span>
                ))}
              </div>

              {Object.entries(diff.changes).map(([section, fields]) => (
                <div key={section} className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3 capitalize">
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

// ─────────────────────────────────────────────
// Section Alertes
// ─────────────────────────────────────────────

function AlertsSection() {
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState<BGPAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ackingId, setAckingId] = useState<number | null>(null)

  const loadAlerts = useCallback(() => {
    setLoading(true)
    setError(null)
    bgpApi
      .getAlerts(100, 0)
      .then((r) => setAlerts(r.items))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Erreur réseau'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadAlerts()
    // Rafraîchissement automatique toutes les 30 secondes
    const interval = setInterval(loadAlerts, 30_000)
    return () => clearInterval(interval)
  }, [loadAlerts])

  const handleAck = async (id: number) => {
    setAckingId(id)
    try {
      await bgpApi.ackAlert(id)
      setAlerts((prev) => prev.filter((a) => a.id !== id))
      toast.success('Alerte acquittée')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur acquittement')
    } finally {
      setAckingId(null)
    }
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 mb-6">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-yellow-400" />
          <h2 className="font-semibold text-gray-200">Alertes non acquittées</h2>
          {alerts.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold">
              {alerts.length}
            </span>
          )}
        </div>
        <button
          onClick={loadAlerts}
          disabled={loading}
          className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
          title="Rafraîchir"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="p-4">
        {loading && <Spinner />}
        {error && <ErrorMessage message={error} />}
        {!loading && !error && alerts.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-6">
            <CheckCheck size={24} className="mx-auto mb-2 text-green-500 opacity-60" />
            Aucune alerte — tout est à jour !
          </div>
        )}
        {!loading && !error && alerts.length > 0 && (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`rounded-lg border p-4 ${alertColor(alert.alert_type)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">
                        {alertLabel(alert.alert_type)}
                      </span>
                      <button
                        onClick={() => navigate(`/bgp?asn=${alert.asn}`)}
                        className="text-xs font-mono bg-gray-900/50 px-2 py-0.5 rounded hover:underline"
                      >
                        AS{alert.asn}
                      </button>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {formatDate(alert.detected_at)}
                    </div>
                    <div className="text-xs mt-1.5 opacity-80">
                      Aperçu : {parseAlertPreview(alert)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleAck(alert.id)}
                    disabled={ackingId === alert.id}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 text-xs transition-colors disabled:opacity-50 shrink-0"
                  >
                    {ackingId === alert.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <CheckCheck size={12} />
                    )}
                    Acquitter
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Section Snapshots
// ─────────────────────────────────────────────

function SnapshotsSection() {
  const [asnInput, setAsnInput] = useState('')
  const [currentASN, setCurrentASN] = useState<number | null>(null)
  const [snapshots, setSnapshots] = useState<BGPSnapshot[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sélection pour comparaison
  const [selected, setSelected] = useState<number[]>([])

  // Diff modal
  const [diffResponse, setDiffResponse] = useState<BGPDiffResponse | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)

  const loadSnapshots = useCallback(async (asn: number) => {
    setLoading(true)
    setError(null)
    setSnapshots([])
    setSelected([])
    try {
      const res = await bgpApi.getSnapshots(asn, 50, 0)
      setSnapshots(res.items)
      setTotal(res.total)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleLoad = () => {
    const asn = parseInt(asnInput.replace(/^AS/i, '').trim(), 10)
    if (isNaN(asn) || asn <= 0) {
      toast.error('ASN invalide')
      return
    }
    setCurrentASN(asn)
    loadSnapshots(asn)
  }

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return [prev[1], id] // Remplace le premier
      return [...prev, id]
    })
  }

  const handleCompare = async () => {
    if (selected.length < 2 || currentASN === null) return
    const [a, b] = selected.sort((x, y) => x - y) // older = plus petit ID
    setDiffLoading(true)
    try {
      const res = await bgpApi.getDiff(currentASN, a, b)
      setDiffResponse(res)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur diff')
    } finally {
      setDiffLoading(false)
    }
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700">
      <div className="flex items-center gap-2 p-4 border-b border-gray-700">
        <History size={16} className="text-cyan-400" />
        <h2 className="font-semibold text-gray-200">Snapshots</h2>
      </div>

      <div className="p-4">
        {/* Input ASN */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={asnInput}
            onChange={(e) => setAsnInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLoad()}
            placeholder="Ex: 13335 ou AS13335"
            className="flex-1 px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-gray-200 text-sm focus:outline-none focus:border-cyan-500 placeholder-gray-600"
          />
          <button
            onClick={handleLoad}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-cyan-500 text-gray-900 font-semibold text-sm hover:bg-cyan-400 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Network size={14} />}
            Charger
          </button>
        </div>

        {loading && <Spinner />}
        {error && <ErrorMessage message={error} />}

        {!loading && !error && currentASN !== null && snapshots.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-8">
            Aucun snapshot pour AS{currentASN}.
            <br />
            <span className="text-xs">
              Allez sur BGP Lookup et cliquez sur "Prendre un snapshot".
            </span>
          </div>
        )}

        {!loading && !error && snapshots.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-gray-500">
                {total} snapshot(s) — AS{currentASN}
              </div>
              {selected.length === 2 && (
                <button
                  onClick={handleCompare}
                  disabled={diffLoading}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-colors text-sm disabled:opacity-50"
                >
                  {diffLoading ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <GitCompare size={13} />
                  )}
                  Comparer les sélectionnés
                </button>
              )}
            </div>

            {selected.length > 0 && selected.length < 2 && (
              <div className="text-xs text-cyan-400/70 mb-2">
                Sélectionnez un 2ème snapshot pour comparer.
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 px-3 text-gray-400 font-medium w-10">
                      <span className="sr-only">Sélection</span>
                    </th>
                    <th className="text-left py-2 px-3 text-gray-400 font-medium">ID</th>
                    <th className="text-left py-2 px-3 text-gray-400 font-medium">Date</th>
                    <th className="text-left py-2 px-3 text-gray-400 font-medium">Par</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((snap, idx) => {
                    const isSelected = selected.includes(snap.id)
                    const hasChange = idx < snapshots.length - 1 // placeholder indicateur
                    return (
                      <tr
                        key={snap.id}
                        className={`border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors cursor-pointer ${
                          isSelected ? 'bg-cyan-400/5' : ''
                        }`}
                        onClick={() => toggleSelect(snap.id)}
                      >
                        <td className="py-2 px-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(snap.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-gray-600 text-cyan-400 focus:ring-cyan-400 bg-gray-900"
                          />
                        </td>
                        <td className="py-2 px-3 font-mono text-gray-400 text-xs">
                          #{snap.id}
                        </td>
                        <td className="py-2 px-3 text-gray-300 text-xs">
                          <div>{formatDate(snap.created_at)}</div>
                          {hasChange && idx === 0 && (
                            <span className="text-green-400 text-xs">● Dernier</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-gray-500 text-xs">{snap.taken_by}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {diffResponse && (
        <DiffModal diffResponse={diffResponse} onClose={() => setDiffResponse(null)} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Page principale BGPHistorian
// ─────────────────────────────────────────────

export default function BGPHistorian() {
  const navigate = useNavigate()

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-cyan-400/10">
          <History size={22} className="text-cyan-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-100">BGP Historian</h1>
          <p className="text-xs text-gray-500">Historique des snapshots et détection de changements</p>
        </div>
        <button
          onClick={() => navigate('/bgp')}
          className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors text-sm"
        >
          <Network size={14} />
          BGP Lookup
        </button>
      </div>

      {/* Alertes (en haut) */}
      <AlertsSection />

      {/* Snapshots (en bas) */}
      <SnapshotsSection />
    </div>
  )
}
