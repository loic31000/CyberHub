import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Plus, Search, Trash2, Edit2, X, Save, Loader2, Download, Upload } from 'lucide-react'
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

// ── Export helpers ────────────────────────────────────────────────────────────

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'note'
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function noteToTxt(note: Note): string {
  const tags = parseTags(note.tags)
  const iocs = parseJsonArray(note.linked_iocs)
  const techs = parseJsonArray(note.linked_techniques)
  const cves = parseJsonArray(note.linked_cves)
  const sep = '='.repeat(Math.min(note.title.length, 60))
  const lines: string[] = [note.title.toUpperCase(), sep, `Created: ${formatDate(note.created_at)}`, `Updated: ${formatDate(note.updated_at)}`, '']
  if (tags.length) lines.push(`Tags: ${tags.join(', ')}`)
  if (iocs.length) lines.push(`IOCs: ${iocs.join(', ')}`)
  if (techs.length) lines.push(`MITRE: ${techs.join(', ')}`)
  if (cves.length) lines.push(`CVE: ${cves.join(', ')}`)
  if (tags.length || iocs.length || techs.length || cves.length) lines.push('')
  lines.push(note.content || '')
  return lines.join('\n')
}

function noteToMarkdown(note: Note): string {
  const tags = parseTags(note.tags)
  const iocs = parseJsonArray(note.linked_iocs)
  const techs = parseJsonArray(note.linked_techniques)
  const cves = parseJsonArray(note.linked_cves)
  const lines: string[] = [`# ${note.title}`, '', `> ${formatDate(note.created_at)} · ${formatDate(note.updated_at)}`, '']
  if (tags.length) lines.push(`**Tags:** ${tags.join(', ')}`, '')
  if (iocs.length) lines.push(`**IOCs:** ${iocs.join(', ')}`, '')
  if (techs.length) lines.push(`**MITRE:** ${techs.join(', ')}`, '')
  if (cves.length) lines.push(`**CVE:** ${cves.join(', ')}`, '')
  if (tags.length || iocs.length || techs.length || cves.length) lines.push('---', '')
  lines.push(note.content || '')
  return lines.join('\n')
}

function noteToHTML(note: Note): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const tags = parseTags(note.tags)
  const iocs = parseJsonArray(note.linked_iocs)
  const techs = parseJsonArray(note.linked_techniques)
  const cves = parseJsonArray(note.linked_cves)
  const links = [...iocs.map(v => `IOC:${v}`), ...techs.map(v => `MITRE:${v}`), ...cves].map(esc).join(', ')
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>${esc(note.title)}</title>
<style>body{font-family:monospace;background:#06080f;color:#f1f5f9;padding:2em;max-width:900px;margin:auto}h1{color:#00d4ff;border-bottom:1px solid #1e2d40;padding-bottom:.5em}.meta{color:#64748b;font-size:.8em;margin-bottom:1em}.tag{background:#0d131f;border:1px solid #1e2d40;color:#00d4ff;padding:2px 8px;margin-right:4px;font-size:.8em;display:inline-block}.links{border:1px solid #1e2d40;padding:1em;background:#0d131f;margin:1em 0;font-size:.85em;color:#64748b}.content{white-space:pre-wrap;background:#0d131f;border:1px solid #1e2d40;padding:1em;line-height:1.6;margin-top:1em}</style>
</head><body>
<h1>${esc(note.title)}</h1>
<div class="meta">${esc(formatDate(note.created_at))} · ${esc(formatDate(note.updated_at))}</div>
${tags.length ? tags.map(t => `<span class="tag">${esc(t)}</span>`).join('') : ''}
${links ? `<div class="links">${links}</div>` : ''}
<div class="content">${esc(note.content || '')}</div>
</body></html>`
}

type ExportFormat = 'json' | 'txt' | 'md' | 'html'

function doExportSingle(note: Note, fmt: ExportFormat) {
  const slug = slugify(note.title)
  if (fmt === 'json') { downloadFile(JSON.stringify(note, null, 2), `${slug}.json`, 'application/json'); return }
  if (fmt === 'txt') { downloadFile(noteToTxt(note), `${slug}.txt`, 'text/plain'); return }
  if (fmt === 'md') { downloadFile(noteToMarkdown(note), `${slug}.md`, 'text/markdown'); return }
  downloadFile(noteToHTML(note), `${slug}.html`, 'text/html')
}

function doExportAll(notes: Note[], fmt: ExportFormat) {
  const ts = new Date().toISOString().slice(0, 10)
  if (fmt === 'json') {
    downloadFile(
      JSON.stringify({ exported_at: new Date().toISOString(), count: notes.length, notes }, null, 2),
      `notes-${ts}.json`, 'application/json'
    )
    return
  }
  if (fmt === 'txt') {
    downloadFile(notes.map(noteToTxt).join('\n\n' + '─'.repeat(60) + '\n\n'), `notes-${ts}.txt`, 'text/plain')
    return
  }
  if (fmt === 'md') {
    downloadFile(notes.map(noteToMarkdown).join('\n\n---\n\n'), `notes-${ts}.md`, 'text/markdown')
    return
  }
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const body = notes
    .map(n => `<section><h2>${esc(n.title)}</h2><div class="meta">${esc(formatDate(n.updated_at))}</div><pre>${esc(n.content || '')}</pre></section>`)
    .join('\n')
  downloadFile(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Notes — CyberHub</title><style>body{font-family:monospace;background:#06080f;color:#f1f5f9;padding:2em}h2{color:#00d4ff}.meta{color:#64748b;font-size:.8em}pre{white-space:pre-wrap;background:#0d131f;border:1px solid #1e2d40;padding:1em}section{margin-bottom:3em;border-bottom:1px solid #1e2d40;padding-bottom:2em}</style></head><body>${body}</body></html>`,
    `notes-${ts}.html`, 'text/html'
  )
}

