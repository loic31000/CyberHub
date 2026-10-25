import { useEffect, useState } from 'react'
import { MessageSquareText, Trash2 } from 'lucide-react'
import { cloakAnnotationsApi } from '@/api/client'
import { toast } from '@/store/toast'
import type { AnnotationStatus, CloakAnnotation, CloakAnnotationRequest } from '@/types/cloakAnnotation'
import { cloakRef, type KnowledgeItem } from '../model'
import { ANNOTATION_LABEL, Fact, Facts, Prose, Subhead } from './parts'

/*
 * CLOAK analyst data: status, personal notes, countermeasures and tags, keyed
 * strictly by the CLOAK ref (tac-X:te-Y or tac-X:te-Y:sub-Z) so a parent and
 * its sub-techniques never share an annotation. Reset goes through the
 * dossier's ConfirmModal (onReset).
 */

const STATUS_OPTIONS: { value: AnnotationStatus; label: string }[] = [
  { value: '', label: 'Non annoté' }, { value: 'a_tester', label: 'À tester' },
  { value: 'vu_en_lab', label: 'Vu en lab' }, { value: 'maitrise', label: 'Maîtrisé' },
]

function Editor({ item, annotation, onSaved, onReset, onCancel }: { item: KnowledgeItem; annotation: CloakAnnotation | null; onSaved: (value: CloakAnnotation) => void; onReset: () => void; onCancel: () => void }) {
  const [status, setStatus] = useState<AnnotationStatus>(annotation?.status ?? '')
  const [notes, setNotes] = useState(annotation?.user_notes ?? '')
  const [counter, setCounter] = useState(annotation?.counter_notes ?? '')
  const [tags, setTags] = useState(annotation?.tags ?? '')
  const [saving, setSaving] = useState(false)
  const empty = !status && !notes.trim() && !counter.trim() && !tags.trim()
  const save = async () => {
    if (saving || empty) return
    setSaving(true)
    const payload: CloakAnnotationRequest = { technique_ref: cloakRef(item), status, user_notes: notes.trim(), counter_notes: counter.trim(), tags: tags.trim() }
    try { onSaved(await cloakAnnotationsApi.upsert(payload)); toast.success('Annotation sauvegardée') }
    catch { toast.error('Erreur lors de la sauvegarde') }
    finally { setSaving(false) }
  }
  return <div className="ka-ann-editor" role="group" aria-label="Éditeur d’annotation CLOAK">
    <fieldset><legend>Statut</legend><div className="ka-ann-status">{STATUS_OPTIONS.map(option =>
      <button type="button" key={option.value} aria-pressed={status === option.value} onClick={() => setStatus(option.value)}>{option.label}</button>)}</div>
    </fieldset>
    <label>Notes personnelles<textarea rows={5} value={notes} onChange={event => setNotes(event.target.value)} /></label>
    <label>Contre-mesures<textarea rows={4} value={counter} onChange={event => setCounter(event.target.value)} /></label>
    <label>Tags personnels<input value={tags} onChange={event => setTags(event.target.value)} placeholder="à-tester, red-team…" /></label>
    <footer>
      {annotation ? <button type="button" className="is-danger" onClick={onReset}><Trash2 size={14} /> Réinitialiser</button> : <span />}
      <span className="ka-ann-actions">
        <button type="button" onClick={onCancel}>Annuler</button>
        <button type="button" className="is-primary" disabled={saving || empty} onClick={save}>{saving ? 'Sauvegarde…' : 'Sauvegarder'}</button>
      </span>
    </footer>
  </div>
}

export default function AnnotationPanel({ item, annotation, startEditing, onSaved, onReset }: {
  item: KnowledgeItem; annotation: CloakAnnotation | null; startEditing?: boolean
  onSaved: (value: CloakAnnotation) => void; onReset: () => void
}) {
  const [editing, setEditing] = useState(Boolean(startEditing))
  useEffect(() => { setEditing(Boolean(startEditing)) }, [item.key, startEditing])

  if (editing) return <Editor item={item} annotation={annotation} onCancel={() => setEditing(false)} onReset={onReset} onSaved={value => { onSaved(value); setEditing(false) }} />
  const filled = annotation && (annotation.status || annotation.user_notes || annotation.counter_notes || annotation.tags)
  return <div className="ka-ann-view">
    {filled ? <>
      <Facts>
        <Fact label="Statut">{annotation.status ? ANNOTATION_LABEL[annotation.status] : 'Non annoté'}</Fact>
        <Fact label="Tags">{annotation.tags || '—'}</Fact>
      </Facts>
      {annotation.user_notes && <><Subhead>Notes personnelles</Subhead><Prose>{annotation.user_notes}</Prose></>}
      {annotation.counter_notes && <><Subhead>Contre-mesures</Subhead><Prose>{annotation.counter_notes}</Prose></>}
    </> : <p className="ka-empty-note">Aucune annotation pour cette fiche.</p>}
    <button type="button" className="ka-ann-open" onClick={() => setEditing(true)}><MessageSquareText size={14} /> {annotation ? 'Modifier l’annotation' : 'Annoter'}</button>
  </div>
}
