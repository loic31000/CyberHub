import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Play, Trash2, Clock, CheckCircle, AlertCircle, Loader2, Terminal, Shield, Download, DownloadCloud } from 'lucide-react'
import { osintApi, iocApi } from '@/api/client'
import type { OSINTJob, OSINTTool, ExtractedIOC } from '@/types/osint'
import type { IOCCreatePayload, IOCType } from '@/types/ioc'
import { toast } from '@/store/toast'

// ⚠️ Usage légal uniquement — OSINT sur systèmes autorisés seulement

function parseIOCs(raw: string): ExtractedIOC[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as ExtractedIOC[]
    return []
  } catch { return [] }
}

function formatDuration(ms: number): string {
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

const IOC_COLORS: Record<ExtractedIOC['type'], string> = {
  ip:     'bg-blue-900/60 text-blue-300 border-blue-700/40',
  domain: 'bg-purple-900/60 text-purple-300 border-purple-700/40',
  email:  'bg-yellow-900/60 text-yellow-300 border-yellow-700/40',
  url:    'bg-green-900/60 text-green-300 border-green-700/40',
}

const TOOL_PLACEHOLDERS: Record<string, string> = {
  theHarvester: 'Domaine cible (ex: example.com)',
  sherlock:     'Nom d\'utilisateur à rechercher',
  maigret:      'Nom d\'utilisateur à rechercher',
}

function StatusBadge({ status }: { status: OSINTJob['status'] }) {
  const map: Record<OSINTJob['status'], { icon: React.ReactNode; label: string; cls: string }> = {
    pending: { icon: <Clock size={12} />,                           label: 'en attente', cls: 'text-yellow-400 border-yellow-400/40 bg-yellow-400/10' },
    running: { icon: <Loader2 size={12} className="animate-spin" />, label: 'en cours',   cls: 'text-blue-400 border-blue-400/40 bg-blue-400/10' },
    done:    { icon: <CheckCircle size={12} />,                     label: 'terminé',    cls: 'text-green-400 border-green-400/40 bg-green-400/10' },
    error:   { icon: <AlertCircle size={12} />,                     label: 'erreur',     cls: 'text-red-400 border-red-400/40 bg-red-400/10' },
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
    return () => window.clearInterval(iv)
  }, [startedAt])
  return <span className="text-xs text-blue-300 font-mono ml-auto animate-pulse">{formatDuration(elapsed)}</span>
}

