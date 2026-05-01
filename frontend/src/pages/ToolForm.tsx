import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toolsApi } from '@/api/client'
import type { EthicalLevel, ToolCategory, ToolCreateRequest, ToolOS } from '@/types'
import { ArrowLeft, Save } from 'lucide-react'

const SUBCATEGORIES = [
  'network', 'web', 'osint', 'brute-force', 'exploitation', 'active-directory',
  'forensics', 'ids-ips', 'wifi', 'reverse-engineering', 'password-cracking',
  'container-security', 'cloud-security', 'antivirus', 'siem-edr', 'autre',
]

const EMPTY: ToolCreateRequest = {
  name: '',
  category: 'osint',
  sub_category: 'osint',
  os: 'linux',
  description: '',
  install: '',
  usage: '',
  examples: '',
  defense: '',
  procedure: '',
  ethical_level: 'standard',
  legal_notes: '',
  ethical_use_cases: '',
  command_template: '',
  input_schema: '',
  user_notes: '',
  tags: '',
}

// Sections Markdown dans l'ordre d'affichage du formulaire
const MD_SECTIONS: { key: keyof ToolCreateRequest; label: string; placeholder: string }[] = [
  { key: 'procedure',         label: 'Procédure pas-à-pas',                         placeholder: '## Étape 1\n...\n\n## Étape 2\n...' },
  { key: 'install',           label: 'Installation',                                 placeholder: '```bash\nsudo apt install ...\n```' },
  { key: 'usage',             label: 'Utilisation',                                  placeholder: '```bash\nnomoutil --help\n```' },
  { key: 'examples',          label: 'Exemples',                                     placeholder: '```bash\n# exemple\n```' },
  { key: 'defense',           label: 'Détection & Contre-mesures',                  placeholder: '**Détection** : ...\n\n**Contre-mesures** : ...' },
  { key: 'legal_notes',       label: '⚠️ Notes légales (Art. 323-1, scope, etc.)',  placeholder: 'Rappel : usage uniquement avec autorisation écrite...' },
  { key: 'ethical_use_cases', label: 'Cas d\'usage éthiques',                       placeholder: 'Lab perso · CTF · bug bounty avec scope signé · audit interne...' },
  { key: 'user_notes',        label: 'Notes personnelles (privées)',                placeholder: 'Tes notes perso, séparées du contenu pédagogique officiel.' },
]

