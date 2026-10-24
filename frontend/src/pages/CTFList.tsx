import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ctfApi } from '@/api/client'
import type { CTFWriteup, CTFFilter, CTFPlatform, CTFDifficulty } from '@/types'
import Pagination from '@/components/Pagination'
import { AlertTriangle, ChevronRight, Package, Plus, Search, Trophy, X } from 'lucide-react'
import { toast } from '@/store/toast'
import CtfHero from '@/ctf26/CtfHero'
import {
  DIFFICULTIES, DIFF_LABEL, DifficultyMark, PLATFORMS, PlatformMark, StatusMark, diffOf, platformOf,
} from '@/ctf26/parts'
import '@/ctf26/ctf.css'

const LIMIT = 15

export default function CTFList() {
  const [writeups, setWriteups] = useState<CTFWriteup[]>([])
  const [count, setCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState(false)
  const [filters, setFilters] = useState<CTFFilter>({ platform: '', difficulty: '', search: '' })

  const fetchCTF = useCallback(async () => {
    setLoading(true)
    setListError(false)
    try {
      const res = await ctfApi.list({ ...filters, page, limit: LIMIT } as CTFFilter & { page: number; limit: number })
      setWriteups(res.writeups ?? [])
      setCount(Number(res.count))
      setTotalPages((res as { total_pages?: number }).total_pages ?? 1)
    } catch {
      setListError(true)
      toast.error('Impossible de charger les writeups')
      setWriteups([])
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  useEffect(() => { fetchCTF() }, [fetchCTF])

  const updateFilter = <K extends keyof CTFFilter>(k: K, v: CTFFilter[K]) => {
    setPage(1)
    setFilters(f => ({ ...f, [k]: v }))
  }

  const clearFilters = () => {
    setPage(1)
    setFilters({ platform: '', difficulty: '', search: '' })
  }

  const hasActiveFilters = Boolean(filters.platform || filters.difficulty || filters.search)
  // completed is derived from the current page only; the list API gives no global figure.
  const completedOnPage = writeups.filter(w => w.completed).length

  const status = loading ? { text: 'CHARGEMENT', tone: 'busy' as const }
    : listError ? { text: 'INDEX INDISPONIBLE', tone: 'warn' as const }
    : { text: `${count.toLocaleString('fr-FR')} WRITEUP${count > 1 ? 'S' : ''}`, mark: hasActiveFilters ? 'FILTRÉS' : 'AU JOURNAL' }

  return (
    <div className="ct26">
      <div className="ct26-frame">
        <CtfHero status={status} />

        <section className="ct26-console" aria-label="Recherche et filtres">
          <div className="ct26-console-top">
            <label className="ct26-search">
              <Search size={18} aria-hidden="true" />
              <span className="ct26-sr">Rechercher un writeup</span>
              <input
                type="search"
                value={filters.search ?? ''}
                onChange={e => updateFilter('search', e.target.value)}
                placeholder="Rechercher un writeup, machine, tag…"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <div className="ct26-actions">
              <Link to="/ctf/new" className="ct26-btn is-primary">
                <Plus size={15} aria-hidden="true" /> Nouveau writeup
              </Link>
            </div>
          </div>

          <div className="ct26-filters">
            <label className="ct26-select">
              <span>Plateforme</span>
              <select value={filters.platform ?? ''} onChange={e => updateFilter('platform', e.target.value as CTFPlatform | '')}>
                <option value="">Toutes les plateformes</option>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="ct26-select">
              <span>Difficulté</span>
              <select value={filters.difficulty ?? ''} onChange={e => updateFilter('difficulty', e.target.value as CTFDifficulty | '')}>
                <option value="">Toutes les difficultés</option>
                {DIFFICULTIES.map(d => <option key={d} value={d}>{DIFF_LABEL[d]}</option>)}
              </select>
            </label>
            {hasActiveFilters && (
              <button type="button" className="ct26-link" onClick={clearFilters}>
                <X size={13} aria-hidden="true" /> Effacer les filtres
              </button>
            )}
          </div>
        </section>

        {loading ? (
          <div className="ct26-register" aria-busy="true">
            <p className="ct26-sr" role="status">Chargement des writeups…</p>
            <div className="ct26-skeleton" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <div key={i} />)}</div>
          </div>
        ) : listError ? (
          <div className="ct26-state is-error" role="alert">
            <AlertTriangle size={30} aria-hidden="true" />
            <h2>Impossible de charger les writeups</h2>
            <p>Le journal n'a pas répondu. Les filtres sont conservés.</p>
            <button type="button" className="ct26-btn" onClick={fetchCTF}>Réessayer</button>
          </div>
        ) : writeups.length === 0 ? (
          <div className="ct26-state">
            <Trophy size={30} aria-hidden="true" />
            <h2>Aucun writeup trouvé</h2>
            <p>
              {hasActiveFilters ? 'Modifie tes filtres ou ' : ''}
              <Link to="/ctf/new" className="ct26-link">crée le premier writeup</Link>
            </p>
          </div>
        ) : (
          <section className="ct26-register" aria-labelledby="ct26-register-title">
            <header className="ct26-register-head">
              <h2 id="ct26-register-title">Registre d'opérations</h2>
              <p>
                <b>{count.toLocaleString('fr-FR')}</b> writeup{count > 1 ? 's' : ''}
                {totalPages > 1 && <> · page {page} / {totalPages}</>}
                <span className="ct26-page-note"> · {completedOnPage} terminé{completedOnPage > 1 ? 's' : ''} sur cette page</span>
              </p>
            </header>
            <ul className="ct26-entries">
              {writeups.map(w => {
                const diff = diffOf(w.difficulty)
                const tags = (w.tags ?? '').split(',').map(t => t.trim()).filter(Boolean)
                return (
                  <li key={w.id} className="ct26-entry" data-diff={diff} data-done={w.completed}>
                    <span className="ct26-entry-rail" aria-hidden="true" />
                    <div className="ct26-entry-main">
                      <div className="ct26-entry-top">
                        <PlatformMark platform={platformOf(w.platform)} />
                        <StatusMark completed={w.completed} />
                      </div>
                      <h3 className="ct26-entry-title">
                        <Link to={`/ctf/${w.id}`}>{w.title}</Link>
                      </h3>
                      <p className="ct26-entry-meta">
                        {w.machine_name && <span className="ct26-machine"><Package size={13} aria-hidden="true" />{w.machine_name}</span>}
                        {w.category && <span className="ct26-category">{w.category}</span>}
                      </p>
                      <div className="ct26-entry-foot">
                        <DifficultyMark difficulty={diff} />
                        {tags.length > 0 && (
                          <ul className="ct26-tags" aria-label="Tags">
                            {tags.slice(0, 3).map(t => <li key={t}>{t}</li>)}
                            {tags.length > 3 && <li className="is-more">+{tags.length - 3}</li>}
                          </ul>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="ct26-entry-go" size={16} aria-hidden="true" />
                  </li>
                )
              })}
            </ul>
            {totalPages > 1 && (
              <nav className="ct26-register-foot" aria-label="Pagination">
                <Pagination page={page} totalPages={totalPages} onPage={setPage} />
              </nav>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
