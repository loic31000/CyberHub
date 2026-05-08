import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { playbookApi } from '@/api/client'
import type { Playbook, PlaybookStep } from '@/types'
import { ArrowLeft, Edit, Trash2, RotateCcw, CheckCircle2, Circle, BookOpen } from 'lucide-react'
import ConfirmModal from '@/components/ConfirmModal'
import { toast } from '@/store/toast'

export default function PlaybookDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [playbook, setPlaybook] = useState<Playbook | null>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<number | null>(null)
  const [resetting, setResetting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)

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
      toast.success('Étapes remises à zéro')
    } catch {
      toast.error('Erreur lors du reset')
    } finally {
      setResetting(false)
    }
  }

  const handleDelete = async () => {
    if (!playbook) return
    setDeleting(true)
    try {
      await playbookApi.delete(playbook.id)
      toast.success(`Playbook "${playbook.title}" supprimé`)
      navigate('/playbooks')
    } catch {
      toast.error('Erreur lors de la suppression')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#06080f]">
        <p className="font-mono text-xs text-[#64748b]">CHARGEMENT...</p>
      </div>
    )
  }

  if (!playbook) return null

  const steps = playbook.steps ?? []
  const done = steps.filter((s) => s.checked).length
  const total = steps.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

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
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase">PLAYBOOKS // DETAIL</h1>
            <p className="text-[10px] text-[#64748b] font-mono">
              {playbook.title} • {playbook.scenario || 'incident response'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/playbooks"
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2d40] hover:bg-[#2a3f55] text-[10px] font-bold border border-[#334155] transition-colors"
          >
            <ArrowLeft size={12} /> BACK TO INDEX
          </Link>
        </div>
      </div>

      {/* Zone de contenu scrollable */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Carte principale */}
        <div className="border border-[#1e2d40] bg-[#0a0f16] p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-mono font-bold uppercase tracking-[0.15em] text-[#f1f5f9]">
                {playbook.title}
              </h1>
              {playbook.scenario && (
                <span className="inline-block mt-2 border border-[#1e2d40] bg-[#0d131f] px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[#64748b]">
                  {playbook.scenario}
                </span>
              )}
            </div>
            <span className={`text-lg font-mono font-bold ${pct === 100 ? 'text-[#10b981]' : 'text-[#00d4ff]'}`}>
              {pct}%
            </span>
          </div>

          {playbook.description && (
            <p className="font-mono text-[13px] leading-relaxed text-[#cbd5e1]">
              {playbook.description}
            </p>
          )}

          {/* Barre de progression */}
          <div>
            <div className="flex justify-between text-[10px] font-mono text-[#64748b] mb-1">
              <span>{done}/{total} étapes complétées</span>
              {pct === 100 && <span className="text-[#10b981]">✓ TERMINÉ</span>}
            </div>
            <div className="h-1.5 bg-[#1e2d40] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-[#10b981]' : 'bg-[#00d4ff]'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex flex-wrap gap-3 pt-2 border-t border-[#1e2d40]">
            <button
              onClick={() => setResetOpen(true)}
              disabled={resetting || done === 0}
              className="flex items-center gap-2 border border-[#eab308]/20 bg-[#eab308]/10 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#eab308] transition-colors hover:bg-[#eab308]/20 disabled:opacity-40"
            >
              <RotateCcw size={13} /> RESET
            </button>
            <Link
              to={`/playbooks/${playbook.id}/edit`}
              className="flex items-center gap-2 border border-[#00d4ff]/20 bg-[#00d4ff]/10 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#00d4ff] transition-colors hover:bg-[#00d4ff]/20"
            >
              <Edit size={13} /> MODIFIER
            </Link>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={deleting}
              className="flex items-center gap-2 border border-[#ef4444]/20 bg-[#ef4444]/10 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ef4444] transition-colors hover:bg-[#ef4444]/20 disabled:opacity-50"
            >
              <Trash2 size={13} /> {deleting ? '...' : 'SUPPRIMER'}
            </button>
          </div>
        </div>

        {/* Checklist des étapes */}
        <div className="space-y-2">
          {steps.map((step) => (
            <button
              key={step.id}
              onClick={() => handleToggle(step)}
              disabled={toggling === step.id}
              className={`w-full flex items-start gap-3 p-4 border text-left transition-all ${
                step.checked
                  ? 'border-[#10b981]/30 bg-[#10b981]/5 opacity-80'
                  : 'border-[#1e2d40] bg-[#0a0f16] hover:border-[#00d4ff]/30 hover:bg-[#0a0f16]/80'
              } ${toggling === step.id ? 'opacity-50' : ''}`}
            >
              <span className="mt-0.5 flex-shrink-0">
                {step.checked
                  ? <CheckCircle2 size={18} className="text-[#10b981]" />
                  : <Circle size={18} className="text-[#4a6480]" />}
              </span>
              <span className={`font-mono text-sm leading-relaxed ${step.checked ? 'line-through text-[#64748b]' : 'text-[#cbd5e1]'}`}>
                {step.content}
              </span>
              <span className="ml-auto flex-shrink-0 text-[10px] font-mono text-[#4a6480]">{step.order}</span>
            </button>
          ))}
        </div>
      </div>

      <ConfirmModal
        open={resetOpen}
        title="RÉINITIALISER LE PLAYBOOK ?"
        message="Toutes les étapes cochées seront remises à zéro. La progression actuelle sera perdue."
        confirmLabel="RESET"
        onConfirm={() => { setResetOpen(false); handleReset() }}
        onCancel={() => setResetOpen(false)}
      />
      <ConfirmModal
        open={confirmOpen}
        title="SUPPRIMER CE PLAYBOOK ?"
        message={`"${playbook.title}" — CETTE ACTION EST IRRÉVERSIBLE.`}
        confirmLabel="SUPPRIMER"
        danger
        onConfirm={() => { setConfirmOpen(false); handleDelete() }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}