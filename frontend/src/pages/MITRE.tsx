import { useEffect, useState, useCallback, useRef } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Shield, Search, ExternalLink, X,
  Loader2, RefreshCw, ChevronDown, ChevronUp,
  AlertTriangle, Database, RotateCcw, Eye,
  SlidersHorizontal, PanelLeftOpen, PanelLeftClose, ArrowLeft,
} from 'lucide-react'
import MitreCircuit from '@/mitre/MitreCircuit'
import { MitreDisplaySettings, useMitrePreferences } from '@/mitre/MitrePreferences'
import { mitreApi } from '@/api/client'
import type { MITRETactic, MITRETechnique, MITREStatus } from '@/types'
import {
  MitreHeader, PlatformIcon, PlatformTag, RichText, SkeletonGrid, StateBlock, onTacticKeys, parseArr, tacticTone,
} from '@/mitre/MitreUi'

// ⚠️ Données MITRE ATT&CK — usage légal et éducatif uniquement

interface TechCardProps {
  t: MITRETechnique; activeTactic: string
  onSelect: (t: MITRETechnique) => void; selected: boolean
  tactics: MITRETactic[]
}

function TechCard({ t: tech, activeTactic, onSelect, selected, tactics }: TechCardProps) {
  const techTactics = parseArr(tech.tactics)
  const allPlatforms = parseArr(tech.platforms)
  const platforms = allPlatforms.slice(0, 3)
  const accentTactic = activeTactic || techTactics[0] || ''
  const tacticName = tactics.find(tac => tac.short_name === accentTactic)?.name ?? accentTactic
  return (
    <button type="button" onClick={() => onSelect(tech)} aria-pressed={selected}
      className="mx-card" {...tacticTone(accentTactic)} data-technique={tech.technique_id}>
      <span className="mx-card-top">
        <span className="mx-id">{tech.technique_id}</span>
        {selected
          ? <span className="mx-selected-mark"><Eye size={13} aria-hidden="true" />Affichée</span>
          : tech.is_subtechnique && <span className="mx-tag">Sous-technique</span>}
      </span>
      <span className="mx-card-name">{tech.name}</span>
      {tacticName && (
        <span className="mx-card-tactic">{tacticName}{techTactics.length > 1 ? ` +${techTactics.length - 1}` : ''}</span>
      )}
      {platforms.length > 0 && (
        <span className="mx-card-meta">
          {platforms.map(p => <span key={p} className="mx-plat"><PlatformIcon name={p} size={12} />{p}</span>)}
          {allPlatforms.length > 3 && (
            <span className="mx-plat" aria-label={`${allPlatforms.length - 3} autres plateformes`}>+{allPlatforms.length - 3}</span>
          )}
        </span>
      )}
    </button>
  )
}

interface DetailPanelProps {
  technique: MITRETechnique | null; loading: boolean
  onClose: () => void; tactics: MITRETactic[]
  /* Opened from an IOC investigation: a way straight back to it. */
  onReturn?: () => void
}

