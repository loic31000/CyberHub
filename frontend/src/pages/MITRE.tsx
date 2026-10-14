import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Shield, Search, ExternalLink, X,
  Loader2, RefreshCw, ChevronDown, ChevronUp,
  AlertTriangle, Database, RotateCcw, Eye,
} from 'lucide-react'
import MitreCircuit from '@/mitre/MitreCircuit'
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
}

function DetailPanel({ technique, loading, onClose, tactics }: DetailPanelProps) {
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
  const opener = useRef<HTMLElement | null>(null)
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
    if (document.activeElement instanceof HTMLElement) opener.current = document.activeElement
    setDetailFull(null); setDetailLoading(true); setSelected(tech)
  }, [])
  const resetFilters = () => { setActiveTactic(''); setActivePlatform(''); setQuery('') }

  // Closing the detail returns focus to the card that opened it.
  const closeDetail = useCallback(() => {
    setSelected(null)
    const target = opener.current
    window.setTimeout(() => { if (target?.isConnected) target.focus() }, 0)
  }, [])

  // Escape closes the detail panel.
  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) closeDetail() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, closeDetail])

  const totalPages = Math.ceil(total / LIMIT)
  const currentTactic = tactics.find(tac => tac.short_name === activeTactic)
  const filtered = !!(activeTactic || activePlatform || debouncedQ)

  if (!status) return (
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
    <div className="mx">
      <MitreCircuit />
      <MitreHeader
        breadcrumb="Intel / ATT&CK Enterprise"
        title="MITRE"
        accent="ATT&CK"
        subtitle="Matrice Enterprise locale : tactiques, techniques et sous-techniques."
        status={{ text: 'SYNCHRONISÉ', mark: `${status.count} TECH.` }}
        actions={
          <button type="button" onClick={resetFilters} className="mx-btn" disabled={!filtered && !query}>
            <RotateCcw size={14} aria-hidden="true" />Réinitialiser les filtres
          </button>
        }
        stats={[
          { label: 'Techniques indexées', value: status.count.toLocaleString('fr-FR'), cyan: true },
          { label: 'Tactiques', value: tactics.length || '—' },
          { label: 'Résultats', value: loading ? '…' : total.toLocaleString('fr-FR') },
          { label: 'Données', value: 'Synchronisées' },
        ]}
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
                {loading ? 'Recherche…' : <><b>{total.toLocaleString('fr-FR')}</b>résultat{total > 1 ? 's' : ''}</>}
              </span>
              <button type="button" role="switch" aria-checked={showSubs} className="mx-switch" onClick={() => setShowSubs(v => !v)}>
                <i aria-hidden="true" />Inclure les sous-techniques
              </button>
            </div>
            <div className="mx-toolbar-row" role="group" aria-label="Filtrer par plateforme">
              <span className="mx-toolbar-label" aria-hidden="true">Plateforme</span>
              {PLATFORMS_FILTER.map(p => (
                <button key={p} type="button" className="mx-chip" aria-pressed={activePlatform === p} onClick={() => handlePlatformChange(p)}>
                  <PlatformIcon name={p} />{p}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className={`mx-body${selected ? ' has-detail' : ''}`}>
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
            {loading && <Loader2 size={15} className="mx-spin" aria-hidden="true" style={{ color: 'var(--mx-cyan)' }} />}
          </div>

          <div className="mx-scroll">
            {loading && techniques.length === 0 ? (
              <SkeletonGrid />
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
            <DetailPanel technique={detailFull} loading={detailLoading} onClose={closeDetail} tactics={tactics} />
          </>
        )}
      </div>
    </div>
  )
}
