// ⚠️ CLOAK — Usage légal et éducatif uniquement.
// Ce framework recense les techniques d'anonymisation utilisées par des cybercriminels.
// Source : https://github.com/Mickinthemiddle/CLOAK (GPL-2.0)

import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  EyeOff, Search, ChevronRight, ChevronDown,
  X, ExternalLink, Loader2, AlertTriangle,
  Lock, Shield, Cpu, User, Activity,
} from 'lucide-react'
import type {
  CloakData,
  CloakTactic,
  CloakTechnique,
  CloakSubTechnique,
  CloakProcedure,
} from '@/types/cloak'

// ── Helpers ──────────────────────────────────────────────────────────────────

type CloakTypeFilter = 'Technical' | 'Behavioral' | 'Physical' | ''

function typeColor(type: string): string {
  switch (type) {
    case 'Technical':   return 'bg-red-900/40 text-red-300 border-red-700/40'
    case 'Behavioral':  return 'bg-orange-900/40 text-orange-300 border-orange-700/40'
    case 'Physical':    return 'bg-blue-900/40 text-blue-300 border-blue-700/40'
    default:            return 'bg-slate-700/40 text-slate-400 border-slate-600/40'
  }
}

function typeIcon(type: string): JSX.Element {
  switch (type) {
    case 'Technical':  return <Cpu size={10} />
    case 'Behavioral': return <User size={10} />
    case 'Physical':   return <Shield size={10} />
    default:           return <Activity size={10} />
  }
}

const TACTIC_COLORS: Record<string, string> = {
  'Anonymous browsing':       'border-l-cyan-500    bg-cyan-900/10',
  'Anonymous communication':  'border-l-blue-500    bg-blue-900/10',
  'Anonymous cryptocurrency': 'border-l-yellow-500  bg-yellow-900/10',
  'Anonymous hosting':        'border-l-purple-500  bg-purple-900/10',
  'Anonymous identity':       'border-l-pink-500    bg-pink-900/10',
  'Anonymous transactions':   'border-l-amber-500   bg-amber-900/10',
  'Data obfuscation':         'border-l-lime-500    bg-lime-900/10',
  'Physical security':        'border-l-teal-500    bg-teal-900/10',
  'Plausible deniability':    'border-l-violet-500  bg-violet-900/10',
  'Reduce attack surface':    'border-l-green-500   bg-green-900/10',
  'Risk management':          'border-l-orange-500  bg-orange-900/10',
  'Secure behavior':          'border-l-emerald-500 bg-emerald-900/10',
  'Tamper protection':        'border-l-red-500     bg-red-900/10',
}
const TACTIC_TEXT: Record<string, string> = {
  'Anonymous browsing':       'text-cyan-400',
  'Anonymous communication':  'text-blue-400',
  'Anonymous cryptocurrency': 'text-yellow-400',
  'Anonymous hosting':        'text-purple-400',
  'Anonymous identity':       'text-pink-400',
  'Anonymous transactions':   'text-amber-400',
  'Data obfuscation':         'text-lime-400',
  'Physical security':        'text-teal-400',
  'Plausible deniability':    'text-violet-400',
  'Reduce attack surface':    'text-green-400',
  'Risk management':          'text-orange-400',
  'Secure behavior':          'text-emerald-400',
  'Tamper protection':        'text-red-400',
}
function tacticAccent(name: string) {
  return TACTIC_COLORS[name] ?? 'border-l-accent bg-accent/5'
}
function tacticText(name: string) {
  return TACTIC_TEXT[name] ?? 'text-accent'
}

// ── TypeBadge ────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  if (!type) return null
  return (
    <span className={`flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded border font-medium ${typeColor(type)}`}>
      {typeIcon(type)}
      {type}
    </span>
  )
}

// ── Panneau de détail ─────────────────────────────────────────────────────────

type DetailItem =
  | { kind: 'technique';    tactic: CloakTactic; item: CloakTechnique }
  | { kind: 'subtechnique'; tactic: CloakTactic; parent: CloakTechnique; item: CloakSubTechnique }

interface DetailPanelProps {
  detail: DetailItem | null
  onClose: () => void
}

