import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { FolderSearch, Plus, Search, Trash2, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react'
import { investigationApi } from '@/api/client'
import type { Investigation, InvestigationStatus } from '@/types/investigation'
import { toast } from '@/store/toast'
import InvHero from '@/inv26/InvHero'
import { STATUSES, STATUS_LABEL, StatusBadge, Tags, formatDay } from '@/inv26/parts'
import CreateInvestigationDialog from '@/inv26/CreateInvestigationDialog'
import ConfirmDialog from '@/inv26/ConfirmDialog'
import '@/inv26/inv.css'

const PAGE_SIZE = 50
const SEARCH_DELAY = 300

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready' }

/*
 * The case list. Counts come from the API's `total` for the current filter;
 * there is no per-status total in the API, so the filter shows none.
 */
export default function InvestigationList() {
  const [items, setItems] = useState<Investigation[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [loadingMore, setLoadingMore] = useState(false)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<InvestigationStatus | ''>('')
  const [showCreate, setShowCreate] = useState(false)
  const [toDelete, setToDelete] = useState<Investigation | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const sequence = useRef(0)
  const createTrigger = useRef<HTMLButtonElement>(null)

  // The search is sent once typing pauses.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), SEARCH_DELAY)
    return () => clearTimeout(timer)
  }, [query])

  // A new filter replaces the list; an answer to an older request is ignored.
  useEffect(() => {
    const request = ++sequence.current
    setLoad({ status: 'loading' })
    investigationApi.list({ status: statusFilter || undefined, q: search || undefined, page: 1, limit: PAGE_SIZE })
      .then(r => {
        if (request !== sequence.current) return
        setItems(r.items ?? [])
        setTotal(r.total ?? 0)
        setPage(1)
        setLoad({ status: 'ready' })
      })
      .catch(() => { if (request === sequence.current) setLoad({ status: 'error' }) })
  }, [statusFilter, search, attempt])

  const loadMore = async () => {
    const request = sequence.current
    setLoadingMore(true)
    try {
      const r = await investigationApi.list({ status: statusFilter || undefined, q: search || undefined, page: page + 1, limit: PAGE_SIZE })
      if (request !== sequence.current) return
      setItems(prev => {
        const known = new Set(prev.map(i => i.id))
        return [...prev, ...(r.items ?? []).filter(i => !known.has(i.id))]
      })
      setTotal(r.total ?? total)
      setPage(p => p + 1)
    } catch {
      if (request === sequence.current) toast.error('Impossible de charger les dossiers suivants')
    } finally {
      if (request === sequence.current) setLoadingMore(false)
    }
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      await investigationApi.delete(toDelete.id)
      toast.success('Investigation supprimée')
      setToDelete(null)
      setAttempt(n => n + 1)
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setDeleting(false)
    }
  }

  const filtered = Boolean(statusFilter || search)
  const heroStatus = load.status === 'error'
    ? { text: 'DONNÉES INDISPONIBLES', tone: 'warn' as const }
    : load.status === 'ready' && !filtered
      ? { text: `${total} DOSSIER${total > 1 ? 'S' : ''}`, mark: 'BASE LOCALE' }
      : undefined

  return (
    <div className="iv26">
      <div className="iv26-frame">
        <InvHero status={heroStatus} />

        <section className="iv26-console" aria-label="Recherche et filtres">
          <div className="iv26-console-top">
            <div className="iv26-search">
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Titre, description ou tag…"
                aria-label="Rechercher une investigation"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <button ref={createTrigger} type="button" className="iv26-btn is-primary" onClick={() => setShowCreate(true)}>
              <Plus size={15} aria-hidden="true" /> NOUVELLE INVESTIGATION
            </button>
          </div>
          <div className="iv26-console-bottom">
            <div className="iv26-seg" role="group" aria-label="Filtrer par statut">
              <button type="button" aria-pressed={statusFilter === ''} onClick={() => setStatusFilter('')}>Toutes</button>
              {STATUSES.map(s => (
                <button key={s} type="button" data-status={s} aria-pressed={statusFilter === s} onClick={() => setStatusFilter(s)}>
                  <i aria-hidden="true" />{STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            {load.status === 'ready' && (
              <p className="iv26-result" aria-live="polite">
                <b>{total}</b> dossier{total > 1 ? 's' : ''}{filtered ? ' correspondant' + (total > 1 ? 's' : '') : ''}
                {items.length < total ? ` · ${items.length} affiché${items.length > 1 ? 's' : ''}` : ''}
              </p>
            )}
          </div>
        </section>

        {load.status === 'loading' && (
          <div className="iv26-board" role="status" aria-label="Chargement des investigations">
            <div className="iv26-skeleton" aria-hidden="true">{[0, 1, 2, 3].map(i => <div key={i} />)}</div>
          </div>
        )}

        {load.status === 'error' && (
          <div className="iv26-state is-error" role="alert">
            <AlertCircle size={26} aria-hidden="true" />
            <h2>Impossible de charger les investigations</h2>
            <p>Le backend n’a pas répondu. La liste n’est pas vide pour autant : réessayez.</p>
            <button type="button" className="iv26-btn" onClick={() => setAttempt(n => n + 1)}><RefreshCw size={14} aria-hidden="true" /> Réessayer</button>
          </div>
        )}

        {load.status === 'ready' && items.length === 0 && (
          <div className="iv26-state">
            <FolderSearch size={28} aria-hidden="true" />
            <h2>{filtered ? 'Aucune investigation ne correspond' : 'Aucune investigation'}</h2>
            <p>{filtered ? 'Modifiez la recherche ou le filtre de statut.' : 'Ouvrez un dossier pour rassembler la chronologie, les sources et les preuves d’une enquête.'}</p>
            {filtered
              ? <button type="button" className="iv26-btn" onClick={() => { setQuery(''); setSearch(''); setStatusFilter('') }}>Effacer les filtres</button>
              : <button type="button" className="iv26-btn is-primary" onClick={() => setShowCreate(true)}><Plus size={15} aria-hidden="true" /> Créer la première investigation</button>}
          </div>
        )}

        {load.status === 'ready' && items.length > 0 && (
          <section className="iv26-board" aria-label="Investigations">
            <div className="iv26-board-head" aria-hidden="true">
              <span /><span>Dossier</span><span>Statut</span><span>Tags</span><span>Ouvert le</span><span>Mis à jour</span><span>Actions</span>
            </div>
            <ul className="iv26-list" role="list">
              {items.map(inv => (
                <li key={inv.id} className="iv26-row" data-status={inv.status}>
                  <span className="iv26-rail" aria-hidden="true" />
                  <div className="iv26-case">
                    <Link to={`/investigations/${inv.id}`} className="iv26-case-title">{inv.title}</Link>
                    {inv.description
                      ? <span className="iv26-case-desc">{inv.description}</span>
                      : <span className="iv26-case-desc iv26-muted">Sans description</span>}
                  </div>
                  <div className="iv26-status-cell"><StatusBadge status={inv.status} /></div>
                  <div className="iv26-tags-cell"><Tags tags={inv.tags} /></div>
                  <span className="iv26-date iv26-created"><span className="iv26-sr">Ouvert le </span>{formatDay(inv.created_at)}</span>
                  <span className="iv26-date iv26-updated"><span className="iv26-sr">Mis à jour le </span>{formatDay(inv.updated_at)}</span>
                  <div className="iv26-row-actions">
                    <Link to={`/investigations/${inv.id}`} className="iv26-icon-btn" aria-label={`Ouvrir ${inv.title}`} title="Ouvrir"><ChevronRight size={16} /></Link>
                    <button type="button" className="iv26-icon-btn is-danger" aria-label={`Supprimer ${inv.title}`} title="Supprimer" onClick={() => setToDelete(inv)}><Trash2 size={15} /></button>
                  </div>
                </li>
              ))}
            </ul>
            {items.length < total && (
              <div className="iv26-board-foot">
                <span className="iv26-result">{items.length} sur {total}</span>
                <button type="button" className="iv26-btn" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Chargement…' : `Charger ${Math.min(PAGE_SIZE, total - items.length)} de plus`}
                </button>
              </div>
            )}
          </section>
        )}
      </div>

      {showCreate && (
        <CreateInvestigationDialog
          onClose={() => { setShowCreate(false); createTrigger.current?.focus() }}
          onCreated={() => { setShowCreate(false); setAttempt(n => n + 1) }}
        />
      )}
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Supprimer l’investigation ?"
        message={toDelete ? `« ${toDelete.title} » et tous ses événements seront supprimés définitivement.` : ''}
        confirmLabel="Supprimer"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