export default function OSINTRunner() {
  const [tools, setTools]               = useState<OSINTTool[]>([])
  const [loadingTools, setLoadingTools]   = useState(true)
  const [selectedTool, setSelectedTool] = useState<string>('theHarvester')
  const [target, setTarget]             = useState('')
  const [running, setRunning]           = useState(false)
  const [jobs, setJobs]                 = useState<OSINTJob[]>([])
  const [selectedJob, setSelectedJob]   = useState<OSINTJob | null>(null)
  const [loadingJobs, setLoadingJobs]   = useState(false)
  const [importingAll, setImportingAll] = useState(false)

  const terminalRef  = useRef<HTMLPreElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // ── Chargement initial ─────────────────────────────────────────────
  const loadTools = useCallback(async () => {
    setLoadingTools(true)
    try {
      const res = await osintApi.listTools()
      setTools(res.tools ?? [])
    } catch { toast.error('Impossible de charger les outils OSINT') }
    finally { setLoadingTools(false) }
  }, [])

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true)
    try {
      const res = await osintApi.listJobs()
      setJobs(res.jobs ?? [])
    } catch { toast.error('Impossible de charger les jobs') }
    finally { setLoadingJobs(false) }
  }, [])

  useEffect(() => { loadTools(); loadJobs() }, [loadTools, loadJobs])

  // ── Auto-scroll terminal ────────────────────────────────────────────
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [selectedJob?.output])

  // ── Polling du job actif (toutes les 2s tant que pending/running) ──
  // Dépend uniquement de l'ID pour éviter la boucle infinie sur les updates de status
  useEffect(() => {
    if (!selectedJob) return
    if (selectedJob.status === 'done' || selectedJob.status === 'error') return

    const jobId = selectedJob.id
    const source = new EventSource(osintApi.streamJobUrl(jobId))
    eventSourceRef.current = source

    const handleStatus = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data)
        const status = String(payload.status) as OSINTJob['status']
        const output = typeof payload.output === 'string' ? payload.output : selectedJob.output
        setSelectedJob((prev) => prev && prev.id === jobId ? { ...prev, output, status } : prev)
        setJobs((prev) => prev.map((job) => job.id === jobId ? { ...job, output, status } : job))
      } catch {
        // ignore malformed event payload
      }
    }

    const handleDone = () => {
      source.close()
    }

    const handleError = () => {
      toast.error('Flux OSINT interrompu')
      source.close()
    }

    source.addEventListener('status', handleStatus)
    source.addEventListener('done', handleDone)
    source.addEventListener('error', handleError)

    const iv = window.setInterval(async () => {
      try {
        const updated = await osintApi.getJob(jobId)
        setSelectedJob(updated)
        setJobs((prev) => prev.map((j) => j.id === jobId ? updated : j))
        if (updated.status === 'done' || updated.status === 'error') {
          window.clearInterval(iv)
        }
      } catch {
        window.clearInterval(iv)
      }
    }, 2000)

    return () => {
      window.clearInterval(iv)
      source.close()
      if (eventSourceRef.current === source) {
        eventSourceRef.current = null
      }
    }
  }, [selectedJob?.id, selectedJob?.status])  // ← ID et status pour reconnection

  // ── Lancer un job ──────────────────────────────────────────────────
  const handleRun = async () => {
    const val = target.trim()
    if (!val) { toast.error('Cible requise'); return }
    const tool = tools.find((t) => t.name === selectedTool)
    if (tool && !tool.installed) { toast.error('Outil non installé'); return }
    setRunning(true)
    try {
      const res = await osintApi.runJob({ tool: selectedTool, target: val })
      toast.success(`Job #${res.id} lancé`)
      await loadJobs()
      const job = await osintApi.getJob(res.id)
      setSelectedJob(job)
    } catch { toast.error('Impossible de lancer le job') }
    finally { setRunning(false) }
  }

  // ── Supprimer un job ───────────────────────────────────────────────
  const handleDelete = async (id: number) => {
    try {
      await osintApi.deleteJob(id)
      toast.success('Job supprimé')
      setJobs((prev) => prev.filter((j) => j.id !== id))
      if (selectedJob?.id === id) setSelectedJob(null)
    } catch { toast.error('Impossible de supprimer') }
  }

  // ── Importer un IOC ───────────────────────────────────────────────
  const importOneIOC = async (ioc: ExtractedIOC, jobId: number) => {
    try {
      const payload: IOCCreatePayload = {
        type:   ioc.type as IOCType,
        value:  ioc.value,
        source: `OSINT #${jobId}`,
        tlp:    'amber',
        status: 'active',
      }
      await iocApi.create(payload)
      toast.success(`${ioc.value} importé`)
    } catch { toast.error(`Erreur import ${ioc.value}`) }
  }

  // ── Importer tous les IOCs ─────────────────────────────────────────
  const importAllIOCs = async (iocs: ExtractedIOC[], jobId: number) => {
    if (iocs.length === 0) return
    setImportingAll(true)
    let created = 0
    for (const ioc of iocs) {
      try {
        const payload: IOCCreatePayload = {
          type:   ioc.type as IOCType,
          value:  ioc.value,
          source: `OSINT #${jobId}`,
          tlp:    'amber',
          status: 'active',
        }
        await iocApi.create(payload)
        created++
      } catch { /* skip duplicates */ }
    }
    setImportingAll(false)
    toast.success(`${created}/${iocs.length} IOCs importés dans l'IOC Manager`)
  }

  const selectedToolData = tools.find((t) => t.name === selectedTool)
  const isToolInstalled  = selectedToolData?.installed ?? true
  const iocs             = selectedJob ? parseIOCs(selectedJob.iocs_extracted) : []
  const placeholder      = TOOL_PLACEHOLDERS[selectedTool] ?? 'Cible…'

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <Search size={24} className="text-cyber-cyan" />
          OSINT Runner
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <Shield size={14} className="text-yellow-400" />
          <p className="text-yellow-400 text-xs font-mono">Usage légal uniquement — OSINT sur systèmes autorisés seulement</p>
        </div>
      </div>

      {/* ── Section 1 : Sélecteur outil + lancement ── */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">Lancer un scan</h2>

        {/* Cards outils — utilise div+role pour éviter les boutons imbriqués */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {loadingTools && (
            <div className="col-span-3 flex items-center gap-2 text-text-muted text-xs">
              <Loader2 size={14} className="animate-spin" /> Détection des outils…
            </div>
          )}
          {!loadingTools && tools.map((tool) => {
            const isSelected = selectedTool === tool.name
            return (
              <div
                key={tool.name}
                role={tool.installed ? 'button' : undefined}
                tabIndex={tool.installed ? 0 : undefined}
                onClick={() => tool.installed && setSelectedTool(tool.name)}
                onKeyDown={(e) => e.key === 'Enter' && tool.installed && setSelectedTool(tool.name)}
                title={!tool.installed ? `Outil non trouvé dans le PATH` : undefined}
                className={`p-3 rounded border text-left select-none transition-colors ${
                  !tool.installed
                    ? 'cursor-not-allowed border-dashed border-border opacity-70'
                    : isSelected
                      ? 'border-cyber-cyan bg-cyber-cyan/10 cursor-pointer'
                      : 'border-border text-text-muted hover:border-cyber-cyan/40 cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-mono text-sm font-semibold ${isSelected && tool.installed ? 'text-cyber-cyan' : 'text-text-primary'}`}>
                    {tool.name}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded border font-mono ${
                    tool.installed
                      ? 'text-green-400 border-green-400/40 bg-green-400/10'
                      : 'text-red-400 border-red-400/40 bg-red-400/10'
                  }`}>
                    {tool.installed ? '✅ Installé' : '❌ Absent'}
                  </span>
                </div>
                <p className="text-xs text-text-muted">{tool.description}</p>
                {tool.installed ? (
                  <p className="text-xs text-text-muted/60 mt-1 font-mono">ex: {tool.example}</p>
                ) : (
                  <div className="mt-2 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <code className="text-xs bg-bg-primary border border-border rounded px-2 py-0.5 text-yellow-400 font-mono flex-1 truncate">
                      {tool.install}
                    </code>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => navigator.clipboard.writeText(tool.install ?? '')}
                      onKeyDown={(e) => e.key === 'Enter' && navigator.clipboard.writeText(tool.install ?? '')}
                      className="text-text-muted hover:text-cyber-cyan transition-colors shrink-0 cursor-pointer"
                      title="Copier la commande"
                    >
                      <Download size={12} />
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Input + bouton */}
        <div className="flex gap-3">
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRun()}
            placeholder={placeholder}
            className="input flex-1 font-mono"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            onClick={handleRun}
            disabled={running || !target.trim() || !isToolInstalled}
            title={!isToolInstalled ? 'Outil non installé' : undefined}
            className="btn-cyber flex items-center gap-2 px-4 disabled:opacity-50"
          >
            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {running ? 'Lancement…' : '🚀 Lancer'}
          </button>
        </div>
      </div>

      {/* ── Layout résultat + historique ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Section 4 : Historique ── */}
        <div className="card space-y-3 lg:col-span-1">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Clock size={14} className="text-cyber-cyan" /> Historique
            </h2>
            <button onClick={loadJobs} className="text-xs text-text-muted hover:text-cyber-cyan transition-colors">
              {loadingJobs ? <Loader2 size={12} className="animate-spin" /> : 'Actualiser'}
            </button>
          </div>

          {jobs.length === 0 && !loadingJobs && (
            <p className="text-xs text-text-muted">Aucun job pour l'instant.</p>
          )}

          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {jobs.map((job) => {
              const jobIOCs = parseIOCs(job.iocs_extracted)
              return (
                <div
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  className={`p-2 rounded border cursor-pointer transition-colors ${
                    selectedJob?.id === job.id
                      ? 'border-cyber-cyan bg-cyber-cyan/5'
                      : 'border-border hover:border-cyber-cyan/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-mono text-text-muted">#{job.id}</span>
                    <StatusBadge status={job.status} />
                  </div>
                  <p className="text-xs text-text-primary font-mono truncate">{job.tool}</p>
                  <p className="text-xs text-text-muted truncate">{job.target}</p>
                  {job.created_at && (
                    <p className="text-xs text-text-muted/60 mt-0.5">{relativeTime(job.created_at)}</p>
                  )}
                  {jobIOCs.length > 0 && (
                    <p className="text-xs text-cyber-cyan mt-0.5">{jobIOCs.length} IOC{jobIOCs.length > 1 ? 's' : ''} extraits</p>
                  )}
                  <div className="flex gap-1.5 mt-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedJob(job) }}
                      className="text-xs text-text-muted hover:text-cyber-cyan transition-colors px-1.5 py-0.5 rounded border border-border hover:border-cyber-cyan/40"
                    >
                      Revoir
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(job.id) }}
                      className="text-xs text-text-muted hover:text-red-400 transition-colors px-1.5 py-0.5 rounded border border-border hover:border-red-400/40"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Sections 2 & 3 : Terminal + IOCs ── */}
        <div className="space-y-3 lg:col-span-2">
          {!selectedJob ? (
            <div className="card flex flex-col items-center justify-center py-16 text-text-muted">
              <Terminal size={36} className="mb-3 opacity-30" />
              <p className="text-sm">Sélectionnez un job ou lancez un scan</p>
            </div>
          ) : (
            <>
              {/* ── Section 2 : Terminal output ── */}
              <div className="rounded-lg border border-gray-700 overflow-hidden">
                {/* Barre de titre terminal */}
                <div className="bg-gray-800 px-4 py-2 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-500/70" />
                    <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
                    <span className="w-3 h-3 rounded-full bg-green-500/70" />
                  </div>
                  <span className="text-xs font-mono text-gray-400 flex-1 truncate">
                    {selectedJob.tool} — {selectedJob.target}
                  </span>
                  <StatusBadge status={selectedJob.status} />
                  {selectedJob.status === 'running' && (
                    <LiveTimer startedAt={selectedJob.created_at} />
                  )}
                  {selectedJob.status !== 'running' && selectedJob.duration > 0 && (
                    <span className="text-xs text-text-muted font-mono ml-auto">
                      {formatDuration(selectedJob.duration)}
                    </span>
                  )}
                </div>

                {/* Corps du terminal — fond noir obligatoire */}
                <pre
                  ref={terminalRef}
                  className="bg-black text-green-400 font-mono text-xs p-4 h-72 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed"
                >
                  {selectedJob.output
                    ? selectedJob.output
                    : selectedJob.status === 'running'
                      ? '$ Analyse en cours…\n\n[En attente de la première sortie]'
                      : selectedJob.status === 'pending'
                        ? '$ Job en file d\'attente…'
                        : '$ Aucune sortie disponible'
                  }
                  {selectedJob.status === 'running' && (
                    '\n\n█' // curseur clignotant
                  )}
                </pre>
              </div>

              {/* ── Section 3 : IOCs extraits ── */}
              {selectedJob.status === 'done' && (
                <div className="card space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <Shield size={14} className="text-cyber-cyan" />
                      IOCs extraits
                      {iocs.length > 0 && (
                        <span className="text-xs bg-cyber-cyan/20 text-cyber-cyan px-1.5 py-0.5 rounded font-mono">
                          {iocs.length}
                        </span>
                      )}
                    </h3>
                    {iocs.length > 0 && (
                      <button
                        onClick={() => importAllIOCs(iocs, selectedJob.id)}
                        disabled={importingAll}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-cyber-cyan/40 text-cyber-cyan hover:bg-cyber-cyan/10 transition-colors disabled:opacity-50"
                      >
                        {importingAll
                          ? <Loader2 size={12} className="animate-spin" />
                          : <DownloadCloud size={12} />
                        }
                        {importingAll ? 'Import…' : '📥 Tout importer dans IOC Manager'}
                      </button>
                    )}
                  </div>

                  {iocs.length === 0 ? (
                    <p className="text-xs text-text-muted">Aucun IOC extrait automatiquement.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto">
                      {iocs.map((ioc, i) => (
                        <span
                          key={i}
                          className={`flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded border ${IOC_COLORS[ioc.type] ?? 'bg-gray-800 text-gray-300 border-gray-600'}`}
                        >
                          <span className="opacity-60">[{ioc.type}]</span>
                          <span>{ioc.value}</span>
                          <button
                            onClick={() => importOneIOC(ioc, selectedJob.id)}
                            className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
                            title={`Importer ${ioc.value}`}
                          >
                            <Download size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Erreur */}
              {selectedJob.status === 'error' && (
                <div className="flex items-center gap-2 p-3 rounded border border-red-500/30 bg-red-900/10 text-red-400 text-xs">
                  <AlertCircle size={14} />
                  <span>{selectedJob.output || 'Erreur inconnue'}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
