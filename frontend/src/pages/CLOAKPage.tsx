// ⚠️ CLOAK — Usage légal et éducatif uniquement.
// Source : https://github.com/Mickinthemiddle/CLOAK (GPL-2.0)

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import {
  AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Layers,
  Loader2, Pencil, Search, Trash2, X,
} from 'lucide-react'
import type {
  CloakData, CloakTactic, CloakTechnique, CloakSubTechnique, CloakProcedure,
} from '@/types/cloak'
import type { CloakAnnotation, AnnotationMap, AnnotationStatus, CloakAnnotationRequest } from '@/types/cloakAnnotation'
import { cloakAnnotationsApi } from '@/api/client'
import { toast } from '@/store/toast'
import ConfirmModal from '@/components/ConfirmModal'
import CloakHero from '@/cloak26/CloakHero'
import { LEVELS, LevelMark, STATUS_KEY, StatusMark, procUrl } from '@/cloak26/parts'
import '@/cloak26/cloak.css'

type CloakTypeFilter = 'Technical' | 'Behavioral' | 'Physical' | ''

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const safeText = (value: unknown): string => typeof value === 'string' ? value : ''
const safeId = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

function normalizeCloakData(value: unknown): CloakData {
  if (!isRecord(value) || !Array.isArray(value.tactics)) throw new Error('Invalid CLOAK data')

  const procedures = (value: unknown): CloakProcedure[] => Array.isArray(value)
    ? value.flatMap((entry, index) => {
        if (!isRecord(entry)) return []
        const id = typeof entry.id === 'string' || safeId(entry.id) !== null ? entry.id as number | string : index
        return [{ id, name: safeText(entry.name) || `Procedure ${id}`, description: safeText(entry.description), type: safeText(entry.type) }]
      })
    : []

  const tactics: CloakTactic[] = value.tactics.flatMap((entry) => {
    if (!isRecord(entry)) return []
    const id = safeId(entry.id)
    if (id === null) return []
    const techniques: CloakTechnique[] = (Array.isArray(entry.techniques) ? entry.techniques : []).flatMap((techEntry) => {
      if (!isRecord(techEntry)) return []
      const techId = safeId(techEntry.id)
      if (techId === null) return []
      const subtechniques: CloakSubTechnique[] = (Array.isArray(techEntry.subtechniques) ? techEntry.subtechniques : []).flatMap((subEntry) => {
        if (!isRecord(subEntry)) return []
        const subId = safeId(subEntry.id)
        if (subId === null) return []
        return [{
          id: subId,
          name: safeText(subEntry.name) || `Sous-technique ${subId}`,
          description: safeText(subEntry.description),
          type: safeText(subEntry.type),
          procedures: procedures(subEntry.procedures),
        }]
      })
      return [{
        id: techId,
        name: safeText(techEntry.name) || `Technique ${techId}`,
        description: safeText(techEntry.description),
        type: safeText(techEntry.type),
        procedures: procedures(techEntry.procedures),
        subtechniques,
      }]
    })
    return [{
      id,
      name: safeText(entry.name) || `Tactique ${id}`,
      description: safeText(entry.description),
      type: safeText(entry.type),
      techniques,
    }]
  })

  return { tactics }
}

function normalizeAnnotations(value: unknown): CloakAnnotation[] {
  if (!Array.isArray(value)) throw new Error('Invalid annotations list')
  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.technique_ref !== 'string') return []
    const rawStatus = entry.status
    const status: AnnotationStatus = rawStatus === 'a_tester' || rawStatus === 'vu_en_lab' || rawStatus === 'maitrise' ? rawStatus : ''
    return [{
      id: safeId(entry.id) ?? 0,
      technique_ref: entry.technique_ref,
      user_notes: safeText(entry.user_notes),
      status,
      counter_notes: safeText(entry.counter_notes),
      tags: safeText(entry.tags),
      created_at: safeText(entry.created_at),
      updated_at: safeText(entry.updated_at),
    }]
  })
}

// ── Annotation editor (analyst notebook) ───────────────────────────────────────

