import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2, RotateCcw, Check, AlertCircle, RefreshCw, SearchX } from 'lucide-react'
import { playbookApi } from '@/api/client'
import type { Playbook, PlaybookStep } from '@/types'
import { toast } from '@/store/toast'
import PbHero from '@/pb26/PbHero'
import ConfirmDialog from '@/pb26/ConfirmDialog'
import { ProgressBadge, ProgressMeter, apiError, formatDay, isNotFound, orderedSteps, progressOf, scenarioLabel } from '@/pb26/parts'
import '@/pb26/pb.css'

type Load = { status: 'loading' } | { status: 'error' } | { status: 'missing' } | { status: 'ready' }

/*
 * One playbook and its checklist. The backend's toggle flips a step rather
 * than setting it, so a click is never applied optimistically: the step is
 * locked until the server answers, its answer is the truth, and a reset waits
 * for pending toggles (and blocks new ones) so no answer lands on a stale list.
 * When an answer is lost, the playbook is reloaded to learn its real state.
 */
export default function PlaybookDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const playbookId = Number(id)
  const [playbook, setPlaybook] = useState<Playbook | null>(null)
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [pending, setPending] = useState<ReadonlySet<number>>(new Set())
  const [resetOpen, setResetOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [announce, setAnnounce] = useState('')
  // Bumped by every reload or reset: answers started before it are dropped.
  const epoch = useRef(0)
  const pendingRef = useRef(new Set<number>())
  const stepRefs = useRef(new Map<number, HTMLButtonElement>())

  const setPendingStep = (stepId: number, on: boolean) => {
    const next = new Set(pendingRef.current)
    if (on) next.add(stepId); else next.delete(stepId)
    pendingRef.current = next
    setPending(next)
  }

  const reload = useCallback((quiet = false) => {
    const current = ++epoch.current
    pendingRef.current = new Set()
    setPending(new Set())
    if (!quiet) setLoad({ status: 'loading' })
    playbookApi.get(playbookId)
      .then(pb => {
        if (current !== epoch.current) return
        setPlaybook(pb)
        setLoad({ status: 'ready' })
      })
      .catch(err => {
        if (current !== epoch.current) return
        if (quiet) { toast.error('Impossible de resynchroniser la checklist'); return }
        setLoad({ status: isNotFound(err) ? 'missing' : 'error' })
      })
  }, [playbookId])

  useEffect(() => {
    if (!Number.isInteger(playbookId) || playbookId <= 0) { setLoad({ status: 'missing' }); return }
    reload()
  }, [playbookId, attempt, reload])

  const toggle = async (step: PlaybookStep) => {
    if (!playbook || resetting || pendingRef.current.has(step.id)) return
    const current = epoch.current
    setPendingStep(step.id, true)
    try {
      const updated = await playbookApi.toggleStep(playbook.id, step.id)
      if (current !== epoch.current) return
      setPlaybook(pb => pb && { ...pb, steps: pb.steps.map(s => (s.id === step.id ? { ...s, checked: updated.checked } : s)) })
      setAnnounce(`Étape ${step.order} ${updated.checked ? 'validée' : 'à refaire'}`)
    } catch (err) {
      if (current !== epoch.current) return
      toast.error(apiError(err, 'L’étape n’a pas pu être mise à jour'))
      // The flip may or may not have happened: ask the server.
      reload(true)
      return
    } finally {
      if (current === epoch.current) setPendingStep(step.id, false)
    }
  }

  const reset = async () => {
    if (!playbook || pendingRef.current.size) return
    setResetting(true)
    const current = ++epoch.current
    try {
      await playbookApi.reset(playbook.id)
      if (current !== epoch.current) return
      setPlaybook(pb => pb && { ...pb, steps: pb.steps.map(s => ({ ...s, checked: false })) })
      setResetOpen(false)
      setAnnounce('Checklist réinitialisée')
      toast.success('Checklist réinitialisée')
    } catch (err) {
      toast.error(apiError(err, 'La réinitialisation a échoué'))
      setResetOpen(false)
      reload(true)
    } finally {
      setResetting(false)
    }
  }

  const remove = async () => {
    if (!playbook) return
    setDeleting(true)
    try {
      await playbookApi.delete(playbook.id)
      toast.success(`Playbook « ${playbook.title} » supprimé`)
      navigate('/playbooks')
    } catch (err) {
      toast.error(apiError(err, 'La suppression a échoué'))
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  const steps = orderedSteps(playbook?.steps)
  const p = progressOf(steps)
  const nextStep = steps.find(s => !s.checked)

  // Arrow keys move between steps; Home and End jump to the ends.
  const onStepKey = (event: React.KeyboardEvent, index: number) => {
    const target = event.key === 'ArrowDown' ? index + 1 : event.key === 'ArrowUp' ? index - 1
      : event.key === 'Home' ? 0 : event.key === 'End' ? steps.length - 1 : null
    if (target === null || target < 0 || target >= steps.length) return
    event.preventDefault()
    stepRefs.current.get(steps[target].id)?.focus()
  }

  const heroStatus = load.status === 'error'
    ? { text: 'DONNÉES INDISPONIBLES', tone: 'warn' as const }
    : load.status === 'ready'
      ? { text: `${p.done}/${p.total} ÉTAPES`, mark: `${p.pct} %`, tone: p.state === 'done' ? 'ok' as const : 'busy' as const }
      : undefined

  return (
    <div className="pb26">
      <div className="pb26-frame" data-layout="detail">
        <PbHero status={heroStatus} />

        <nav className="pb26-crumbs" aria-label="Fil d’Ariane">
          <Link to="/playbooks" className="pb26-link"><ArrowLeft size={14} aria-hidden="true" /> Tous les playbooks</Link>
        </nav>

        {load.status === 'loading' && <div className="pb26-loading" role="status">Chargement du playbook…</div>}

        {load.status === 'error' && (
          <div className="pb26-state is-error" role="alert">
            <AlertCircle size={26} aria-hidden="true" />
            <h2>Impossible de charger ce playbook</h2>
            <p>Le backend n’a pas répondu. Réessayez dans un instant.</p>
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

        {load.status === 'ready' && playbook && (
          <div className="pb26-detail" data-progress={p.state}>
            <article className="pb26-detail-main" aria-labelledby="pb26-title">
              <header className="pb26-intro">
                <span className="pb26-tag">{scenarioLabel(playbook.scenario)}</span>
                <h2 id="pb26-title">{playbook.title}</h2>
                {playbook.description && <p className="pb26-lede">{playbook.description}</p>}
              </header>

              <section className="pb26-checklist" aria-labelledby="pb26-checklist-title">
                <div className="pb26-checklist-head">
                  <h3 id="pb26-checklist-title">Checklist</h3>
                  {nextStep && <p className="pb26-next">Prochaine étape <span>n° {steps.indexOf(nextStep) + 1}</span></p>}
                  {!nextStep && p.total > 0 && <p className="pb26-next is-done"><Check size={14} aria-hidden="true" /> Toutes les étapes sont validées</p>}
                </div>
                {steps.length === 0 ? (
                  <div className="pb26-state is-inline">
                    <p>Ce playbook n’a encore aucune étape.</p>
                    <Link to={`/playbooks/${playbook.id}/edit`} className="pb26-btn"><Pencil size={14} aria-hidden="true" /> Ajouter des étapes</Link>
                  </div>
                ) : (
                  <ol className="pb26-steps">
                    {steps.map((step, i) => {
                      const busy = pending.has(step.id)
                      return (
                        <li key={step.id} className="pb26-step" data-checked={step.checked} data-next={step === nextStep || undefined}>
                          <button
                            ref={el => { if (el) stepRefs.current.set(step.id, el); else stepRefs.current.delete(step.id) }}
                            type="button"
                            role="checkbox"
                            aria-checked={step.checked}
                            aria-busy={busy || undefined}
                            aria-disabled={busy || resetting || undefined}
                            className="pb26-step-btn"
                            onClick={() => toggle(step)}
                            onKeyDown={e => onStepKey(e, i)}
                          >
                            <span className="pb26-step-node" aria-hidden="true">{step.checked ? <Check size={14} strokeWidth={2.75} /> : i + 1}</span>
                            <span className="pb26-step-text">{step.content}</span>
                            {busy
                              ? <span className="pb26-step-meta">Envoi…</span>
                              : step === nextStep && <span className="pb26-step-meta is-next" aria-hidden="true">À faire</span>}
                          </button>
                        </li>
                      )
                    })}
                  </ol>
                )}
                <p className="pb26-hint">Espace ou Entrée pour cocher, flèches ↑ ↓ pour passer d’une étape à l’autre.</p>
                <p className="pb26-sr" aria-live="polite">{announce}</p>
              </section>
            </article>

            <aside className="pb26-aside" aria-label="Progression et actions">
              <div className="pb26-aside-progress">
                <div className="pb26-aside-figures">
                  <b>{p.pct}<small>%</small></b>
                  <ProgressBadge state={p.state} />
                </div>
                <ProgressMeter progress={p} label={`Progression : ${p.done} étapes validées sur ${p.total}, ${p.pct} %`} />
                <p>{p.done} étape{p.done > 1 ? 's' : ''} validée{p.done > 1 ? 's' : ''} sur {p.total}</p>
              </div>

              <div className="pb26-aside-actions">
                <Link to={`/playbooks/${playbook.id}/edit`} className="pb26-btn"><Pencil size={15} aria-hidden="true" /> Modifier</Link>
                <button type="button" className="pb26-btn is-quiet" onClick={() => setResetOpen(true)} disabled={p.done === 0 || resetting || pending.size > 0}>
                  <RotateCcw size={15} aria-hidden="true" /> Réinitialiser
                </button>
              </div>

              <dl className="pb26-meta">
                <div><dt>Créé le</dt><dd>{formatDay(playbook.created_at)}</dd></div>
                <div><dt>Mis à jour</dt><dd>{formatDay(playbook.updated_at)}</dd></div>
              </dl>

              <button type="button" className="pb26-text-btn is-danger" onClick={() => setDeleteOpen(true)} disabled={deleting}>
                <Trash2 size={14} aria-hidden="true" /> Supprimer le playbook
              </button>
            </aside>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={resetOpen}
        title="Réinitialiser la checklist ?"
        message={`Les ${p.done} étape${p.done > 1 ? 's' : ''} validée${p.done > 1 ? 's' : ''} seront décochées. La progression actuelle sera perdue.`}
        confirmLabel="Réinitialiser"
        busyLabel="Réinitialisation…"
        tone="warn"
        busy={resetting}
        onConfirm={reset}
        onCancel={() => setResetOpen(false)}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="Supprimer le playbook ?"
        message={playbook ? `« ${playbook.title} » et ses ${p.total} étapes seront supprimés définitivement.` : ''}
        confirmLabel="Supprimer"
        busyLabel="Suppression…"
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  )
}
