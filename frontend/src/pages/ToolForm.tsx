// frontend/src/pages/ToolForm.tsx
import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { toolsApi } from '@/api/client'
import type { EthicalLevel, ToolCategory, ToolCreateRequest, ToolOS } from '@/types'
import { ArrowLeft, ChevronDown, Save } from 'lucide-react'
import ToolsHero from '@/tools26/ToolsHero'
import { ETHIC_HINT, ETHIC_LABEL } from '@/tools26/parts'
import '@/tools26/tools.css'

const SUBCATEGORIES = [
  'network', 'web', 'osint', 'brute-force', 'exploitation', 'active-directory',
  'forensics', 'ids-ips', 'wifi', 'reverse-engineering', 'password-cracking',
  'container-security', 'cloud-security', 'antivirus', 'siem-edr', 'autre',
]

const EMPTY: ToolCreateRequest = {
  name: '', category: 'osint', sub_category: 'osint', os: 'linux',
  description: '', install: '', usage: '', examples: '', defense: '',
  procedure: '', ethical_level: 'standard', legal_notes: '',
  ethical_use_cases: '', command_template: '', input_schema: '',
  user_notes: '', tags: '',
}

type Errors = Partial<Record<keyof ToolCreateRequest, string>>
type DocKey = 'procedure' | 'install' | 'usage' | 'examples' | 'defense'

/* Operational documentation, folded one per entry so the form stays scannable. */
const DOC_FIELDS: { key: DocKey; label: string; hint: string }[] = [
  { key: 'procedure', label: 'Procédure', hint: 'Déroulé opérationnel, étape par étape.' },
  { key: 'install', label: 'Installation', hint: 'Paquets, binaires, prérequis.' },
  { key: 'usage', label: 'Utilisation', hint: 'Syntaxe, options principales.' },
  { key: 'examples', label: 'Exemples', hint: 'Commandes commentées (# commentaire).' },
  { key: 'defense', label: 'Contre-mesures', hint: 'Détection, durcissement, réponse.' },
]

const STEPS = [
  { id: 'tl26-f-identity', label: 'Identité' },
  { id: 'tl26-f-class', label: 'Classification' },
  { id: 'tl26-f-command', label: 'Commandes' },
  { id: 'tl26-f-doc', label: 'Documentation' },
  { id: 'tl26-f-frame', label: 'Cadre & notes' },
]

const ERROR_ORDER: (keyof ToolCreateRequest)[] = ['name', 'description', 'input_schema']

