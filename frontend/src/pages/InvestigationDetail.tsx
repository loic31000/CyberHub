import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { investigationApi } from '@/api/client'
import type {
  Investigation,
  InvestigationEvent,
  InvestigationStatus,
  EventType,
  EventSeverity,
  EventCreatePayload,
  EventFilter,
} from '@/types/investigation'
import { toast } from '@/store/toast'
import {
  Activity, ArrowLeft, Plus, Trash2, X, ShieldBan, StickyNote,
  ShieldAlert, Network, Terminal, BookOpen, Edit, Circle,
} from 'lucide-react'

const STATUS_COLORS: Record<InvestigationStatus, string> = {
  open:     'text-[#10b981] border-[#10b981]/30 bg-[#10b981]/10',
  closed:   'text-[#64748b] border-[#64748b]/30 bg-[#64748b]/10',
  archived: 'text-[#eab308] border-[#eab308]/30 bg-[#eab308]/10',
}

const STATUS_LABELS: Record<InvestigationStatus, string> = {
  open: 'OUVERT', closed: 'CLÔTURÉ', archived: 'ARCHIVÉ',
}

const SEVERITY_COLORS: Record<EventSeverity, string> = {
  info:     'text-[#64748b] border-[#64748b]/30',
  low:      'text-[#00d4ff] border-[#00d4ff]/30',
  medium:   'text-[#eab308] border-[#eab308]/30',
  high:     'text-[#f97316] border-[#f97316]/30',
  critical: 'text-[#ef4444] border-[#ef4444]/30',
}

const SEVERITY_DOT: Record<EventSeverity, string> = {
  info:     'bg-[#64748b]',
  low:      'bg-[#00d4ff]',
  medium:   'bg-[#eab308]',
  high:     'bg-[#f97316]',
  critical: 'bg-[#ef4444]',
}

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  ioc:      'IOC',
  note:     'NOTE',
  cve:      'CVE',
  bgp:      'BGP',
  mitre:    'MITRE',
  playbook: 'PLAYBOOK',
  manual:   'MANUEL',
}

function eventTypeIcon(t: EventType) {
  const cls = 'shrink-0'
  switch (t) {
    case 'ioc':      return <ShieldBan   size={13} className={cls} />
    case 'note':     return <StickyNote  size={13} className={cls} />
    case 'cve':      return <ShieldAlert size={13} className={cls} />
    case 'bgp':      return <Network     size={13} className={cls} />
    case 'mitre':    return <Terminal    size={13} className={cls} />
    case 'playbook': return <BookOpen    size={13} className={cls} />
    case 'manual':   return <Edit        size={13} className={cls} />
  }
}

const inputCls = 'w-full bg-[#0d131f] border border-[#1e2d40] rounded px-3 py-2 font-mono text-sm text-[#f1f5f9] placeholder-[#334155] focus:outline-none focus:border-[#00d4ff]/60'

interface EventFormProps {
  investigationId: number
  onCreated: (ev: InvestigationEvent) => void
  onCancel: () => void
}

