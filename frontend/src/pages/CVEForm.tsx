import { useState, useEffect, useId, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { cveApi } from '@/api/client'
import { toast } from '@/store/toast'
import type { CVECreateRequest, CVESeverity, CVEStatus } from '@/types'
import { ArrowLeft, Save } from 'lucide-react'
import CveHero from '@/cve26/CveHero'
import {
  CvssMeter, SEVERITIES, SEVERITY_LABEL, STATUSES, STATUS_LABELS, SeverityBadge, StatusBadge,
  cvssBand, formatDay, splitProducts,
} from '@/cve26/parts'
import '@/cve26/cve.css'

/*
 * The CVSS field is text, so that three cases stay apart while typing: empty
 * (not assessed), "0" (assessed at zero) and a score above zero. The backend
 * stores a number only (cvss_score, default 0), so "not assessed" is saved as
 * 0 and cannot be told apart from a zero score once saved; a stored 0 with no
 * severity is shown as "not assessed or 0.0". Keeping the difference needs a
 * nullable score (or a "not assessed" flag) in the backend model.
 */
type FormState = Omit<CVECreateRequest, 'cvss_score'> & { cvss: string }

// Today's date at the time the form opens, not when the module was loaded.
const defaultForm = (): FormState => ({
  cve_id: '',
  description: '',
  cvss: '',
  severity: 'none',
  products: '',
  status: 'new',
  notes: '',
  published_at: new Date().toISOString().slice(0, 10),
})

const CVE_ID = /^CVE-\d{4}-\d{4,}$/

/** The CVSS field read as: not assessed, an invalid value, or a score. */
function readCvss(text: string): { kind: 'unset' } | { kind: 'invalid' } | { kind: 'score'; value: number } {
  const trimmed = text.trim().replace(',', '.')
  if (!trimmed) return { kind: 'unset' }
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value < 0 || value > 10) return { kind: 'invalid' }
  return { kind: 'score', value }
}

/** What the user has entered, as it will be saved; nothing is derived or fetched. */
function Summary({ form, isEdit, storedAsZero }: { form: FormState; isEdit: boolean; storedAsZero: boolean }) {
  const cvss = readCvss(form.cvss)
  const products = splitProducts(form.products)
  const published = typeof form.published_at === 'string' ? form.published_at : ''
  const band = cvss.kind === 'score' && cvss.value > 0 ? cvssBand(cvss.value) : null
  return (
    <aside className="cv26-summary" aria-labelledby="cv26-summary-title">
      <header>
        <h2 id="cv26-summary-title">Récapitulatif</h2>
        <small>{isEdit ? 'Aperçu des modifications, non enregistrées' : 'Aperçu de la saisie, non enregistrée'}</small>
      </header>
      <p className={`cv26-summary-id${form.cve_id.trim() ? '' : ' is-empty'}`}>{form.cve_id.trim() || 'CVE-ID non renseigné'}</p>
      <dl className="cv26-summary-facts">
        <div>
          <dt>Score CVSS</dt>
          <dd data-cvss={cvss.kind === 'score' ? (cvss.value > 0 ? 'scored' : 'zero') : cvss.kind}>
            {cvss.kind === 'unset' && (storedAsZero
              ? <>Non évalué ou 0.0<small>La fiche enregistre 0.0 : le backend ne distingue pas « non évalué » d’un score nul.</small></>
              : <>Non évalué<small>Sera enregistré comme 0.0.</small></>)}
            {cvss.kind === 'invalid' && <span className="cv26-summary-warn">Valeur invalide (0 à 10)</span>}
            {cvss.kind === 'score' && cvss.value === 0 && <>0.0 <small>Évalué à zéro</small></>}
            {cvss.kind === 'score' && cvss.value > 0 && <CvssMeter score={cvss.value} severity={form.severity} />}
          </dd>
        </div>
        <div>
          <dt>Sévérité</dt>
          <dd>
            <SeverityBadge severity={form.severity} />
            {band && band !== form.severity && <small>Plage CVSS v3.x du score : {SEVERITY_LABEL[band]}</small>}
          </dd>
        </div>
        <div><dt>Statut</dt><dd><StatusBadge status={form.status} /></dd></div>
        <div>
          <dt>Produits concernés</dt>
          <dd>
            {products.length
              ? <ul className="cv26-product-list">{products.map(p => <li key={p}>{p}</li>)}</ul>
              : <span className="cv26-muted">Aucun produit saisi</span>}
          </dd>
        </div>
        <div>
          <dt>Publication</dt>
          <dd>{published ? formatDay(published) : <span className="cv26-muted">Non renseignée : la date du jour sera enregistrée</span>}</dd>
        </div>
      </dl>
    </aside>
  )
}

