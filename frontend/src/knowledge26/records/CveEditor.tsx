import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Save } from 'lucide-react'
import { cveApi } from '@/api/client'
import type { CVECreateRequest, CVEEntry, CVESeverity, CVEStatus } from '@/types'
import { CvssMeter, SEVERITIES, SEVERITY_LABEL, STATUSES, STATUS_LABELS, cvssBand, splitProducts } from '@/cve26/parts'

/*
 * CVE create / edit inside Atlas, in the same archive-folder shell as the
 * dossier. Same rules and payload as the legacy CVEForm: CVE-ID format on
 * creation, CVSS kept as text so "not assessed" (empty), "0" and a score stay
 * distinct while typing (the backend stores 0 for both), publication date
 * defaulting to today. Severity and status are styled radio groups backed by
 * real inputs; the CVSS band only suggests a severity, it never overrides it.
 */

type FormState = Omit<CVECreateRequest, 'cvss_score'> & { cvss: string }
const CVE_ID = /^CVE-\d{4}-\d{4,}$/

function readCvss(text: string): { kind: 'unset' } | { kind: 'invalid' } | { kind: 'score'; value: number } {
  const trimmed = text.trim().replace(',', '.')
  if (!trimmed) return { kind: 'unset' }
  const value = Number(trimmed)
  return !Number.isFinite(value) || value < 0 || value > 10 ? { kind: 'invalid' } : { kind: 'score', value }
}

const fromEntry = (c?: CVEEntry): FormState => c ? {
  cve_id: c.cve_id, description: c.description, cvss: c.cvss_score === 0 && c.severity === 'none' ? '' : String(c.cvss_score),
  severity: c.severity, products: c.products, status: c.status, notes: c.notes, published_at: c.published_at ? c.published_at.slice(0, 10) : '',
} : { cve_id: '', description: '', cvss: '', severity: 'none', products: '', status: 'new', notes: '', published_at: new Date().toISOString().slice(0, 10) }

