import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { cveApi, cisaApi } from '@/api/client'
import type { CVEEntry, CVEFilter, CVESeverity, CVEStatus } from '@/types'
import type { CISAKEVEntry } from '@/types/threat_intel'
import { RowListSkeleton } from '@/components/Skeleton'
import Pagination from '@/components/Pagination'
import { Plus, Search, Upload, ShieldAlert, Flame, AlertTriangle, CloudDownload } from 'lucide-react'
import { toast } from '@/store/toast'
import NVDImportModal from '@/components/NVDImportModal'

const SEVERITIES: CVESeverity[] = ['critical', 'high', 'medium', 'low', 'none']
const STATUSES: CVEStatus[] = ['new', 'analyzed', 'patched', 'na']
const LIMIT = 20

const SEV_COLORS: Record<CVESeverity, string> = {
  critical: 'border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444]',
  high:     'border-[#f97316]/30 bg-[#f97316]/10 text-[#f97316]',
  medium:   'border-[#eab308]/30 bg-[#eab308]/10 text-[#eab308]',
  low:      'border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[#3b82f6]',
  none:     'border-[#64748b]/30 bg-[#64748b]/10 text-[#64748b]',
}

const STATUS_LABELS: Record<CVEStatus, string> = {
  new:      'NOUVEAU',
  analyzed: 'ANALYSÉ',
  patched:  'PATCHÉ',
  na:       'N/A',
}

const STATUS_COLORS: Record<CVEStatus, string> = {
  new:      'text-[#00d4ff]',
  analyzed: 'text-[#eab308]',
  patched:  'text-[#10b981]',
  na:       'text-[#64748b]',
}

