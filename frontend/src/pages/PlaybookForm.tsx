import { useState, useEffect, useRef, useId } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, ArrowDown, ArrowUp, Plus, Trash2, AlertCircle, AlertTriangle, RefreshCw, SearchX } from 'lucide-react'
import { playbookApi } from '@/api/client'
import { toast } from '@/store/toast'
import PbHero from '@/pb26/PbHero'
import ConfirmDialog from '@/pb26/ConfirmDialog'
import { SCENARIO_LABEL, apiError, isNotFound, orderedSteps, toSlug } from '@/pb26/parts'
import {
  LIMITS, emptyDraft, newStep, insertStep, removeStep, moveStep, editStep,
  validate, hasErrors, toPayload, sameDraft, type Draft, type DraftErrors,
} from '@/pb26/steps'
import '@/pb26/pb.css'

type Load = { status: 'loading' } | { status: 'error' } | { status: 'missing' } | { status: 'ready' }

/*
 * Create or edit a playbook. The backend's update replaces every step, so
 * saving an edit clears the checklist's progress; the form says so before it
 * happens. Errors show once a save was tried, then follow the typing.
 */
export default function PlaybookForm() {
  const { id } = useParams<{ id: string }>()
  // "New" and "edit" share this component: a fresh form for each, never a leftover draft.
  return <PlaybookEditor key={id ?? 'new'} id={id} />
}

