import { useState, useEffect, useId, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { cveApi } from '@/api/client'
import { toast } from '@/store/toast'
import type { CVECreateRequest, CVESeverity, CVEStatus } from '@/types'
import { ArrowLeft, Save } from 'lucide-react'
import CveHero from '@/cve26/CveHero'
import { CvssMeter, SEVERITIES, SEVERITY_LABEL, STATUSES, STATUS_LABELS, SeverityBadge } from '@/cve26/parts'
import '@/cve26/cve.css'

// Today's date at the time the form opens, not when the module was loaded.
const defaultForm = (): CVECreateRequest => ({
  cve_id: '',
  description: '',
  cvss_score: 0,
  severity: 'none',
  products: '',
  status: 'new',
  notes: '',
  published_at: new Date().toISOString().slice(0, 10),
})

/** CVSS v3 qualitative rating of a base score (FIRST specification). */
function severityForScore(score: number): CVESeverity {
  if (score >= 9) return 'critical'
  if (score >= 7) return 'high'
  if (score >= 4) return 'medium'
  if (score > 0) return 'low'
  return 'none'
}

export default function CVEForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [form, setForm] = useState<CVECreateRequest>(defaultForm)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const ids = { error: useId(), cveId: useId(), description: useId(), cvss: useId(), cvssHint: useId(), severity: useId(), status: useId(), products: useId(), published: useId(), notes: useId() }

  useEffect(() => {
    if (!isEdit || !id) return
    const controller = new AbortController()
    const { signal } = controller
    cveApi.get(Number(id), signal)
      .then((c) => { if (!signal.aborted) setForm({
        cve_id: c.cve_id,
        description: c.description,
        cvss_score: c.cvss_score,
        severity: c.severity,
        products: c.products,
        status: c.status,
        notes: c.notes,
        published_at: c.published_at ? c.published_at.slice(0, 10) : '',
      }) })
      .catch(() => {
        if (signal.aborted) return
        toast.error('Impossible de charger cette CVE pour modification')
        navigate('/cve')
      })
      .finally(() => { if (!signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [id, isEdit, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting.current) return
    if (!form.cve_id.trim()) { setError('Le CVE-ID est requis'); return }
    submitting.current = true
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
      submitting.current = false
      setSaving(false)
    }
  }

  const setField = <K extends keyof CVECreateRequest>(field: K, value: CVECreateRequest[K]) =>
    setForm((f) => ({ ...f, [field]: value }))

  const hero = <CveHero status={isEdit ? { text: 'ÉDITION', mark: form.cve_id || undefined } : { text: 'CRÉATION', mark: 'NOUVELLE CVE' }} />

  if (loading) {
    return <div className="cv26"><div className="cv26-frame">{hero}<div className="cv26-loading" role="status">Chargement de la fiche…</div></div></div>
  }

  const suggested = severityForScore(form.cvss_score)
  const backTo = isEdit && id ? `/cve/${id}` : '/cve'

  return (
    <div className="cv26">
      <div className="cv26-frame">
        {hero}

        <nav className="cv26-crumbs" aria-label="Navigation">
          <Link to={backTo} className="cv26-link"><ArrowLeft size={14} aria-hidden="true" /> {isEdit ? 'Retour à la fiche' : 'Index CVE & KEV'}</Link>
        </nav>

        <form onSubmit={handleSubmit} className="cv26-form" aria-describedby={error ? ids.error : undefined}>
          {error && <p id={ids.error} role="alert" className="cv26-form-error">{error}</p>}

          <section className="cv26-form-panel" aria-labelledby={`${ids.cveId}-title`}>
            <h2 id={`${ids.cveId}-title`}>{isEdit ? 'Fiche de vulnérabilité' : 'Nouvelle vulnérabilité'}</h2>

            <div className="cv26-field">
              <label htmlFor={ids.cveId}>CVE-ID *</label>
              <input
                id={ids.cveId}
                type="text"
                className="is-mono"
                placeholder="CVE-2024-12345"
                value={form.cve_id}
                onChange={(e) => setField('cve_id', e.target.value.toUpperCase())}
                disabled={isEdit}
                autoComplete="off"
                spellCheck={false}
              />
              {isEdit && <small>L’identifiant d’une fiche existante ne se modifie pas.</small>}
            </div>

            <div className="cv26-field">
              <label htmlFor={ids.description}>DESCRIPTION</label>
              <textarea id={ids.description} rows={4} value={form.description} onChange={(e) => setField('description', e.target.value)} />
            </div>
          </section>

          <section className="cv26-form-panel" aria-label="Évaluation">
            <h2>Évaluation</h2>
            <div className="cv26-form-grid is-3">
              <div className="cv26-field">
                <label htmlFor={ids.cvss}>CVSS SCORE</label>
                <input
                  id={ids.cvss}
                  type="number"
                  min="0" max="10" step="0.1"
                  className="is-mono"
                  value={form.cvss_score}
                  aria-describedby={ids.cvssHint}
                  onChange={(e) => setField('cvss_score', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="cv26-field">
                <label htmlFor={ids.severity}>SÉVÉRITÉ</label>
                <select id={ids.severity} value={form.severity} onChange={(e) => setField('severity', e.target.value as CVESeverity)}>
                  {SEVERITIES.map(s => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
                </select>
              </div>
              <div className="cv26-field">
                <label htmlFor={ids.status}>STATUT</label>
                <select id={ids.status} value={form.status} onChange={(e) => setField('status', e.target.value as CVEStatus)}>
                  {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>
            </div>
            <div id={ids.cvssHint} className="cv26-form-preview" aria-live="polite">
              <span data-severity={form.severity}><CvssMeter score={form.cvss_score} severity={form.severity} /></span>
              <SeverityBadge severity={form.severity} />
              {form.cvss_score > 0 && suggested !== form.severity && (
                <>
                  <span>Le score {form.cvss_score.toFixed(1)} correspond à « {SEVERITY_LABEL[suggested]} » (plages CVSS v3).</span>
                  <button type="button" className="cv26-btn" onClick={() => setField('severity', suggested)}>Appliquer</button>
                </>
              )}
            </div>

            <div className="cv26-form-grid is-2">
              <div className="cv26-field">
                <label htmlFor={ids.products}>PRODUITS AFFECTÉS</label>
                <input id={ids.products} type="text" placeholder="Apache, OpenSSL, Windows…" value={form.products} onChange={(e) => setField('products', e.target.value)} />
                <small>Séparés par des virgules.</small>
              </div>
              <div className="cv26-field">
                <label htmlFor={ids.published}>DATE DE PUBLICATION</label>
                <input
                  id={ids.published}
                  type="date"
                  value={typeof form.published_at === 'string' ? form.published_at.slice(0, 10) : ''}
                  onChange={(e) => setField('published_at', e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="cv26-form-panel" aria-label="Notes et analyse">
            <div className="cv26-field">
              <label htmlFor={ids.notes}>NOTES &amp; ANALYSE</label>
              <textarea
                id={ids.notes}
                rows={7}
                placeholder="Impact dans notre environnement, POC disponible, patch appliqué le…"
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
              />
            </div>
          </section>

          <div className="cv26-form-actions">
            <button type="button" className="cv26-btn" onClick={() => navigate(backTo)} disabled={saving}>ANNULER</button>
            <button type="submit" className="cv26-btn is-primary" disabled={saving}>
              <Save size={15} aria-hidden="true" />
              {saving ? 'SAUVEGARDE...' : (isEdit ? 'METTRE À JOUR' : 'CRÉER LA CVE')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
