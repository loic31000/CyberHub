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
  easy:   'text-cyber-green border-cyber-green/40',
  medium: 'text-yellow-400 border-yellow-400/40',
  hard:   'text-orange-400 border-orange-400/40',
  insane: 'text-cyber-red  border-cyber-red/40',
}

const PLATFORM_COLORS: Record<CTFPlatform, string> = {
  TryHackMe:  'bg-red-500/20 text-red-400',
  HackTheBox: 'bg-green-500/20 text-green-400',
  'Root-Me':  'bg-blue-500/20 text-blue-400',
  PicoCTF:    'bg-purple-500/20 text-purple-400',
  Autre:      'bg-gray-500/20 text-gray-400',
}

export default function CTFList() {
  const [writeups, setWriteups]     = useState<CTFWriteup[]>([])
  const [count, setCount]           = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage]             = useState(1)
  const [loading, setLoading]       = useState(true)
  const [filters, setFilters]       = useState<CTFFilter>({ platform: '', difficulty: '', search: '' })

  const fetchCTF = useCallback(async () => {
    setLoading(true)
    try {
      const res = await ctfApi.list({ ...filters, page, limit: LIMIT } as CTFFilter & { page: number; limit: number })
      setWriteups(res.writeups ?? [])
      setCount(Number(res.count))
      setTotalPages((res as { total_pages?: number }).total_pages ?? 1)
    } catch {
      toast.error('Impossible de charger les writeups')
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

  const completed = writeups.filter((w) => w.completed).length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Trophy size={24} className="text-yellow-400" />
            Writeups CTF
          </h1>
          <p className="text-text-muted text-sm mt-1">
            {count} writeup{count > 1 ? 's' : ''} —{' '}
            <span className="text-cyber-green">{completed} complétés (page en cours)</span>
          </p>
        </div>
        <Link to="/ctf/new" className="btn-primary flex items-center gap-2 px-4 py-2 rounded text-sm font-medium">
          <Plus size={16} /> Nouveau writeup
        </Link>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Rechercher..."
            className="input w-full pl-9 pr-4 py-2 text-sm"
            value={filters.search ?? ''}
            onChange={(e) => updateFilter('search', e.target.value)}
          />
        </div>
        <select
          className="input px-3 py-2 text-sm"
          value={filters.platform ?? ''}
          onChange={(e) => updateFilter('platform', e.target.value as CTFPlatform | '')}
        >
          <option value="">Toutes les plateformes</option>
          {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          className="input px-3 py-2 text-sm"
          value={filters.difficulty ?? ''}
          onChange={(e) => updateFilter('difficulty', e.target.value as CTFDifficulty | '')}
        >
          <option value="">Toutes les difficultés</option>
          {DIFFICULTIES.map((d) => <option key={d} value={d} className="capitalize">{d}</option>)}
        </select>
      </div>

      {/* Contenu */}
      {loading ? (
        <CardGridSkeleton count={6} />
      ) : writeups.length === 0 ? (
        <div className="text-center py-20 text-text-muted">
          <Trophy size={40} className="mx-auto mb-3 opacity-20" />
          <p>Aucun writeup trouvé</p>
          <Link to="/ctf/new" className="text-cyber-cyan text-sm hover:underline mt-2 block">
            Créer le premier writeup
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {writeups.map((w) => (
              <Link key={w.id} to={`/ctf/${w.id}`} className="card hover:border-cyber-cyan/40 transition-colors group">
                <div className="flex items-start justify-between mb-3">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${PLATFORM_COLORS[w.platform]}`}>
                    {w.platform}
                  </span>
                  {w.completed
                    ? <CheckCircle2 size={16} className="text-cyber-green" />
                    : <Circle size={16} className="text-text-muted" />}
                </div>
                <h3 className="font-semibold text-text-primary group-hover:text-cyber-cyan transition-colors mb-1">
                  {w.title}
                </h3>
                {w.machine_name && <p className="text-xs text-text-muted mb-2">📦 {w.machine_name}</p>}
                <div className="flex items-center justify-between mt-auto pt-2">
                  <span className={`text-xs border px-2 py-0.5 rounded capitalize ${DIFF_COLORS[w.difficulty]}`}>
                    {w.difficulty}
                  </span>
                  {w.category && <span className="text-xs text-text-muted">{w.category}</span>}
                </div>
              </Link>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </div>
  )
}