export default function ToolForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = !!id
  const [form, setForm] = useState<ToolCreateRequest>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof ToolCreateRequest, string>>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isEdit) return
    toolsApi.get(Number(id)).then(t => setForm({
      name: t.name,
      category: t.category,
      sub_category: t.sub_category,
      os: t.os,
      description: t.description,
      install: t.install ?? '',
      usage: t.usage ?? '',
      examples: t.examples ?? '',
      defense: t.defense ?? '',
      procedure: t.procedure ?? '',
      ethical_level: t.ethical_level ?? 'standard',
      legal_notes: t.legal_notes ?? '',
      ethical_use_cases: t.ethical_use_cases ?? '',
      command_template: t.command_template ?? '',
      input_schema: t.input_schema ?? '',
      user_notes: t.user_notes ?? '',
      tags: t.tags ?? '',
    })).catch(() => {})
  }, [id, isEdit])

  const set = <K extends keyof ToolCreateRequest>(key: K, value: ToolCreateRequest[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const validate = () => {
    const e: typeof errors = {}
    if (!form.name.trim() || form.name.length < 2) e.name = 'Nom requis (min 2 caractères)'
    if (!form.description.trim() || form.description.length < 10) e.description = 'Description requise (min 10 caractères)'
    // input_schema doit être un JSON valide s'il est fourni
    if (form.input_schema.trim()) {
      try { JSON.parse(form.input_schema) } catch { e.input_schema = 'JSON invalide' }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const tool = isEdit ? await toolsApi.update(Number(id), form) : await toolsApi.create(form)
      navigate(`/tools/${tool.id}`)
    } catch { setLoading(false) }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-text-secondary hover:text-cyber-cyan transition-colors text-sm">
          <ArrowLeft size={16} /> Retour
        </button>
        <h1 className="text-2xl font-bold text-text-primary">
          <span className="text-cyber-cyan">&gt;</span> {isEdit ? "Modifier la fiche" : 'Nouvelle fiche outil'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Bloc 1 : Informations de base ───────────────────────── */}
        <div className="card space-y-4">
          <h2 className="text-text-primary font-semibold pb-3 border-b border-border">Informations de base</h2>

          <div>
            <label className="block text-text-secondary text-sm mb-1">Nom *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="ex: Sherlock, Wireshark…" />
            {errors.name && <p className="text-cyber-red text-xs mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-text-secondary text-sm mb-1">Catégorie *</label>
              <select value={form.category} onChange={e => set('category', e.target.value as ToolCategory)} className="input">
                <option value="osint">🔍 OSINT</option>
                <option value="defensive">🟢 Défensif</option>
                <option value="offensive">🔴 Offensif</option>
              </select>
            </div>
            <div>
              <label className="block text-text-secondary text-sm mb-1">Sous-catégorie *</label>
              <select value={form.sub_category} onChange={e => set('sub_category', e.target.value)} className="input">
                {SUBCATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-text-secondary text-sm mb-1">OS *</label>
              <select value={form.os} onChange={e => set('os', e.target.value as ToolOS)} className="input">
                <option value="linux">Linux</option>
                <option value="windows">Windows</option>
                <option value="both">Les deux</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-text-secondary text-sm mb-1">Description *</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} className="input resize-none" placeholder="Description courte et claire…" />
            {errors.description && <p className="text-cyber-red text-xs mt-1">{errors.description}</p>}
          </div>

          <div>
            <label className="block text-text-secondary text-sm mb-1">Tags <span className="text-text-muted">(séparés par virgules)</span></label>
            <input value={form.tags} onChange={e => set('tags', e.target.value)} className="input" placeholder="osint, username, recon…" />
          </div>
        </div>

        {/* ── Bloc 2 : Encadrement éthique ────────────────────────── */}
        <div className="card space-y-4">
          <h2 className="text-text-primary font-semibold pb-3 border-b border-border">Encadrement éthique</h2>

          <div>
            <label className="block text-text-secondary text-sm mb-1">Niveau éthique *</label>
            <select value={form.ethical_level} onChange={e => set('ethical_level', e.target.value as EthicalLevel)} className="input">
              <option value="standard">🟢 Standard — défensif / OSINT pur</option>
              <option value="elevated">🟡 Élevé — bug bounty / audit autorisé requis</option>
              <option value="warning">🔴 Avertissement — pédagogique, rappel Art. 323-1</option>
            </select>
            <p className="text-text-muted text-xs mt-1">
              Détermine les bandeaux d'avertissement affichés sur la fiche.
            </p>
          </div>
        </div>

        {/* ── Bloc 3 : Générateur de commande ─────────────────────── */}
        <div className="card space-y-4">
          <h2 className="text-text-primary font-semibold pb-3 border-b border-border">
            Générateur de commande paramétrable
            <span className="text-text-muted text-xs font-normal ml-2">(optionnel)</span>
          </h2>

          <div>
            <label className="block text-text-secondary text-sm mb-1">Template de commande</label>
            <input
              value={form.command_template}
              onChange={e => set('command_template', e.target.value)}
              className="input font-mono text-sm"
              placeholder="ex: sherlock {{username}} --timeout {{timeout}}"
            />
            <p className="text-text-muted text-xs mt-1">
              Utilise <code className="text-cyber-cyan">{'{{key}}'}</code> pour les paramètres définis ci-dessous.
            </p>
          </div>

          <div>
            <label className="block text-text-secondary text-sm mb-1">Schéma des paramètres (JSON)</label>
            <textarea
              value={form.input_schema}
              onChange={e => set('input_schema', e.target.value)}
              rows={6}
              className="input resize-y font-mono text-xs"
              placeholder={`[\n  { "key": "username", "label": "Pseudo", "type": "username", "required": true },\n  { "key": "timeout", "label": "Timeout (s)", "type": "number", "default": "10" }\n]`}
            />
            {errors.input_schema && <p className="text-cyber-red text-xs mt-1">{errors.input_schema}</p>}
          </div>
        </div>

        {/* ── Bloc 4 : Sections Markdown ──────────────────────────── */}
        {MD_SECTIONS.map(section => (
          <div key={section.key} className="card">
            <label className="block text-text-primary font-semibold mb-3 pb-3 border-b border-border">
              {section.label}
              <span className="text-text-muted text-xs font-normal ml-2">(Markdown)</span>
            </label>
            <textarea
              value={form[section.key] as string}
              onChange={e => set(section.key, e.target.value as never)}
              rows={6}
              className="input resize-y font-mono text-sm"
              placeholder={section.placeholder}
            />
          </div>
        ))}

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary" disabled={loading}>Annuler</button>
          <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
            <Save size={16} />
            {loading ? 'Sauvegarde…' : isEdit ? 'Mettre à jour' : 'Créer la fiche'}
          </button>
        </div>
      </form>
    </div>
  )
}