const STATUS_OPTIONS: { value: AnnotationStatus; label: string }[] = [
  { value: '', label: 'Non annoté' },
  { value: 'a_tester', label: 'À tester' },
  { value: 'vu_en_lab', label: 'Vu en lab' },
  { value: 'maitrise', label: 'Maîtrisé' },
]

interface AnnotationPanelProps {
  techniqueRef: string
  itemName: string
  tacticName: string
  parentName?: string | null
  existingAnnotation: CloakAnnotation | null
  onSaved: (ann: CloakAnnotation) => void
  onDeleted: (ref: string) => void
  onClose: () => void
  onRequestReset: () => void
}

function AnnotationPanel({
  techniqueRef, itemName, tacticName, parentName, existingAnnotation, onSaved, onClose, onRequestReset,
}: AnnotationPanelProps) {
  const [status, setStatus] = useState<AnnotationStatus>(existingAnnotation?.status ?? '')
  const [userNotes, setUserNotes] = useState(existingAnnotation?.user_notes ?? '')
  const [counter, setCounter] = useState(existingAnnotation?.counter_notes ?? '')
  const [tags, setTags] = useState(existingAnnotation?.tags ?? '')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => () => { mountedRef.current = false }, [])

  const hasContent = status !== '' || userNotes.trim() !== '' || counter.trim() !== '' || tags.trim() !== ''

  const handleSave = async () => {
    if (savingRef.current) return
    if (!hasContent) {
      toast.error('Remplis au moins un champ avant de sauvegarder')
      return
    }
    savingRef.current = true
    setSaving(true)
    try {
      const req: CloakAnnotationRequest = {
        technique_ref: techniqueRef,
        user_notes: userNotes.trim(),
        status,
        counter_notes: counter.trim(),
        tags: tags.trim(),
      }
      const ann = await cloakAnnotationsApi.upsert(req)
      if (!mountedRef.current) return
      onSaved(ann)
      toast.success('Annotation sauvegardée')
      onClose()
    } catch {
      if (mountedRef.current) toast.error('Erreur lors de la sauvegarde')
    } finally {
      savingRef.current = false
      if (mountedRef.current) setSaving(false)
    }
  }

  return (
    <div className="ck26-inspector-inner">
      <header className="ck26-insp-head">
        <div className="ck26-insp-crumb">
          <span className="ck26-tactic-chip">{tacticName}</span>
          {parentName && <><ChevronRight size={12} aria-hidden="true" /><span>{parentName}</span></>}
        </div>
        <button type="button" className="ck26-icon-btn" onClick={onClose} aria-label="Fermer le panneau"><X size={18} aria-hidden="true" /></button>
      </header>
      <div className="ck26-insp-title">
        <p className="ck26-insp-kicker">Carnet d'analyste</p>
        <h2>{itemName}</h2>
      </div>

      <div className="ck26-insp-body">
        <section className="ck26-field">
          <h3 id="ck26-ann-status">Statut</h3>
          <div className="ck26-statusseg" role="group" aria-labelledby="ck26-ann-status">
            {STATUS_OPTIONS.map(opt => (
              <button key={opt.value} type="button" className="ck26-statusseg-btn" data-status={opt.value ? STATUS_KEY[opt.value] : 'none'}
                aria-pressed={status === opt.value} onClick={() => setStatus(opt.value)}>
                {opt.value && <StatusMark status={opt.value} dotOnly />}{opt.label}
              </button>
            ))}
          </div>
        </section>

        <section className="ck26-field">
          <label htmlFor="ck26-ann-notes">Notes personnelles</label>
          <textarea id="ck26-ann-notes" className="ck26-textarea" value={userNotes} onChange={e => setUserNotes(e.target.value)}
            rows={6} placeholder="Observations, commandes testées, résultats…" />
        </section>
        <section className="ck26-field">
          <label htmlFor="ck26-ann-counter">Contre-mesures</label>
          <textarea id="ck26-ann-counter" className="ck26-textarea" value={counter} onChange={e => setCounter(e.target.value)}
            rows={4} placeholder="Détection SIEM, règles Sigma, mesures défensives…" />
        </section>
        <section className="ck26-field">
          <label htmlFor="ck26-ann-tags">Tags personnels</label>
          <input id="ck26-ann-tags" className="ck26-input" value={tags} onChange={e => setTags(e.target.value)}
            placeholder="à-tester, priorité-haute, red-team…" aria-describedby="ck26-ann-tags-hint" />
          <small id="ck26-ann-tags-hint">Séparés par des virgules.</small>
        </section>
      </div>

      <footer className="ck26-insp-foot">
        {existingAnnotation
          ? <button type="button" className="ck26-ghost is-danger" onClick={onRequestReset}><Trash2 size={14} aria-hidden="true" /> Réinitialiser</button>
          : <span />}
        <div className="ck26-insp-foot-actions">
          <button type="button" className="ck26-ghost" onClick={onClose}>Annuler</button>
          <button type="button" className="ck26-btn is-primary" onClick={handleSave} disabled={saving || !hasContent}>
            {saving ? <Loader2 size={14} className="ck26-spin" aria-hidden="true" /> : null}
            {saving ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
        </div>
      </footer>
    </div>
  )
}

