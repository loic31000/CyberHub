import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, ChevronLeft, Download, Edit2, FileText, Loader2,
  Plus, Save, Search, Trash2, Upload, X,
} from 'lucide-react'
import { notesApi } from '@/api/client'
import type { Note, NoteCreateRequest } from '@/types/note'
import { toast } from '@/store/toast'
import ConfirmModal from '@/components/ConfirmModal'
import NotesHero from '@/notes26/NotesHero'
import '@/notes26/notes.css'

function parseTags(raw: string): string[] {
  if (!raw) return []
  try {
    const p: unknown = JSON.parse(raw)
    if (Array.isArray(p)) return p.flatMap(value => {
      if (typeof value === 'string' || typeof value === 'number') {
        const text = String(value).trim()
        return text ? [text] : []
      }
      return []
    })
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
    if (Array.isArray(parsed)) return parsed.flatMap(value => {
      if (typeof value === 'string' || typeof value === 'number') {
        const text = String(value).trim()
        return text ? [text] : []
      }
      return []
    })
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
  return str.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'note'
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Let the browser consume the object URL before releasing it.
  const revokeObjectURL = URL.revokeObjectURL.bind(URL)
  window.setTimeout(() => revokeObjectURL(url), 1000)
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
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
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
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  const body = notes
    .map(n => {
      const tags = parseTags(n.tags)
      const iocs = parseJsonArray(n.linked_iocs)
      const techs = parseJsonArray(n.linked_techniques)
      const cves = parseJsonArray(n.linked_cves)
      const links = [...iocs.map(v => `IOC:${v}`), ...techs.map(v => `MITRE:${v}`), ...cves]
      return `<section><h2>${esc(n.title)}</h2><div class="meta">${esc(formatDate(n.created_at))} · ${esc(formatDate(n.updated_at))}</div>${tags.map(tag => `<span class="tag">${esc(tag)}</span>`).join('')}${links.length ? `<div class="links">${links.map(esc).join(', ')}</div>` : ''}<pre>${esc(n.content || '')}</pre></section>`
    })
    .join('\n')
  downloadFile(
    `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Notes — CyberHub</title><style>body{font-family:monospace;background:#06080f;color:#f1f5f9;padding:2em}h2{color:#00d4ff}.meta{color:#64748b;font-size:.8em}.tag{background:#0d131f;border:1px solid #1e2d40;color:#00d4ff;padding:2px 8px;margin-right:4px;font-size:.8em;display:inline-block}.links{border:1px solid #1e2d40;padding:1em;background:#0d131f;margin:1em 0;font-size:.85em;color:#64748b}pre{white-space:pre-wrap;background:#0d131f;border:1px solid #1e2d40;padding:1em}section{margin-bottom:3em;border-bottom:1px solid #1e2d40;padding-bottom:2em}</style></head><body>${body}</body></html>`,
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
  if (Array.isArray(val)) return JSON.stringify(val.flatMap(value => {
    if (typeof value !== 'string' && typeof value !== 'number') return []
    const text = String(value).trim()
    return text ? [text] : []
  }))
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

// ── Reference section ───────────────────────────────────────────────────────

type RefKind = 'ioc' | 'mitre' | 'cve'
const REF_META: Record<RefKind, { label: string }> = {
  ioc: { label: 'IOC' },
  mitre: { label: 'MITRE ATT&CK' },
  cve: { label: 'CVE' },
}
const refText = (kind: RefKind, v: string) => (kind === 'ioc' ? `IOC #${v}` : kind === 'mitre' ? v : v)

function RefGroup({ kind, values, onOpen }: { kind: RefKind; values: string[]; onOpen: (kind: RefKind, v: string) => void }) {
  if (values.length === 0) return null
  return (
    <div className="nt26-refgroup" data-kind={kind}>
      <p className="nt26-refgroup-label"><i aria-hidden="true" />{REF_META[kind].label} <span>{values.length}</span></p>
      <ul>
        {values.map(v => (
          <li key={v}>
            <button type="button" onClick={() => onOpen(kind, v)}>{refText(kind, v)}</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Editor ──────────────────────────────────────────────────────────────────

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
  const [titleError, setTitleError] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!title.trim()) {
      setTitleError(true)
      toast.error('Titre requis')
      document.getElementById('nt26-in-title')?.focus()
      return
    }
    setSaving(true)
    setSaveError(null)
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
    } catch {
      setSaveError('Impossible d’enregistrer la note. Vérifiez votre connexion et réessayez.')
      toast.error('Impossible d’enregistrer la note')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="nt26-editor" onSubmit={e => { e.preventDefault(); handleSave() }} noValidate>
      {/* Writing surface: title and body dominate, minimal chrome. */}
      <div className="nt26-ed-main">
        <p className="nt26-ed-kicker">{initial ? 'Édition de note' : 'Nouvelle note'}</p>
        <label className="nt26-sr" htmlFor="nt26-in-title">Titre de la note</label>
        <input id="nt26-in-title" className="nt26-ed-title" value={title} autoFocus
          onChange={e => { setTitle(e.target.value); if (titleError) setTitleError(false) }}
          placeholder="Titre de la note" aria-invalid={titleError || undefined}
          aria-describedby={titleError ? 'nt26-err-title' : undefined} />
        {titleError && <p id="nt26-err-title" className="nt26-field-error" role="alert">Le titre est requis</p>}
        {saveError && <p className="nt26-field-error" role="alert">{saveError}</p>}
        <label className="nt26-sr" htmlFor="nt26-in-content">Corps de la note</label>
        <textarea id="nt26-in-content" className="nt26-ed-body" value={content}
          onChange={e => setContent(e.target.value)} placeholder="Rédigez la note… (texte / Markdown)"
          rows={18} spellCheck={false} />
        <div className="nt26-ed-actions">
          <button type="button" className="nt26-ghost" onClick={onCancel} disabled={saving}>Annuler</button>
          <button type="submit" className="nt26-btn is-primary" disabled={saving}>
            {saving ? <Loader2 size={15} className="nt26-spin" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
            {saving ? 'Enregistrement…' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      {/* Metadata rail: classification and references, secondary to the content. */}
      <aside className="nt26-ed-side">
        <div className="nt26-side-sec">
          <h3>Classification</h3>
          <div className="nt26-side-field">
            <label htmlFor="nt26-in-tags">Tags</label>
            <input id="nt26-in-tags" className="nt26-side-in" value={tags} onChange={e => setTags(e.target.value)}
              placeholder="incident, phishing, prod" aria-describedby="nt26-hint-tags" />
            <small id="nt26-hint-tags">Séparés par des virgules.</small>
          </div>
        </div>
        <div className="nt26-side-sec">
          <h3>Références liées</h3>
          <div className="nt26-side-field" data-kind="ioc">
            <label htmlFor="nt26-in-iocs"><i aria-hidden="true" />IOC</label>
            <input id="nt26-in-iocs" className="nt26-side-in is-mono" value={linkedIocs} onChange={e => setLinkedIocs(e.target.value)}
              placeholder="IDs, séparés par virgule" autoComplete="off" />
          </div>
          <div className="nt26-side-field" data-kind="mitre">
            <label htmlFor="nt26-in-techs"><i aria-hidden="true" />MITRE ATT&amp;CK</label>
            <input id="nt26-in-techs" className="nt26-side-in is-mono" value={linkedTechniques} onChange={e => setLinkedTechniques(e.target.value)}
              placeholder="T1059, T1105" autoComplete="off" />
          </div>
          <div className="nt26-side-field" data-kind="cve">
            <label htmlFor="nt26-in-cves"><i aria-hidden="true" />CVE</label>
            <input id="nt26-in-cves" className="nt26-side-in is-mono" value={linkedCves} onChange={e => setLinkedCves(e.target.value)}
              placeholder="CVE-2024-1234" autoComplete="off" />
          </div>
        </div>
      </aside>
    </form>
  )
}

// ── Export menu ───────────────────────────────────────────────────────────────

function ExportMenu({ note, notes }: { note: Note | null; notes: Note[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeAndRestoreFocus = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeAndRestoreFocus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const FMT: { id: ExportFormat; label: string }[] = [
    { id: 'json', label: 'JSON' }, { id: 'md', label: 'Markdown' }, { id: 'txt', label: 'TXT' }, { id: 'html', label: 'HTML' },
  ]
  return (
    <div className="nt26-export" ref={ref}>
      <button ref={triggerRef} type="button" className="nt26-btn" aria-expanded={open} aria-controls="nt26-export-options" aria-label="Exporter" title="Exporter des notes" onClick={() => setOpen(v => !v)} disabled={notes.length === 0 && !note}>
        <Download size={15} aria-hidden="true" /> <span className="nt26-export-text">Exporter</span>
      </button>
      {open && (
        <div id="nt26-export-options" className="nt26-export-menu">
          {note && (
            <div className="nt26-export-group" role="group" aria-label="Note actuelle">
              <p>Note actuelle</p>
              <div className="nt26-export-row">
                {FMT.map(f => (
                  <button key={f.id} type="button" onClick={() => { doExportSingle(note, f.id); closeAndRestoreFocus() }}>{f.label}</button>
                ))}
              </div>
            </div>
          )}
          <div className="nt26-export-group" role="group" aria-label="Toutes les notes">
            <p>Toutes les notes <span>{notes.length}</span></p>
            <div className="nt26-export-row">
              {FMT.map(f => (
                <button key={f.id} type="button" disabled={notes.length === 0}
                  onClick={() => { doExportAll(notes, f.id); closeAndRestoreFocus() }}>{f.label}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState(false)
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [mode, setMode] = useState<'view' | 'edit' | 'new'>('view')
  const [searchQ, setSearchQ] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchActive, setSearchActive] = useState(false)
  const [importPreview, setImportPreview] = useState<NoteCreateRequest[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [mobilePane, setMobilePane] = useState<'list' | 'doc'>('list')
  const listRequestId = useRef(0)
  const navigate = useNavigate()

  const runListRequest = useCallback(async (request: () => ReturnType<typeof notesApi.list>, isSearch: boolean) => {
    const requestId = ++listRequestId.current
    setLoading(true)
    setSearching(isSearch)
    setListError(false)
    try {
      const res = await request()
      if (requestId !== listRequestId.current) return
      const latestNotes = Array.isArray(res.notes) ? res.notes : []
      setNotes(latestNotes)
      setSelectedNote(current => current
        ? latestNotes.find(note => note.id === current.id) ?? null
        : null)
    } catch {
      if (requestId !== listRequestId.current) return
      setListError(true)
      toast.error(isSearch ? 'Erreur de recherche' : 'Impossible de charger les notes')
    } finally {
      if (requestId === listRequestId.current) {
        setLoading(false)
        setSearching(false)
      }
    }
  }, [])

  const loadNotes = useCallback(() => runListRequest(() => notesApi.list(), false), [runListRequest])

  useEffect(() => { loadNotes() }, [loadNotes])

  const handleSearch = async () => {
    const query = searchQ.trim()
    if (!query) { setSearchActive(false); await loadNotes(); return }
    setSearchActive(true)
    await runListRequest(() => notesApi.search(query), true)
  }
  const clearSearch = () => { setSearchQ(''); setSearchActive(false); void loadNotes() }

  const openNote = (note: Note) => { setSelectedNote(note); setMode('view'); setMobilePane('doc') }
  const startNew = () => { setMode('new'); setSelectedNote(null); setMobilePane('doc') }

  const handleCreate = async (req: NoteCreateRequest) => {
    const note = await notesApi.create(req)
    toast.success('Note créée')
    setNotes(prev => [note, ...prev])
    setSelectedNote(note)
    setMode('view')
    setMobilePane('doc')
  }

  const handleUpdate = async (req: NoteCreateRequest) => {
    if (!selectedNote) return
    const updated = await notesApi.update(selectedNote.id, req)
    toast.success('Note mise à jour')
    setNotes(prev => prev.map(n => n.id === updated.id ? updated : n))
    setSelectedNote(updated)
    setMode('view')
  }

  const performDelete = async (id: number) => {
    try {
      await notesApi.delete(id)
      toast.success('Note supprimée')
      setNotes(prev => prev.filter(n => n.id !== id))
      if (selectedNote?.id === id) { setSelectedNote(null); setMode('view'); setMobilePane('list') }
    } catch {
      toast.error('Impossible de supprimer')
    }
  }

  const navigateToLink = (type: RefKind, value: string) => {
    const normalized = value.trim()
    if (!normalized) return
    if (type === 'ioc') {
      const id = Number(normalized)
      if (!/^\d+$/.test(normalized) || !Number.isSafeInteger(id) || id < 1) {
        toast.error('Référence IOC invalide : un ID numérique est attendu')
        return
      }
      navigate(`/ioc?selected=${encodeURIComponent(normalized)}`)
      return
    }
    if (type === 'mitre') {
      const technique = normalized.toUpperCase()
      if (!/^T\d{4}(?:\.\d{3})?$/.test(technique)) {
        toast.error('Référence MITRE invalide : format Txxxx attendu')
        return
      }
      navigate(`/knowledge?source=mitre&id=${encodeURIComponent(technique)}`)
      return
    }
    if (!/^CVE-\d{4}-\d{4,}$/i.test(normalized)) {
      toast.error('Référence CVE invalide : format CVE-AAAA-NNNN attendu')
      return
    }
    navigate(`/knowledge?source=cve&id=${encodeURIComponent(normalized.toUpperCase())}`)
  }

  const handleImportFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    const outcomes = await Promise.all(files.map(async file => {
      try { return { notes: await readFileAsNotes(file), error: null } }
      catch (err) { return { notes: [], error: err instanceof Error ? err.message : String(err) } }
    }))
    const allNotes = outcomes.flatMap(outcome => outcome.notes)
    const errors = outcomes.flatMap(outcome => outcome.error ? [outcome.error] : [])
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
        setMobilePane('doc')
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
    if (created.length > 0) { setSelectedNote(created[0]); setMode('view'); setMobilePane('doc') }
  }

  const status = loading ? { text: 'CHARGEMENT', tone: 'busy' as const }
    : listError ? { text: 'REGISTRE INDISPONIBLE', tone: 'warn' as const }
    : selectedNote && mode === 'view' ? { text: 'NOTE OUVERTE', mark: `#${selectedNote.id}` }
    : mode !== 'view' ? { text: mode === 'new' ? 'NOUVELLE NOTE' : 'ÉDITION', tone: 'busy' as const }
    : { text: `${notes.length.toLocaleString('fr-FR')} NOTE${notes.length > 1 ? 'S' : ''}`, mark: searchActive ? 'RECHERCHE' : 'REGISTRE' }

  return (
    <div className="nt26">
      <div className="nt26-frame">
        <NotesHero status={status} />

        <div className="nt26-workspace" data-pane={mobilePane}>
          {/* Registre */}
          <aside className="nt26-registre" aria-label="Registre des notes">
            <div className="nt26-reg-head">
              <div className="nt26-reg-title">
                <span>Carnet</span>
                {!loading && !listError && <b>{notes.length.toLocaleString('fr-FR')}</b>}
              </div>
              <div className="nt26-reg-tools">
                <label className="nt26-reg-tool" title="Importer des notes">
                  <Upload size={15} aria-hidden="true" /><span className="nt26-sr">Importer</span>
                  <input type="file" accept=".json,.txt,.md,.html,.htm" multiple onChange={handleImportFiles} />
                </label>
                <ExportMenu note={selectedNote} notes={notes} />
              </div>
            </div>
            <button type="button" className="nt26-new" onClick={startNew}>
              <Plus size={16} aria-hidden="true" /> Nouvelle note
            </button>
            <div className="nt26-search">
              <Search size={17} aria-hidden="true" />
              <label className="nt26-sr" htmlFor="nt26-search-in">Rechercher une note</label>
              <input id="nt26-search-in" type="search" value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
                placeholder="Rechercher une note…" autoComplete="off" aria-busy={searching || undefined} />
              {searching && <span className="nt26-search-spinner" aria-hidden="true"><Loader2 size={15} className="nt26-spin" /></span>}
              {searchQ && <button type="button" className="nt26-search-clear" onClick={clearSearch} aria-label="Effacer la recherche"><X size={15} aria-hidden="true" /></button>}
            </div>

            <div className="nt26-list" role="list" aria-busy={loading || searching || importing || undefined}>
              {loading ? (
                <div className="nt26-list-state" role="status"><Loader2 size={20} className="nt26-spin" aria-hidden="true" /> Chargement…</div>
              ) : listError ? (
                <div className="nt26-list-state is-error" role="alert">
                  <AlertTriangle size={22} aria-hidden="true" />
                  <p>Chargement impossible</p>
                  <button type="button" className="nt26-btn" onClick={searchActive ? handleSearch : loadNotes}>Réessayer</button>
                </div>
              ) : notes.length === 0 ? (
                <div className="nt26-list-state">
                  <FileText size={22} aria-hidden="true" />
                  <p>{searchActive ? 'Aucune note ne correspond.' : 'Aucune note. Créez-en une !'}</p>
                  {searchActive && <button type="button" className="nt26-btn" onClick={clearSearch}>Effacer la recherche</button>}
                </div>
              ) : (
                notes.map(note => {
                  const tags = parseTags(note.tags)
                  const refs = [
                    { k: 'IOC', n: parseJsonArray(note.linked_iocs).length },
                    { k: 'ATT&CK', n: parseJsonArray(note.linked_techniques).length },
                    { k: 'CVE', n: parseJsonArray(note.linked_cves).length },
                  ].filter(r => r.n > 0)
                  const active = selectedNote?.id === note.id && mode === 'view'
                  return (
                    <div key={note.id} role="listitem" className="nt26-entry" data-active={active || undefined}>
                      <button type="button" className="nt26-entry-main" aria-current={active || undefined} onClick={() => openNote(note)}>
                        <span className="nt26-entry-title">{note.title}</span>
                        <span className="nt26-entry-date">{formatDate(note.updated_at)}</span>
                        {note.content && <span className="nt26-entry-excerpt">{note.content}</span>}
                        {(tags.length > 0 || refs.length > 0) && (
                          <span className="nt26-entry-foot">
                            {tags.length > 0 && <span className="nt26-entry-tags">{tags.slice(0, 3).join(' · ')}{tags.length > 3 ? ' …' : ''}</span>}
                            {refs.length > 0 && <span className="nt26-entry-refs">{refs.map(r => `${r.k} ${r.n}`).join('  ·  ')}</span>}
                          </span>
                        )}
                      </button>
                      <button type="button" className="nt26-entry-del" onClick={() => setConfirmDeleteId(note.id)} aria-label={`Supprimer la note ${note.title}`}>
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </aside>

          {/* Document / editor */}
          <section className="nt26-doc" aria-label="Note">
            {mobilePane === 'doc' && (
              <button type="button" className="nt26-back" onClick={() => setMobilePane('list')}>
                <ChevronLeft size={16} aria-hidden="true" /> Registre
              </button>
            )}

            {mode === 'new' && <NoteEditor onSave={handleCreate} onCancel={() => { setMode('view'); setMobilePane('list') }} />}
            {mode === 'edit' && selectedNote && <NoteEditor initial={selectedNote} onSave={handleUpdate} onCancel={() => setMode('view')} />}

            {mode === 'view' && !selectedNote && (
              <div className="nt26-empty">
                <FileText size={40} aria-hidden="true" />
                <h2>Aucune note sélectionnée</h2>
                <p>Choisis une note dans le registre, ou crée-en une nouvelle.</p>
                <button type="button" className="nt26-btn is-primary" onClick={startNew}><Plus size={15} aria-hidden="true" /> Nouvelle note</button>
              </div>
            )}

            {mode === 'view' && selectedNote && (() => {
              const tags = parseTags(selectedNote.tags)
              const iocs = parseJsonArray(selectedNote.linked_iocs)
              const techs = parseJsonArray(selectedNote.linked_techniques)
              const cves = parseJsonArray(selectedNote.linked_cves)
              const hasRefs = iocs.length > 0 || techs.length > 0 || cves.length > 0
              return (
                <article className="nt26-note">
                  {/* Document column: title and content dominate. */}
                  <div className="nt26-note-main">
                    <header className="nt26-note-head">
                      <p className="nt26-note-kicker">Dossier opérationnel · #{selectedNote.id}</p>
                      <h2>{selectedNote.title}</h2>
                      <div className="nt26-note-actions">
                        <button type="button" className="nt26-ghost" onClick={() => setMode('edit')}><Edit2 size={14} aria-hidden="true" /> Modifier</button>
                        <button type="button" className="nt26-ghost is-danger" onClick={() => setConfirmDeleteId(selectedNote.id)}><Trash2 size={14} aria-hidden="true" /> Supprimer</button>
                      </div>
                    </header>
                    <div className="nt26-content" aria-label="Contenu">
                      {selectedNote.content
                        ? <pre tabIndex={0}>{selectedNote.content}</pre>
                        : <p className="nt26-content-empty">Cette note n'a pas encore de contenu.</p>}
                    </div>
                  </div>

                  {/* Context rail: dossier metadata, tags and linked references. */}
                  <aside className="nt26-context" aria-label="Contexte de la note">
                    <section className="nt26-ctx-sec">
                      <h3>Chronologie</h3>
                      <dl className="nt26-ctx-meta">
                        <div><dt>Créée</dt><dd>{formatDate(selectedNote.created_at)}</dd></div>
                        <div><dt>Modifiée</dt><dd>{formatDate(selectedNote.updated_at)}</dd></div>
                        {selectedNote.created_by && <div><dt>Auteur</dt><dd>{selectedNote.created_by}</dd></div>}
                      </dl>
                    </section>
                    {tags.length > 0 && (
                      <section className="nt26-ctx-sec">
                        <h3>Tags</h3>
                          <ul className="nt26-ctx-tags" aria-label="Tags">{tags.map((t, index) => <li key={`${t}-${index}`}>{t}</li>)}</ul>
                      </section>
                    )}
                    {hasRefs && (
                      <section className="nt26-ctx-sec" aria-labelledby="nt26-refs-title">
                        <h3 id="nt26-refs-title">Références liées</h3>
                        <div className="nt26-ctx-refs">
                          <RefGroup kind="ioc" values={iocs} onOpen={navigateToLink} />
                          <RefGroup kind="mitre" values={techs} onOpen={navigateToLink} />
                          <RefGroup kind="cve" values={cves} onOpen={navigateToLink} />
                        </div>
                      </section>
                    )}
                  </aside>
                </article>
              )
            })()}
          </section>
        </div>
      </div>

      {importPreview && (
        <div className="nt26-dialog-layer" role="dialog" aria-modal="true" aria-labelledby="nt26-import-title">
          <div className="nt26-dialog-scrim" onClick={() => !importing && setImportPreview(null)} aria-hidden="true" />
          <div className="nt26-dialog">
            <header>
              <h2 id="nt26-import-title">Import — {importPreview.length} note(s) détectée(s)</h2>
              <button type="button" className="nt26-icon-btn" onClick={() => setImportPreview(null)} disabled={importing} aria-label="Fermer"><X size={18} aria-hidden="true" /></button>
            </header>
            <ol className="nt26-import-list">
              {importPreview.map((n, i) => (
                <li key={i}><span>{String(i + 1).padStart(2, '0')}</span>{n.title}</li>
              ))}
            </ol>
            <div className="nt26-dialog-bar">
              <button type="button" className="nt26-btn" onClick={() => setImportPreview(null)} disabled={importing}>Annuler</button>
              <button type="button" className="nt26-btn is-primary" onClick={handleConfirmImport} disabled={importing}>
                {importing ? <Loader2 size={15} className="nt26-spin" aria-hidden="true" /> : <Upload size={15} aria-hidden="true" />}
                {importing ? 'Importation…' : `Importer ${importPreview.length} note(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmDeleteId !== null}
        title="SUPPRIMER CETTE NOTE ?"
        message="Cette action est irréversible. La note sera définitivement effacée."
        confirmLabel="Supprimer"
        danger
        onConfirm={() => { const id = confirmDeleteId; setConfirmDeleteId(null); if (id !== null) performDelete(id) }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