function EventForm({ investigationId, onCreated, onCancel }: EventFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventType, setEventType] = useState<EventType>('manual')
  const [severity, setSeverity] = useState<EventSeverity>('info')
  const [timestamp, setTimestamp] = useState(() => new Date().toISOString().slice(0, 16))
  const [sourceModule, setSourceModule] = useState('')
  const [sourceEntityId, setSourceEntityId] = useState('')
  const [metadata, setMetadata] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { toast.error('Le titre est requis'); return }
    setSaving(true)
    try {
      const payload: EventCreatePayload = {
        title: title.trim(),
        description: description.trim(),
        event_type: eventType,
        severity,
        timestamp: timestamp ? new Date(timestamp).toISOString() : undefined,
        source_module: sourceModule.trim() || undefined,
        source_entity_id: sourceEntityId.trim() || undefined,
        metadata: metadata.trim() || undefined,
      }
      const ev = await investigationApi.createEvent(investigationId, payload)
      toast.success('Événement ajouté')
      onCreated(ev)
    } catch {
      toast.error('Erreur lors de l\'ajout')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-[#00d4ff]/20 bg-[#0a0f16] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#00d4ff]">NOUVEL ÉVÉNEMENT</h3>
        <button onClick={onCancel} className="p-1 rounded hover:bg-[#1e2d40] text-[#64748b] hover:text-[#f1f5f9] transition-colors">
          <X size={14} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1">HORODATAGE</label>
            <input type="datetime-local" value={timestamp} onChange={e => setTimestamp(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1">TYPE</label>
            <select value={eventType} onChange={e => setEventType(e.target.value as EventType)} className={inputCls}>
              {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map(t => (
                <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1">TITRE *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="ex: IP malveillante détectée sur AS13335…" className={inputCls} />
        </div>
        <div>
          <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1">SÉVÉRITÉ</label>
          <select value={severity} onChange={e => setSeverity(e.target.value as EventSeverity)} className={inputCls}>
            <option value="info">INFO</option>
            <option value="low">LOW</option>
            <option value="medium">MEDIUM</option>
            <option value="high">HIGH</option>
            <option value="critical">CRITICAL</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1">DESCRIPTION</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Observations, contexte, liens…" className={inputCls + ' resize-none'} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1">MODULE SOURCE</label>
            <input value={sourceModule} onChange={e => setSourceModule(e.target.value)} placeholder="ex: ioc, bgp, osint…" className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1">ID ENTITÉ SOURCE</label>
            <input value={sourceEntityId} onChange={e => setSourceEntityId(e.target.value)} placeholder="ex: 42, CVE-2024-1234…" className={inputCls} />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1">MÉTADONNÉES <span className="normal-case">(JSON ou texte libre)</span></label>
          <input value={metadata} onChange={e => setMetadata(e.target.value)} placeholder='ex: {"asn":13335,"prefix":"1.1.1.0/24"}' className={inputCls} />
        </div>
        <div className="flex gap-3 justify-end pt-1">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-xs font-mono border border-[#1e2d40] text-[#64748b] hover:text-[#f1f5f9] transition-colors">
            ANNULER
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-xs font-mono font-bold bg-[#00d4ff] text-[#06080f] rounded hover:bg-[#00d4ff]/80 disabled:opacity-50 transition-colors">
            {saving ? 'AJOUT...' : 'AJOUTER'}
          </button>
        </div>
      </form>
    </div>
  )
}

function formatTs(ts: string) {
  const d = new Date(ts)
  return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function InvestigationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const invId = Number(id)

  const [inv, setInv] = useState<Investigation | null>(null)
  const [events, setEvents] = useState<InvestigationEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<EventFilter>({ order: 'asc' })
  const [editing, setEditing] = useState(false)

  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editStatus, setEditStatus] = useState<InvestigationStatus>('open')
  const [editTags, setEditTags] = useState('')
  const [saving, setSaving] = useState(false)

  const loadEvents = useCallback(() => {
    investigationApi.listEvents(invId, filter)
      .then(r => setEvents(r.items))
      .catch(() => toast.error('Erreur chargement des événements'))
  }, [invId, filter])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      investigationApi.get(invId),
      investigationApi.listEvents(invId, filter),
    ])
      .then(([i, evs]) => {
        setInv(i)
        setEvents(evs.items)
        setEditTitle(i.title)
        setEditDesc(i.description)
        setEditStatus(i.status)
        setEditTags(i.tags)
      })
      .catch(() => toast.error('Investigation introuvable'))
      .finally(() => setLoading(false))
  }, [invId])

  useEffect(() => {
    if (!loading) loadEvents()
  }, [filter])

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTitle.trim()) { toast.error('Le titre est requis'); return }
    setSaving(true)
    try {
      const updated = await investigationApi.update(invId, {
        title: editTitle.trim(),
        description: editDesc.trim(),
        status: editStatus,
        tags: editTags.trim(),
      })
      setInv(updated)
      setEditing(false)
      toast.success('Investigation mise à jour')
    } catch {
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteEvent = async (ev: InvestigationEvent) => {
    if (!confirm(`Supprimer l'événement "${ev.title}" ?`)) return
    try {
      await investigationApi.deleteEvent(ev.id)
      setEvents(prev => prev.filter(e => e.id !== ev.id))
      toast.success('Événement supprimé')
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#06080f] text-[#64748b] font-mono text-sm">
        CHARGEMENT...
      </div>
    )
  }

  if (!inv) {
    return (
      <div className="flex h-full items-center justify-center bg-[#06080f] text-[#64748b] font-mono text-sm">
        INVESTIGATION INTROUVABLE
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#06080f] text-[#f1f5f9]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d40] bg-[#0a0f16]/50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/investigations')}
            className="p-1.5 rounded hover:bg-[#1e2d40] text-[#64748b] hover:text-[#f1f5f9] transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <Activity className="text-[#00d4ff]" size={18} />
          <div>
            <h1 className="text-sm font-bold tracking-[0.15em] uppercase font-mono">{inv.title}</h1>
            <p className="text-[10px] text-[#64748b] font-mono">
              {events.length} événement{events.length > 1 ? 's' : ''} · créée le {new Date(inv.created_at).toLocaleDateString('fr-FR')}
            </p>
          </div>
          <span className={`text-[10px] px-1.5 py-0.5 border font-mono uppercase tracking-wider ml-2 ${STATUS_COLORS[inv.status]}`}>
            {STATUS_LABELS[inv.status]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditing(v => !v)}
            className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono font-bold border border-[#1e2d40] text-[#64748b] hover:text-[#f1f5f9] transition-colors"
          >
            <Edit size={11} /> MODIFIER
          </button>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2d40] hover:bg-[#2a3f55] text-[10px] font-bold border border-[#334155] transition-colors font-mono"
          >
            <Plus size={12} /> AJOUTER ÉVÉNEMENT
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {editing && (
          <div className="border border-[#1e2d40] bg-[#0a0f16] p-5">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#f1f5f9] mb-4">MODIFIER L'INVESTIGATION</h3>
            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1">TITRE *</label>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1">DESCRIPTION</label>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2} className={inputCls + ' resize-none'} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1">STATUT</label>
                  <select value={editStatus} onChange={e => setEditStatus(e.target.value as InvestigationStatus)} className={inputCls}>
                    <option value="open">OUVERT</option>
                    <option value="closed">CLÔTURÉ</option>
                    <option value="archived">ARCHIVÉ</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1">TAGS</label>
                  <input value={editTags} onChange={e => setEditTags(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 text-xs font-mono border border-[#1e2d40] text-[#64748b] hover:text-[#f1f5f9] transition-colors">
                  ANNULER
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-xs font-mono font-bold bg-[#00d4ff] text-[#06080f] rounded hover:bg-[#00d4ff]/80 disabled:opacity-50 transition-colors">
                  {saving ? 'SAUVEGARDE...' : 'SAUVEGARDER'}
                </button>
              </div>
            </form>
          </div>
        )}

        {inv.description && !editing && (
          <div className="border border-[#1e2d40] bg-[#0a0f16] px-5 py-3">
            <p className="text-xs font-mono text-[#8a9ab0] whitespace-pre-wrap">{inv.description}</p>
            {inv.tags && (
              <p className="text-[10px] font-mono text-[#4a6480] mt-2">{inv.tags}</p>
            )}
          </div>
        )}

        {showForm && (
          <EventForm
            investigationId={invId}
            onCreated={ev => {
              setShowForm(false)
              setEvents(prev => {
                const next = [...prev, ev]
                return filter.order === 'desc'
                  ? next.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  : next.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
              })
            }}
            onCancel={() => setShowForm(false)}
          />
        )}

        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider">FILTRES :</span>
          <select
            value={filter.event_type ?? ''}
            onChange={e => setFilter(f => ({ ...f, event_type: (e.target.value as EventType) || undefined }))}
            className="bg-[#0d131f] border border-[#1e2d40] px-3 py-1.5 font-mono text-xs text-[#f1f5f9] focus:outline-none focus:border-[#00d4ff]/40"
          >
            <option value="">TOUS LES TYPES</option>
            {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map(t => (
              <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
            ))}
          </select>
          <select
            value={filter.severity ?? ''}
            onChange={e => setFilter(f => ({ ...f, severity: (e.target.value as EventSeverity) || undefined }))}
            className="bg-[#0d131f] border border-[#1e2d40] px-3 py-1.5 font-mono text-xs text-[#f1f5f9] focus:outline-none focus:border-[#00d4ff]/40"
          >
            <option value="">TOUTES SÉVÉRITÉS</option>
            <option value="info">INFO</option>
            <option value="low">LOW</option>
            <option value="medium">MEDIUM</option>
            <option value="high">HIGH</option>
            <option value="critical">CRITICAL</option>
          </select>
          <select
            value={filter.order ?? 'asc'}
            onChange={e => setFilter(f => ({ ...f, order: e.target.value as 'asc' | 'desc' }))}
            className="bg-[#0d131f] border border-[#1e2d40] px-3 py-1.5 font-mono text-xs text-[#f1f5f9] focus:outline-none focus:border-[#00d4ff]/40"
          >
            <option value="asc">CHRONOLOGIQUE ↑</option>
            <option value="desc">CHRONOLOGIQUE ↓</option>
          </select>
        </div>

        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-[#1e2d40] bg-[#0a0f16] py-16 text-center">
            <Circle size={32} className="mb-3 text-[#1e2d40]" />
            <p className="font-mono text-sm uppercase tracking-widest text-[#64748b]">AUCUN ÉVÉNEMENT</p>
            <button onClick={() => setShowForm(true)} className="mt-2 font-mono text-xs text-[#00d4ff] hover:underline">
              AJOUTER LE PREMIER ÉVÉNEMENT
            </button>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-[#1e2d40]" />
            <div className="space-y-0">
              {events.map((ev, idx) => (
                <div key={ev.id} className="relative flex gap-4 group">
                  <div className="relative z-10 flex flex-col items-center">
                    <div className={`w-[9px] h-[9px] rounded-full mt-4 shrink-0 shadow-sm ${SEVERITY_DOT[ev.severity]}`} />
                    {idx < events.length - 1 && <div className="w-px flex-1 bg-transparent" />}
                  </div>

                  <div className={`flex-1 border bg-[#0a0f16] p-4 mb-3 transition-colors group-hover:border-[#2a3f55] ${
                    ev.severity === 'critical' ? 'border-[#ef4444]/30' :
                    ev.severity === 'high'     ? 'border-[#f97316]/20' :
                    'border-[#1e2d40]'
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono text-[#4a6480]">{formatTs(ev.timestamp)}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 border font-mono uppercase flex items-center gap-1 ${SEVERITY_COLORS[ev.severity]}`}>
                          {eventTypeIcon(ev.event_type)} {EVENT_TYPE_LABELS[ev.event_type]}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 border font-mono uppercase ${SEVERITY_COLORS[ev.severity]}`}>
                          {ev.severity.toUpperCase()}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteEvent(ev)}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-[#64748b] hover:text-red-400 transition-all shrink-0"
                        title="Supprimer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <h4 className="text-sm font-mono font-medium text-[#f1f5f9] mt-2">{ev.title}</h4>

                    {ev.description && (
                      <p className="text-xs font-mono text-[#8a9ab0] mt-1.5 whitespace-pre-wrap">{ev.description}</p>
                    )}

                    {(ev.source_module || ev.source_entity_id || ev.metadata) && (
                      <div className="mt-2 pt-2 border-t border-[#1e2d40] flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-[#4a6480]">
                        {ev.source_module && (
                          <span>MODULE <span className="text-[#64748b]">{ev.source_module}</span></span>
                        )}
                        {ev.source_entity_id && (
                          <span>REF <span className="text-[#64748b]">{ev.source_entity_id}</span></span>
                        )}
                        {ev.metadata && (
                          <span className="truncate max-w-[400px]">META <span className="text-[#64748b]">{ev.metadata}</span></span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