function DetailPanel({ detail, onClose }: DetailPanelProps) {
  const [showProcs, setShowProcs] = useState(true)

  useEffect(() => setShowProcs(true), [detail])

  if (!detail) return null

  const item   = detail.item
  const procs: CloakProcedure[] = item.procedures ?? []
  const subs   = detail.kind === 'technique' ? (detail.item as CloakTechnique).subtechniques ?? [] : []

  const tacticName = detail.tactic.name
  const parentName = detail.kind === 'subtechnique' ? detail.parent.name : null

  return (
    <div className="w-[400px] flex-shrink-0 border-l border-border flex flex-col h-full bg-bg-secondary">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-border gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded bg-current/10 ${tacticText(tacticName)}`}>
              {tacticName}
            </span>
            {parentName && (
              <>
                <ChevronRight size={10} className="text-text-muted flex-shrink-0" />
                <span className="text-[10px] text-text-muted truncate">{parentName}</span>
              </>
            )}
          </div>
          <p className="text-sm font-semibold text-text-primary leading-tight">{item.name}</p>
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary flex-shrink-0 mt-0.5">
          <X size={16} />
        </button>
      </div>

      {/* Corps */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">

        {/* Type */}
        {item.type && (
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Niveau</p>
            <TypeBadge type={item.type} />
          </div>
        )}

        {/* Description */}
        <div>
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Description</p>
          <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">
            {item.description?.trim() || '—'}
          </p>
        </div>

        {/* Sous-techniques (si technique) */}
        {subs.length > 0 && (
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">
              Sous-techniques ({subs.length})
            </p>
            <div className="space-y-1">
              {subs.map(st => (
                <div key={st.id} className="rounded border border-border bg-bg-primary p-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-text-primary leading-tight">{st.name}</p>
                    {st.type && <TypeBadge type={st.type} />}
                  </div>
                  {st.description && (
                    <p className="text-[11px] text-text-muted mt-1 leading-relaxed line-clamp-2">
                      {st.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Procédures */}
        {procs.length > 0 && (
          <div>
            <button
              onClick={() => setShowProcs(v => !v)}
              className="flex items-center gap-1.5 text-[10px] text-text-muted uppercase tracking-wider hover:text-accent transition-colors w-full mb-1.5"
            >
              <Lock size={10} />
              Procédures / Outils ({procs.length})
              {showProcs
                ? <ChevronDown size={10} className="ml-auto" />
                : <ChevronRight size={10} className="ml-auto" />
              }
            </button>
            {showProcs && (
              <div className="space-y-1.5">
                {procs.map((p, i) => {
                  // Extraire l'URL si présente dans la description
                  const urlMatch = p.description?.match(/https?:\/\/\S+/)
                  const url = urlMatch?.[0]?.replace(/[.)]+$/, '')
                  const cleanDesc = p.description?.replace(/https?:\/\/\S+/g, '').trim()
                  return (
                    <div key={`${p.id}-${i}`} className="rounded border border-border/50 bg-bg-primary p-2.5">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-xs font-medium text-text-primary leading-tight">{p.name}</p>
                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:text-accent/80 flex-shrink-0"
                          >
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                      {cleanDesc && (
                        <p className="text-[11px] text-text-muted leading-relaxed line-clamp-3">
                          {cleanDesc}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── TechniqueCard ─────────────────────────────────────────────────────────────

interface TechCardProps {
  tactic: CloakTactic
  tech: CloakTechnique
  selected: boolean
  onSelect: (tactic: CloakTactic, tech: CloakTechnique) => void
  onSelectSub: (tactic: CloakTactic, tech: CloakTechnique, sub: CloakSubTechnique) => void
  selectedSubId?: number
  expandedId: number | null
  onToggleExpand: (id: number) => void
}

function TechniqueCard({
  tactic, tech, selected, onSelect, onSelectSub,
  selectedSubId, expandedId, onToggleExpand,
}: TechCardProps) {
  const hasSubs = tech.subtechniques?.length > 0
  const isExpanded = expandedId === tech.id
  const totalProcs = (tech.procedures?.length ?? 0) +
    (tech.subtechniques?.reduce((a, s) => a + (s.procedures?.length ?? 0), 0) ?? 0)

  return (
    <div
      className={`
        rounded border border-l-2 transition-all duration-150
        ${selected
          ? 'border-accent/60 ring-1 ring-accent/30 ' + tacticAccent(tactic.name)
          : 'border-border hover:border-accent/30 ' + tacticAccent(tactic.name)
        }
      `}
    >
      {/* Header technique */}
      <button
        onClick={() => onSelect(tactic, tech)}
        className="w-full text-left p-3"
      >
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-current/10 flex-shrink-0 ${tacticText(tactic.name)}`}>
            TE-{tech.id}
          </span>
          {tech.type && <TypeBadge type={tech.type} />}
        </div>
        <p className="text-xs font-medium text-text-primary leading-tight mb-1.5 line-clamp-2">
          {tech.name}
        </p>
        <div className="flex items-center gap-2 text-[10px] text-text-muted">
          {hasSubs && (
            <span>{tech.subtechniques.length} sous-tech.</span>
          )}
          {totalProcs > 0 && (
            <span>{totalProcs} proc.</span>
          )}
        </div>
      </button>

      {/* Toggle sous-techniques */}
      {hasSubs && (
        <>
          <button
            onClick={() => onToggleExpand(tech.id)}
            className="w-full flex items-center gap-1 px-3 pb-1.5 text-[10px] text-text-muted hover:text-accent transition-colors"
          >
            {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            <span>{isExpanded ? 'Masquer' : 'Voir'} sous-techniques</span>
          </button>

          {isExpanded && (
            <div className="px-2 pb-2 space-y-1 border-t border-border/50 pt-2">
              {tech.subtechniques.map(sub => (
                <button
                  key={sub.id}
                  onClick={() => onSelectSub(tactic, tech, sub)}
                  className={`
                    w-full text-left rounded px-2.5 py-1.5 text-[11px] transition-colors
                    ${selectedSubId === sub.id
                      ? 'bg-accent/15 text-accent border border-accent/30'
                      : 'text-text-secondary hover:bg-border/30 hover:text-text-primary border border-transparent'
                    }
                  `}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="truncate leading-tight">{sub.name}</span>
                    {sub.type && (
                      <span className={`text-[8px] px-1 py-px rounded flex-shrink-0 ${typeColor(sub.type)}`}>
                        {sub.type.charAt(0)}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

const TYPE_FILTERS: CloakTypeFilter[] = ['Technical', 'Behavioral', 'Physical']

export default function CLOAKPage() {
  const [data, setData]                   = useState<CloakData | null>(null)
  const [loadError, setLoadError]         = useState(false)
  const [activeTacticId, setActiveTacticId] = useState<number | null>(null)
  const [typeFilter, setTypeFilter]       = useState<CloakTypeFilter>('')
  const [query, setQuery]                 = useState('')
  const [debouncedQ, setDebouncedQ]       = useState('')
  const [detail, setDetail]               = useState<DetailItem | null>(null)
  const [expandedId, setExpandedId]       = useState<number | null>(null)

  // ── Chargement du JSON ─────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/data/cloak.json')
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status)
        return r.json() as Promise<CloakData>
      })
      .then(d => {
        setData(d)
        // Activer le premier vrai tactic par défaut
        const first = d.tactics.find(t => t.name !== 'Unknown')
        if (first) setActiveTacticId(first.id)
      })
      .catch(() => setLoadError(true))
  }, [])

  // ── Debounce recherche ─────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 250)
    return () => clearTimeout(t)
  }, [query])

  // ── Tactiques réelles ──────────────────────────────────────────────────────
  const realTactics = useMemo(
    () => data?.tactics.filter(t => t.name !== 'Unknown') ?? [],
    [data],
  )

  // ── Techniques filtrées ────────────────────────────────────────────────────
  const filteredTechniques = useMemo(() => {
    if (!data) return []

    const sourceTactics = activeTacticId
      ? realTactics.filter(t => t.id === activeTacticId)
      : realTactics

    let techs: { tactic: CloakTactic; tech: CloakTechnique }[] = []
    for (const tactic of sourceTactics) {
      for (const tech of tactic.techniques) {
        techs.push({ tactic, tech })
      }
    }

    // Filtre type
    if (typeFilter) {
      techs = techs.filter(({ tech }) => {
        if (tech.type === typeFilter) return true
        if (tech.subtechniques?.some(s => s.type === typeFilter)) return true
        return false
      })
    }

    // Filtre recherche
    if (debouncedQ.trim()) {
      const q = debouncedQ.toLowerCase()
      techs = techs.filter(({ tech }) => {
        if (tech.name.toLowerCase().includes(q)) return true
        if (tech.description?.toLowerCase().includes(q)) return true
        if (tech.subtechniques?.some(s => s.name.toLowerCase().includes(q))) return true
        if (tech.procedures?.some(p => p.name.toLowerCase().includes(q))) return true
        return false
      })
    }

    return techs
  }, [data, realTactics, activeTacticId, typeFilter, debouncedQ])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectTechnique = useCallback((tactic: CloakTactic, tech: CloakTechnique) => {
    setDetail({ kind: 'technique', tactic, item: tech })
  }, [])

  const handleSelectSub = useCallback((
    tactic: CloakTactic,
    parent: CloakTechnique,
    sub: CloakSubTechnique,
  ) => {
    setDetail({ kind: 'subtechnique', tactic, parent, item: sub })
  }, [])

  const handleTacticChange = (id: number) => {
    setActiveTacticId(prev => prev === id ? null : id)
    setDetail(null)
    setExpandedId(null)
  }

  const handleToggleExpand = useCallback((id: number) => {
    setExpandedId(prev => prev === id ? null : id)
  }, [])

  // ── Stats de la tactique active ────────────────────────────────────────────
  const activeTacticStats = useMemo(() => {
    if (!activeTacticId || !data) return null
    const tac = realTactics.find(t => t.id === activeTacticId)
    if (!tac) return null
    return {
      techniques: tac.techniques.length,
      subs: tac.techniques.reduce((a, t) => a + (t.subtechniques?.length ?? 0), 0),
    }
  }, [activeTacticId, data, realTactics])

  // ── États de chargement ────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <AlertTriangle size={32} className="text-yellow-400" />
        <div className="text-center">
          <h2 className="text-lg font-semibold text-text-primary mb-1">Données CLOAK introuvables</h2>
          <p className="text-sm text-text-muted max-w-md">
            Le fichier <code className="text-accent">/data/cloak.json</code> n'est pas accessible.
            Vérifiez qu'il est bien présent dans <code className="text-accent">frontend/public/data/</code>.
          </p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-accent" />
      </div>
    )
  }

  // ── UI principale ─────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center">
              <EyeOff size={16} className="text-accent" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-text-primary">CLOAK</h1>
              <p className="text-xs text-text-muted">
                Concealment Layers for Online Anonymity and Knowledge · OpSec TTPs
              </p>
            </div>
          </div>

          {/* Recherche */}
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher une technique, outil…"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-bg-tertiary border border-border rounded text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/60"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Filtres type */}
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          <span className="text-[10px] text-text-muted mr-1">Niveau :</span>
          {TYPE_FILTERS.map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(prev => prev === t ? '' : t)}
              className={`flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded border transition-colors ${
                typeFilter === t
                  ? typeColor(t) + ' ring-1 ring-current/30'
                  : 'bg-border/30 text-text-muted border-border/50 hover:bg-border/60'
              }`}
            >
              {typeIcon(t)}
              {t}
            </button>
          ))}

          {/* Stats globales */}
          <div className="ml-auto flex items-center gap-3 text-[10px] text-text-muted">
            <span><span className="text-text-secondary font-medium">{realTactics.length}</span> tactics</span>
            <span>
              <span className="text-text-secondary font-medium">
                {realTactics.reduce((a, t) => a + t.techniques.length, 0)}
              </span> techniques
            </span>
            <span>
              <span className="text-text-secondary font-medium">
                {realTactics.reduce((a, t) => a + t.techniques.reduce((b, te) => b + (te.subtechniques?.length ?? 0), 0), 0)}
              </span> sous-tech.
            </span>
          </div>
        </div>
      </div>

      {/* ── Corps ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar tactiques ─────────────────────────────────────────────── */}
        <div className="w-52 flex-shrink-0 border-r border-border overflow-y-auto">
          <div className="p-2">
            <button
              onClick={() => { setActiveTacticId(null); setDetail(null) }}
              className={`w-full text-left text-xs px-3 py-2 rounded mb-1 transition-colors ${
                activeTacticId === null
                  ? 'bg-accent/20 text-accent font-medium'
                  : 'text-text-muted hover:bg-border/30 hover:text-text-primary'
              }`}
            >
              Toutes les tactiques
            </button>
            <div className="h-px bg-border my-2" />
            {realTactics.map(tac => {
              const techCount = tac.techniques.length
              return (
                <button
                  key={tac.id}
                  onClick={() => handleTacticChange(tac.id)}
                  className={`
                    w-full text-left text-xs px-3 py-1.5 rounded mb-0.5 transition-colors
                    flex items-center gap-1.5 group
                    ${activeTacticId === tac.id
                      ? tacticText(tac.name) + ' font-medium bg-white/[0.04]'
                      : 'text-text-muted hover:bg-border/30 hover:text-text-primary'
                    }
                  `}
                >
                  <ChevronRight
                    size={10}
                    className={activeTacticId === tac.id ? 'opacity-100 flex-shrink-0' : 'opacity-0 flex-shrink-0'}
                  />
                  <span className="flex-1 truncate leading-tight">{tac.name}</span>
                  <span className={`text-[9px] flex-shrink-0 ${activeTacticId === tac.id ? 'opacity-70' : 'opacity-40'}`}>
                    {techCount}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Grille techniques ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Barre résultats */}
          <div className="px-4 py-2 border-b border-border flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              {activeTacticId && (
                <span className={`text-xs font-medium ${tacticText(realTactics.find(t => t.id === activeTacticId)?.name ?? '')}`}>
                  {realTactics.find(t => t.id === activeTacticId)?.name}
                </span>
              )}
              <span className="text-xs text-text-muted">
                {filteredTechniques.length} technique{filteredTechniques.length !== 1 ? 's' : ''}
                {activeTacticStats && !debouncedQ && !typeFilter && (
                  <span className="ml-1 opacity-60">· {activeTacticStats.subs} sous-tech.</span>
                )}
              </span>
            </div>
            {(debouncedQ || typeFilter) && (
              <button
                onClick={() => { setQuery(''); setTypeFilter('') }}
                className="text-[10px] text-accent hover:text-accent/80"
              >
                Réinitialiser
              </button>
            )}
          </div>

          {/* Grille */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredTechniques.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-text-muted">
                <EyeOff size={36} className="mb-3 opacity-20" />
                <p className="text-sm">Aucune technique trouvée</p>
                <button
                  onClick={() => { setQuery(''); setTypeFilter(''); setActiveTacticId(null) }}
                  className="mt-2 text-xs text-accent hover:text-accent/80"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2">
                {filteredTechniques.map(({ tactic, tech }) => (
                  <TechniqueCard
                    key={`${tactic.id}-${tech.id}`}
                    tactic={tactic}
                    tech={tech}
                    selected={
                      detail?.kind === 'technique' &&
                      detail.item.id === tech.id &&
                      detail.tactic.id === tactic.id
                    }
                    selectedSubId={
                      detail?.kind === 'subtechnique' && detail.tactic.id === tactic.id
                        ? (detail.item as CloakSubTechnique).id
                        : undefined
                    }
                    onSelect={handleSelectTechnique}
                    onSelectSub={handleSelectSub}
                    expandedId={expandedId}
                    onToggleExpand={handleToggleExpand}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Panneau détail ─────────────────────────────────────────────────── */}
        {detail && (
          <DetailPanel
            detail={detail}
            onClose={() => setDetail(null)}
          />
        )}
      </div>

      {/* ── Avertissement légal ─────────────────────────────────────────────── */}
      <div className="px-4 py-1.5 border-t border-border bg-yellow-900/10 flex items-center gap-2 flex-shrink-0">
        <AlertTriangle size={11} className="text-yellow-400 flex-shrink-0" />
        <p className="text-[10px] text-yellow-300/70">
          CLOAK est un framework académique de référence destiné aux professionnels de la cybersécurité — usage légal et éducatif uniquement.
          Licence GPL-2.0 · <a href="https://github.com/Mickinthemiddle/CLOAK" target="_blank" rel="noopener noreferrer" className="underline hover:text-yellow-300">GitHub</a>
        </p>
      </div>
    </div>
  )
}
