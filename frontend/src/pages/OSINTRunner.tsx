import { useState, useEffect, useRef, useCallback, useId, useMemo, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, ExternalLink, Trash2, Loader2, Download, Copy, AlertTriangle,
  Radio, History, RotateCcw, Database, CheckCircle2, X, SlidersHorizontal, RefreshCw, ArrowLeft, BarChart3, ChevronRight, ArrowUpDown,
} from 'lucide-react'
import { osintWmnApi } from '@/api/client'
import type { WMNMeta, OSINTJobSummary, OSINTJobDetail, OSINTResult, SSEProgress } from '@/types/osint'
import { toast } from '@/store/toast'
import { ModuleHero } from '@/hero/ModuleHero'
import { Dialog } from '@/components/AccessibleDialog'
import OsintMotif from '@/osint26/OsintMotif'
import SignalGlobe from '@/osint26/SignalGlobe'
import { ChoiceMenu } from '@/osint26/ChoiceMenu'
import '@/osint26/osint.css'

const USERNAME_RE = /^[a-zA-Z0-9_-]{1,50}$/
const DENSITY_KEY = 'cyberhub:osint-display:v1'
const ROWS_PER_GROUP = 8 // a category shows this many profiles, then « Voir davantage »
const MISSING_STEP = 200 // sites without a profile shown per step
const TOP_CATEGORIES = 5
const OTHERS = '__others'
type Density = 'comfort' | 'compact'
type ResultView = 'found' | 'issues' | 'missing'
type Sort = 'name-asc' | 'name-desc' | 'time-asc' | 'time-desc'
const SORTS: { value: Sort; label: string }[] = [
  { value: 'name-asc', label: 'Nom A → Z' },
  { value: 'name-desc', label: 'Nom Z → A' },
  { value: 'time-asc', label: 'Réponse la plus rapide' },
  { value: 'time-desc', label: 'Réponse la plus lente' },
]

function formatDuration(ms: number): string {
  if (ms <= 0) return '—'
  if (ms < 1000) return `${ms} ms`
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s} s`
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`
}

