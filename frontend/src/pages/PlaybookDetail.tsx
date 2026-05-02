import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { playbookApi } from '@/api/client'
import type { Playbook, PlaybookStep } from '@/types'
import { ArrowLeft, Edit, Trash2, RotateCcw, CheckCircle2, Circle } from 'lucide-react'
import ConfirmModal from '@/components/ConfirmModal'
import { toast } from '@/store/toast'

export default function PlaybookDetail() {
    const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [playbook, setPlaybook] = useState<Playbook | null>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling]       = useState<number | null>(null)
  const [resetting, setResetting]     = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [resetOpen, setResetOpen]     = useState(false)

  useEffect(() => {
    if (!id) return
    playbookApi.get(Number(id))
      .then(setPlaybook)
      .catch(() => navigate('/playbooks'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleToggle = async (step: PlaybookStep) => {
    if (!playbook || toggling !== null) return
    setToggling(step.id)
    try {
      const updated = await playbookApi.toggleStep(playbook.id, step.id)
      setPlaybook((pb) =>
        pb ? { ...pb, steps: pb.steps.map((s) => s.id === step.id ? { ...s, checked: updated.checked } : s) } : pb
      )
    } finally {
      setToggling(null)
    }
  }

  const handleReset = async () => {
    if (!playbook) return
    setResetting(true)
    try {
      await playbookApi.reset(playbook.id)
      setPlaybook((pb) =>
        pb ? { ...pb, steps: pb.steps.map((s) => ({ ...s, checked: false })) } : pb
      )
      toast.success(`Étapes remises à zéro`)
    } catch {
      toast.error(`Erreur lors du reset`)
    } finally {
      setResetting(false)
    }
  }

  const handleDelete = async () => {
    if (!playbook) return
    setDeleting(true)
    try {
      await playbookApi.delete(playbook.id)
      toast.success(`Supprimer "${playbook.title}" ? Cette action est irréversible.`)
      navigate('/playbooks')
    } catch {
      toast.error(`Supprimer`)
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 animate-pulse space-y-4">
        <div className="h-8 bg-bg-secondary rounded w-1/3" />
        <div className="h-4 bg-bg-secondary rounded w-2/3" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 bg-bg-secondary rounded" />)}
        </div>
      </div>
    )
  }

  if (!playbook) return null

  const steps = playbook.steps ?? []
  const done = steps.filter((s) => s.checked).length
  const total = steps.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="p-6 max-w-3xl space-y-6">
      {/* Nav + Actions */}
      <div className="flex items-center justify-between">
        <Link to="/playbooks" className="flex items-center gap-2 text-text-muted hover:text-text-primary text-sm transition-colors">
          <ArrowLeft size={16} />
          {`Retour aux playbooks`}
        </Link>
        <div className="flex gap-2">
          <button
            onClick={() => setResetOpen(true)}
            disabled={resetting || done === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-border text-text-secondary hover:text-yellow-400 hover:border-yellow-400/40 transition-colors disabled:opacity-40"
            title={`Remettre toutes les étapes à zéro`}
          >
            <RotateCcw size={14} />
            {`Reset`}
          </button>
          <Link
            to={`/playbooks/${playbook.id}/edit`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-border text-text-secondary hover:text-cyber-cyan hover:border-cyber-cyan/40 transition-colors"
          >
            <Edit size={14} />
            {`Modifier`}
          </Link>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-border text-text-secondary hover:text-cyber-red hover:border-cyber-red/40 transition-colors"
          >
            <Trash2 size={14} />
            {deleting ? '...' : `Supprimer`}
          </button>
        </div>
      </div>

      {/* Header card */}
      <div className="card">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-text-primary">{playbook.title}</h1>
            {playbook.scenario && (
              <span className="text-xs text-cyber-cyan bg-cyber-cyan/10 border border-cyber-cyan/20 px-2 py-0.5 rounded mt-2 inline-block">
                {playbook.scenario}
              </span>
            )}
          </div>
          <span className={`text-lg font-bold font-mono ${pct === 100 ? 'text-cyber-green' : 'text-cyber-cyan'}`}>
            {pct}%
          </span>
        </div>

        {playbook.description && (
          <p className="text-sm text-text-secondary mb-4">{playbook.description}</p>
        )}

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-text-muted">
            <span>{`${done}/${total} étapes complétées`}</span>
            {pct === 100 && <span className="text-cyber-green font-medium">✓ `Playbook terminé`</span>}
          </div>
          <div className="h-2 bg-bg-hover rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-cyber-green' : 'bg-cyber-cyan'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Steps checklist */}
      <div className="space-y-2">
        {steps.map((step) => (
          <button
            key={step.id}
            onClick={() => handleToggle(step)}
            disabled={toggling === step.id}
            className={`w-full flex items-start gap-3 p-4 rounded border text-left transition-all ${
              step.checked
                ? 'bg-cyber-green/5 border-cyber-green/30 opacity-70'
                : 'bg-bg-secondary border-border hover:border-cyber-cyan/30 hover:bg-bg-hover'
            } ${toggling === step.id ? 'opacity-50' : ''}`}
          >
            <span className="mt-0.5 flex-shrink-0">
              {step.checked
                ? <CheckCircle2 size={18} className="text-cyber-green" />
                : <Circle size={18} className="text-text-muted" />
              }
            </span>
            <span className={`text-sm leading-relaxed ${step.checked ? 'line-through text-text-muted' : 'text-text-secondary'}`}>
              {step.content}
            </span>
            <span className="ml-auto flex-shrink-0 text-xs text-text-muted font-mono">{step.order}</span>
          </button>
        ))}
      </div>

      <ConfirmModal
        open={resetOpen}
        title={`Reset`}
        message={`Remettre toutes les étapes à zéro ? La progression sera perdue.`}
        confirmLabel={`Reset`}
        onConfirm={() => { setResetOpen(false); handleReset() }}
        onCancel={() => setResetOpen(false)}
      />
      <ConfirmModal
        open={confirmOpen}
        title={`Supprimer`}
        message={`${`Supprimer "${playbook.title}" ? Cette action est irréversible.`} ${`Cette action est irréversible.`}`}
        confirmLabel={`Supprimer`}
        danger
        onConfirm={() => { setConfirmOpen(false); handleDelete() }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
