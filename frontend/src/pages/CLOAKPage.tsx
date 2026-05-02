// ⚠️ CLOAK — Usage légal et éducatif uniquement.
// Source : https://github.com/Mickinthemiddle/CLOAK (GPL-2.0)

import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  EyeOff, Search, ChevronRight, ChevronDown,
  X, ExternalLink, Loader2, AlertTriangle,
  Lock, Shield, Cpu, User, Activity, Pencil, Trash2,
} from 'lucide-react'
import type {
  CloakData, CloakTactic, CloakTechnique, CloakSubTechnique, CloakProcedure,
} from '@/types/cloak'
import type { CloakAnnotation, AnnotationMap, AnnotationStatus, CloakAnnotationRequest } from '@/types/cloakAnnotation'
import { cloakAnnotationsApi } from '@/api/client'
import { toast } from '@/store/toast'

// ── Helpers ───────────────────────────────────────────────────────────────────

type CloakTypeFilter = 'Technical' | 'Behavioral' | 'Physical' | ''

const typeColor = (type: string) => {
  switch (type) {
    case 'Technical':  return 'bg-red-900/40 text-red-300 border-red-700/40'
    case 'Behavioral': return 'bg-orange-900/40 text-orange-300 border-orange-700/40'
    case 'Physical':   return 'bg-blue-900/40 text-blue-300 border-blue-700/40'
    default:           return 'bg-slate-700/40 text-slate-400 border-slate-600/40'
  }
}

const typeIcon = (type: string): JSX.Element => {
  switch (type) {
    case 'Technical':  return <Cpu size={10} />
    case 'Behavioral': return <User size={10} />
    case 'Physical':   return <Shield size={10} />
    default:           return <Activity size={10} />
  }
}

const TACTIC_COLORS: Record<string, string> = {
  'Anonymous browsing': 'border-l-cyan-500 bg-cyan-900/10',
  'Anonymous communication': 'border-l-blue-500 bg-blue-900/10',
  'Anonymous cryptocurrency': 'border-l-yellow-500 bg-yellow-900/10',
  'Anonymous hosting': 'border-l-purple-500 bg-purple-900/10',
  'Anonymous identity': 'border-l-pink-500 bg-pink-900/10',
  'Anonymous transactions': 'border-l-amber-500 bg-amber-900/10',
  'Data obfuscation': 'border-l-lime-500 bg-lime-900/10',
  'Physical security': 'border-l-teal-500 bg-teal-900/10',
  'Plausible deniability': 'border-l-violet-500 bg-violet-900/10',
  'Reduce attack surface': 'border-l-green-500 bg-green-900/10',
  'Risk management': 'border-l-orange-500 bg-orange-900/10',
  'Secure behavior': 'border-l-emerald-500 bg-emerald-900/10',
  'Tamper protection': 'border-l-red-500 bg-red-900/10',
}
const TACTIC_TEXT: Record<string, string> = {
  'Anonymous browsing': 'text-cyan-400', 'Anonymous communication': 'text-blue-400',
  'Anonymous cryptocurrency': 'text-yellow-400', 'Anonymous hosting': 'text-purple-400',
  'Anonymous identity': 'text-pink-400', 'Anonymous transactions': 'text-amber-400',
  'Data obfuscation': 'text-lime-400', 'Physical security': 'text-teal-400',
  'Plausible deniability': 'text-violet-400', 'Reduce attack surface': 'text-green-400',
  'Risk management': 'text-orange-400', 'Secure behavior': 'text-emerald-400',
  'Tamper protection': 'text-red-400',
}
const tacticAccent = (name: string) => TACTIC_COLORS[name] ?? 'border-l-accent bg-accent/5'
const tacticText   = (name: string) => TACTIC_TEXT[name]   ?? 'text-accent'

