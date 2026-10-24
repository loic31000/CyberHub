import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { cveApi, cisaApi } from '@/api/client'
import type { CVEEntry, CVEFilter, CVESeverity, CVEStatus } from '@/types'
import type { CISAKEVEntry } from '@/types/threat_intel'
import Pagination from '@/components/Pagination'
import { AlertTriangle, CloudDownload, Database, Flame, Plus, Search, Upload } from 'lucide-react'
import { toast } from '@/store/toast'
import NVDImportModal from '@/components/NVDImportModal'
import CveHero from '@/cve26/CveHero'
import {
  CvssMeter, KevBadge, SEVERITIES, SEVERITY_LABEL, STATUSES, STATUS_LABELS, SeverityBadge, StatusBadge,
  formatDay, splitProducts,
} from '@/cve26/parts'
import '@/cve26/cve.css'

const LIMIT = 20
const SEARCH_DELAY = 300 // ms: one request once typing pauses, not one per key
const PRODUCTS_SHOWN = 2

/*
 * KEV enrichment, separate from the list: the list shows as soon as it
 * arrives; flags come from one batch call, the names (tooltips) afterwards.
 * 'error' means the status is unknown, never "not exploited".
 */
type KevState = { status: 'idle' | 'loading' | 'ready' | 'error'; flagged: Set<string>; entries: Map<string, CISAKEVEntry> }
const kevState = (status: KevState['status'], flagged = new Set<string>()): KevState => ({ status, flagged, entries: new Map() })

