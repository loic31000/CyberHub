import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Plus, Search, AlertCircle, RefreshCw, ArrowRight, X } from 'lucide-react'
import { playbookApi } from '@/api/client'
import type { Playbook } from '@/types'
import PbHero from '@/pb26/PbHero'
import ScenarioPicker from '@/pb26/ScenarioPicker'
import { PROGRESS_LABEL, ProgressBadge, ProgressMeter, matchesQuery, progressOf, scenarioLabel, formatDay, type ProgressState } from '@/pb26/parts'
import '@/pb26/pb.css'

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready' }
type ProgressFilter = '' | Exclude<ProgressState, 'empty'>

const PROGRESS_FILTERS: ProgressFilter[] = ['', 'todo', 'active', 'done']

/*
 * The playbook index. The API returns every playbook in one call when no page
 * is asked for, and there are a few dozen at most, so search and filters run
 * here on the full set: counts are exact, never limited to one page.
 */
export default function PlaybookList() {
  const [items, setItems] = useState<Playbook[]>([])
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [query, setQuery] = useState('')
  const [scenario, setScenario] = useState('')
  const [progress, setProgress] = useState<ProgressFilter>('')
  const [attempt, setAttempt] = useState(0)
  const sequence = useRef(0)

  // A retry replaces the list; an answer to an older request is ignored.
  useEffect(() => {
    const request = ++sequence.current
    setLoad({ status: 'loading' })
    playbookApi.list()
      .then(r => {
        if (request !== sequence.current) return
        setItems(r.playbooks ?? [])
        setLoad({ status: 'ready' })
      })
      .catch(() => { if (request === sequence.current) setLoad({ status: 'error' }) })
  }, [attempt])

  // Scenarios offered as filters are the ones present, most used first.
  const scenarios = useMemo(() => {
    const counts = new Map<string, number>()
    for (const pb of items) if (pb.scenario) counts.set(pb.scenario, (counts.get(pb.scenario) ?? 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1] || scenarioLabel(a[0]).localeCompare(scenarioLabel(b[0]), 'fr'))
  }, [items])

  const visible = useMemo(() => items.filter(pb =>
    (!scenario || pb.scenario === scenario)
    && (!progress || progressOf(pb.steps).state === progress)
    && matchesQuery(pb, query)
  ), [items, scenario, progress, query])

  const totals = useMemo(() => {
    const t = { steps: 0, done: 0, active: 0, finished: 0 }
    for (const pb of items) {
      const p = progressOf(pb.steps)
      t.steps += p.total; t.done += p.done
      if (p.state === 'active') t.active++
      if (p.state === 'done') t.finished++
    }
    return t
  }, [items])

  const filtered = Boolean(scenario || progress || query.trim())
  const clearFilters = () => { setQuery(''); setScenario(''); setProgress('') }
  const heroStatus = load.status === 'error'
    ? { text: 'DONNÉES INDISPONIBLES', tone: 'warn' as const }
    : load.status === 'ready'
      ? { text: `${items.length} PLAYBOOK${items.length > 1 ? 'S' : ''}`, mark: totals.active ? `${totals.active} EN COURS` : 'BASE LOCALE' }
      : undefined

  return (
    <div className="pb26">
      <div className="pb26-frame" data-layout="list">
        <PbHero status={heroStatus} />

        <section className="pb26-toolbar" aria-label="Recherche et filtres">
          <div className="pb26-toolbar-main">
            <div className="pb26-search">
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Rechercher un playbook, une étape…"
                aria-label="Rechercher un playbook"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <Link to="/playbooks/new" className="pb26-btn is-primary"><Plus size={16} aria-hidden="true" /> Nouveau playbook</Link>
          </div>

          <div className="pb26-toolbar-filters">
            <div className="pb26-seg" role="group" aria-label="Progression">
              {PROGRESS_FILTERS.map(p => (
                <button key={p || 'all'} type="button" data-progress={p || undefined} aria-pressed={progress === p} onClick={() => setProgress(p)}>
                  {p && <i aria-hidden="true" />}{p ? PROGRESS_LABEL[p] : 'Tous'}
                </button>
              ))}
            </div>
            {scenarios.length > 0 && <ScenarioPicker options={scenarios} total={items.length} value={scenario} onChange={setScenario} />}
            {load.status === 'ready' && (
              <p className="pb26-result" aria-live="polite">
                <b>{visible.length}</b> playbook{visible.length > 1 ? 's' : ''}
                {filtered ? ` sur ${items.length}` : ''}
                {filtered && <button type="button" className="pb26-text-btn" onClick={clearFilters}><X size={13} aria-hidden="true" />Réinitialiser</button>}
              </p>
            )}
          </div>
        </section>

        {load.status === 'ready' && items.length > 0 && (
          <dl className="pb26-summary" aria-label="Synthèse">
            <div><dt>Étapes validées</dt><dd>{totals.done}<small> / {totals.steps}</small></dd></div>
            <div><dt>En cours</dt><dd>{totals.active}</dd></div>
            <div><dt>Terminés</dt><dd>{totals.finished}</dd></div>
          </dl>
        )}

        {load.status === 'loading' && (
          <div className="pb26-grid" role="status" aria-label="Chargement des playbooks">
            {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="pb26-card is-skeleton" aria-hidden="true" />)}
          </div>
        )}

        {load.status === 'error' && (
          <div className="pb26-state is-error" role="alert">
            <AlertCircle size={26} aria-hidden="true" />
            <h2>Impossible de charger les playbooks</h2>
            <p>Le backend n’a pas répondu. Les playbooks ne sont pas perdus pour autant : réessayez.</p>
            <button type="button" className="pb26-btn" onClick={() => setAttempt(n => n + 1)}><RefreshCw size={14} aria-hidden="true" /> Réessayer</button>
          </div>
        )}

        {load.status === 'ready' && visible.length === 0 && (
          <div className="pb26-state">
            <BookOpen size={28} aria-hidden="true" />
            <h2>{filtered ? 'Aucun playbook ne correspond' : 'Aucun playbook'}</h2>
            <p>{filtered ? 'Modifiez la recherche ou les filtres.' : 'Rédigez une première procédure : un scénario, puis les étapes à suivre pendant l’incident.'}</p>
            {filtered
              ? <button type="button" className="pb26-btn" onClick={clearFilters}>Effacer les filtres</button>
              : <Link to="/playbooks/new" className="pb26-btn is-primary"><Plus size={15} aria-hidden="true" /> Créer le premier playbook</Link>}
          </div>
        )}

        {load.status === 'ready' && visible.length > 0 && (
          <ul className="pb26-grid" aria-label="Playbooks">
            {visible.map(pb => {
              const p = progressOf(pb.steps)
              return (
                <li key={pb.id} className="pb26-card" data-progress={p.state}>
                  <div className="pb26-card-top">
                    <span className="pb26-kicker">{scenarioLabel(pb.scenario)}</span>
                    <ProgressBadge state={p.state} />
                  </div>
                  <h2 className="pb26-card-title">
                    <Link to={`/playbooks/${pb.id}`}>{pb.title}</Link>
                  </h2>
                  {pb.description
                    ? <p className="pb26-card-desc">{pb.description}</p>
                    : <p className="pb26-card-desc pb26-muted">Sans description</p>}
                  <div className="pb26-card-progress">
                    <div className="pb26-card-figures">
                      <span>{p.done}/{p.total} étape{p.total > 1 ? 's' : ''}</span>
                      <b>{p.pct}%</b>
                    </div>
                    <ProgressMeter progress={p} />
                  </div>
                  <div className="pb26-card-foot">
                    <span>Mis à jour le {formatDay(pb.updated_at)}</span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