// ── Import helpers ────────────────────────────────────────────────────────────

function filenameToTitle(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
}

function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body?.textContent ?? html).trim()
}

function serializeField(val: unknown): string {
  if (typeof val === 'string') return val
  if (Array.isArray(val)) return JSON.stringify(val.map(String))
  return ''
}

function parseJsonImport(text: string): NoteCreateRequest[] | null {
  try {
    const parsed: unknown = JSON.parse(text)
    const toReq = (obj: unknown): NoteCreateRequest | null => {
      if (typeof obj !== 'object' || obj === null) return null
      const o = obj as Record<string, unknown>
      if (typeof o.title !== 'string' || !o.title.trim()) return null
      return {
        title: o.title.trim(),
        content: typeof o.content === 'string' ? o.content : '',
        tags: serializeField(o.tags),
        linked_iocs: serializeField(o.linked_iocs),
        linked_techniques: serializeField(o.linked_techniques),
        linked_cves: serializeField(o.linked_cves),
      }
    }
    if (Array.isArray(parsed)) {
      const notes = parsed.map(toReq).filter((n): n is NoteCreateRequest => n !== null)
      return notes.length ? notes : null
    }
    if (typeof parsed === 'object' && parsed !== null) {
      const obj = parsed as Record<string, unknown>
      if (Array.isArray(obj.notes)) {
        const notes = obj.notes.map(toReq).filter((n): n is NoteCreateRequest => n !== null)
        return notes.length ? notes : null
      }
      const single = toReq(parsed)
      return single ? [single] : null
    }
    return null
  } catch {
    return null
  }
}

function parseMdImport(text: string, filename: string): NoteCreateRequest {
  const headingMatch = /^#\s+(.+)$/m.exec(text)
  const title = headingMatch ? headingMatch[1].trim() : filenameToTitle(filename)
  const content = headingMatch ? text.replace(/^#\s+.+\n?/, '').trim() : text
  return { title, content }
}

async function readFileAsNotes(file: File): Promise<NoteCreateRequest[]> {
  const text = await file.text()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'json') {
    const notes = parseJsonImport(text)
    if (!notes) throw new Error(`JSON invalide ou champ "title" manquant : ${file.name}`)
    return notes
  }
  if (ext === 'md') return [parseMdImport(text, file.name)]
  if (ext === 'txt') return [{ title: filenameToTitle(file.name), content: text }]
  if (ext === 'html' || ext === 'htm') return [{ title: filenameToTitle(file.name), content: htmlToText(text) }]
  throw new Error(`Format non supporté : .${ext}`)
}

