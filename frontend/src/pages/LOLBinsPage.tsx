import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { AlertTriangle, ChevronRight, FolderTree, Search, Terminal, X } from 'lucide-react'
import { lolbinsApi } from '@/api/client'
import type { LOLBin, LOLBinsResponse, LOLBinCategory } from '@/types/lolbins'
import { toast } from '@/store/toast'
import LolbinsHero from '@/lolbins26/LolbinsHero'
import { CommandCard, OsMark, parseCommands, parseMitre, parseTags } from '@/lolbins26/parts'
import '@/lolbins26/lolbins.css'

const OSES: LOLBin['os'][] = ['windows', 'linux']
const OS_TAB_LABEL: Record<LOLBin['os'], string> = { windows: 'Windows (LOLBAS)', linux: 'Linux (GTFOBins)' }

/*
 * Analysis panel. Not a routed page: a side panel driven by the already loaded
 * list item (JSON fields parsed with a safe fallback). It opens below the
 * global topbar so its header and close stay visible, closes on Escape / scrim
 * / button, locks page scroll while open and returns focus on close. A strict
 * focus trap is left for Codex (noted in the report).
 */
function LolbinPanel({ item, onClose }: { item: LOLBin; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const mitre = useMemo(() => parseMitre(item.mitre_tech), [item.mitre_tech])
  const commands = useMemo(() => parseCommands(item.commands), [item.commands])
  const tags = useMemo(() => parseTags(item.tags), [item.tags])

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      opener?.focus?.()
    }
  }, [onClose])

  const titleId = 'lb26-panel-title'
  return (
    <div className="lb26-panel-layer">
      <div className="lb26-panel-scrim" onClick={onClose} aria-hidden="true" />
      <div className="lb26-panel" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={panelRef} data-os={item.os}>
        <header className="lb26-panel-head">
          <div className="lb26-panel-id">
            <div className="lb26-panel-top">
              <OsMark os={item.os} long />
              {item.category && <span className="lb26-cat-chip">{item.category}</span>}
            </div>
            <h2 id={titleId}>{item.name}</h2>
          </div>
          <button type="button" className="lb26-icon-btn" onClick={onClose} aria-label="Fermer le panneau">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="lb26-panel-body">
          {item.full_path && (
            <section className="lb26-field">
              <h3>Chemin complet</h3>
              <pre className="lb26-path" tabIndex={0}><code>{item.full_path}</code></pre>
            </section>
          )}
          {item.description && (
            <section className="lb26-field">
              <h3>Description</h3>
              <p className="lb26-desc">{item.description}</p>
            </section>
          )}
          {mitre.length > 0 && (
            <section className="lb26-field">
              <h3>Techniques MITRE ATT&amp;CK</h3>
              <ul className="lb26-mitre" aria-label="Techniques MITRE ATT&CK">
                {mitre.map(t => <li key={t}>{t}</li>)}
              </ul>
            </section>
          )}
          {tags.length > 0 && (
            <section className="lb26-field">
              <h3>Tags</h3>
              <ul className="lb26-tags" aria-label="Tags">{tags.map(t => <li key={t}>{t}</li>)}</ul>
            </section>
          )}
          <section className="lb26-field">
            <h3>Commandes d'abus <small>{commands.length}</small></h3>
            {commands.length > 0
              ? <div className="lb26-cmds">{commands.map((cmd, i) => <CommandCard key={i} cmd={cmd} index={i} />)}</div>
              : <p className="lb26-empty-inline">Aucune commande renseignée pour ce binaire.</p>}
          </section>
        </div>
      </div>
    </div>
  )
}

