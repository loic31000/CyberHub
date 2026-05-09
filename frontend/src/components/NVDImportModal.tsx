import { useState } from 'react'
import { cveApi } from '@/api/client'
import { toast } from '@/store/toast'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function NVDImportModal({ open, onClose, onSuccess }: Props) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [cvssMin, setCvssMin] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [limit, setLimit] = useState(100)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!startDate && !keyword && cvssMin === 0) {
      toast.error('Au moins un critere (date debut, keyword, ou CVSS min)')
      return
    }
    setLoading(true)
    try {
      const res = await cveApi.fetchFromNVD({
        pub_start_date: startDate ? new Date(startDate).toISOString() : '',
        pub_end_date: endDate ? new Date(endDate).toISOString() : undefined,
        cvss_min: cvssMin,
        keyword: keyword || undefined,
        results_per_page: limit,
        page: 1,
      })

      // Guard: detecter une reponse inattendue (ex: HTML au lieu de JSON)
      console.log('[NVDImportModal] reponse API:', res)
      if (typeof res.created !== 'number') {
        toast.error('Reponse inattendue -- verifiez les logs backend')
        return
      }

      if (res.total_remote === 0) {
        toast.success('Aucune CVE retournee par NVD pour ces criteres.')
      } else {
        const s1 = res.created > 1 ? 's' : ''
        const s2 = res.skipped > 1 ? 's' : ''
        toast.success(
          res.created + ' nouvelle' + s1 + ' CVE ajoutee' + s1 + ', ' +
          res.skipped + ' deja existante' + s2 + '. ' +
          'Total disponible NVD : ' + res.total_available
        )
      }
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      const message =
        err instanceof Error
          ? err.message
          : axiosErr?.response?.data?.error ?? "Erreur lors de l'import NVD"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const inputCls = 'w-full border border-[#1e2d40] bg-[#0d131f] p-2 font-mono text-sm text-white'
  const labelCls = 'mb-1 block font-mono text-[10px] uppercase text-[#8a9ab0]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md border border-[#1e2d40] bg-[#0a0f16] p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#00d4ff]">
            IMPORT NVD EN LIGNE
          </h2>
          <button onClick={onClose} className="text-[#64748b] hover:text-white">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className={labelCls}>Date debut * (recommande)</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Date fin (optionnel)</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Score CVSS minimum</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="10"
              value={cvssMin}
              onChange={e => setCvssMin(parseFloat(e.target.value) || 0)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Mot-cle (description)</label>
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="ex: Log4j, RCE, injection"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Resultats max (100-2000)</label>
            <input
              type="number"
              min="100"
              max="2000"
              value={limit}
              onChange={e => setLimit(parseInt(e.target.value, 10) || 100)}
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full border border-[#00d4ff]/20 bg-[#00d4ff]/10 py-2 font-mono text-xs font-bold uppercase tracking-widest text-[#00d4ff] transition hover:bg-[#00d4ff]/20 disabled:opacity-50"
          >
            {loading ? 'IMPORT EN COURS...' : 'IMPORTER DEPUIS NVD'}
          </button>
        </form>
        <p className="mt-4 text-center font-mono text-[9px] text-[#4a6480]">
          {"L'API NVD v2 est gratuite (5 req/30s sans cle, 50 avec)."}<br />
          Seules les CVE absentes de votre base seront ajoutees.
        </p>
      </div>
    </div>
  )
}
