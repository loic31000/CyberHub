import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { ctfApi } from '@/api/client'
import type { CTFWriteup } from '@/types'
import ConfirmModal from '@/components/ConfirmModal'
import { toast } from '@/store/toast'
import { ArrowLeft, Edit, Trash2, Flag, CheckCircle2, Circle, Tag, FileText } from 'lucide-react'

const DIFF_COLORS: Record<string, string> = {
  easy:   'border-[#10b981]/30 bg-[#10b981]/10 text-[#10b981]',
  medium: 'border-[#eab308]/30 bg-[#eab308]/10 text-[#eab308]',
  hard:   'border-[#f97316]/30 bg-[#f97316]/10 text-[#f97316]',
  insane: 'border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444]',
}

const PLATFORM_COLORS: Record<string, string> = {
  TryHackMe:  'border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444]',
  HackTheBox: 'border-[#10b981]/30 bg-[#10b981]/10 text-[#10b981]',
  'Root-Me':  'border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[#3b82f6]',
  PicoCTF:    'border-[#a855f7]/30 bg-[#a855f7]/10 text-[#a855f7]',
  Autre:      'border-[#64748b]/30 bg-[#64748b]/10 text-[#64748b]',
}

export default function CTFDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [writeup, setWriteup] = useState<CTFWriteup | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    ctfApi.get(Number(id))
      .then(setWriteup)
      .catch(() => navigate('/ctf'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleDelete = async () => {
    if (!writeup) return
    setDeleting(true)
    try {
      await ctfApi.delete(writeup.id)
      toast.success('Writeup supprimé avec succès')
      navigate('/ctf')
    } catch {
      toast.error('Erreur lors de la suppression')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#06080f]">
        <p className="font-mono text-xs text-[#64748b]">CHARGEMENT...</p>
      </div>
    )
  }

  if (!writeup) return null

  const flags = writeup.flags ? writeup.flags.split(',').map(f => f.trim()).filter(Boolean) : []
  const tags = writeup.tags ? writeup.tags.split(',').map(tag => tag.trim()).filter(Boolean) : []
  const diffColor = DIFF_COLORS[writeup.difficulty] ?? DIFF_COLORS.medium
  const platformColor = PLATFORM_COLORS[writeup.platform] ?? PLATFORM_COLORS.Autre

  return (
    <div className="flex flex-col h-full bg-[#06080f] text-[#f1f5f9]">
      {/* Bandeau d'en-tête style BGPLookup */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d40] bg-[#0a0f16]/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <FileText className="text-[#00d4ff]" size={20} />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#10b981] rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase">CTF WRITEUPS // DETAIL</h1>
            <p className="text-[10px] text-[#64748b] font-mono">
              {writeup.platform} • {writeup.machine_name || writeup.title}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/ctf"
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2d40] hover:bg-[#2a3f55] text-[10px] font-bold border border-[#334155] transition-colors"
          >
            <ArrowLeft size={12} /> BACK TO INDEX
          </Link>
        </div>
      </div>

      {/* Zone de contenu scrollable */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Carte des métadonnées */}
        <div className="border border-[#1e2d40] bg-[#0a0f16] p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${platformColor}`}>
              {writeup.platform}
            </span>
            <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${diffColor}`}>
              {writeup.difficulty}
            </span>
            {writeup.completed
              ? <span className="flex items-center gap-1 text-[11px] text-[#10b981]"><CheckCircle2 size={12} /> COMPLÉTÉ</span>
              : <span className="flex items-center gap-1 text-[11px] text-[#4a6480]"><Circle size={12} /> EN COURS</span>
            }
          </div>

          <h1 className="break-words font-mono text-2xl font-bold uppercase tracking-[0.15em] text-[#f1f5f9]">
            {writeup.title}
          </h1>

          {writeup.machine_name && (
            <p className="text-[11px] font-mono text-[#8a9ab0]">📦 MACHINE : {writeup.machine_name}</p>
          )}
          {writeup.category && (
            <p className="text-[11px] font-mono text-[#8a9ab0]">🏷️ CATÉGORIE : {writeup.category}</p>
          )}

          {/* Flags */}
          {flags.length > 0 && (
            <div className="pt-3 border-t border-[#1e2d40]">
              <p className="text-[10px] font-mono text-[#4a6480] mb-2 flex items-center gap-1">
                <Flag size={12} /> FLAGS CAPTURÉS
              </p>
              <div className="flex flex-wrap gap-2">
                {flags.map((f, i) => (
                  <code key={i} className="text-[11px] bg-[#0d131f] border border-[#1e2d40] px-2 py-1 font-mono text-[#00d4ff]">
                    {f}
                  </code>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 text-[10px] font-mono text-[#64748b] bg-[#0d131f] border border-[#1e2d40] px-2 py-0.5">
                  <Tag size={10} /> {tag}
                </span>
              ))}
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex gap-3 pt-4 border-t border-[#1e2d40]">
            <Link
              to={`/ctf/${writeup.id}/edit`}
              className="flex items-center gap-2 border border-[#00d4ff]/20 bg-[#00d4ff]/10 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#00d4ff] transition-colors hover:bg-[#00d4ff]/20"
            >
              <Edit size={13} /> MODIFIER
            </Link>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={deleting}
              className="flex items-center gap-2 border border-[#ef4444]/20 bg-[#ef4444]/10 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ef4444] transition-colors hover:bg-[#ef4444]/20 disabled:opacity-50"
            >
              <Trash2 size={13} /> {deleting ? '...' : 'SUPPRIMER'}
            </button>
          </div>
        </div>

        {/* Contenu Markdown */}
        {writeup.content && (
          <div className="border border-[#1e2d40] bg-[#0a0f16]">
            <div className="flex items-center gap-2 border-b border-[#1e2d40] px-5 py-3">
              <FileText size={13} className="text-[#00d4ff]" />
              <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a9ab0]">WRITEUP</h3>
            </div>
            <div className="p-6 prose prose-invert prose-sm max-w-none text-[#cbd5e1]
              [&_p]:mb-5 [&_p]:leading-relaxed
              [&_ul]:mb-5 [&_ul]:mt-0 [&_li]:mb-1.5
              [&_pre]:mb-6 [&_pre]:mt-3 [&_pre]:p-5 [&_pre]:bg-[#0d131f] [&_pre]:border [&_pre]:border-[#1e2d40] [&_pre]:rounded-none
              [&_code]:bg-[#0d131f] [&_code]:border [&_code]:border-[#1e2d40] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[#00d4ff] [&_code]:font-mono [&_code]:text-xs
              [&_pre_code]:bg-transparent [&_pre_code]:border-0 [&_pre_code]:p-0 [&_pre_code]:text-[#f1f5f9] [&_pre_code]:font-mono [&_pre_code]:text-xs
            ">
              <ReactMarkdown
                components={{
                  code({ node, className, children, ...props }) {
                    const isInline = !className?.includes('language-')
                    if (isInline) {
                      return <code className="text-[#00d4ff]" {...props}>{children}</code>
                    }
                    const codeContent = String(children)
                    const lines = codeContent.split('\n')
                    const coloredLines = lines.map((line, idx) => {
                      const trimmed = line.trimStart()
                      if (trimmed.startsWith('#')) {
                        return <span key={idx} className="comment block text-[#6b8cae]">{line}</span>
                      }
                      return <span key={idx} className="block">{line}</span>
                    })
                    return (
                      <pre className="bg-[#0d131f] border border-[#1e2d40] p-5 overflow-x-auto">
                        <code className="text-[#f1f5f9] font-mono text-xs">
                          {coloredLines}
                        </code>
                      </pre>
                    )
                  },
                }}
              >
                {writeup.content}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="SUPPRIMER CE WRITEUP ?"
        message={`"${writeup.title}" — CETTE ACTION EST IRRÉVERSIBLE.`}
        confirmLabel="SUPPRIMER"
        danger
        onConfirm={() => { setConfirmOpen(false); handleDelete() }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}