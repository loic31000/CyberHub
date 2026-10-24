import { useId, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { investigationApi } from '@/api/client'
import type { Investigation, InvestigationCreatePayload, InvestigationStatus } from '@/types/investigation'
import { toast } from '@/store/toast'
import Dialog from './Dialog'
import { STATUSES, STATUS_LABEL, splitTags } from './parts'

/* Opening a case: title required, the rest optional; the backend's error is shown as is. */
export default function CreateInvestigationDialog({ onClose, onCreated }: {
  onClose: () => void
  onCreated: (inv: Investigation) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<InvestigationStatus>('open')
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const ids = { label: useId(), title: useId(), description: useId(), status: useId(), tags: useId(), tagsHint: useId(), error: useId() }
  const tagList = splitTags(tags)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting.current) return
    if (!title.trim()) { setError('Le titre est requis'); return }
    submitting.current = true
    setSaving(true)
    setError('')
    try {
      const payload: InvestigationCreatePayload = { title: title.trim(), description: description.trim(), status, tags: tagList.join(', ') }
      const inv = await investigationApi.create(payload)
      toast.success('Investigation créée')
      onCreated(inv)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e?.response?.data?.error ?? 'Erreur lors de la création')
      submitting.current = false
      setSaving(false)
    }
  }

  return (
    <Dialog title="Nouvelle investigation" labelId={ids.label} onClose={() => { if (!saving) onClose() }} wide>
      <form onSubmit={submit} className="iv26-dialog-form" aria-describedby={error ? ids.error : undefined} noValidate>
        {error && <p id={ids.error} role="alert" className="iv26-form-error">{error}</p>}
        <div className="iv26-field">
          <label htmlFor={ids.title}>TITRE *</label>
          <input id={ids.title} value={title} onChange={e => setTitle(e.target.value)} placeholder="ex. Détournement de préfixes AS64500" required aria-invalid={error === 'Le titre est requis' || undefined} data-autofocus autoComplete="off" />
        </div>
        <div className="iv26-field">
          <label htmlFor={ids.description}>DESCRIPTION</label>
          <textarea id={ids.description} value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder="Contexte, périmètre, objectifs…" />
        </div>
        <div className="iv26-form-grid">
          <div className="iv26-field">
            <label htmlFor={ids.status}>STATUT</label>
            <select id={ids.status} value={status} onChange={e => setStatus(e.target.value as InvestigationStatus)}>
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <div className="iv26-field">
            <label htmlFor={ids.tags}>TAGS</label>
            <input id={ids.tags} value={tags} onChange={e => setTags(e.target.value)} placeholder="apt, ransomware, bgp-hijack" aria-describedby={ids.tagsHint} autoComplete="off" />
            <small id={ids.tagsHint}>{tagList.length ? `${tagList.length} tag${tagList.length > 1 ? 's' : ''} : ${tagList.join(' · ')}` : 'Séparés par des virgules.'}</small>
          </div>
        </div>
        <div className="iv26-dialog-actions">
          <button type="button" className="iv26-btn" onClick={onClose} disabled={saving}>Annuler</button>
          <button type="submit" className="iv26-btn is-primary" disabled={saving}><Plus size={15} aria-hidden="true" />{saving ? 'Création…' : 'Créer l’investigation'}</button>
        </div>
      </form>
    </Dialog>
  )
}
