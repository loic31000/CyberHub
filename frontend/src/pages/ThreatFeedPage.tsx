import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  ShieldAlert,
  Rss,
  ExternalLink,
} from 'lucide-react'
import { threatApi } from '@/api/client'
import type { ThreatFeedLog, FeedStatus } from '@/types/threat'
import type { CVEEntry } from '@/types'
import { useToastStore } from '@/store/useToastStore'

const addToast = (msg: string, type: 'success' | 'error' | 'warning' | 'info') =>
  useToastStore.getState().add(type, msg)

const FEED_LABELS: Record<string, string> = {
  cisa_kev: 'CISA KEV',
  nvd_api: 'NVD API v2',
}

const FEED_DESCRIPTIONS: Record<string, string> = {
  cisa_kev:
    'Known Exploited Vulnerabilities Catalog — CISA. Vulnérabilités activement exploitées in-the-wild.',
  nvd_api:
    'National Vulnerability Database — NIST. CVE des 7 derniers jours avec scores CVSS officiels.',
}

function StatusBadge({ status }: { status: FeedStatus }) {
  if (status === 'ok')
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">
        <CheckCircle2 size={12} /> OK
      </span>
    )
  if (status === 'running')
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
        <Loader2 size={12} className="animate-spin" /> En cours
      </span>
    )
  if (status === 'error')
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">
        <XCircle size={12} /> Erreur
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-border text-text-muted">
      <Clock size={12} /> En attente
    </span>
  )
}

function formatDate(iso: string) {
  if (!iso || iso.startsWith('0001')) return '—'
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function severityColor(s: string) {
  switch (s) {
    case 'critical': return 'text-red-400 bg-red-500/10'
    case 'high':     return 'text-orange-400 bg-orange-500/10'
    case 'medium':   return 'text-yellow-400 bg-yellow-500/10'
    case 'low':      return 'text-blue-400 bg-blue-500/10'
    default:         return 'text-text-muted bg-bg-hover'
  }
}

export default function ThreatFeedPage() {
  const navigate = useNavigate()
  const [feeds, setFeeds] = useState<ThreatFeedLog[]>([])
  const [alerts, setAlerts] = useState<CVEEntry[]>([])
  const [alertCount, setAlertCount] = useState(0)
  const [alertSince, setAlertSince] = useState('')
  const [loading, setLoading] = useState(true)
  const [runningFeed, setRunningFeed] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [feedData, alertData] = await Promise.all([
        threatApi.feeds(),
        threatApi.alerts(),
      ])
      setFeeds(feedData)
      setAlerts(alertData.alerts)
      setAlertCount(alertData.count)
      setAlertSince(alertData.since)
    } catch {
      // Silently keep current data on network error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 10_000) // poll every 10s to catch feed updates
    return () => clearInterval(interval)
  }, [refresh])

  const handleRun = async (name: 'cisa_kev' | 'nvd_api') => {
    setRunningFeed(name)
    try {
      await threatApi.runFeed(name)
      addToast(`Feed ${FEED_LABELS[name]} lancé en arrière-plan`, 'info')
      // Refresh after short delay to show "running" status
      setTimeout(refresh, 1500)
    } catch {
      addToast(`Erreur lors du lancement du feed ${FEED_LABELS[name]}`, 'error')
    } finally {
      setRunningFeed(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted">
        <Loader2 size={24} className="animate-spin mr-2" />
        Chargement…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Rss size={20} className="text-cyber-cyan" />
            Threat Intelligence
          </h1>
          <p className="text-text-muted text-sm mt-0.5">
            Feeds CVE automatiques — NVD API &amp; CISA KEV · Rafraîchissement hebdomadaire
          </p>
        </div>
        <button
          onClick={refresh}
          className="btn-secondary flex items-center gap-2 text-sm"
          title="Rafraîchir"
        >
          <RefreshCw size={14} />
          Actualiser
        </button>
      </div>

      {/* Feed cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['cisa_kev', 'nvd_api'] as const).map((name) => {
          const feed = feeds.find((f) => f.feed_name === name)
          const isRunning = runningFeed === name || feed?.status === 'running'

          return (
            <div key={name} className="card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-text-primary">{FEED_LABELS[name]}</span>
                    <StatusBadge status={feed?.status ?? 'pending'} />
                  </div>
                  <p className="text-text-muted text-xs mt-1">{FEED_DESCRIPTIONS[name]}</p>
                </div>
                <button
                  onClick={() => handleRun(name)}
                  disabled={isRunning}
                  className="btn-secondary text-xs flex items-center gap-1.5 flex-shrink-0"
                >
                  {isRunning ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <RefreshCw size={12} />
                  )}
                  {isRunning ? 'En cours…' : 'Lancer'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-bg-hover rounded p-2">
                  <p className="text-text-muted">CVE ajoutés</p>
                  <p className="text-green-400 font-bold text-base">{feed?.cves_added ?? 0}</p>
                </div>
                <div className="bg-bg-hover rounded p-2">
                  <p className="text-text-muted">CVE mis à jour</p>
                  <p className="text-blue-400 font-bold text-base">{feed?.cves_updated ?? 0}</p>
                </div>
              </div>

              <div className="text-xs text-text-muted space-y-0.5">
                <div className="flex justify-between">
                  <span>Dernier run</span>
                  <span className="text-text-secondary">{formatDate(feed?.last_run ?? '')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Prochain run</span>
                  <span className="text-text-secondary">{formatDate(feed?.next_run ?? '')}</span>
                </div>
              </div>

              {feed?.error_msg && (
                <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 rounded p-2">
                  <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                  <span className="break-all">{feed.error_msg}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Critical alerts */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert size={16} className="text-cyber-red" />
          <h2 className="font-semibold text-text-primary">
            Alertes Critiques
            <span className="ml-2 text-xs font-normal text-text-muted">
              CVSS ≥ 9.0 · 7 derniers jours
              {alertSince && ` · depuis ${new Date(alertSince).toLocaleDateString('fr-FR')}`}
            </span>
          </h2>
          {alertCount > 0 && (
            <span className="ml-auto text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
              {alertCount}
            </span>
          )}
        </div>

        {alerts.length === 0 ? (
          <div className="card p-8 text-center text-text-muted">
            <CheckCircle2 size={28} className="mx-auto mb-2 text-green-500/50" />
            <p>Aucune CVE critique détectée cette semaine.</p>
            <p className="text-xs mt-1">Lancez un feed pour importer les dernières vulnérabilités.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((cve) => (
              <div
                key={cve.id}
                className="card p-3 flex items-start gap-3 hover:border-accent/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-cyber-cyan text-sm">
                      {cve.cve_id}
                    </span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded font-semibold ${severityColor(cve.severity)}`}
                    >
                      {cve.severity?.toUpperCase()}
                    </span>
                    <span className="text-xs text-text-muted">
                      CVSS {cve.cvss_score.toFixed(1)}
                    </span>
                    {cve.products && (
                      <span className="text-xs text-text-muted truncate max-w-xs">
                        · {cve.products}
                      </span>
                    )}
                  </div>
                  {cve.description && (
                    <p className="text-text-secondary text-xs mt-1 line-clamp-2">
                      {cve.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => navigate('/cve')}
                  className="flex-shrink-0 text-text-muted hover:text-cyber-cyan transition-colors"
                  title="Voir dans la veille CVE"
                >
                  <ExternalLink size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
