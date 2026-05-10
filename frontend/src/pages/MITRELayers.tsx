import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { attackLayerApi } from '@/api/client'
import type { AttackLayer, AttackLayerCreatePayload } from '@/types/attackLayer'
import { toast } from '@/store/toast'
import { Layers, Plus, Upload, Trash2, ChevronRight, X, Download } from 'lucide-react'

const inputCls = 'w-full bg-[#0d131f] border border-[#1e2d40] rounded px-3 py-2 font-mono text-sm text-[#f1f5f9] placeholder-[#334155] focus:outline-none focus:border-[#00d4ff]/60'

function layerTechCount(layerData: string): number {
  try {
    const arr = JSON.parse(layerData)
    return Array.isArray(arr) ? arr.length : 0
  } catch {
    return 0
  }
}

interface CreateModalProps {
  onClose: () => void
  onCreated: (layer: AttackLayer) => void
}

function CreateModal({ onClose, onCreated }: CreateModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { toast.error('Le nom est requis'); return }
    setSaving(true)
    try {
      const payload: AttackLayerCreatePayload = { name: name.trim(), description: description.trim() }
      const layer = await attackLayerApi.create(payload)
      toast.success('Layer créé')
      onCreated(layer)
    } catch {
      toast.error('Erreur lors de la création')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0a0f16] border border-[#1e2d40] p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-[#f1f5f9]">NOUVEAU LAYER</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#1e2d40] text-[#64748b] hover:text-[#f1f5f9] transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1">NOM *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="ex: APT29 — Investigation Q1" className={inputCls} autoFocus />
          </div>
          <div>
            <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1">DESCRIPTION</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Contexte, objectif…" className={inputCls + ' resize-none'} />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-mono border border-[#1e2d40] text-[#64748b] hover:text-[#f1f5f9] transition-colors">ANNULER</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-xs font-mono font-bold bg-[#00d4ff] text-[#06080f] rounded hover:bg-[#00d4ff]/80 disabled:opacity-50 transition-colors">
              {saving ? 'CRÉATION...' : 'CRÉER'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function MITRELayers() {
  const navigate = useNavigate()
  const [layers, setLayers] = useState<AttackLayer[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => {
    setLoading(true)
    attackLayerApi.list()
      .then(r => setLayers(r.items))
      .catch(() => toast.error('Erreur lors du chargement'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (layer: AttackLayer, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Supprimer le layer "${layer.name}" ?`)) return
    try {
      await attackLayerApi.delete(layer.id)
      toast.success('Layer supprimé')
      setLayers(prev => prev.filter(l => l.id !== layer.id))
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }

  const handleExport = (layer: AttackLayer, e: React.MouseEvent) => {
    e.stopPropagation()
    const url = attackLayerApi.exportUrl(layer.id)
    const token = localStorage.getItem('cyber_hub_token') ?? ''
    const a = document.createElement('a')
    a.href = url + (url.includes('?') ? '&' : '?') + `token=${encodeURIComponent(token)}`
    // Use fetch with auth header instead
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob)
        a.href = blobUrl
        a.download = `layer-${layer.name.toLowerCase().replace(/\s+/g, '-')}.json`
        a.click()
        URL.revokeObjectURL(blobUrl)
      })
      .catch(() => toast.error('Erreur lors de l\'export'))
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const result = await attackLayerApi.import(json)
      toast.success(`Layer importé : ${result.imported} techniques`)
      load()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Fichier invalide'
      toast.error('Import échoué : ' + msg)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#06080f] text-[#f1f5f9]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d40] bg-[#0a0f16]/50">
        <div className="flex items-center gap-3">
          <Layers className="text-[#00d4ff]" size={20} />
          <div>
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase">MITRE ATT&CK // LAYERS</h1>
            <p className="text-[10px] text-[#64748b] font-mono">{layers.length} layer{layers.length > 1 ? 's' : ''} stocké{layers.length > 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".json" onChange={handleImportFile} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono font-bold border border-[#334155] bg-[#1e2d40] hover:bg-[#2a3f55] disabled:opacity-50 transition-colors"
          >
            <Upload size={11} /> {importing ? 'IMPORT...' : 'IMPORTER JSON'}
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2d40] hover:bg-[#2a3f55] text-[10px] font-bold border border-[#334155] transition-colors font-mono"
          >
            <Plus size={12} /> NOUVEAU LAYER
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="text-center py-12 text-[#64748b] font-mono text-sm">CHARGEMENT...</div>
        ) : layers.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-[#1e2d40] bg-[#0a0f16] py-24 text-center">
            <Layers size={40} className="mb-4 text-[#1e2d40]" />
            <p className="font-mono text-sm uppercase tracking-widest text-[#64748b]">AUCUN LAYER ATT&CK</p>
            <p className="text-[10px] font-mono text-[#4a6480] mt-2">Créez un layer vide ou importez un JSON Navigator existant.</p>
            <div className="flex gap-3 mt-4">
              <button onClick={() => fileRef.current?.click()} className="font-mono text-xs text-[#00d4ff] hover:underline flex items-center gap-1">
                <Upload size={11} /> IMPORTER JSON
              </button>
              <span className="text-[#4a6480]">·</span>
              <button onClick={() => setShowCreate(true)} className="font-mono text-xs text-[#00d4ff] hover:underline">
                CRÉER UN LAYER
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {layers.map(layer => {
              const count = layerTechCount(layer.layer_data)
              return (
                <div
                  key={layer.id}
                  onClick={() => navigate(`/mitre/layers/${layer.id}`)}
                  className="border border-[#1e2d40] bg-[#0a0f16] p-4 cursor-pointer hover:border-[#00d4ff]/30 hover:bg-[#0d131f] transition-all group"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Layers size={14} className="text-[#00d4ff] shrink-0" />
                      <h3 className="text-sm font-mono font-bold text-[#f1f5f9] truncate">{layer.name}</h3>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={e => handleExport(layer, e)} className="p-1.5 rounded hover:bg-[#00d4ff]/10 text-[#64748b] hover:text-[#00d4ff] transition-colors" title="Exporter">
                        <Download size={12} />
                      </button>
                      <button onClick={e => handleDelete(layer, e)} className="p-1.5 rounded hover:bg-red-500/10 text-[#64748b] hover:text-red-400 transition-colors" title="Supprimer">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  {layer.description && (
                    <p className="text-[11px] font-mono text-[#64748b] mb-3 line-clamp-2">{layer.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-[#00d4ff] font-bold">{count}</span>
                      <span className="text-[10px] font-mono text-[#4a6480]">technique{count > 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-[#334155] border border-[#1e2d40] px-1.5 py-0.5">{layer.domain}</span>
                      <ChevronRight size={12} className="text-[#334155] group-hover:text-[#00d4ff] transition-colors" />
                    </div>
                  </div>
                  <p className="text-[9px] font-mono text-[#334155] mt-2">
                    {new Date(layer.updated_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={layer => { setShowCreate(false); setLayers(prev => [layer, ...prev]) }}
        />
      )}
    </div>
  )
}
