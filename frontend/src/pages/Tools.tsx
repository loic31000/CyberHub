// frontend/src/pages/Tools.tsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toolsApi } from '@/api/client'
import type { Tool, ToolCategory, ToolFilter, ToolOS } from '@/types'
import ToolCard from '@/components/ToolCard'
import { CardGridSkeleton } from '@/components/Skeleton'
import Pagination from '@/components/Pagination'
import { Search, Plus, SlidersHorizontal, X, Wrench } from 'lucide-react'
import { toast } from '@/store/toast'

const LIMIT = 18

export default function Tools() {
  const navigate = useNavigate()
  const [tools, setTools] = useState<Tool[]>([])
  const [count, setCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<ToolFilter>({ category: '', os: '', search: '', sub_category: '' })

  const loadTools = useCallback(() => {
    setLoading(true)
    toolsApi.list({ ...filters, page, limit: LIMIT } as ToolFilter & { page: number; limit: number })
      .then(r => {
        setTools(r.tools)
        setCount(Number(r.count))
        setTotalPages((r as { total_pages?: number }).total_pages ?? 1)
      })
      .catch(() => toast.error('Impossible de charger les outils'))
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

  const hasActiveFilters = Boolean(filters.category || filters.os || filters.search || filters.sub_category)

  return (
    <div className="flex flex-col h-full bg-[#06080f] text-[#f1f5f9]">

      {/* En-tête style BGP Lookup */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d40] bg-[#0a0f16]/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Wrench className="text-[#00d4ff]" size={20} />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#10b981] rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase">TOOL ARSENAL</h1>
            <p className="text-[10px] text-[#64748b] font-mono">INDEXED &amp; SEARCHABLE — {count} outil{count !== 1 ? 's' : ''} en base</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/tools/new')}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2d40] hover:bg-[#2a3f55] text-[10px] font-bold border border-[#334155] transition-colors"
          >
            <Plus size={12} /> NEW ENTRY
          </button>
        </div>
      </div>

      {/* Zone de contenu principale (identique à BGPLookup) */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Barre de recherche + filtres */}
        <div className="relative">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[260px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a6480]" />
              <input
                type="text"
                value={filters.search ?? ''}
                onChange={e => updateFilter('search', e.target.value)}
                placeholder="Rechercher un outil, tag, description…"
                className="w-full bg-[#0d131f] border border-[#1e2d40] px-9 py-2.5 font-mono text-sm text-[#f1f5f9] placeholder-[#2a3f55] outline-none transition-colors focus:border-[#00d4ff]/40"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 border px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors ${
                showFilters
                  ? 'border-[#00d4ff]/30 bg-[#00d4ff]/10 text-[#00d4ff]'
                  : 'border-[#1e2d40] bg-[#06080f] text-[#64748b] hover:border-[#2a3f55] hover:text-[#8a9ab0]'
              }`}
            >
              <SlidersHorizontal size={14} /> FILTRES
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1.5 border border-[#ef4444]/30 bg-[#ef4444]/5 px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ef4444] transition-colors hover:bg-[#ef4444]/10"
              >
                <X size={13} /> EFFACER
              </button>
            )}
          </div>

          {showFilters && (
            <div className="mt-4 flex flex-wrap gap-8 border-t border-[#1e2d40] pt-4">
              <div>
                <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.3em] text-[#4a6480]">Catégorie</p>
                <div className="flex gap-2">
                  {(['', 'offensive', 'defensive', 'osint'] as const).map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateFilter('category', c as ToolCategory | '')}
                      className={`border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                        filters.category === c
                          ? c === 'offensive' ? 'border-[#ef4444]/40 bg-[#ef4444]/10 text-[#ef4444]'
                          : c === 'defensive' ? 'border-[#10b981]/40 bg-[#10b981]/10 text-[#10b981]'
                          : 'border-[#00d4ff]/40 bg-[#00d4ff]/10 text-[#00d4ff]'
                          : 'border-[#1e2d40] text-[#4a6480] hover:border-[#2a3f55] hover:text-[#8a9ab0]'
                      }`}
                    >
                      {c === '' ? 'Tous' : c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.3em] text-[#4a6480]">OS</p>
                <div className="flex gap-2">
                  {(['', 'windows', 'linux', 'both'] as const).map(o => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => updateFilter('os', o as ToolOS | '')}
                      className={`border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                        filters.os === o
                          ? 'border-[#00d4ff]/40 bg-[#00d4ff]/10 text-[#00d4ff]'
                          : 'border-[#1e2d40] text-[#4a6480] hover:border-[#2a3f55] hover:text-[#8a9ab0]'
                      }`}
                    >
                      {o === '' ? 'Tous' : o}
                    </button>
                  ))}
                </div>
              </div>
              {categories.length > 0 && (
                <div>
                  <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.3em] text-[#4a6480]">Sous-catégorie</p>
                  <div className="flex flex-wrap gap-2">
                    {['', ...categories].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => updateFilter('sub_category', c)}
                        className={`border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                          (filters.sub_category ?? '') === c
                            ? 'border-[#a855f7]/40 bg-[#a855f7]/10 text-[#a855f7]'
                            : 'border-[#1e2d40] text-[#4a6480] hover:border-[#2a3f55] hover:text-[#8a9ab0]'
                        }`}
                      >
                        {c === '' ? 'Toutes' : c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Grille des outils */}
        {loading ? (
          <div className="border border-[#1e2d40] bg-[#0a0f16] p-6">
            <CardGridSkeleton count={6} />
          </div>
        ) : tools.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-[#1e2d40] bg-[#0a0f16] py-24 text-center">
            <Wrench size={40} className="mb-4 text-[#1e2d40]" />
            <p className="font-mono text-sm uppercase tracking-widest text-[#64748b]">Aucun outil trouvé</p>
            <p className="mt-2 font-mono text-xs text-[#334155]">
              {hasActiveFilters ? 'Modifie tes filtres ou ' : ''}
              <button type="button" onClick={() => navigate('/tools/new')} className="text-[#00d4ff] hover:underline">
                crée le premier outil
              </button>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {tools.map(tool => <ToolCard key={tool.id} tool={tool} />)}
            </div>
            <div className="border-t border-[#1e2d40] bg-[#0a0f16] p-4">
              <Pagination page={page} totalPages={totalPages} onPage={setPage} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}