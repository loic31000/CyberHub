import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import MitreCircuit from '@/mitre/MitreCircuit'
import { MitreDisplaySettings, useMitrePreferences } from '@/mitre/MitrePreferences'
import { attackLayerApi } from '@/api/client'
import type { AttackLayer, AttackLayerCreatePayload } from '@/types/attackLayer'
import { toast } from '@/store/toast'
import { Plus, Upload, Trash2, ChevronRight, Download, Loader2, AlertTriangle } from 'lucide-react'
import { LayersGlyph } from '@/dashboard2026/CyberGlyphs'
import { Dialog, MitreHeader, StateBlock } from '@/mitre/MitreUi'

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
    <Dialog title="Nouveau layer ATT&CK" onClose={onClose}>
      <form id="mx-create" onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
        <div className="mx-field">
          <label htmlFor="mx-layer-name" className="mx-label">Nom *</label>
          <input id="mx-layer-name" value={name} onChange={e => setName(e.target.value)} placeholder="ex. APT29 — Investigation Q1" className="mx-input" autoFocus required />
        </div>
        <div className="mx-field">
          <label htmlFor="mx-layer-desc" className="mx-label">Description</label>
          <textarea id="mx-layer-desc" value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Contexte, objectif…" className="mx-input" style={{ resize: 'vertical' }} />
        </div>
        <div className="mx-dialog-foot" style={{ padding: 0 }}>
          <button type="button" onClick={onClose} className="mx-btn">Annuler</button>
          <button type="submit" disabled={saving} className="mx-btn is-primary">
            {saving ? <><Loader2 size={14} className="mx-spin" />Création…</> : <><Plus size={14} />Créer le layer</>}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

