import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toolsApi } from '@/api/client'
import type { EthicalLevel, Tool } from '@/types'
import ReactMarkdown from 'react-markdown'
import {
  ArrowLeft, Pencil, Trash2, Monitor, Globe, Copy, Check, Terminal,
  Download, ShieldAlert, BookOpen, Scale, FileText, AlertTriangle, Info,
} from 'lucide-react'
import ConfirmModal from '@/components/ConfirmModal'
import CommandGenerator from '@/components/CommandGenerator'
import { toast } from '@/store/toast'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="absolute top-2 right-2 p-1.5 rounded bg-bg-hover border border-border hover:border-cyber-cyan text-text-muted hover:text-cyber-cyan transition-colors">
      {copied ? <Check size={12} className="text-cyber-green" /> : <Copy size={12} />}
    </button>
  )
}

function MarkdownSection({ title, content, icon }: { title: string; content: string; icon: React.ReactNode }) {
  if (!content) return null
  return (
    <div className="card mb-4">
      <h2 className="text-text-primary font-semibold flex items-center gap-2 mb-4 pb-3 border-b border-border">{icon}{title}</h2>
      <div className="prose-cyber">
        <ReactMarkdown components={{
          code({ children, className }) {
            const isBlock = className?.includes('language-')
            if (isBlock) return (
              <div className="relative group">
                <pre className="bg-bg-primary border border-border rounded-lg p-4 overflow-x-auto my-3 text-sm">
                  <code className="text-text-primary font-mono">{children}</code>
                </pre>
                <CopyButton text={String(children)} />
              </div>
            )
            return <code className="text-cyber-cyan bg-bg-primary px-1.5 py-0.5 rounded text-sm">{children}</code>
          }
        }}>{content}</ReactMarkdown>
      </div>
    </div>
  )
}

// Bandeau d'avertissement éthique en haut de la fiche selon le niveau.
function EthicalBanner({ level }: { level: EthicalLevel }) {
  if (level === 'standard') return null

  const isWarning = level === 'warning'
  const cls = isWarning
    ? 'border-cyber-red/50 bg-cyber-red/10 text-cyber-red'
    : 'border-cyber-orange/50 bg-cyber-orange/10 text-cyber-orange'
  const Icon = isWarning ? AlertTriangle : Info
  const title = isWarning
    ? "Outil offensif — référencé à titre pédagogique uniquement"
    : "Usage réglementé — autorisation écrite obligatoire"
  const body = isWarning
    ? "L'utilisation de cet outil contre un système sans autorisation est punie par le Code Pénal (Art. 323-1 à 323-7 en France). Cyber-Hub ne lance pas cet outil — il est documenté ici uniquement à des fins éducatives et défensives (CTF, lab perso, recherche académique)."
    : "Légal uniquement dans le cadre d'un audit autorisé : tes propres systèmes, lab personnel, CTF, programme de bug bounty avec scope écrit. Toute utilisation hors de ce cadre relève du Code Pénal Art. 323-1 à 323-7."

  return (
    <div className={`border rounded-lg p-4 mb-6 flex gap-3 items-start ${cls}`}>
      <Icon size={20} className="flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold text-sm mb-1">{title}</p>
        <p className="text-xs leading-relaxed opacity-90">{body}</p>
      </div>
    </div>
  )
}

function EthicalBadge({ level }: { level: EthicalLevel }) {
  const cfg = {
    standard: { label: '🟢 Standard', cls: 'border-cyber-green/40 text-cyber-green' },
    elevated: { label: '🟡 Élevé',    cls: 'border-cyber-orange/40 text-cyber-orange' },
    warning:  { label: '🔴 Avertissement', cls: 'border-cyber-red/40 text-cyber-red' },
  }[level] ?? { label: level, cls: 'border-border text-text-muted' }
  return <span className={`badge-tag ${cfg.cls}`}>{cfg.label}</span>
}

