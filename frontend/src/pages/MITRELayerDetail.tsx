import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { attackLayerApi, mitreApi } from '@/api/client'
import type { AttackLayer, LayerEntry } from '@/types/attackLayer'
import type { MITRETechnique, MITRETactic } from '@/types'
import { toast } from '@/store/toast'
import {
  ArrowLeft, Layers, Download, Search, X, Plus, Minus,
  Save, Edit, CheckSquare,
} from 'lucide-react'

const inputCls = 'w-full bg-[#0d131f] border border-[#1e2d40] rounded px-3 py-2 font-mono text-sm text-[#f1f5f9] placeholder-[#334155] focus:outline-none focus:border-[#00d4ff]/60'

function parseArr(raw?: string): string[] {
  if (!raw) return []
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [] } catch { return [] }
}

function parseLayerData(raw: string): LayerEntry[] {
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [] } catch { return [] }
}

const TACTIC_TEXT: Record<string, string> = {
  'reconnaissance': 'text-[#a855f7]', 'resource-development': 'text-[#c084fc]',
  'initial-access': 'text-[#ef4444]', 'execution': 'text-[#f97316]',
  'persistence': 'text-[#eab308]', 'privilege-escalation': 'text-[#f59e0b]',
  'defense-evasion': 'text-[#84cc16]', 'credential-access': 'text-[#10b981]',
  'discovery': 'text-[#14b8a6]', 'lateral-movement': 'text-[#06b6d4]',
  'collection': 'text-[#00d4ff]', 'command-and-control': 'text-[#0ea5e9]',
  'exfiltration': 'text-[#3b82f6]', 'impact': 'text-[#ec4899]',
}
const tacticText = (s: string) => TACTIC_TEXT[s] ?? 'text-[#00d4ff]'