export default function CVEList() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [cves, setCves] = useState<CVEEntry[]>([])
  const [count, setCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState(false)
  const [importing, setImporting] = useState(false)
  const [filters, setFilters] = useState<CVEFilter>(() => ({ severity: '', status: '', search: searchParams.get('find') ?? '' }))
  const [searchInput, setSearchInput] = useState(filters.search ?? '')
  const [reloadKey, setReloadKey] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const [kev, setKev] = useState<KevState>(() => kevState('idle'))
  const [showNVDModal, setShowNVDModal] = useState(false)

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  // The latest filters and page win: each run cancels the previous one, and a
  // response arriving after its run was superseded is ignored.
  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    setLoading(true)
    setListError(false)

    const loadKev = async (list: CVEEntry[]) => {
      if (list.length === 0) { setKev(kevState('ready')); return }
      setKev(kevState('loading'))
      const ids = list.map((c) => c.cve_id)
      let batch: Record<string, boolean>
      try {
        batch = await cisaApi.batchCheckKEV(ids, signal)
      } catch {
        if (!signal.aborted) setKev(kevState('error'))
        return
      }
      if (signal.aborted) return
      // The backend answers with upper-case IDs.
      const flagged = new Set(ids.filter((id) => batch[id.toUpperCase()] ?? batch[id]))
      setKev(kevState('ready', flagged))
      if (flagged.size === 0) return
      // Names for the tooltips only: the badges are already shown.
      const names = [...flagged]
      const details = await Promise.allSettled(names.map((id) => cisaApi.checkKEV(id, signal)))
      if (signal.aborted) return
      const entries = new Map<string, CISAKEVEntry>()
      details.forEach((d, n) => { if (d.status === 'fulfilled' && d.value.entry) entries.set(names[n], d.value.entry) })
      setKev((k) => ({ ...k, entries }))
    }

    cveApi.list({ ...filters, page, limit: LIMIT } as CVEFilter & { page: number; limit: number }, signal)
      .then((res) => {
        if (signal.aborted) return
        const fetched = res.cves ?? []
        setCves(fetched)
        setCount(Number(res.count))
        setTotalPages((res as { total_pages?: number }).total_pages ?? 1)
        setLoading(false)
        void loadKev(fetched)
      })
      .catch(() => {
        if (signal.aborted) return
        setCves([])
        setKev(kevState('idle'))
        setListError(true)
        setLoading(false)
      })
    return () => controller.abort()
  }, [filters, page, reloadKey])

  // A new ?find= (link from another module) replaces the search.
  useEffect(() => {
    const find = searchParams.get('find')
    if (find === null) return
    setSearchInput(find)
    setFilters((f) => (f.search === find ? f : { ...f, search: find }))
  }, [searchParams])

  // Typing: the search filter follows the field once typing pauses.
  useEffect(() => {
    if (searchInput === (filters.search ?? '')) return
    const timer = window.setTimeout(() => {
      setPage(1)
      setFilters((f) => ({ ...f, search: searchInput }))
    }, SEARCH_DELAY)
    return () => window.clearTimeout(timer)
  }, [searchInput, filters.search])

  const updateFilter = <K extends keyof CVEFilter>(k: K, v: CVEFilter[K]) => {
    setPage(1)
    setFilters(f => ({ ...f, [k]: v }))
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const res = await cveApi.importNVD(json)
      toast.success(`Import terminé : ${res.created} ajoutés, ${res.skipped} ignorés`)
      reload()
    } catch {
      toast.error('Erreur lors de l’import — vérifiez le format NVD JSON 2.0')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // What this page shows, counted from the rows actually listed (not the whole index).
  const pageSummary = useMemo(() => SEVERITIES
    .map(severity => ({ severity, n: cves.filter(c => c.severity === severity).length }))
    .filter(s => s.n > 0), [cves])
  const filtered = Boolean(filters.search || filters.severity || filters.status)

  return (
    <div className="cv26">
      <div className="cv26-frame">
        <CveHero status={loading ? { text: 'CHARGEMENT', tone: 'busy' } : listError ? { text: 'INDEX INDISPONIBLE', tone: 'warn' }
          : { text: `${count.toLocaleString('fr-FR')} CVE`, mark: filtered ? 'FILTRÉES' : 'INDEX LOCAL' }} />

        <section className="cv26-console" aria-label="Recherche et filtres">
          <div className="cv26-console-top">
            <label className="cv26-search">
              <Search size={18} aria-hidden="true" />
              <span className="cv26-sr">Rechercher une CVE</span>
              <input
                type="text"
                placeholder="CVE-ID, description, produit…"
                aria-label="Rechercher une CVE"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <div className="cv26-actions">
              <button type="button" className="cv26-btn is-primary" onClick={() => setShowNVDModal(true)}>
                <CloudDownload size={15} aria-hidden="true" /> Import NVD en ligne
              </button>
              <button type="button" className="cv26-btn" onClick={() => fileRef.current?.click()} disabled={importing}>
                <Upload size={15} aria-hidden="true" /> {importing ? 'Import…' : 'Fichier NVD JSON'}
              </button>
              <Link to="/cve/new" className="cv26-btn"><Plus size={15} aria-hidden="true" /> Nouvelle CVE</Link>
            </div>
          </div>
          <div className="cv26-filters">
            <span className="cv26-filter-label">Sévérité</span>
            <div className="cv26-spectrum" role="group" aria-label="Filtrer par sévérité">
              <button type="button" aria-pressed={!filters.severity} onClick={() => updateFilter('severity', '')}>Toutes</button>
              {SEVERITIES.map(s => (
                <button type="button" key={s} data-severity={s} aria-pressed={filters.severity === s} onClick={() => updateFilter('severity', s as CVESeverity)}>
                  <i aria-hidden="true" />{SEVERITY_LABEL[s]}
                </button>
              ))}
            </div>
            <label className="cv26-select">
              <span className="cv26-filter-label">Statut</span>
              <select aria-label="Filtrer par statut" value={filters.status ?? ''} onChange={(e) => updateFilter('status', e.target.value as CVEStatus | '')}>
                <option value="">Tous</option>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </label>
            {!loading && !listError && (
              <span className="cv26-result-line" aria-live="polite">
                <span><b>{count.toLocaleString('fr-FR')}</b> CVE {filtered ? 'correspondent' : 'indexées'}</span>
                {totalPages > 1 && <span>page {page} / {totalPages}</span>}
              </span>
            )}
          </div>
        </section>

        {loading ? (
          <div className="cv26-board" aria-busy="true" aria-label="Chargement des CVE">
            <div className="cv26-skeleton">{Array.from({ length: 6 }, (_, i) => <div key={i} />)}</div>
          </div>
        ) : listError ? (
          <div role="alert" className="cv26-state is-error">
            <AlertTriangle size={30} aria-hidden="true" />
            <h2>Impossible de charger les CVE</h2>
            <p>Le backend local n’a pas répondu. Vérifiez qu’il est lancé, puis réessayez.</p>
            <div className="cv26-actions"><button type="button" className="cv26-btn" onClick={reload}>Réessayer</button></div>
          </div>
        ) : cves.length === 0 ? (
          <div className="cv26-state">
            <Database size={30} aria-hidden="true" />
            <h2>Aucune CVE trouvée</h2>
            <p>{filtered ? 'Aucune entrée locale ne correspond à ces critères.' : 'L’index local est vide : importez des CVE depuis NVD ou créez une entrée manuellement.'}</p>
            <div className="cv26-actions">
              <button type="button" className="cv26-btn is-primary" onClick={() => setShowNVDModal(true)}><CloudDownload size={15} aria-hidden="true" /> Import NVD en ligne</button>
              <Link to="/cve/new" className="cv26-btn"><Plus size={15} aria-hidden="true" /> Nouvelle CVE</Link>
            </div>
          </div>
        ) : (
          <>
            {kev.status === 'error' && (
              <div role="status" className="cv26-note is-warn">
                <span>Statut CISA KEV indisponible pour cette page : l’absence de badge ne signifie pas « non exploitée ».</span>
                <button type="button" className="cv26-btn" onClick={reload}>Réessayer</button>
              </div>
            )}

            <ul className="cv26-page-summary" aria-label="Composition de cette page">
              <span>Cette page</span>
              {pageSummary.map(s => (
                <li key={s.severity} data-severity={s.severity}><i aria-hidden="true" />{SEVERITY_LABEL[s.severity]} <b>{s.n}</b></li>
              ))}
              {kev.status === 'ready' && kev.flagged.size > 0 && (
                <li className="is-kev"><Flame size={12} aria-hidden="true" />Exploitées (KEV) <b>{kev.flagged.size}</b></li>
              )}
            </ul>

            <div className="cv26-board">
              <div className="cv26-board-head" aria-hidden="true">
                <span />
                <span>Vulnérabilité</span>
                <span>CVSS</span>
                <span>Produits</span>
                <span>Statut</span>
                <span>Publiée</span>
              </div>
              <ol className="cv26-list" aria-label="CVE">
                {cves.map((cve) => {
                  const products = splitProducts(cve.products)
                  const flagged = kev.flagged.has(cve.cve_id)
                  return (
                    <li key={cve.id} className="cv26-row" data-severity={cve.severity} data-kev={flagged} onClick={() => navigate(`/cve/${cve.id}`)}>
                      <span className="cv26-rail" aria-hidden="true" />
                      <div className="cv26-ident">
                        <div className="cv26-ident-top">
                          <Link to={`/cve/${cve.id}`} className="cv26-id" onClick={(e) => e.stopPropagation()}>{cve.cve_id}</Link>
                          {flagged && (
                            <KevBadge title={kev.entries.get(cve.cve_id)?.vulnerability_name
                              ? `Exploitée activement — ${kev.entries.get(cve.cve_id)?.vulnerability_name}`
                              : 'Exploitée activement — catalogue CISA KEV'} />
                          )}
                        </div>
                        <p className="cv26-desc" title={cve.description}>{cve.description || <span className="cv26-muted">Sans description</span>}</p>
                      </div>
                      <div className="cv26-score">
                        <CvssMeter score={cve.cvss_score} severity={cve.severity} />
                        <SeverityBadge severity={cve.severity} />
                      </div>
                      <div className="cv26-products">
                        {products.length === 0 ? <span className="cv26-muted">—</span> : (
                          <>
                            {products.slice(0, PRODUCTS_SHOWN).map(p => <span key={p} title={p}>{p}</span>)}
                            {products.length > PRODUCTS_SHOWN && <small title={products.join(', ')}>+{products.length - PRODUCTS_SHOWN}</small>}
                          </>
                        )}
                      </div>
                      <div className="cv26-status-cell"><StatusBadge status={cve.status} /></div>
                      <span className="cv26-date">{formatDay(cve.published_at)}</span>
                    </li>
                  )
                })}
              </ol>
              <div className="cv26-board-foot">
                <Pagination page={page} totalPages={totalPages} onPage={setPage} />
              </div>
            </div>
          </>
        )}
      </div>

      <input ref={fileRef} type="file" accept=".json" className="cv26-sr" tabIndex={-1} aria-hidden="true" onChange={handleImport} />

      {showNVDModal && (
        <NVDImportModal
          open={showNVDModal}
          onClose={() => setShowNVDModal(false)}
          onSuccess={reload}
        />
      )}
    </div>
  )
}