export default function LOLBinsPage() {
  const [data, setData] = useState<LOLBinsResponse | null>(null)
  const [categories, setCategories] = useState<LOLBinCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState(false)
  const [selected, setSelected] = useState<LOLBin | null>(null)

  const [activeOS, setActiveOS] = useState<LOLBin['os']>('windows')
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('')
  const [mitreFilter, setMitreFilter] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setListError(false)
    try {
      const result = await lolbinsApi.list({
        os: activeOS,
        search: search || undefined,
        category: activeCategory || undefined,
        mitre: mitreFilter || undefined,
      })
      setData(result)
    } catch {
      setListError(true)
      toast.error('Erreur de chargement des LOLBins')
    } finally {
      setLoading(false)
    }
  }, [activeOS, search, activeCategory, mitreFilter])

  useEffect(() => {
    lolbinsApi.getCategories().then(setCategories).catch(() => {})
  }, [])

  useEffect(() => {
    const t = setTimeout(fetchData, 300)
    return () => clearTimeout(t)
  }, [fetchData])

  const osCategories = useMemo(() => categories.filter(c => c.os === activeOS), [categories, activeOS])
  const hasActiveFilters = Boolean(search.trim() || activeCategory || mitreFilter.trim())
  const items = data?.items ?? []

  const switchOS = (os: LOLBin['os']) => {
    setActiveOS(os); setActiveCategory(''); setSelected(null)
  }
  const resetFilters = () => { setSearch(''); setActiveCategory(''); setMitreFilter('') }

  // One clean status string (strong + span collide when the OS split is wide).
  const winTotal = data?.win_count ?? 0
  const linTotal = data?.linux_count ?? 0
  const status = loading ? { text: 'ANALYSE', tone: 'busy' as const }
    : listError ? { text: 'CATALOGUE INDISPONIBLE', tone: 'warn' as const }
    : { text: `${winTotal + linTotal} BINAIRES · WIN ${winTotal} · LIN ${linTotal}` }

  // The response may return a page of a larger set: say so rather than contradict the tab.
  const shownCount = items.length
  const totalCount = Number(data?.total ?? shownCount)
  const isPartial = totalCount > shownCount

  return (
    <div className="lb26">
      <div className="lb26-frame">
        <LolbinsHero status={status} />

        <section className="lb26-console" aria-label="Filtres du catalogue">
          <div className="lb26-ostabs" role="tablist" aria-label="Système">
            {OSES.map(os => (
              <button key={os} type="button" role="tab" aria-selected={activeOS === os} data-os={os}
                className="lb26-ostab" onClick={() => switchOS(os)}>
                <Terminal size={14} aria-hidden="true" />{OS_TAB_LABEL[os]}
                <span className="lb26-ostab-count">{os === 'windows' ? data?.win_count ?? 0 : data?.linux_count ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="lb26-controls">
            <label className="lb26-search">
              <Search size={18} aria-hidden="true" />
              <span className="lb26-sr">Rechercher un binaire</span>
              <input type="search" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un binaire, une description…" autoComplete="off" spellCheck={false} />
            </label>
            <label className="lb26-mitre-field">
              <span className="lb26-sr">Filtrer par technique MITRE</span>
              <input type="search" value={mitreFilter} onChange={e => setMitreFilter(e.target.value)}
                placeholder="MITRE (ex : T1105)" autoComplete="off" spellCheck={false} />
            </label>
            <label className="lb26-cat-select">
              <span className="lb26-sr">Catégorie</span>
              <select value={activeCategory} onChange={e => setActiveCategory(e.target.value)} aria-label="Catégorie">
                <option value="">Toutes les catégories</option>
                {osCategories.map(c => <option key={c.category} value={c.category}>{c.category} ({c.count})</option>)}
              </select>
            </label>
            {hasActiveFilters && (
              <button type="button" className="lb26-link" onClick={resetFilters}>
                <X size={13} aria-hidden="true" /> Réinitialiser
              </button>
            )}
          </div>
        </section>

        {loading ? (
          <div className="lb26-register" aria-busy="true">
            <p className="lb26-sr" role="status">Chargement du catalogue…</p>
            <div className="lb26-skeleton" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <div key={i} />)}</div>
          </div>
        ) : listError ? (
          <div className="lb26-state is-error" role="alert">
            <AlertTriangle size={30} aria-hidden="true" />
            <h2>Impossible de charger le catalogue</h2>
            <p>Les binaires n'ont pas répondu. Réessaie dans un instant.</p>
            <button type="button" className="lb26-btn" onClick={fetchData}>Réessayer</button>
          </div>
        ) : items.length === 0 ? (
          <div className="lb26-state">
            <FolderTree size={30} aria-hidden="true" />
            <h2>Aucun binaire trouvé</h2>
            <p>{hasActiveFilters ? 'Aucun binaire ne correspond à ces filtres.' : 'Ce catalogue est vide.'}</p>
            {hasActiveFilters && <button type="button" className="lb26-btn" onClick={resetFilters}>Réinitialiser les filtres</button>}
          </div>
        ) : (
          <section className="lb26-register" aria-labelledby="lb26-register-title">
            <header className="lb26-register-head">
              <h2 id="lb26-register-title">Catalogue {activeOS === 'windows' ? 'Windows' : 'Linux'}</h2>
              <p>
                {isPartial
                  ? <><b>{shownCount.toLocaleString('fr-FR')}</b> affiché{shownCount > 1 ? 's' : ''} sur {totalCount.toLocaleString('fr-FR')}</>
                  : <><b>{totalCount.toLocaleString('fr-FR')}</b> binaire{totalCount > 1 ? 's' : ''}</>}
                {hasActiveFilters && ' (filtré)'}
              </p>
            </header>
            <ul className="lb26-entries">
              {items.map(item => {
                const nbCmd = parseCommands(item.commands).length
                const mitre = parseMitre(item.mitre_tech)
                const open = selected?.id === item.id
                return (
                  <li key={item.id} className="lb26-entry" data-os={item.os}>
                    <button type="button" className="lb26-entry-btn" aria-expanded={open}
                      onClick={() => setSelected(open ? null : item)}>
                      <span className="lb26-entry-rail" aria-hidden="true" />
                      <span className="lb26-entry-main">
                        <span className="lb26-entry-top">
                          <span className="lb26-entry-name">{item.name}</span>
                          <OsMark os={item.os} />
                        </span>
                        {item.description && <span className="lb26-entry-desc">{item.description}</span>}
                        <span className="lb26-entry-foot">
                          {item.category && <span className="lb26-cat-chip">{item.category}</span>}
                          <span className="lb26-entry-metrics">
                            <span className="lb26-metric">{nbCmd} cmd{nbCmd > 1 ? 's' : ''}</span>
                            {mitre.length > 0 && (
                              <span className="lb26-metric is-mitre">{mitre[0]}{mitre.length > 1 ? ` +${mitre.length - 1}` : ''}</span>
                            )}
                          </span>
                        </span>
                      </span>
                      <ChevronRight className="lb26-entry-go" size={16} aria-hidden="true" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </div>

      {selected && <LolbinPanel item={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
