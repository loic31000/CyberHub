import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search, ExternalLink, Trash2, Clock, CheckCircle,
  AlertCircle, Loader2, Download, Copy, Eye,
} from 'lucide-react'
import { osintWmnApi } from '@/api/client'
import type { WMNMeta, OSINTJobSummary, OSINTJobDetail, SSEProgress } from '@/types/osint'
import { toast } from '@/store/toast'

const USERNAME_RE = /^[a-zA-Z0-9_\-]{1,50}$/

function formatDuration(ms: number): string {
  if (ms <= 0) return '—'
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
  coding:  'border-blue-500/30 bg-blue-500/10 text-blue-400',
  social:  'border-purple-500/30 bg-purple-500/10 text-purple-400',
  gaming:  'border-green-500/30 bg-green-500/10 text-green-400',
  dating:  'border-red-500/30 bg-red-500/10 text-red-400',
  music:   'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
  video:   'border-orange-500/30 bg-orange-500/10 text-orange-400',
  images:  'border-pink-500/30 bg-pink-500/10 text-pink-400',
}
function catColor(cat: string) {
  return CAT_COLORS[cat] ?? 'border-gray-600 bg-gray-700/40 text-gray-400'
}

function StatusBadge({ status }: { status: OSINTJobSummary['status'] }) {
  const map = {
    pending: { icon: <Clock size={12} />,                            label: 'EN ATTENTE', cls: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400' },
    running: { icon: <Loader2 size={12} className="animate-spin" />, label: 'EN COURS',   cls: 'border-blue-500/30 bg-blue-500/10 text-blue-400'     },
    done:    { icon: <CheckCircle size={12} />,                      label: 'TERMINÉ',    cls: 'border-green-500/30 bg-green-500/10 text-green-400'   },
    error:   { icon: <AlertCircle size={12} />,                      label: 'ERREUR',     cls: 'border-red-500/30 bg-red-500/10 text-red-400'         },
  }
  const s = map[status]
  return (
    <span className={`flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 border ${s.cls}`}>
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
  return <span className="text-xs font-mono text-blue-400">{formatDuration(elapsed)}</span>
}

export default function OSINTRunner() {
  const [meta, setMeta] = useState<WMNMeta | null>(null)
  const [username, setUsername] = useState('')
  const [category, setCategory] = useState('')
  const [running, setRunning] = useState(false)
  const [activeJobId, setActiveJobId] = useState<number | null>(null)
  const [progress, setProgress] = useState<SSEProgress | null>(null)
  const [detail, setDetail] = useState<OSINTJobDetail | null>(null)
  const [jobs, setJobs] = useState<OSINTJobSummary[]>([])
  const [filter, setFilter] = useState<'all' | 'found' | 'error'>('all')
  const [importing, setImporting] = useState(false)
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
          .filter(r => r.status === 'found')
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
          toast.success(`Scan terminé - ${job.found_count} profil(s) trouvé(s)`)
        }
      } catch {
        // silencieux
      }
    }, 1000)
    pollRef.current = iv
  }, [stopPolling])

  useEffect(() => () => stopPolling(), [stopPolling])

  const handleRun = async () => {
    if (!USERNAME_RE.test(username)) {
      toast.error('Username invalide (alphanumérique + tirets + underscores, 1-50 caractères)')
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
      toast.success('Job supprimé')
    } catch {
      toast.error('Erreur suppression')
    }
  }

  const handleImport = async () => {
    if (!detail) return
    setImporting(true)
    try {
      const r = await osintWmnApi.importIoc(detail.id)
      toast.success(`${r.created} IOC(s) importé(s) (${r.skipped} doublons ignorés)`)
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
    toast.success('URLs copiées')
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
  const errorCount = detail?.results.filter(r => r.status === 'error' || r.status === 'timeout').length ?? 0

  return (
    <div className="flex flex-col h-full bg-[#06080f] text-[#f1f5f9]">
      {/* Bandeau d'en-tête style BGPLookup */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d40] bg-[#0a0f16]/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="text-[#00d4ff]" size={20} />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#10b981] rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase">OSINT RUNNER // RECON</h1>
            <p className="text-[10px] text-[#64748b] font-mono">
              Username lookup sur {meta?.site_count ?? '...'} sites via WhatsMyName
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px]">
          <span className="text-[#64748b]">SOURCE</span>
          <span className="text-[#10b981]">WMN</span>
        </div>
      </div>

      {/* Zone de contenu scrollable */}
      <div className="flex-1 overflow-auto p-6 space-y-6">

        {/* Formulaire de lancement */}
        <div className="border border-[#1e2d40] bg-[#0a0f16] p-5 space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !running && username && handleRun()}
              placeholder="Nom d'utilisateur à rechercher"
              className="flex-1 bg-[#0d131f] border border-[#1e2d40] px-4 py-2.5 font-mono text-sm text-[#f1f5f9] placeholder-[#2a3f55] focus:outline-none focus:border-[#00d4ff]/40 disabled:opacity-50"
              disabled={running}
            />
            <button
              onClick={handleRun}
              disabled={running || !username || !USERNAME_RE.test(username)}
              className="flex items-center gap-2 border border-[#00d4ff]/20 bg-[#00d4ff]/10 px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#00d4ff] transition-colors hover:bg-[#00d4ff]/20 disabled:opacity-40"
            >
              {running ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              {running ? 'SCAN EN COURS...' : 'LANCER LE SCAN'}
            </button>
          </div>

          {meta && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCategory('')}
                className={`text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1 border transition-colors ${
                  category === ''
                    ? 'border-[#00d4ff]/40 bg-[#00d4ff]/10 text-[#00d4ff]'
                    : 'border-[#1e2d40] bg-[#06080f] text-[#64748b] hover:border-[#00d4ff]/40 hover:text-[#00d4ff]'
                }`}
              >
                TOUS ({meta.site_count})
              </button>
              {meta.categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat === category ? '' : cat)}
                  className={`text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1 border transition-colors ${
                    category === cat
                      ? 'border-[#00d4ff]/40 bg-[#00d4ff]/10 text-[#00d4ff]'
                      : 'border-[#1e2d40] bg-[#06080f] text-[#64748b] hover:border-[#00d4ff]/40 hover:text-[#00d4ff]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Progression du scan en cours */}
        {running && (
          <div className="border border-[#1e2d40] bg-[#0a0f16] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-blue-400" />
                <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#f1f5f9]">
                  Scan de <span className="text-[#00d4ff]">{username}</span>
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
                  <div className="flex justify-between text-[10px] font-mono text-[#64748b] mb-1">
                    <span>{progress.checked_sites} / {progress.total_sites} sites</span>
                    <span className="text-green-400">{progress.found_count} trouvés</span>
                  </div>
                  <div className="w-full bg-[#1e2d40] h-1.5">
                    <div
                      className="bg-[#00d4ff] h-1.5 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {progress.latest_results.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider">Derniers profils trouvés :</p>
                    {progress.latest_results.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px] font-mono">
                        <ExternalLink size={11} className="text-cyan-400 flex-shrink-0" />
                        <span className="text-[#f1f5f9]">{r.site_name}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 border ${catColor(r.category)}`}>{r.category}</span>
                        <a href={r.url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline truncate">{r.url}</a>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-[10px] font-mono text-[#64748b] animate-pulse">Démarrage du scan...</p>
            )}
          </div>
        )}

        {/* Résultats détaillés */}
        {detail && detail.status === 'done' && (
          <div className="border border-[#1e2d40] bg-[#0a0f16] p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-mono text-[13px] font-bold uppercase tracking-wider text-[#f1f5f9]">
                RÉSULTATS — <span className="text-[#00d4ff]">{detail.username}</span>
              </h2>
              <StatusBadge status={detail.status} />
            </div>

            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'TROUVÉS', value: detail.found_count, cls: 'text-green-400' },
                { label: 'VÉRIFIÉS', value: detail.checked_sites, cls: 'text-blue-400' },
                { label: 'ERREURS', value: errorCount, cls: 'text-red-400' },
                { label: 'DURÉE', value: formatDuration(detail.duration), cls: 'text-yellow-400' },
              ].map(s => (
                <div key={s.label} className="bg-[#0d131f] border border-[#1e2d40] p-3 text-center">
                  <p className={`text-lg font-mono font-bold ${s.cls}`}>{s.value}</p>
                  <p className="text-[9px] font-mono text-[#64748b] uppercase tracking-wider mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {(['all', 'found', 'error'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1 border transition-colors ${
                    filter === f
                      ? 'border-[#00d4ff]/40 bg-[#00d4ff]/10 text-[#00d4ff]'
                      : 'border-[#1e2d40] bg-[#06080f] text-[#64748b] hover:border-[#00d4ff]/40 hover:text-[#00d4ff]'
                  }`}
                >
                  {f === 'all' ? 'TOUS' : f === 'found' ? `TROUVÉS (${foundResults.length})` : `ERREURS (${errorCount})`}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[11px] font-mono">
                <thead>
                  <tr className="text-left text-[#4a6480] border-b border-[#1e2d40]">
                    <th className="pb-2 pr-4 uppercase tracking-wider">SITE</th>
                    <th className="pb-2 pr-4 uppercase tracking-wider">CATÉGORIE</th>
                    <th className="pb-2 pr-4 uppercase tracking-wider">URL</th>
                    <th className="pb-2 text-right uppercase tracking-wider">TEMPS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((r, i) => (
                    <tr key={i} className="border-b border-[#1e2d40]/40 hover:bg-[#0d131f]">
                      <td className="py-2 pr-4 font-medium text-[#f1f5f9]">{r.site_name}</td>
                      <td className="py-2 pr-4">
                        <span className={`text-[9px] px-1.5 py-0.5 border ${catColor(r.category)}`}>{r.category}</span>
                      </td>
                      <td className="py-2 pr-4 max-w-xs truncate">
                        {r.status === 'found' ? (
                          <a href={r.url} target="_blank" rel="noreferrer" className="text-[#00d4ff] hover:underline flex items-center gap-1">
                            <ExternalLink size={10} /> {r.url}
                          </a>
                        ) : (
                          <span className="text-[#64748b]">{r.status}</span>
                        )}
                      </td>
                      <td className="py-2 text-right text-[#64748b]">{r.response_time}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredResults.length === 0 && (
                <p className="text-center text-[#64748b] text-[11px] font-mono py-6">Aucun résultat pour ce filtre</p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleImport}
                disabled={importing || foundResults.length === 0}
                className="flex items-center gap-2 border border-[#00d4ff]/20 bg-[#00d4ff]/10 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#00d4ff] transition-colors hover:bg-[#00d4ff]/20 disabled:opacity-40"
              >
                {importing ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                IMPORTER EN IOC ({foundResults.length})
              </button>
              <button
                onClick={handleCopy}
                disabled={foundResults.length === 0}
                className="flex items-center gap-2 border border-[#1e2d40] bg-[#0a0f16] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#64748b] hover:text-[#f1f5f9] transition-colors disabled:opacity-40"
              >
                <Copy size={12} /> COPIER LES URLS
              </button>
            </div>
          </div>
        )}

        {/* Historique des scans */}
        {jobs.length > 0 && (
          <div className="border border-[#1e2d40] bg-[#0a0f16] p-5 space-y-3">
            <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a9ab0]">HISTORIQUE DES SCANS</h2>
            <div className="space-y-2">
              {jobs.map(job => (
                <div key={job.id} className="flex items-center gap-3 px-3 py-2 border border-[#1e2d40] bg-[#0d131f] hover:border-[#00d4ff]/30 transition-colors">
                  <span className="font-mono text-sm text-[#00d4ff] w-32 truncate">{job.username}</span>
                  <StatusBadge status={job.status} />
                  {job.filter_category && (
                    <span className="text-[9px] px-1.5 py-0.5 border border-[#1e2d40] bg-[#0a0f16] text-[#64748b]">{job.filter_category}</span>
                  )}
                  <span className="text-[11px] text-green-400 font-mono">{job.found_count > 0 ? `${job.found_count} trouvés` : '-'}</span>
                  <span className="text-[10px] text-[#64748b] font-mono">{job.total_sites > 0 ? `${job.checked_sites}/${job.total_sites}` : ''}</span>
                  <span className="text-[10px] text-[#64748b] font-mono">{formatDuration(job.duration)}</span>
                  <span className="text-[10px] text-[#64748b] ml-auto">{relativeTime(job.created_at)}</span>
                  <button
                    onClick={() => handleReview(job.id)}
                    className="p-1 text-[#64748b] hover:text-[#00d4ff] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]"
                    title="Revoir"
                    aria-label="Voir"
                  >
                    <Eye size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(job.id)}
                    className="p-1 text-[#64748b] hover:text-red-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]"
                    title="Supprimer"
                    aria-label="Supprimer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}