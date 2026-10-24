import { useEffect, useId, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertCircle, ArrowDownUp, ArrowLeft, FolderX, ListPlus, PenLine, RefreshCw } from 'lucide-react'
import { investigationApi } from '@/api/client'
import type { EventFilter, EventSeverity, EventType, Investigation, InvestigationEvent, InvestigationStatus } from '@/types/investigation'
import { toast } from '@/store/toast'
import InvHero from '@/inv26/InvHero'
import ConfirmDialog from '@/inv26/ConfirmDialog'
import EventDialog from '@/inv26/EventDialog'
import Timeline from '@/inv26/Timeline'
import {
  EVENT_TYPES, EVENT_TYPE_LABEL, SEVERITIES, SEVERITY_LABEL, STATUSES, STATUS_LABEL, StatusBadge, Tags,
  formatDay, formatDayTime, splitTags, validDate,
} from '@/inv26/parts'
import '@/inv26/inv.css'

type CaseState = { status: 'loading' } | { status: 'missing' } | { status: 'error' } | { status: 'ready'; inv: Investigation }
type EventsState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; items: InvestigationEvent[] }

const byTime = (order: 'asc' | 'desc') => (a: InvestigationEvent, b: InvestigationEvent) =>
  (order === 'asc' ? 1 : -1) * (Date.parse(a.timestamp) - Date.parse(b.timestamp) || a.id - b.id)

/* The case summary: dates and counts from the loaded case and events only. */
function Facts({ inv, events, filtered }: { inv: Investigation; events: InvestigationEvent[]; filtered: boolean }) {
  const times = events.map(e => validDate(e.timestamp)).filter((d): d is Date => d !== null).sort((a, b) => a.getTime() - b.getTime())
  const notable = events.filter(e => e.severity === 'critical' || e.severity === 'high').length
  return (
    <dl className="iv26-facts">
      <div><dt>Ouvert le</dt><dd>{formatDay(inv.created_at)}</dd></div>
      <div><dt>Mis à jour</dt><dd>{formatDayTime(inv.updated_at)}</dd></div>
      <div><dt>Événements{filtered ? ' (filtrés)' : ''}</dt><dd>{events.length}</dd></div>
      <div><dt>Période couverte</dt><dd>{times.length ? `${formatDay(times[0].toISOString())} → ${formatDay(times[times.length - 1].toISOString())}` : '—'}</dd></div>
      <div><dt>Élevés ou critiques</dt><dd data-notable={notable > 0}>{notable}</dd></div>
    </dl>
  )
}

/* Inline edition of the case itself; the backend's error is shown as is. */
function EditCase({ inv, onSaved, onCancel }: { inv: Investigation; onSaved: (inv: Investigation) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(inv.title)
  const [description, setDescription] = useState(inv.description)
  const [status, setStatus] = useState<InvestigationStatus>(inv.status)
  const [tags, setTags] = useState(inv.tags)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const ids = { title: useId(), description: useId(), status: useId(), tags: useId(), error: useId() }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError('Le titre est requis'); return }
    setSaving(true)
    setError('')
    try {
      const updated = await investigationApi.update(inv.id, { title: title.trim(), description: description.trim(), status, tags: splitTags(tags).join(', ') })
      toast.success('Investigation mise à jour')
      onSaved(updated)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e?.response?.data?.error ?? 'Erreur lors de la mise à jour')
      setSaving(false)
    }
  }

  return (
    <form className="iv26-dialog-form" onSubmit={submit} aria-label="Modifier l’investigation" aria-describedby={error ? ids.error : undefined} noValidate>
      {error && <p id={ids.error} role="alert" className="iv26-form-error">{error}</p>}
      <div className="iv26-field">
        <label htmlFor={ids.title}>TITRE *</label>
        <input id={ids.title} value={title} onChange={e => setTitle(e.target.value)} required autoFocus aria-invalid={error === 'Le titre est requis' || undefined} />
      </div>
      <div className="iv26-field">
        <label htmlFor={ids.description}>DESCRIPTION</label>
        <textarea id={ids.description} value={description} onChange={e => setDescription(e.target.value)} rows={4} />
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
          <input id={ids.tags} value={tags} onChange={e => setTags(e.target.value)} placeholder="Séparés par des virgules" />
        </div>
      </div>
      <div className="iv26-dialog-actions">
        <button type="button" className="iv26-btn" onClick={onCancel} disabled={saving}>Annuler</button>
        <button type="submit" className="iv26-btn is-primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
      </div>
    </form>
  )
}

