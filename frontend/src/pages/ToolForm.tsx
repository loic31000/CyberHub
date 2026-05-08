// frontend/src/pages/ToolForm.tsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toolsApi } from '@/api/client'
import type { EthicalLevel, ToolCategory, ToolCreateRequest, ToolOS } from '@/types'
import { ArrowLeft, Save, Wrench } from 'lucide-react'

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

export default function ToolForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = !!id

  const [form, setForm] = useState<ToolCreateRequest>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof ToolCreateRequest, string>>>({})
  const [loading, setLoading] = useState(false)

  const MD_SECTIONS: { key: keyof ToolCreateRequest; label: string }[] = [
    { key: 'procedure', label: 'PROCÉDURE' },
    { key: 'install', label: 'INSTALLATION' },
    { key: 'usage', label: 'UTILISATION' },
    { key: 'examples', label: 'EXEMPLES' },
    { key: 'defense', label: 'CONTRE-MESURES' },
    { key: 'legal_notes', label: 'NOTES LÉGALES' },
    { key: 'ethical_use_cases', label: "CAS D'USAGE ÉTHIQUE" },
    { key: 'user_notes', label: 'NOTES PERSONNELLES' },
  ]

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
    const e: Partial<Record<keyof ToolCreateRequest, string>> = {}
    if (!form.name.trim() || form.name.length < 2) e.name = 'NOM REQUIS (MIN 2 CARACTÈRES)'
    if (!form.description.trim() || form.description.length < 10) e.description = 'DESCRIPTION REQUISE (MIN 10 CARACTÈRES)'
    if (form.input_schema.trim()) {
      try { JSON.parse(form.input_schema) } catch { e.input_schema = 'JSON INVALIDE' }
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
    } catch {
      setLoading(false)
    }
  }

  const fieldClass = 'w-full border border-[#1e2d40] bg-[#0d131f] px-4 py-2.5 font-mono text-sm text-[#f1f5f9] placeholder-[#334155] outline-none transition-colors focus:border-[#00d4ff]/50'
  const textAreaClass = `${fieldClass} resize-y`
  const labelClass = 'mb-2 block font-mono text-[10px] font-bold uppercase tracking-widest text-[#8a9ab0]'

  return (
    <div className="flex flex-col h-full bg-[#06080f] text-[#f1f5f9]">
      {/* Bandeau d'en-tête style BGPLookup */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d40] bg-[#0a0f16]/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Wrench className="text-[#00d4ff]" size={20} />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#10b981] rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase">TOOL ARSENAL // FORM</h1>
            <p className="text-[10px] text-[#64748b] font-mono">{isEdit ? 'MODIFICATION DE FICHE EXISTANTE' : 'CRÉATION D\'UNE NOUVELLE FICHE'}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/tools')}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2d40] hover:bg-[#2a3f55] text-[10px] font-bold border border-[#334155] transition-colors"
          >
            <ArrowLeft size={12} /> BACK TO ARSENAL
          </button>
        </div>
      </div>

      {/* Zone de contenu scrollable */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto w-full space-y-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Informations de base */}
            <div className="space-y-6 border border-[#1e2d40] bg-[#0a0f16] p-6">
              <h2 className="border-b border-[#1e2d40] pb-3 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#00d4ff]">INFORMATIONS DE BASE</h2>
              
              <div>
                <label className={labelClass}>NOM *</label>
                <input 
                  value={form.name} 
                  onChange={e => set('name', e.target.value)} 
                  className={fieldClass} 
                  placeholder="EX: NMAP" 
                />
                {errors.name && <p className="mt-2 font-mono text-[10px] text-[#ef4444] uppercase tracking-widest">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className={labelClass}>CATÉGORIE *</label>
                  <select value={form.category} onChange={e => set('category', e.target.value as ToolCategory)} className={fieldClass}>
                    <option value="offensive">OFFENSIVE</option>
                    <option value="defensive">DEFENSIVE</option>
                    <option value="osint">OSINT</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>SOUS-CATÉGORIE</label>
                  <select value={form.sub_category} onChange={e => set('sub_category', e.target.value)} className={fieldClass}>
                    {SUBCATEGORIES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                 <label className={labelClass}>OS *</label>
                 <select value={form.os} onChange={e => set('os', e.target.value as ToolOS)} className={fieldClass}>
                  <option value="linux">LINUX</option>
                  <option value="windows">WINDOWS</option>
                  <option value="both">BOTH (LINUX + WINDOWS)</option>
                 </select>
                </div>
                <div>
                  <label className={labelClass}>NIVEAU ÉTHIQUE</label>
                  <select value={form.ethical_level} onChange={e => set('ethical_level', e.target.value as EthicalLevel)} className={fieldClass}>
                    <option value="standard">STANDARD</option>
                    <option value="elevated">ELEVATED</option>
                    <option value="warning">WARNING</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>DESCRIPTION *</label>
                <textarea 
                  value={form.description} 
                  onChange={e => set('description', e.target.value)} 
                  rows={3} 
                  className={textAreaClass} 
                  placeholder="DESCRIPTION COURTE DE L'OUTIL..." 
                />
                {errors.description && <p className="mt-2 font-mono text-[10px] text-[#ef4444] uppercase tracking-widest">{errors.description}</p>}
              </div>

              <div>
                <label className={labelClass}>TAGS (SÉPARÉS PAR DES VIRGULES)</label>
                <input 
                  value={form.tags} 
                  onChange={e => set('tags', e.target.value)} 
                  className={fieldClass} 
                  placeholder="EX: RÉSEAU, SCAN, DÉCOUVERTE" 
                />
              </div>
            </div>

            {/* Générateur de commandes */}
            <div className="space-y-6 border border-[#1e2d40] bg-[#0a0f16] p-6">
              <h2 className="border-b border-[#1e2d40] pb-3 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#00d4ff]">GÉNÉRATEUR DE COMMANDES</h2>
              <div>
                <label className={labelClass}>TEMPLATE DE COMMANDE</label>
                <input 
                  value={form.command_template} 
                  onChange={e => set('command_template', e.target.value)} 
                  className={fieldClass} 
                  placeholder="EX: nmap -p {{ports}} {{target}}" 
                />
              </div>
              <div>
                <label className={labelClass}>SCHEMA JSON (PARAMÈTRES)</label>
                <textarea 
                  value={form.input_schema} 
                  onChange={e => set('input_schema', e.target.value)} 
                  rows={4} 
                  className={textAreaClass} 
                  placeholder='[{"name": "target", "type": "string"}, ...]' 
                />
                {errors.input_schema && <p className="mt-2 font-mono text-[10px] text-[#ef4444] uppercase tracking-widest">{errors.input_schema}</p>}
              </div>
            </div>

            {/* Sections Markdown */}
            {MD_SECTIONS.map(section => (
              <div key={section.key} className="space-y-3 border border-[#1e2d40] bg-[#0a0f16] p-6">
                <label className="block border-b border-[#1e2d40] pb-3 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a9ab0]">
                  {section.label} <span className="ml-2 text-[9px] font-normal text-[#64748b] tracking-normal">(MARKDOWN)</span>
                </label>
                <textarea
                  value={form[section.key] as string}
                  onChange={e => set(section.key, e.target.value as never)}
                  rows={8}
                  className={textAreaClass}
                />
              </div>
            ))}

            {/* Actions de formulaire */}
            <div className="flex justify-end gap-4 pt-4 pb-8 border-t border-[#1e2d40]">
              <button
                type="button"
                onClick={() => navigate(-1)}
                disabled={loading}
                className="border border-[#1e2d40] bg-[#0a0f16] px-6 py-3 font-mono text-xs uppercase tracking-widest text-[#8a9ab0] transition-colors hover:bg-[#1e2d40] hover:text-[#f1f5f9]"
              >
                ANNULER
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 border border-[#00d4ff]/20 bg-[#00d4ff]/10 px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest text-[#00d4ff] transition-colors hover:bg-[#00d4ff]/20 disabled:opacity-50"
              >
                <Save size={15} /> {isEdit ? 'SAUVEGARDER' : 'CRÉER L\'OUTIL'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}