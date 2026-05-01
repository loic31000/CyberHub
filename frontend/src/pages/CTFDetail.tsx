import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { ctfApi } from '@/api/client'
import type { CTFWriteup } from '@/types'
import ConfirmModal from '@/components/ConfirmModal'
import { toast } from '@/store/toast'
import { ArrowLeft, Edit, Trash2, Flag, CheckCircle2, Circle, Tag } from 'lucide-react'

const DIFF_COLORS: Record<string, string> = {
  easy:   'text-cyber-green bg-cyber-green/10 border-cyber-green/30',
  medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  hard:   'text-orange-400 bg-orange-400/10 border-orange-400/30',
  insane: 'text-cyber-red bg-cyber-red/10 border-cyber-red/30',
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
      toast.success(`Writeup "${writeup.title}" supprimé`)
      navigate('/ctf')
    } catch {
      toast.error('Erreur lors de la suppression')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-bg-secondary rounded w-1/3" />
          <div className="h-4 bg-bg-secondary rounded w-1/2" />
          <div className="h-64 bg-bg-secondary rounded" />
        </div>
      </div>
    )
  }

  if (!writeup) return null

  const flags = writeup.flags ? writeup.flags.split(',').map((f) => f.trim()).filter(Boolean) : []
  const tags = writeup.tags ? writeup.tags.split(',').map((t) => t.trim()).filter(Boolean) : []

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Back + actions */}
      <div className="flex items-center justify-between">
        <Link to="/ctf" className="flex items-center gap-2 text-text-muted hover:text-text-primary text-sm transition-colors">
          <ArrowLeft size={16} />
          Retour aux writeups
        </Link>
        <div className="flex gap-2">
          <Link
            to={`/ctf/${writeup.id}/edit`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-border text-text-secondary hover:text-cyber-cyan hover:border-cyber-cyan/40 transition-colors"
          >
            <Edit size={14} />
            Modifier
          </Link>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-border text-text-secondary hover:text-cyber-red hover:border-cyber-red/40 transition-colors"
          >
            <Trash2 size={14} />
            {deleting ? '...' : 'Supprimer'}
          </button>
        </div>
      </div>

      {/* Title block */}
      <div className="card">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/20">
                {writeup.platform}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded border capitalize ${DIFF_COLORS[writeup.difficulty]}`}>
                {writeup.difficulty}
              </span>
              {writeup.completed
                ? <span className="flex items-center gap-1 text-xs text-cyber-green"><CheckCircle2 size={13} /> Complété</span>
                : <span className="flex items-center gap-1 text-xs text-text-muted"><Circle size={13} /> En cours</span>
              }
            </div>
            <h1 className="text-2xl font-bold text-text-primary">{writeup.title}</h1>
            {writeup.machine_name && (
              <p className="text-text-muted text-sm mt-1">📦 Machine : <span className="text-text-secondary">{writeup.machine_name}</span></p>
            )}
            {writeup.category && (
              <p className="text-text-muted text-sm">🏷️ Catégorie : <span className="text-text-secondary">{writeup.category}</span></p>
            )}
          </div>
        </div>

        {/* Flags */}
        {flags.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-text-muted mb-2 flex items-center gap-1">
              <Flag size={12} /> Flags capturés
            </p>
            <div className="flex flex-wrap gap-2">
              {flags.map((f, i) => (
                <code key={i} className="text-xs bg-cyber-green/10 text-cyber-green border border-cyber-green/20 px-2 py-1 rounded font-mono">
                  {f}
                </code>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((t) => (
              <span key={t} className="flex items-center gap-1 text-xs text-text-muted bg-bg-hover px-2 py-0.5 rounded">
                <Tag size={10} /> {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content markdown */}
      {writeup.content && (
        <div className="card">
          <h2 className="text-sm font-semibold text-cyber-cyan mb-4 uppercase tracking-wider">
            📝 Writeup
          </h2>
          <div className="prose-cyber">
            <ReactMarkdown>{writeup.content}</ReactMarkdown>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        title="Supprimer le writeup"
        message={`Supprimer "${writeup.title}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        danger
        onConfirm={() => { setConfirmOpen(false); handleDelete() }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