export default function ToolDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tool, setTool] = useState<Tool | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [showNotes, setShowNotes] = useState(false)

  useEffect(() => {
    if (!id) return
    toolsApi.get(Number(id)).then(setTool).catch(() => setTool(null)).finally(() => setLoading(false))
  }, [id])

  const handleDelete = async () => {
    if (!tool) return
    setDeleting(true)
    try {
      await toolsApi.delete(Number(id))
      toast.success(`Fiche "${tool.name}" supprimée`)
      navigate('/tools')
    } catch {
      toast.error('Erreur lors de la suppression')
      setDeleting(false)
    }
  }

  if (loading) return (
    <div className="p-8 animate-pulse">
      <div className="h-6 bg-bg-card rounded w-1/4 mb-4" />
      <div className="h-10 bg-bg-card rounded w-1/2 mb-8" />
      <div className="card h-32" />
    </div>
  )

  if (!tool) return (
    <div className="p-8 text-center">
      <p className="text-text-muted">Fiche non trouvée</p>
      <button onClick={() => navigate('/tools')} className="btn-primary mt-4">Retour</button>
    </div>
  )

  const tags = tool.tags ? tool.tags.split(',').map(t => t.trim()).filter(Boolean) : []
  const level = tool.ethical_level ?? 'standard'

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate('/tools')} className="flex items-center gap-2 text-text-secondary hover:text-cyber-cyan transition-colors text-sm">
          <ArrowLeft size={16} /> Retour aux outils
        </button>
        <div className="flex gap-2">
          <button onClick={() => navigate(`/tools/${id}/edit`)} className="btn-secondary flex items-center gap-2 text-sm">
            <Pencil size={14} /> Éditer
          </button>
          <button onClick={() => setConfirmOpen(true)} disabled={deleting} className="btn-danger flex items-center gap-2 text-sm">
            <Trash2 size={14} /> Supprimer
          </button>
        </div>
      </div>

      {/* Bandeau éthique */}
      <EthicalBanner level={level} />

      {/* Title + badges */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary mb-3">{tool.name}</h1>
        <div className="flex flex-wrap gap-2">
          <span className={
            tool.category === 'offensive' ? 'badge-offensive' :
            tool.category === 'defensive' ? 'badge-defensive' :
            'badge-tag border-cyber-cyan/40 text-cyber-cyan'
          }>{tool.category}</span>
          <span className="badge-os capitalize">{tool.sub_category}</span>
          <span className="badge-os flex items-center gap-1">
            {tool.os === 'windows' && <Monitor size={12} />}
            {tool.os === 'linux' && <Terminal size={12} />}
            {tool.os === 'both' && <Globe size={12} />}
            {tool.os === 'both' ? 'Windows + Linux' : tool.os}
          </span>
          <EthicalBadge level={level} />
          {tags.map(tag => <span key={tag} className="badge-tag">{tag}</span>)}
        </div>
      </div>

      {/* Description */}
      <div className="card mb-4">
        <p className="text-text-secondary leading-relaxed">{tool.description}</p>
      </div>

      {/* Procédure pas-à-pas (markdown) */}
      <MarkdownSection title="Procédure pas-à-pas" content={tool.procedure ?? ''} icon={<BookOpen size={16} className="text-cyber-cyan" />} />

      {/* Générateur de commande */}
      <CommandGenerator template={tool.command_template ?? ''} schemaJson={tool.input_schema ?? ''} />

      {/* Sections markdown standards */}
      <MarkdownSection title="Installation" content={tool.install} icon={<Download size={16} className="text-cyber-cyan" />} />
      <MarkdownSection title="Utilisation" content={tool.usage} icon={<Terminal size={16} className="text-cyber-orange" />} />
      <MarkdownSection title="Exemples" content={tool.examples} icon={<Copy size={16} className="text-cyber-purple" />} />
      <MarkdownSection title="Détection & Contre-mesures" content={tool.defense} icon={<ShieldAlert size={16} className="text-cyber-green" />} />

      {/* Encadrement légal et éthique */}
      <MarkdownSection title="⚠️ Notes légales" content={tool.legal_notes ?? ''} icon={<Scale size={16} className="text-cyber-red" />} />
      <MarkdownSection title="Cas d'usage éthiques" content={tool.ethical_use_cases ?? ''} icon={<Scale size={16} className="text-cyber-green" />} />

      {/* Notes perso (repliables) */}
      {(tool.user_notes || showNotes) && (
        <div className="card mb-4">
          <button
            onClick={() => setShowNotes(v => !v)}
            className="w-full text-left text-text-primary font-semibold flex items-center justify-between gap-2 pb-3 border-b border-border"
          >
            <span className="flex items-center gap-2">
              <FileText size={16} className="text-cyber-cyan" />
              Notes personnelles
              <span className="text-text-muted text-xs font-normal">(privées, isolées du contenu officiel)</span>
            </span>
            <span className="text-xs text-text-muted">{showNotes ? '▼' : '▶'}</span>
          </button>
          {showNotes && tool.user_notes && (
            <div className="prose-cyber mt-4">
              <ReactMarkdown>{tool.user_notes}</ReactMarkdown>
            </div>
          )}
          {showNotes && !tool.user_notes && (
            <p className="text-text-muted text-sm mt-4">
              Aucune note pour le moment. Clique sur <strong>Éditer</strong> pour en ajouter.
            </p>
          )}
        </div>
      )}
      {!tool.user_notes && !showNotes && (
        <button
          onClick={() => setShowNotes(true)}
          className="w-full card text-left text-text-muted hover:text-text-primary text-sm flex items-center gap-2"
        >
          <FileText size={14} />
          Ajouter des notes personnelles…
        </button>
      )}

      <ConfirmModal
        open={confirmOpen}
        title="Supprimer la fiche"
        message={`Supprimer "${tool.name}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        danger
        onConfirm={() => { setConfirmOpen(false); handleDelete() }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