function PlaybookEditor({ id }: { id: string | undefined }) {
  const navigate = useNavigate()
  const isEdit = id !== undefined
  const playbookId = Number(id)
  const uid = useId()

  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [initial, setInitial] = useState<Draft>(draft)
  const [checkedCount, setCheckedCount] = useState(0)
  const [load, setLoad] = useState<Load>(isEdit ? { status: 'loading' } : { status: 'ready' })
  const [attempt, setAttempt] = useState(0)
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [leaveOpen, setLeaveOpen] = useState(false)
  const focusKey = useRef<number | null>(null)
  const stepInputs = useRef(new Map<number, HTMLInputElement>())
  const titleRef = useRef<HTMLInputElement>(null)
  const stepsRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    if (!isEdit) return
    if (!Number.isInteger(playbookId) || playbookId <= 0) { setLoad({ status: 'missing' }); return }
    let live = true
    setLoad({ status: 'loading' })
    playbookApi.get(playbookId)
      .then(pb => {
        if (!live) return
        const steps = orderedSteps(pb.steps)
        const loaded: Draft = {
          title: pb.title ?? '',
          scenario: pb.scenario ?? '',
          description: pb.description ?? '',
          steps: steps.length ? steps.map(s => newStep(s.content)) : [newStep()],
        }
        setDraft(loaded)
        setInitial(loaded)
        setCheckedCount(steps.filter(s => s.checked).length)
        setLoad({ status: 'ready' })
      })
      .catch(err => { if (live) setLoad({ status: isNotFound(err) ? 'missing' : 'error' }) })
    return () => { live = false }
  }, [isEdit, playbookId, attempt])

  // Focus follows a step that was just added or moved.
  useEffect(() => {
    if (focusKey.current === null) return
    stepInputs.current.get(focusKey.current)?.focus()
    focusKey.current = null
  })

  const errors: DraftErrors = tried ? validate(draft) : {}
  const dirty = !sameDraft(draft, initial)
  const backTo = isEdit ? `/playbooks/${playbookId}` : '/playbooks'
  const filledSteps = draft.steps.filter(s => s.content.trim()).length

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => { setDraft(d => ({ ...d, [key]: value })); setSaveError('') }
  const setSteps = (fn: (steps: Draft['steps']) => Draft['steps']) => { setDraft(d => ({ ...d, steps: fn(d.steps) })); setSaveError('') }

  const addAfter = (index: number) => {
    if (draft.steps.length >= LIMITS.steps) return
    const step = newStep()
    focusKey.current = step.key
    setSteps(s => insertStep(s, index, step))
  }
  const move = (from: number, to: number) => {
    if (to < 0 || to >= draft.steps.length) return
    focusKey.current = draft.steps[from].key
    setSteps(s => moveStep(s, from, to))
  }
  const remove = (index: number) => {
    const neighbour = draft.steps[index + 1] ?? draft.steps[index - 1]
    focusKey.current = neighbour?.key ?? null
    setSteps(s => removeStep(s, index))
  }

  // Enter adds a step below; Alt+↑/↓ moves it; Backspace on an empty row removes it.
  const onStepKey = (event: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === 'Enter') { event.preventDefault(); addAfter(index) }
    else if (event.altKey && event.key === 'ArrowUp') { event.preventDefault(); move(index, index - 1) }
    else if (event.altKey && event.key === 'ArrowDown') { event.preventDefault(); move(index, index + 1) }
    else if (event.key === 'Backspace' && !event.currentTarget.value && draft.steps.length > 1) { event.preventDefault(); remove(index) }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving) return
    setTried(true)
    const found = validate(draft)
    if (hasErrors(found)) {
      if (found.title) titleRef.current?.focus()
      else stepsRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], input')?.focus()
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const payload = toPayload(draft)
      const saved = isEdit ? await playbookApi.update(playbookId, payload) : await playbookApi.create(payload)
      toast.success(isEdit ? 'Playbook mis à jour' : 'Playbook créé')
      navigate(`/playbooks/${saved?.id ?? playbookId}`)
    } catch (err) {
      setSaveError(apiError(err, 'L’enregistrement a échoué. Vos saisies sont conservées : réessayez.'))
      setSaving(false)
    }
  }

  const leave = () => { if (dirty && !saving) setLeaveOpen(true); else navigate(backTo) }

  const field = (name: string) => `${uid}-${name}`
  const describe = (...ids: (string | false | undefined)[]) => ids.filter(Boolean).join(' ') || undefined

  return (
    <div className="pb26">
      <div className="pb26-frame" data-layout="form">
        <PbHero status={load.status === 'ready' ? { text: isEdit ? 'ÉDITION' : 'NOUVEAU PLAYBOOK', mark: dirty ? 'NON ENREGISTRÉ' : undefined, tone: dirty ? 'busy' : 'ok' } : undefined} />

        <nav className="pb26-crumbs" aria-label="Fil d’Ariane">
          <button type="button" className="pb26-link" onClick={leave}><ArrowLeft size={14} aria-hidden="true" /> {isEdit ? 'Retour au playbook' : 'Tous les playbooks'}</button>
        </nav>

        {load.status === 'loading' && <div className="pb26-loading" role="status">Chargement du playbook…</div>}

        {load.status === 'error' && (
          <div className="pb26-state is-error" role="alert">
            <AlertCircle size={26} aria-hidden="true" />
            <h2>Impossible de charger ce playbook</h2>
            <p>Le backend n’a pas répondu. Rien n’a été modifié.</p>
            <button type="button" className="pb26-btn" onClick={() => setAttempt(n => n + 1)}><RefreshCw size={14} aria-hidden="true" /> Réessayer</button>
          </div>
        )}

        {load.status === 'missing' && (
          <div className="pb26-state">
            <SearchX size={28} aria-hidden="true" />
            <h2>Playbook introuvable</h2>
            <p>Il a peut-être été supprimé, ou le lien est incorrect.</p>
            <Link to="/playbooks" className="pb26-btn">Retour aux playbooks</Link>
          </div>
        )}

        {load.status === 'ready' && (
          <form className="pb26-form" onSubmit={submit} noValidate aria-label={isEdit ? 'Modifier le playbook' : 'Nouveau playbook'}>
            <header className="pb26-form-head">
              <h2>{isEdit ? 'Modifier le playbook' : 'Nouveau playbook'}</h2>
              <p>Décrivez le scénario, puis la suite d’étapes à dérouler pendant l’incident.</p>
            </header>

            <section className="pb26-section" aria-labelledby={field('general')}>
              <div className="pb26-section-intro">
                <span className="pb26-section-num" aria-hidden="true">01</span>
                <h3 id={field('general')}>Identification</h3>
                <p>Ce qui permet de retrouver le playbook et de savoir quand l’utiliser.</p>
              </div>

              <div className="pb26-section-body">
                <div className="pb26-field">
                  <label htmlFor={field('title')}>Titre <span className="pb26-req" aria-hidden="true">*</span></label>
                  <input
                    ref={titleRef}
                    id={field('title')}
                    className="is-lg"
                    value={draft.title}
                    maxLength={LIMITS.title + 20}
                    onChange={e => set('title', e.target.value)}
                    placeholder="Ex. Réponse ransomware"
                    aria-required="true"
                    aria-invalid={Boolean(errors.title)}
                    aria-describedby={describe(errors.title && field('title-error'))}
                    autoComplete="off"
                  />
                  {errors.title && <small className="pb26-field-error" id={field('title-error')}>{errors.title}</small>}
                </div>

                <div className="pb26-field">
                  <label htmlFor={field('scenario')}>Scénario</label>
                  <input
                    id={field('scenario')}
                    className="is-mono"
                    list={field('scenarios')}
                    value={draft.scenario}
                    onChange={e => set('scenario', toSlug(e.target.value))}
                    placeholder="ransomware, phishing…"
                    aria-describedby={field('scenario-help')}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <datalist id={field('scenarios')}>
                    {Object.entries(SCENARIO_LABEL).map(([slug, label]) => <option key={slug} value={slug}>{label}</option>)}
                  </datalist>
                  <small id={field('scenario-help')}>Identifiant court, utilisé par le filtre de la liste.</small>
                </div>

                <div className="pb26-field">
                  <div className="pb26-label-row">
                    <label htmlFor={field('description')}>Description</label>
                    <small id={field('description-count')} className="pb26-counter">{draft.description.trim().length} / {LIMITS.description}</small>
                  </div>
                  <textarea
                    id={field('description')}
                    rows={3}
                    value={draft.description}
                    onChange={e => set('description', e.target.value)}
                    placeholder="Quand déclencher ce playbook, et son objectif."
                    aria-invalid={Boolean(errors.description)}
                    aria-describedby={describe(field('description-count'), errors.description && field('description-error'))}
                  />
                  {errors.description && <small className="pb26-field-error" id={field('description-error')}>{errors.description}</small>}
                </div>
              </div>
            </section>

            <section className="pb26-section" aria-labelledby={field('steps-title')}>
              <div className="pb26-section-intro">
                <span className="pb26-section-num" aria-hidden="true">02</span>
                <h3 id={field('steps-title')}>Étapes</h3>
                <p><b>{filledSteps}</b> étape{filledSteps > 1 ? 's' : ''} dans la checklist.</p>
                <p className="pb26-keys" id={field('steps-help')}>
                  <kbd>Entrée</kbd> ajoute une étape<br />
                  <kbd>Alt</kbd> + <kbd>↑</kbd> <kbd>↓</kbd> la déplace<br />
                  <kbd>⌫</kbd> sur une ligne vide la supprime
                </p>
              </div>

              <div className="pb26-section-body">
                {isEdit && checkedCount > 0 && (
                  <p className="pb26-notice" role="note">
                    <AlertTriangle size={16} aria-hidden="true" />
                    <span>Enregistrer remplace les étapes : les {checkedCount} étape{checkedCount > 1 ? 's' : ''} déjà validée{checkedCount > 1 ? 's' : ''} seront décochée{checkedCount > 1 ? 's' : ''}.</span>
                  </p>
                )}
                {errors.steps && <p className="pb26-field-error" role="alert">{errors.steps}</p>}

                <ol className="pb26-editor" ref={stepsRef}>
                  {draft.steps.map((step, i) => {
                    const stepError = errors.step?.[step.key]
                    const inputId = field(`step-${step.key}`)
                    return (
                      <li key={step.key} className="pb26-editor-row">
                        <span className="pb26-editor-num" aria-hidden="true">{i + 1}</span>
                        <div className="pb26-editor-input">
                          <label className="pb26-sr" htmlFor={inputId}>Étape {i + 1}</label>
                          <input
                            id={inputId}
                            ref={el => { if (el) stepInputs.current.set(step.key, el); else stepInputs.current.delete(step.key) }}
                            value={step.content}
                            onChange={e => setSteps(s => editStep(s, i, e.target.value))}
                            onKeyDown={e => onStepKey(e, i)}
                            placeholder={i === 0 ? 'Ex. Isoler la machine du réseau' : 'Étape suivante…'}
                            aria-invalid={Boolean(stepError) || (Boolean(errors.steps) && i === 0)}
                            aria-describedby={describe(field('steps-help'), stepError && `${inputId}-error`)}
                            autoComplete="off"
                          />
                          {stepError && <small className="pb26-field-error" id={`${inputId}-error`}>{stepError}</small>}
                        </div>
                        <div className="pb26-editor-tools">
                          <button type="button" className="pb26-icon-btn" aria-label={`Monter l’étape ${i + 1}`} title="Monter (Alt + ↑)" onClick={() => move(i, i - 1)} disabled={i === 0}><ArrowUp size={15} /></button>
                          <button type="button" className="pb26-icon-btn" aria-label={`Descendre l’étape ${i + 1}`} title="Descendre (Alt + ↓)" onClick={() => move(i, i + 1)} disabled={i === draft.steps.length - 1}><ArrowDown size={15} /></button>
                          <button type="button" className="pb26-icon-btn is-danger" aria-label={`Supprimer l’étape ${i + 1}`} title="Supprimer" onClick={() => remove(i)} disabled={draft.steps.length === 1 && !step.content}><Trash2 size={15} /></button>
                        </div>
                      </li>
                    )
                  })}
                </ol>
                <button type="button" className="pb26-add" onClick={() => addAfter(draft.steps.length - 1)} disabled={draft.steps.length >= LIMITS.steps}>
                  <Plus size={15} aria-hidden="true" /> Ajouter une étape
                </button>
              </div>
            </section>

            {saveError && <p className="pb26-form-error" role="alert">{saveError}</p>}

            <div className="pb26-form-actions">
              <span className="pb26-form-status" aria-hidden="true">{dirty ? 'Modifications non enregistrées' : ''}</span>
              <button type="button" className="pb26-btn is-quiet" onClick={leave} disabled={saving}>Annuler</button>
              <button type="submit" className="pb26-btn is-primary" disabled={saving}>
                {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer les modifications' : 'Créer le playbook'}
              </button>
            </div>
          </form>
        )}
      </div>

      <ConfirmDialog
        open={leaveOpen}
        title="Quitter sans enregistrer ?"
        message="Les modifications de ce formulaire seront perdues."
        confirmLabel="Quitter"
        tone="warn"
        onConfirm={() => { setLeaveOpen(false); navigate(backTo) }}
        onCancel={() => setLeaveOpen(false)}
      />
    </div>
  )
}
