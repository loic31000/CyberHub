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
    return raw.split(',').map((t) => t.trim()).filter(Boolean)
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
    return raw.split(',').map((item) => item.trim()).filter(Boolean)
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
  const [title, setTitle]   = useState(initial?.title ?? '')
  const [content, setContent] = useState(initial?.content ?? '')
  const [tags, setTags]     = useState(() => parseTags(initial?.tags ?? '').join(', '))
  const [linkedIocs, setLinkedIocs] = useState(() => formatJsonArray(initial?.linked_iocs))
  const [linkedTechniques, setLinkedTechniques] = useState(() => formatJsonArray(initial?.linked_techniques))
  const [linkedCves, setLinkedCves] = useState(() => formatJsonArray(initial?.linked_cves))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Titre requis'); return }
    setSaving(true)
    try {
      const tagArr = tags.split(',').map((t) => t.trim()).filter(Boolean)
      const iocArr = linkedIocs.split(',').map((t) => t.trim()).filter(Boolean)
      const techArr = linkedTechniques.split(',').map((t) => t.trim()).filter(Boolean)
      const cveArr = linkedCves.split(',').map((t) => t.trim()).filter(Boolean)
      await onSave({
        title: title.trim(),
        content: content,
        tags: JSON.stringify(tagArr),
        linked_iocs: JSON.stringify(iocArr),
        linked_techniques: JSON.stringify(techArr),
        linked_cves: JSON.stringify(cveArr),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre de la note"
        className="input w-full font-semibold"
        autoFocus
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Contenu Markdown…"
        rows={16}
        className="w-full bg-bg-secondary border border-border rounded px-3 py-2 text-sm text-text-primary font-mono focus:outline-none focus:border-cyber-cyan resize-y"
      />
      <input
        type="text"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder="Tags séparés par virgule"
        className="input w-full text-sm"
      />
      <input
        type="text"
        value={linkedIocs}
        onChange={(e) => setLinkedIocs(e.target.value)}
        placeholder="IOCs liés (ids séparés par virgule)"
        className="input w-full text-sm"
      />
      <input
        type="text"
        value={linkedTechniques}
        onChange={(e) => setLinkedTechniques(e.target.value)}
        placeholder="Techniques MITRE liées (ids séparés par virgule)"
        className="input w-full text-sm"
      />
      <input
        type="text"
        value={linkedCves}
        onChange={(e) => setLinkedCves(e.target.value)}
        placeholder="CVE liées (ids séparés par virgule)"
        className="input w-full text-sm"
      />
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-cyber flex items-center gap-2 text-sm"
        >
          <Save size={14} />
          {saving ? 'Sauvegarde…' : 'Sauvegarder'}
        </button>
        <button onClick={onCancel} className="btn-secondary flex items-center gap-2 text-sm">
          <X size={14} /> Annuler
        </button>
      </div>
    </div>
  )
}

export default function NotesPage() {
  const [notes, setNotes]             = useState<Note[]>([])
  const [loading, setLoading]         = useState(false)
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [mode, setMode]               = useState<'view' | 'edit' | 'new'>('view')
  const [searchQ, setSearchQ]         = useState('')
  // searching state tracks loading state of search
  const [_searching, setSearching]     = useState(false)

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
    setNotes((prev) => [note, ...prev])
    setSelectedNote(note)
    setMode('view')
  }

  const handleUpdate = async (req: NoteCreateRequest) => {
    if (!selectedNote) return
    const updated = await notesApi.update(selectedNote.id, req)
    toast.success('Note mise à jour')
    setNotes((prev) => prev.map((n) => n.id === updated.id ? updated : n))
    setSelectedNote(updated)
    setMode('view')
  }

  const navigate = useNavigate()

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette note ?')) return
    try {
      await notesApi.delete(id)
      toast.success('Note supprimée')
      setNotes((prev) => prev.filter((n) => n.id !== id))
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
    <div className="p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <FileText size={24} className="text-cyber-cyan" />
          Notes
        </h1>
        <p className="text-text-muted text-sm mt-1">Notes opérationnelles liées à vos IOCs, techniques et CVE.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-12rem)]">
        {/* Colonne gauche : liste */}
        <div className="card flex flex-col gap-3 overflow-hidden">
          {/* Barre de recherche + nouveau */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Rechercher…"
                className="input w-full pl-8 text-sm"
              />
            </div>
            <button
              onClick={() => { setMode('new'); setSelectedNote(null) }}
              className="btn-cyber px-3"
              title="Nouvelle note"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Liste des notes */}
          <div className="flex-1 overflow-y-auto space-y-1">
            {loading && <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-cyber-cyan" /></div>}
            {!loading && notes.length === 0 && (
              <p className="text-xs text-text-muted text-center py-8">Aucune note. Créez-en une !</p>
            )}
            {notes.map((note) => (
              <div
                key={note.id}
                onClick={() => { setSelectedNote(note); setMode('view') }}
                className={`p-3 rounded border cursor-pointer transition-colors ${
                  selectedNote?.id === note.id
                    ? 'border-cyber-cyan bg-cyber-cyan/5'
                    : 'border-border hover:border-cyber-cyan/40 hover:bg-bg-hover'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-text-primary truncate flex-1">{note.title}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(note.id) }}
                    className="text-text-muted hover:text-red-400 shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <p className="text-xs text-text-muted mt-0.5">{formatDate(note.updated_at)}</p>
                {parseTags(note.tags).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {parseTags(note.tags).slice(0, 3).map((tag) => (
                      <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-bg-hover border border-border text-text-muted">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Colonne droite : viewer / éditeur */}
        <div className="card lg:col-span-2 overflow-y-auto">
          {mode === 'new' && (
            <NoteEditor onSave={handleCreate} onCancel={() => setMode('view')} />
          )}

          {mode === 'edit' && selectedNote && (
            <NoteEditor initial={selectedNote} onSave={handleUpdate} onCancel={() => setMode('view')} />
          )}

          {mode === 'view' && !selectedNote && (
            <div className="flex flex-col items-center justify-center h-full text-text-muted">
              <FileText size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Sélectionnez une note ou créez-en une nouvelle</p>
            </div>
          )}

          {mode === 'view' && selectedNote && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-semibold text-text-primary">{selectedNote.title}</h2>
                <button
                  onClick={() => setMode('edit')}
                  className="btn-secondary flex items-center gap-1.5 text-sm shrink-0"
                >
                  <Edit2 size={14} /> Modifier
                </button>
              </div>
              <p className="text-xs text-text-muted">
                Créée le {formatDate(selectedNote.created_at)} · Modifiée le {formatDate(selectedNote.updated_at)}
              </p>
              {parseTags(selectedNote.tags).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {parseTags(selectedNote.tags).map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full border border-cyber-cyan/40 text-cyber-cyan bg-cyber-cyan/5">{tag}</span>
                  ))}
                </div>
              )}
              {(parseJsonArray(selectedNote.linked_iocs).length > 0 || parseJsonArray(selectedNote.linked_techniques).length > 0 || parseJsonArray(selectedNote.linked_cves).length > 0) && (
                <div className="space-y-3 border border-border rounded p-4 bg-bg-primary">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Liens</p>
                  </div>
                  {parseJsonArray(selectedNote.linked_iocs).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {parseJsonArray(selectedNote.linked_iocs).map((id) => (
                        <button
                          key={id}
                          onClick={() => navigateToLink('ioc', id)}
                          className="text-xs px-2 py-1 rounded border border-border bg-bg-secondary text-text-primary hover:border-cyber-cyan hover:text-cyber-cyan transition-colors"
                        >
                          IOC #{id}
                        </button>
                      ))}
                    </div>
                  )}
                  {parseJsonArray(selectedNote.linked_techniques).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {parseJsonArray(selectedNote.linked_techniques).map((tech) => (
                        <button
                          key={tech}
                          onClick={() => navigateToLink('mitre', tech)}
                          className="text-xs px-2 py-1 rounded border border-border bg-bg-secondary text-text-primary hover:border-cyber-cyan hover:text-cyber-cyan transition-colors"
                        >
                          MITRE {tech}
                        </button>
                      ))}
                    </div>
                  )}
                  {parseJsonArray(selectedNote.linked_cves).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {parseJsonArray(selectedNote.linked_cves).map((cve) => (
                        <button
                          key={cve}
                          onClick={() => navigateToLink('cve', cve)}
                          className="text-xs px-2 py-1 rounded border border-border bg-bg-secondary text-text-primary hover:border-cyber-cyan hover:text-cyber-cyan transition-colors"
                        >
                          {cve}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <pre className="text-sm text-text-primary font-mono whitespace-pre-wrap break-words bg-bg-primary border border-border rounded p-4 leading-relaxed">
                {selectedNote.content || <span className="text-text-muted italic">Aucun contenu</span>}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
