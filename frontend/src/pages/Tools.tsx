import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toolsApi } from '@/api/client'
import type { Tool, ToolCategory, ToolFilter, ToolOS } from '@/types'
import ToolCard from '@/components/ToolCard'
import { CardGridSkeleton } from '@/components/Skeleton'
import Pagination from '@/components/Pagination'
import { Search, Plus, SlidersHorizontal, X } from 'lucide-react'
import { toast } from '@/store/toast'

const LIMIT = 18

export default function Tools() {
  const navigate = useNavigate()
    const [tools, setTools]       = useState<Tool[]>([])
  const [count, setCount]       = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage]         = useState(1)
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading]   = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters]   = useState<ToolFilter>({ category: '', os: '', search: '', sub_category: '' })

  const loadTools = useCallback(() => {
    setLoading(true)
    toolsApi.list({ ...filters, page, limit: LIMIT } as ToolFilter & { page: number; limit: number })
      .then(r => {
        setTools(r.tools)
        setCount(Number(r.count))
        setTotalPages((r as { total_pages?: number }).total_pages ?? 1)
      })
      .catch(() => toast.error(`Impossible de charger les outils`))
      .finally(() => setLoading(false))
  }, [filters, page])

  useEffect(() => { loadTools() }, [loadTools])
  useEffect(() => { toolsApi.getCategories().then(setCategories).catch(() => {}) }, [])

  const updateFilter = <K extends keyof ToolFilter>(key: K, value: ToolFilter[K]) => {
    setPage(1)
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setPage(1)
    setFilters({ category: '', os: '', search: '', sub_category: '' })
  }
  const hasActiveFilters = filters.category || filters.os || filters.search || filters.sub_category

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            <span className="text-cyber-cyan">&gt;</span> {`Outils`}
          </h1>
          <p className="text-text-muted text-sm mt-1">{count} outil{count > 1 ? 's' : ''} indexé{count > 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => navigate('/tools/new')} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> {`Nouvel outil`}
        </button>
      </div>

      {/* Barre de recherche + filtres */}
      <div className="mb-6 space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={filters.search ?? ''}
              onChange={e => updateFilter('search', e.target.value)}
              placeholder={`Rechercher un outil, tag, description…`}
              className="input pl-9"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary flex items-center gap-2 ${showFilters ? 'border-cyber-cyan text-cyber-cyan' : ''}`}
          >
            <SlidersHorizontal size={16} /> {`Filtres`}
          </button>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="btn-secondary flex items-center gap-1 text-cyber-red border-cyber-red/40">
              <X size={14} /> {`Effacer`}
            </button>
          )}
        </div>

        {showFilters && (
          <div className="card flex flex-wrap gap-6">
            <div>
              <label className="text-text-muted text-xs block mb-2">{`Catégorie`}</label>
              <div className="flex gap-2">
                {(['', 'offensive', 'defensive'] as const).map(c => (
                  <button key={c} onClick={() => updateFilter('category', c as ToolCategory | '')}
                    className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                      filters.category === c
                        ? c === 'offensive' ? 'bg-cyber-red/20 border-cyber-red text-cyber-red'
                        : c === 'defensive' ? 'bg-cyber-green/20 border-cyber-green text-cyber-green'
                        : 'bg-cyber-cyan/20 border-cyber-cyan text-cyber-cyan'
                        : 'border-border text-text-secondary hover:border-border-bright'}`}>
                    {c === '' ? `Tous` : c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-text-muted text-xs block mb-2">{`OS`}</label>
              <div className="flex gap-2">
                {(['', 'windows', 'linux', 'both'] as const).map(o => (
                  <button key={o} onClick={() => updateFilter('os', o as ToolOS | '')}
                    className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                      filters.os === o ? 'bg-cyber-cyan/20 border-cyber-cyan text-cyber-cyan' : 'border-border text-text-secondary hover:border-border-bright'}`}>
                    {o === '' ? `Tous` : o}
                  </button>
                ))}
              </div>
            </div>
            {categories.length > 0 && (
              <div>
                <label className="text-text-muted text-xs block mb-2">{`Sous-catégorie`}</label>
                <div className="flex gap-2 flex-wrap">
                  {['', ...categories].map(c => (
                    <button key={c} onClick={() => updateFilter('sub_category', c)}
                      className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                        (filters.sub_category ?? '') === c
                          ? 'bg-cyber-purple/20 border-cyber-purple text-cyber-purple'
                          : 'border-border text-text-secondary hover:border-border-bright'}`}>
                      {c === '' ? `Toutes` : c}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contenu */}
      {loading ? (
        <CardGridSkeleton count={6} />
      ) : tools.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-text-muted text-lg">{`Aucun outil trouvé`}</p>
          <p className="text-text-muted text-sm mt-2">
            {hasActiveFilters ? `${`Modifie tes filtres ou`} ` : ''}
            <button onClick={() => navigate('/tools/new')} className="text-cyber-cyan hover:underline">
              {`crée le premier outil`}
            </button>
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {tools.map(tool => <ToolCard key={tool.id} tool={tool} />)}
          </div>
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </div>
  )
}
