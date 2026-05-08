import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { playbookApi } from '@/api/client'
import type { PlaybookCreateRequest } from '@/types'
import { Save, ArrowLeft, Plus, Trash2, GripVertical, BookOpen } from 'lucide-react'

interface StepDraft {
  content: string
  order: number
}

export default function PlaybookForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [title, setTitle] = useState('')
  const [scenario, setScenario] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState<StepDraft[]>([{ content: '', order: 1 }])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isEdit || !id) return
    playbookApi.get(Number(id))
      .then((pb) => {
        setTitle(pb.title)
        setScenario(pb.scenario)
        setDescription(pb.description)
        setSteps(
          (pb.steps ?? []).map((s) => ({ content: s.content, order: s.order }))
        )
      })
      .catch(() => navigate('/playbooks'))
      .finally(() => setLoading(false))
  }, [id, isEdit, navigate])

  const addStep = () =>
    setSteps((s) => [...s, { content: '', order: s.length + 1 }])

  const removeStep = (i: number) =>
    setSteps((s) => s.filter((_, idx) => idx !== i).map((st, idx) => ({ ...st, order: idx + 1 })))

  const updateStep = (i: number, content: string) =>
    setSteps((s) => s.map((st, idx) => idx === i ? { ...st, content } : st))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError('Le titre est requis'); return }
    if (steps.every((s) => !s.content.trim())) { setError('Au moins une étape est requise'); return }

    setSaving(true)
    setError('')

    const payload: PlaybookCreateRequest = {
      title: title.trim(),
      scenario: scenario.trim(),
      description: description.trim(),
      steps: steps
        .filter((s) => s.content.trim())
        .map((s, i) => ({ content: s.content.trim(), order: i + 1 })),
    }

    try {
      if (isEdit && id) {
        await playbookApi.update(Number(id), payload)
        navigate(`/playbooks/${id}`)
      } else {
        const created = await playbookApi.create(payload)
        navigate(`/playbooks/${created.id}`)
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e?.response?.data?.error ?? 'Erreur lors de l’enregistrement')
      setSaving(false)
    }
  }

  if (loading) return <div className="flex h-full items-center justify-center bg-[#06080f]"><p className="font-mono text-xs text-[#64748b]">CHARGEMENT...</p></div>

  const fieldClass = 'w-full border border-[#1e2d40] bg-[#0d131f] px-4 py-2.5 font-mono text-sm text-[#f1f5f9] placeholder-[#334155] outline-none transition-colors focus:border-[#00d4ff]/50'
  const labelClass = 'mb-2 block font-mono text-[10px] font-bold uppercase tracking-widest text-[#8a9ab0]'

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
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase">PLAYBOOKS // FORM</h1>
            <p className="text-[10px] text-[#64748b] font-mono">
              {isEdit ? 'MODIFICATION DE PLAYBOOK' : 'NOUVEAU PLAYBOOK'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/playbooks')}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2d40] hover:bg-[#2a3f55] text-[10px] font-bold border border-[#334155] transition-colors"
          >
            <ArrowLeft size={12} /> BACK TO INDEX
          </button>
        </div>
      </div>

      {/* Zone de contenu scrollable */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto w-full space-y-8">
          {error && (
            <div className="border-l-2 border-[#ef4444] bg-[#ef4444]/5 p-4 font-mono text-[11px] text-[#ef4444]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Informations principales */}
            <div className="space-y-6 border border-[#1e2d40] bg-[#0a0f16] p-6">
              <h2 className="border-b border-[#1e2d40] pb-3 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#00d4ff]">
                INFORMATIONS GÉNÉRALES
              </h2>

              <div>
                <label className={labelClass}>TITRE *</label>
                <input
                  type="text"
                  className={fieldClass}
                  placeholder="EX: RÉPONSE RANSOMWARE"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className={labelClass}>SCÉNARIO (SLUG)</label>
                  <input
                    type="text"
                    className={fieldClass}
                    placeholder="EX: ransomware, phishing..."
                    value={scenario}
                    onChange={(e) => setScenario(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  />
                </div>
                <div>
                  <label className={labelClass}>DESCRIPTION COURTE</label>
                  <input
                    type="text"
                    className={fieldClass}
                    placeholder="Résumé du scénario..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Étapes */}
            <div className="space-y-5 border border-[#1e2d40] bg-[#0a0f16] p-6">
              <div className="flex items-center justify-between border-b border-[#1e2d40] pb-3">
                <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a9ab0]">
                  ÉTAPES DE LA CHECKLIST
                </h2>
                <button
                  type="button"
                  onClick={addStep}
                  className="flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-widest text-[#00d4ff] hover:text-[#00d4ff]/80 transition-colors"
                >
                  <Plus size={14} /> AJOUTER
                </button>
              </div>

              <div className="space-y-3">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-[#4a6480] flex-shrink-0">
                      <GripVertical size={15} />
                    </span>
                    <span className="text-[10px] font-mono text-[#4a6480] w-6 text-right flex-shrink-0">{i + 1}</span>
                    <input
                      type="text"
                      className="flex-1 border border-[#1e2d40] bg-[#0d131f] px-3 py-2 font-mono text-sm text-[#f1f5f9] placeholder-[#334155] outline-none focus:border-[#00d4ff]/50"
                      placeholder={`Étape ${i + 1}...`}
                      value={step.content}
                      onChange={(e) => updateStep(i, e.target.value)}
                    />
                    {steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStep(i)}
                        className="text-[#4a6480] hover:text-[#ef4444] transition-colors flex-shrink-0"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions du formulaire */}
            <div className="flex justify-end gap-4 pt-4 pb-8 border-t border-[#1e2d40]">
              <button
                type="button"
                onClick={() => navigate('/playbooks')}
                disabled={saving}
                className="border border-[#1e2d40] bg-[#0a0f16] px-6 py-3 font-mono text-xs uppercase tracking-widest text-[#8a9ab0] transition-colors hover:bg-[#1e2d40] hover:text-[#f1f5f9]"
              >
                ANNULER
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 border border-[#00d4ff]/20 bg-[#00d4ff]/10 px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest text-[#00d4ff] transition-colors hover:bg-[#00d4ff]/20 disabled:opacity-50"
              >
                <Save size={15} />
                {saving ? 'SAUVEGARDE...' : (isEdit ? 'METTRE À JOUR' : 'CRÉER LE PLAYBOOK')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}