export default function CveEditor({ entry, onSaved, onClose }: { entry?: CVEEntry; onSaved: (value: CVEEntry) => void; onClose: () => void }) {
  const editing = Boolean(entry)
  const [form, setForm] = useState<FormState>(() => fromEntry(entry))
  const [error, setError] = useState('')
  const [invalid, setInvalid] = useState<{ cveId?: boolean; cvss?: boolean }>({})
  const [saving, setSaving] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const id = useId()
  const set = <K extends keyof FormState>(field: K, value: FormState[K]) => setForm(previous => ({ ...previous, [field]: value }))

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => { dialog?.close(); if (opener?.isConnected) opener.focus() }
  }, [])

  const cvss = readCvss(form.cvss)
  const band = cvss.kind === 'score' && cvss.value > 0 ? cvssBand(cvss.value) : null
  const products = splitProducts(form.products)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving) return
    const cveId = form.cve_id.trim()
    if (!cveId) { setInvalid({ cveId: true }); setError('Le CVE-ID est requis'); return }
    if (!editing && !CVE_ID.test(cveId)) { setInvalid({ cveId: true }); setError('Format de CVE-ID attendu : CVE-AAAA-NNNN'); return }
    if (cvss.kind === 'invalid') { setInvalid({ cvss: true }); setError('Le score CVSS doit être un nombre compris entre 0 et 10'); return }
    setInvalid({}); setError(''); setSaving(true)
    const { cvss: _text, ...fields } = form
    const payload: CVECreateRequest = {
      ...fields, cve_id: cveId, cvss_score: cvss.kind === 'score' ? cvss.value : 0,
      published_at: form.published_at ? new Date(form.published_at).toISOString() : new Date().toISOString(),
    }
    try { onSaved(entry ? await cveApi.update(entry.id, payload) : await cveApi.create(payload)) }
    catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erreur lors de la sauvegarde')
      setSaving(false)
    }
  }

  return createPortal(
    <dialog className="ka-dossier ka-cve-editor" ref={dialogRef} aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); onClose() }}>
      <div className="ka-dossier-scrim" onClick={onClose} aria-hidden="true" />
      <div className="ka-dossier-folder" data-source="CVE" data-severity={form.severity}>
        <span className="ka-dossier-tab" aria-hidden="true"><i />CVE · {editing ? `ÉDITION ${entry!.cve_id}` : 'NOUVELLE FICHE'}</span>
        <form className="ka-dossier-sheet" onSubmit={submit} noValidate aria-describedby={error ? `${id}-error` : undefined}>
          <header className="ka-dossier-head">
            <span>CVE · {editing ? 'MODIFIER LA FICHE' : 'CRÉER UNE FICHE'}</span>
            <button type="button" className="ka-dossier-close" onClick={onClose} aria-label="Fermer l’éditeur">✕</button>
          </header>
          <div className="ka-dossier-body">
            <div className="ka-dossier-title">
              <div className="ka-dossier-lead"><span className="ka-badge" data-source="CVE">CVE</span><code className="ka-dossier-id">{form.cve_id.trim() || 'CVE-AAAA-NNNN'}</code></div>
              <h2 id={`${id}-title`}>{editing ? 'Modifier la vulnérabilité' : 'Nouvelle vulnérabilité'}</h2>
              <p className="ka-dossier-signal">Enregistrée dans la collection CVE d’Atlas · KEV et EPSS sont enrichis à la consultation</p>
            </div>
            {error && <p id={`${id}-error`} role="alert" className="ka-form-error">{error}</p>}

            <section className="ka-sec">
              <header className="ka-sec-head"><span className="ka-sec-index">01</span><h3>IDENTIFICATION</h3></header>
              <div className="ka-sec-body ka-form-grid">
                <label className="ka-field is-span">
                  <span>CVE-ID *</span>
                  <input className="is-mono" value={form.cve_id} onChange={event => set('cve_id', event.target.value)} placeholder="CVE-2024-12345" readOnly={editing}
                    aria-invalid={invalid.cveId || undefined} autoComplete="off" spellCheck={false} />
                  <small>{editing ? 'L’identifiant d’une fiche existante n’est pas modifiable.' : 'Format CVE-AAAA-NNNN.'}</small>
                </label>
                <label className="ka-field is-span"><span>Description</span><textarea rows={4} value={form.description} onChange={event => set('description', event.target.value)} placeholder="Nature du défaut, composant touché, conditions d’exploitation…" /></label>
              </div>
            </section>

            <section className="ka-sec">
              <header className="ka-sec-head"><span className="ka-sec-index">02</span><h3>ÉVALUATION</h3></header>
              <div className="ka-sec-body ka-form-grid">
                <label className="ka-field">
                  <span>Score CVSS</span>
                  <input className="is-mono" inputMode="decimal" value={form.cvss} onChange={event => set('cvss', event.target.value)} placeholder="Non évalué" aria-invalid={invalid.cvss || undefined} />
                  <small>0 à 10. Vide : non évalué (enregistré 0.0).</small>
                </label>
                <div className="ka-field ka-cvss-live" data-severity={form.severity}>
                  <span>Aperçu</span>
                  {cvss.kind === 'score' && cvss.value > 0 ? <CvssMeter score={cvss.value} severity={form.severity} /> : <b>{cvss.kind === 'invalid' ? 'Valeur invalide' : cvss.kind === 'score' ? '0.0 · évalué à zéro' : 'Non évalué'}</b>}
                  {band && band !== form.severity && <button type="button" className="ka-suggest" onClick={() => set('severity', band)}>Plage CVSS : {SEVERITY_LABEL[band]} · appliquer</button>}
                </div>
                <fieldset className="ka-segment is-span">
                  <legend>Sévérité</legend>
                  <div>{SEVERITIES.map((value: CVESeverity) => <label key={value} data-severity={value}>
                    <input type="radio" name={`${id}-severity`} value={value} checked={form.severity === value} onChange={() => set('severity', value)} /><span><i aria-hidden="true" />{SEVERITY_LABEL[value]}</span>
                  </label>)}</div>
                </fieldset>
                <fieldset className="ka-segment is-span">
                  <legend>Statut</legend>
                  <div>{STATUSES.map((value: CVEStatus) => <label key={value}>
                    <input type="radio" name={`${id}-status`} value={value} checked={form.status === value} onChange={() => set('status', value)} /><span>{STATUS_LABELS[value]}</span>
                  </label>)}</div>
                </fieldset>
              </div>
            </section>

            <section className="ka-sec">
              <header className="ka-sec-head"><span className="ka-sec-index">03</span><h3>EXPOSITION</h3></header>
              <div className="ka-sec-body ka-form-grid">
                <label className="ka-field is-span">
                  <span>Produits affectés</span>
                  <input value={form.products} onChange={event => set('products', event.target.value)} placeholder="Apache, OpenSSL, Windows…" />
                  <small>Séparés par des virgules.</small>
                  {products.length > 0 && <ul className="ka-chip-list" aria-label="Produits saisis">{products.map(product => <li key={product}>{product}</li>)}</ul>}
                </label>
                <label className="ka-field"><span>Date de publication</span><input type="date" className="is-mono" value={form.published_at} onChange={event => set('published_at', event.target.value)} /></label>
              </div>
            </section>

            <section className="ka-sec">
              <header className="ka-sec-head"><span className="ka-sec-index">04</span><h3>ANALYST DATA</h3></header>
              <div className="ka-sec-body"><label className="ka-field"><span>Notes d’analyse</span><textarea rows={4} value={form.notes} onChange={event => set('notes', event.target.value)} placeholder="Exposition, correctif, contournement…" /></label></div>
            </section>
          </div>
          <footer className="ka-dossier-foot">
            <span>{editing ? 'Les modifications remplacent la fiche existante' : 'La fiche rejoint la collection CVE d’Atlas'}</span>
            <div className="ka-dossier-actions">
              <button type="button" onClick={onClose}>Annuler</button>
              <button type="submit" className="is-primary" disabled={saving}><Save size={13} /> {saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer la fiche'}</button>
            </div>
          </footer>
        </form>
      </div>
    </dialog>, document.body)
}
