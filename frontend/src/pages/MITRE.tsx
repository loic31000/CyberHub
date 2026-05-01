import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Shield, Search, ChevronRight, ExternalLink, X,
  Loader2, RefreshCw, Globe, Monitor, Server,
  Smartphone, Cloud, Network, ChevronDown, ChevronUp,
  AlertTriangle, Database,
} from 'lucide-react'
import { mitreApi } from '@/api/client'
import type { MITRETactic, MITRETechnique, MITREStatus } from '@/types'

// ⚠️ Données MITRE ATT&CK — usage légal et éducatif uniquement

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function parseArr(raw?: string): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

/* ── Platform icons ─────────────────────────────────────────────────────── */

const PLATFORM_ICONS: Record<string, JSX.Element> = {
  Windows: <Monitor size={10} />,
  Linux:   <Server size={10} />,
  macOS:   <Monitor size={10} />,
  Android: <Smartphone size={10} />,
  iOS:     <Smartphone size={10} />,
  Cloud:   <Cloud size={10} />,
  Network: <Network size={10} />,
  IaaS:    <Cloud size={10} />,
  SaaS:    <Cloud size={10} />,
  Azure:   <Cloud size={10} />,
  'Google Workspace': <Cloud size={10} />,
  'Office 365': <Globe size={10} />,
  'Azure AD': <Cloud size={10} />,
}

const PLATFORM_COLORS: Record<string, string> = {
  Windows: 'bg-blue-900/40 text-blue-300',
  Linux:   'bg-orange-900/40 text-orange-300',
  macOS:   'bg-gray-700/60 text-gray-300',
  Cloud:   'bg-cyan-900/40 text-cyan-300',
  Network: 'bg-purple-900/40 text-purple-300',
  Android: 'bg-green-900/40 text-green-300',
  iOS:     'bg-gray-700/60 text-gray-300',
}
function platformColor(p: string): string {
  return PLATFORM_COLORS[p] ?? 'bg-slate-700/40 text-slate-300'
}

/* ── Tactic colors ─────────────────────────────────────────────────────── */

const TACTIC_COLORS: Record<string, string> = {
  'reconnaissance':      'border-l-purple-500 bg-purple-900/10',
  'resource-development':'border-l-violet-500 bg-violet-900/10',
  'initial-access':      'border-l-red-500    bg-red-900/10',
  'execution':           'border-l-orange-500 bg-orange-900/10',
  'persistence':         'border-l-yellow-500 bg-yellow-900/10',
  'privilege-escalation':'border-l-amber-500  bg-amber-900/10',
  'defense-evasion':     'border-l-lime-500   bg-lime-900/10',
  'credential-access':   'border-l-green-500  bg-green-900/10',
  'discovery':           'border-l-emerald-500 bg-emerald-900/10',
  'lateral-movement':    'border-l-teal-500   bg-teal-900/10',
  'collection':          'border-l-cyan-500   bg-cyan-900/10',
  'command-and-control': 'border-l-sky-500    bg-sky-900/10',
  'exfiltration':        'border-l-blue-500   bg-blue-900/10',
  'impact':              'border-l-rose-500   bg-rose-900/10',
}
function tacticAccent(shortname: string): string {
  return TACTIC_COLORS[shortname] ?? 'border-l-accent bg-accent/5'
}

const TACTIC_TEXT: Record<string, string> = {
  'reconnaissance':      'text-purple-400',
  'resource-development':'text-violet-400',
  'initial-access':      'text-red-400',
  'execution':           'text-orange-400',
  'persistence':         'text-yellow-400',
  'privilege-escalation':'text-amber-400',
  'defense-evasion':     'text-lime-400',
  'credential-access':   'text-green-400',
  'discovery':           'text-emerald-400',
  'lateral-movement':    'text-teal-400',
  'collection':          'text-cyan-400',
  'command-and-control': 'text-sky-400',
  'exfiltration':        'text-blue-400',
  'impact':              'text-rose-400',
}
function tacticText(shortname: string): string {
  return TACTIC_TEXT[shortname] ?? 'text-accent'
}

/* ── Composant technique card ───────────────────────────────────────────── */

interface TechCardProps {
  t: MITRETechnique
  activeTactic: string
  onSelect: (t: MITRETechnique) => void
  selected: boolean
}

