import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { investigationApi } from '@/api/client'
import type { Investigation, InvestigationCreatePayload, InvestigationStatus } from '@/types/investigation'
import { toast } from '@/store/toast'
import { Activity, Plus, Search, X, Trash2, ChevronRight } from 'lucide-react'

const STATUS_OPTIONS: { value: InvestigationStatus | ''; label: string }[] = [
  { value: '', label: 'TOUS' },
  { value: 'open', label: 'OUVERT' },
  { value: 'closed', label: 'CLÔTURÉ' },
  { value: 'archived', label: 'ARCHIVÉ' },
]

const STATUS_COLORS: Record<InvestigationStatus, string> = {
  open:     'text-[#10b981] border-[#10b981]/30 bg-[#10b981]/10',
  closed:   'text-[#64748b] border-[#64748b]/30 bg-[#64748b]/10',
  archived: 'text-[#eab308] border-[#eab308]/30 bg-[#eab308]/10',
}

const STATUS_LABELS: Record<InvestigationStatus, string> = {
  open: 'OUVERT', closed: 'CLÔTURÉ', archived: 'ARCHIVÉ',
}

const inputCls = 'w-full bg-[#0d131f] border border-[#1e2d40] rounded px-3 py-2 font-mono text-sm text-[#f1f5f9] placeholder-[#334155] focus:outline-none focus:border-[#00d4ff]/60'

interface CreateModalProps {
  onClose: () => void
  onCreated: (inv: Investigation) => void
}

