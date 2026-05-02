import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { playbookApi } from '@/api/client'
import type { PlaybookCreateRequest } from '@/types'
import { Save, ArrowLeft, Plus, Trash2, GripVertical } from 'lucide-react'

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
    if (!title.trim()) { setError(`Le titre est requis`); return }
    if (steps.every((s) => !s.content.trim())) { setError(`Au moins une étape est requise`); return }

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
      setError(e?.response?.data?.error ?? `Enregistrer`)
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-text-muted">{`Chargement…`}</div>

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/playbooks')} className="text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-text-primary">
          {isEdit ? `Modifier le playbook` : `Nouveau playbook`}
        </h1>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded bg-cyber-red/10 border border-cyber-red/30 text-cyber-red text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div>
          <label className="block text-sm text-text-secondary mb-1">{`Titre *`}</label>
          <input
            type="text"
            className="input-cyber w-full px-3 py-2 text-sm"
            placeholder={`Ex: Réponse Ransomware`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Scenario + Description */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">{`Scénario (slug)`}</label>
            <input
              type="text"
              className="input-cyber w-full px-3 py-2 text-sm font-mono"
              placeholder={`Ex: ransomware, phishing...`}
              value={scenario}
              onChange={(e) => setScenario(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">{`Description courte`}</label>
            <input
              type="text"
              className="input-cyber w-full px-3 py-2 text-sm"
              placeholder={`Résumé du scénario...`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        {/* Steps */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm text-text-secondary">{`Étapes de la checklist`}</label>
            <button
              type="button"
              onClick={addStep}
              className="flex items-center gap-1 text-xs text-cyber-cyan hover:text-cyber-cyan/80 transition-colors"
            >
              <Plus size={14} />
              {`Ajouter une étape`}
            </button>
          </div>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-text-muted flex-shrink-0">
                  <GripVertical size={15} />
                </span>
                <span className="text-xs text-text-muted w-5 text-right flex-shrink-0">{i + 1}</span>
                <input
                  type="text"
                  className="input-cyber flex-1 px-3 py-2 text-sm"
                  placeholder={`${`étapes`} ${i + 1}...`}
                  value={step.content}
                  onChange={(e) => updateStep(i, e.target.value)}
                />
                {steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStep(i)}
                    className="text-text-muted hover:text-cyber-red transition-colors flex-shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn-cyber flex items-center gap-2 px-5 py-2 rounded text-sm font-medium disabled:opacity-50"
          >
            <Save size={15} />
            {saving ? `Sauvegarde…` : isEdit ? `Mettre à jour` : `Nouveau playbook`}
          </button>
          <button
            type="button"
            onClick={() => navigate('/playbooks')}
            className="px-5 py-2 rounded text-sm border border-border text-text-secondary hover:text-text-primary transition-colors"
          >
            {`Annuler`}
          </button>
        </div>
      </form>
    </div>
  )
}
