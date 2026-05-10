import { useState, useMemo } from 'react'
import { Copy, Check, Wand2 } from 'lucide-react'
import type { InputField } from '@/types'

interface Props {
  template: string
  schemaJson: string
}

function shellEscape(value: string): string {
  if (/[\s"'`$\\<>|&;]/.test(value)) {
    return "'" + value.replace(/'/g, "'\\''") + "'"
  }
  return value
}

export default function CommandGenerator({ template, schemaJson }: Props) {
    // Validation messages use t() — built inside component so they react to lang change
  function validate(field: InputField, value: string): string | null {
    if (!value && field.required) return `Champ requis`
    if (!value) return null
    switch (field.type) {
      case 'ip': {
        const ok = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(value)
        return ok ? null : `Format IP attendu (ex: 192.168.1.10 ou 10.0.0.0/24)`
      }
      case 'domain': {
        const ok = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(value)
        return ok ? null : `Format domaine attendu (ex: example.com)`
      }
      case 'email': {
        const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        return ok ? null : `Format email attendu`
      }
      case 'url': {
        try { new URL(value); return null } catch { return `URL invalide` }
      }
      case 'username':
        return /\s/.test(value) ? `Pas d'espace dans un pseudo` : null
      case 'number':
        return /^\d+$/.test(value) ? null : `Nombre attendu`
      default:
        return null
    }
  }

  const fields: InputField[] = useMemo(() => {
    if (!schemaJson.trim()) return []
    try {
      const parsed = JSON.parse(schemaJson)
      return Array.isArray(parsed) ? parsed : []
    } catch { return [] }
  }, [schemaJson])

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    fields.forEach(f => { init[f.key] = f.default ?? '' })
    return init
  })

  const [copied, setCopied] = useState(false)

  const errors = useMemo(() => {
    const e: Record<string, string> = {}
    fields.forEach(f => {
      const err = validate(f, values[f.key] ?? '')
      if (err) e[f.key] = err
    })
    return e
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, values])

  const generatedCommand = useMemo(() => {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const v = values[key] ?? ''
      return v ? shellEscape(v) : `{{${key}}}`
    })
  }, [template, values])

  const allFilled = fields.every(f => !f.required || values[f.key])
  const hasErrors = Object.keys(errors).length > 0

  const copy = () => {
    navigator.clipboard.writeText(generatedCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!template) return null

  return (
    <div className="card mb-4">
      <h2 className="text-text-primary font-semibold flex items-center gap-2 mb-4 pb-3 border-b border-border">
        <Wand2 size={16} className="text-cyber-cyan" />
        {`Générateur de commande`}
      </h2>

      {fields.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-text-secondary text-sm mb-1">
                {f.label}
                {f.required && <span className="text-cyber-red ml-1">*</span>}
              </label>
              {f.type === 'select' && f.options ? (
                <select
                  value={values[f.key] ?? ''}
                  onChange={e => setValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="input"
                >
                  <option value="">{`— sélectionner —`}</option>
                  {f.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <input
                  type={f.type === 'number' ? 'number' : 'text'}
                  value={values[f.key] ?? ''}
                  onChange={e => setValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="input font-mono text-sm"
                />
              )}
              {errors[f.key] && <p className="text-cyber-red text-xs mt-1">{errors[f.key]}</p>}
              {f.helpText && !errors[f.key] && <p className="text-text-muted text-xs mt-1">{f.helpText}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <pre className={`bg-bg-primary border rounded-lg p-4 overflow-x-auto text-sm ${
          allFilled && !hasErrors ? 'border-cyber-green/40' : 'border-border'
        }`}>
          <code className="text-text-primary font-mono">{generatedCommand}</code>
        </pre>
        <button
          onClick={copy}
          disabled={!allFilled || hasErrors}
          className="absolute top-2 right-2 p-1.5 rounded bg-bg-hover border border-border hover:border-cyber-cyan text-text-muted hover:text-cyber-cyan transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]"
          title={hasErrors ? `Corrigez les erreurs avant de copier` : `Copier la commande`}
          aria-label="Copier"
        >
          {copied ? <Check size={12} className="text-cyber-green" /> : <Copy size={12} />}
        </button>
      </div>

      <p className="text-text-muted text-xs mt-2">{`⚠️ Cette commande est à exécuter dans votre propre terminal, jamais depuis Cyber-Hub.`}</p>
    </div>
  )
}
