import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Shield, Search, ChevronRight, ExternalLink, X,
  Loader2, RefreshCw, Globe, Monitor, Server,
  Smartphone, Cloud, Network, ChevronDown, ChevronUp,
  AlertTriangle, Database,
} from 'lucide-react'
import { mitreApi } from '@/api/client'
import type { MITRETactic, MITRETechnique, MITREStatus } from '@/types'

// ⚠️ Données MITRE ATT&CK — usage légal et éducatif uniquement

function parseArr(raw?: string): string[] {
  if (!raw) return []
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [] }
  catch { return [] }
}

const PLATFORM_ICONS: Record<string, JSX.Element> = {
  Windows: <Monitor size={10} />, Linux: <Server size={10} />, macOS: <Monitor size={10} />,
  Android: <Smartphone size={10} />, iOS: <Smartphone size={10} />, Cloud: <Cloud size={10} />,
  Network: <Network size={10} />, IaaS: <Cloud size={10} />, SaaS: <Cloud size={10} />,
  Azure: <Cloud size={10} />, 'Google Workspace': <Cloud size={10} />,
  'Office 365': <Globe size={10} />, 'Azure AD': <Cloud size={10} />,
}

const PLATFORM_COLORS: Record<string, string> = {
  Windows: 'border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[#3b82f6]',
  Linux:   'border-[#f97316]/30 bg-[#f97316]/10 text-[#f97316]',
  macOS:   'border-[#64748b]/30 bg-[#64748b]/10 text-[#64748b]',
  Cloud:   'border-[#00d4ff]/30 bg-[#00d4ff]/10 text-[#00d4ff]',
  Network: 'border-[#a855f7]/30 bg-[#a855f7]/10 text-[#a855f7]',
  Android: 'border-[#10b981]/30 bg-[#10b981]/10 text-[#10b981]',
  iOS:     'border-[#10b981]/30 bg-[#10b981]/10 text-[#10b981]',
}
const platformColor = (p: string) => PLATFORM_COLORS[p] ?? 'border-[#64748b]/30 bg-[#64748b]/10 text-[#64748b]'

const TACTIC_COLORS: Record<string, string> = {
  'reconnaissance': 'border-l-[#a855f7] bg-[#a855f7]/5',
  'resource-development': 'border-l-[#c084fc] bg-[#c084fc]/5',
  'initial-access': 'border-l-[#ef4444] bg-[#ef4444]/5',
  'execution': 'border-l-[#f97316] bg-[#f97316]/5',
  'persistence': 'border-l-[#eab308] bg-[#eab308]/5',
  'privilege-escalation': 'border-l-[#f59e0b] bg-[#f59e0b]/5',
  'defense-evasion': 'border-l-[#84cc16] bg-[#84cc16]/5',
  'credential-access': 'border-l-[#10b981] bg-[#10b981]/5',
  'discovery': 'border-l-[#14b8a6] bg-[#14b8a6]/5',
  'lateral-movement': 'border-l-[#06b6d4] bg-[#06b6d4]/5',
  'collection': 'border-l-[#00d4ff] bg-[#00d4ff]/5',
  'command-and-control': 'border-l-[#0ea5e9] bg-[#0ea5e9]/5',
  'exfiltration': 'border-l-[#3b82f6] bg-[#3b82f6]/5',
  'impact': 'border-l-[#ec4899] bg-[#ec4899]/5',
}
const tacticAccent = (s: string) => TACTIC_COLORS[s] ?? 'border-l-[#00d4ff] bg-[#00d4ff]/5'

const TACTIC_TEXT: Record<string, string> = {
  'reconnaissance': 'text-[#a855f7]',
  'resource-development': 'text-[#c084fc]',
  'initial-access': 'text-[#ef4444]',
  'execution': 'text-[#f97316]',
  'persistence': 'text-[#eab308]',
  'privilege-escalation': 'text-[#f59e0b]',
  'defense-evasion': 'text-[#84cc16]',
  'credential-access': 'text-[#10b981]',
  'discovery': 'text-[#14b8a6]',
  'lateral-movement': 'text-[#06b6d4]',
  'collection': 'text-[#00d4ff]',
  'command-and-control': 'text-[#0ea5e9]',
  'exfiltration': 'text-[#3b82f6]',
  'impact': 'text-[#ec4899]',
}
const tacticText = (s: string) => TACTIC_TEXT[s] ?? 'text-[#00d4ff]'

