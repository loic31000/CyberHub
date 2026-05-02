import { useState, useEffect, useCallback } from 'react'
import { useIocStore } from '@/store/useIocStore'
import type { IOC, IOCCreatePayload, IOCType, IOCTLP, IOCStatus } from '@/types/ioc'
import { toast } from '@/store/toast'
import {
  ShieldBan, Plus, Search, Download, X, Trash2, Edit2,
  Globe, Hash, Link, Mail, Network,
} from 'lucide-react'

// TLP labels sont standards — pas traduits
const TLP_OPTIONS: { value: IOCTLP; label: string; color: string }[] = [
  { value: 'white', label: 'TLP:WHITE', color: 'text-white border-white/40 bg-white/10' },
  { value: 'green', label: 'TLP:GREEN', color: 'text-green-400 border-green-400/40 bg-green-400/10' },
  { value: 'amber', label: 'TLP:AMBER', color: 'text-amber-400 border-amber-400/40 bg-amber-400/10' },
  { value: 'red',   label: 'TLP:RED',   color: 'text-red-400 border-red-400/40 bg-red-400/10' },
]

const STATUS_COLORS: Record<IOCStatus, string> = {
  active:         'text-cyber-green',
  archived:       'text-text-muted',
  false_positive: 'text-yellow-400',
}

const IOC_TYPES: IOCType[] = ['ip', 'domain', 'hash', 'url', 'email']

function tlpBadge(tlp: IOCTLP) {
  const opt = TLP_OPTIONS.find((t) => t.value === tlp)
  return opt
    ? <span className={`text-xs px-1.5 py-0.5 rounded border font-mono ${opt.color}`}>{opt.label}</span>
    : null
}

function typeIcon(type: IOCType) {
  const cls = 'text-cyber-cyan'
  switch (type) {
    case 'ip':     return <Network size={14} className={cls} />
    case 'domain': return <Globe   size={14} className={cls} />
    case 'hash':   return <Hash    size={14} className={cls} />
    case 'url':    return <Link    size={14} className={cls} />
    case 'email':  return <Mail    size={14} className={cls} />
  }
}

function parseTags(raw: string): string[] {
  if (!raw) return []
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [] }
  catch { return raw.split(',').map((t) => t.trim()).filter(Boolean) }
}

function tagsToJSON(input: string): string {
  const tags = input.split(',').map((t) => t.trim()).filter(Boolean)
  return tags.length > 0 ? JSON.stringify(tags) : ''
}

// ── Formulaire ────────────────────────────────────────────────────────────────

interface IOCFormProps {
  initial?: Partial<IOC>
  onSubmit: (data: IOCCreatePayload) => Promise<void>
  onCancel: () => void
}

