import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ctfApi } from '@/api/client'
import type { CTFCreateRequest, CTFPlatform, CTFDifficulty } from '@/types'
import { Save, ArrowLeft, FileText } from 'lucide-react'

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
    if (!form.title.trim()) { setError('Le titre est requis'); return }
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

  const setField = (field: keyof CTFCreateRequest, value: CTFCreateRequest[keyof CTFCreateRequest]) =>
    setForm((f) => ({ ...f, [field]: value }))

  if (loading) return <div className="flex h-full items-center justify-center bg-[#06080f]"><p className="font-mono text-xs text-[#64748b]">CHARGEMENT...</p></div>

  const fieldClass = 'w-full border border-[#1e2d40] bg-[#0d131f] px-4 py-2.5 font-mono text-sm text-[#f1f5f9] placeholder-[#334155] outline-none transition-colors focus:border-[#00d4ff]/50'
  const textAreaClass = `${fieldClass} resize-y`
  const labelClass = 'mb-2 block font-mono text-[10px] font-bold uppercase tracking-widest text-[#8a9ab0]'

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
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase">CTF WRITEUPS // FORM</h1>
            <p className="text-[10px] text-[#64748b] font-mono">
              {isEdit ? 'MODIFICATION DE WRITEUP' : 'NOUVEAU WRITEUP'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/ctf')}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2d40] hover:bg-[#2a3f55] text-[10px] font-bold border border-[#334155] transition-colors"
          >
            <ArrowLeft size={12} /> BACK TO INDEX
          </button>
        </div>
      </div>

      {/* Zone de contenu scrollable */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto w-full space-y-8">
          {error && (
            <div className="border-l-2 border-[#ef4444] bg-[#ef4444]/5 p-4 font-mono text-[11px] text-[#ef4444]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Informations principales */}
            <div className="space-y-6 border border-[#1e2d40] bg-[#0a0f16] p-6">
              <h2 className="border-b border-[#1e2d40] pb-3 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#00d4ff]">
                INFORMATIONS PRINCIPALES
              </h2>

              <div>
                <label className={labelClass}>TITRE *</label>
                <input
                  type="text"
                  className={fieldClass}
                  placeholder="EX: Lame — HackTheBox"
                  value={form.title}
                  onChange={(e) => setField('title', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div>
                  <label className={labelClass}>PLATEFORME</label>
                  <select
                    className={fieldClass}
                    value={form.platform}
                    onChange={(e) => setField('platform', e.target.value as CTFPlatform)}
                  >
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>NOM MACHINE</label>
                  <input
                    type="text"
                    className={fieldClass}
                    placeholder="EX: Lame"
                    value={form.machine_name}
                    onChange={(e) => setField('machine_name', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>DIFFICULTÉ</label>
                  <select
                    className={`${fieldClass} capitalize`}
                    value={form.difficulty}
                    onChange={(e) => setField('difficulty', e.target.value as CTFDifficulty)}
                  >
                    {DIFFICULTIES.map(d => <option key={d} value={d} className="capitalize">{d}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className={labelClass}>CATÉGORIE</label>
                  <input
                    type="text"
                    className={fieldClass}
                    placeholder="EX: Web, Pwn, Forensic..."
                    value={form.category}
                    onChange={(e) => setField('category', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>TAGS (VIRGULE-SÉPARÉS)</label>
                  <input
                    type="text"
                    className={fieldClass}
                    placeholder="EX: privesc, linux, smb"
                    value={form.tags}
                    onChange={(e) => setField('tags', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>FLAGS (VIRGULE-SÉPARÉS)</label>
                <input
                  type="text"
                  className={fieldClass}
                  placeholder="EX: HTB{abc123}, user.txt: abc..."
                  value={form.flags}
                  onChange={(e) => setField('flags', e.target.value)}
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-[#10b981]"
                  checked={form.completed}
                  onChange={(e) => setField('completed', e.target.checked)}
                />
                <span className="font-mono text-[11px] text-[#8a9ab0] uppercase tracking-widest">
                  MACHINE COMPLÉTÉE (ROOT/PWNED)
                </span>
              </label>
            </div>

            {/* Writeup (Markdown) */}
            <div className="space-y-3 border border-[#1e2d40] bg-[#0a0f16] p-6">
              <label className="block border-b border-[#1e2d40] pb-3 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a9ab0]">
                WRITEUP <span className="ml-2 text-[9px] font-normal text-[#64748b] tracking-normal">(MARKDOWN)</span>
              </label>
              <textarea
                className={textAreaClass}
                rows={16}
                placeholder="## Enumération&#10;&#10;```bash&#10;nmap -sV -sC target&#10;```&#10;&#10;## Exploitation&#10;..."
                value={form.content}
                onChange={(e) => setField('content', e.target.value)}
              />
            </div>

            {/* Actions du formulaire */}
            <div className="flex justify-end gap-4 pt-4 pb-8 border-t border-[#1e2d40]">
              <button
                type="button"
                onClick={() => navigate('/ctf')}
                disabled={saving}
                className="border border-[#1e2d40] bg-[#0a0f16] px-6 py-3 font-mono text-xs uppercase tracking-widest text-[#8a9ab0] transition-colors hover:bg-[#1e2d40] hover:text-[#f1f5f9]"
              >
                ANNULER
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 border border-[#00d4ff]/20 bg-[#00d4ff]/10 px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest text-[#00d4ff] transition-colors hover:bg-[#00d4ff]/20 disabled:opacity-50"
              >
                <Save size={15} />
                {saving ? 'SAUVEGARDE...' : (isEdit ? 'METTRE À JOUR' : 'CRÉER LE WRITEUP')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}