import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { playbookApi } from '@/api/client'
import type { Playbook } from '@/types'
import { CardGridSkeleton } from '@/components/Skeleton'
import Pagination from '@/components/Pagination'
import { Plus, BookOpen, CheckCircle2, Circle, ChevronRight } from 'lucide-react'
import { toast } from '@/store/toast'

const LIMIT = 12

export default function PlaybookList() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [_count, setCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const fetchPlaybooks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await playbookApi.list({ page, limit: LIMIT } as { page: number; limit: number })
      setPlaybooks(res.playbooks ?? [])
      setCount(Number(res.count ?? (res.playbooks ?? []).length))
      setTotalPages((res as { total_pages?: number }).total_pages ?? 1)
    } catch {
      toast.error('Erreur de chargement des playbooks')
      setPlaybooks([])
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchPlaybooks() }, [fetchPlaybooks])

  return (
    <div className="flex flex-col h-full bg-[#06080f] text-[#f1f5f9]">
      {/* Bandeau d'en-tête style BGPLookup */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d40] bg-[#0a0f16]/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <BookOpen className="text-[#00d4ff]" size={20} />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#10b981] rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase">PLAYBOOKS // INDEX</h1>
            <p className="text-[10px] text-[#64748b] font-mono">
              Procédures de réponse à incident • {_count} playbook{_count > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/playbooks/new"
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2d40] hover:bg-[#2a3f55] text-[10px] font-bold border border-[#334155] transition-colors"
          >
            <Plus size={12} /> NEW ENTRY
          </Link>
        </div>
      </div>

      {/* Zone de contenu scrollable */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {loading ? (
          <CardGridSkeleton count={4} />
        ) : playbooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-[#1e2d40] bg-[#0a0f16] py-24 text-center">
            <BookOpen size={40} className="mb-4 text-[#1e2d40]" />
            <p className="font-mono text-sm uppercase tracking-widest text-[#64748b]">Aucun playbook</p>
            <Link to="/playbooks/new" className="mt-2 font-mono text-xs text-[#00d4ff] hover:underline">
              Créer le premier playbook
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {playbooks.map((pb) => {
                const total = pb.steps?.length ?? 0
                const done = pb.steps?.filter((s) => s.checked).length ?? 0
                const pct = total > 0 ? Math.round((done / total) * 100) : 0

                return (
                  <Link
                    key={pb.id}
                    to={`/playbooks/${pb.id}`}
                    className="group block border border-[#1e2d40] bg-[#0a0f16] p-5 hover:border-[#00d4ff]/40 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-mono text-base font-bold uppercase tracking-wide text-[#f1f5f9] group-hover:text-[#00d4ff] transition-colors">
                          {pb.title}
                        </h3>
                        {pb.scenario && (
                          <span className="inline-block mt-1 border border-[#1e2d40] bg-[#0d131f] px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[#64748b]">
                            {pb.scenario}
                          </span>
                        )}
                      </div>
                      <ChevronRight size={16} className="text-[#4a6480] group-hover:text-[#00d4ff] transition-colors mt-0.5" />
                    </div>

                    {pb.description && (
                      <p className="mt-2 font-mono text-[11px] text-[#8a9ab0] line-clamp-2">
                        {pb.description}
                      </p>
                    )}

                    {/* Barre de progression */}
                    <div className="mt-4 pt-3 border-t border-[#1e2d40]">
                      <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                        <span className="flex items-center gap-1 text-[#4a6480]">
                          {done > 0
                            ? <CheckCircle2 size={10} className="text-[#10b981]" />
                            : <Circle size={10} className="text-[#4a6480]" />
                          }
                          {done}/{total} étapes
                        </span>
                        <span className={`font-mono font-bold ${pct === 100 ? 'text-[#10b981]' : 'text-[#00d4ff]'}`}>
                          {pct}%
                        </span>
                      </div>
                      <div className="h-1 bg-[#1e2d40] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-[#10b981]' : 'bg-[#00d4ff]'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                )
              })}
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