function CreateModal({ onClose, onCreated }: CreateModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<InvestigationStatus>('open')
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { toast.error('Le titre est requis'); return }
    setSaving(true)
    try {
      const payload: InvestigationCreatePayload = {
        title: title.trim(),
        description: description.trim(),
        status,
        tags: tags.trim(),
      }
      const inv = await investigationApi.create(payload)
      toast.success('Investigation créée')
      onCreated(inv)
    } catch {
      toast.error('Erreur lors de la création')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0a0f16] border border-[#1e2d40] p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-[#f1f5f9]">
            NOUVELLE INVESTIGATION
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#1e2d40] text-[#64748b] hover:text-[#f1f5f9] transition-colors">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1">TITRE *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="ex: Analyse intrusion AS13335…" className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1">DESCRIPTION</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Contexte, périmètre, objectifs…" className={inputCls + ' resize-none'} />
          </div>
          <div>
            <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1">STATUT</label>
            <select value={status} onChange={e => setStatus(e.target.value as InvestigationStatus)} className={inputCls}>
              <option value="open">OUVERT</option>
              <option value="closed">CLÔTURÉ</option>
              <option value="archived">ARCHIVÉ</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1">TAGS <span className="normal-case">(texte libre)</span></label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="apt, ransomware, bgp-hijack…" className={inputCls} />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-mono border border-[#1e2d40] text-[#64748b] hover:text-[#f1f5f9] transition-colors">
              ANNULER
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-xs font-mono font-bold bg-[#00d4ff] text-[#06080f] rounded hover:bg-[#00d4ff]/80 disabled:opacity-50 transition-colors">
              {saving ? 'CRÉATION...' : 'CRÉER'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function InvestigationList() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Investigation[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [statusFilter, setStatusFilter] = useState<InvestigationStatus | ''>('')

  const load = useCallback(() => {
    setLoading(true)
    investigationApi.list({ status: statusFilter || undefined, q: search || undefined })
      .then(r => { setItems(r.items); setTotal(r.total) })
      .catch(() => toast.error('Erreur lors du chargement'))
      .finally(() => setLoading(false))
  }, [statusFilter, search])

  useEffect(() => { load() }, [load])

  const handleSearch = (v: string) => {
    setSearch(v)
    if (searchTimeout) clearTimeout(searchTimeout)
    setSearchTimeout(setTimeout(() => {}, 0))
  }

  const handleDelete = async (inv: Investigation, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Supprimer "${inv.title}" et tous ses événements ?`)) return
    try {
      await investigationApi.delete(inv.id)
      toast.success('Investigation supprimée')
      load()
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }

  const counts = {
    open:     items.filter(i => i.status === 'open').length,
    closed:   items.filter(i => i.status === 'closed').length,
    archived: items.filter(i => i.status === 'archived').length,
  }

  return (
    <div className="flex flex-col h-full bg-[#06080f] text-[#f1f5f9]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d40] bg-[#0a0f16]/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Activity className="text-[#00d4ff]" size={20} />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#10b981] rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase">INVESTIGATIONS // TIMELINE</h1>
            <p className="text-[10px] text-[#64748b] font-mono">{total} investigation{total > 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2d40] hover:bg-[#2a3f55] text-[10px] font-bold border border-[#334155] transition-colors font-mono"
        >
          <Plus size={12} /> NOUVELLE INVESTIGATION
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="grid grid-cols-3 gap-3">
          {(['open', 'closed', 'archived'] as InvestigationStatus[]).map(s => (
            <div key={s} className="border border-[#1e2d40] bg-[#0a0f16] p-3 text-center">
              <div className="text-2xl font-mono font-bold text-[#00d4ff]">{counts[s]}</div>
              <div className={`text-[10px] font-mono uppercase tracking-wider mt-1 ${STATUS_COLORS[s].split(' ')[0]}`}>
                {STATUS_LABELS[s]}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a6480]" />
            <input
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Rechercher une investigation…"
              className="w-full bg-[#0d131f] border border-[#1e2d40] pl-9 pr-3 py-2 font-mono text-sm text-[#f1f5f9] placeholder-[#2a3f55] focus:outline-none focus:border-[#00d4ff]/40"
            />
          </div>
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-2 text-xs font-mono border transition-colors ${
                statusFilter === opt.value
                  ? 'border-[#00d4ff]/60 text-[#00d4ff] bg-[#00d4ff]/5'
                  : 'border-[#1e2d40] text-[#64748b] hover:text-[#f1f5f9]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-[#64748b] font-mono text-sm">CHARGEMENT...</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-[#1e2d40] bg-[#0a0f16] py-24 text-center">
            <Activity size={40} className="mb-4 text-[#1e2d40]" />
            <p className="font-mono text-sm uppercase tracking-widest text-[#64748b]">AUCUNE INVESTIGATION</p>
            <button onClick={() => setShowCreate(true)} className="mt-2 font-mono text-xs text-[#00d4ff] hover:underline">
              CRÉER LA PREMIÈRE INVESTIGATION
            </button>
          </div>
        ) : (
          <div className="border border-[#1e2d40] bg-[#0a0f16] overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="border-b border-[#1e2d40] text-[10px] text-[#4a6480] uppercase tracking-wider">
                  <th className="text-left px-4 py-3">TITRE</th>
                  <th className="text-left px-4 py-3">STATUT</th>
                  <th className="text-left px-4 py-3">TAGS</th>
                  <th className="text-left px-4 py-3">CRÉÉE LE</th>
                  <th className="text-right px-4 py-3">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2d40]">
                {items.map(inv => (
                  <tr
                    key={inv.id}
                    onClick={() => navigate(`/investigations/${inv.id}`)}
                    className="hover:bg-[#0d131f]/70 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-[#f1f5f9] font-medium">{inv.title}</div>
                      {inv.description && (
                        <div className="text-[10px] text-[#64748b] mt-0.5 truncate max-w-[400px]">{inv.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-1.5 py-0.5 border font-mono uppercase tracking-wider ${STATUS_COLORS[inv.status]}`}>
                        {STATUS_LABELS[inv.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] text-[#64748b] font-mono">{inv.tags || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-[#64748b]">
                      {new Date(inv.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={e => { e.stopPropagation(); navigate(`/investigations/${inv.id}`) }}
                          className="p-1.5 rounded hover:bg-[#00d4ff]/10 text-[#64748b] hover:text-[#00d4ff] transition-colors"
                          title="Ouvrir"
                        >
                          <ChevronRight size={13} />
                        </button>
                        <button
                          onClick={e => handleDelete(inv, e)}
                          className="p-1.5 rounded hover:bg-red-500/10 text-[#64748b] hover:text-red-400 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load() }}
        />
      )}
    </div>
  )
}
