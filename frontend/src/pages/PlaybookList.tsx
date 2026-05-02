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
    const [playbooks, setPlaybooks]   = useState<Playbook[]>([])
  const [_count, setCount]           = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage]             = useState(1)
  const [loading, setLoading]       = useState(true)

  const fetchPlaybooks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await playbookApi.list({ page, limit: LIMIT } as { page: number; limit: number })
      setPlaybooks(res.playbooks ?? [])
      setCount(Number(res.count ?? (res.playbooks ?? []).length))
      setTotalPages((res as { total_pages?: number }).total_pages ?? 1)
    } catch {
      toast.error(`Chargement…`)
      setPlaybooks([])
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchPlaybooks() }, [fetchPlaybooks])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <BookOpen size={24} className="text-cyber-cyan" />
            {`Playbooks IR`}
          </h1>
          <p className="text-text-muted text-sm mt-1">
            {`Procédures de réponse à incident`}
          </p>
        </div>
        <Link
          to="/playbooks/new"
          className="btn-cyber flex items-center gap-2 px-4 py-2 rounded text-sm font-medium"
        >
          <Plus size={16} />
          {`Nouveau playbook`}
        </Link>
      </div>

      {/* Cards */}
      {loading ? (
        <CardGridSkeleton count={4} />
      ) : playbooks.length === 0 ? (
        <div className="text-center py-20 text-text-muted">
          <BookOpen size={40} className="mx-auto mb-3 opacity-20" />
          <p>{`Aucun playbook`}</p>
          <Link to="/playbooks/new" className="text-cyber-cyan text-sm hover:underline mt-2 block">
            {`Créer le premier playbook`}
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {playbooks.map((pb) => {
              const total = pb.steps?.length ?? 0
              const done = pb.steps?.filter((s) => s.checked).length ?? 0
              const pct = total > 0 ? Math.round((done / total) * 100) : 0

              return (
                <Link
                  key={pb.id}
                  to={`/playbooks/${pb.id}`}
                  className="card hover:border-cyber-cyan/40 transition-colors group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-text-primary group-hover:text-cyber-cyan transition-colors">
                        {pb.title}
                      </h3>
                      {pb.scenario && (
                        <span className="text-xs text-text-muted bg-bg-hover px-2 py-0.5 rounded mt-1 inline-block">
                          {pb.scenario}
                        </span>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-text-muted group-hover:text-cyber-cyan transition-colors mt-0.5" />
                  </div>

                  {pb.description && (
                    <p className="text-xs text-text-muted mb-3 line-clamp-2">{pb.description}</p>
                  )}

                  {/* Progress */}
                  <div className="mt-auto">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-text-muted flex items-center gap-1">
                        {done > 0
                          ? <CheckCircle2 size={12} className="text-cyber-green" />
                          : <Circle size={12} />
                        }
                        {`${done}/${total} étapes complétées`}
                      </span>
                      <span className={`font-medium ${pct === 100 ? 'text-cyber-green' : 'text-text-muted'}`}>
                        {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-bg-hover rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-cyber-green' : 'bg-cyber-cyan'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </div>
  )
}
