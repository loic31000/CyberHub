import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ctfApi } from '@/api/client'
import type { CTFWriteup } from '@/types'
import ConfirmModal from '@/components/ConfirmModal'
import { toast } from '@/store/toast'
import { ArrowLeft, FileText, Flag, Package, Pencil, Trash2 } from 'lucide-react'
import CtfHero from '@/ctf26/CtfHero'
import {
  DifficultyMark, FlagList, Markdown, PlatformMark, StatusMark, diffOf, platformOf, splitList,
} from '@/ctf26/parts'
import '@/ctf26/ctf.css'

export default function CTFDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [writeup, setWriteup] = useState<CTFWriteup | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setWriteup(null)
    setNotFound(false)
    setDeleting(false)
    setDeleteError(false)
    setConfirmOpen(false)
    const numericId = Number(id)
    if (!id || !Number.isSafeInteger(numericId) || numericId < 1) {
      setNotFound(true)
      setLoading(false)
      return () => { active = false }
    }
    ctfApi.get(numericId)
      .then(w => { if (active) setWriteup(w) })
      .catch(() => { if (active) setNotFound(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])

  const handleDelete = async () => {
    if (!writeup) return
    setDeleting(true)
    setDeleteError(false)
    try {
      await ctfApi.delete(writeup.id)
      toast.success('Writeup supprimé avec succès')
      navigate('/ctf')
    } catch {
      setDeleteError(true)
      setDeleting(false)
    }
  }

  if (loading) return (
    <div className="ct26"><div className="ct26-frame">
      <CtfHero status={{ text: 'CHARGEMENT', tone: 'busy' }} />
      <p className="ct26-loading" role="status">Chargement du writeup…</p>
    </div></div>
  )
  if (notFound || !writeup) return (
    <div className="ct26"><div className="ct26-frame">
      <CtfHero status={{ text: 'WRITEUP INTROUVABLE', tone: 'warn' }} />
      <div className="ct26-state is-error">
        <h2>Writeup non trouvé</h2>
        <p>Ce writeup n'existe pas ou n'a pas pu être chargé.</p>
        <Link to="/ctf" className="ct26-btn"><ArrowLeft size={15} aria-hidden="true" /> Retour au journal</Link>
      </div>
    </div></div>
  )

  const diff = diffOf(writeup.difficulty)
  const flags = splitList(writeup.flags)
  const tags = splitList(writeup.tags)

  return (
    <div className="ct26">
      <div className="ct26-frame">
        <CtfHero status={{ text: 'RAPPORT', mark: `#${writeup.id}` }} />

        <div className="ct26-crumbs">
          <Link to="/ctf" className="ct26-link"><ArrowLeft size={14} aria-hidden="true" /> Journal</Link>
        </div>

        <article className="ct26-report" aria-labelledby="ct26-report-title">
          <header className="ct26-report-head" data-diff={diff} data-done={writeup.completed}>
            <span className="ct26-report-rail" aria-hidden="true" />
            <div className="ct26-report-id">
              <div className="ct26-report-top">
                <PlatformMark platform={platformOf(writeup.platform)} />
                <StatusMark completed={writeup.completed} />
              </div>
              <h2 id="ct26-report-title">{writeup.title}</h2>
            </div>
            <div className="ct26-report-actions">
              <Link to={`/ctf/${writeup.id}/edit`} className="ct26-btn"><Pencil size={15} aria-hidden="true" /> Modifier</Link>
              <button type="button" className="ct26-btn is-danger" disabled={deleting} onClick={() => setConfirmOpen(true)}>
                <Trash2 size={15} aria-hidden="true" /> {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
            {deleteError && <p className="ct26-field-error" role="alert">Suppression non confirmée. Le writeup est toujours affiché ; vérifie le registre avant de réessayer.</p>}
            <dl className="ct26-facts">
              <div><dt>Plateforme</dt><dd><PlatformMark platform={platformOf(writeup.platform)} /></dd></div>
              <div><dt>Machine</dt><dd className="is-mono">{writeup.machine_name ? <><Package size={13} aria-hidden="true" />{writeup.machine_name}</> : '—'}</dd></div>
              <div><dt>Difficulté</dt><dd><DifficultyMark difficulty={diff} /></dd></div>
              <div><dt>Catégorie</dt><dd className="is-mono">{writeup.category || '—'}</dd></div>
            </dl>
            {tags.length > 0 && (
              <ul className="ct26-tags is-report" aria-label="Tags">
                {tags.map(t => <li key={t}>{t}</li>)}
              </ul>
            )}
          </header>

          {flags.length > 0 && (
            <section className="ct26-flags-block" aria-labelledby="ct26-flags-title">
              <h3 id="ct26-flags-title"><Flag size={15} aria-hidden="true" /> Flags capturés <small>sensible</small></h3>
              <FlagList flags={flags} />
            </section>
          )}

          <section className="ct26-writeup" aria-labelledby="ct26-writeup-title">
            <header><FileText size={15} aria-hidden="true" /><h3 id="ct26-writeup-title">Writeup</h3></header>
            {writeup.content?.trim()
              ? <Markdown>{writeup.content}</Markdown>
              : <p className="ct26-empty-doc">Ce writeup ne contient pas encore de contenu rédigé.</p>}
          </section>
        </article>
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