interface TechCardProps {
  t: MITRETechnique; activeTactic: string
  onSelect: (t: MITRETechnique) => void; selected: boolean
}

function TechCard({ t: tech, activeTactic, onSelect, selected }: TechCardProps) {
  const tactics = parseArr(tech.tactics)
  const platforms = parseArr(tech.platforms).slice(0, 4)
  const accentTactic = activeTactic || tactics[0] || ''
  return (
    <button onClick={() => onSelect(tech)}
      className={`w-full text-left rounded border border-l-2 p-3 transition-all duration-150 cursor-pointer ${
        selected ? 'border-[#00d4ff]/60 ' + tacticAccent(accentTactic) + ' ring-1 ring-[#00d4ff]/30'
                 : 'border-[#1e2d40] hover:border-[#00d4ff]/40 ' + tacticAccent(accentTactic)}`}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="font-mono text-[11px] font-bold text-[#00d4ff] bg-[#00d4ff]/10 px-1.5 py-0.5 rounded flex-shrink-0">
          {tech.technique_id}
        </span>
        {tech.is_subtechnique && (
          <span className="text-[9px] text-[#64748b] bg-[#1e2d40]/40 px-1 py-0.5 rounded flex-shrink-0">sub</span>
        )}
      </div>
      <p className="text-xs font-mono text-[#f1f5f9] leading-tight mb-2 line-clamp-2">{tech.name}</p>
      <div className="flex flex-wrap gap-1">
        {platforms.map(p => (
          <span key={p} className={`flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded border ${platformColor(p)}`}>
            {PLATFORM_ICONS[p] ?? <Globe size={9} />}{p}
          </span>
        ))}
        {parseArr(tech.platforms).length > 4 && (
          <span className="text-[9px] text-[#64748b]">+{parseArr(tech.platforms).length - 4}</span>
        )}
      </div>
    </button>
  )
}

interface DetailPanelProps {
  technique: MITRETechnique | null; loading: boolean
  onClose: () => void; tactics: MITRETactic[]
}