function DetailPanel({ technique, loading, onClose, tactics, onReturn }: DetailPanelProps) {
  const [showDetection, setShowDetection] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { setShowDetection(false) }, [technique?.technique_id])
  // Focus enters the panel when it opens.
  useEffect(() => { closeRef.current?.focus() }, [])

  const techTactics = parseArr(technique?.tactics)
  const platforms = parseArr(technique?.platforms)
  const dataSources = parseArr(technique?.data_sources)

  return (
    <aside className="mx-detail" aria-label={technique ? `Détail de ${technique.technique_id}` : 'Détail de la technique'} aria-busy={loading}>
      <div className="mx-detail-head">
        <div style={{ minWidth: 0 }}>
          {onReturn && (
            <button type="button" className="mx-detail-return" onClick={onReturn}>
              <ArrowLeft size={13} aria-hidden="true" />Retour à l’investigation IOC
            </button>
          )}
          {loading ? (
            <span className="mx-tag" role="status"><Loader2 size={12} className="mx-spin" />Chargement…</span>
          ) : (
            <>
              <span className="mx-row">
                <span className="mx-id">{technique?.technique_id}</span>
                {technique?.is_subtechnique && <span className="mx-tag">Sous-technique de {technique.parent_id}</span>}
              </span>
              <h2>{technique?.name}</h2>
              {techTactics.length > 0 && (
                <div className="mx-detail-meta" aria-label="Tactiques">
                  {techTactics.map(sn => (
                    <span key={sn} className="mx-tag is-tone" {...tacticTone(sn)}>
                      {tactics.find(tac => tac.short_name === sn)?.name ?? sn}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <button ref={closeRef} type="button" onClick={onClose} className="mx-icon-btn" aria-label="Fermer le détail"><X size={16} /></button>
      </div>
      {technique && !loading && (
        <div className="mx-detail-body">
          {platforms.length > 0 && (
            <section className="mx-section">
              <h3>Plateformes</h3>
              <div className="mx-row">{platforms.map(p => <PlatformTag key={p} name={p} />)}</div>
            </section>
          )}
          <section className="mx-section">
            <h3>Description</h3>
            <RichText text={technique.description} />
          </section>
          {technique.detection && (
            <section className="mx-section">
              <button type="button" className="mx-disclosure" aria-expanded={showDetection} aria-controls="mx-detection"
                onClick={() => setShowDetection(v => !v)}>
                <Shield size={14} aria-hidden="true" />Détection
                {showDetection ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
              </button>
              {showDetection && <div id="mx-detection"><RichText text={technique.detection} /></div>}
            </section>
          )}
          {dataSources.length > 0 && (
            <section className="mx-section">
              <h3>Sources de données</h3>
              <div className="mx-row">
                {dataSources.slice(0, 8).map(ds => (
                  <span key={ds} className="mx-tag">{ds.split(':').pop()?.trim() ?? ds}</span>
                ))}
              </div>
            </section>
          )}
          {technique.url && (
            <section className="mx-section">
              <h3>Références</h3>
              <ul className="mx-refs">
                <li>
                  <a href={technique.url} target="_blank" rel="noopener noreferrer" className="mx-link">
                    <ExternalLink size={14} aria-hidden="true" />Voir {technique.technique_id} sur attack.mitre.org
                  </a>
                </li>
              </ul>
            </section>
          )}
        </div>
      )}
    </aside>
  )
}

const PLATFORMS_FILTER = ['Windows', 'Linux', 'macOS', 'Cloud', 'Network', 'Android']

export default function MITRE() {
  const [display, setDisplay] = useMitrePreferences()
  const [status, setStatus] = useState<MITREStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusError, setStatusError] = useState(false)
  const [tactics, setTactics] = useState<MITRETactic[]>([])
  const [techniques, setTechniques] = useState<MITRETechnique[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [techniquesError, setTechniquesError] = useState(false)
  const [activeTactic, setActiveTactic] = useState<string>('')
  const [activePlatform, setActivePlatform] = useState<string>('')
  const [query, setQuery] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [showSubs, setShowSubs] = useState(true)
  const [selected, setSelected] = useState<MITRETechnique | null>(null)
  const [detailFull, setDetailFull] = useState<MITRETechnique | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const fromIoc = (location.state as { from?: string } | null)?.from === 'ioc'
  // `?technique=T1046` (or `?id=`) opens that exact technique; handled once per ID.
  const requested = (searchParams.get('technique') ?? searchParams.get('id') ?? '').trim().toUpperCase()
  const handledRequest = useRef('')
  const [requestNotice, setRequestNotice] = useState<string | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const statusRequestId = useRef(0)
  const techniquesRequestId = useRef(0)
  const opener = useRef<HTMLElement | null>(null)
  const LIMIT = 60

  const fetchStatus = useCallback(async () => {
    const requestId = ++statusRequestId.current
    try {
      const s = await mitreApi.status()
      if (requestId !== statusRequestId.current) return
      setStatus(s)
      setStatusLoading(false)
      setStatusError(false)
      if (s.seeded && pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    } catch {
      if (requestId !== statusRequestId.current) return
      setStatusLoading(false)
      setStatusError(true)
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
  }, [])

  useEffect(() => {
    pollRef.current = setInterval(fetchStatus, 3000)
    void fetchStatus()
    return () => {
      statusRequestId.current++
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
  }, [fetchStatus])

  const retryStatus = () => {
    setStatusLoading(true)
    setStatusError(false)
    if (!pollRef.current) pollRef.current = setInterval(fetchStatus, 3000)
    void fetchStatus()
  }

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

  // Direct link to a technique: fetch it by its exact ID (no fuzzy search),
  // show it in the grid and open its detail.
  useEffect(() => {
    if (!status?.seeded || !requested || handledRequest.current === requested) return
    handledRequest.current = requested
    setRequestNotice(null)
    if (!/^T\d{4}(\.\d{3})?$/.test(requested)) {
      setRequestNotice(`« ${requested} » n’est pas un identifiant de technique ATT&CK valide.`)
      return
    }
    let cancelled = false
    mitreApi.technique(requested)
      .then(tech => {
        if (cancelled) return
        if (tech?.technique_id?.toUpperCase() !== requested) throw new Error('mismatch')
        setQuery(requested)
        setDetailFull(tech)
        setSelected(tech)
      })
      .catch(() => { if (!cancelled) setRequestNotice(`Technique ${requested} introuvable dans la matrice locale.`) })
    return () => { cancelled = true }
  }, [status?.seeded, requested])

  const fetchTechniques = useCallback(async (pg: number) => {
    if (!status?.seeded) return
    const requestId = ++techniquesRequestId.current
    setLoading(true)
    setTechniquesError(false)
    setTechniques([])
    setTotal(0)
    setPage(pg)
    try {
      const res = await mitreApi.techniques({
        tactic: activeTactic || undefined, platform: activePlatform || undefined,
        q: debouncedQ || undefined, only_techniques: !showSubs || undefined,
        page: pg, limit: LIMIT,
      })
      if (requestId !== techniquesRequestId.current) return
      setTechniques(res.items ?? [])
      setTotal(res.total)
    } catch {
      if (requestId !== techniquesRequestId.current) return
      setTechniquesError(true)
    } finally {
      if (requestId === techniquesRequestId.current) setLoading(false)
    }
  }, [status?.seeded, activeTactic, activePlatform, debouncedQ, showSubs])

  useEffect(() => {
    void fetchTechniques(1)
    return () => { techniquesRequestId.current++ }
  }, [fetchTechniques])

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
  // The open technique stays in the URL (shareable), without a new history entry.
  const setTechniqueParam = useCallback((id: string | null) => {
    const next = new URLSearchParams(searchParams)
    next.delete('id')
    if (id) next.set('technique', id); else next.delete('technique')
    handledRequest.current = id ?? ''
    setSearchParams(next, { replace: true, state: location.state })
  }, [searchParams, setSearchParams, location.state])
  const handleSelectTechnique = useCallback((tech: MITRETechnique) => {
    if (document.activeElement instanceof HTMLElement) opener.current = document.activeElement
    setDetailFull(null); setDetailLoading(true); setSelected(tech)
    setTechniqueParam(tech.technique_id)
  }, [setTechniqueParam])
  const resetFilters = () => { setActiveTactic(''); setActivePlatform(''); setQuery(''); setShowSubs(true) }

  // Closing the detail returns focus to the card that opened it.
  const closeDetail = useCallback(() => {
    setSelected(null)
    setTechniqueParam(null)
    const target = opener.current
    window.setTimeout(() => { if (target?.isConnected) target.focus() }, 0)
  }, [setTechniqueParam])

  // Escape closes the detail panel.
  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) closeDetail() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, closeDetail])

  const totalPages = Math.ceil(total / LIMIT)
  const currentTactic = tactics.find(tac => tac.short_name === activeTactic)
  const filtered = !!(activeTactic || activePlatform || debouncedQ || !showSubs)
  const advancedCount = Number(!!activeTactic) + Number(!!activePlatform) + Number(!showSubs)
  const searchPending = query !== debouncedQ

  if (statusError) return (
    <div className="mx">
      <StateBlock page warn icon={<AlertTriangle size={22} />} title="Service MITRE indisponible"
        actions={<button type="button" onClick={retryStatus} className="mx-btn is-primary"><RefreshCw size={14} />Réessayer</button>}>
        Impossible de charger l’état de MITRE ATT&CK. Vérifiez la connexion au serveur, puis réessayez.
      </StateBlock>
    </div>
  )

  if (statusLoading || !status) return (
    <div className="mx">
      <StateBlock page live icon={<Loader2 size={22} className="mx-spin" />} title="Chargement de MITRE ATT&CK…" />
    </div>
  )

  if (status.seeding && !status.seeded) return (
    <div className="mx">
      <StateBlock page live icon={<Database size={22} />} title="Synchronisation MITRE ATT&CK"
        actions={<span className="mx-tag"><Loader2 size={12} className="mx-spin" />Indexation en cours…</span>}>
        Téléchargement et indexation des techniques ATT&CK Enterprise. Premier démarrage uniquement : les données seront disponibles dans quelques instants.
      </StateBlock>
    </div>
  )

  if (!status.seeded && !status.seeding) return (
    <div className="mx">
      <StateBlock page warn icon={<AlertTriangle size={22} />} title="Données MITRE non disponibles"
        actions={<button type="button" onClick={() => window.location.reload()} className="mx-btn is-primary"><RefreshCw size={14} />Réessayer</button>}>
        Le téléchargement des données ATT&CK n’a pas pu se faire (connexion requise au premier démarrage).
      </StateBlock>
    </div>
  )

  return (
    <div className="mx" data-layout={display.layout}>
      {display.circuit && <MitreCircuit />}
      <MitreHeader
        breadcrumb="Intel / ATT&CK Enterprise"
        title="MITRE"
        accent="ATT&CK"
        subtitle="Matrice Enterprise locale : tactiques, techniques et sous-techniques."
        status={{ text: 'SYNCHRONISÉ', mark: `${status.count} TECH.` }}
        actions={fromIoc ? (
          <button type="button" className="mx-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={14} aria-hidden="true" />Retour à l’investigation IOC
          </button>
        ) : undefined}
        below={
          /* Search, result count, sub-techniques and platforms */
          <div className="mx-toolbar">
            <div className="mx-toolbar-row">
              <div className="mx-search" role="search">
                <Search size={15} aria-hidden="true" />
                <label htmlFor="mx-q" className="mx-sr">Rechercher une technique</label>
                <input id="mx-q" type="search" value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="ID (T1059), nom, description…" className="mx-input" autoComplete="off" />
                {query && (
                  <button type="button" className="mx-clear" onClick={() => setQuery('')} aria-label="Effacer la recherche"><X size={14} /></button>
                )}
              </div>
              <span className="mx-result-count" aria-live="polite">
                {loading || searchPending ? 'Recherche…' : techniquesError ? 'Résultats indisponibles' : <><b>{total.toLocaleString('fr-FR')}</b>résultat{total > 1 ? 's' : ''}</>}
              </span>
              <button type="button" className="mx-btn" aria-expanded={display.filters} aria-controls="mx-advanced-filters"
                onClick={() => setDisplay({ ...display, filters: !display.filters })}>
                <SlidersHorizontal size={15} aria-hidden="true" />Filtres{advancedCount > 0 ? ` · ${advancedCount} actif${advancedCount > 1 ? 's' : ''}` : ''}
              </button>
              <MitreDisplaySettings preferences={display} onChange={setDisplay} />
            </div>
            {advancedCount > 0 && !display.filters && <div className="mx-filter-summary" aria-label="Filtres actifs">
              {activeTactic && <button type="button" className="mx-chip" onClick={() => handleTacticChange(activeTactic)}
                aria-label={`Retirer le filtre tactique ${currentTactic?.name ?? activeTactic}`}>
                {currentTactic?.name ?? activeTactic}<X size={12} aria-hidden="true" />
              </button>}
              {activePlatform && <button type="button" className="mx-chip" onClick={() => handlePlatformChange(activePlatform)}
                aria-label={`Retirer le filtre plateforme ${activePlatform}`}>
                <PlatformIcon name={activePlatform} />{activePlatform}<X size={12} aria-hidden="true" />
              </button>}
              {!showSubs && <button type="button" className="mx-chip" onClick={() => setShowSubs(true)}
                aria-label="Inclure à nouveau les sous-techniques">Techniques seules<X size={12} aria-hidden="true" /></button>}
            </div>}
            <div id="mx-advanced-filters" className="mx-advanced-filters" hidden={!display.filters}>
              <div className="mx-toolbar-row" role="group" aria-label="Filtrer par plateforme">
                <span className="mx-toolbar-label" aria-hidden="true">Plateforme</span>
                {PLATFORMS_FILTER.map(p => (
                  <button key={p} type="button" className="mx-chip" aria-pressed={activePlatform === p} onClick={() => handlePlatformChange(p)}>
                    <PlatformIcon name={p} />{p}
                  </button>
                ))}
              </div>
              <div className="mx-toolbar-row">
                <button type="button" role="switch" aria-checked={showSubs} className="mx-switch" onClick={() => setShowSubs(v => !v)}>
                  <i aria-hidden="true" />Inclure les sous-techniques
                </button>
                <button type="button" onClick={resetFilters} className="mx-btn" disabled={!filtered && !query}>
                  <RotateCcw size={14} aria-hidden="true" />Réinitialiser les filtres
                </button>
              </div>
            </div>
          </div>
        }
      />

      <div className={`mx-body${selected ? ' has-detail' : ''}${display.tactics ? '' : ' is-rail-hidden'}`}>
        {/* Tactics */}
        <nav className="mx-rail" aria-label="Tactiques ATT&CK" onKeyDown={onTacticKeys}>
          <p className="mx-rail-title">Tactiques</p>
          <ul>
            <li>
              <button type="button" className="mx-tactic is-all" aria-pressed={activeTactic === ''} onClick={() => handleTacticChange('')}>
                <span>Toutes les tactiques</span>
              </button>
            </li>
          </ul>
          <hr />
          <ul>
            {tactics.map(tac => (
              <li key={tac.tactic_id}>
                <button type="button" className="mx-tactic" {...tacticTone(tac.short_name)} aria-pressed={activeTactic === tac.short_name}
                  onClick={() => handleTacticChange(tac.short_name)}>
                  <span>{tac.name}</span><small>{tac.tactic_id}</small>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Techniques */}
        <section className="mx-main" aria-label="Techniques">
          <div className="mx-results">
            <p className="mx-results-title" aria-live="polite">
              {currentTactic && <span className="mx-tone-dot" {...tacticTone(activeTactic)} aria-hidden="true" />}
              <strong>{currentTactic?.name ?? 'Toutes les tactiques'}</strong>
              {totalPages > 1 && <span>Page {page} / {totalPages}</span>}
            </p>
            <button type="button" className="mx-btn mx-rail-toggle" onClick={() => setDisplay({ ...display, tactics: !display.tactics })}
              aria-expanded={display.tactics} aria-label={display.tactics ? 'Replier les tactiques' : 'Afficher les tactiques'}>
              {display.tactics ? <PanelLeftClose size={15} aria-hidden="true" /> : <PanelLeftOpen size={15} aria-hidden="true" />}
              {display.tactics ? 'Replier' : `Tactiques${currentTactic ? ` · ${currentTactic.name}` : ''}`}
            </button>
            {(loading || searchPending) && <Loader2 size={15} className="mx-spin" aria-hidden="true" style={{ color: 'var(--mx-cyan)' }} />}
          </div>

          {requestNotice && (
            <p className="mx-notice" role="alert">
              <AlertTriangle size={14} aria-hidden="true" />{requestNotice}
              <button type="button" className="mx-clear" onClick={() => setRequestNotice(null)} aria-label="Masquer le message"><X size={13} /></button>
            </p>
          )}
          <div className="mx-scroll">
            {loading || searchPending ? (
              <SkeletonGrid />
            ) : techniquesError ? (
              <StateBlock warn icon={<AlertTriangle size={22} />} title="Chargement des techniques impossible"
                actions={<button type="button" onClick={() => void fetchTechniques(page)} className="mx-btn is-primary"><RefreshCw size={14} />Réessayer</button>}>
                Impossible de charger les techniques ATT&CK pour cette recherche. Réessayez dans un instant.
              </StateBlock>
            ) : techniques.length === 0 ? (
              <StateBlock icon={<Shield size={22} />} title="Aucune technique trouvée"
                actions={filtered ? <button type="button" onClick={resetFilters} className="mx-btn is-primary"><RotateCcw size={14} />Réinitialiser les filtres</button> : undefined}>
                {filtered ? 'Aucun résultat pour ces filtres. Modifiez la recherche, la tactique ou la plateforme.' : 'La matrice ne renvoie aucune technique.'}
              </StateBlock>
            ) : (
              <>
                <div className="mx-grid">
                  {techniques.map(tech => (
                    <TechCard key={tech.technique_id} t={tech} activeTactic={activeTactic} tactics={tactics}
                      onSelect={handleSelectTechnique} selected={selected?.technique_id === tech.technique_id} />
                  ))}
                </div>
                {totalPages > 1 && (
                  <nav className="mx-pager" aria-label="Pagination des techniques">
                    <button type="button" className="mx-btn" disabled={page === 1} onClick={() => fetchTechniques(page - 1)}>← Précédent</button>
                    <span>Page {page} / {totalPages}</span>
                    <button type="button" className="mx-btn" disabled={page === totalPages} onClick={() => fetchTechniques(page + 1)}>Suivant →</button>
                  </nav>
                )}
              </>
            )}
          </div>
        </section>

        {/* Technique detail */}
        {selected && (
          <>
            <div className="mx-scrim" aria-hidden="true" onClick={closeDetail} />
            <DetailPanel technique={detailFull} loading={detailLoading} onClose={closeDetail} tactics={tactics}
              onReturn={fromIoc ? () => navigate(-1) : undefined} />
          </>
        )}
      </div>
    </div>
  )
}
