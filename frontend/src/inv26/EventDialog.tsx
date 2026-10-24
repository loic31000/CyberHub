import { useId, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { investigationApi } from '@/api/client'
import type { EventCreatePayload, EventSeverity, EventType, InvestigationEvent } from '@/types/investigation'
import { toast } from '@/store/toast'
import Dialog from './Dialog'
import { EVENT_TYPES, EVENT_TYPE_LABEL, SEVERITIES, SEVERITY_LABEL } from './parts'

/* The value of a datetime-local input for a moment, in the browser's local time. */
export function localInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/* Adding an event to a case: when it happened, what, how severe, and where it comes from. */
export default function EventDialog({ investigationId, onClose, onCreated }: {
  investigationId: number
  onClose: () => void
  onCreated: (event: InvestigationEvent) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventType, setEventType] = useState<EventType>('manual')
  const [severity, setSeverity] = useState<EventSeverity>('info')
  const [timestamp, setTimestamp] = useState(() => localInputValue(new Date()))
  const [sourceModule, setSourceModule] = useState('')
  const [sourceEntityId, setSourceEntityId] = useState('')
  const [metadata, setMetadata] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const ids = { label: useId(), when: useId(), type: useId(), title: useId(), severity: useId(), description: useId(), module: useId(), entity: useId(), meta: useId(), metaHint: useId(), error: useId() }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting.current) return
    if (!title.trim()) { setError('Le titre est requis'); return }
    const when = timestamp ? new Date(timestamp) : null
    if (timestamp && (!when || Number.isNaN(when.getTime()))) { setError('Horodatage invalide'); return }
    submitting.current = true
    setSaving(true)
    setError('')
    try {
      const payload: EventCreatePayload = {
        title: title.trim(),
        description: description.trim(),
        event_type: eventType,
        severity,
        timestamp: when ? when.toISOString() : undefined,
        source_module: sourceModule.trim() || undefined,
        source_entity_id: sourceEntityId.trim() || undefined,
        metadata: metadata.trim() || undefined,
      }
      const created = await investigationApi.createEvent(investigationId, payload)
      toast.success('Événement ajouté')
      onCreated(created)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e?.response?.data?.error ?? 'Erreur lors de l’ajout')
      submitting.current = false
      setSaving(false)
    }
  }

  return (
    <Dialog title="Nouvel événement" labelId={ids.label} onClose={() => { if (!saving) onClose() }} wide>
      <form onSubmit={submit} className="iv26-dialog-form" aria-describedby={error ? ids.error : undefined} noValidate>
        {error && <p id={ids.error} role="alert" className="iv26-form-error">{error}</p>}
        <div className="iv26-form-grid">
          <div className="iv26-field">
            <label htmlFor={ids.when}>DATE ET HEURE</label>
            <input id={ids.when} type="datetime-local" value={timestamp} onChange={e => setTimestamp(e.target.value)} />
            <small>Heure locale de ce navigateur.</small>
          </div>
          <div className="iv26-field">
            <label htmlFor={ids.type}>TYPE</label>
            <select id={ids.type} value={eventType} onChange={e => setEventType(e.target.value as EventType)}>
              {EVENT_TYPES.map(t => <option key={t} value={t}>{EVENT_TYPE_LABEL[t]}</option>)}
            </select>
          </div>
        </div>
        <div className="iv26-field">
          <label htmlFor={ids.title}>TITRE *</label>
          <input id={ids.title} value={title} onChange={e => setTitle(e.target.value)} placeholder="ex. IP 203.0.113.7 observée dans les journaux du proxy" required aria-invalid={error === 'Le titre est requis' || undefined} data-autofocus autoComplete="off" />
        </div>
        <div className="iv26-field">
          <label htmlFor={ids.severity}>SÉVÉRITÉ</label>
          <select id={ids.severity} value={severity} onChange={e => setSeverity(e.target.value as EventSeverity)}>
            {SEVERITIES.map(s => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
          </select>
        </div>
        <div className="iv26-field">
          <label htmlFor={ids.description}>DESCRIPTION</label>
          <textarea id={ids.description} value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Observations, contexte, liens…" />
        </div>
        <div className="iv26-form-grid">
          <div className="iv26-field">
            <label htmlFor={ids.module}>MODULE SOURCE</label>
            <input id={ids.module} value={sourceModule} onChange={e => setSourceModule(e.target.value)} placeholder="ex. ioc, bgp, cve" autoComplete="off" />
          </div>
          <div className="iv26-field">
            <label htmlFor={ids.entity}>RÉFÉRENCE SOURCE</label>
            <input id={ids.entity} value={sourceEntityId} onChange={e => setSourceEntityId(e.target.value)} placeholder="ex. 42, CVE-2024-6387" autoComplete="off" />
          </div>
        </div>
        <div className="iv26-field">
          <label htmlFor={ids.meta}>MÉTADONNÉES</label>
          <textarea id={ids.meta} className="is-mono" value={metadata} onChange={e => setMetadata(e.target.value)} rows={2} placeholder='{"asn": 64500, "prefix": "198.51.100.0/24"}' aria-describedby={ids.metaHint} />
          <small id={ids.metaHint}>JSON ou texte libre, conservé tel quel.</small>
        </div>
        <div className="iv26-dialog-actions">
          <button type="button" className="iv26-btn" onClick={onClose} disabled={saving}>Annuler</button>
          <button type="submit" className="iv26-btn is-primary" disabled={saving}><Plus size={15} aria-hidden="true" />{saving ? 'Ajout…' : 'Ajouter à la chronologie'}</button>
        </div>
      </form>
    </Dialog>
  )
}
