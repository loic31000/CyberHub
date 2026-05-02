import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ctfApi } from '@/api/client'
import type { CTFCreateRequest, CTFPlatform, CTFDifficulty } from '@/types'
import { Save, ArrowLeft } from 'lucide-react'

const PLATFORMS: CTFPlatform[] = ['TryHackMe', 'HackTheBox', 'Root-Me', 'PicoCTF', 'Autre']
const DIFFICULTIES: CTFDifficulty[] = ['easy', 'medium', 'hard', 'insane']

const DEFAULT_FORM: CTFCreateRequest = {
  title: '',
  platform: 'HackTheBox',
  machine_name: '',
  difficulty: 'medium',
  category: '',
  content: '',
  flags: '',
  tags: '',
  completed: false,
}

export default function CTFForm() {
    const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [form, setForm] = useState<CTFCreateRequest>(DEFAULT_FORM)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isEdit || !id) return
    ctfApi.get(Number(id))
      .then((w) => setForm({
        title: w.title,
        platform: w.platform,
        machine_name: w.machine_name,
        difficulty: w.difficulty,
        category: w.category,
        content: w.content,
        flags: w.flags,
        tags: w.tags,
        completed: w.completed,
      }))
      .catch(() => navigate('/ctf'))
      .finally(() => setLoading(false))
  }, [id, isEdit, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { setError(`Le titre est requis`); return }
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
      setError(e?.response?.data?.error ?? `Erreur lors de la sauvegarde`)
      setSaving(false)
    }
  }

  const set = (field: keyof CTFCreateRequest, value: CTFCreateRequest[keyof CTFCreateRequest]) =>
    setForm((f) => ({ ...f, [field]: value }))

  if (loading) return <div className="p-6 text-text-muted">{`Chargement…`}</div>

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/ctf')} className="text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-text-primary">
          {isEdit ? `Modifier le writeup` : `Nouveau writeup CTF`}
        </h1>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded bg-cyber-red/10 border border-cyber-red/30 text-cyber-red text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div>
          <label className="block text-sm text-text-secondary mb-1">{`Titre *`} *</label>
          <input
            type="text"
            className="input-cyber w-full px-3 py-2 text-sm"
            placeholder={`Ex: Lame — HackTheBox`}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </div>

        {/* Platform + Machine + Difficulty */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">{`Plateforme`}</label>
            <select
              className="input-cyber w-full px-3 py-2 text-sm"
              value={form.platform}
              onChange={(e) => set('platform', e.target.value as CTFPlatform)}
            >
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">{`Nom machine`}</label>
            <input
              type="text"
              className="input-cyber w-full px-3 py-2 text-sm"
              placeholder={`Ex: Lame`}
              value={form.machine_name}
              onChange={(e) => set('machine_name', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">{`Difficulté`}</label>
            <select
              className="input-cyber w-full px-3 py-2 text-sm capitalize"
              value={form.difficulty}
              onChange={(e) => set('difficulty', e.target.value as CTFDifficulty)}
            >
              {DIFFICULTIES.map((d) => <option key={d} value={d} className="capitalize">{d}</option>)}
            </select>
          </div>
        </div>

        {/* Category + Tags */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">{`Catégorie`}</label>
            <input
              type="text"
              className="input-cyber w-full px-3 py-2 text-sm"
              placeholder={`Ex: Web, Pwn, Forensic...`}
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">{`Tags (virgule-séparés)`}</label>
            <input
              type="text"
              className="input-cyber w-full px-3 py-2 text-sm"
              placeholder={`Ex: privesc, linux, smb`}
              value={form.tags}
              onChange={(e) => set('tags', e.target.value)}
            />
          </div>
        </div>

        {/* Flags */}
        <div>
          <label className="block text-sm text-text-secondary mb-1">{`Flags (virgule-séparés)`}</label>
          <input
            type="text"
            className="input-cyber w-full px-3 py-2 text-sm font-mono"
            placeholder={`Ex: HTB{abc123}, user.txt: abc...`}
            value={form.flags}
            onChange={(e) => set('flags', e.target.value)}
          />
        </div>

        {/* Content */}
        <div>
          <label className="block text-sm text-text-secondary mb-1">
            {`Writeup`} <span className="text-text-muted">{`(Markdown)`}</span>
          </label>
          <textarea
            className="input-cyber w-full px-3 py-2 text-sm font-mono resize-y"
            rows={16}
            placeholder="## Enumération&#10;&#10;```bash&#10;nmap -sV -sC target&#10;```&#10;&#10;## Exploitation&#10;..."
            value={form.content}
            onChange={(e) => set('content', e.target.value)}
          />
        </div>

        {/* Completed */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 accent-cyber-green"
            checked={form.completed}
            onChange={(e) => set('completed', e.target.checked)}
          />
          <span className="text-sm text-text-secondary">{`Machine complétée (root/pwned)`}</span>
        </label>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn-cyber flex items-center gap-2 px-5 py-2 rounded text-sm font-medium disabled:opacity-50"
          >
            <Save size={15} />
            {saving ? `Sauvegarde…` : isEdit ? `Enregistrer` : `Créer le writeup`}
          </button>
          <button
            type="button"
            onClick={() => navigate('/ctf')}
            className="px-5 py-2 rounded text-sm border border-border text-text-secondary hover:text-text-primary transition-colors"
          >
            {`Annuler`}
          </button>
        </div>
      </form>
    </div>
  )
}