export default function MITRELayers() {
  const [display, setDisplay] = useMitrePreferences()
  const navigate = useNavigate()
  const [layers, setLayers] = useState<AttackLayer[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [importing, setImporting] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<AttackLayer | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => {
    setLoading(true)
    setFailed(false)
    attackLayerApi.list()
      .then(r => setLayers(r.items))
      .catch(() => { setFailed(true); toast.error('Erreur lors du chargement') })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleDelete = (layer: AttackLayer, e: React.MouseEvent) => {
    e.stopPropagation()
    setPendingDelete(layer)
  }

  const confirmDelete = async () => {
    const layer = pendingDelete
    if (!layer) return
    setPendingDelete(null)
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
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (!res.ok) throw new Error(`Export HTTP ${res.status}`)
        return res.blob()
      })
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob)
        a.href = blobUrl
        a.download = `layer-${layer.name.toLowerCase().replace(/\s+/g, '-')}.json`
        a.click()
        URL.revokeObjectURL(blobUrl)
      })
      .catch(() => toast.error('Export du layer impossible. Réessayez.'))
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

  const totalTechniques = layers.reduce((sum, l) => sum + layerTechCount(l.layer_data), 0)
  const largest = Math.max(1, ...layers.map(l => layerTechCount(l.layer_data)))

  return (
    <div className="mx" data-layout={display.layout}>
      {display.circuit && <MitreCircuit />}
      <MitreHeader
        breadcrumb="Intel / ATT&CK Navigator"
        title="Layers"
        accent="ATT&CK"
        subtitle="Calques de couverture ATT&CK, exportables au format Navigator."
        status={loading ? { text: 'CHARGEMENT…', tone: 'busy' }
          : failed ? { text: 'INDISPONIBLE', tone: 'warn' }
          : { text: 'LAYERS LOCAUX', mark: `${layers.length} LAYER${layers.length > 1 ? 'S' : ''}` }}
        actions={
          <>
            <input ref={fileRef} type="file" accept=".json" onChange={handleImportFile} hidden aria-hidden="true" tabIndex={-1} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={importing} className="mx-btn">
              {importing ? <Loader2 size={14} className="mx-spin" /> : <Upload size={14} aria-hidden="true" />}
              {importing ? 'Import…' : 'Importer un JSON'}
            </button>
            <button type="button" onClick={() => setShowCreate(true)} className="mx-btn is-primary">
              <Plus size={14} aria-hidden="true" />Nouveau layer
            </button>
          </>
        }
        stats={loading ? [] : [
          { label: 'Layers', value: layers.length, cyan: true },
          { label: 'Techniques référencées', value: totalTechniques.toLocaleString('fr-FR') },
        ]}
      />

      <div className="mx-view-toolbar"><MitreDisplaySettings preferences={display} onChange={setDisplay} /></div>

      <div className="mx-scroll" style={{ padding: '20px 24px 28px' }}>
        {loading ? (
          <StateBlock live icon={<Loader2 size={22} className="mx-spin" />} title="Chargement des layers…" />
        ) : failed ? (
          <StateBlock warn icon={<AlertTriangle size={22} />} title="Layers indisponibles"
            actions={<button type="button" onClick={load} className="mx-btn is-primary">Réessayer</button>}>
            La liste des layers n’a pas pu être chargée.
          </StateBlock>
        ) : layers.length === 0 ? (
          <StateBlock icon={<LayersGlyph size={22} />} title="Aucun layer ATT&CK"
            actions={
              <>
                <button type="button" onClick={() => fileRef.current?.click()} className="mx-btn"><Upload size={14} />Importer un JSON</button>
                <button type="button" onClick={() => setShowCreate(true)} className="mx-btn is-primary"><Plus size={14} />Créer un layer</button>
              </>
            }>
            Créez un layer vide ou importez un JSON ATT&CK Navigator existant.
          </StateBlock>
        ) : (
          <ul className="mx-layer-grid" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {layers.map(layer => {
              const count = layerTechCount(layer.layer_data)
              return (
                <li key={layer.id} className="mx-layer">
                  <div className="mx-layer-top">
                    <span className="mx-layer-icon" aria-hidden="true"><LayersGlyph size={19} /></span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <button type="button" className="mx-layer-open" onClick={() => navigate(`/mitre/layers/${layer.id}`)}>
                        {layer.name}
                      </button>
                      <span className="mx-row" style={{ marginTop: 7 }}>
                        <span className="mx-tag">{layer.domain}</span>
                        {layer.version && <span className="mx-tag">v{layer.version}</span>}
                      </span>
                    </div>
                    <div className="mx-layer-actions">
                      <button type="button" onClick={e => handleExport(layer, e)} className="mx-icon-btn" title="Exporter" aria-label={`Exporter le layer ${layer.name}`}>
                        <Download size={15} />
                      </button>
                      <button type="button" onClick={e => handleDelete(layer, e)} className="mx-icon-btn is-danger" title="Supprimer" aria-label={`Supprimer le layer ${layer.name}`}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  {layer.description && <p className="mx-layer-desc">{layer.description}</p>}
                  <div className="mx-meter" aria-hidden="true"><i style={{ width: `${Math.max(count ? 6 : 0, (count / largest) * 100)}%` }} /></div>
                  <div className="mx-layer-foot">
                    <span className="mx-layer-count"><b>{count}</b>technique{count > 1 ? 's' : ''}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      Mis à jour le {new Date(layer.updated_at).toLocaleDateString('fr-FR')}
                      <ChevronRight size={14} aria-hidden="true" />
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={layer => { setShowCreate(false); setLayers(prev => [layer, ...prev]) }}
        />
      )}

      {pendingDelete && (
        <Dialog title="Supprimer le layer" onClose={() => setPendingDelete(null)}
          footer={
            <>
              <button type="button" className="mx-btn" onClick={() => setPendingDelete(null)}>Annuler</button>
              <button type="button" className="mx-btn is-danger" onClick={confirmDelete}><Trash2 size={14} />Supprimer</button>
            </>
          }>
          <p>Supprimer le layer « {pendingDelete.name} » ? Cette action est définitive.</p>
        </Dialog>
      )}
    </div>
  )
}
