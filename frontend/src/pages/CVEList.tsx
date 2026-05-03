import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { cveApi } from '@/api/client'
import type { CVEEntry, CVEFilter, CVESeverity, CVEStatus } from '@/types'
import { RowListSkeleton } from '@/components/Skeleton'
import Pagination from '@/components/Pagination'
import { Plus, Search, Upload, ShieldAlert, AlertTriangle, Flame } from 'lucide-react'
import { toast } from '@/store/toast'
import { cisaApi } from '@/api/client'
import type { CISAKEVEntry } from '@/types/threat_intel'

const SEVERITIES: CVESeverity[] = ['critical', 'high', 'medium', 'low', 'none']
const STATUSES: CVEStatus[] = ['new', 'analyzed', 'patched', 'na']
const LIMIT = 20

const SEV_COLORS: Record<CVESeverity, string> = {
  critical: 'bg-cyber-red/20 text-cyber-red border-cyber-red/40',
  high:     'bg-orange-500/20 text-orange-400 border-orange-400/40',
  medium:   'bg-yellow-500/20 text-yellow-400 border-yellow-400/40',
  low:      'bg-blue-500/20 text-blue-400 border-blue-400/40',
  none:     'bg-gray-500/20 text-gray-400 border-gray-400/40',
}

const STATUS_COLORS: Record<CVEStatus, string> = {
  new:      'text-cyber-cyan',
  analyzed: 'text-yellow-400',
  patched:  'text-cyber-green',
  na:       'text-text-muted',
}

export default function CVEList() {
    const [cves, setCves]             = useState<CVEEntry[]>([])
  const [count, setCount]           = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage]             = useState(1)
  const [loading, setLoading]       = useState(true)
  const [importing, setImporting]   = useState(false)
  const [filters, setFilters]       = useState<CVEFilter>({ severity: '', status: '', search: '' })
  const [searchParams] = useSearchParams()
  const fileRef = useRef<HTMLInputElement>(null)
  // KEV lookup map: cveId -> CISAKEVEntry
  const [kevMap, setKevMap] = useState<Map<string, CISAKEVEntry>>(new Map())

  const STATUS_LABELS: Record<CVEStatus, string> = {
    new: `Nouveau`,
    analyzed: `Analysé`,
    patched: `Patché`,
    na: `N/A`,
  }

  const fetchCVE = useCallback(async () => {
    setLoading(true)
    try {
      const res = await cveApi.list({ ...filters, page, limit: LIMIT } as CVEFilter & { page: number; limit: number })
      const fetchedCves = res.cves ?? []
      setCves(fetchedCves)
      setCount(Number(res.count))
      setTotalPages((res as { total_pages?: number }).total_pages ?? 1)
      // Enrichissement KEV en batch (parallel, sans bloquer l'affichage)
      const newMap = new Map<string, CISAKEVEntry>()
      await Promise.allSettled(
        fetchedCves.map(async (cve) => {
          try {
            const r = await cisaApi.checkKEV(cve.cve_id)
            if (r.exploited && r.entry) newMap.set(cve.cve_id, r.entry)
          } catch { /* silencieux */ }
        })
      )
      setKevMap(newMap)
    } catch {
      toast.error(`Aucune CVE trouvée`)
      setCves([])
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  useEffect(() => { fetchCVE() }, [fetchCVE])

  useEffect(() => {
    const find = searchParams.get('find')
    if (find) {
      setFilters((f) => ({ ...f, search: find }))
    }
  }, [searchParams])

  const updateFilter = <K extends keyof CVEFilter>(k: K, v: CVEFilter[K]) => {
    setPage(1)
    setFilters(f => ({ ...f, [k]: v }))
  }

  // Import NVD JSON 2.0
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const res = await cveApi.importNVD(json)
      toast.success(`Import terminé : ${res.created} ajoutés, ${res.skipped} ignorés`)
      fetchCVE()
    } catch {
      toast.error(`Erreur lors de l'import — vérifiez le format NVD JSON 2.0`)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <ShieldAlert size={24} className="text-cyber-red" />
            {`Veille CVE`}
          </h1>
          <p className="text-text-muted text-sm mt-1">
            {count} vulnérabilité{count > 1 ? 's' : ''} indexée{count > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded border border-border text-text-secondary hover:text-cyber-cyan hover:border-cyber-cyan/40 transition-colors disabled:opacity-50"
            title={`Importer un fichier NVD JSON 2.0 (nvd.nist.gov)`}
          >
            <Upload size={15} />
            {importing ? `Import...` : `Import NVD`}
          </button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          <Link
            to="/cve/new"
            className="btn-cyber flex items-center gap-2 px-4 py-2 rounded text-sm font-medium"
          >
            <Plus size={16} />
            {`Nouvelle CVE`}
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder={`Rechercher CVE-ID, description, produit...`}
            className="input w-full pl-9 pr-4 py-2 text-sm"
            value={filters.search ?? ''}
            onChange={(e) => updateFilter('search', e.target.value)}
          />
        </div>
        <select
          className="input px-3 py-2 text-sm"
          value={filters.severity ?? ''}
          onChange={(e) => updateFilter('severity', e.target.value as CVESeverity | '')}
        >
          <option value="">{`Toutes les sévérités`}</option>
          {SEVERITIES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
        <select
          className="input px-3 py-2 text-sm"
          value={filters.status ?? ''}
          onChange={(e) => updateFilter('status', e.target.value as CVEStatus | '')}
        >
          <option value="">{`Tous les statuts`}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <RowListSkeleton count={8} />
      ) : cves.length === 0 ? (
        <div className="text-center py-20 text-text-muted">
          <AlertTriangle size={40} className="mx-auto mb-3 opacity-20" />
          <p>{`Aucune CVE trouvée`}</p>
          <p className="text-xs mt-2">{`Importez un fichier NVD JSON ou créez une entrée manuellement`}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary border-b border-border">
                <tr className="text-text-muted text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">{`CVE-ID`}</th>
                  <th className="px-4 py-3 text-left">{`Sévérité`}</th>
                  <th className="px-4 py-3 text-left">{`Score`}</th>
                  <th className="px-4 py-3 text-left">{`Produits`}</th>
                  <th className="px-4 py-3 text-left">{`Statut`}</th>
                  <th className="px-4 py-3 text-left">{`Publié`}</th>
                </tr>
              </thead>
              <tbody>
                {cves.map((cve) => (
                  <tr
                    key={cve.id}
                    className="border-b border-border/50 hover:bg-bg-hover transition-colors cursor-pointer"
                    onClick={() => window.location.href = `/cve/${cve.id}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          to={`/cve/${cve.id}`}
                          className="font-mono text-cyber-cyan hover:underline font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {cve.cve_id}
                        </Link>
                        {kevMap.has(cve.cve_id) && (
                          <span
                            className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border border-red-500/50 bg-red-900/30 text-red-400 animate-pulse font-semibold"
                            title={`Exploitée activement — CISA KEV · ${kevMap.get(cve.cve_id)?.vulnerability_name ?? ''}`}
                          >
                            <Flame size={10} /> KEV
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted mt-0.5 max-w-xs truncate">{cve.description}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded border capitalize font-medium ${SEV_COLORS[cve.severity]}`}>
                        {cve.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                      {cve.cvss_score > 0 ? cve.cvss_score.toFixed(1) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted max-w-xs truncate">
                      {cve.products || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${STATUS_COLORS[cve.status]}`}>
                        {STATUS_LABELS[cve.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">
                      {cve.published_at ? new Date(cve.published_at).toLocaleDateString('fr-FR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </div>
  )
}
