import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Plus, Search, Trash2, Edit2, X, Save, Loader2 } from 'lucide-react'
import { notesApi } from '@/api/client'
import type { Note, NoteCreateRequest } from '@/types/note'
import { toast } from '@/store/toast'

function parseTags(raw: string): string[] {
  if (!raw) return []
  try {
    const p: unknown = JSON.parse(raw)
    if (Array.isArray(p)) return p as string[]
    return []
  } catch {
    return raw.split(',').map(t => t.trim()).filter(Boolean)
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function parseJsonArray(raw?: string): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(String)
    return []
  } catch {
    return raw.split(',').map(item => item.trim()).filter(Boolean)
  }
}

function formatJsonArray(raw?: string): string {
  return parseJsonArray(raw).join(', ')
}

interface NoteEditorProps {
  initial?: Note
  onSave: (req: NoteCreateRequest) => Promise<void>
  onCancel: () => void
}

function NoteEditor({ initial, onSave, onCancel }: NoteEditorProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [content, setContent] = useState(initial?.content ?? '')
  const [tags, setTags] = useState(() => parseTags(initial?.tags ?? '').join(', '))
  const [linkedIocs, setLinkedIocs] = useState(() => formatJsonArray(initial?.linked_iocs))
  const [linkedTechniques, setLinkedTechniques] = useState(() => formatJsonArray(initial?.linked_techniques))
  const [linkedCves, setLinkedCves] = useState(() => formatJsonArray(initial?.linked_cves))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Titre requis'); return }
    setSaving(true)
    try {
      const tagArr = tags.split(',').map(t => t.trim()).filter(Boolean)
      const iocArr = linkedIocs.split(',').map(t => t.trim()).filter(Boolean)
      const techArr = linkedTechniques.split(',').map(t => t.trim()).filter(Boolean)
      const cveArr = linkedCves.split(',').map(t => t.trim()).filter(Boolean)
      await onSave({
        title: title.trim(),
        content,
        tags: JSON.stringify(tagArr),
        linked_iocs: JSON.stringify(iocArr),
        linked_techniques: JSON.stringify(techArr),
        linked_cves: JSON.stringify(cveArr),
      })
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-[#0d131f] border border-[#1e2d40] rounded px-3 py-2 font-mono text-sm text-[#f1f5f9] placeholder-[#334155] focus:outline-none focus:border-[#00d4ff]/60'

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="TITRE DE LA NOTE"
        className={inputCls + ' font-bold'}
        autoFocus
      />
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Contenu Markdown…"
        rows={16}
        className="w-full bg-[#0d131f] border border-[#1e2d40] rounded px-3 py-2 font-mono text-sm text-[#f1f5f9] placeholder-[#334155] focus:outline-none focus:border-[#00d4ff]/60 resize-y"
      />
      <input
        type="text"
        value={tags}
        onChange={e => setTags(e.target.value)}
        placeholder="TAGS (séparés par virgule)"
        className={inputCls}
      />
      <input
        type="text"
        value={linkedIocs}
        onChange={e => setLinkedIocs(e.target.value)}
        placeholder="IOCS liés (IDs séparés par virgule)"
        className={inputCls}
      />
      <input
        type="text"
        value={linkedTechniques}
        onChange={e => setLinkedTechniques(e.target.value)}
        placeholder="TECHNIQUES MITRE liées (IDs séparés par virgule)"
        className={inputCls}
      />
      <input
        type="text"
        value={linkedCves}
        onChange={e => setLinkedCves(e.target.value)}
        placeholder="CVE liées (IDs séparés par virgule)"
        className={inputCls}
      />
      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 border border-[#00d4ff]/20 bg-[#00d4ff]/10 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#00d4ff] transition-colors hover:bg-[#00d4ff]/20 disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? 'SAUVEGARDE...' : 'SAUVEGARDER'}
        </button>
        <button onClick={onCancel} className="flex items-center gap-2 border border-[#1e2d40] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#64748b] hover:text-[#f1f5f9] transition-colors">
          <X size={14} /> ANNULER
        </button>
      </div>
    </div>
  )
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [mode, setMode] = useState<'view' | 'edit' | 'new'>('view')
  const [searchQ, setSearchQ] = useState('')
  const [_searching, setSearching] = useState(false)
  const navigate = useNavigate()

  const loadNotes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await notesApi.list()
      setNotes(res.notes)
    } catch {
      toast.error('Impossible de charger les notes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadNotes() }, [loadNotes])

  const handleSearch = async () => {
    if (!searchQ.trim()) { loadNotes(); return }
    setSearching(true)
    try {
      const res = await notesApi.search(searchQ)
      setNotes(res.notes)
    } catch {
      toast.error('Erreur de recherche')
    } finally {
      setSearching(false)
    }
  }

  const handleCreate = async (req: NoteCreateRequest) => {
    const note = await notesApi.create(req)
    toast.success('Note créée')
    setNotes(prev => [note, ...prev])
    setSelectedNote(note)
    setMode('view')
  }

  const handleUpdate = async (req: NoteCreateRequest) => {
    if (!selectedNote) return
    const updated = await notesApi.update(selectedNote.id, req)
    toast.success('Note mise à jour')
    setNotes(prev => prev.map(n => n.id === updated.id ? updated : n))
    setSelectedNote(updated)
    setMode('view')
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette note ?')) return
    try {
      await notesApi.delete(id)
      toast.success('Note supprimée')
      setNotes(prev => prev.filter(n => n.id !== id))
      if (selectedNote?.id === id) { setSelectedNote(null); setMode('view') }
    } catch {
      toast.error('Impossible de supprimer')
    }
  }

  const navigateToLink = (type: 'ioc' | 'mitre' | 'cve', value: string) => {
    if (type === 'ioc') {
      navigate(`/ioc?selected=${encodeURIComponent(value)}`)
      return
    }
    if (type === 'mitre') {
      navigate(`/mitre?find=${encodeURIComponent(value)}`)
      return
    }
    navigate(`/cve?find=${encodeURIComponent(value)}`)
  }

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
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase">NOTES // OPERATIONS</h1>
            <p className="text-[10px] text-[#64748b] font-mono">
              Notes opérationnelles liées à vos IOCs, techniques et CVE
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px]">
          <span className="text-[#64748b]">STATUS</span>
          <span className="text-[#10b981]">ONLINE</span>
          <button
            onClick={() => { setMode('new'); setSelectedNote(null) }}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2d40] hover:bg-[#2a3f55] text-[10px] font-bold border border-[#334155] transition-colors"
          >
            <Plus size={12} /> NEW NOTE
          </button>
        </div>
      </div>

      {/* Zone de contenu scrollable */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-0">
          {/* Colonne gauche : liste */}
          <div className="border border-[#1e2d40] bg-[#0a0f16] flex flex-col overflow-hidden">
            {/* Barre de recherche */}
            <div className="p-4 border-b border-[#1e2d40]">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a6480]" />
                  <input
                    type="text"
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Rechercher une note..."
                    className="w-full bg-[#0d131f] border border-[#1e2d40] pl-9 pr-3 py-2 font-mono text-sm text-[#f1f5f9] placeholder-[#2a3f55] focus:outline-none focus:border-[#00d4ff]/40"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  className="flex items-center gap-1 px-3 py-2 border border-[#1e2d40] text-[#64748b] hover:text-[#00d4ff] hover:border-[#00d4ff]/40 transition-colors"
                >
                  <Search size={14} />
                </button>
              </div>
            </div>

            {/* Liste des notes */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loading && (
                <div className="flex justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-[#00d4ff]" />
                </div>
              )}
              {!loading && notes.length === 0 && (
                <p className="text-xs font-mono text-[#64748b] text-center py-8">AUCUNE NOTE. CRÉEZ-EN UNE !</p>
              )}
              {notes.map(note => (
                <div
                  key={note.id}
                  onClick={() => { setSelectedNote(note); setMode('view') }}
                  className={`p-3 border cursor-pointer transition-colors ${
                    selectedNote?.id === note.id
                      ? 'border-[#00d4ff]/40 bg-[#00d4ff]/5'
                      : 'border-[#1e2d40] hover:border-[#00d4ff]/20 hover:bg-[#0d131f]/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-mono font-bold text-[#f1f5f9] truncate flex-1">{note.title}</p>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(note.id) }}
                      className="text-[#64748b] hover:text-red-400 shrink-0 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <p className="text-[10px] font-mono text-[#64748b] mt-0.5">{formatDate(note.updated_at)}</p>
                  {parseTags(note.tags).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {parseTags(note.tags).slice(0, 3).map(tag => (
                        <span key={tag} className="text-[9px] font-mono px-1.5 py-0.5 border border-[#1e2d40] bg-[#0d131f] text-[#64748b]">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Colonne droite : viewer / éditeur */}
          <div className="lg:col-span-2 border border-[#1e2d40] bg-[#0a0f16] overflow-y-auto p-5">
            {mode === 'new' && (
              <NoteEditor onSave={handleCreate} onCancel={() => setMode('view')} />
            )}

            {mode === 'edit' && selectedNote && (
              <NoteEditor initial={selectedNote} onSave={handleUpdate} onCancel={() => setMode('view')} />
            )}

            {mode === 'view' && !selectedNote && (
              <div className="flex flex-col items-center justify-center h-full text-[#64748b]">
                <FileText size={40} className="mb-3 opacity-30" />
                <p className="text-sm font-mono">SÉLECTIONNEZ UNE NOTE OU CRÉEZ-EN UNE NOUVELLE</p>
              </div>
            )}

            {mode === 'view' && selectedNote && (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <h2 className="text-xl font-mono font-bold uppercase tracking-wide text-[#f1f5f9]">{selectedNote.title}</h2>
                  <button
                    onClick={() => setMode('edit')}
                    className="flex items-center gap-2 border border-[#00d4ff]/20 bg-[#00d4ff]/10 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#00d4ff] transition-colors hover:bg-[#00d4ff]/20"
                  >
                    <Edit2 size={13} /> MODIFIER
                  </button>
                </div>
                <p className="text-[10px] font-mono text-[#64748b]">
                  CRÉÉE LE {formatDate(selectedNote.created_at)} · MODIFIÉE LE {formatDate(selectedNote.updated_at)}
                </p>
                {parseTags(selectedNote.tags).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {parseTags(selectedNote.tags).map(tag => (
                      <span key={tag} className="text-[10px] font-mono px-2 py-0.5 border border-[#00d4ff]/30 bg-[#00d4ff]/5 text-[#00d4ff]">{tag}</span>
                    ))}
                  </div>
                )}
                {(parseJsonArray(selectedNote.linked_iocs).length > 0 || parseJsonArray(selectedNote.linked_techniques).length > 0 || parseJsonArray(selectedNote.linked_cves).length > 0) && (
                  <div className="space-y-3 border border-[#1e2d40] p-4 bg-[#0d131f]">
                    <p className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider">LIENS</p>
                    {parseJsonArray(selectedNote.linked_iocs).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {parseJsonArray(selectedNote.linked_iocs).map(id => (
                          <button
                            key={id}
                            onClick={() => navigateToLink('ioc', id)}
                            className="text-[11px] font-mono px-2 py-1 border border-[#1e2d40] bg-[#0d131f] text-[#f1f5f9] hover:border-[#00d4ff] hover:text-[#00d4ff] transition-colors"
                          >
                            IOC #{id}
                          </button>
                        ))}
                      </div>
                    )}
                    {parseJsonArray(selectedNote.linked_techniques).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {parseJsonArray(selectedNote.linked_techniques).map(tech => (
                          <button
                            key={tech}
                            onClick={() => navigateToLink('mitre', tech)}
                            className="text-[11px] font-mono px-2 py-1 border border-[#1e2d40] bg-[#0d131f] text-[#f1f5f9] hover:border-[#00d4ff] hover:text-[#00d4ff] transition-colors"
                          >
                            MITRE {tech}
                          </button>
                        ))}
                      </div>
                    )}
                    {parseJsonArray(selectedNote.linked_cves).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {parseJsonArray(selectedNote.linked_cves).map(cve => (
                          <button
                            key={cve}
                            onClick={() => navigateToLink('cve', cve)}
                            className="text-[11px] font-mono px-2 py-1 border border-[#1e2d40] bg-[#0d131f] text-[#f1f5f9] hover:border-[#00d4ff] hover:text-[#00d4ff] transition-colors"
                          >
                            {cve}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="prose prose-invert prose-sm max-w-none">
                  <pre className="text-sm font-mono text-[#cbd5e1] whitespace-pre-wrap break-words bg-[#0d131f] border border-[#1e2d40] p-4 leading-relaxed">
                    {selectedNote.content || <span className="text-[#64748b] italic">Aucun contenu</span>}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}