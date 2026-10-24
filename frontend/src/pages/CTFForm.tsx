import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ctfApi } from '@/api/client'
import type { CTFCreateRequest, CTFPlatform, CTFDifficulty } from '@/types'
import { ArrowLeft, Eye, Pencil, Save } from 'lucide-react'
import CtfHero from '@/ctf26/CtfHero'
import { DIFFICULTIES, DIFF_LABEL, Markdown, PLATFORMS } from '@/ctf26/parts'
import '@/ctf26/ctf.css'

const DEFAULT_FORM: CTFCreateRequest = {
  title: '', platform: 'HackTheBox', machine_name: '', difficulty: 'medium',
  category: '', content: '', flags: '', tags: '', completed: false,
}

const STEPS = [
  { id: 'ct26-f-challenge', label: 'Challenge' },
  { id: 'ct26-f-class', label: 'Classification' },
  { id: 'ct26-f-results', label: 'Résultats' },
  { id: 'ct26-f-writeup', label: 'Writeup' },
]

export default function CTFForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [form, setForm] = useState<CTFCreateRequest>(DEFAULT_FORM)
  const [loading, setLoading] = useState(isEdit)
  const [loadError, setLoadError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [titleError, setTitleError] = useState('')
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    let active = true
    if (!isEdit) {
      setForm(DEFAULT_FORM)
      setLoading(false)
      setLoadError(false)
      setError('')
      setTitleError('')
      setPreview(false)
      return () => { active = false }
    }
    setLoading(true)
    setLoadError(false)
    setError('')
    setTitleError('')
    setPreview(false)
    if (!id) {
      setLoadError(true)
      setLoading(false)
      return () => { active = false }
    }
    const numericId = Number(id)
    if (!Number.isSafeInteger(numericId) || numericId < 1) {
      setLoadError(true)
      setLoading(false)
      return () => { active = false }
    }
    ctfApi.get(numericId)
      .then(w => { if (active) setForm({
        title: w.title, platform: w.platform, machine_name: w.machine_name,
        difficulty: w.difficulty, category: w.category, content: w.content,
        flags: w.flags, tags: w.tags, completed: w.completed,
      }) })
      .catch(() => { if (active) setLoadError(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, isEdit, loadAttempt])

  const setField = (field: keyof CTFCreateRequest, value: CTFCreateRequest[keyof CTFCreateRequest]) =>
    setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.title.trim().length < 2) {
      const titleMessage = form.title.trim().length === 0
        ? 'Le titre est requis'
        : 'Le titre doit comporter au moins deux caractères'
      setTitleError(titleMessage)
      setError(titleMessage)
      document.getElementById('ct26-in-title')?.focus()
      return
    }
    setSaving(true)
    setError('')
    try {
      if (isEdit && id) {
        await ctfApi.update(Number(id), form)
        navigate(`/ctf/${id}`)
      } else {
        const created = await ctfApi.create(form)
        navigate(`/ctf/${created.id}`)
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e?.response?.data?.error ?? 'Erreur lors de la sauvegarde')
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="ct26"><div className="ct26-frame">
      <CtfHero status={{ text: 'CHARGEMENT', tone: 'busy' }} />
      <p className="ct26-loading" role="status">Chargement…</p>
    </div></div>
  )

  if (loadError) return (
    <div className="ct26"><div className="ct26-frame">
      <CtfHero status={{ text: 'RAPPORT INDISPONIBLE', tone: 'warn' }} />
      <div className="ct26-state is-error" role="alert">
        <h2>Impossible de charger ce writeup</h2>
        <p>Aucune modification n’a été envoyée. Réessaie ou retourne au journal.</p>
        <div className="ct26-actions">
          <button type="button" className="ct26-btn" onClick={() => setLoadAttempt(attempt => attempt + 1)}>Réessayer</button>
          <Link to="/ctf" className="ct26-btn">Retour au journal</Link>
        </div>
      </div>
    </div></div>
  )

  return (
    <div className="ct26">
      <div className="ct26-frame">
        <CtfHero status={{ text: isEdit ? 'MODIFICATION' : 'NOUVEAU WRITEUP', mark: isEdit ? `#${id}` : undefined, tone: 'busy' }} />

        <div className="ct26-crumbs">
          <Link to={isEdit ? `/ctf/${id}` : '/ctf'} className="ct26-link">
            <ArrowLeft size={14} aria-hidden="true" /> {isEdit ? 'Retour au rapport' : 'Journal'}
          </Link>
        </div>

        <div className="ct26-form-layout">
          <nav className="ct26-steps" aria-label="Sections du formulaire">
            <p>{isEdit ? 'Modifier le writeup' : 'Nouveau writeup'}</p>
            <ol>{STEPS.map((s, i) => <li key={s.id}><a href={`#${s.id}`}><span>{String(i + 1).padStart(2, '0')}</span>{s.label}</a></li>)}</ol>
          </nav>

          <form onSubmit={handleSubmit} className="ct26-form" noValidate>
            <h2 className="ct26-sr">{isEdit ? `Modifier ${form.title || 'le writeup'}` : 'Créer un writeup'}</h2>

            {/* 1. Challenge */}
            <section id="ct26-f-challenge" className="ct26-form-section" aria-labelledby="ct26-fh-challenge">
              <header><span className="ct26-num">01</span><h3 id="ct26-fh-challenge">Challenge</h3><small>Ce que l'on résout</small></header>
              <div className="ct26-field">
                <label htmlFor="ct26-in-title">Titre <abbr title="obligatoire">*</abbr></label>
                <input
                  id="ct26-in-title" className="is-title" value={form.title}
                  onChange={e => { setField('title', e.target.value); if (titleError) { setTitleError(''); setError('') } }}
                  placeholder="ex : Lame — HackTheBox" autoComplete="off"
                  aria-invalid={Boolean(titleError) || undefined}
                  aria-describedby={titleError ? 'ct26-err-title' : undefined}
                />
                {titleError && <p id="ct26-err-title" className="ct26-field-error">{titleError}</p>}
              </div>
              <div className="ct26-form-grid is-2">
                <div className="ct26-field">
                  <label htmlFor="ct26-in-platform">Plateforme</label>
                  <select id="ct26-in-platform" value={form.platform} onChange={e => setField('platform', e.target.value as CTFPlatform)}>
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="ct26-field">
                  <label htmlFor="ct26-in-machine">Nom de la machine</label>
                  <input id="ct26-in-machine" value={form.machine_name} onChange={e => setField('machine_name', e.target.value)} placeholder="ex : Lame" autoComplete="off" />
                </div>
              </div>
            </section>

            {/* 2. Classification */}
            <section id="ct26-f-class" className="ct26-form-section" aria-labelledby="ct26-fh-class">
              <header><span className="ct26-num">02</span><h3 id="ct26-fh-class">Classification</h3><small>Filtres du journal</small></header>
              <div className="ct26-form-grid is-2">
                <div className="ct26-field">
                  <label htmlFor="ct26-in-difficulty">Difficulté</label>
                  <select id="ct26-in-difficulty" value={form.difficulty} onChange={e => setField('difficulty', e.target.value as CTFDifficulty)}>
                    {DIFFICULTIES.map(d => <option key={d} value={d}>{DIFF_LABEL[d]}</option>)}
                  </select>
                </div>
                <div className="ct26-field">
                  <label htmlFor="ct26-in-category">Catégorie</label>
                  <input id="ct26-in-category" value={form.category} onChange={e => setField('category', e.target.value)} placeholder="ex : Web, Pwn, Forensic…" autoComplete="off" />
                </div>
              </div>
              <div className="ct26-field">
                <label htmlFor="ct26-in-tags">Tags</label>
                <input id="ct26-in-tags" value={form.tags} onChange={e => setField('tags', e.target.value)} placeholder="ex : privesc, linux, smb" aria-describedby="ct26-hint-tags" autoComplete="off" />
                <small id="ct26-hint-tags">Séparés par des virgules.</small>
              </div>
              <label className="ct26-check">
                <input type="checkbox" checked={form.completed} onChange={e => setField('completed', e.target.checked)} />
                <span><b>Machine terminée</b><small>Root / pwned. Sinon, marquée « en cours ».</small></span>
              </label>
            </section>

            {/* 3. Résultats */}
            <section id="ct26-f-results" className="ct26-form-section" aria-labelledby="ct26-fh-results">
              <header><span className="ct26-num">03</span><h3 id="ct26-fh-results">Résultats</h3><small>Éléments sensibles</small></header>
              <div className="ct26-field">
                <label htmlFor="ct26-in-flags">Flags</label>
                <input id="ct26-in-flags" className="is-mono" value={form.flags} onChange={e => setField('flags', e.target.value)} placeholder="ex : HTB{…}, user.txt: …" aria-describedby="ct26-hint-flags" spellCheck={false} autoComplete="off" />
                <small id="ct26-hint-flags">Séparés par des virgules. Affichés comme éléments sensibles sur le rapport.</small>
              </div>
            </section>

            {/* 4. Writeup */}
            <section id="ct26-f-writeup" className="ct26-form-section" aria-labelledby="ct26-fh-writeup">
              <header>
                <span className="ct26-num">04</span><h3 id="ct26-fh-writeup">Writeup</h3>
                <div className="ct26-seg" role="group" aria-label="Mode d'édition du writeup">
                  <button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}><Pencil size={13} aria-hidden="true" /> Éditer</button>
                  <button type="button" aria-pressed={preview} onClick={() => setPreview(true)}><Eye size={13} aria-hidden="true" /> Aperçu</button>
                </div>
              </header>
              {preview ? (
                <div className="ct26-preview">
                  {form.content.trim() ? <Markdown>{form.content}</Markdown> : <p className="ct26-empty-doc">Rien à prévisualiser.</p>}
                </div>
              ) : (
                <div className="ct26-field">
                  <label htmlFor="ct26-in-content" className="ct26-sr">Contenu du writeup (Markdown)</label>
                  <textarea
                    id="ct26-in-content" className="is-code" value={form.content}
                    onChange={e => setField('content', e.target.value)} rows={18}
                    placeholder={'## Énumération\n\n```bash\nnmap -sV -sC cible\n```\n\n## Exploitation\n…'}
                    aria-describedby="ct26-hint-content" spellCheck={false}
                  />
                  <small id="ct26-hint-content">Markdown. Blocs ``` pour les commandes ; les commentaires # sont colorés.</small>
                </div>
              )}
            </section>

            <div className="ct26-form-bar">
              <div className="ct26-form-bar-msg" role="alert">
                {error && <span className="is-error">{error}</span>}
              </div>
              <button type="button" className="ct26-btn" onClick={() => navigate(isEdit && id ? `/ctf/${id}` : '/ctf')} disabled={saving}>Annuler</button>
              <button type="submit" className="ct26-btn is-primary" disabled={saving}>
                <Save size={15} aria-hidden="true" /> {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer le writeup'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
