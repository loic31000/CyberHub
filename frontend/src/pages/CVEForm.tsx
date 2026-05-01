import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { cveApi } from '@/api/client'
import type { CVECreateRequest, CVESeverity, CVEStatus } from '@/types'
import { Save, ArrowLeft } from 'lucide-react'

const SEVERITIES: CVESeverity[] = ['critical', 'high', 'medium', 'low', 'none']
const STATUSES: CVEStatus[] = ['new', 'analyzed', 'patched', 'na']
const STATUS_LABELS: Record<CVEStatus, string> = {
  new: 'Nouveau', analyzed: 'Analysé', patched: 'Patché', na: 'N/A',
}

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

  const set = <K extends keyof CVECreateRequest>(field: K, value: CVECreateRequest[K]) =>
    setForm((f) => ({ ...f, [field]: value }))

  if (loading) return <div className="p-6 text-text-muted">Chargement...</div>

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/cve')} className="text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-text-primary">
          {isEdit ? 'Modifier la CVE' : 'Nouvelle CVE'}
        </h1>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded bg-cyber-red/10 border border-cyber-red/30 text-cyber-red text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* CVE-ID */}
        <div>
          <label className="block text-sm text-text-secondary mb-1">CVE-ID *</label>
          <input
            type="text"
            className="input-cyber w-full px-3 py-2 text-sm font-mono"
            placeholder="Ex: CVE-2024-12345"
            value={form.cve_id}
            onChange={(e) => set('cve_id', e.target.value.toUpperCase())}
            disabled={isEdit}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm text-text-secondary mb-1">Description</label>
          <textarea
            className="input-cyber w-full px-3 py-2 text-sm resize-y"
            rows={3}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </div>

        {/* Score + Severity + Status */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Score CVSS</label>
            <input
              type="number"
              min="0" max="10" step="0.1"
              className="input-cyber w-full px-3 py-2 text-sm"
              value={form.cvss_score}
              onChange={(e) => set('cvss_score', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">Sévérité</label>
            <select
              className="input-cyber w-full px-3 py-2 text-sm capitalize"
              value={form.severity}
              onChange={(e) => set('severity', e.target.value as CVESeverity)}
            >
              {SEVERITIES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">Statut</label>
            <select
              className="input-cyber w-full px-3 py-2 text-sm"
              value={form.status}
              onChange={(e) => set('status', e.target.value as CVEStatus)}
            >
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>
        </div>

        {/* Products + Published */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Produits affectés (virgule-séparés)</label>
            <input
              type="text"
              className="input-cyber w-full px-3 py-2 text-sm"
              placeholder="Ex: Apache, OpenSSL, Windows..."
              value={form.products}
              onChange={(e) => set('products', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">Date de publication</label>
            <input
              type="date"
              className="input-cyber w-full px-3 py-2 text-sm"
              value={typeof form.published_at === 'string' ? form.published_at.slice(0, 10) : ''}
              onChange={(e) => set('published_at', e.target.value)}
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm text-text-secondary mb-1">Notes & Analyse</label>
          <textarea
            className="input-cyber w-full px-3 py-2 text-sm resize-y"
            rows={5}
            placeholder="Impact dans notre environnement, POC disponible, patch appliqué le..."
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn-cyber flex items-center gap-2 px-5 py-2 rounded text-sm font-medium disabled:opacity-50"
          >
            <Save size={15} />
            {saving ? 'Sauvegarde...' : isEdit ? 'Enregistrer' : 'Créer la CVE'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/cve')}
            className="px-5 py-2 rounded text-sm border border-border text-text-secondary hover:text-text-primary transition-colors"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  )
}
