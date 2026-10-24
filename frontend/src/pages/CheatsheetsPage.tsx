import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { AlertTriangle, ChevronRight, Loader2, Search, Terminal, X } from 'lucide-react'
import { cheatsheetsApi } from '@/api/client'
import type { CheatsheetSummary, Cheatsheet } from '@/types/cheatsheet'
import { toast } from '@/store/toast'
import CheatsheetsHero from '@/cheatsheets26/CheatsheetsHero'
import { CommandCard } from '@/cheatsheets26/parts'
import '@/cheatsheets26/cheatsheets.css'

/* Preferred display order; any category present in the data but not listed is appended. */
const CATEGORY_ORDER = [
  'Reconnaissance', 'Exploitation', 'Post-Exploitation', 'Pentest', 'OSINT', 'Web',
  'Réseau', 'Linux', 'Windows', 'DevOps', 'Hash / Encodage', 'Cracking', 'Forensic',
]

interface DrawerProps {
  cheatsheet: Cheatsheet
  onClose: () => void
}

/*
 * Command workspace panel. Not a routed page: a side panel with an obvious
 * close, Escape-to-close, and page scroll locked while open. A full focus
 * trap is left for Codex (noted in the report); initial focus and focus
 * return are handled here.
 */
function CheatsheetDrawer({ cheatsheet, onClose }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    // Focus the panel so Escape and tabbing start inside it.
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      opener?.focus?.()
    }
  }, [onClose])

  const titleId = 'cs26-drawer-title'
  return (
    <div className="cs26-drawer-layer">
      <div className="cs26-drawer-scrim" onClick={onClose} aria-hidden="true" />
      <div className="cs26-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={panelRef}>
        <header className="cs26-drawer-head">
          <div className="cs26-drawer-id">
            <p className="cs26-drawer-kicker">{cheatsheet.category}</p>
            <h2 id={titleId}>{cheatsheet.tool}</h2>
            {cheatsheet.description && <p className="cs26-drawer-desc">{cheatsheet.description}</p>}
          </div>
          <button type="button" className="cs26-icon-btn" onClick={onClose} aria-label="Fermer le panneau">
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="cs26-drawer-body">
          <p className="cs26-drawer-count">{cheatsheet.commands.length} commande{cheatsheet.commands.length > 1 ? 's' : ''}</p>
          {cheatsheet.commands.map((cmd, i) => <CommandCard key={i} cmd={cmd} index={i} />)}
        </div>
      </div>
    </div>
  )
}