// ── Status annotation ─────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { color: string; dot: string }> = {
  a_tester:   { color: 'text-yellow-400 bg-yellow-900/30 border-yellow-700/50', dot: 'bg-yellow-400' },
  vu_en_lab:  { color: 'text-blue-400 bg-blue-900/30 border-blue-700/50',       dot: 'bg-blue-400' },
  maitrise:   { color: 'text-green-400 bg-green-900/30 border-green-700/50',    dot: 'bg-green-400' },
}

function StatusDot({ status }: { status: AnnotationStatus }) {
  if (!status) return null
  const cfg = STATUS_CFG[status]
  if (!cfg) return null
  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
}

// ── TypeBadge ─────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  if (!type) return null
  return (
    <span className={`flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded border font-medium ${typeColor(type)}`}>
      {typeIcon(type)}{type}
    </span>
  )
}

// ── Annotation Panel ──────────────────────────────────────────────────────────

interface AnnotationPanelProps {
  techniqueRef: string
  itemName: string
  tacticName: string
  existingAnnotation: CloakAnnotation | null
  onSaved: (ann: CloakAnnotation) => void
  onDeleted: (ref: string) => void
  onClose: () => void
}

function AnnotationPanel({
  techniqueRef, itemName, tacticName, existingAnnotation, onSaved, onDeleted, onClose,
}: AnnotationPanelProps) {
    const [status, setStatus]       = useState<AnnotationStatus>(existingAnnotation?.status ?? '')
  const [userNotes, setUserNotes] = useState(existingAnnotation?.user_notes ?? '')
  const [counter, setCounter]     = useState(existingAnnotation?.counter_notes ?? '')
  const [tags, setTags]           = useState(existingAnnotation?.tags ?? '')
  const [saving, setSaving]       = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const req: CloakAnnotationRequest = {
        technique_ref: techniqueRef,
        user_notes: userNotes,
        status,
        counter_notes: counter,
        tags,
      }
      const ann = await cloakAnnotationsApi.upsert(req)
      onSaved(ann)
      toast.success(`Annotation sauvegardée`)
    } catch {
      toast.error(`Erreur lors de la sauvegarde`)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!confirm(`Supprimer les annotations pour cette technique ?`)) return
    try {
      await cloakAnnotationsApi.deleteByRef(techniqueRef)
      onDeleted(techniqueRef)
      toast.success(`Annotation supprimée`)
      onClose()
    } catch {
      toast.error(`Erreur lors de la sauvegarde`)
    }
  }

  const textareaCls = 'w-full bg-bg-primary border border-border rounded px-3 py-2 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/60 resize-y'
  const inputCls    = 'w-full bg-bg-primary border border-border rounded px-3 py-2 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/60'

  return (
    <div className="w-[400px] flex-shrink-0 border-l border-border flex flex-col h-full bg-bg-secondary">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-border gap-2">
        <div className="min-w-0 flex-1">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded bg-current/10 ${tacticText(tacticName)}`}>{tacticName}</span>
          <p className="text-sm font-semibold text-text-primary leading-tight mt-1.5">{itemName}</p>
          <p className="text-[10px] text-accent mt-0.5 font-mono">{`Annoter la fiche`}</p>
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary flex-shrink-0 mt-0.5"><X size={16} /></button>
      </div>

      {/* Corps */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Status */}
        <div>
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">{`Statut`}</p>
          <div className="flex gap-2 flex-wrap">
            {[
              { value: '' as AnnotationStatus,          label: `Non annoté` },
              { value: 'a_tester' as AnnotationStatus,  label: `À tester` },
              { value: 'vu_en_lab' as AnnotationStatus, label: `Vu en lab` },
              { value: 'maitrise' as AnnotationStatus,  label: `Maîtrisé` },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setStatus(opt.value)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors ${
                  status === opt.value
                    ? opt.value ? STATUS_CFG[opt.value].color : 'border-accent/60 text-accent bg-accent/10'
                    : 'border-border text-text-muted hover:border-accent/40 hover:text-text-primary'
                }`}
              >
                {opt.value && <StatusDot status={opt.value} />}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes perso */}
        <div>
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">{`Notes personnelles`}</p>
          <textarea
            value={userNotes}
            onChange={e => setUserNotes(e.target.value)}
            rows={5}
            placeholder={`Tes observations, commandes testées, résultats…`}
            className={textareaCls}
          />
        </div>

        {/* Contre-mesures */}
        <div>
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">{`Contre-mesures`}</p>
          <textarea
            value={counter}
            onChange={e => setCounter(e.target.value)}
            rows={4}
            placeholder={`Détection SIEM, règles Sigma, mesures défensives…`}
            className={textareaCls}
          />
        </div>

        {/* Tags */}
        <div>
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">
            {`Tags personnels`} <span className="normal-case font-normal">{`(séparés par virgule)`}</span>
          </p>
          <input value={tags} onChange={e => setTags(e.target.value)} placeholder={`à-tester, priorité-haute, red-team…`} className={inputCls} />
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-2">
        {existingAnnotation ? (
          <button onClick={handleReset} className="flex items-center gap-1.5 text-xs text-cyber-red/70 hover:text-cyber-red transition-colors">
            <Trash2 size={12} />{`Réinitialiser`}
          </button>
        ) : <div />}
        <div className="flex gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs border border-border rounded text-text-muted hover:text-text-primary transition-colors">
            {`Annuler`}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-3 py-1.5 text-xs bg-accent text-bg-primary font-semibold rounded hover:bg-accent/80 disabled:opacity-50 transition-colors">
            {saving ? `Sauvegarde…` : `Sauvegarder`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

type DetailItem =
  | { kind: 'technique';    tactic: CloakTactic; item: CloakTechnique }
  | { kind: 'subtechnique'; tactic: CloakTactic; parent: CloakTechnique; item: CloakSubTechnique }

interface DetailPanelProps {
  detail: DetailItem
  annotation: CloakAnnotation | null
  onClose: () => void
  onAnnotate: () => void
}

function DetailPanel({ detail, annotation, onClose, onAnnotate }: DetailPanelProps) {
    const [showProcs, setShowProcs] = useState(true)
  useEffect(() => setShowProcs(true), [detail])

  const item   = detail.item
  const procs: CloakProcedure[] = item.procedures ?? []
  const subs   = detail.kind === 'technique' ? (detail.item as CloakTechnique).subtechniques ?? [] : []
  const tacticName = detail.tactic.name
  const parentName = detail.kind === 'subtechnique' ? detail.parent.name : null

  return (
    <div className="w-[400px] flex-shrink-0 border-l border-border flex flex-col h-full bg-bg-secondary">
      <div className="flex items-start justify-between px-4 py-3 border-b border-border gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded bg-current/10 ${tacticText(tacticName)}`}>{tacticName}</span>
            {parentName && (
              <>
                <ChevronRight size={10} className="text-text-muted flex-shrink-0" />
                <span className="text-[10px] text-text-muted truncate">{parentName}</span>
              </>
            )}
          </div>
          <p className="text-sm font-semibold text-text-primary leading-tight">{item.name}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
          <button onClick={onAnnotate}
            className={`p-1.5 rounded transition-colors ${annotation ? 'text-accent bg-accent/10 hover:bg-accent/20' : 'text-text-muted hover:text-accent hover:bg-accent/10'}`}
            title={`Annoter la fiche`}>
            <Pencil size={13} />
          </button>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1.5 rounded transition-colors"><X size={14} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
        {/* Annotation badge si présente */}
        {annotation?.status && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded border ${STATUS_CFG[annotation.status]?.color ?? ''}`}>
            <StatusDot status={annotation.status} />
            <span className="text-xs font-medium">
              {annotation.status === 'a_tester'  ? `À tester`
               : annotation.status === 'vu_en_lab' ? `Vu en lab`
               : `Maîtrisé`}
            </span>
          </div>
        )}

        {item.type && (
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">{`Niveau`}</p>
            <TypeBadge type={item.type} />
          </div>
        )}
        <div>
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">{`Description`}</p>
          <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">
            {item.description?.trim() || '—'}
          </p>
        </div>
        {subs.length > 0 && (
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">
              {`Sous-techniques`} ({subs.length})
            </p>
            <div className="space-y-1">
              {subs.map(st => (
                <div key={st.id} className="rounded border border-border bg-bg-primary p-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-text-primary leading-tight">{st.name}</p>
                    {st.type && <TypeBadge type={st.type} />}
                  </div>
                  {st.description && (
                    <p className="text-[11px] text-text-muted mt-1 leading-relaxed line-clamp-2">{st.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {procs.length > 0 && (
          <div>
            <button onClick={() => setShowProcs(v => !v)}
              className="flex items-center gap-1.5 text-[10px] text-text-muted uppercase tracking-wider hover:text-accent transition-colors w-full mb-1.5">
              <Lock size={10} />
              {`Procédures / Outils`} ({procs.length})
              {showProcs ? <ChevronDown size={10} className="ml-auto" /> : <ChevronRight size={10} className="ml-auto" />}
            </button>
            {showProcs && (
              <div className="space-y-1.5">
                {procs.map((p, i) => {
                  const urlMatch = p.description?.match(/https?:\/\/\S+/)
                  const url = urlMatch?.[0]?.replace(/[.)]+$/, '')
                  const cleanDesc = p.description?.replace(/https?:\/\/\S+/g, '').trim()
                  return (
                    <div key={`${p.id}-${i}`} className="rounded border border-border/50 bg-bg-primary p-2.5">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-xs font-medium text-text-primary leading-tight">{p.name}</p>
                        {url && (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent/80 flex-shrink-0">
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                      {cleanDesc && <p className="text-[11px] text-text-muted leading-relaxed line-clamp-3">{cleanDesc}</p>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Notes perso si annotation présente */}
        {annotation?.user_notes && (
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">{`Notes personnelles`}</p>
            <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">{annotation.user_notes}</p>
          </div>
        )}
        {annotation?.counter_notes && (
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">{`Contre-mesures`}</p>
            <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">{annotation.counter_notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── TechniqueCard ─────────────────────────────────────────────────────────────

interface TechCardProps {
  tactic: CloakTactic; tech: CloakTechnique; selected: boolean
  annotation: CloakAnnotation | null
  onSelect: (tactic: CloakTactic, tech: CloakTechnique) => void
  onSelectSub: (tactic: CloakTactic, tech: CloakTechnique, sub: CloakSubTechnique) => void
  onAnnotate: (tactic: CloakTactic, tech: CloakTechnique) => void
  selectedSubId?: number; expandedId: number | null; onToggleExpand: (id: number) => void
}

function TechniqueCard({
  tactic, tech, selected, annotation, onSelect, onSelectSub, onAnnotate,
  selectedSubId, expandedId, onToggleExpand,
}: TechCardProps) {
    const hasSubs = tech.subtechniques?.length > 0
  const isExpanded = expandedId === tech.id
  const totalProcs = (tech.procedures?.length ?? 0) +
    (tech.subtechniques?.reduce((a, s) => a + (s.procedures?.length ?? 0), 0) ?? 0)

  return (
    <div className={`rounded border border-l-2 transition-all duration-150 ${
      selected ? 'border-accent/60 ring-1 ring-accent/30 ' + tacticAccent(tactic.name)
               : 'border-border hover:border-accent/30 ' + tacticAccent(tactic.name)}`}>
      <button onClick={() => onSelect(tactic, tech)} className="w-full text-left p-3">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-current/10 flex-shrink-0 ${tacticText(tactic.name)}`}>
            TE-{tech.id}
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {annotation?.status && <StatusDot status={annotation.status} />}
            {tech.type && <TypeBadge type={tech.type} />}
          </div>
        </div>
        <p className="text-xs font-medium text-text-primary leading-tight mb-1.5 line-clamp-2">{tech.name}</p>
        <div className="flex items-center gap-2 text-[10px] text-text-muted">
          {hasSubs && <span>{`${tech.subtechniques.length} sous-tech.`}</span>}
          {totalProcs > 0 && <span>{totalProcs} proc.</span>}
        </div>
      </button>

      {/* Bouton annoter */}
      <div className="px-3 pb-1.5 flex items-center justify-between">
        {hasSubs ? (
          <button onClick={() => onToggleExpand(tech.id)}
            className="flex items-center gap-1 text-[10px] text-text-muted hover:text-accent transition-colors">
            {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            <span>{isExpanded ? `Masquer sous-techniques` : `Voir sous-techniques`}</span>
          </button>
        ) : <div />}
        <button
          onClick={(e) => { e.stopPropagation(); onAnnotate(tactic, tech) }}
          className={`p-1 rounded transition-colors ${annotation ? 'text-accent opacity-80 hover:opacity-100' : 'text-text-muted opacity-0 group-hover:opacity-60 hover:opacity-100 hover:text-accent'}`}
          title={`Annoter la fiche`}
        >
          <Pencil size={10} />
        </button>
      </div>

      {isExpanded && hasSubs && (
        <div className="px-2 pb-2 space-y-1 border-t border-border/50 pt-2">
          {tech.subtechniques.map(sub => (
            <button key={sub.id} onClick={() => onSelectSub(tactic, tech, sub)}
              className={`w-full text-left rounded px-2.5 py-1.5 text-[11px] transition-colors ${
                selectedSubId === sub.id
                  ? 'bg-accent/15 text-accent border border-accent/30'
                  : 'text-text-secondary hover:bg-border/30 hover:text-text-primary border border-transparent'}`}>
              <div className="flex items-center justify-between gap-1.5">
                <span className="truncate leading-tight">{sub.name}</span>
                {sub.type && <span className={`text-[8px] px-1 py-px rounded flex-shrink-0 ${typeColor(sub.type)}`}>{sub.type.charAt(0)}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

type RightPanel =
  | { kind: 'detail'; detail: DetailItem }
  | { kind: 'annotate'; techniqueRef: string; itemName: string; tacticName: string }
  | null

const TYPE_FILTERS: CloakTypeFilter[] = ['Technical', 'Behavioral', 'Physical']

export default function CLOAKPage() {
    const [data, setData]                     = useState<CloakData | null>(null)
  const [loadError, setLoadError]           = useState(false)
  const [activeTacticId, setActiveTacticId] = useState<number | null>(null)
  const [typeFilter, setTypeFilter]         = useState<CloakTypeFilter>('')
  const [query, setQuery]                   = useState('')
  const [debouncedQ, setDebouncedQ]         = useState('')
  const [rightPanel, setRightPanel]         = useState<RightPanel>(null)
  const [expandedId, setExpandedId]         = useState<number | null>(null)
  const [annotations, setAnnotations]       = useState<AnnotationMap>(new Map())

  // ── Chargement JSON CLOAK ──────────────────────────────────────────────────
  useEffect(() => {
    fetch('/data/cloak.json')
      .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<CloakData> })
      .then(d => {
        setData(d)
        const first = d.tactics.find(tac => tac.name !== 'Unknown')
        if (first) setActiveTacticId(first.id)
      })
      .catch(() => setLoadError(true))
  }, [])

  // ── Chargement annotations ─────────────────────────────────────────────────
  useEffect(() => {
    cloakAnnotationsApi.list()
      .then(list => {
        const map = new Map<string, CloakAnnotation>()
        list.forEach(a => map.set(a.technique_ref, a))
        setAnnotations(map)
      })
      .catch(() => {}) // silencieux si backend pas encore prêt
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(query), 250)
    return () => clearTimeout(timer)
  }, [query])

  const realTactics = useMemo(
    () => data?.tactics.filter(tac => tac.name !== 'Unknown') ?? [],
    [data],
  )

  const filteredTechniques = useMemo(() => {
    if (!data) return []
    const sourceTactics = activeTacticId
      ? realTactics.filter(tac => tac.id === activeTacticId)
      : realTactics
    let techs: { tactic: CloakTactic; tech: CloakTechnique }[] = []
    for (const tactic of sourceTactics)
      for (const tech of tactic.techniques)
        techs.push({ tactic, tech })

    if (typeFilter) {
      techs = techs.filter(({ tech }) =>
        tech.type === typeFilter || tech.subtechniques?.some(s => s.type === typeFilter),
      )
    }
    if (debouncedQ.trim()) {
      const q = debouncedQ.toLowerCase()
      techs = techs.filter(({ tech }) =>
        tech.name.toLowerCase().includes(q) ||
        tech.description?.toLowerCase().includes(q) ||
        tech.subtechniques?.some(s => s.name.toLowerCase().includes(q)) ||
        tech.procedures?.some(p => p.name.toLowerCase().includes(q)),
      )
    }
    return techs
  }, [data, realTactics, activeTacticId, typeFilter, debouncedQ])

  // ── Ref builder ───────────────────────────────────────────────────────────
  const techRef = (tacticId: number, techId: number) => `tac-${tacticId}:te-${techId}`
  const subRef  = (tacticId: number, techId: number, subId: number) => `tac-${tacticId}:te-${techId}:sub-${subId}`

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectTechnique = useCallback((tactic: CloakTactic, tech: CloakTechnique) => {
    setRightPanel({ kind: 'detail', detail: { kind: 'technique', tactic, item: tech } })
  }, [])

  const handleSelectSub = useCallback((tactic: CloakTactic, parent: CloakTechnique, sub: CloakSubTechnique) => {
    setRightPanel({ kind: 'detail', detail: { kind: 'subtechnique', tactic, parent, item: sub } })
  }, [])

  const handleAnnotate = useCallback((tactic: CloakTactic, tech: CloakTechnique) => {
    setRightPanel({
      kind: 'annotate',
      techniqueRef: techRef(tactic.id, tech.id),
      itemName: tech.name,
      tacticName: tactic.name,
    })
  }, [])

  const handleTacticChange = (id: number) => {
    setActiveTacticId(prev => prev === id ? null : id)
    setRightPanel(null); setExpandedId(null)
  }

  const handleToggleExpand = useCallback((id: number) => {
    setExpandedId(prev => prev === id ? null : id)
  }, [])

  const handleAnnotationSaved = useCallback((ann: CloakAnnotation) => {
    setAnnotations(prev => { const m = new Map(prev); m.set(ann.technique_ref, ann); return m })
  }, [])

  const handleAnnotationDeleted = useCallback((ref: string) => {
    setAnnotations(prev => { const m = new Map(prev); m.delete(ref); return m })
  }, [])

  const activeTacticStats = useMemo(() => {
    if (!activeTacticId || !data) return null
    const tac = realTactics.find(tac => tac.id === activeTacticId)
    if (!tac) return null
    return {
      techniques: tac.techniques.length,
      subs: tac.techniques.reduce((a, te) => a + (te.subtechniques?.length ?? 0), 0),
    }
  }, [activeTacticId, data, realTactics])

  // ── Current detail for annotation button in DetailPanel ───────────────────
  const getCurrentDetailAnnotation = (): CloakAnnotation | null => {
    if (!rightPanel || rightPanel.kind !== 'detail') return null
    const d = rightPanel.detail
    const ref = d.kind === 'technique'
      ? techRef(d.tactic.id, d.item.id)
      : subRef(d.tactic.id, d.parent.id, d.item.id)
    return annotations.get(ref) ?? null
  }

  // ── États chargement ───────────────────────────────────────────────────────
  if (loadError) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
      <AlertTriangle size={32} className="text-yellow-400" />
      <div className="text-center">
        <h2 className="text-lg font-semibold text-text-primary mb-1">{`Données CLOAK introuvables`}</h2>
        <p className="text-sm text-text-muted max-w-md">
          {`Le fichier /data/cloak.json n'est pas accessible.`}
          {`Vérifiez que le fichier est présent dans`} <code className="text-accent">frontend/public/data/</code>.
        </p>
      </div>
    </div>
  )

  if (!data) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-accent" />
    </div>
  )

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center">
              <EyeOff size={16} className="text-accent" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-text-primary">{`CLOAK`}</h1>
              <p className="text-xs text-text-muted">{`Concealment Layers for Online Anonymity and Knowledge · OpSec TTPs`}</p>
            </div>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input type="text" value={query} onChange={e => setQuery(e.target.value)}
              placeholder={`Rechercher une technique, outil…`}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-bg-tertiary border border-border rounded text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/60" />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          <span className="text-[10px] text-text-muted mr-1">{`Niveau :`}</span>
          {TYPE_FILTERS.map(tf => (
            <button key={tf} onClick={() => setTypeFilter(prev => prev === tf ? '' : tf)}
              className={`flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded border transition-colors ${
                typeFilter === tf ? typeColor(tf) + ' ring-1 ring-current/30' : 'bg-border/30 text-text-muted border-border/50 hover:bg-border/60'}`}>
              {typeIcon(tf)}{tf}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-3 text-[10px] text-text-muted">
            <span><span className="text-text-secondary font-medium">{realTactics.length}</span> {`${realTactics.length} tactics`.replace(/^\d+ /, '')}</span>
            <span>
              <span className="text-text-secondary font-medium">{realTactics.reduce((a, tac) => a + tac.techniques.length, 0)}</span>
              {' '}{`${0} techniques`.replace(/^0 /, '')}
            </span>
            <span>
              <span className="text-text-secondary font-medium">
                {realTactics.reduce((a, tac) => a + tac.techniques.reduce((b, te) => b + (te.subtechniques?.length ?? 0), 0), 0)}
              </span>
              {' '}{`${0} sous-tech.`.replace(/^0 /, '')}
            </span>
          </div>
        </div>
      </div>

      {/* Corps */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar tactiques */}
        <div className="w-52 flex-shrink-0 border-r border-border overflow-y-auto">
          <div className="p-2">
            <button onClick={() => { setActiveTacticId(null); setRightPanel(null) }}
              className={`w-full text-left text-xs px-3 py-2 rounded mb-1 transition-colors ${
                activeTacticId === null ? 'bg-accent/20 text-accent font-medium' : 'text-text-muted hover:bg-border/30 hover:text-text-primary'}`}>
              {`Toutes les tactiques`}
            </button>
            <div className="h-px bg-border my-2" />
            {realTactics.map(tac => (
              <button key={tac.id} onClick={() => handleTacticChange(tac.id)}
                className={`w-full text-left text-xs px-3 py-1.5 rounded mb-0.5 transition-colors flex items-center gap-1.5 group ${
                  activeTacticId === tac.id ? tacticText(tac.name) + ' font-medium bg-white/[0.04]' : 'text-text-muted hover:bg-border/30 hover:text-text-primary'}`}>
                <ChevronRight size={10} className={activeTacticId === tac.id ? 'opacity-100 flex-shrink-0' : 'opacity-0 flex-shrink-0'} />
                <span className="flex-1 truncate leading-tight">{tac.name}</span>
                <span className={`text-[9px] flex-shrink-0 ${activeTacticId === tac.id ? 'opacity-70' : 'opacity-40'}`}>{tac.techniques.length}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Grille techniques */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-border flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              {activeTacticId && (
                <span className={`text-xs font-medium ${tacticText(realTactics.find(tac => tac.id === activeTacticId)?.name ?? '')}`}>
                  {realTactics.find(tac => tac.id === activeTacticId)?.name}
                </span>
              )}
              <span className="text-xs text-text-muted">
                {`${filteredTechniques.length} technique${filteredTechniques.length > 1 ? 's' : ''}`}
                {activeTacticStats && !debouncedQ && !typeFilter && (
                  <span className="ml-1 opacity-60">· {`${activeTacticStats.subs} sous-tech.`}</span>
                )}
              </span>
            </div>
            {(debouncedQ || typeFilter) && (
              <button onClick={() => { setQuery(''); setTypeFilter('') }} className="text-[10px] text-accent hover:text-accent/80">
                {`Réinitialiser les filtres`}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {filteredTechniques.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-text-muted">
                <EyeOff size={36} className="mb-3 opacity-20" />
                <p className="text-sm">{`Aucune technique trouvée`}</p>
                <button onClick={() => { setQuery(''); setTypeFilter(''); setActiveTacticId(null) }}
                  className="mt-2 text-xs text-accent hover:text-accent/80">
                  {`Réinitialiser les filtres`}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2">
                {filteredTechniques.map(({ tactic, tech }) => (
                  <TechniqueCard
                    key={`${tactic.id}-${tech.id}`}
                    tactic={tactic} tech={tech}
                    selected={
                      rightPanel?.kind === 'detail' &&
                      rightPanel.detail.kind === 'technique' &&
                      rightPanel.detail.item.id === tech.id &&
                      rightPanel.detail.tactic.id === tactic.id
                    }
                    annotation={annotations.get(techRef(tactic.id, tech.id)) ?? null}
                    selectedSubId={
                      rightPanel?.kind === 'detail' &&
                      rightPanel.detail.kind === 'subtechnique' &&
                      rightPanel.detail.tactic.id === tactic.id
                        ? (rightPanel.detail.item as CloakSubTechnique).id
                        : undefined
                    }
                    onSelect={handleSelectTechnique}
                    onSelectSub={handleSelectSub}
                    onAnnotate={handleAnnotate}
                    expandedId={expandedId}
                    onToggleExpand={handleToggleExpand}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Panneau droit : detail ou annotation */}
        {rightPanel?.kind === 'detail' && (
          <DetailPanel
            detail={rightPanel.detail}
            annotation={getCurrentDetailAnnotation()}
            onClose={() => setRightPanel(null)}
            onAnnotate={() => {
              const d = rightPanel.detail
              const ref  = d.kind === 'technique'
                ? techRef(d.tactic.id, d.item.id)
                : subRef(d.tactic.id, d.parent.id, d.item.id)
              setRightPanel({ kind: 'annotate', techniqueRef: ref, itemName: d.item.name, tacticName: d.tactic.name })
            }}
          />
        )}
        {rightPanel?.kind === 'annotate' && (
          <AnnotationPanel
            techniqueRef={rightPanel.techniqueRef}
            itemName={rightPanel.itemName}
            tacticName={rightPanel.tacticName}
            existingAnnotation={annotations.get(rightPanel.techniqueRef) ?? null}
            onSaved={handleAnnotationSaved}
            onDeleted={handleAnnotationDeleted}
            onClose={() => setRightPanel(null)}
          />
        )}
      </div>

      {/* Avertissement légal */}
      <div className="px-4 py-1.5 border-t border-border bg-yellow-900/10 flex items-center gap-2 flex-shrink-0">
        <AlertTriangle size={11} className="text-yellow-400 flex-shrink-0" />
        <p className="text-[10px] text-yellow-300/70">
          {`CLOAK est un framework académique de référence destiné aux professionnels de la cybersécurité — usage légal et éducatif uniquement.`}
          {' '}Licence GPL-2.0 ·{' '}
          <a href="https://github.com/Mickinthemiddle/CLOAK" target="_blank" rel="noopener noreferrer" className="underline hover:text-yellow-300">
            GitHub
          </a>
        </p>
      </div>
    </div>
  )
}
