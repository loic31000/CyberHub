import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search, ExternalLink, Trash2, Clock, CheckCircle,
  AlertCircle, Loader2, Download, Copy, Eye,
} from 'lucide-react'
import { osintWmnApi } from '@/api/client'
import type { WMNMeta, OSINTJobSummary, OSINTJobDetail, SSEProgress } from '@/types/osint'
import { toast } from '@/store/toast'

// Usage legal uniquement - OSINT sur systemes autorises seulement

const USERNAME_RE = /^[a-zA-Z0-9_\-]{1,50}$/

function formatDuration(ms: number): string {
  if (ms <= 0) return 'x'
  if (ms < 1000) return `${ms}ms`
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m${s % 60}s`
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `il y a ${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `il y a ${m}min`
  return `il y a ${Math.floor(m / 60)}h`
}

const CAT_COLORS: Record<string, string> = {
  coding:  'bg-blue-900/60 text-blue-300',
  social:  'bg-purple-900/60 text-purple-300',
  gaming:  'bg-green-900/60 text-green-300',
  dating:  'bg-red-900/60 text-red-300',
  music:   'bg-yellow-900/60 text-yellow-300',
  video:   'bg-orange-900/60 text-orange-300',
  images:  'bg-pink-900/60 text-pink-300',
}
function catColor(cat: string) {
  return CAT_COLORS[cat] ?? 'bg-gray-700 text-gray-300'
}

function StatusBadge({ status }: { status: OSINTJobSummary['status'] }) {
  const map = {
    pending: { icon: <Clock size={12} />,                            label: 'en attente', cls: 'text-yellow-400 border-yellow-400/40 bg-yellow-400/10' },
    running: { icon: <Loader2 size={12} className="animate-spin" />, label: 'en cours',   cls: 'text-blue-400 border-blue-400/40 bg-blue-400/10'     },
    done:    { icon: <CheckCircle size={12} />,                      label: 'termine',    cls: 'text-green-400 border-green-400/40 bg-green-400/10'   },
    error:   { icon: <AlertCircle size={12} />,                      label: 'erreur',     cls: 'text-red-400 border-red-400/40 bg-red-400/10'         },
  }
  const s = map[status]
  return (
    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded border font-mono ${s.cls}`}>
      {s.icon} {s.label}
    </span>
  )
}

function LiveTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const base = new Date(startedAt).getTime()
    const iv = window.setInterval(() => setElapsed(Date.now() - base), 500)
    return () => clearInterval(iv)
  }, [startedAt])
  return <span className="text-xs text-blue-300 font-mono animate-pulse">{formatDuration(elapsed)}</span>
}

export default function OSINTRunner() {
  const [meta, setMeta]               = useState<WMNMeta | null>(null)
  const [username, setUsername]       = useState('')
  const [category, setCategory]       = useState('')
  const [running, setRunning]         = useState(false)
  const [activeJobId, setActiveJobId] = useState<number | null>(null)
  const [progress, setProgress]       = useState<SSEProgress | null>(null)
  const [detail, setDetail]           = useState<OSINTJobDetail | null>(null)
  const [jobs, setJobs]               = useState<OSINTJobSummary[]>([])
  const [filter, setFilter]           = useState<'all' | 'found' | 'error'>('all')
  const [importing, setImporting]     = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    osintWmnApi.getMeta().then(setMeta).catch(() => {})
    osintWmnApi.listJobs().then(r => setJobs(r.jobs)).catch(() => {})
  }, [])

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const startPolling = useCallback((jobId: number) => {
    stopPolling()
    const iv = setInterval(async () => {
      try {
        const job = await osintWmnApi.getJob(jobId)
        const latestFound = (job.results ?? [])
          .filter((r: { status: string }) => r.status === 'found')
          .slice(-5)
        setProgress({
          checked_sites:  job.checked_sites,
          total_sites:    job.total_sites,
          found_count:    job.found_count,
          status:         job.status as SSEProgress['status'],
          latest_results: latestFound,
        })
        if (job.status === 'done' || job.status === 'error') {
          stopPolling()
          setRunning(false)
          setDetail(job)
          setJobs(prev => prev.map(j => j.id === jobId
            ? { ...j, status: job.status as OSINTJobSummary['status'], found_count: job.found_count, checked_sites: job.checked_sites, duration: job.duration }
            : j
          ))
          toast.success(`Scan termine - ${job.found_count} profil(s) trouve(s)`)
        }
      } catch {
        // erreur reseau temporaire
      }
    }, 1000)
    pollRef.current = iv
  }, [stopPolling])

  useEffect(() => () => stopPolling(), [stopPolling])

  const handleRun = async () => {
    if (!USERNAME_RE.test(username)) {
      toast.error('Username invalide (alphanumerique + tirets + underscores, 1-50 chars)')
      return
    }
    setRunning(true)
    setProgress(null)
    setDetail(null)
    try {
      const { job_id } = await osintWmnApi.run(username, category)
      setActiveJobId(job_id)
      const now = new Date().toISOString()
      setJobs(prev => [{
        id: job_id, username, status: 'running',
        total_sites: meta?.site_count ?? 0, checked_sites: 0, found_count: 0,
        filter_category: category, duration: 0, launched_by: '', created_at: now,
      }, ...prev])
      startPolling(job_id)
    } catch {
      toast.error('Erreur lors du lancement du scan')
      setRunning(false)
    }
  }

  const handleReview = async (jobId: number) => {
    try {
      const d = await osintWmnApi.getJob(jobId)
      setDetail(d)
      setActiveJobId(jobId)
      setProgress(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      toast.error('Impossible de charger le job')
    }
  }

  const handleDelete = async (jobId: number) => {
    if (!confirm('Supprimer ce job ?')) return
    try {
      await osintWmnApi.deleteJob(jobId)
      setJobs(prev => prev.filter(j => j.id !== jobId))
      if (activeJobId === jobId) { setDetail(null); setProgress(null) }
      toast.success('Job supprime')
    } catch {
      toast.error('Erreur suppression')
    }
  }

  const handleImport = async () => {
    if (!detail) return
    setImporting(true)
    try {
      const r = await osintWmnApi.importIoc(detail.id)
      toast.success(`${r.created} IOC(s) importes (${r.skipped} doublons ignores)`)
    } catch {
      toast.error('Erreur import IOC')
    } finally {
      setImporting(false)
    }
  }

  const handleCopy = () => {
    if (!detail) return
    const urls = detail.results.filter(r => r.status === 'found').map(r => r.url).join('\n')
    navigator.clipboard.writeText(urls)
    toast.success('URLs copiees')
  }

  const pct = progress && progress.total_sites > 0
    ? Math.round((progress.checked_sites / progress.total_sites) * 100)
    : 0

  const filteredResults = detail?.results.filter(r => {
    if (filter === 'found') return r.status === 'found'
    if (filter === 'error') return r.status === 'error' || r.status === 'timeout'
    return true
  }) ?? []

  const foundResults = detail?.results.filter(r => r.status === 'found') ?? []
  const errorCount   = detail?.results.filter(r => r.status === 'error' || r.status === 'timeout').length ?? 0

  return (
    <div className="p-6 max-w-5xl space-y-6">

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Search size={22} className="text-cyber-cyan" />
            OSINT Runner
          </h1>
          <p className="text-text-muted text-sm mt-1">Username lookup sur {meta?.site_count ?? '...'} sites via WhatsMyName</p>
          {meta && (
            <p className="text-xs text-gray-500 mt-0.5">
              {meta.site_count} sites - {meta.categories.length} categories
            </p>
          )}
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !running && username && handleRun()}
            placeholder="Nom d'utilisateur a rechercher"
            className="flex-1 bg-bg-primary border border-border rounded-lg px-4 py-2.5 text-text-primary placeholder-text-muted focus:border-cyber-cyan focus:outline-none font-mono"
            disabled={running}
          />
          <button
            onClick={handleRun}
            disabled={running || !username || !USERNAME_RE.test(username)}
            className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {running ? 'Scan en cours...' : 'Lancer le scan'}
          </button>
        </div>

        {meta && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategory('')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${category === '' ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              Tous ({meta.site_count})
            </button>
            {meta.categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat === category ? '' : cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${category === cat ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {running && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-blue-400" />
              <span className="text-sm text-text-primary font-medium">
                Scan de <span className="text-cyber-cyan font-mono">{username}</span>
              </span>
              <StatusBadge status="running" />
            </div>
            {activeJobId && (
              <LiveTimer startedAt={jobs.find(j => j.id === activeJobId)?.created_at ?? new Date().toISOString()} />
            )}
          </div>

          {progress ? (
            <>
              <div>
                <div className="flex justify-between text-xs text-text-muted mb-1">
                  <span>{progress.checked_sites} / {progress.total_sites} sites</span>
                  <span className="text-green-400 font-semibold">{progress.found_count} trouves</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-cyan-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-text-muted mt-1">{pct}%</p>
              </div>

              {progress.latest_results.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-text-muted font-medium">Derniers profils trouves :</p>
                  {progress.latest_results.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <ExternalLink size={12} className="text-cyan-400 flex-shrink-0" />
                      <span className="text-text-primary">{r.site_name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${catColor(r.category)}`}>{r.category}</span>
                      <a href={r.url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline text-xs truncate">{r.url}</a>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-text-muted animate-pulse">Demarrage du scan...</p>
          )}
        </div>
      )}

      {detail && detail.status === 'done' && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">
              Resultats - <span className="text-cyber-cyan font-mono">{detail.username}</span>
            </h2>
            <StatusBadge status={detail.status} />
          </div>

          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Trouves',   value: detail.found_count,             cls: 'text-green-400' },
              { label: 'Verifies',  value: detail.checked_sites,           cls: 'text-blue-400'  },
              { label: 'Erreurs',   value: errorCount,                     cls: 'text-red-400'   },
              { label: 'Duree',     value: formatDuration(detail.duration), cls: 'text-yellow-400' },
            ].map(s => (
              <div key={s.label} className="bg-bg-primary rounded-lg p-3 text-center border border-border">
                <p className={`text-xl font-bold font-mono ${s.cls}`}>{s.value}</p>
                <p className="text-xs text-text-muted mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            {(['all', 'found', 'error'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === f ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              >
                {f === 'all' ? 'Tous' : f === 'found' ? `Trouves (${foundResults.length})` : `Erreurs (${errorCount})`}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted border-b border-border">
                  <th className="pb-2 pr-4">Site</th>
                  <th className="pb-2 pr-4">Categorie</th>
                  <th className="pb-2 pr-4">URL</th>
                  <th className="pb-2 text-right">Temps</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((r, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-bg-hover">
                    <td className="py-2 pr-4 font-medium text-text-primary">{r.site_name}</td>
                    <td className="py-2 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded ${catColor(r.category)}`}>{r.category}</span>
                    </td>
                    <td className="py-2 pr-4 max-w-xs truncate">
                      {r.status === 'found' ? (
                        <a href={r.url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline flex items-center gap-1">
                          <ExternalLink size={11} />{r.url}
                        </a>
                      ) : (
                        <span className="text-text-muted text-xs">{r.status}</span>
                      )}
                    </td>
                    <td className="py-2 text-right text-xs text-text-muted font-mono">{r.response_time}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredResults.length === 0 && (
              <p className="text-center text-text-muted text-sm py-6">Aucun resultat pour ce filtre</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleImport}
              disabled={importing || foundResults.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-600/40 text-cyan-300 rounded-lg text-sm disabled:opacity-40 transition-colors"
            >
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Importer en IOC ({foundResults.length})
            </button>
            <button
              onClick={handleCopy}
              disabled={foundResults.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm disabled:opacity-40 transition-colors"
            >
              <Copy size={14} /> Copier les URLs
            </button>
          </div>
        </div>
      )}

      {jobs.length > 0 && (
        <div className="card">
          <h2 className="text-base font-semibold text-text-primary mb-3">Historique des scans</h2>
          <div className="space-y-2">
            {jobs.map(job => (
              <div key={job.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-bg-primary border border-border hover:border-gray-600 transition-colors">
                <span className="font-mono text-sm text-cyber-cyan w-32 truncate">{job.username}</span>
                <StatusBadge status={job.status} />
                {job.filter_category && (
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-400">{job.filter_category}</span>
                )}
                <span className="text-xs text-green-400 font-mono">{job.found_count > 0 ? `${job.found_count} trouves` : '-'}</span>
                <span className="text-xs text-text-muted font-mono">{job.total_sites > 0 ? `${job.checked_sites}/${job.total_sites}` : ''}</span>
                <span className="text-xs text-text-muted font-mono">{formatDuration(job.duration)}</span>
                <span className="text-xs text-text-muted ml-auto">{relativeTime(job.created_at)}</span>
                <button
                  onClick={() => handleReview(job.id)}
                  className="p-1 text-gray-400 hover:text-cyan-400 transition-colors"
                  title="Revoir"
                >
                  <Eye size={14} />
                </button>
                <button
                  onClick={() => handleDelete(job.id)}
                  className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                  title="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