// ── Sub-components ────────────────────────────────────────────────────────────

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [mode, setMode] = useState<'view' | 'edit' | 'new'>('view')
  const [searchQ, setSearchQ] = useState('')
  const [_searching, setSearching] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [importPreview, setImportPreview] = useState<NoteCreateRequest[] | null>(null)
  const [importing, setImporting] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)
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

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportOpen) return
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [exportOpen])

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
    if (type === 'ioc') { navigate(`/ioc?selected=${encodeURIComponent(value)}`); return }
    if (type === 'mitre') { navigate(`/mitre?find=${encodeURIComponent(value)}`); return }
    navigate(`/cve?find=${encodeURIComponent(value)}`)
  }

  const handleImportFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    const allNotes: NoteCreateRequest[] = []
    const errors: string[] = []
    await Promise.all(
      files.map(async file => {
        try {
          const parsed = await readFileAsNotes(file)
          allNotes.push(...parsed)
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err))
        }
      })
    )
    errors.forEach(msg => toast.error(msg))
    if (!allNotes.length) return
    if (allNotes.length === 1) {
      setImporting(true)
      try {
        const note = await notesApi.create(allNotes[0])
        toast.success('Note importée')
        setNotes(prev => [note, ...prev])
        setSelectedNote(note)
        setMode('view')
      } catch {
        toast.error("Échec de l'import")
      } finally {
        setImporting(false)
      }
      return
    }
    setImportPreview(allNotes)
  }

  const handleConfirmImport = async () => {
    if (!importPreview) return
    setImporting(true)
    let ok = 0
    let fail = 0
    const created: Note[] = []
    for (const req of importPreview) {
      try {
        const note = await notesApi.create(req)
        created.push(note)
        ok++
      } catch {
        fail++
      }
    }
    setNotes(prev => [...created, ...prev])
    if (ok) toast.success(`${ok} note(s) importée(s)`)
    if (fail) toast.error(`${fail} note(s) en échec`)
    setImportPreview(null)
    setImporting(false)
    if (created.length > 0) { setSelectedNote(created[0]); setMode('view') }
  }

  return (
    <div className="flex flex-col h-full bg-[#06080f] text-[#f1f5f9]">
      {/* Header */}
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
        <div className="flex items-center gap-2 font-mono text-[10px]">
          <span className="text-[#64748b] hidden sm:block">STATUS</span>
          <span className="text-[#10b981] hidden sm:block">ONLINE</span>

          {/* Import */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e2d40] hover:bg-[#2a3f55] font-bold border border-[#334155] transition-colors cursor-pointer select-none">
            <Upload size={12} /> IMPORT
            <input
              type="file"
              accept=".json,.txt,.md,.html,.htm"
              multiple
              onChange={handleImportFiles}
              className="hidden"
            />
          </label>

          {/* Export */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setExportOpen(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e2d40] hover:bg-[#2a3f55] font-bold border border-[#334155] transition-colors"
            >
              <Download size={12} /> EXPORT
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 border border-[#1e2d40] bg-[#0a0f16] z-50 min-w-[170px] shadow-xl py-1">
                {selectedNote && (
                  <>
                    <p className="px-3 pt-1.5 pb-1 text-[9px] text-[#4a6480] uppercase tracking-widest">NOTE ACTUELLE</p>
                    {(['json', 'md', 'txt', 'html'] as const).map(fmt => (
                      <button
                        key={fmt}
                        onClick={() => { doExportSingle(selectedNote, fmt); setExportOpen(false) }}
                        className="w-full text-left px-4 py-1.5 text-[11px] text-[#cbd5e1] hover:bg-[#1e2d40] hover:text-[#00d4ff] transition-colors"
                      >
                        {fmt === 'json' ? 'Exporter en JSON' : fmt === 'md' ? 'Exporter en Markdown' : fmt === 'txt' ? 'Exporter en TXT' : 'Exporter en HTML'}
                      </button>
                    ))}
                    <div className="border-t border-[#1e2d40] my-1" />
                  </>
                )}
                <p className="px-3 pt-1.5 pb-1 text-[9px] text-[#4a6480] uppercase tracking-widest">
                  TOUTES ({notes.length})
                </p>
                {(['json', 'md', 'txt', 'html'] as const).map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => { doExportAll(notes, fmt); setExportOpen(false) }}
                    className="w-full text-left px-4 py-1.5 text-[11px] text-[#cbd5e1] hover:bg-[#1e2d40] hover:text-[#00d4ff] transition-colors"
                  >
                    {fmt === 'json' ? 'Exporter tout en JSON' : fmt === 'md' ? 'Exporter tout en Markdown' : fmt === 'txt' ? 'Exporter tout en TXT' : 'Exporter tout en HTML'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* New note */}
          <button
            onClick={() => { setMode('new'); setSelectedNote(null) }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e2d40] hover:bg-[#2a3f55] font-bold border border-[#334155] transition-colors"
          >
            <Plus size={12} /> NEW NOTE
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-0">
          {/* Left — note list */}
          <div className="border border-[#1e2d40] bg-[#0a0f16] flex flex-col overflow-hidden">
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

          {/* Right — viewer / editor */}
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

      {/* Import confirmation overlay */}
      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#0a0f16] border border-[#1e2d40] p-6 max-w-lg w-full mx-4 space-y-4 shadow-2xl">
            <p className="text-sm font-mono font-bold text-[#00d4ff] uppercase tracking-widest">
              IMPORT — {importPreview.length} NOTE(S) DÉTECTÉE(S)
            </p>
            <div className="max-h-60 overflow-y-auto space-y-1 border border-[#1e2d40] bg-[#0d131f] p-3">
              {importPreview.map((n, i) => (
                <p key={i} className="text-xs font-mono text-[#cbd5e1] truncate">
                  <span className="text-[#4a6480] mr-2">{String(i + 1).padStart(2, '0')}.</span>
                  {n.title}
                </p>
              ))}
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleConfirmImport}
                disabled={importing}
                className="flex items-center gap-2 border border-[#00d4ff]/20 bg-[#00d4ff]/10 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#00d4ff] transition-colors hover:bg-[#00d4ff]/20 disabled:opacity-50"
              >
                {importing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                {importing ? 'IMPORTATION...' : `IMPORTER ${importPreview.length} NOTE(S)`}
              </button>
              <button
                onClick={() => setImportPreview(null)}
                disabled={importing}
                className="flex items-center gap-2 border border-[#1e2d40] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#64748b] hover:text-[#f1f5f9] transition-colors disabled:opacity-50"
              >
                <X size={12} /> ANNULER
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
