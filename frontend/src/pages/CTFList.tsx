import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ctfApi } from '@/api/client'
import type { CTFWriteup, CTFFilter, CTFPlatform, CTFDifficulty } from '@/types'
import { CardGridSkeleton } from '@/components/Skeleton'
import Pagination from '@/components/Pagination'
import { Plus, Search, CheckCircle2, Circle, Trophy } from 'lucide-react'
import { toast } from '@/store/toast'

const PLATFORMS: CTFPlatform[] = ['TryHackMe', 'HackTheBox', 'Root-Me', 'PicoCTF', 'Autre']
const DIFFICULTIES: CTFDifficulty[] = ['easy', 'medium', 'hard', 'insane']
const LIMIT = 15

const DIFF_COLORS: Record<CTFDifficulty, string> = {
  easy:   'border-[#10b981]/30 bg-[#10b981]/10 text-[#10b981]',
  medium: 'border-[#eab308]/30 bg-[#eab308]/10 text-[#eab308]',
  hard:   'border-[#f97316]/30 bg-[#f97316]/10 text-[#f97316]',
  insane: 'border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444]',
}

const PLATFORM_COLORS: Record<CTFPlatform, string> = {
  TryHackMe:  'border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444]',
  HackTheBox: 'border-[#10b981]/30 bg-[#10b981]/10 text-[#10b981]',
  'Root-Me':  'border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[#3b82f6]',
  PicoCTF:    'border-[#a855f7]/30 bg-[#a855f7]/10 text-[#a855f7]',
  Autre:      'border-[#64748b]/30 bg-[#64748b]/10 text-[#64748b]',
}

export default function CTFList() {
  const [writeups, setWriteups] = useState<CTFWriteup[]>([])
  const [count, setCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<CTFFilter>({ platform: '', difficulty: '', search: '' })

  const fetchCTF = useCallback(async () => {
    setLoading(true)
    try {
      const res = await ctfApi.list({ ...filters, page, limit: LIMIT } as CTFFilter & { page: number; limit: number })
      setWriteups(res.writeups ?? [])
      setCount(Number(res.count))
      setTotalPages((res as { total_pages?: number }).total_pages ?? 1)
    } catch {
      toast.error(`Aucun writeup trouvé`)
      setWriteups([])
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  useEffect(() => { fetchCTF() }, [fetchCTF])

  const updateFilter = <K extends keyof CTFFilter>(k: K, v: CTFFilter[K]) => {
    setPage(1)
    setFilters(f => ({ ...f, [k]: v }))
  }

  const completed = writeups.filter(w => w.completed).length

  return (
    <div className="flex flex-col h-full bg-[#06080f] text-[#f1f5f9]">
      {/* Bandeau d'en-tête style BGPLookup */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d40] bg-[#0a0f16]/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Trophy className="text-[#00d4ff]" size={20} />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#10b981] rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase">CTF WRITEUPS // INDEX</h1>
            <p className="text-[10px] text-[#64748b] font-mono">
              {count} writeup{count > 1 ? 's' : ''} • {completed} terminé{completed > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/ctf/new"
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2d40] hover:bg-[#2a3f55] text-[10px] font-bold border border-[#334155] transition-colors"
          >
            <Plus size={12} /> NEW ENTRY
          </Link>
        </div>
      </div>

      {/* Zone de contenu scrollable */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Filtres */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a6480]" />
            <input
              type="text"
              placeholder="Rechercher un writeup..."
              className="w-full bg-[#0d131f] border border-[#1e2d40] pl-9 pr-4 py-2.5 font-mono text-sm text-[#f1f5f9] placeholder-[#2a3f55] outline-none focus:border-[#00d4ff]/40"
              value={filters.search ?? ''}
              onChange={(e) => updateFilter('search', e.target.value)}
            />
          </div>
          <select
            className="bg-[#0d131f] border border-[#1e2d40] px-3 py-2.5 font-mono text-sm text-[#f1f5f9] focus:border-[#00d4ff]/40 outline-none"
            value={filters.platform ?? ''}
            onChange={(e) => updateFilter('platform', e.target.value as CTFPlatform | '')}
          >
            <option value="">Toutes les plateformes</option>
            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            className="bg-[#0d131f] border border-[#1e2d40] px-3 py-2.5 font-mono text-sm text-[#f1f5f9] focus:border-[#00d4ff]/40 outline-none"
            value={filters.difficulty ?? ''}
            onChange={(e) => updateFilter('difficulty', e.target.value as CTFDifficulty | '')}
          >
            <option value="">Toutes les difficultés</option>
            {DIFFICULTIES.map(d => <option key={d} value={d} className="capitalize">{d}</option>)}
          </select>
        </div>

        {/* Grille des writeups */}
        {loading ? (
          <CardGridSkeleton count={6} />
        ) : writeups.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-[#1e2d40] bg-[#0a0f16] py-24 text-center">
            <Trophy size={40} className="mb-4 text-[#1e2d40]" />
            <p className="font-mono text-sm uppercase tracking-widest text-[#64748b]">Aucun writeup trouvé</p>
            <Link to="/ctf/new" className="mt-2 font-mono text-xs text-[#00d4ff] hover:underline">
              Créer le premier writeup
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {writeups.map(w => (
                <Link
                  key={w.id}
                  to={`/ctf/${w.id}`}
                  className="group block border border-[#1e2d40] bg-[#0a0f16] p-5 hover:border-[#00d4ff]/40 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${PLATFORM_COLORS[w.platform]}`}>
                      {w.platform}
                    </span>
                    {w.completed
                      ? <CheckCircle2 size={16} className="text-[#10b981]" />
                      : <Circle size={16} className="text-[#4a6480]" />}
                  </div>
                  <h3 className="font-mono text-base font-bold uppercase tracking-wide text-[#f1f5f9] group-hover:text-[#00d4ff] transition-colors mb-1">
                    {w.title}
                  </h3>
                  {w.machine_name && (
                    <p className="text-[11px] font-mono text-[#64748b] mb-2">📦 {w.machine_name}</p>
                  )}
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#1e2d40]">
                    <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${DIFF_COLORS[w.difficulty]}`}>
                      {w.difficulty}
                    </span>
                    {w.category && (
                      <span className="text-[10px] font-mono text-[#4a6480]">{w.category}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
            <div className="border-t border-[#1e2d40] bg-[#0a0f16] p-4">
              <Pagination page={page} totalPages={totalPages} onPage={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}