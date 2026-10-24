// frontend/src/pages/Tools.tsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { toolsApi } from '@/api/client'
import type { Tool, ToolCategory, ToolFilter, ToolOS } from '@/types'
import ToolCard from '@/components/ToolCard'
import Pagination from '@/components/Pagination'
import { AlertTriangle, Plus, Search, SlidersHorizontal, Wrench, X } from 'lucide-react'
import { toast } from '@/store/toast'
import ToolsHero from '@/tools26/ToolsHero'
import { CATEGORY_LABEL, OS_LABEL } from '@/tools26/parts'
import '@/tools26/tools.css'

const LIMIT = 18
const CATEGORIES: ToolCategory[] = ['offensive', 'defensive', 'osint']
const SYSTEMS: ToolOS[] = ['windows', 'linux', 'both']

export default function Tools() {
  const [tools, setTools] = useState<Tool[]>([])
  const [count, setCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<ToolFilter>({ category: '', os: '', search: '', sub_category: '' })
  const requestId = useRef(0)

  const loadTools = useCallback(() => {
    const currentRequest = ++requestId.current
    setLoading(true)
    setListError(false)
    toolsApi.list({ ...filters, page, limit: LIMIT })
      .then(r => {
        if (currentRequest !== requestId.current) return
        setTools(r.tools)
        setCount(Number(r.count))
        setTotalPages(r.total_pages ?? 1)
      })
      .catch(() => {
        if (currentRequest !== requestId.current) return
        setListError(true)
        toast.error('Impossible de charger les outils')
      })
      .finally(() => {
        if (currentRequest === requestId.current) setLoading(false)
      })
  }, [filters, page])

  useEffect(() => {
    loadTools()
    return () => { requestId.current++ }
  }, [loadTools])
  useEffect(() => { toolsApi.getCategories().then(setCategories).catch(() => {}) }, [])

  const updateFilter = <K extends keyof ToolFilter>(key: K, value: ToolFilter[K]) => {
    setPage(1)
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setPage(1)
    setFilters({ category: '', os: '', search: '', sub_category: '' })
  }

  const hasActiveFilters = Boolean(filters.category || filters.os || filters.search || filters.sub_category)
  const activeChips = [
    filters.category && { key: 'category' as const, label: `Catégorie : ${CATEGORY_LABEL[filters.category]}` },
    filters.os && { key: 'os' as const, label: `OS : ${OS_LABEL[filters.os]}` },
    filters.sub_category && { key: 'sub_category' as const, label: `Sous-catégorie : ${filters.sub_category}` },
  ].filter(Boolean) as { key: 'category' | 'os' | 'sub_category'; label: string }[]

  const status = loading ? { text: 'CHARGEMENT', tone: 'busy' as const }
    : listError ? { text: 'INDEX INDISPONIBLE', tone: 'warn' as const }
    : { text: `${count.toLocaleString('fr-FR')} OUTIL${count > 1 ? 'S' : ''}`, mark: hasActiveFilters ? 'FILTRÉS' : 'EN BASE' }

  return (
    <div className="tl26">
      <div className="tl26-frame">
        <ToolsHero status={status} />

        <section className="tl26-console" aria-label="Recherche et filtres">
          <div className="tl26-console-top">
            <label className="tl26-search">
              <Search size={18} aria-hidden="true" />
              <span className="tl26-sr">Rechercher un outil</span>
              <input
                type="search"
                value={filters.search ?? ''}
                onChange={e => updateFilter('search', e.target.value)}
                placeholder="Rechercher un outil, tag, description…"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <div className="tl26-actions">
              <button
                type="button"
                className={`tl26-btn${showFilters ? ' is-on' : ''}`}
                aria-expanded={showFilters}
                aria-controls={showFilters ? 'tl26-filter-panel' : undefined}
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal size={15} aria-hidden="true" /> Filtres
                {activeChips.length > 0 && <span className="tl26-count" aria-label={`${activeChips.length} actif${activeChips.length > 1 ? 's' : ''}`}>{activeChips.length}</span>}
              </button>
              <Link to="/tools/new" className="tl26-btn is-primary">
                <Plus size={15} aria-hidden="true" /> Nouvel outil
              </Link>
            </div>
          </div>

          {showFilters && (
            <div id="tl26-filter-panel" className="tl26-filter-panel">
              <div className="tl26-filter-group" role="group" aria-labelledby="tl26-f-cat">
                <span id="tl26-f-cat" className="tl26-filter-label">Catégorie</span>
                <div className="tl26-segment">
                  {(['', ...CATEGORIES] as const).map(c => (
                    <button key={c} type="button" data-cat={c || undefined} aria-pressed={filters.category === c}
                      onClick={() => updateFilter('category', c)}>
                      {c && <i aria-hidden="true" />}{c ? CATEGORY_LABEL[c] : 'Toutes'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="tl26-filter-group" role="group" aria-labelledby="tl26-f-os">
                <span id="tl26-f-os" className="tl26-filter-label">OS</span>
                <div className="tl26-segment">
                  {(['', ...SYSTEMS] as const).map(o => (
                    <button key={o} type="button" aria-pressed={filters.os === o} onClick={() => updateFilter('os', o)}>
                      {o ? OS_LABEL[o] : 'Tous'}
                    </button>
                  ))}
                </div>
              </div>
              {categories.length > 0 && (
                <label className="tl26-filter-group">
                  <span className="tl26-filter-label">Sous-catégorie</span>
                  <select value={filters.sub_category ?? ''} onChange={e => updateFilter('sub_category', e.target.value)}>
                    <option value="">Toutes</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              )}
            </div>
          )}

          {hasActiveFilters && (
            <div className="tl26-active">
              {activeChips.length > 0 && (
                <ul aria-label="Filtres actifs">
                  {activeChips.map(chip => (
                    <li key={chip.key}>
                      <button type="button" onClick={() => updateFilter(chip.key, '')} aria-label={`Retirer le filtre ${chip.label}`}>
                        {chip.label}<X size={12} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="tl26-link" onClick={clearFilters}>
                <X size={13} aria-hidden="true" /> Tout effacer
              </button>
            </div>
          )}
        </section>

        {loading ? (
          <div className="tl26-register" aria-busy="true">
            <p className="tl26-sr" role="status">Chargement des outils…</p>
            <div className="tl26-skeleton" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <div key={i} />)}</div>
          </div>
        ) : listError ? (
          <div className="tl26-state is-error" role="alert">
            <AlertTriangle size={30} aria-hidden="true" />
            <h2>Impossible de charger les outils</h2>
            <p>L'index de l'arsenal n'a pas répondu. Les filtres sont conservés.</p>
            <button type="button" className="tl26-btn" onClick={loadTools}>Réessayer</button>
          </div>
        ) : tools.length === 0 ? (
          <div className="tl26-state">
            <Wrench size={30} aria-hidden="true" />
            <h2>Aucun outil trouvé</h2>
            <p>
              {hasActiveFilters ? 'Modifie tes filtres ou ' : ''}
              <Link to="/tools/new" className="tl26-link">crée le premier outil</Link>
            </p>
          </div>
        ) : (
          <section className="tl26-register" aria-labelledby="tl26-register-title">
            <header className="tl26-register-head">
              <h2 id="tl26-register-title">Registre</h2>
              <p><b>{count.toLocaleString('fr-FR')}</b> outil{count > 1 ? 's' : ''}{totalPages > 1 && <> · page {page} / {totalPages}</>}</p>
            </header>
            <ul className="tl26-entries">
              {tools.map(tool => <ToolCard key={tool.id} tool={tool} />)}
            </ul>
            {totalPages > 1 && (
              <nav className="tl26-register-foot" aria-label="Pagination">
                <Pagination page={page} totalPages={totalPages} onPage={setPage} />
              </nav>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