export default function ToolForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = !!id

  const [form, setForm] = useState<ToolCreateRequest>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [loading, setLoading] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  // Documentation entries the user folded or unfolded; the others open when they hold text.
  const [openDocs, setOpenDocs] = useState<Partial<Record<DocKey, boolean>>>({})

  useEffect(() => {
    if (!isEdit) return
    toolsApi.get(Number(id)).then(toolData => setForm({
      name: toolData.name, category: toolData.category,
      sub_category: toolData.sub_category, os: toolData.os,
      description: toolData.description, install: toolData.install ?? '',
      usage: toolData.usage ?? '', examples: toolData.examples ?? '',
      defense: toolData.defense ?? '', procedure: toolData.procedure ?? '',
      ethical_level: toolData.ethical_level ?? 'standard',
      legal_notes: toolData.legal_notes ?? '',
      ethical_use_cases: toolData.ethical_use_cases ?? '',
      command_template: toolData.command_template ?? '',
      input_schema: toolData.input_schema ?? '',
      user_notes: toolData.user_notes ?? '', tags: toolData.tags ?? '',
    })).catch(() => {})
  }, [id, isEdit])

  const set = <K extends keyof ToolCreateRequest>(key: K, value: ToolCreateRequest[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const validate = () => {
    const e: Errors = {}
    if (!form.name.trim() || form.name.length < 2) e.name = 'NOM REQUIS (MIN 2 CARACTÈRES)'
    if (!form.description.trim() || form.description.length < 10) e.description = 'DESCRIPTION REQUISE (MIN 10 CARACTÈRES)'
    if (form.input_schema.trim()) {
      try { JSON.parse(form.input_schema) } catch { e.input_schema = 'JSON INVALIDE' }
    }
    setErrors(e)
    const first = ERROR_ORDER.find(k => e[k])
    if (first) document.getElementById(`tl26-in-${first}`)?.focus()
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    setSaveFailed(false)
    try {
      const tool = isEdit ? await toolsApi.update(Number(id), form) : await toolsApi.create(form)
      navigate(`/tools/${tool.id}`)
    } catch {
      setLoading(false)
      setSaveFailed(true)
    }
  }

  const isDocOpen = (key: DocKey) => openDocs[key] ?? Boolean(form[key].trim())
  const errorCount = Object.keys(errors).length

  /* Field wiring: label, input id, error message linked by aria-describedby. */
  const fieldProps = (key: keyof ToolCreateRequest, hintId?: string) => ({
    id: `tl26-in-${key}`,
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': [hintId, errors[key] ? `tl26-err-${key}` : ''].filter(Boolean).join(' ') || undefined,
  })
  const errorText = (key: keyof ToolCreateRequest) =>
    errors[key] ? <p id={`tl26-err-${key}`} className="tl26-field-error">{errors[key]}</p> : null

  return (
    <div className="tl26">
      <div className="tl26-frame">
        <ToolsHero status={{ text: isEdit ? 'MODIFICATION' : 'NOUVELLE FICHE', mark: isEdit ? `#${id}` : undefined, tone: 'busy' }} />

        <div className="tl26-crumbs">
          <Link to={isEdit ? `/tools/${id}` : '/tools'} className="tl26-link">
            <ArrowLeft size={14} aria-hidden="true" /> {isEdit ? 'Retour à la fiche' : 'Arsenal'}
          </Link>
        </div>

        <div className="tl26-form-layout">
          <nav className="tl26-steps" aria-label="Sections du formulaire">
            <p>{isEdit ? 'Modifier la fiche' : 'Nouvelle fiche'}</p>
            <ol>{STEPS.map((s, i) => <li key={s.id}><a href={`#${s.id}`}><span>{String(i + 1).padStart(2, '0')}</span>{s.label}</a></li>)}</ol>
          </nav>

          <form onSubmit={handleSubmit} className="tl26-form" noValidate>
            <h2 className="tl26-sr">{isEdit ? `Modifier ${form.name || "l'outil"}` : 'Créer un outil'}</h2>

            {/* 1. Identité */}
            <section id="tl26-f-identity" className="tl26-form-section" aria-labelledby="tl26-fh-identity">
              <header><span className="tl26-num">01</span><h3 id="tl26-fh-identity">Identité de l'outil</h3><small>Ce que l'on voit dans le registre</small></header>
              <div className="tl26-field">
                <label htmlFor="tl26-in-name">Nom <abbr title="obligatoire">*</abbr></label>
                <input {...fieldProps('name')} className="is-name" value={form.name} onChange={e => set('name', e.target.value)} placeholder="ex : nmap" autoComplete="off" />
                {errorText('name')}
              </div>
              <div className="tl26-field">
                <label htmlFor="tl26-in-description">Description <abbr title="obligatoire">*</abbr></label>
                <textarea {...fieldProps('description', 'tl26-hint-description')} value={form.description} onChange={e => set('description', e.target.value)} rows={3} placeholder="Description courte de l'outil…" />
                <small id="tl26-hint-description">Au moins 10 caractères. Affichée dans le registre et en tête de fiche.</small>
                {errorText('description')}
              </div>
              <div className="tl26-field">
                <label htmlFor="tl26-in-tags">Tags</label>
                <input {...fieldProps('tags', 'tl26-hint-tags')} value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="ex : réseau, scan, découverte" />
                <small id="tl26-hint-tags">Séparés par des virgules.</small>
              </div>
            </section>

            {/* 2. Classification */}
            <section id="tl26-f-class" className="tl26-form-section" aria-labelledby="tl26-fh-class">
              <header><span className="tl26-num">02</span><h3 id="tl26-fh-class">Classification</h3><small>Filtres de l'arsenal</small></header>
              <div className="tl26-form-grid is-3">
                <div className="tl26-field">
                  <label htmlFor="tl26-in-category">Catégorie <abbr title="obligatoire">*</abbr></label>
                  <select {...fieldProps('category')} value={form.category} onChange={e => set('category', e.target.value as ToolCategory)}>
                    <option value="offensive">Offensive</option>
                    <option value="defensive">Défensive</option>
                    <option value="osint">OSINT</option>
                  </select>
                </div>
                <div className="tl26-field">
                  <label htmlFor="tl26-in-sub_category">Sous-catégorie</label>
                  <select {...fieldProps('sub_category')} value={form.sub_category} onChange={e => set('sub_category', e.target.value)}>
                    {SUBCATEGORIES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="tl26-field">
                  <label htmlFor="tl26-in-os">OS <abbr title="obligatoire">*</abbr></label>
                  <select {...fieldProps('os')} value={form.os} onChange={e => set('os', e.target.value as ToolOS)}>
                    <option value="linux">Linux</option>
                    <option value="windows">Windows</option>
                    <option value="both">Linux + Windows</option>
                  </select>
                </div>
              </div>
              <fieldset className="tl26-ethic-pick">
                <legend>Niveau éthique</legend>
                {(['standard', 'elevated', 'warning'] as EthicalLevel[]).map(level => (
                  <label key={level} data-ethic={level}>
                    <input type="radio" name="ethical_level" value={level} checked={form.ethical_level === level} onChange={() => set('ethical_level', level)} />
                    <span><b><i aria-hidden="true" />{ETHIC_LABEL[level]}</b><small>{ETHIC_HINT[level]}</small></span>
                  </label>
                ))}
              </fieldset>
            </section>

            {/* 3. Commandes */}
            <section id="tl26-f-command" className="tl26-form-section" aria-labelledby="tl26-fh-command">
              <header><span className="tl26-num">03</span><h3 id="tl26-fh-command">Commandes & automatisation</h3><small>Générateur de commande</small></header>
              <div className="tl26-field">
                <label htmlFor="tl26-in-command_template">Gabarit de commande</label>
                <input {...fieldProps('command_template', 'tl26-hint-command')} className="is-code" value={form.command_template} onChange={e => set('command_template', e.target.value)} placeholder="nmap -p {{ports}} {{target}}" spellCheck={false} autoComplete="off" />
                <small id="tl26-hint-command">Paramètres entre doubles accolades : {'{{target}}'}.</small>
              </div>
              <div className="tl26-field">
                <label htmlFor="tl26-in-input_schema">Schéma JSON des paramètres</label>
                <textarea {...fieldProps('input_schema', 'tl26-hint-schema')} className="is-code" value={form.input_schema} onChange={e => set('input_schema', e.target.value)} rows={5} placeholder='[{"key": "target", "label": "Cible"}]' spellCheck={false} />
                <small id="tl26-hint-schema">Optionnel. Doit être un JSON valide.</small>
                {errorText('input_schema')}
              </div>
            </section>

            {/* 4. Documentation opérationnelle */}
            <section id="tl26-f-doc" className="tl26-form-section" aria-labelledby="tl26-fh-doc">
              <header><span className="tl26-num">04</span><h3 id="tl26-fh-doc">Documentation opérationnelle</h3><small>Markdown · blocs ``` pour les commandes</small></header>
              <div className="tl26-docs">
                {DOC_FIELDS.map(doc => {
                  const open = isDocOpen(doc.key)
                  const length = form[doc.key].trim().length
                  return (
                    <div key={doc.key} className={`tl26-doc-field${open ? ' is-open' : ''}`}>
                      <h4>
                        <button type="button" aria-expanded={open} aria-controls={`tl26-doc-${doc.key}`}
                          onClick={() => setOpenDocs(prev => ({ ...prev, [doc.key]: !open }))}>
                          <ChevronDown size={16} aria-hidden="true" />
                          <span>{doc.label}</span>
                          <small>{length ? `${length.toLocaleString('fr-FR')} caractères` : 'vide'}</small>
                        </button>
                      </h4>
                      <div id={`tl26-doc-${doc.key}`} className="tl26-field" hidden={!open}>
                        <label htmlFor={`tl26-in-${doc.key}`} className="tl26-sr">{doc.label} (Markdown)</label>
                        <textarea {...fieldProps(doc.key, `tl26-hint-${doc.key}`)} className="is-code" value={form[doc.key]} onChange={e => set(doc.key, e.target.value)} rows={9} spellCheck={false} />
                        <small id={`tl26-hint-${doc.key}`}>{doc.hint}</small>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* 5. Cadre éthique & notes */}
            <section id="tl26-f-frame" className="tl26-form-section" aria-labelledby="tl26-fh-frame">
              <header><span className="tl26-num">05</span><h3 id="tl26-fh-frame">Cadre éthique & notes</h3><small>Markdown</small></header>
              <div className="tl26-form-grid is-2">
                <div className="tl26-field">
                  <label htmlFor="tl26-in-legal_notes">Notes légales</label>
                  <textarea {...fieldProps('legal_notes')} value={form.legal_notes} onChange={e => set('legal_notes', e.target.value)} rows={5} />
                </div>
                <div className="tl26-field">
                  <label htmlFor="tl26-in-ethical_use_cases">Cas d'usage éthique</label>
                  <textarea {...fieldProps('ethical_use_cases')} value={form.ethical_use_cases} onChange={e => set('ethical_use_cases', e.target.value)} rows={5} />
                </div>
              </div>
              <div className="tl26-field">
                <label htmlFor="tl26-in-user_notes">Notes personnelles</label>
                <textarea {...fieldProps('user_notes')} value={form.user_notes} onChange={e => set('user_notes', e.target.value)} rows={5} />
              </div>
            </section>

            <div className="tl26-form-bar">
              <div className="tl26-form-bar-msg" role="alert">
                {errorCount > 0 && <span className="is-error">{errorCount} champ{errorCount > 1 ? 's' : ''} à corriger</span>}
                {saveFailed && <span className="is-error">Enregistrement impossible. Réessaie.</span>}
              </div>
              <button type="button" className="tl26-btn" onClick={() => navigate(-1)} disabled={loading}>Annuler</button>
              <button type="submit" className="tl26-btn is-primary" disabled={loading}>
                <Save size={15} aria-hidden="true" /> {loading ? 'Enregistrement…' : isEdit ? 'Sauvegarder' : "Créer l'outil"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