function IOCForm({ initial, onSubmit, onCancel }: IOCFormProps) {
    const [type, setType]     = useState<IOCType>(initial?.type ?? 'ip')
  const [value, setValue]   = useState(initial?.value ?? '')
  const [source, setSource] = useState(initial?.source ?? '')
  const [tlp, setTlp]       = useState<IOCTLP>(initial?.tlp ?? 'white')
  const [status, setStatus] = useState<IOCStatus>(initial?.status ?? 'active')
  const [tags, setTags]     = useState(() => parseTags(initial?.tags ?? '').join(', '))
  const [notes, setNotes]   = useState(initial?.notes ?? '')
  const [mitre, setMitre]   = useState(initial?.mitre_tech_id ?? '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) { toast.error(`La valeur est requise`); return }
    setSaving(true)
    try {
      await onSubmit({ type, value: value.trim(), source: source.trim(), tlp, status,
        tags: tagsToJSON(tags), notes: notes.trim(), mitre_tech_id: mitre.trim() })
    } finally { setSaving(false) }
  }

  const inputCls = 'w-full bg-bg-secondary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-cyber-cyan'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-3">
        <div className="w-36">
          <label className="text-xs text-text-muted block mb-1">{`Type *`}</label>
          <select value={type} onChange={(e) => setType(e.target.value as IOCType)} className={inputCls}>
            {IOC_TYPES.map((tp) => <option key={tp} value={tp}>{tp.toUpperCase()}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs text-text-muted block mb-1">{`Valeur *`}</label>
          <input value={value} onChange={(e) => setValue(e.target.value)}
            placeholder={type === 'hash' ? 'md5/sha256...' : type === 'ip' ? '192.168.1.1' : type}
            className={inputCls} />
        </div>
      </div>
      <div>
        <label className="text-xs text-text-muted block mb-1">{`Source`}</label>
        <input value={source} onChange={(e) => setSource(e.target.value)} placeholder={`ex: VirusTotal, AbuseIPDB, manuel...`} className={inputCls} />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs text-text-muted block mb-1">{`TLP`}</label>
          <select value={tlp} onChange={(e) => setTlp(e.target.value as IOCTLP)} className={inputCls}>
            {TLP_OPTIONS.map((tp) => <option key={tp.value} value={tp.value}>{tp.label}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs text-text-muted block mb-1">{`Statut`}</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as IOCStatus)} className={inputCls}>
            <option value="active">{`Actif`}</option>
            <option value="archived">{`Archivé`}</option>
            <option value="false_positive">{`Faux positif`}</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-text-muted block mb-1">
          {`Tags`} <span className="opacity-50">{`(séparés par virgule)`}</span>
        </label>
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder={`ransomware, c2, apt28...`} className={inputCls} />
      </div>
      <div>
        <label className="text-xs text-text-muted block mb-1">
          {`Technique MITRE ATT&CK`} <span className="opacity-50">{`(optionnel)`}</span>
        </label>
        <input value={mitre} onChange={(e) => setMitre(e.target.value)} placeholder={`ex: T1046`} className={inputCls} />
      </div>
      <div>
        <label className="text-xs text-text-muted block mb-1">{`Notes`}</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder={`Contexte, observations...`} className={inputCls + ' resize-none'} />
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-text-muted hover:text-text-primary border border-border rounded transition-colors">
          {`Annuler`}
        </button>
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-cyber-cyan text-bg-primary font-semibold rounded hover:bg-cyber-cyan/80 disabled:opacity-50 transition-colors">
          {saving ? `Sauvegarde…` : initial?.id ? `Mettre à jour` : `Ajouter`}
        </button>
      </div>
    </form>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function IOCPage() {
    const {
    iocs, total, loading, stats, filter,
    fetchIocs, fetchStats, setFilter,
    createIoc, updateIoc, deleteIoc, exportCSV,
  } = useIocStore()

  const [showForm, setShowForm]     = useState(false)
  const [editTarget, setEditTarget] = useState<IOC | null>(null)
  const [search, setSearch]         = useState('')
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { fetchIocs(); fetchStats() }, [])

  const handleSearch = (v: string) => {
    setSearch(v)
    if (searchTimeout) clearTimeout(searchTimeout)
    setSearchTimeout(setTimeout(() => setFilter({ q: v || undefined }), 350))
  }

  const handleCreate = async (data: IOCCreatePayload) => {
    try { await createIoc(data); toast.success(`IOC ajouté`); setShowForm(false) }
    catch { toast.error(`Erreur lors de l'ajout`) }
  }

  const handleUpdate = useCallback(async (data: IOCCreatePayload) => {
    if (!editTarget) return
    try { await updateIoc(editTarget.id, data); toast.success(`IOC mis à jour`); setEditTarget(null) }
    catch { toast.error(`Erreur lors de la mise à jour`) }
  }, [editTarget, updateIoc])

  const handleDelete = async (ioc: IOC) => {
    if (!confirm(`Supprimer ${ioc.type.toUpperCase()} : ${ioc.value} ?`)) return
    try { await deleteIoc(ioc.id); toast.success(`IOC supprimé`) }
    catch { toast.error(`Erreur lors de la suppression`) }
  }

  const handleExport = async () => {
    try { await exportCSV(); toast.success(`Export CSV téléchargé`) }
    catch { toast.error(`Erreur lors de l'export`) }
  }

  const activePanel = showForm || editTarget !== null

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <ShieldBan size={24} className="text-cyber-red" />
            {`IOC Manager`}
          </h1>
          <p className="text-text-muted text-sm mt-1">
            {total} {total > 1 ? `indicateurs de compromission` : `indicateur de compromission`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded text-text-muted hover:text-cyber-cyan hover:border-cyber-cyan transition-colors">
            <Download size={15} /> {`Export CSV`}
          </button>
          <button onClick={() => { setShowForm(true); setEditTarget(null) }} className="flex items-center gap-2 px-3 py-2 text-sm bg-cyber-cyan text-bg-primary font-semibold rounded hover:bg-cyber-cyan/80 transition-colors">
            <Plus size={15} /> {`Ajouter IOC`}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-1 bg-bg-secondary border border-border rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-cyber-cyan">{stats.total}</div>
            <div className="text-xs text-text-muted mt-0.5">{`Total actifs`}</div>
          </div>
          {IOC_TYPES.map((tp) => (
            <div key={tp} className="col-span-1 bg-bg-secondary border border-border rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-text-primary">{stats.by_type[tp] ?? 0}</div>
              <div className="text-xs text-text-muted mt-0.5 flex items-center justify-center gap-1">
                {typeIcon(tp)} {tp.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={(e) => handleSearch(e.target.value)}
            placeholder={`${`Rechercher`}…`}
            className="w-full bg-bg-secondary border border-border rounded pl-9 pr-3 py-2 text-sm text-text-primary focus:outline-none focus:border-cyber-cyan" />
        </div>
        <select value={filter.type ?? ''} onChange={(e) => setFilter({ type: (e.target.value as IOCType) || undefined })}
          className="bg-bg-secondary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-cyber-cyan">
          <option value="">{`Tous les types`}</option>
          {IOC_TYPES.map((tp) => <option key={tp} value={tp}>{tp.toUpperCase()}</option>)}
        </select>
        <select value={filter.tlp ?? ''} onChange={(e) => setFilter({ tlp: (e.target.value as IOCTLP) || undefined })}
          className="bg-bg-secondary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-cyber-cyan">
          <option value="">{`Tous TLP`}</option>
          {TLP_OPTIONS.map((tp) => <option key={tp.value} value={tp.value}>{tp.label}</option>)}
        </select>
        <select value={filter.status ?? 'active'} onChange={(e) => setFilter({ status: (e.target.value as IOCStatus) || undefined })}
          className="bg-bg-secondary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-cyber-cyan">
          <option value="">{`Tous statuts`}</option>
          <option value="active">{`Actif`}</option>
          <option value="archived">{`Archivé`}</option>
          <option value="false_positive">{`Faux positif`}</option>
        </select>
        {(filter.type || filter.tlp || (filter.status && filter.status !== 'active') || filter.q) && (
          <button onClick={() => { setSearch(''); setFilter({ type: undefined, tlp: undefined, status: 'active', q: undefined }) }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-text-muted border border-border rounded hover:text-cyber-red hover:border-cyber-red transition-colors">
            <X size={13} /> {`Réinitialiser`}
          </button>
        )}
      </div>

      <div className="flex gap-6">
        {/* Table */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="text-center py-12 text-text-muted text-sm">{`Chargement…`}</div>
          ) : iocs.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <ShieldBan size={40} className="mx-auto text-text-muted opacity-40" />
              <p className="text-text-muted">{`Aucun IOC trouvé`}</p>
              <button onClick={() => setShowForm(true)} className="text-sm text-cyber-cyan hover:underline">
                {`Ajouter le premier IOC`}
              </button>
            </div>
          ) : (
            <div className="bg-bg-secondary border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-text-muted text-xs">
                    <th className="text-left px-4 py-3 font-medium">{`Type`}</th>
                    <th className="text-left px-4 py-3 font-medium">{`Valeur`}</th>
                    <th className="text-left px-4 py-3 font-medium">{`Source`}</th>
                    <th className="text-left px-4 py-3 font-medium">{`TLP`}</th>
                    <th className="text-left px-4 py-3 font-medium">{`Tags`}</th>
                    <th className="text-left px-4 py-3 font-medium">{`MITRE`}</th>
                    <th className="text-left px-4 py-3 font-medium">{`Statut`}</th>
                    <th className="text-right px-4 py-3 font-medium">{`Actions`}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {iocs.map((ioc) => (
                    <tr key={ioc.id} className="hover:bg-bg-primary/50 transition-colors group">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 font-mono text-xs uppercase text-cyber-cyan">
                          {typeIcon(ioc.type)} {ioc.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[260px]">
                        <span className="font-mono text-xs text-text-primary break-all">{ioc.value}</span>
                      </td>
                      <td className="px-4 py-3 text-text-muted text-xs max-w-[120px] truncate">{ioc.source || '—'}</td>
                      <td className="px-4 py-3">{tlpBadge(ioc.tlp)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {parseTags(ioc.tags).slice(0, 3).map((tag) => (
                            <span key={tag} className="text-xs bg-bg-primary border border-border rounded px-1.5 py-0.5 text-text-muted">{tag}</span>
                          ))}
                          {parseTags(ioc.tags).length > 3 && (
                            <span className="text-xs text-text-muted">+{parseTags(ioc.tags).length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {ioc.mitre_tech_id
                          ? <span className="font-mono text-xs text-cyber-cyan">{ioc.mitre_tech_id}</span>
                          : <span className="text-text-muted text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs ${STATUS_COLORS[ioc.status] ?? 'text-text-muted'}`}>
                          {ioc.status === 'active' ? `Actif`
                            : ioc.status === 'archived' ? `Archivé`
                            : `Faux positif`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditTarget(ioc); setShowForm(false) }}
                            className="p-1.5 rounded hover:bg-cyber-cyan/10 text-text-muted hover:text-cyber-cyan transition-colors" title={`Modifier`}>
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => handleDelete(ioc)}
                            className="p-1.5 rounded hover:bg-cyber-red/10 text-text-muted hover:text-cyber-red transition-colors" title={`Supprimer`}>
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

        {/* Panel latéral */}
        {activePanel && (
          <div className="w-[380px] shrink-0 bg-bg-secondary border border-cyber-cyan/30 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text-primary">
                {editTarget ? `Modifier IOC #${editTarget.id}` : `Nouvel indicateur`}
              </h2>
              <button onClick={() => { setShowForm(false); setEditTarget(null) }}
                className="p-1 rounded hover:bg-bg-primary text-text-muted hover:text-text-primary transition-colors">
                <X size={16} />
              </button>
            </div>
            <IOCForm
              initial={editTarget ?? undefined}
              onSubmit={editTarget ? handleUpdate : handleCreate}
              onCancel={() => { setShowForm(false); setEditTarget(null) }}
            />
          </div>
        )}
      </div>

      {/* Légende TLP */}
      <div className="flex items-center gap-4 pt-2 border-t border-border">
        <span className="text-xs text-text-muted">{`Traffic Light Protocol :`}</span>
        {TLP_OPTIONS.map((tp) => (
          <span key={tp.value} className={`text-xs px-1.5 py-0.5 rounded border font-mono ${tp.color}`}>{tp.label}</span>
        ))}
        <span className="text-xs text-text-muted ml-2">{`— Respectez le niveau de confidentialité lors du partage.`}</span>
      </div>
    </div>
  )
}