export default function InvestigationDetail() {
  const { id } = useParams<{ id: string }>()
  const invId = Number(id)
  const validId = Number.isSafeInteger(invId) && invId > 0
  const [state, setState] = useState<CaseState>({ status: 'loading' })
  const [events, setEvents] = useState<EventsState>({ status: 'loading' })
  const [filter, setFilter] = useState<EventFilter>({ order: 'asc' })
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [toDelete, setToDelete] = useState<InvestigationEvent | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const eventsSequence = useRef(0)
  const addTrigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!validId) { setState({ status: 'missing' }); return }
    let current = true
    setState({ status: 'loading' })
    investigationApi.get(invId)
      .then(inv => { if (current) setState({ status: 'ready', inv }) })
      .catch((err: { response?: { status?: number } }) => { if (current) setState({ status: err?.response?.status === 404 ? 'missing' : 'error' }) })
    return () => { current = false }
  }, [invId, validId, attempt])

  // Filters are applied by the API; an answer to an older filter is ignored.
  useEffect(() => {
    if (!validId) return
    const request = ++eventsSequence.current
    setEvents({ status: 'loading' })
    investigationApi.listEvents(invId, { event_type: filter.event_type || undefined, severity: filter.severity || undefined, order: filter.order })
      .then(r => { if (request === eventsSequence.current) setEvents({ status: 'ready', items: r.items ?? [] }) })
      .catch(() => { if (request === eventsSequence.current) setEvents({ status: 'error' }) })
  }, [invId, validId, filter, attempt])

  const confirmDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      await investigationApi.deleteEvent(toDelete.id)
      setEvents(prev => prev.status === 'ready' ? { status: 'ready', items: prev.items.filter(e => e.id !== toDelete.id) } : prev)
      toast.success('Événement supprimé')
      setToDelete(null)
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setDeleting(false)
    }
  }

  const back = <nav className="iv26-crumbs" aria-label="Navigation"><Link to="/investigations" className="iv26-link"><ArrowLeft size={14} aria-hidden="true" /> Index des investigations</Link></nav>

  if (state.status !== 'ready') {
    return (
      <div className="iv26">
        <div className="iv26-frame">
          <InvHero status={state.status === 'error' ? { text: 'DONNÉES INDISPONIBLES', tone: 'warn' } : undefined} />
          {back}
          {state.status === 'loading' && <div className="iv26-loading" role="status">Chargement du dossier…</div>}
          {state.status === 'missing' && (
            <div className="iv26-state">
              <FolderX size={28} aria-hidden="true" />
              <h2>Investigation introuvable</h2>
              <p>Ce dossier n’existe pas ou a été supprimé.</p>
              <Link to="/investigations" className="iv26-btn">Retour à l’index</Link>
            </div>
          )}
          {state.status === 'error' && (
            <div className="iv26-state is-error" role="alert">
              <AlertCircle size={26} aria-hidden="true" />
              <h2>Impossible de charger ce dossier</h2>
              <p>Le backend n’a pas répondu.</p>
              <button type="button" className="iv26-btn" onClick={() => setAttempt(n => n + 1)}><RefreshCw size={14} aria-hidden="true" /> Réessayer</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const { inv } = state
  const items = events.status === 'ready' ? events.items : []
  const filtered = Boolean(filter.event_type || filter.severity)

  return (
    <div className="iv26">
      <div className="iv26-frame">
        <InvHero status={{ text: STATUS_LABEL[inv.status].toUpperCase(), mark: `DOSSIER #${inv.id}`, tone: inv.status === 'open' ? 'ok' : 'busy' }} />
        {back}

        <section className="iv26-dossier" aria-labelledby="iv26-case-title" data-status={inv.status}>
          {editing ? (
            <EditCase inv={inv} onCancel={() => setEditing(false)} onSaved={updated => { setState({ status: 'ready', inv: updated }); setEditing(false) }} />
          ) : (
            <>
              <div className="iv26-dossier-head">
                <div>
                  <h2 id="iv26-case-title">{inv.title}</h2>
                  <div className="iv26-dossier-tags"><StatusBadge status={inv.status} /><Tags tags={inv.tags} max={8} /></div>
                </div>
                <div className="iv26-dossier-actions">
                  <button type="button" className="iv26-btn" onClick={() => setEditing(true)}><PenLine size={14} aria-hidden="true" /> Modifier</button>
                  <button ref={addTrigger} type="button" className="iv26-btn is-primary" onClick={() => setAdding(true)}><ListPlus size={15} aria-hidden="true" /> Ajouter un événement</button>
                </div>
              </div>
              {inv.description
                ? <p className="iv26-desc-full">{inv.description}</p>
                : <p className="iv26-desc-full iv26-muted">Aucune description enregistrée.</p>}
              <Facts inv={inv} events={items} filtered={filtered} />
            </>
          )}
        </section>

        <section className="iv26-chrono" aria-labelledby="iv26-chrono-title">
          <div className="iv26-chrono-head">
            <h2 id="iv26-chrono-title">Chronologie</h2>
            <div className="iv26-chrono-tools">
              <label className="iv26-select">
                <span className="iv26-sr">Filtrer par type</span>
                <select value={filter.event_type ?? ''} onChange={e => setFilter(f => ({ ...f, event_type: (e.target.value as EventType) || '' }))}>
                  <option value="">Tous les types</option>
                  {EVENT_TYPES.map(t => <option key={t} value={t}>{EVENT_TYPE_LABEL[t]}</option>)}
                </select>
              </label>
              <label className="iv26-select">
                <span className="iv26-sr">Filtrer par sévérité</span>
                <select value={filter.severity ?? ''} onChange={e => setFilter(f => ({ ...f, severity: (e.target.value as EventSeverity) || '' }))}>
                  <option value="">Toutes sévérités</option>
                  {SEVERITIES.map(s => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
                </select>
              </label>
              <button type="button" className="iv26-btn" onClick={() => setFilter(f => ({ ...f, order: f.order === 'asc' ? 'desc' : 'asc' }))} aria-label={filter.order === 'asc' ? 'Ordre : plus anciens d’abord. Inverser' : 'Ordre : plus récents d’abord. Inverser'}>
                <ArrowDownUp size={14} aria-hidden="true" /> {filter.order === 'asc' ? 'Plus anciens d’abord' : 'Plus récents d’abord'}
              </button>
            </div>
          </div>

          {events.status === 'loading' && <div className="iv26-loading is-compact" role="status">Chargement de la chronologie…</div>}
          {events.status === 'error' && (
            <div className="iv26-state is-error" role="alert">
              <AlertCircle size={22} aria-hidden="true" />
              <h2>Chronologie indisponible</h2>
              <p>Les événements n’ont pas pu être chargés.</p>
              <button type="button" className="iv26-btn" onClick={() => setAttempt(n => n + 1)}><RefreshCw size={14} aria-hidden="true" /> Réessayer</button>
            </div>
          )}
          {events.status === 'ready' && items.length === 0 && (
            <div className="iv26-state">
              <h2>{filtered ? 'Aucun événement ne correspond' : 'Aucun événement'}</h2>
              <p>{filtered ? 'Modifiez le type ou la sévérité.' : 'Ajoutez les faits au fil de l’enquête : alertes, IOC, notes, décisions.'}</p>
              {filtered
                ? <button type="button" className="iv26-btn" onClick={() => setFilter(f => ({ order: f.order }))}>Effacer les filtres</button>
                : <button type="button" className="iv26-btn is-primary" onClick={() => setAdding(true)}><ListPlus size={15} aria-hidden="true" /> Ajouter le premier événement</button>}
            </div>
          )}
          {events.status === 'ready' && items.length > 0 && <Timeline events={items} onDelete={setToDelete} />}
        </section>
      </div>

      {adding && (
        <EventDialog
          investigationId={inv.id}
          onClose={() => { setAdding(false); addTrigger.current?.focus() }}
          onCreated={created => {
            setAdding(false)
            const matches = (!filter.event_type || created.event_type === filter.event_type) && (!filter.severity || created.severity === filter.severity)
            if (matches) setEvents(prev => prev.status === 'ready' ? { status: 'ready', items: [...prev.items, created].sort(byTime(filter.order ?? 'asc')) } : prev)
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Supprimer l’événement ?"
        message={toDelete ? `« ${toDelete.title} » sera retiré de la chronologie.` : ''}
        confirmLabel="Supprimer"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