// ── Inspector detail ────────────────────────────────────────────────────────

type DetailItem =
  | { kind: 'technique'; tactic: CloakTactic; item: CloakTechnique }
  | { kind: 'subtechnique'; tactic: CloakTactic; parent: CloakTechnique; item: CloakSubTechnique }

interface DetailPanelProps {
  detail: DetailItem
  annotation: CloakAnnotation | null
  onClose: () => void
  onAnnotate: () => void
  onSelectSub: (tactic: CloakTactic, parent: CloakTechnique, sub: CloakSubTechnique) => void
}

function DetailPanel({ detail, annotation, onClose, onAnnotate, onSelectSub }: DetailPanelProps) {
  const item = detail.item
  const procs: CloakProcedure[] = item.procedures ?? []
  const subs = detail.kind === 'technique' ? (detail.item as CloakTechnique).subtechniques ?? [] : []
  const tacticName = detail.tactic.name
  const parentName = detail.kind === 'subtechnique' ? detail.parent.name : null

  return (
    <div className="ck26-inspector-inner">
      <header className="ck26-insp-head">
        <div className="ck26-insp-crumb">
          <span className="ck26-tactic-chip">{tacticName}</span>
          {parentName && <><ChevronRight size={12} aria-hidden="true" /><span>{parentName}</span></>}
        </div>
        <div className="ck26-insp-head-actions">
          <button type="button" className="ck26-ghost" onClick={onAnnotate} aria-label="Annoter la fiche">
            <Pencil size={14} aria-hidden="true" /> {annotation ? 'Annotation' : 'Annoter'}
          </button>
          <button type="button" className="ck26-icon-btn" onClick={onClose} aria-label="Fermer le panneau"><X size={18} aria-hidden="true" /></button>
        </div>
      </header>

      <div className="ck26-insp-title">
        <p className="ck26-insp-kicker">{detail.kind === 'subtechnique' ? 'Sous-technique' : 'Technique'}</p>
        <h2>{item.name}</h2>
        <div className="ck26-insp-marks">
          {item.type && <LevelMark type={item.type} />}
          {annotation?.status && <StatusMark status={annotation.status} />}
        </div>
      </div>

      <div className="ck26-insp-body">
        <section className="ck26-insp-sec">
          <h3>Description</h3>
          <p className="ck26-prose">{item.description?.trim() || '—'}</p>
        </section>

        {subs.length > 0 && (
          <section className="ck26-insp-sec">
            <h3>Sous-techniques <small>{subs.length}</small></h3>
            <ul className="ck26-sublist">
              {subs.map(st => (
                <li key={st.id}>
                  <button type="button" className="ck26-subrow" onClick={() => onSelectSub(detail.tactic, detail.item as CloakTechnique, st)}>
                    <span className="ck26-subrow-arrow" aria-hidden="true">↳</span>
                    <span className="ck26-subrow-body">
                      <span className="ck26-subrow-top">
                        <span className="ck26-subrow-name">{st.name}</span>
                        {st.type && <LevelMark type={st.type} short />}
                      </span>
                      {st.description && <span className="ck26-subrow-desc">{st.description}</span>}
                    </span>
                    <ChevronRight size={14} aria-hidden="true" className="ck26-subrow-go" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {procs.length > 0 && (
          <section className="ck26-insp-sec">
            <h3>Procédures / outils <small>{procs.length}</small></h3>
            <ul className="ck26-proclist">
              {procs.map((p, i) => {
                const { urls, clean } = procUrl(p.description)
                return (
                  <li key={`${p.id}-${i}`} className="ck26-proc">
                    <div className="ck26-proc-top">
                      <span className="ck26-proc-name">{p.name}</span>
                      {urls.length > 0 && <span className="ck26-proc-links">
                        {urls.map((link, index) => <a key={`${link}-${index}`} href={link} target="_blank" rel="noopener noreferrer" className="ck26-proc-link">
                          Source{urls.length > 1 ? ` ${index + 1}` : ''} <ExternalLink size={12} aria-hidden="true" />
                        </a>)}
                      </span>}
                    </div>
                    {clean && <p className="ck26-proc-desc">{clean}</p>}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {(annotation?.user_notes || annotation?.counter_notes) && (
          <section className="ck26-insp-sec ck26-notes">
            <h3>Notes d'analyste</h3>
            {annotation?.user_notes && (
              <div className="ck26-note-block"><p className="ck26-note-label">Personnelles</p><p className="ck26-prose">{annotation.user_notes}</p></div>
            )}
            {annotation?.counter_notes && (
              <div className="ck26-note-block"><p className="ck26-note-label">Contre-mesures</p><p className="ck26-prose">{annotation.counter_notes}</p></div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

// ── Technique registry row ──────────────────────────────────────────────────

interface TechRowProps {
  tactic: CloakTactic; tech: CloakTechnique; selected: boolean; showTactic: boolean
  annotation: CloakAnnotation | null
  onSelect: (tactic: CloakTactic, tech: CloakTechnique) => void
  onSelectSub: (tactic: CloakTactic, tech: CloakTechnique, sub: CloakSubTechnique) => void
  onAnnotate: (tactic: CloakTactic, tech: CloakTechnique) => void
  selectedSubId?: number; expandedId: number | null; onToggleExpand: (id: number) => void
}

function TechRow({
  tactic, tech, selected, showTactic, annotation, onSelect, onSelectSub, onAnnotate,
  selectedSubId, expandedId, onToggleExpand,
}: TechRowProps) {
  const hasSubs = (tech.subtechniques?.length ?? 0) > 0
  const isExpanded = expandedId === tech.id
  const totalProcs = (tech.procedures?.length ?? 0) +
    (tech.subtechniques?.reduce((a, s) => a + (s.procedures?.length ?? 0), 0) ?? 0)

  return (
    <li className="ck26-tech" data-selected={selected || undefined}>
      <div className="ck26-tech-line">
        <span className="ck26-tech-rail" aria-hidden="true" />
        <button type="button" className="ck26-tech-main" aria-current={selected || undefined} onClick={() => onSelect(tactic, tech)}>
          <span className="ck26-tech-id">TE-{tech.id}</span>
          <span className="ck26-tech-body">
            <span className="ck26-tech-name">{tech.name}</span>
            <span className="ck26-tech-meta">
              {showTactic && <span className="ck26-tech-tactic">{tactic.name}</span>}
              {tech.type && <LevelMark type={tech.type} />}
              {hasSubs && <span className="ck26-tech-count">{tech.subtechniques.length} sous-tech.</span>}
              {totalProcs > 0 && <span className="ck26-tech-count">{totalProcs} proc.</span>}
              {annotation?.status && <StatusMark status={annotation.status} />}
            </span>
          </span>
        </button>
        <div className="ck26-tech-side">
          <button type="button" className="ck26-tech-annotate" data-on={annotation ? true : undefined}
            onClick={e => { e.stopPropagation(); onAnnotate(tactic, tech) }}
            aria-label={annotation ? `Modifier l'annotation de ${tech.name}` : `Annoter ${tech.name}`}>
            <Pencil size={13} aria-hidden="true" />
          </button>
          {hasSubs && (
            <button type="button" className="ck26-tech-expand" aria-expanded={isExpanded}
              onClick={() => onToggleExpand(tech.id)} aria-label={isExpanded ? 'Masquer les sous-techniques' : 'Voir les sous-techniques'}>
              <ChevronDown size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {isExpanded && hasSubs && (
        <ul className="ck26-tech-subs">
          {tech.subtechniques.map(sub => (
            <li key={sub.id}>
              <button type="button" className="ck26-subitem" data-selected={selectedSubId === sub.id || undefined}
                aria-current={selectedSubId === sub.id || undefined} onClick={() => onSelectSub(tactic, tech, sub)}>
                <span className="ck26-subitem-arrow" aria-hidden="true">↳</span>
                <span className="ck26-subitem-name">{sub.name}</span>
                {sub.type && <LevelMark type={sub.type} short />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

type RightPanel =
  | { kind: 'detail'; detail: DetailItem }
  | { kind: 'annotate'; techniqueRef: string; itemName: string; tacticName: string; parentName?: string | null; selection: { tacticId: number; techniqueId: number } }
  | null

const TYPE_FILTERS: CloakTypeFilter[] = LEVELS

export default function CLOAKPage() {
  const [data, setData] = useState<CloakData | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [annotationLoadError, setAnnotationLoadError] = useState(false)
  const [activeTacticId, setActiveTacticId] = useState<number | null>(null)
  const [typeFilter, setTypeFilter] = useState<CloakTypeFilter>('')
  const [query, setQuery] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [rightPanel, setRightPanel] = useState<RightPanel>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [annotations, setAnnotations] = useState<AnnotationMap>(new Map())
  const [confirmResetRef, setConfirmResetRef] = useState<string | null>(null)
  const panelRef = useRef<HTMLElement>(null)
  const deletingRef = useRef(false)
  const [overlayMode, setOverlayMode] = useState(false)

  // ── Chargement JSON CLOAK ──
  useEffect(() => {
    let mounted = true
    fetch('/data/cloak.json')
      .then(r => { if (!r.ok) throw new Error('CLOAK data request failed'); return r.json() as Promise<unknown> })
      .then(d => {
        const safeData = normalizeCloakData(d)
        if (!mounted) return
        setData(safeData)
        const first = safeData.tactics.find(tac => tac.name !== 'Unknown')
        setActiveTacticId(first?.id ?? null)
      })
      .catch(() => { if (mounted) setLoadError(true) })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1240px)')
    const update = () => setOverlayMode(mq.matches)
    update()
    mq.addEventListener?.('change', update)
    return () => mq.removeEventListener?.('change', update)
  }, [])

  // ── Chargement annotations ──
  useEffect(() => {
    let mounted = true
    cloakAnnotationsApi.list()
      .then(list => {
        const safeList = normalizeAnnotations(list)
        const map = new Map<string, CloakAnnotation>()
        safeList.forEach(a => map.set(a.technique_ref, a))
        if (mounted) setAnnotations(map)
      })
      .catch(() => { if (mounted) setAnnotationLoadError(true) })
    return () => { mounted = false }
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

  // ── Ref builder ──
  const techRef = (tacticId: number, techId: number) => `tac-${tacticId}:te-${techId}`
  const subRef = (tacticId: number, techId: number, subId: number) => `tac-${tacticId}:te-${techId}:sub-${subId}`

  // ── Handlers ──
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
      selection: { tacticId: tactic.id, techniqueId: tech.id },
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

  const performReset = async (ref: string) => {
    if (deletingRef.current) return
    deletingRef.current = true
    try {
      await cloakAnnotationsApi.deleteByRef(ref)
      handleAnnotationDeleted(ref)
      toast.success('Annotation supprimée')
      setRightPanel(null)
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      deletingRef.current = false
    }
  }

  const activeTacticStats = useMemo(() => {
    if (!activeTacticId || !data) return null
    const tac = realTactics.find(tac => tac.id === activeTacticId)
    if (!tac) return null
    return {
      techniques: tac.techniques.length,
      subs: tac.techniques.reduce((a, te) => a + (te.subtechniques?.length ?? 0), 0),
    }
  }, [activeTacticId, data, realTactics])

  const getCurrentDetailAnnotation = (): CloakAnnotation | null => {
    if (!rightPanel || rightPanel.kind !== 'detail') return null
    const d = rightPanel.detail
    const ref = d.kind === 'technique'
      ? techRef(d.tactic.id, d.item.id)
      : subRef(d.tactic.id, d.parent.id, d.item.id)
    return annotations.get(ref) ?? null
  }

  const panelOpen = rightPanel !== null

  useEffect(() => {
    if (!rightPanel) return
    const selected = rightPanel.kind === 'detail'
      ? { tacticId: rightPanel.detail.tactic.id, techniqueId: rightPanel.detail.kind === 'technique' ? rightPanel.detail.item.id : rightPanel.detail.parent.id }
      : rightPanel.selection
    const visible = filteredTechniques.find(({ tactic, tech }) => tactic.id === selected.tacticId && tech.id === selected.techniqueId)
    if (!visible) {
      setRightPanel(null)
      return
    }
    if (rightPanel.kind === 'detail' && rightPanel.detail.kind === 'subtechnique' &&
      !visible.tech.subtechniques.some(sub => sub.id === rightPanel.detail.item.id)) {
      setRightPanel(null)
    }
  }, [filteredTechniques, rightPanel])

  // Mobile overlay: lock page scroll, Escape closes, return focus.
  useEffect(() => {
    if (!panelOpen) return
    const mq = window.matchMedia('(max-width: 1240px)')
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="alertdialog"]')) setRightPanel(null)
    }
    const onKeyTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !mq.matches || !panelRef.current) return
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ))
      if (!focusable.length) { e.preventDefault(); panelRef.current.focus(); return }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && (document.activeElement === last || !panelRef.current.contains(document.activeElement))) {
        e.preventDefault(); first.focus()
      }
    }
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.addEventListener('keydown', onKey)
    document.addEventListener('keydown', onKeyTrap)
    let restore: string | undefined
    let locked = false
    let previousInert: Array<[HTMLElement, boolean]> = []
    const setBackgroundInert = (inert: boolean) => {
      if (inert) {
        previousInert = Array.from(document.querySelectorAll<HTMLElement>(
          '.ck26-frame > :not(.ck26-browser), .ck26-browser > .ck26-rail, .ck26-browser > .ck26-registry',
        )).map(element => [element, element.inert])
        previousInert.forEach(([element]) => { element.inert = true })
      } else {
        previousInert.forEach(([element, wasInert]) => { element.inert = wasInert })
        previousInert = []
      }
    }
    const syncOverlay = () => {
      setOverlayMode(mq.matches)
      if (mq.matches && !locked) {
        restore = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        setBackgroundInert(true)
        panelRef.current?.focus()
        locked = true
      } else if (!mq.matches && locked) {
        document.body.style.overflow = restore ?? ''
        setBackgroundInert(false)
        locked = false
      }
    }
    mq.addEventListener?.('change', syncOverlay)
    syncOverlay()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('keydown', onKeyTrap)
      mq.removeEventListener?.('change', syncOverlay)
      if (locked) {
        document.body.style.overflow = restore ?? ''
        setBackgroundInert(false)
        if (previousFocus?.isConnected) previousFocus.focus()
      }
    }
  }, [panelOpen])

  const totalTechniques = useMemo(() => realTactics.reduce((a, tac) => a + tac.techniques.length, 0), [realTactics])
  const hasFilters = Boolean(debouncedQ.trim() || typeFilter)
  const activeTacticName = activeTacticId ? realTactics.find(t => t.id === activeTacticId)?.name : null

  const status = loadError ? { text: 'DONNÉES INDISPONIBLES', tone: 'warn' as const }
    : !data ? { text: 'CHARGEMENT', tone: 'busy' as const }
    : activeTacticName ? { text: activeTacticName.toUpperCase(), mark: `${activeTacticStats?.techniques ?? 0} TECH.` }
    : { text: `${realTactics.length} TACTIQUES`, mark: `${totalTechniques} TECHNIQUES` }

  const detailAnnotation = getCurrentDetailAnnotation()

  return (
    <div className="ck26">
      <div className="ck26-frame">
        <CloakHero status={status} />

        {loadError ? (
          <div className="ck26-state is-error" role="alert">
            <AlertTriangle size={30} aria-hidden="true" />
            <h2>Données CLOAK introuvables</h2>
            <p>Le fichier <code>/data/cloak.json</code> n'est pas accessible.</p>
          </div>
        ) : !data ? (
          <div className="ck26-loading" role="status"><Loader2 size={22} className="ck26-spin" aria-hidden="true" /> Chargement de la doctrine…</div>
        ) : (
          <>
            {/* Toolbar: search + level filters */}
            <section className="ck26-toolbar" aria-label="Recherche et filtres">
              <label className="ck26-search">
                <Search size={17} aria-hidden="true" />
                <span className="ck26-sr">Rechercher une technique</span>
                <input type="search" value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Rechercher une technique, sous-technique, outil…" autoComplete="off" spellCheck={false} />
                {query && <button type="button" className="ck26-search-clear" onClick={() => setQuery('')} aria-label="Effacer la recherche"><X size={15} aria-hidden="true" /></button>}
              </label>
              <div className="ck26-levels" role="group" aria-label="Niveau">
                <span className="ck26-levels-label">Niveau</span>
                {TYPE_FILTERS.map(tf => (
                  <button key={tf} type="button" className="ck26-levelbtn" data-level-btn={tf} aria-pressed={typeFilter === tf}
                    onClick={() => setTypeFilter(prev => prev === tf ? '' : tf)}>
                    <LevelMark type={tf} />
                  </button>
                ))}
                {hasFilters && (
                  <button type="button" className="ck26-link" onClick={() => { setQuery(''); setTypeFilter('') }}>
                    <X size={13} aria-hidden="true" /> Réinitialiser
                  </button>
                )}
              </div>
              {annotationLoadError && <p className="ck26-ann-warning" role="status">Les annotations personnelles n'ont pas pu être chargées. Le référentiel CLOAK reste disponible.</p>}
            </section>

            {/* Browser: tactics rail + registry + inspector */}
            <div className="ck26-browser" data-inspector={panelOpen || undefined}>
              <nav className="ck26-rail" aria-label="Tactiques">
                <button type="button" className="ck26-rail-item" data-active={activeTacticId === null || undefined}
                  aria-current={activeTacticId === null || undefined}
                  onClick={() => { setActiveTacticId(null); setRightPanel(null) }}>
                  <span className="ck26-rail-name">Toutes les tactiques</span>
                  <span className="ck26-rail-count">{realTactics.length}</span>
                </button>
                <div className="ck26-rail-sep" aria-hidden="true" />
                {realTactics.map(tac => (
                  <button key={tac.id} type="button" className="ck26-rail-item" data-active={activeTacticId === tac.id || undefined}
                    aria-current={activeTacticId === tac.id || undefined} onClick={() => handleTacticChange(tac.id)}>
                    <span className="ck26-rail-name">{tac.name}</span>
                    <span className="ck26-rail-count">{tac.techniques.length}</span>
                  </button>
                ))}
              </nav>

              <section className="ck26-registry" aria-label="Techniques">
                <header className="ck26-registry-head">
                  <h2>{activeTacticName ?? 'Toutes les tactiques'}</h2>
                  <p>
                    <b>{filteredTechniques.length}</b> technique{filteredTechniques.length > 1 ? 's' : ''}
                    {activeTacticStats && !hasFilters && <> · {activeTacticStats.subs} sous-tech.</>}
                    {hasFilters && ' (filtré)'}
                  </p>
                </header>
                {filteredTechniques.length === 0 ? (
                  <div className="ck26-state">
                    <Layers size={28} aria-hidden="true" />
                    <h2>Aucune technique trouvée</h2>
                    <p>Aucune technique ne correspond à ces critères.</p>
                    <button type="button" className="ck26-btn" onClick={() => { setQuery(''); setTypeFilter(''); setActiveTacticId(null) }}>Réinitialiser</button>
                  </div>
                ) : (
                  <ul className="ck26-techs">
                    {filteredTechniques.map(({ tactic, tech }) => (
                      <TechRow
                        key={`${tactic.id}-${tech.id}`}
                        tactic={tactic} tech={tech} showTactic={activeTacticId === null}
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
                          rightPanel.detail.tactic.id === tactic.id &&
                          rightPanel.detail.parent.id === tech.id
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
                  </ul>
                )}
              </section>

              {panelOpen && (
                <>
                  <div className="ck26-inspector-scrim" aria-hidden="true" onClick={() => setRightPanel(null)} />
                  <aside className="ck26-inspector" role="dialog" aria-modal={overlayMode || undefined} aria-label="Inspecteur" tabIndex={-1} ref={panelRef}>
                    <button type="button" className="ck26-back" onClick={() => setRightPanel(null)}>
                      <ChevronLeft size={16} aria-hidden="true" /> Registre
                    </button>
                    {rightPanel.kind === 'detail' ? (
                      <DetailPanel
                        detail={rightPanel.detail}
                        annotation={detailAnnotation}
                        onClose={() => setRightPanel(null)}
                        onSelectSub={handleSelectSub}
                        onAnnotate={() => {
                          const d = rightPanel.detail
                          const ref = d.kind === 'technique' ? techRef(d.tactic.id, d.item.id) : subRef(d.tactic.id, d.parent.id, d.item.id)
                          setRightPanel({ kind: 'annotate', techniqueRef: ref, itemName: d.item.name, tacticName: d.tactic.name, parentName: d.kind === 'subtechnique' ? d.parent.name : null, selection: { tacticId: d.tactic.id, techniqueId: d.kind === 'technique' ? d.item.id : d.parent.id } })
                        }}
                      />
                    ) : (
                      <AnnotationPanel
                        key={rightPanel.techniqueRef}
                        techniqueRef={rightPanel.techniqueRef}
                        itemName={rightPanel.itemName}
                        tacticName={rightPanel.tacticName}
                        parentName={rightPanel.parentName}
                        existingAnnotation={annotations.get(rightPanel.techniqueRef) ?? null}
                        onSaved={handleAnnotationSaved}
                        onDeleted={handleAnnotationDeleted}
                        onClose={() => setRightPanel(null)}
                        onRequestReset={() => setConfirmResetRef(rightPanel.techniqueRef)}
                      />
                    )}
                  </aside>
                </>
              )}
            </div>
          </>
        )}

        {/* Attribution / licence — à préserver. */}
        <footer className="ck26-attrib">
          <AlertTriangle size={13} aria-hidden="true" />
          <p>
            CLOAK — framework académique de référence, usage légal et éducatif uniquement. Licence GPL-2.0 ·{' '}
            <a href="https://github.com/Mickinthemiddle/CLOAK" target="_blank" rel="noopener noreferrer">Source (Mick Deben / Leiden University)</a>
          </p>
        </footer>
      </div>

      <ConfirmModal
        open={confirmResetRef !== null}
        title="RÉINITIALISER L'ANNOTATION ?"
        message="Les annotations personnelles de cette technique seront supprimées."
        confirmLabel="Réinitialiser"
        danger
        onConfirm={() => { const ref = confirmResetRef; setConfirmResetRef(null); if (ref) performReset(ref) }}
        onCancel={() => setConfirmResetRef(null)}
      />
    </div>
  )
}