function DetailPanel({ technique, loading, onClose, tactics }: DetailPanelProps) {
  const [showDetection, setShowDetection] = useState(false)
  useEffect(() => { setShowDetection(false) }, [technique?.technique_id])

  const tacticNames = parseArr(technique?.tactics)
    .map(sn => tactics.find(tac => tac.short_name === sn)?.name ?? sn)
  const platforms = parseArr(technique?.platforms)
  const dataSources = parseArr(technique?.data_sources)

  return (
    <div className="w-[420px] flex-shrink-0 border-l border-[#1e2d40] flex flex-col h-full bg-[#0a0f16]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d40]">
        {loading ? (
          <div className="flex items-center gap-2 text-[#64748b] text-sm">
            <Loader2 size={14} className="animate-spin" />CHARGEMENT…
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-xs font-bold text-[#00d4ff] bg-[#00d4ff]/10 px-2 py-0.5 rounded flex-shrink-0">
              {technique?.technique_id}
            </span>
            <span className="text-sm font-mono font-bold text-[#f1f5f9] truncate">{technique?.name}</span>
          </div>
        )}
        <button onClick={onClose} className="text-[#64748b] hover:text-[#f1f5f9] ml-2 flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]" aria-label="Fermer"><X size={16} /></button>
      </div>
      {technique && !loading && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
          <div>
            <p className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider mb-1.5">TACTIQUES</p>
            <div className="flex flex-wrap gap-1.5">
              {tacticNames.map(tn => {
                const sn = tactics.find(tac => tac.name === tn)?.short_name ?? ''
                return (
                  <span key={tn} className={`text-xs px-2 py-0.5 rounded font-mono ${tacticText(sn)} bg-white/5`}>
                    {tn}
                  </span>
                )
              })}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider mb-1.5">PLATEFORMES</p>
            <div className="flex flex-wrap gap-1.5">
              {platforms.map(p => (
                <span key={p} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${platformColor(p)}`}>
                  {PLATFORM_ICONS[p] ?? <Globe size={10} />}{p}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider mb-1.5">DESCRIPTION</p>
            <p className="text-xs font-mono text-[#cbd5e1] leading-relaxed whitespace-pre-line">
              {technique.description?.replace(/\(Citation:[^)]+\)/g, '').trim() || '—'}
            </p>
          </div>
          {technique.detection && (
            <div>
              <button className="flex items-center gap-1.5 text-[10px] font-mono text-[#4a6480] uppercase tracking-wider hover:text-[#00d4ff] transition-colors w-full"
                onClick={() => setShowDetection(v => !v)}>
                <Shield size={10} />DÉTECTION
                {showDetection ? <ChevronUp size={10} className="ml-auto" /> : <ChevronDown size={10} className="ml-auto" />}
              </button>
              {showDetection && (
                <p className="mt-2 text-xs font-mono text-[#cbd5e1] leading-relaxed whitespace-pre-line">
                  {technique.detection.replace(/\(Citation:[^)]+\)/g, '').trim()}
                </p>
              )}
            </div>
          )}
          {dataSources.length > 0 && (
            <div>
              <p className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider mb-1.5">SOURCES DE DONNÉES</p>
              <div className="flex flex-wrap gap-1">
                {dataSources.slice(0, 8).map(ds => (
                  <span key={ds} className="text-[9px] px-1.5 py-0.5 rounded bg-[#1e2d40]/50 text-[#64748b] font-mono">
                    {ds.split(':').pop()?.trim() ?? ds}
                  </span>
                ))}
              </div>
            </div>
          )}
          {technique.url && (
            <a href={technique.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-[#00d4ff] hover:text-[#00d4ff]/80 transition-colors">
              <ExternalLink size={12} />VOIR SUR ATTACK.MITRE.ORG
            </a>
          )}
        </div>
      )}
    </div>
  )
}

const PLATFORMS_FILTER = ['Windows', 'Linux', 'macOS', 'Cloud', 'Network', 'Android']

export default function MITRE() {
  const [status, setStatus] = useState<MITREStatus | null>(null)
  const [tactics, setTactics] = useState<MITRETactic[]>([])
  const [techniques, setTechniques] = useState<MITRETechnique[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [activeTactic, setActiveTactic] = useState<string>('')
  const [activePlatform, setActivePlatform] = useState<string>('')
  const [query, setQuery] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [showSubs, setShowSubs] = useState(true)
  const [selected, setSelected] = useState<MITRETechnique | null>(null)
  const [detailFull, setDetailFull] = useState<MITRETechnique | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [searchParams] = useSearchParams()

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const LIMIT = 60

  const fetchStatus = useCallback(async () => {
    try {
      const s = await mitreApi.status()
      setStatus(s)
      if (s.seeded && pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchStatus()
    pollRef.current = setInterval(fetchStatus, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchStatus])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const find = searchParams.get('find')
    if (find) setQuery(find)
  }, [searchParams])

  useEffect(() => {
    if (!status?.seeded) return
    mitreApi.tactics().then(setTactics).catch(() => {})
  }, [status?.seeded])

  const fetchTechniques = useCallback(async (pg: number) => {
    if (!status?.seeded) return
    setLoading(true)
    try {
      const res = await mitreApi.techniques({
        tactic: activeTactic || undefined, platform: activePlatform || undefined,
        q: debouncedQ || undefined, only_techniques: !showSubs || undefined,
        page: pg, limit: LIMIT,
      })
      setTechniques(res.items ?? [])
      setTotal(res.total)
      setPage(pg)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [status?.seeded, activeTactic, activePlatform, debouncedQ, showSubs])

  useEffect(() => { fetchTechniques(1) }, [fetchTechniques])

  useEffect(() => {
    if (!selected) { setDetailFull(null); return }
    setDetailLoading(true)
    mitreApi.technique(selected.technique_id)
      .then(setDetailFull)
      .catch(() => setDetailFull(selected))
      .finally(() => setDetailLoading(false))
  }, [selected?.technique_id])

  const handleTacticChange = (sn: string) => { setActiveTactic(sn === activeTactic ? '' : sn); setSelected(null) }
  const handlePlatformChange = (p: string) => { setActivePlatform(p === activePlatform ? '' : p); setSelected(null) }
  const handleSelectTechnique = useCallback((tech: MITRETechnique) => {
    setDetailFull(null); setDetailLoading(true); setSelected(tech)
  }, [])

  const totalPages = Math.ceil(total / LIMIT)
  const currentTactic = tactics.find(tac => tac.short_name === activeTactic)

  if (!status) return (
    <div className="flex-1 flex items-center justify-center bg-[#06080f]">
      <Loader2 size={24} className="animate-spin text-[#00d4ff]" />
    </div>
  )

  if (status.seeding && !status.seeded) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 bg-[#06080f]">
      <div className="w-16 h-16 rounded-2xl bg-[#00d4ff]/10 flex items-center justify-center">
        <Database size={28} className="text-[#00d4ff] animate-pulse" />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-mono font-bold text-[#f1f5f9] mb-1">SYNCHRONISATION MITRE ATT&CK</h2>
        <p className="text-sm font-mono text-[#8a9ab0] max-w-md">Téléchargement et indexation des techniques ATT&CK Enterprise en cours…</p>
        <p className="text-xs font-mono text-[#64748b] mt-2">Premier démarrage uniquement — les données seront disponibles dans quelques instants.</p>
      </div>
      <div className="flex items-center gap-2 text-[#00d4ff] text-sm">
        <Loader2 size={14} className="animate-spin" />INDEXATION EN COURS…
      </div>
    </div>
  )

  if (!status.seeded && !status.seeding) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 bg-[#06080f]">
      <AlertTriangle size={32} className="text-[#eab308]" />
      <div className="text-center">
        <h2 className="text-lg font-mono font-bold text-[#f1f5f9] mb-1">DONNÉES MITRE NON DISPONIBLES</h2>
        <p className="text-sm font-mono text-[#8a9ab0] max-w-md">Le téléchargement des données ATT&CK n'a pas pu se faire (connexion requise au premier démarrage).</p>
      </div>
      <button onClick={() => window.location.reload()}
        className="flex items-center gap-2 text-sm px-4 py-2 rounded bg-[#00d4ff]/20 text-[#00d4ff] hover:bg-[#00d4ff]/30 transition-colors">
        <RefreshCw size={14} />RÉESSAYER
      </button>
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-[#06080f] text-[#f1f5f9]">
      {/* Bandeau d'en-tête style BGPLookup */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d40] bg-[#0a0f16]/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Shield className="text-[#00d4ff]" size={20} />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#10b981] rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase">MITRE ATT&CK // MATRIX</h1>
            <p className="text-[10px] text-[#64748b] font-mono">
              {status.count} techniques • Enterprise Matrix
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px]">
          <span className="text-[#64748b]">STATUS</span>
          <span className="text-[#10b981]">SEEDED</span>
          <button onClick={() => { setActiveTactic(''); setActivePlatform(''); setQuery('') }}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2d40] hover:bg-[#2a3f55] text-[10px] font-bold border border-[#334155] transition-colors">
            <RefreshCw size={12} />RESET FILTERS
          </button>
        </div>
      </div>

      {/* Barre de recherche et filtre plateforme */}
      <div className="px-6 py-3 border-b border-[#1e2d40] bg-[#0a0f16]/30 flex-shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[260px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a6480]" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher une technique (ID, nom, description)..."
              className="w-full bg-[#0d131f] border border-[#1e2d40] pl-9 pr-3 py-2 font-mono text-xs text-[#f1f5f9] placeholder-[#2a3f55] outline-none focus:border-[#00d4ff]/40"
            />
          </div>
          <button onClick={() => setShowSubs(v => !v)}
            className={`text-[10px] px-3 py-2 font-mono uppercase tracking-widest border transition-colors ${
              showSubs ? 'border-[#00d4ff]/40 bg-[#00d4ff]/10 text-[#00d4ff]' : 'border-[#1e2d40] bg-[#06080f] text-[#64748b] hover:border-[#2a3f55]'
            }`}>
            T.XXX {showSubs ? '(SUBS INCLUSES)' : '(TECHNIQUES SEULES)'}
          </button>
        </div>
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          <span className="text-[10px] font-mono text-[#4a6480] mr-1">PLATEFORME :</span>
          {PLATFORMS_FILTER.map(p => (
            <button key={p} onClick={() => handlePlatformChange(p)}
              className={`flex items-center gap-0.5 text-[10px] font-mono px-2 py-1 rounded border transition-colors ${
                activePlatform === p
                  ? platformColor(p) + ' bg-opacity-20'
                  : 'border-[#1e2d40] bg-[#06080f] text-[#64748b] hover:border-[#2a3f55] hover:text-[#8a9ab0]'
              }`}>
              {PLATFORM_ICONS[p] ?? <Globe size={9} />}{p}
            </button>
          ))}
        </div>
      </div>

      {/* Corps avec sidebar tactiques + grille + détail */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar tactiques */}
        <div className="w-48 flex-shrink-0 border-r border-[#1e2d40] overflow-y-auto bg-[#06080f]">
          <div className="p-2">
            <button onClick={() => handleTacticChange('')}
              className={`w-full text-left text-[11px] font-mono px-3 py-2 rounded mb-1 transition-colors ${
                activeTactic === '' ? 'bg-[#00d4ff]/20 text-[#00d4ff] font-bold' : 'text-[#8a9ab0] hover:bg-[#1e2d40]/60 hover:text-[#f1f5f9]'
              }`}>
              TOUTES LES TACTIQUES
            </button>
            <div className="h-px bg-[#1e2d40] my-2" />
            {tactics.map(tac => (
              <button key={tac.tactic_id} onClick={() => handleTacticChange(tac.short_name)}
                className={`w-full text-left text-[11px] font-mono px-3 py-1.5 rounded mb-0.5 transition-colors flex items-center gap-1.5 ${
                  activeTactic === tac.short_name
                    ? tacticText(tac.short_name) + ' font-bold bg-white/5'
                    : 'text-[#8a9ab0] hover:bg-[#1e2d40]/60 hover:text-[#f1f5f9]'
                }`}>
                <ChevronRight size={10} className={activeTactic === tac.short_name ? 'opacity-100' : 'opacity-0'} />
                <span className="truncate">{tac.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Grille des techniques */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-[#1e2d40] flex items-center justify-between flex-shrink-0 bg-[#0a0f16]/30">
            <div className="flex items-center gap-2">
              {currentTactic && (
                <span className={`text-[11px] font-mono font-bold ${tacticText(activeTactic)}`}>
                  {currentTactic.name}
                </span>
              )}
              <span className="text-[10px] font-mono text-[#64748b]">
                {loading ? 'CHARGEMENT...' : `${total} technique${total > 1 ? 's' : ''}`}
              </span>
            </div>
            {loading && <Loader2 size={12} className="animate-spin text-[#00d4ff]" />}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {techniques.length === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center h-full text-[#64748b]">
                <Shield size={36} className="mb-3 opacity-20" />
                <p className="text-sm font-mono">AUCUNE TECHNIQUE TROUVÉE</p>
                {(activeTactic || activePlatform || debouncedQ) && (
                  <button onClick={() => { setActiveTactic(''); setActivePlatform(''); setQuery('') }}
                    className="mt-2 text-xs text-[#00d4ff] hover:underline">
                    RÉINITIALISER LES FILTRES
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                  {techniques.map(tech => (
                    <TechCard key={tech.technique_id} t={tech} activeTactic={activeTactic}
                      onSelect={handleSelectTechnique} selected={selected?.technique_id === tech.technique_id} />
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-6 pb-2">
                    <button disabled={page === 1} onClick={() => fetchTechniques(page - 1)}
                      className="text-[10px] font-mono px-3 py-1.5 border border-[#1e2d40] text-[#64748b] hover:border-[#00d4ff]/40 disabled:opacity-30 hover:text-[#00d4ff] transition-colors">
                      ← PRÉCÉDENT
                    </button>
                    <span className="text-[10px] font-mono text-[#64748b]">{page} / {totalPages}</span>
                    <button disabled={page === totalPages} onClick={() => fetchTechniques(page + 1)}
                      className="text-[10px] font-mono px-3 py-1.5 border border-[#1e2d40] text-[#64748b] hover:border-[#00d4ff]/40 disabled:opacity-30 hover:text-[#00d4ff] transition-colors">
                      SUIVANT →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Panneau de détail (slide-in) */}
        {selected && (
          <DetailPanel technique={detailFull} loading={detailLoading} onClose={() => setSelected(null)} tactics={tactics} />
        )}
      </div>
    </div>
  )
}