function relativeTime(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'à l’instant'
  const m = Math.floor(s / 60)
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h} h`
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

/*
 * The base's update date. The backend sends Go's zero time
 * (0001-01-01T00:00:00Z) while the WhatsMyName base has never been updated:
 * that is not a date, and is shown as such.
 */
function baseDate(iso?: string): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() < 2000) return null
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

/* What the URL of a found profile shows best: host and path, without the scheme. */
function shortUrl(url: string) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

const STATUS: Record<OSINTJobSummary['status'], { label: string; tone: string }> = {
  pending: { label: 'En attente', tone: 'wait' },
  running: { label: 'En cours', tone: 'busy' },
  done: { label: 'Terminée', tone: 'ok' },
  error: { label: 'Échec', tone: 'bad' },
}

function StatusTag({ status }: { status: OSINTJobSummary['status'] }) {
  const s = STATUS[status]
  return (
    <span className={`os26-status is-${s.tone}`}>
      {status === 'running' ? <Loader2 size={11} className="os26-spin" aria-hidden="true" /> : <i aria-hidden="true" />}
      {s.label}
    </span>
  )
}

/* Measured in this browser from the job's creation time: labelled as such. */
function LocalTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(() => Date.now() - new Date(startedAt).getTime())
  useEffect(() => {
    const base = new Date(startedAt).getTime()
    const iv = window.setInterval(() => setElapsed(Date.now() - base), 1000)
    return () => clearInterval(iv)
  }, [startedAt])
  return <span className="os26-timer" title="Mesuré localement par le navigateur">Chrono local · {formatDuration(Math.max(0, elapsed))}</span>
}

function useDensity() {
  const [density, setDensity] = useState<Density>(() => {
    try { return localStorage.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'comfort' } catch { return 'comfort' }
  })
  const update = (next: Density) => {
    setDensity(next)
    try { localStorage.setItem(DENSITY_KEY, next) } catch { /* storage may be denied */ }
  }
  return [density, update] as const
}

/* A discreet, stable marker per category (cool tones only). */
const MARKS = ['#4fd0e6', '#8fd3ff', '#6aa8ff', '#7fe0c8', '#b6c8ff', '#5fb3c6']
function markOf(category: string) {
  let h = 0
  for (const c of category) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return MARKS[h % MARKS.length]
}

export default function OSINTRunner() {
  const navigate = useNavigate()
  const [meta, setMeta] = useState<WMNMeta | null>(null)
  const [metaError, setMetaError] = useState(false)
  const [username, setUsername] = useState('')
  const [category, setCategory] = useState('')
  const [editing, setEditing] = useState(false)
  // Back to the search: the report is kept (to reopen it), only its view is left.
  const [reportHidden, setReportHidden] = useState(false)
  const [distOpen, setDistOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [runUsername, setRunUsername] = useState('')
  const [activeJobId, setActiveJobId] = useState<number | null>(null)
  const [progress, setProgress] = useState<SSEProgress | null>(null)
  const [trackingLost, setTrackingLost] = useState(false)
  const [detail, setDetail] = useState<OSINTJobDetail | null>(null)
  const [jobs, setJobs] = useState<OSINTJobSummary[]>([])
  const [jobsState, setJobsState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [view, setView] = useState<ResultView>('found')
  const [query, setQuery] = useState('')
  const [catFilter, setCatFilter] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('name-asc')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [missingLimit, setMissingLimit] = useState(MISSING_STEP)
  const [density, setDensity] = useDensity()
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState<{ jobId: number; created: number; skipped: number } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<OSINTJobSummary | null>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Each follow-up is a session: an answer from a stopped or replaced one is ignored.
  const pollSession = useRef(0)
  // A run request may resolve after unmount or after another run was accepted.
  const runSession = useRef(0)
  // The polling request in flight, cancelled with its session.
  const pollAbort = useRef<AbortController | null>(null)
  // The latest opening from the history: a newer one (or a new search) cancels it.
  const reviewAbort = useRef<AbortController | null>(null)
  const failures = useRef(0)
  const reportRef = useRef<HTMLElement>(null)
  const commandRef = useRef<HTMLElement>(null)
  // The report takes focus; its command bar (and the way back) stays in view.
  const focusReport = () => requestAnimationFrame(() => {
    reportRef.current?.focus({ preventScroll: true })
    commandRef.current?.scrollIntoView({ block: 'nearest' })
  })
  const inputRef = useRef<HTMLInputElement>(null)
  const historyButton = useRef<HTMLButtonElement>(null)
  const historyHeading = useRef<HTMLHeadingElement>(null)
  const ids = { input: useId(), hint: useId(), error: useId(), ops: useId(), report: useId(), history: useId(), dist: useId(), recent: useId(), sort: useId() }

  const loadJobs = useCallback(() => {
    setJobsState('loading')
    osintWmnApi.listJobs()
      .then(r => { setJobs(r.jobs ?? []); setJobsState('ready') })
      .catch(() => setJobsState('error'))
  }, [])

  useEffect(() => {
    osintWmnApi.getMeta().then(setMeta).catch(() => setMetaError(true))
    loadJobs()
  }, [loadJobs])

  const stopPolling = useCallback(() => {
    pollSession.current += 1
    pollAbort.current?.abort()
    pollAbort.current = null
    if (pollRef.current !== null) { clearTimeout(pollRef.current); pollRef.current = null }
  }, [])

  // A new report: its explorer starts on the profiles found, unfiltered.
  const showReport = useCallback((job: OSINTJobDetail) => {
    setDetail(job)
    setReportHidden(false)
    setView(job.found_count > 0 || job.status === 'done' ? 'found' : 'issues')
    setQuery('')
    setCatFilter(null)
    setExpanded(new Set())
    setMissingLimit(MISSING_STEP)
  }, [])

  const startPolling = useCallback((jobId: number) => {
    stopPolling()
    const session = pollSession.current
    failures.current = 0
    setTrackingLost(false)
    // One request at a time: the next one is scheduled once the previous one has answered.
    const poll = async () => {
      pollRef.current = null
      const controller = new AbortController()
      pollAbort.current = controller
      try {
        const job = await osintWmnApi.getJob(jobId, controller.signal)
        if (session !== pollSession.current) return
        failures.current = 0
        setTrackingLost(false)
        setProgress({
          checked_sites: job.checked_sites,
          total_sites: job.total_sites,
          found_count: job.found_count,
          status: job.status,
          latest_results: (job.results ?? []).filter(r => r.status === 'found').slice(-5),
        })
        if (job.status === 'done' || job.status === 'error') {
          stopPolling()
          setRunning(false)
          showReport(job)
          setJobs(prev => prev.map(j => j.id === jobId
            ? { ...j, status: job.status, found_count: job.found_count, checked_sites: job.checked_sites, total_sites: job.total_sites, duration: job.duration }
            : j))
          if (job.status === 'done') toast.success(`Recherche terminée : ${job.found_count} profil${job.found_count > 1 ? 's' : ''} trouvé${job.found_count > 1 ? 's' : ''}`)
          else toast.error('La recherche s’est terminée en échec')
        }
      } catch {
        // A cancellation always comes with a stopped session: it is never counted as a failure.
        if (session !== pollSession.current) return
        // Keep polling; after a few failed attempts in a row, say the tracking is interrupted.
        failures.current += 1
        if (failures.current >= 3) setTrackingLost(true)
      }
      if (pollAbort.current === controller) pollAbort.current = null
      if (session === pollSession.current) pollRef.current = setTimeout(poll, 1000)
    }
    pollRef.current = setTimeout(poll, 1000)
  }, [stopPolling, showReport])

  useEffect(() => () => {
    runSession.current += 1
    stopPolling()
    reviewAbort.current?.abort()
  }, [stopPolling])

  const trimmed = username.trim()
  const invalid = trimmed.length > 0 && !USERNAME_RE.test(trimmed)
  const badChars = invalid ? [...new Set(trimmed.replace(/[a-zA-Z0-9_-]/g, ''))].map(c => (c === ' ' ? 'espace' : `« ${c} »`)).join(', ') : ''

  // One scan at a time. The previous report stays on screen until the new one is ready.
  const launch = async (target: string, scope: string) => {
    if (running) return
    if (!USERNAME_RE.test(target)) {
      toast.error('Pseudonyme invalide : lettres, chiffres, tirets et underscores, 50 caractères au plus')
      return
    }
    const session = ++runSession.current
    // An opening still loading from the history must not take over the new search.
    reviewAbort.current?.abort()
    setRunning(true)
    setRunUsername(target)
    setProgress(null)
    setImported(null)
    setEditing(false)
    setReportHidden(false)
    try {
      const { job_id } = await osintWmnApi.run(target, scope)
      if (session !== runSession.current) return
      setActiveJobId(job_id)
      setJobs(prev => [{
        id: job_id, username: target, status: 'running',
        total_sites: meta?.site_count ?? 0, checked_sites: 0, found_count: 0,
        filter_category: scope, duration: 0, launched_by: '', created_at: new Date().toISOString(),
      }, ...prev])
      startPolling(job_id)
    } catch {
      if (session !== runSession.current) return
      toast.error('Impossible de lancer la recherche')
      setRunning(false)
    }
  }
  const handleRun = (event?: FormEvent) => { event?.preventDefault(); void launch(trimmed, category) }
  const relaunch = () => {
    if (!detail) return
    setUsername(detail.username)
    setCategory(detail.filter_category)
    void launch(detail.username, detail.filter_category)
  }
  // Adjust the current search: the form opens above the report, which stays in view.
  const editSearch = () => {
    if (detail) { setUsername(detail.username); setCategory(detail.filter_category) }
    setEditing(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }
  // Leave the report: the full search, with the last search and its scope kept.
  // Nothing is sent; a running scan goes on and stays followed.
  const backToSearch = () => {
    const last = detail ?? null
    if (running) setUsername(runUsername)
    else if (last) { setUsername(last.username); setCategory(last.filter_category) }
    setEditing(false)
    setReportHidden(true)
    setHistoryOpen(false)
    requestAnimationFrame(() => inputRef.current?.focus())
  }
  const backToReport = () => {
    setEditing(false)
    setReportHidden(false)
    focusReport()
  }

  const closeHistory = useCallback(() => {
    setHistoryOpen(false)
    requestAnimationFrame(() => historyButton.current?.focus())
  }, [])
  useEffect(() => {
    if (!historyOpen) return
    historyHeading.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented && !deleteTarget) closeHistory() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [historyOpen, closeHistory, deleteTarget])

  const handleReview = async (job: OSINTJobSummary) => {
    reviewAbort.current?.abort()
    const controller = new AbortController()
    reviewAbort.current = controller
    try {
      const d = await osintWmnApi.getJob(job.id, controller.signal)
      // Only the latest opening applies, even if the transport answered despite the cancellation.
      if (controller.signal.aborted) return
      setImported(null)
      setHistoryOpen(false) // the report opens with the history closed
      if (d.status === 'running' || d.status === 'pending') {
        // A search still running (launched earlier): follow it.
        setActiveJobId(job.id)
        setRunning(true)
        setRunUsername(d.username)
        setProgress(null)
        setReportHidden(false)
        startPolling(job.id)
      } else {
        if (!running) { stopPolling(); setActiveJobId(job.id) }
        setEditing(false)
        showReport(d)
        focusReport()
      }
    } catch {
      if (controller.signal.aborted) return
      toast.error('Impossible de charger cette opération')
    }
  }

  const confirmDelete = async () => {
    const target = deleteTarget
    if (!target) return
    try {
      await osintWmnApi.deleteJob(target.id)
      setJobs(prev => prev.filter(j => j.id !== target.id))
      if (detail?.id === target.id) setDetail(null)
      if (activeJobId === target.id && !running) setActiveJobId(null)
      toast.success('Opération supprimée')
    } catch {
      toast.error('Impossible de supprimer cette opération')
    } finally {
      setDeleteTarget(null)
    }
  }

  const found = useMemo(() => detail?.results.filter(r => r.status === 'found') ?? [], [detail])
  const issues = useMemo(() => detail?.results.filter(r => r.status === 'error' || r.status === 'timeout') ?? [], [detail])
  const missing = useMemo(() => detail?.results.filter(r => r.status === 'not_found') ?? [], [detail])

  // Where the profiles found concentrate: the leading categories, then « Autres ».
  const distribution = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of found) if (r.category) counts.set(r.category, (counts.get(r.category) ?? 0) + 1)
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    const top = sorted.slice(0, TOP_CATEGORIES)
    const rest = sorted.slice(TOP_CATEGORIES)
    const rows = top.map(([name, n]) => ({ key: name, label: name, detail: name, n }))
    if (rest.length) rows.push({ key: OTHERS, label: 'Autres', detail: `Autres (${rest.map(([name]) => name).join(', ')})`, n: rest.reduce((s, [, n]) => s + n, 0) })
    return { rows, top: new Set(top.map(([name]) => name)), max: Math.max(1, ...rows.map(r => r.n)) }
  }, [found])

  const handleImport = async () => {
    if (!detail) return
    setImporting(true)
    try {
      const r = await osintWmnApi.importIoc(detail.id)
      setImported({ jobId: detail.id, created: r.created, skipped: r.skipped })
      toast.success(`${r.created} IOC importé${r.created > 1 ? 's' : ''} (${r.skipped} doublon${r.skipped > 1 ? 's' : ''} ignoré${r.skipped > 1 ? 's' : ''})`)
    } catch {
      toast.error('Erreur lors de l’import en IOC')
    } finally {
      setImporting(false)
    }
  }

  const copy = async (text: string, done: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(done) }
    catch { toast.error('Impossible de copier dans le presse-papiers') }
  }

  const needle = query.trim().toLowerCase()
  const inCategory = (r: OSINTResult) => !catFilter || (catFilter === OTHERS ? !distribution.top.has(r.category) : r.category === catFilter)
  const match = (r: OSINTResult) => inCategory(r) && (!needle || r.site_name.toLowerCase().includes(needle) || r.category.toLowerCase().includes(needle))
  const tab = view === 'found' ? found : view === 'issues' ? issues : missing
  const byOrder = (a: OSINTResult, b: OSINTResult) =>
    sort === 'name-asc' ? a.site_name.localeCompare(b.site_name, 'fr')
      : sort === 'name-desc' ? b.site_name.localeCompare(a.site_name, 'fr')
        : sort === 'time-asc' ? a.response_time - b.response_time : b.response_time - a.response_time
  const shown = tab.filter(match).sort(byOrder)
  const groups = useMemo(() => {
    const map = new Map<string, OSINTResult[]>()
    for (const r of shown) map.set(r.category || 'autres', [...(map.get(r.category || 'autres') ?? []), r])
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
  }, [shown])
  const tabCategories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of tab) counts.set(r.category || 'autres', (counts.get(r.category || 'autres') ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [tab])
  const clearFilters = () => { setQuery(''); setCatFilter(null) }
  const catLabel = catFilter === OTHERS ? 'Autres catégories' : catFilter

  const runningJob = jobs.find(j => j.id === activeJobId)
  const dbDate = baseDate(meta?.last_updated)
  // A report open: the compact command bar. Otherwise (and during a scan): the workstation.
  const compact = !!detail && !running && !editing && !reportHidden
  const canReturn = !!detail && !running && (editing || reportHidden)
  // The lens belongs to preparing and running a search, not above an open report.
  const showLens = running || !detail || reportHidden
  const lensTarget = running ? runUsername : USERNAME_RE.test(trimmed) ? trimmed : null
  const outcome = !detail ? null : detail.status === 'error' ? (detail.results.length > 0 ? 'partial' : 'failed') : detail.found_count > 0 ? 'found' : 'empty'
  const historyLabel = `Historique des opérations${jobsState === 'ready' ? ` (${jobs.length})` : ''}`

  const historyToggle = (
    <button type="button" ref={historyButton} className="os26-btn os26-history-toggle" aria-expanded={historyOpen} aria-controls={ids.history}
      onClick={() => (historyOpen ? closeHistory() : setHistoryOpen(true))}>
      <History size={15} aria-hidden="true" />{historyLabel}
    </button>
  )

  return (
    <div className="os26" data-density={density}>
      <div className="os26-top">
        <ModuleHero breadcrumb="OPS / OPEN SOURCE INTELLIGENCE" title="OSINT" accent="RUNNER" typeOnce="osint"
          subtitle={`Rechercher un pseudonyme sur ${meta ? meta.site_count.toLocaleString('fr-FR') : 'les'} sites référencés par WhatsMyName, puis exploiter les profils trouvés.`}
          motif={<OsintMotif active={running} />}
          index={{
            label: 'OPS / 2026',
            lines: ['PSEUDONYMES', 'PROFILS PUBLICS', 'IMPORT IOC'],
            status: meta
              ? { text: `${meta.site_count.toLocaleString('fr-FR')} SITES`, mark: 'WMN' }
              : metaError ? { text: 'BASE INDISPONIBLE', tone: 'warn' } : undefined,
          }} />
      </div>

      <div className={`os26-workspace${historyOpen ? ' has-history' : ''}`}>
        <div className="os26-main">
          {compact ? (
            /* After a search: a compact command bar, the report comes first. */
            <section className="os26-command" aria-label="Recherche" ref={commandRef}>
              <button type="button" className="os26-back" onClick={backToSearch}>
                <ArrowLeft size={15} aria-hidden="true" />Retour à la recherche
              </button>
              <dl>
                <div><dt>Pseudonyme</dt><dd className="is-target">@{running ? runUsername : detail?.username}</dd></div>
                <div><dt>Périmètre</dt><dd>{(running ? category : detail?.filter_category) || 'Tous les sites'}</dd></div>
              </dl>
              <div className="os26-command-actions">
                <button type="button" className="os26-btn" onClick={editSearch}><SlidersHorizontal size={15} aria-hidden="true" />Modifier la recherche</button>
                <button type="button" className="os26-btn is-primary" onClick={relaunch} disabled={running || !detail}>
                  {running ? <Loader2 size={15} className="os26-spin" aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />}
                  {running ? 'Recherche en cours…' : 'Relancer'}
                </button>
                {historyToggle}
              </div>
            </section>
          ) : (
            /* Before a search, during it, or to change it: the search workstation. */
            <section className={`os26-ops${showLens ? ' has-lens' : ''}`} aria-labelledby={ids.ops}>
              <div className="os26-command-area">
                <header className="os26-ops-head">
                  <span className="os26-kicker">SEARCH OPERATIONS</span>
                  <h2 id={ids.ops}>Rechercher un pseudonyme</h2>
                  {meta ? (
                    <p className="os26-source"><Database size={13} aria-hidden="true" />WhatsMyName · {dbDate ? `base du ${dbDate}` : 'base jamais mise à jour'}</p>
                  ) : metaError ? (
                    <p className="os26-source is-warn" role="status"><AlertTriangle size={13} aria-hidden="true" />Informations de la base WhatsMyName indisponibles</p>
                  ) : null}
                </header>

                <form className="os26-form" onSubmit={handleRun} noValidate>
                  <div className="os26-field">
                    <label htmlFor={ids.input}>Pseudonyme ciblé</label>
                    <div className={`os26-input${invalid ? ' is-invalid' : ''}`}>
                      <span aria-hidden="true">@</span>
                      <input ref={inputRef} id={ids.input} type="text" value={username} onChange={e => setUsername(e.target.value)}
                        placeholder="ex. jdoe_42" autoComplete="off" spellCheck={false} maxLength={80} disabled={running}
                        aria-invalid={invalid} aria-describedby={invalid ? `${ids.error} ${ids.hint}` : ids.hint} />
                      {username && !running && (
                        <button type="button" className="os26-clear" onClick={() => setUsername('')} aria-label="Effacer le pseudonyme"><X size={14} /></button>
                      )}
                    </div>
                    {invalid && <p id={ids.error} className="os26-error" role="alert">Caractères non acceptés : {badChars || 'longueur'} — utilisez lettres, chiffres, « - » et « _ ».</p>}
                    <p id={ids.hint} className="os26-hint">Lettres, chiffres, tirets et underscores · 50 caractères au plus.</p>
                  </div>
                  <button type="submit" className="os26-run" disabled={running || !trimmed || invalid}>
                    {running ? <Loader2 size={17} className="os26-spin" aria-hidden="true" /> : <Search size={17} aria-hidden="true" />}
                    {running ? 'Recherche en cours…' : 'Lancer la recherche'}
                  </button>
                </form>

                <div className="os26-scope">
                  <span className="os26-scope-label">Périmètre</span>
                  <p className="os26-scope-summary">
                    {category ? <>Catégorie <b>{category}</b></> : <><b>Tous les sites</b>{meta && <> · {meta.site_count.toLocaleString('fr-FR')} référencés</>}</>}
                  </p>
                  {meta && meta.categories.length > 0 && (
                    <ChoiceMenu title="Périmètre de recherche" value={category} onChange={setCategory} filterable disabled={running}
                      button={<>{category ? 'Changer de catégorie' : 'Choisir une catégorie'}</>}
                      choices={[{ value: '', label: 'Tous les sites', count: meta.site_count }, ...meta.categories.map(c => ({ value: c, label: c }))]} />
                  )}
                </div>

                <div className="os26-ops-foot">
                  {canReturn ? (
                    <button type="button" className="os26-btn" onClick={backToReport}>
                      <ArrowLeft size={14} aria-hidden="true" />Revenir au rapport @{detail?.username}
                    </button>
                  ) : (
                    <p className="os26-help">Chaque site du périmètre est vérifié au fil du scan ; les profils trouvés s’ouvrent, se copient ou s’importent en IOC.</p>
                  )}
                  {historyToggle}
                </div>
              </div>

              {showLens && (
                <SignalGlobe target={lensTarget} categories={meta?.categories ?? []} category={running ? (runningJob?.filter_category ?? category) : category}
                  siteCount={meta?.site_count ?? null} running={running} warn={trackingLost}
                  progress={progress ? { checked: progress.checked_sites, total: progress.total_sites, found: progress.found_count } : null}
                  last={!running && detail && reportHidden && trimmed === detail.username && category === detail.filter_category
                    ? { username: detail.username, status: detail.status === 'error' ? 'error' : 'done', found: detail.found_count, checked: detail.checked_sites, total: detail.total_sites }
                    : null} />
              )}
            </section>
          )}

          {/* The running operation: real progress from the server. */}
          {running && (
            <section className="os26-run-state" aria-live="polite" aria-label={`Recherche de ${runUsername} en cours`}>
              <div className="os26-run-head">
                <Radio size={16} className="os26-run-icon" aria-hidden="true" />
                <div>
                  <span className="os26-kicker">OPÉRATION EN COURS{activeJobId ? ` · #${activeJobId}` : ''}</span>
                  <strong>@{runUsername}</strong>
                </div>
                {runningJob && <LocalTimer startedAt={runningJob.created_at} />}
              </div>
              {progress && progress.latest_results.length > 0 && (
                <ul className="os26-latest" aria-label="Derniers profils trouvés">
                  {progress.latest_results.map(r => (
                    <li key={r.url}>
                      <span>{r.site_name}</span>
                      <a href={r.url} target="_blank" rel="noreferrer">{shortUrl(r.url)}<ExternalLink size={11} aria-hidden="true" /></a>
                    </li>
                  ))}
                </ul>
              )}
              {trackingLost && (
                <p className="os26-warn" role="alert"><AlertTriangle size={14} aria-hidden="true" />Suivi interrompu : le serveur ne répond pas. Nouvelle tentative chaque seconde.</p>
              )}
              <p className="os26-footnote">Une recherche lancée ne peut pas être interrompue depuis l’interface.{detail ? ' Le rapport précédent reste affiché jusqu’à la fin du scan.' : ''}</p>
            </section>
          )}

          {detail && !reportHidden ? (
            <section className="os26-report" aria-labelledby={ids.report} ref={reportRef} tabIndex={-1}>
              {/* Operation intelligence: what was searched, how it went, what was found. */}
              <header className={`os26-intel is-${outcome}`}>
                <div className="os26-intel-id">
                  <span className="os26-kicker">{running ? 'RAPPORT PRÉCÉDENT' : 'OPERATION INTELLIGENCE'} · #{detail.id}</span>
                  <h2 id={ids.report}>@{detail.username}</h2>
                  <p className="os26-report-meta">
                    <StatusTag status={detail.status} />
                    {outcome === 'partial' && <span className="os26-flag">Résultats partiels</span>}
                    <span>{detail.filter_category ? `Catégorie ${detail.filter_category}` : 'Tous les sites'}</span>
                    <span>Lancée {relativeTime(detail.created_at)}</span>
                  </p>
                </div>
                <div className="os26-intel-lead">
                  <strong>{detail.found_count.toLocaleString('fr-FR')}</strong>
                  <span>{outcome === 'empty' ? 'aucun profil trouvé' : `profil${detail.found_count > 1 ? 's' : ''} trouvé${detail.found_count > 1 ? 's' : ''}${outcome === 'partial' ? ' avant l’échec' : ''}`}</span>
                </div>
                <dl className="os26-intel-figures">
                  <div><dt>Sites vérifiés</dt><dd>{detail.checked_sites.toLocaleString('fr-FR')}<small> / {detail.total_sites.toLocaleString('fr-FR')}</small></dd></div>
                  <div className={issues.length ? 'is-issue' : ''}><dt>Erreurs et délais</dt><dd>{issues.length.toLocaleString('fr-FR')}</dd></div>
                  <div><dt>Durée serveur</dt><dd>{formatDuration(detail.duration)}</dd></div>
                </dl>
              </header>

              {(outcome === 'failed' || outcome === 'partial') && (
                <p className="os26-warn is-block" role="alert">
                  <AlertTriangle size={15} aria-hidden="true" />
                  La recherche s’est terminée en échec côté serveur.
                  {outcome === 'partial'
                    ? ` Résultats partiels : ${detail.checked_sites.toLocaleString('fr-FR')} sites vérifiés sur ${detail.total_sites.toLocaleString('fr-FR')}.`
                    : ' Aucun résultat n’a été enregistré.'}
                </p>
              )}

              <div className="os26-report-actions">
                <button type="button" className="os26-btn is-primary" onClick={handleImport} disabled={importing || found.length === 0}>
                  {importing ? <Loader2 size={15} className="os26-spin" aria-hidden="true" /> : <Download size={15} aria-hidden="true" />}
                  Importer en IOC ({found.length})
                </button>
                <button type="button" className="os26-btn" disabled={found.length === 0}
                  onClick={() => copy(found.map(r => r.url).join('\n'), `${found.length} URL copiée${found.length > 1 ? 's' : ''}`)}>
                  <Copy size={15} aria-hidden="true" />Copier les URLs
                </button>
                {distribution.rows.length > 0 && (
                  <button type="button" className="os26-btn os26-dist-toggle" aria-expanded={distOpen} aria-controls={ids.dist}
                    onClick={() => setDistOpen(!distOpen)}>
                    <BarChart3 size={15} aria-hidden="true" />{distOpen ? 'Masquer la répartition' : 'Voir la répartition'}
                  </button>
                )}
                {imported?.jobId === detail.id && (
                  <p className="os26-note" role="status">
                    <CheckCircle2 size={15} aria-hidden="true" />
                    {imported.created} IOC créé{imported.created > 1 ? 's' : ''}, {imported.skipped} doublon{imported.skipped > 1 ? 's' : ''} ignoré{imported.skipped > 1 ? 's' : ''}.
                    <button type="button" onClick={() => navigate('/ioc')}>Ouvrir IOC Manager</button>
                  </p>
                )}
              </div>

              {/* Where the profiles found concentrate (real results only). */}
              {distribution.rows.length > 0 && distOpen && (
                <section id={ids.dist} className="os26-dist" aria-label="Répartition des profils trouvés par catégorie">
                  <h3>Répartition par catégorie</h3>
                  <ul>
                    {distribution.rows.map(row => (
                      <li key={row.key}>
                        <button type="button" aria-pressed={catFilter === row.key} title={row.detail}
                          aria-label={`${row.detail} : ${row.n} profil${row.n > 1 ? 's' : ''}${catFilter === row.key ? ', filtre actif' : ', filtrer les résultats'}`}
                          onClick={() => { setCatFilter(catFilter === row.key ? null : row.key); setView('found') }}>
                          <span className="os26-dist-name"><i style={{ background: row.key === OTHERS ? '#5d7689' : markOf(row.key) }} aria-hidden="true" />{row.label}</span>
                          <span className="os26-dist-bar" aria-hidden="true"><span style={{ width: `${(row.n / distribution.max) * 100}%` }} /></span>
                          <b>{row.n}</b>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Results explorer. */}
              <div className="os26-explorer">
                <div className="os26-controls" role="group" aria-label="Contrôles des résultats">
                  <div className="os26-tabs" role="group" aria-label="Résultats à afficher">
                    {([['found', 'Profils trouvés', found.length], ['issues', 'Erreurs et délais', issues.length], ['missing', 'Non trouvés', missing.length]] as const).map(([id, label, n]) => (
                      <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>{label}<span>{n.toLocaleString('fr-FR')}</span></button>
                    ))}
                  </div>
                  <div className="os26-controls-tools">
                    <label className="os26-filter">
                      <Search size={14} aria-hidden="true" />
                      <span className="os26-sr">Filtrer les résultats par site ou catégorie</span>
                      <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Filtrer par site" />
                    </label>
                    <ChoiceMenu title="Filtrer par catégorie" value={catFilter ?? ''} onChange={v => setCatFilter(v || null)}
                      className="is-tool" filterable={tabCategories.length > 8}
                      button={<>Catégorie : <b>{catFilter ? catLabel : 'toutes'}</b></>}
                      choices={[{ value: '', label: 'Toutes les catégories', count: tab.length }, ...tabCategories.map(([c, n]) => ({ value: c, label: c, count: n }))]} />
                    <label className="os26-sort" htmlFor={ids.sort}>
                      <ArrowUpDown size={14} aria-hidden="true" />
                      <span className="os26-sr">Trier les résultats</span>
                      <select id={ids.sort} value={sort} onChange={e => setSort(e.target.value as Sort)}>
                        {SORTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    <div className="os26-density" role="group" aria-label="Densité des résultats">
                      <button type="button" aria-pressed={density === 'comfort'} onClick={() => setDensity('comfort')}>Confort</button>
                      <button type="button" aria-pressed={density === 'compact'} onClick={() => setDensity('compact')}>Compact</button>
                    </div>
                  </div>
                </div>
                {catFilter && (
                  <p className="os26-active-filter" role="status">
                    Catégorie : <strong>{catLabel}</strong>
                    <button type="button" onClick={() => setCatFilter(null)}><X size={13} aria-hidden="true" />Tous les résultats</button>
                  </p>
                )}

                {shown.length === 0 ? (
                  <div className="os26-empty">
                    <strong>{needle || catFilter ? 'Aucun résultat pour ce filtre' : view === 'found' ? 'Aucun profil trouvé' : view === 'issues' ? 'Aucune erreur ni délai dépassé' : 'Aucun site sans profil'}</strong>
                    {needle || catFilter
                      ? <button type="button" className="os26-btn" onClick={clearFilters}><X size={14} aria-hidden="true" />Effacer les filtres</button>
                      : <span>{view === 'found' && detail.status === 'done' ? `Le pseudonyme @${detail.username} n’apparaît sur aucun des sites vérifiés.` : ''}</span>}
                  </div>
                ) : view === 'missing' ? (
                  <>
                    <ul className="os26-missing" aria-label="Sites sans profil">
                      {shown.slice(0, missingLimit).map(r => <li key={`${r.site_name}-${r.url}`}><span>{r.site_name}</span><small>{r.category}</small></li>)}
                    </ul>
                    {shown.length > missingLimit && (
                      <button type="button" className="os26-more" onClick={() => setMissingLimit(missingLimit + MISSING_STEP)}>
                        Voir davantage ({(shown.length - missingLimit).toLocaleString('fr-FR')} restants)
                      </button>
                    )}
                  </>
                ) : (
                  <div className="os26-groups">
                    {groups.map(([cat, rows]) => {
                      const open = expanded.has(cat)
                      const visible = open ? rows : rows.slice(0, ROWS_PER_GROUP)
                      return (
                        <section key={cat} className="os26-group" aria-label={`${cat}, ${rows.length} résultat${rows.length > 1 ? 's' : ''}`}>
                          <h3><i style={{ background: markOf(cat) }} aria-hidden="true" /><span>{cat}</span><b>{rows.length}</b></h3>
                          <ul>
                            {visible.map(r => (
                              <li key={`${r.site_name}-${r.url}`} className="os26-row">
                                <div className="os26-row-main">
                                  <strong>{r.site_name}</strong>
                                  {view === 'found'
                                    ? <a href={r.url} target="_blank" rel="noreferrer" title={r.url}>{shortUrl(r.url)}</a>
                                    : <span className={`os26-issue is-${r.status}`}>{r.status === 'timeout' ? 'Délai dépassé' : 'Erreur de vérification'}</span>}
                                </div>
                                <span className="os26-row-time" title="Temps de réponse du site">{r.response_time > 0 ? `${r.response_time} ms` : '—'}</span>
                                {view === 'found' && (
                                  <div className="os26-row-actions">
                                    <a className="os26-icon-btn" href={r.url} target="_blank" rel="noreferrer" title="Ouvrir le profil (nouvel onglet)" aria-label={`Ouvrir le profil ${r.site_name} (nouvel onglet)`}><ExternalLink size={15} /></a>
                                    <button type="button" className="os26-icon-btn" title="Copier l’URL" onClick={() => copy(r.url, 'URL copiée')} aria-label={`Copier l’URL du profil ${r.site_name}`}><Copy size={15} /></button>
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                          {rows.length > ROWS_PER_GROUP && (
                            <button type="button" className="os26-more" aria-expanded={open}
                              onClick={() => setExpanded(prev => { const next = new Set(prev); if (open) next.delete(cat); else next.add(cat); return next })}>
                              {open ? 'Voir moins' : `Voir davantage (${rows.length - ROWS_PER_GROUP})`}
                            </button>
                          )}
                        </section>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>
          ) : !running && jobsState === 'ready' && jobs.length > 0 && (
            <section className="os26-recent" aria-labelledby={ids.recent}>
              <header>
                <h2 id={ids.recent}>Opérations récentes</h2>
                <button type="button" className="os26-link" onClick={() => setHistoryOpen(true)}>Tout l’historique ({jobs.length})</button>
              </header>
              <ul>
                {jobs.slice(0, 3).map(job => (
                  <li key={job.id}>
                    <button type="button" className="os26-recent-op" onClick={() => handleReview(job)}
                      aria-label={`Ouvrir le rapport @${job.username}, ${STATUS[job.status].label}, ${job.found_count} profil${job.found_count > 1 ? 's' : ''} trouvé${job.found_count > 1 ? 's' : ''}`}>
                      <span className="os26-recent-icon" aria-hidden="true"><Radio size={15} /></span>
                      <span className="os26-recent-name" title={`@${job.username}`}>@{job.username}</span>
                      <StatusTag status={job.status} />
                      <span className="os26-recent-found"><b>{job.found_count}</b> trouvé{job.found_count > 1 ? 's' : ''}</span>
                      <span className="os26-recent-time">{relativeTime(job.created_at)}</span>
                      <ChevronRight size={15} className="os26-recent-go" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* History of operations, on demand. */}
        {historyOpen && <div className="os26-history-backdrop" onClick={closeHistory} aria-hidden="true" />}
        <aside id={ids.history} className="os26-history" aria-label="Historique des opérations" hidden={!historyOpen}>
          <header>
            <History size={15} aria-hidden="true" />
            <h2 ref={historyHeading} tabIndex={-1}>Opérations</h2>
            {jobsState === 'ready' && <span>{jobs.length}</span>}
            <button type="button" className="os26-icon-btn" onClick={closeHistory} aria-label="Fermer l’historique" title="Fermer l’historique"><X size={15} /></button>
          </header>
          {jobsState === 'loading' ? (
            <p className="os26-history-state"><Loader2 size={14} className="os26-spin" aria-hidden="true" />Chargement de l’historique…</p>
          ) : jobsState === 'error' ? (
            <div className="os26-history-state is-error" role="alert">
              <span><AlertTriangle size={14} aria-hidden="true" />Historique indisponible.</span>
              <button type="button" className="os26-btn" onClick={loadJobs}><RotateCcw size={14} aria-hidden="true" />Réessayer</button>
            </div>
          ) : jobs.length === 0 ? (
            <p className="os26-history-state">Aucune opération enregistrée.</p>
          ) : (
            <ul>
              {jobs.map(job => {
                const current = detail?.id === job.id || (running && activeJobId === job.id)
                return (
                  <li key={job.id} className={current ? 'is-current' : ''}>
                    <button type="button" className="os26-job" onClick={() => handleReview(job)} aria-current={current ? 'true' : undefined}
                      aria-label={`Ouvrir l’opération @${job.username}, ${STATUS[job.status].label}, ${job.found_count} profil${job.found_count > 1 ? 's' : ''} trouvé${job.found_count > 1 ? 's' : ''}`}>
                      <span className="os26-job-name">@{job.username}</span>
                      <StatusTag status={job.status} />
                      <span className="os26-job-meta">
                        <b>{job.found_count}</b> trouvé{job.found_count > 1 ? 's' : ''}
                        {job.total_sites > 0 && <> · {job.checked_sites}/{job.total_sites}</>}
                        {job.filter_category && <> · {job.filter_category}</>}
                      </span>
                      <span className="os26-job-time">{relativeTime(job.created_at)}{job.duration > 0 ? ` · ${formatDuration(job.duration)}` : ''}</span>
                    </button>
                    <button type="button" className="os26-icon-btn is-danger" onClick={() => setDeleteTarget(job)} title="Supprimer l’opération" aria-label={`Supprimer l’opération @${job.username}`}>
                      <Trash2 size={14} />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>
      </div>

      {deleteTarget && (
        <Dialog title="Supprimer l’opération" onClose={() => setDeleteTarget(null)} footer={<>
          <button type="button" className="os26-btn" onClick={() => setDeleteTarget(null)}>Annuler</button>
          <button type="button" className="os26-btn is-danger" onClick={confirmDelete}><Trash2 size={14} aria-hidden="true" />Supprimer</button>
        </>}>
          <p>L’opération <strong>@{deleteTarget.username}</strong> et ses résultats seront supprimés. Les IOC déjà importés sont conservés.</p>
        </Dialog>
      )}
    </div>
  )
}