export default function MITRELayerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const layerId = Number(id)

  const [layer, setLayer] = useState<AttackLayer | null>(null)
  const [entries, setEntries] = useState<LayerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Editing metadata
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')

  // Technique search
  const [tactics, setTactics] = useState<MITRETactic[]>([])
  const [techniques, setTechniques] = useState<MITRETechnique[]>([])
  const [techTotal, setTechTotal] = useState(0)
  const [techPage, setTechPage] = useState(1)
  const [techLoading, setTechLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [activeTactic, setActiveTactic] = useState('')

  // View tabs
  const [tab, setTab] = useState<'browse' | 'selected'>('selected')

  const TECH_LIMIT = 40

  useEffect(() => {
    setLoading(true)
    Promise.all([attackLayerApi.get(layerId), mitreApi.tactics()])
      .then(([l, tacs]) => {
        setLayer(l)
        setEntries(parseLayerData(l.layer_data))
        setEditName(l.name)
        setEditDesc(l.description)
        setTactics(tacs)
      })
      .catch(() => toast.error('Layer introuvable'))
      .finally(() => setLoading(false))
  }, [layerId])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 300)
    return () => clearTimeout(t)
  }, [query])

  const fetchTechniques = useCallback(async (pg: number) => {
    setTechLoading(true)
    try {
      const res = await mitreApi.techniques({
        q: debouncedQ || undefined,
        tactic: activeTactic || undefined,
        page: pg,
        limit: TECH_LIMIT,
      })
      setTechniques(res.items ?? [])
      setTechTotal(res.total)
      setTechPage(pg)
    } catch { /* ignore */ }
    finally { setTechLoading(false) }
  }, [debouncedQ, activeTactic])

  useEffect(() => {
    if (tab === 'browse') fetchTechniques(1)
  }, [tab, fetchTechniques])

  const entrySet = new Set(entries.map(e => e.technique_id))

  const toggleTechnique = (tech: MITRETechnique) => {
    setEntries(prev => {
      const next = entrySet.has(tech.technique_id)
        ? prev.filter(e => e.technique_id !== tech.technique_id)
        : [...prev, {
            technique_id: tech.technique_id,
            name: tech.name,
            color: '',
            comment: '',
            score: 0,
            enabled: true,
          }]
      setDirty(true)
      return next
    })
  }

  const removeEntry = (techId: string) => {
    setEntries(prev => prev.filter(e => e.technique_id !== techId))
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await attackLayerApi.update(layerId, {
        layer_data: JSON.stringify(entries),
      })
      setLayer(updated)
      setDirty(false)
      toast.success('Layer sauvegardé')
    } catch {
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveMeta = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editName.trim()) { toast.error('Le nom est requis'); return }
    setSaving(true)
    try {
      const updated = await attackLayerApi.update(layerId, {
        name: editName.trim(),
        description: editDesc.trim(),
      })
      setLayer(updated)
      setEditing(false)
      toast.success('Métadonnées mises à jour')
    } catch {
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setSaving(false)
    }
  }

  const handleExport = () => {
    const token = localStorage.getItem('cyber_hub_token') ?? ''
    const url = attackLayerApi.exportUrl(layerId)
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = `layer-${(layer?.name ?? 'export').toLowerCase().replace(/\s+/g, '-')}.json`
        a.click()
        URL.revokeObjectURL(blobUrl)
      })
      .catch(() => toast.error('Erreur lors de l\'export'))
  }

  const totalPages = Math.ceil(techTotal / TECH_LIMIT)

  if (loading) return (
    <div className="flex h-full items-center justify-center bg-[#06080f] text-[#64748b] font-mono text-sm">CHARGEMENT...</div>
  )
  if (!layer) return (
    <div className="flex h-full items-center justify-center bg-[#06080f] text-[#64748b] font-mono text-sm">LAYER INTROUVABLE</div>
  )

  return (
    <div className="flex flex-col h-full bg-[#06080f] text-[#f1f5f9]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d40] bg-[#0a0f16]/50 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate('/mitre/layers')} className="p-1.5 rounded hover:bg-[#1e2d40] text-[#64748b] hover:text-[#f1f5f9] transition-colors">
            <ArrowLeft size={16} />
          </button>
          <Layers className="text-[#00d4ff] shrink-0" size={18} />
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-[0.15em] uppercase font-mono truncate">{layer.name}</h1>
            <p className="text-[10px] text-[#64748b] font-mono">
              {entries.length} technique{entries.length > 1 ? 's' : ''} · {layer.domain}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setEditing(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono border border-[#1e2d40] text-[#64748b] hover:text-[#f1f5f9] transition-colors">
            <Edit size={11} /> MÉTADONNÉES
          </button>
          {dirty && (
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold bg-[#10b981] text-[#06080f] rounded hover:bg-[#10b981]/80 disabled:opacity-50 transition-colors">
              <Save size={11} /> {saving ? 'SAUVEGARDE...' : 'SAUVEGARDER'}
            </button>
          )}
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold border border-[#334155] bg-[#1e2d40] hover:bg-[#2a3f55] transition-colors">
            <Download size={11} /> EXPORTER
          </button>
        </div>
      </div>

      {/* Edit metadata */}
      {editing && (
        <div className="border-b border-[#1e2d40] bg-[#0a0f16] px-6 py-4 flex-shrink-0">
          <form onSubmit={handleSaveMeta} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1">NOM *</label>
              <input value={editName} onChange={e => setEditName(e.target.value)} className={inputCls} />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1">DESCRIPTION</label>
              <input value={editDesc} onChange={e => setEditDesc(e.target.value)} className={inputCls} />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(false)} className="px-3 py-2 text-xs font-mono border border-[#1e2d40] text-[#64748b] hover:text-[#f1f5f9] transition-colors">ANNULER</button>
              <button type="submit" disabled={saving} className="px-3 py-2 text-xs font-mono font-bold bg-[#00d4ff] text-[#06080f] rounded hover:bg-[#00d4ff]/80 disabled:opacity-50 transition-colors">
                {saving ? '...' : 'OK'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-[#1e2d40] flex-shrink-0 bg-[#0a0f16]/30">
        <button
          onClick={() => setTab('selected')}
          className={`px-6 py-3 text-xs font-mono font-bold uppercase tracking-wider transition-colors flex items-center gap-2 ${
            tab === 'selected' ? 'text-[#00d4ff] border-b-2 border-[#00d4ff]' : 'text-[#64748b] hover:text-[#f1f5f9]'
          }`}
        >
          <CheckSquare size={12} /> SÉLECTIONNÉES ({entries.length})
        </button>
        <button
          onClick={() => setTab('browse')}
          className={`px-6 py-3 text-xs font-mono font-bold uppercase tracking-wider transition-colors flex items-center gap-2 ${
            tab === 'browse' ? 'text-[#00d4ff] border-b-2 border-[#00d4ff]' : 'text-[#64748b] hover:text-[#f1f5f9]'
          }`}
        >
          <Search size={12} /> PARCOURIR ({techTotal})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'selected' ? (
          <div className="h-full overflow-auto p-4">
            {entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Layers size={36} className="mb-3 text-[#1e2d40]" />
                <p className="text-sm font-mono text-[#64748b] uppercase tracking-widest">AUCUNE TECHNIQUE</p>
                <button onClick={() => setTab('browse')} className="mt-2 text-xs font-mono text-[#00d4ff] hover:underline">
                  PARCOURIR LES TECHNIQUES →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {entries.map(entry => (
                  <div key={entry.technique_id} className="border border-[#1e2d40] bg-[#0a0f16] p-3 flex items-start justify-between gap-2 group hover:border-[#2a3f55] transition-colors">
                    <div className="min-w-0">
                      <span className="font-mono text-[11px] font-bold text-[#00d4ff] bg-[#00d4ff]/10 px-1.5 py-0.5 rounded">
                        {entry.technique_id}
                      </span>
                      {entry.name && (
                        <p className="text-xs font-mono text-[#f1f5f9] mt-1.5 line-clamp-1">{entry.name}</p>
                      )}
                    </div>
                    <button
                      onClick={() => removeEntry(entry.technique_id)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-[#64748b] hover:text-red-400 transition-all shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]"
                      title="Retirer"
                      aria-label="Retirer"
                    >
                      <Minus size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full overflow-hidden">
            {/* Tactic sidebar */}
            <div className="w-44 flex-shrink-0 border-r border-[#1e2d40] overflow-y-auto bg-[#06080f]">
              <div className="p-2">
                <button
                  onClick={() => { setActiveTactic(''); fetchTechniques(1) }}
                  className={`w-full text-left text-[11px] font-mono px-3 py-2 rounded mb-1 transition-colors ${
                    activeTactic === '' ? 'bg-[#00d4ff]/20 text-[#00d4ff] font-bold' : 'text-[#8a9ab0] hover:bg-[#1e2d40]/60'
                  }`}
                >
                  TOUTES
                </button>
                <div className="h-px bg-[#1e2d40] my-2" />
                {tactics.map(tac => (
                  <button
                    key={tac.tactic_id}
                    onClick={() => { setActiveTactic(tac.short_name); fetchTechniques(1) }}
                    className={`w-full text-left text-[11px] font-mono px-3 py-1.5 rounded mb-0.5 transition-colors truncate ${
                      activeTactic === tac.short_name
                        ? tacticText(tac.short_name) + ' font-bold bg-white/5'
                        : 'text-[#8a9ab0] hover:bg-[#1e2d40]/60'
                    }`}
                  >
                    {tac.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Technique grid */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-2 border-b border-[#1e2d40] flex-shrink-0 bg-[#0a0f16]/30">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a6480]" />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Rechercher une technique..."
                    className="w-full bg-[#0d131f] border border-[#1e2d40] pl-9 pr-3 py-1.5 font-mono text-xs text-[#f1f5f9] placeholder-[#2a3f55] focus:outline-none focus:border-[#00d4ff]/40"
                  />
                  {query && (
                    <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#f1f5f9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]" aria-label="Effacer la recherche">
                      <X size={11} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-auto p-3">
                {techLoading ? (
                  <div className="text-center py-8 text-[#64748b] font-mono text-xs">CHARGEMENT...</div>
                ) : techniques.length === 0 ? (
                  <div className="text-center py-8 text-[#64748b] font-mono text-xs">AUCUN RÉSULTAT</div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
                      {techniques.map(tech => {
                        const inLayer = entrySet.has(tech.technique_id)
                        const tactics = parseArr(tech.tactics)
                        return (
                          <button
                            key={tech.technique_id}
                            onClick={() => toggleTechnique(tech)}
                            className={`w-full text-left border p-3 transition-all ${
                              inLayer
                                ? 'border-[#00d4ff]/50 bg-[#00d4ff]/5 ring-1 ring-[#00d4ff]/20'
                                : 'border-[#1e2d40] bg-[#0a0f16] hover:border-[#00d4ff]/30'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1.5">
                              <span className="font-mono text-[10px] font-bold text-[#00d4ff] bg-[#00d4ff]/10 px-1.5 py-0.5 rounded">
                                {tech.technique_id}
                              </span>
                              <span className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${
                                inLayer ? 'border-[#00d4ff] bg-[#00d4ff]/20 text-[#00d4ff]' : 'border-[#334155] text-transparent'
                              }`}>
                                {inLayer ? <Plus size={9} className="rotate-45" /> : <Plus size={9} />}
                              </span>
                            </div>
                            <p className="text-xs font-mono text-[#f1f5f9] line-clamp-2 leading-tight">{tech.name}</p>
                            {tactics[0] && (
                              <p className={`text-[9px] font-mono mt-1.5 ${tacticText(tactics[0])}`}>{tactics[0]}</p>
                            )}
                          </button>
                        )
                      })}
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-3 mt-4 pb-2">
                        <button disabled={techPage === 1} onClick={() => fetchTechniques(techPage - 1)}
                          className="text-[10px] font-mono px-3 py-1.5 border border-[#1e2d40] text-[#64748b] hover:border-[#00d4ff]/40 disabled:opacity-30 hover:text-[#00d4ff] transition-colors">
                          ← PRÉCÉDENT
                        </button>
                        <span className="text-[10px] font-mono text-[#64748b]">{techPage} / {totalPages}</span>
                        <button disabled={techPage === totalPages} onClick={() => fetchTechniques(techPage + 1)}
                          className="text-[10px] font-mono px-3 py-1.5 border border-[#1e2d40] text-[#64748b] hover:border-[#00d4ff]/40 disabled:opacity-30 hover:text-[#00d4ff] transition-colors">
                          SUIVANT →
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dirty indicator */}
      {dirty && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-[#eab308]/30 bg-[#eab308]/5 flex-shrink-0">
          <span className="text-xs font-mono text-[#eab308]">⚠ Modifications non sauvegardées</span>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold bg-[#10b981] text-[#06080f] rounded hover:bg-[#10b981]/80 disabled:opacity-50 transition-colors">
            <Save size={11} /> {saving ? 'SAUVEGARDE...' : 'SAUVEGARDER'}
          </button>
        </div>
      )}
    </div>
  )
}
