import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { cveApi } from '@/api/client'
import type { CVECreateRequest, CVESeverity, CVEStatus } from '@/types'
import { Save, ArrowLeft, ShieldAlert } from 'lucide-react'

const SEVERITIES: CVESeverity[] = ['critical', 'high', 'medium', 'low', 'none']
const STATUSES: CVEStatus[] = ['new', 'analyzed', 'patched', 'na']

const DEFAULT_FORM: CVECreateRequest = {
  cve_id: '',
  description: '',
  cvss_score: 0,
  severity: 'none',
  products: '',
  status: 'new',
  notes: '',
  published_at: new Date().toISOString().slice(0, 10),
}

const STATUS_LABELS: Record<CVEStatus, string> = {
  new:      'NOUVEAU',
  analyzed: 'ANALYSÉ',
  patched:  'PATCHÉ',
  na:       'N/A',
}

export default function CVEForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [form, setForm] = useState<CVECreateRequest>(DEFAULT_FORM)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isEdit || !id) return
    cveApi.get(Number(id))
      .then((c) => setForm({
        cve_id: c.cve_id,
        description: c.description,
        cvss_score: c.cvss_score,
        severity: c.severity,
        products: c.products,
        status: c.status,
        notes: c.notes,
        published_at: c.published_at ? c.published_at.slice(0, 10) : '',
      }))
      .catch(() => navigate('/cve'))
      .finally(() => setLoading(false))
  }, [id, isEdit, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.cve_id.trim()) { setError('Le CVE-ID est requis'); return }
    setSaving(true)
    setError('')
    const payload = { ...form, published_at: form.published_at ? new Date(form.published_at).toISOString() : new Date().toISOString() }
    try {
      if (isEdit && id) {
        await cveApi.update(Number(id), payload)
        navigate(`/cve/${id}`)
      } else {
        const created = await cveApi.create(payload)
        navigate(`/cve/${created.id}`)
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e?.response?.data?.error ?? 'Erreur lors de la sauvegarde')
      setSaving(false)
    }
  }

  const setField = <K extends keyof CVECreateRequest>(field: K, value: CVECreateRequest[K]) =>
    setForm((f) => ({ ...f, [field]: value }))

  if (loading) return <div className="flex h-full items-center justify-center bg-[#06080f]"><p className="font-mono text-xs text-[#64748b]">CHARGEMENT...</p></div>

  const fieldClass = 'w-full border border-[#1e2d40] bg-[#0d131f] px-4 py-2.5 font-mono text-sm text-[#f1f5f9] placeholder-[#334155] outline-none transition-colors focus:border-[#00d4ff]/50'
  const textAreaClass = `${fieldClass} resize-y`
  const labelClass = 'mb-2 block font-mono text-[10px] font-bold uppercase tracking-widest text-[#8a9ab0]'

  return (
    <div className="flex flex-col h-full bg-[#06080f] text-[#f1f5f9]">
      {/* Bandeau d'en-tête style BGPLookup */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d40] bg-[#0a0f16]/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <ShieldAlert className="text-[#00d4ff]" size={20} />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#10b981] rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase">CVE WATCH // FORM</h1>
            <p className="text-[10px] text-[#64748b] font-mono">
              {isEdit ? 'MODIFICATION DE CVE' : 'NOUVELLE CVE'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/cve')}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2d40] hover:bg-[#2a3f55] text-[10px] font-bold border border-[#334155] transition-colors"
          >
            <ArrowLeft size={12} /> BACK TO INDEX
          </button>
        </div>
      </div>

      {/* Zone de contenu scrollable */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto w-full space-y-8">
          {error && (
            <div className="border-l-2 border-[#ef4444] bg-[#ef4444]/5 p-4 font-mono text-[11px] text-[#ef4444]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Informations principales */}
            <div className="space-y-6 border border-[#1e2d40] bg-[#0a0f16] p-6">
              <h2 className="border-b border-[#1e2d40] pb-3 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#00d4ff]">
                INFORMATIONS CVE
              </h2>

              <div>
                <label className={labelClass}>CVE-ID *</label>
                <input
                  type="text"
                  className={fieldClass}
                  placeholder="EX: CVE-2024-12345"
                  value={form.cve_id}
                  onChange={(e) => setField('cve_id', e.target.value.toUpperCase())}
                  disabled={isEdit}
                />
              </div>

              <div>
                <label className={labelClass}>DESCRIPTION</label>
                <textarea
                  className={textAreaClass}
                  rows={3}
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div>
                  <label className={labelClass}>CVSS SCORE</label>
                  <input
                    type="number"
                    min="0" max="10" step="0.1"
                    className={fieldClass}
                    value={form.cvss_score}
                    onChange={(e) => setField('cvss_score', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className={labelClass}>SÉVÉRITÉ</label>
                  <select
                    className={fieldClass}
                    value={form.severity}
                    onChange={(e) => setField('severity', e.target.value as CVESeverity)}
                  >
                    {SEVERITIES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>STATUT</label>
                  <select
                    className={fieldClass}
                    value={form.status}
                    onChange={(e) => setField('status', e.target.value as CVEStatus)}
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className={labelClass}>PRODUITS AFFECTÉS</label>
                  <input
                    type="text"
                    className={fieldClass}
                    placeholder="EX: Apache, OpenSSL, Windows..."
                    value={form.products}
                    onChange={(e) => setField('products', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>DATE DE PUBLICATION</label>
                  <input
                    type="date"
                    className={fieldClass}
                    value={typeof form.published_at === 'string' ? form.published_at.slice(0, 10) : ''}
                    onChange={(e) => setField('published_at', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Notes d'analyse */}
            <div className="space-y-3 border border-[#1e2d40] bg-[#0a0f16] p-6">
              <label className="block border-b border-[#1e2d40] pb-3 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a9ab0]">
                📝 NOTES & ANALYSE
              </label>
              <textarea
                className={textAreaClass}
                rows={6}
                placeholder="Impact dans notre environnement, POC disponible, patch appliqué le..."
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
              />
            </div>

            {/* Actions du formulaire */}
            <div className="flex justify-end gap-4 pt-4 pb-8 border-t border-[#1e2d40]">
              <button
                type="button"
                onClick={() => navigate('/cve')}
                disabled={saving}
                className="border border-[#1e2d40] bg-[#0a0f16] px-6 py-3 font-mono text-xs uppercase tracking-widest text-[#8a9ab0] transition-colors hover:bg-[#1e2d40] hover:text-[#f1f5f9]"
              >
                ANNULER
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 border border-[#00d4ff]/20 bg-[#00d4ff]/10 px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest text-[#00d4ff] transition-colors hover:bg-[#00d4ff]/20 disabled:opacity-50"
              >
                <Save size={15} />
                {saving ? 'SAUVEGARDE...' : (isEdit ? 'METTRE À JOUR' : 'CRÉER LA CVE')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}