import { useEffect, useId, useRef, useState } from 'react'
import { cveApi } from '@/api/client'
import { toast } from '@/store/toast'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const LIMIT_MIN = 100
const LIMIT_MAX = 2000

// The backend's own message first (axios errors are Error instances too).
const errorMessage = (err: unknown) => {
  const backend = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
  if (backend) return backend
  if ((err as { response?: unknown })?.response === undefined) return 'Backend local injoignable : import NVD impossible'
  return "Erreur lors de l'import NVD"
}

/*
 * NVD online import, as a modal dialog: focus moves in and stays inside,
 * Escape closes it and focus goes back where it was. While an import runs
 * the dialog cannot be closed and the form cannot be sent twice.
 */
export default function NVDImportModal({ open, onClose, onSuccess }: Props) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [cvssMin, setCvssMin] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [limit, setLimit] = useState(LIMIT_MIN)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const ids = { title: useId(), error: useId(), start: useId(), end: useId(), cvss: useId(), keyword: useId(), limit: useId() }

  // Focus the first field on open, give it back to the opener on close.
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    firstFieldRef.current?.focus()
    return () => opener?.focus?.()
  }, [open])

  const close = () => { if (!submitting.current) onClose() }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return }
    if (event.key !== 'Tab' || !dialogRef.current) return
    const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')]
    if (!focusable.length) return
    const first = focusable[0], last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  const validate = () => {
    if (!startDate && !keyword.trim() && cvssMin === 0) return 'Indiquez au moins un critère : date de début, mot-clé ou score CVSS minimum.'
    if (startDate && endDate && endDate < startDate) return 'La date de fin doit suivre la date de début.'
    if (cvssMin < 0 || cvssMin > 10) return 'Le score CVSS minimum doit être compris entre 0 et 10.'
    if (limit < LIMIT_MIN || limit > LIMIT_MAX) return `Le nombre de résultats doit être compris entre ${LIMIT_MIN} et ${LIMIT_MAX}.`
    return ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting.current) return
    const problem = validate()
    setError(problem)
    if (problem) return
    submitting.current = true
    setLoading(true)
    try {
      const res = await cveApi.fetchFromNVD({
        pub_start_date: startDate ? new Date(startDate).toISOString() : '',
        pub_end_date: endDate ? new Date(endDate).toISOString() : undefined,
        cvss_min: cvssMin,
        keyword: keyword.trim() || undefined,
        results_per_page: limit,
        page: 1,
      })

      // Guard: an unexpected answer (e.g. HTML instead of JSON).
      if (typeof res?.created !== 'number') {
        setError('Réponse inattendue du backend : vérifiez ses journaux.')
        return
      }

      if (res.total_remote === 0) {
        toast.success('Aucune CVE retournée par NVD pour ces critères.')
      } else {
        const s1 = res.created > 1 ? 's' : ''
        const s2 = res.skipped > 1 ? 's' : ''
        toast.success(
          `${res.created} nouvelle${s1} CVE ajoutée${s1}, ${res.skipped} déjà existante${s2}. ` +
          `Total disponible NVD : ${res.total_available}`
        )
      }
      submitting.current = false
      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(errorMessage(err))
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  if (!open) return null

  const inputCls = 'w-full border border-[#1e2d40] bg-[#0d131f] p-2 font-mono text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff] disabled:opacity-60'
  const labelCls = 'mb-1 block font-mono text-[10px] uppercase text-[#8a9ab0]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={ids.title} aria-busy={loading} onKeyDown={onKeyDown}
        className="w-full max-w-md border border-[#1e2d40] bg-[#0a0f16] p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 id={ids.title} className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#00d4ff]">
            IMPORT NVD EN LIGNE
          </h2>
          <button type="button" onClick={close} disabled={loading} className="text-[#64748b] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff] disabled:opacity-40" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5" noValidate aria-describedby={error ? ids.error : undefined}>
          <div>
            <label htmlFor={ids.start} className={labelCls}>Date début * (recommandée)</label>
            <input
              ref={firstFieldRef}
              id={ids.start}
              type="date"
              value={startDate}
              disabled={loading}
              onChange={e => setStartDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor={ids.end} className={labelCls}>Date fin (optionnelle)</label>
            <input
              id={ids.end}
              type="date"
              value={endDate}
              disabled={loading}
              onChange={e => setEndDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor={ids.cvss} className={labelCls}>Score CVSS minimum</label>
            <input
              id={ids.cvss}
              type="number"
              step="0.1"
              min="0"
              max="10"
              value={cvssMin}
              disabled={loading}
              onChange={e => setCvssMin(parseFloat(e.target.value) || 0)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor={ids.keyword} className={labelCls}>Mot-clé (description)</label>
            <input
              id={ids.keyword}
              type="text"
              value={keyword}
              disabled={loading}
              onChange={e => setKeyword(e.target.value)}
              placeholder="ex: Log4j, RCE, injection"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor={ids.limit} className={labelCls}>Résultats max ({LIMIT_MIN}-{LIMIT_MAX})</label>
            <input
              id={ids.limit}
              type="number"
              min={LIMIT_MIN}
              max={LIMIT_MAX}
              value={limit}
              disabled={loading}
              onChange={e => setLimit(parseInt(e.target.value, 10) || LIMIT_MIN)}
              className={inputCls}
            />
          </div>
          {error && (
            <p id={ids.error} role="alert" className="border border-[#ef4444]/30 bg-[#ef4444]/10 px-3 py-2 font-mono text-[11px] text-[#fca5a5]">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full border border-[#00d4ff]/20 bg-[#00d4ff]/10 py-2 font-mono text-xs font-bold uppercase tracking-widest text-[#00d4ff] transition hover:bg-[#00d4ff]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff] disabled:opacity-50"
          >
            {loading ? 'IMPORT EN COURS...' : 'IMPORTER DEPUIS NVD'}
          </button>
        </form>
        <p className="mt-4 text-center font-mono text-[9px] text-[#4a6480]">
          {"L'API NVD v2 est gratuite (5 req/30s sans clé, 50 avec)."}<br />
          Seules les CVE absentes de votre base seront ajoutées.
        </p>
      </div>
    </div>
  )
}
