// frontend/src/pages/ToolDetail.tsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toolsApi } from '@/api/client'
import type { Tool } from '@/types'
import ReactMarkdown from 'react-markdown'
import {
  ArrowLeft, Pencil, Trash2, Terminal, Download,
  ShieldAlert, BookOpen, FileText, AlertTriangle, Info, Wrench,
} from 'lucide-react'
import ConfirmModal from '@/components/ConfirmModal'

function MarkdownSection({ title, content, icon }: { title: string; content: string; icon: React.ReactNode }) {
  if (!content) return null
  return (
    <section className="border border-[#1e2d40] bg-[#0a0f16]">
      <div className="flex items-center gap-2 border-b border-[#1e2d40] px-5 py-3">
        <span className="text-[#00d4ff]">{icon}</span>
        <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a9ab0]">{title}</h3>
      </div>
      <div className="p-6 prose prose-invert prose-sm max-w-none text-[#cbd5e1] 
        [&_p]:mb-4 [&_p]:leading-relaxed
        [&_ul]:mb-4 [&_ul]:mt-0 [&_li]:mb-1
        [&_pre]:mb-6 [&_pre]:mt-2 [&_pre]:p-4 [&_pre]:bg-[#0d131f] [&_pre]:border [&_pre]:border-[#1e2d40] [&_pre]:rounded-none
        [&_code]:bg-[#0d131f] [&_code]:border [&_code]:border-[#1e2d40] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[#00d4ff] [&_code]:font-mono [&_code]:text-xs
        [&_pre_code]:bg-transparent [&_pre_code]:border-0 [&_pre_code]:p-0 [&_pre_code]:text-[#f1f5f9] [&_pre_code]:font-mono [&_pre_code]:text-xs
        [&_pre_code_.comment]:text-[#6b8cae]
      ">
        {/* Filtrage pour coloriser les commentaires dans les blocs de code (lignes commençant par #) */}
        <ReactMarkdown
          components={{
            code({ node, className, children, ...props }) {
              const isInline = !className?.includes('language-')
              if (isInline) {
                return <code className="text-[#00d4ff]" {...props}>{children}</code>
              }
              // Bloc de code : on remplace les lignes de commentaire par un span coloré
              const codeContent = String(children).replace(/\n/g, '\n')
              const lines = codeContent.split('\n')
              const coloredLines = lines.map((line, idx) => {
                if (line.trim().startsWith('#')) {
                  return <span key={idx} className="comment block text-[#6b8cae]">{line}</span>
                }
                return <span key={idx} className="block">{line}</span>
              })
              return (
                <pre className="bg-[#0d131f] border border-[#1e2d40] p-4 overflow-x-auto">
                  <code className="text-[#f1f5f9] font-mono text-xs">
                    {coloredLines}
                  </code>
                </pre>
              )
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </section>
  )
}

const CATEGORY_STYLE: Record<string, string> = {
  offensive: 'border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444]',
  defensive: 'border-[#10b981]/30 bg-[#10b981]/10 text-[#10b981]',
  osint:     'border-[#00d4ff]/30 bg-[#00d4ff]/10 text-[#00d4ff]',
}
const ETHICAL_STYLE: Record<string, string> = {
  warning:  'border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444]',
  elevated: 'border-[#eab308]/30 bg-[#eab308]/10 text-[#eab308]',
  standard: 'border-[#10b981]/30 bg-[#10b981]/10 text-[#10b981]',
}

export default function ToolDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tool, setTool] = useState<Tool | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    toolsApi.get(Number(id))
      .then(setTool)
      .catch(() => setTool(null))
      .finally(() => setLoading(false))
  }, [id])

  const handleDelete = async () => {
    if (!tool) return
    await toolsApi.delete(tool.id)
    navigate('/tools')
  }

  if (loading) return <div className="min-h-full bg-[#06080f]" />
  if (!tool) return (
    <div className="min-h-full bg-[#06080f] p-6 flex items-center justify-center">
      <p className="font-mono text-sm uppercase tracking-widest text-[#64748b]">FICHE NON TROUVÉE</p>
    </div>
  )

  const isWarning = tool.ethical_level === 'warning'
  const isElevated = tool.ethical_level === 'elevated'
  const catStyle = CATEGORY_STYLE[tool.category] ?? CATEGORY_STYLE.osint
  const ethStyle = ETHICAL_STYLE[tool.ethical_level ?? 'standard'] ?? ETHICAL_STYLE.standard

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
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase">TOOL ARSENAL // DETAIL</h1>
            <p className="text-[10px] text-[#64748b] font-mono">{tool.name} // {tool.category.toUpperCase()}</p>
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
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="max-w-6xl mx-auto w-full">
          {/* Badges + titre + description (pas de chevauchement) */}
          <div className="mb-8">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${catStyle}`}>
                {tool.category}
              </span>
              <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${ethStyle}`}>
                {tool.ethical_level ?? 'standard'}
              </span>
              <span className="border border-[#1e2d40] px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[#8a9ab0]">
                {tool.os}
              </span>
            </div>
            <h1 className="break-words font-mono text-3xl font-bold uppercase tracking-[0.15em] text-[#f1f5f9]">
              {tool.name}
            </h1>
            <p className="mt-3 max-w-full break-words font-mono text-[11px] leading-relaxed text-[#8a9ab0]">
              {tool.description}
            </p>
          </div>

          {/* Grille principale : 2 colonnes sur grand écran */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Colonne gauche : markdown */}
            <div className="space-y-8 lg:col-span-2">
              <MarkdownSection title="INSTALLATION" content={tool.install ?? ''} icon={<Download size={14} />} />
              <MarkdownSection title="UTILISATION" content={tool.usage ?? ''} icon={<Terminal size={14} />} />
              <MarkdownSection title="EXEMPLES" content={tool.examples ?? ''} icon={<FileText size={14} />} />
              <MarkdownSection title="CONTRE-MESURES" content={tool.defense ?? ''} icon={<ShieldAlert size={14} />} />
              <MarkdownSection title="PROCÉDURE" content={tool.procedure ?? ''} icon={<BookOpen size={14} />} />

              {(isWarning || isElevated) && (
                <div className="border border-[#ef4444]/30 bg-[#ef4444]/5 p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-[#ef4444]" />
                    <h3 className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#ef4444]">AVERTISSEMENT ÉTHIQUE</h3>
                  </div>
                  <div className="space-y-4">
                    {tool.legal_notes && (
                      <div>
                        <h4 className="mb-1 font-mono text-[10px] uppercase tracking-widest text-[#8a9ab0]">CADRE LÉGAL</h4>
                        <p className="font-mono text-xs text-[#cbd5e1]">{tool.legal_notes}</p>
                      </div>
                    )}
                    {tool.ethical_use_cases && (
                      <div>
                        <h4 className="mb-1 font-mono text-[10px] uppercase tracking-widest text-[#8a9ab0]">CAS D'USAGE AUTORISÉS</h4>
                        <p className="font-mono text-xs text-[#cbd5e1]">{tool.ethical_use_cases}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Boutons d'action inline (éditer/supprimer) */}
              <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-[#1e2d40]">
                <button
                  type="button"
                  onClick={() => navigate(`/tools/${tool.id}/edit`)}
                  className="flex items-center gap-2 border border-[#00d4ff]/20 bg-[#00d4ff]/10 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#00d4ff] transition-colors hover:bg-[#00d4ff]/20"
                >
                  <Pencil size={13} /> MODIFIER
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-2 border border-[#ef4444]/20 bg-[#ef4444]/10 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ef4444] transition-colors hover:bg-[#ef4444]/20"
                >
                  <Trash2 size={13} /> SUPPRIMER
                </button>
              </div>
            </div>

            {/* Colonne droite : infos et tags */}
            <div className="space-y-8">
              <section className="border border-[#1e2d40] bg-[#0a0f16]">
                <div className="flex items-center gap-2 border-b border-[#1e2d40] px-5 py-3">
                  <Info size={13} className="text-[#00d4ff]" />
                  <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a9ab0]">INFOS</span>
                </div>
                <div className="divide-y divide-[#1e2d40]">
                  {[
                    { label: 'CATÉGORIE', value: tool.category, style: catStyle },
                    { label: 'OS', value: tool.os, style: 'text-[#8a9ab0]' },
                    { label: 'SOUS-CAT.', value: tool.sub_category, style: 'text-[#8a9ab0]' },
                    { label: 'ÉTHIQUE', value: tool.ethical_level ?? 'standard', style: ethStyle },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between px-5 py-3">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-[#4a6480]">{row.label}</span>
                      <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest border-transparent ${row.style}`}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {tool.tags && (
                <section className="border border-[#1e2d40] bg-[#0a0f16] p-5">
                  <h3 className="mb-3 font-mono text-[10px] font-bold uppercase tracking-widest text-[#4a6480]">TAGS</h3>
                  <div className="flex flex-wrap gap-2">
                    {tool.tags.split(',').map(tag => (
                      <span key={tag.trim()} className="border border-[#1e2d40] bg-[#0d131f] px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-[#8a9ab0]">
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => { handleDelete() }}
        title="SUPPRIMER CET OUTIL ?"
        message="CETTE ACTION EST IRRÉVERSIBLE. L'OUTIL SERA DÉFINITIVEMENT EFFACÉ DE LA BASE."
      />
    </div>
  )
}