export default function CVEList() {
  const [cves, setCves] = useState<CVEEntry[]>([])
  const [count, setCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [filters, setFilters] = useState<CVEFilter>({ severity: '', status: '', search: '' })
  const [searchParams] = useSearchParams()
  const fileRef = useRef<HTMLInputElement>(null)
  const [kevMap, setKevMap] = useState<Map<string, CISAKEVEntry>>(new Map())
  const [showNVDModal, setShowNVDModal] = useState(false)

  const fetchCVE = useCallback(async () => {
    setLoading(true)
    try {
      const res = await cveApi.list({ ...filters, page, limit: LIMIT } as CVEFilter & { page: number; limit: number })
      const fetchedCves = res.cves ?? []
      setCves(fetchedCves)
      setCount(Number(res.count))
      setTotalPages((res as { total_pages?: number }).total_pages ?? 1)
      const newMap = new Map<string, CISAKEVEntry>()
      if (fetchedCves.length > 0) {
        const batchResult = await cisaApi.batchCheckKEV(fetchedCves.map(c => c.cve_id))
        await Promise.allSettled(
          fetchedCves
            .filter(cve => batchResult[cve.cve_id])
            .map(async (cve) => {
              try {
                const r = await cisaApi.checkKEV(cve.cve_id)
                if (r.entry) newMap.set(cve.cve_id, r.entry)
              } catch { /* silencieux */ }
            })
        )
      }
      setKevMap(newMap)
    } catch {
      toast.error('Erreur de chargement des CVE')
      setCves([])
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  useEffect(() => { fetchCVE() }, [fetchCVE])

  useEffect(() => {
    const find = searchParams.get('find')
    if (find) setFilters(f => ({ ...f, search: find }))
  }, [searchParams])

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
      fetchCVE()
    } catch {
      toast.error('Erreur lors de l’import — vérifiez le format NVD JSON 2.0')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <>
      <div className="flex flex-col h-full bg-[#06080f] text-[#f1f5f9]">
        {/* Bandeau d'en-tête style BGPLookup */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d40] bg-[#0a0f16]/50">
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShieldAlert className="text-[#00d4ff]" size={20} />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#10b981] rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-[0.2em] uppercase">CVE WATCH // INDEX</h1>
              <p className="text-[10px] text-[#64748b] font-mono">
                {count} vulnérabilité{count > 1 ? 's' : ''} indexée{count > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 font-mono text-[10px]">
            <span className="text-[#64748b]">SOURCE</span>
            <span className="text-[#10b981]">NVD + CISA KEV</span>
            <button
              onClick={() => setShowNVDModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2d40] hover:bg-[#2a3f55] text-[10px] font-bold border border-[#334155] transition-colors"
            >
              <CloudDownload size={12} /> NVD ONLINE
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2d40] hover:bg-[#2a3f55] text-[10px] font-bold border border-[#334155] transition-colors disabled:opacity-50"
            >
              <Upload size={12} />
              {importing ? 'IMPORT...' : 'IMPORT NVD'}
            </button>
            <Link
              to="/cve/new"
              className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2d40] hover:bg-[#2a3f55] text-[10px] font-bold border border-[#334155] transition-colors"
            >
              <Plus size={12} /> NEW ENTRY
            </Link>
          </div>
        </div>

        {/* Zone de contenu scrollable */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Filtres */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[260px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a6480]" />
              <input
                type="text"
                placeholder="Rechercher CVE-ID, description, produit..."
                className="w-full bg-[#0d131f] border border-[#1e2d40] pl-9 pr-4 py-2.5 font-mono text-sm text-[#f1f5f9] placeholder-[#2a3f55] outline-none focus:border-[#00d4ff]/40"
                value={filters.search ?? ''}
                onChange={(e) => updateFilter('search', e.target.value)}
              />
            </div>
            <select
              className="bg-[#0d131f] border border-[#1e2d40] px-3 py-2.5 font-mono text-sm text-[#f1f5f9] focus:border-[#00d4ff]/40 outline-none"
              value={filters.severity ?? ''}
              onChange={(e) => updateFilter('severity', e.target.value as CVESeverity | '')}
            >
              <option value="">Toutes sévérités</option>
              {SEVERITIES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
            </select>
            <select
              className="bg-[#0d131f] border border-[#1e2d40] px-3 py-2.5 font-mono text-sm text-[#f1f5f9] focus:border-[#00d4ff]/40 outline-none"
              value={filters.status ?? ''}
              onChange={(e) => updateFilter('status', e.target.value as CVEStatus | '')}
            >
              <option value="">Tous status</option>
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>

          {/* Tableau des CVE */}
          {loading ? (
            <RowListSkeleton count={8} />
          ) : cves.length === 0 ? (
            <div className="flex flex-col items-center justify-center border border-[#1e2d40] bg-[#0a0f16] py-24 text-center">
              <AlertTriangle size={40} className="mb-4 text-[#1e2d40]" />
              <p className="font-mono text-sm uppercase tracking-widest text-[#64748b]">Aucune CVE trouvée</p>
              <p className="mt-2 font-mono text-xs text-[#334155]">
                Importez un fichier NVD JSON ou créez une entrée manuellement
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto border border-[#1e2d40]">
                <table className="w-full text-sm font-mono">
                  <thead className="bg-[#0a0f16] border-b border-[#1e2d40]">
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-[#4a6480]">
                      <th className="px-4 py-3 text-left">CVE-ID</th>
                      <th className="px-4 py-3 text-left">Sévérité</th>
                      <th className="px-4 py-3 text-left">Score</th>
                      <th className="px-4 py-3 text-left">Produits</th>
                      <th className="px-4 py-3 text-left">Statut</th>
                      <th className="px-4 py-3 text-left">Publié</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cves.map((cve) => (
                      <tr
                        key={cve.id}
                        className="border-b border-[#1e2d40] hover:bg-[#0a0f16]/70 transition-colors cursor-pointer"
                        onClick={() => window.location.href = `/cve/${cve.id}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              to={`/cve/${cve.id}`}
                              className="text-[#00d4ff] hover:underline font-mono text-sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {cve.cve_id}
                            </Link>
                            {kevMap.has(cve.cve_id) && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 border border-[#ef4444]/50 bg-[#ef4444]/20 text-[#ef4444] animate-pulse font-mono uppercase tracking-wider"
                                title={`Exploitée activement — ${kevMap.get(cve.cve_id)?.vulnerability_name ?? ''}`}
                              >
                                <Flame size={10} /> KEV
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#8a9ab0] mt-1 max-w-xs truncate">{cve.description}</p>
                         </td>
                        <td className="px-4 py-3">
                          <span className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${SEV_COLORS[cve.severity]}`}>
                            {cve.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#f1f5f9] font-mono text-sm">
                          {cve.cvss_score > 0 ? cve.cvss_score.toFixed(1) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#8a9ab0] max-w-xs truncate">
                          {cve.products || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] font-mono font-bold uppercase tracking-wider ${STATUS_COLORS[cve.status]}`}>
                            {STATUS_LABELS[cve.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-[#64748b]">
                          {cve.published_at ? new Date(cve.published_at).toLocaleDateString('fr-FR') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-[#1e2d40] bg-[#0a0f16] p-4">
                <Pagination page={page} totalPages={totalPages} onPage={setPage} />
              </div>
            </>
          )}
        </div>

        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
      </div>

      {showNVDModal && (
        <NVDImportModal
          open={showNVDModal}
          onClose={() => setShowNVDModal(false)}
          onSuccess={fetchCVE}
        />
      )}
    </>
  )
}