export default function CheatsheetsPage() {
  const [summaries, setSummaries] = useState<CheatsheetSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState(false)
  const [category, setCategory] = useState('Tous')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Cheatsheet | null>(null)
  const [loadingTool, setLoadingTool] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setListError(false)
    try {
      const res = await cheatsheetsApi.list()
      setSummaries(res.cheatsheets ?? [])
      setTotal(Number(res.total ?? res.cheatsheets?.length ?? 0))
    } catch {
      setListError(true)
      toast.error('Impossible de charger les cheatsheets')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openDetail = async (tool: string) => {
    setLoadingTool(tool)
    try {
      const cs = await cheatsheetsApi.getByTool(tool)
      setSelected(cs)
    } catch {
      toast.error('Cheatsheet introuvable')
    } finally {
      setLoadingTool(null)
    }
  }

  // Categories actually present in the data, in the preferred order.
  const categories = useMemo(() => {
    const present = new Set(summaries.map(s => s.category).filter(Boolean))
    const ordered = CATEGORY_ORDER.filter(c => present.has(c))
    const extra = [...present].filter(c => !CATEGORY_ORDER.includes(c)).sort()
    return ['Tous', ...ordered, ...extra]
  }, [summaries])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return summaries.filter(s => {
      const matchCat = category === 'Tous' || s.category === category
      const matchSearch = !q || s.tool.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
      return matchCat && matchSearch
    })
  }, [summaries, category, search])

  const hasActiveFilters = Boolean(search.trim() || category !== 'Tous')
  const status = loading ? { text: 'CHARGEMENT', tone: 'busy' as const }
    : listError ? { text: 'BIBLIOTHÈQUE INDISPONIBLE', tone: 'warn' as const }
    : { text: `${total.toLocaleString('fr-FR')} RÉFÉRENCE${total > 1 ? 'S' : ''}`, mark: 'LOCAL' }

  return (
    <div className="cs26">
      <div className="cs26-frame">
        <CheatsheetsHero status={status} />

        <section className="cs26-console" aria-label="Recherche et catégories">
          <label className="cs26-search">
            <Search size={18} aria-hidden="true" />
            <span className="cs26-sr">Rechercher un outil</span>
            <input
              type="search" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un outil, une description…" autoComplete="off" spellCheck={false}
            />
          </label>
          <label className="cs26-cat-select">
            <span className="cs26-sr">Catégorie</span>
            <select value={category} onChange={e => setCategory(e.target.value)} aria-label="Catégorie">
              {categories.map(c => <option key={c} value={c}>{c === 'Tous' ? 'Toutes les catégories' : c}</option>)}
            </select>
          </label>
          {hasActiveFilters && (
            <button type="button" className="cs26-link" onClick={() => { setSearch(''); setCategory('Tous') }}>
              <X size={13} aria-hidden="true" /> Réinitialiser
            </button>
          )}
        </section>

        {loading ? (
          <div className="cs26-register" aria-busy="true">
            <p className="cs26-sr" role="status">Chargement des cheatsheets…</p>
            <div className="cs26-skeleton" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <div key={i} />)}</div>
          </div>
        ) : listError ? (
          <div className="cs26-state is-error" role="alert">
            <AlertTriangle size={30} aria-hidden="true" />
            <h2>Impossible de charger la bibliothèque</h2>
            <p>Les cheatsheets n'ont pas répondu. Réessaie dans un instant.</p>
            <button type="button" className="cs26-btn" onClick={load}>Réessayer</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="cs26-state">
            <Terminal size={30} aria-hidden="true" />
            <h2>Aucune cheatsheet trouvée</h2>
            <p>{hasActiveFilters ? 'Aucune référence ne correspond à ces filtres.' : 'La bibliothèque est vide.'}</p>
            {hasActiveFilters && <button type="button" className="cs26-btn" onClick={() => { setSearch(''); setCategory('Tous') }}>Réinitialiser les filtres</button>}
          </div>
        ) : (
          <section className="cs26-register" aria-labelledby="cs26-register-title">
            <header className="cs26-register-head">
              <h2 id="cs26-register-title">Bibliothèque de commandes</h2>
              <p><b>{filtered.length.toLocaleString('fr-FR')}</b> référence{filtered.length > 1 ? 's' : ''}{hasActiveFilters && <> sur {total.toLocaleString('fr-FR')}</>}</p>
            </header>
            <ul className="cs26-entries">
              {filtered.map(cs => {
                const busy = loadingTool === cs.tool
                return (
                  <li key={cs.tool} className="cs26-entry">
                    <button type="button" className="cs26-entry-btn" onClick={() => openDetail(cs.tool)} disabled={Boolean(loadingTool)} aria-busy={busy}>
                      <span className="cs26-entry-top">
                        <span className="cs26-entry-tool">{cs.tool}</span>
                        {busy ? <Loader2 className="cs26-entry-spin" size={16} aria-hidden="true" /> : <ChevronRight className="cs26-entry-go" size={16} aria-hidden="true" />}
                      </span>
                      <span className="cs26-entry-desc">{cs.description}</span>
                      <span className="cs26-entry-foot">
                        <span className="cs26-entry-cat">{cs.category}</span>
                        <span className="cs26-entry-nb">{cs.nb_commands} commande{cs.nb_commands > 1 ? 's' : ''}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </div>

      {selected && <CheatsheetDrawer cheatsheet={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