export default function CVEForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [form, setForm] = useState<FormState>(defaultForm)
  const [storedAsZero, setStoredAsZero] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [invalid, setInvalid] = useState<{ cveId?: boolean; cvss?: boolean }>({})
  const submitting = useRef(false)
  const ids = { error: useId(), cveId: useId(), cveIdHint: useId(), description: useId(), cvss: useId(), cvssHint: useId(), severity: useId(), status: useId(), products: useId(), published: useId(), notes: useId() }

  useEffect(() => {
    if (!isEdit || !id) return
    const controller = new AbortController()
    const { signal } = controller
    cveApi.get(Number(id), signal)
      .then((c) => {
        if (signal.aborted) return
        // A stored 0 with no severity reads as "not assessed"; any other 0 was rated.
        const unrated = c.cvss_score === 0 && c.severity === 'none'
        setStoredAsZero(unrated)
        setForm({
          cve_id: c.cve_id,
          description: c.description,
          cvss: unrated ? '' : String(c.cvss_score),
          severity: c.severity,
          products: c.products,
          status: c.status,
          notes: c.notes,
          published_at: c.published_at ? c.published_at.slice(0, 10) : '',
        })
      })
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
    const cveId = form.cve_id.trim()
    const cvss = readCvss(form.cvss)
    if (!cveId) { setInvalid({ cveId: true }); setError('Le CVE-ID est requis'); return }
    if (!isEdit && !CVE_ID.test(cveId)) { setInvalid({ cveId: true }); setError('Format de CVE-ID attendu : CVE-AAAA-NNNN'); return }
    if (cvss.kind === 'invalid') { setInvalid({ cvss: true }); setError('Le score CVSS doit être un nombre compris entre 0 et 10'); return }
    setInvalid({})
    submitting.current = true
    setSaving(true)
    setError('')
    const { cvss: _text, ...fields } = form
    const payload: CVECreateRequest = {
      ...fields,
      cve_id: cveId,
      cvss_score: cvss.kind === 'score' ? cvss.value : 0,
      published_at: form.published_at ? new Date(form.published_at).toISOString() : new Date().toISOString(),
    }
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

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [field]: value }))

  const hero = <CveHero status={isEdit ? { text: 'ÉDITION', mark: form.cve_id || undefined } : { text: 'CRÉATION', mark: 'NOUVELLE CVE' }} />

  if (loading) {
    return <div className="cv26"><div className="cv26-frame">{hero}<div className="cv26-loading" role="status">Chargement de la fiche…</div></div></div>
  }

  const cvss = readCvss(form.cvss)
  const suggested = cvss.kind === 'score' && cvss.value > 0 ? cvssBand(cvss.value) : null
  const backTo = isEdit && id ? `/cve/${id}` : '/cve'

  return (
    <div className="cv26">
      <div className="cv26-frame">
        {hero}

        <nav className="cv26-crumbs" aria-label="Navigation">
          <Link to={backTo} className="cv26-link"><ArrowLeft size={14} aria-hidden="true" /> {isEdit ? 'Retour à la fiche' : 'Index CVE & KEV'}</Link>
        </nav>

        <div className="cv26-form-layout">
          <form onSubmit={handleSubmit} className="cv26-form" aria-describedby={error ? ids.error : undefined} noValidate>
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
                  required
                  aria-invalid={invalid.cveId || undefined}
                  aria-describedby={ids.cveIdHint}
                  autoComplete="off"
                  spellCheck={false}
                />
                <small id={ids.cveIdHint}>{isEdit ? 'L’identifiant d’une fiche existante ne se modifie pas.' : 'Format CVE-AAAA-NNNN.'}</small>
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
                    type="text"
                    inputMode="decimal"
                    className="is-mono"
                    placeholder="Non évalué"
                    value={form.cvss}
                    aria-invalid={invalid.cvss || undefined}
                    aria-describedby={ids.cvssHint}
                    onChange={(e) => setField('cvss', e.target.value)}
                    autoComplete="off"
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
                <span>Score de base de 0 à 10. Vide : non évalué ; 0 : évalué à zéro. La sévérité reste celle que vous choisissez.</span>
                {suggested && suggested !== form.severity && (
                  <>
                    <span>Le score {cvss.kind === 'score' ? cvss.value.toFixed(1) : ''} correspond à « {SEVERITY_LABEL[suggested]} » (plages CVSS v3).</span>
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

          <Summary form={form} isEdit={isEdit} storedAsZero={storedAsZero && !form.cvss.trim()} />
        </div>
      </div>
    </div>
  )
}