function TechCard({ t, activeTactic, onSelect, selected }: TechCardProps) {
  const tactics = parseArr(t.tactics)
  const platforms = parseArr(t.platforms).slice(0, 4)
  const accentTactic = activeTactic || tactics[0] || ''

  return (
    <button
      onClick={() => onSelect(t)}
      className={`
        w-full text-left rounded border border-l-2 p-3 transition-all duration-150 cursor-pointer
        ${selected
          ? 'border-accent/60 ' + tacticAccent(accentTactic) + ' ring-1 ring-accent/30'
          : 'border-border hover:border-accent/40 ' + tacticAccent(accentTactic)
        }
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="font-mono text-[11px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded flex-shrink-0">
          {t.technique_id}
        </span>
        {t.is_subtechnique && (
          <span className="text-[9px] text-text-muted bg-border/40 px-1 py-0.5 rounded flex-shrink-0">
            sub
          </span>
        )}
      </div>
      <p className="text-xs font-medium text-text-primary leading-tight mb-2 line-clamp-2">
        {t.name}
      </p>

      {/* Platforms */}
      <div className="flex flex-wrap gap-1">
        {platforms.map(p => (
          <span key={p} className={`flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded ${platformColor(p)}`}>
            {PLATFORM_ICONS[p] ?? <Globe size={9} />}
            {p}
          </span>
        ))}
        {parseArr(t.platforms).length > 4 && (
          <span className="text-[9px] text-text-muted">+{parseArr(t.platforms).length - 4}</span>
        )}
      </div>
    </button>
  )
}

/* ── Panneau de détail ──────────────────────────────────────────────────── */

interface DetailPanelProps {
  technique: MITRETechnique | null
  loading: boolean
  onClose: () => void
  tactics: MITRETactic[]
}

function DetailPanel({ technique, loading, onClose, tactics }: DetailPanelProps) {
  const [showDetection, setShowDetection] = useState(false)

  useEffect(() => { setShowDetection(false) }, [technique?.technique_id])

  const tacticNames = parseArr(technique?.tactics)
    .map(sn => tactics.find(t => t.short_name === sn)?.name ?? sn)

  const platforms = parseArr(technique?.platforms)
  const dataSources = parseArr(technique?.data_sources)

  return (
    <div className="w-[420px] flex-shrink-0 border-l border-border flex flex-col h-full bg-bg-secondary">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        {loading ? (
          <div className="flex items-center gap-2 text-text-muted text-sm">
            <Loader2 size={14} className="animate-spin" />
            Chargement…
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded flex-shrink-0">
              {technique?.technique_id}
            </span>
            <span className="text-sm font-medium text-text-primary truncate">
              {technique?.name}
            </span>
          </div>
        )}
        <button onClick={onClose} className="text-text-muted hover:text-text-primary ml-2 flex-shrink-0">
          <X size={16} />
        </button>
      </div>

      {/* Corps */}
      {technique && !loading && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">

          {/* Tactiques */}
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Tactiques</p>
            <div className="flex flex-wrap gap-1.5">
              {tacticNames.map(tn => {
                const sn = tactics.find(t => t.name === tn)?.short_name ?? ''
                return (
                  <span key={tn} className={`text-xs px-2 py-0.5 rounded font-medium ${tacticText(sn)} bg-current/10`}
                    style={{ background: 'rgba(255,255,255,0.05)' }}>
                    {tn}
                  </span>
                )
              })}
            </div>
          </div>

          {/* Platforms */}
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Plateformes</p>
            <div className="flex flex-wrap gap-1.5">
              {platforms.map(p => (
                <span key={p} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded ${platformColor(p)}`}>
                  {PLATFORM_ICONS[p] ?? <Globe size={10} />}
                  {p}
                </span>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Description</p>
            <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">
              {technique.description?.replace(/\(Citation:[^)]+\)/g, '').trim() || '—'}
            </p>
          </div>

          {/* Détection */}
          {technique.detection && (
            <div>
              <button
                className="flex items-center gap-1.5 text-[10px] text-text-muted uppercase tracking-wider hover:text-accent transition-colors w-full"
                onClick={() => setShowDetection(v => !v)}
              >
                <Shield size={10} />
                Détection
                {showDetection ? <ChevronUp size={10} className="ml-auto" /> : <ChevronDown size={10} className="ml-auto" />}
              </button>
              {showDetection && (
                <p className="mt-2 text-xs text-text-secondary leading-relaxed whitespace-pre-line">
                  {technique.detection.replace(/\(Citation:[^)]+\)/g, '').trim()}
                </p>
              )}
            </div>
          )}

          {/* Sources de données */}
          {dataSources.length > 0 && (
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Sources de données</p>
              <div className="flex flex-wrap gap-1">
                {dataSources.slice(0, 8).map(ds => (
                  <span key={ds} className="text-[9px] px-1.5 py-0.5 rounded bg-border/50 text-text-muted">
                    {ds.split(':').pop()?.trim() ?? ds}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Lien MITRE */}
          {technique.url && (
            <a
              href={technique.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition-colors"
            >
              <ExternalLink size={12} />
              Voir sur attack.mitre.org
            </a>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Page principale ────────────────────────────────────────────────────── */

const PLATFORMS_FILTER = ['Windows', 'Linux', 'macOS', 'Cloud', 'Network', 'Android']

export default function MITRE() {
  // ── État ────────────────────────────────────────────────────────────────
  const [status, setStatus]               = useState<MITREStatus | null>(null)
  const [tactics, setTactics]             = useState<MITRETactic[]>([])
  const [techniques, setTechniques]       = useState<MITRETechnique[]>([])
  const [total, setTotal]                 = useState(0)
  const [page, setPage]                   = useState(1)
  const [loading, setLoading]             = useState(false)
  const [activeTactic, setActiveTactic]   = useState<string>('') // shortname ou ''
  const [activePlatform, setActivePlatform] = useState<string>('')
  const [query, setQuery]                 = useState('')
  const [debouncedQ, setDebouncedQ]       = useState('')
  const [showSubs, setShowSubs]           = useState(true)

  // Détail
  const [selected, setSelected]           = useState<MITRETechnique | null>(null)
  const [detailFull, setDetailFull]       = useState<MITRETechnique | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const LIMIT = 60

  // ── Polling statut seed ─────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const s = await mitreApi.status()
      setStatus(s)
      if (s.seeded && pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchStatus()
    pollRef.current = setInterval(fetchStatus, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchStatus])

  // ── Debounce recherche ──────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 300)
    return () => clearTimeout(t)
  }, [query])

  // ── Fetch tactics ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!status?.seeded) return
    mitreApi.tactics().then(setTactics).catch(() => {})
  }, [status?.seeded])

  // ── Fetch techniques ────────────────────────────────────────────────────
  const fetchTechniques = useCallback(async (pg: number) => {
    if (!status?.seeded) return
    setLoading(true)
    try {
      const res = await mitreApi.techniques({
        tactic: activeTactic || undefined,
        platform: activePlatform || undefined,
        q: debouncedQ || undefined,
        only_techniques: !showSubs || undefined,
        page: pg,
        limit: LIMIT,
      })
      setTechniques(res.items ?? [])
      setTotal(res.total)
      setPage(pg)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [status?.seeded, activeTactic, activePlatform, debouncedQ, showSubs])

  useEffect(() => { fetchTechniques(1) }, [fetchTechniques])

  // ── Fetch détail complet ────────────────────────────────────────────────
  useEffect(() => {
    if (!selected) { setDetailFull(null); return }
    setDetailLoading(true)
    mitreApi.technique(selected.technique_id)
      .then(setDetailFull)
      .catch(() => setDetailFull(selected))
      .finally(() => setDetailLoading(false))
  }, [selected?.technique_id])

  // ── Réinitialisation page lors du changement de filtre ──────────────────
  const handleTacticChange = (sn: string) => {
    setActiveTactic(sn === activeTactic ? '' : sn)
    setSelected(null)
  }
  const handlePlatformChange = (p: string) => {
    setActivePlatform(p === activePlatform ? '' : p)
    setSelected(null)
  }

  // ── Sélection d'une technique (batch updates pour éviter le crash React) ──
  const handleSelectTechnique = useCallback((t: MITRETechnique) => {
    setDetailFull(null)
    setDetailLoading(true)
    setSelected(t)
  }, [])

  const totalPages = Math.ceil(total / LIMIT)
  const currentTactic = tactics.find(t => t.short_name === activeTactic)

  /* ── UI état seed ─────────────────────────────────────────────────────── */
  if (!status) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-accent" />
      </div>
    )
  }

  if (status.seeding && !status.seeded) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
          <Database size={28} className="text-accent animate-pulse" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-text-primary mb-1">Synchronisation MITRE ATT&CK</h2>
          <p className="text-sm text-text-muted max-w-md">
            Téléchargement et indexation des techniques ATT&CK Enterprise en cours…
          </p>
          <p className="text-xs text-text-muted mt-2">
            Premier démarrage uniquement — les données seront disponibles dans quelques instants.
          </p>
        </div>
        <div className="flex items-center gap-2 text-accent text-sm">
          <Loader2 size={14} className="animate-spin" />
          Indexation en cours…
        </div>
      </div>
    )
  }

  if (!status.seeded && !status.seeding) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <AlertTriangle size={32} className="text-yellow-400" />
        <div className="text-center">
          <h2 className="text-lg font-semibold text-text-primary mb-1">Données MITRE non disponibles</h2>
          <p className="text-sm text-text-muted max-w-md">
            Le téléchargement des données ATT&CK n'a pas pu se faire (connexion requise au premier démarrage).
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
        >
          <RefreshCw size={14} />
          Réessayer
        </button>
      </div>
    )
  }

  /* ── UI principale ─────────────────────────────────────────────────────── */
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center">
              <Shield size={16} className="text-accent" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-text-primary">MITRE ATT&CK</h1>
              <p className="text-xs text-text-muted">
                {status.count} techniques · Enterprise Matrix
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Rechercher une technique…"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-bg-tertiary border border-border rounded text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/60"
              />
            </div>
            {/* Toggle sous-techniques */}
            <button
              onClick={() => setShowSubs(v => !v)}
              className={`text-xs px-2 py-1.5 rounded border transition-colors ${showSubs ? 'border-accent/60 text-accent bg-accent/10' : 'border-border text-text-muted hover:border-accent/40'}`}
              title="Afficher/masquer les sous-techniques"
            >
              T.xxx
            </button>
          </div>
        </div>

        {/* Platform filter chips */}
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          <span className="text-[10px] text-text-muted mr-1">Plateforme :</span>
          {PLATFORMS_FILTER.map(p => (
            <button
              key={p}
              onClick={() => handlePlatformChange(p)}
              className={`flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded transition-colors ${activePlatform === p ? platformColor(p) + ' ring-1 ring-current/40' : 'bg-border/30 text-text-muted hover:bg-border/60'}`}
            >
              {PLATFORM_ICONS[p] ?? <Globe size={9} />}
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* ── Corps ──────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar tactiques ─────────────────────────────────────────── */}
        <div className="w-48 flex-shrink-0 border-r border-border overflow-y-auto">
          <div className="p-2">
            <button
              onClick={() => handleTacticChange('')}
              className={`w-full text-left text-xs px-3 py-2 rounded mb-1 transition-colors ${activeTactic === '' ? 'bg-accent/20 text-accent font-medium' : 'text-text-muted hover:bg-border/30 hover:text-text-primary'}`}
            >
              Toutes les tactiques
            </button>
            <div className="h-px bg-border my-2" />
            {tactics.map(tac => (
              <button
                key={tac.tactic_id}
                onClick={() => handleTacticChange(tac.short_name)}
                className={`
                  w-full text-left text-xs px-3 py-1.5 rounded mb-0.5 transition-colors flex items-center gap-1.5
                  ${activeTactic === tac.short_name
                    ? tacticText(tac.short_name) + ' font-medium bg-current/5'
                    : 'text-text-muted hover:bg-border/30 hover:text-text-primary'
                  }
                `}
                style={activeTactic === tac.short_name ? { background: 'rgba(255,255,255,0.04)' } : undefined}
              >
                <ChevronRight
                  size={10}
                  className={activeTactic === tac.short_name ? 'opacity-100' : 'opacity-0'}
                />
                <span className="truncate">{tac.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Grille techniques ─────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Barre info résultats */}
          <div className="px-4 py-2 border-b border-border flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              {currentTactic && (
                <span className={`text-xs font-medium ${tacticText(activeTactic)}`}>
                  {currentTactic.name}
                </span>
              )}
              <span className="text-xs text-text-muted">
                {loading ? 'Chargement…' : `${total} technique${total > 1 ? 's' : ''}`}
              </span>
            </div>
            {loading && <Loader2 size={12} className="animate-spin text-accent" />}
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {techniques.length === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center h-full text-text-muted">
                <Shield size={36} className="mb-3 opacity-20" />
                <p className="text-sm">Aucune technique trouvée</p>
                {(activeTactic || activePlatform || debouncedQ) && (
                  <button
                    onClick={() => { setActiveTactic(''); setActivePlatform(''); setQuery('') }}
                    className="mt-2 text-xs text-accent hover:text-accent/80"
                  >
                    Réinitialiser les filtres
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2">
                  {techniques.map(t => (
                    <TechCard
                      key={t.technique_id}
                      t={t}
                      activeTactic={activeTactic}
                      onSelect={handleSelectTechnique}
                      selected={selected?.technique_id === t.technique_id}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6 pb-2">
                    <button
                      disabled={page === 1}
                      onClick={() => fetchTechniques(page - 1)}
                      className="text-xs px-3 py-1.5 rounded border border-border text-text-muted hover:border-accent/40 disabled:opacity-30"
                    >
                      ← Précédent
                    </button>
                    <span className="text-xs text-text-muted px-2">
                      {page} / {totalPages}
                    </span>
                    <button
                      disabled={page === totalPages}
                      onClick={() => fetchTechniques(page + 1)}
                      className="text-xs px-3 py-1.5 rounded border border-border text-text-muted hover:border-accent/40 disabled:opacity-30"
                    >
                      Suivant →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Panneau détail ────────────────────────────────────────────── */}
        {selected && (
          <DetailPanel
            technique={detailFull}
            loading={detailLoading}
            onClose={() => setSelected(null)}
            tactics={tactics}
          />
        )}
      </div>
    </div>
  )
}
