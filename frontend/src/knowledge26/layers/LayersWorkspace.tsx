import { useEffect, useRef, useState } from 'react'
import { Download, FileJson, Loader2, Plus, Trash2 } from 'lucide-react'
import { attackLayerApi } from '@/api/client'
import ConfirmModal from '@/components/ConfirmModal'
import { toast } from '@/store/toast'
import type { AttackLayer } from '@/types/attackLayer'
import LayerEditor from './LayerEditor'
import { downloadLayer, formatDate, techniqueCount } from './layerIO'

/*
 * ATT&CK Layers as an operational workspace inside Atlas — not a knowledge
 * source and never mixed with records. Same capabilities as /mitre/layers:
 * list, create, import a Navigator JSON, delete, technique counts, dates and
 * export; opening a layer swaps in the editor (layer state in the URL).
 */

export default function LayersWorkspace({ openId, onOpenLayer, onOpenTechnique }: {
  openId: number | null
  onOpenLayer: (id: number | null) => void
  onOpenTechnique: (id: string) => void
}) {
  const [layers, setLayers] = useState<AttackLayer[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<AttackLayer | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => {
    setState('loading')
    attackLayerApi.list().then(result => { setLayers(result.items); setState('ready') }).catch(() => setState('error'))
  }
  useEffect(() => { if (openId === null) load() }, [openId])

  if (openId !== null) return <LayerEditor id={openId} onClose={() => onOpenLayer(null)} onOpenTechnique={onOpenTechnique} />

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) { toast.error('Le nom est requis'); return }
    setSaving(true)
    try {
      const layer = await attackLayerApi.create({ name: name.trim(), description: description.trim() })
      setLayers(previous => [layer, ...previous]); setCreating(false); setName(''); setDescription('')
      toast.success('Layer créé')
    } catch { toast.error('Erreur lors de la création') }
    finally { setSaving(false) }
  }
  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    setImporting(true)
    try {
      const result = await attackLayerApi.import(JSON.parse(await file.text()))
      toast.success(`Layer importé : ${result.imported} techniques`)
      load()
    } catch (error) { toast.error(`Import échoué : ${error instanceof Error ? error.message : 'fichier invalide'}`) }
    finally { setImporting(false) }
  }
  const remove = async () => {
    const layer = pendingDelete; setPendingDelete(null)
    if (!layer) return
    try { await attackLayerApi.delete(layer.id); setLayers(previous => previous.filter(entry => entry.id !== layer.id)); toast.success('Layer supprimé') }
    catch { toast.error('Erreur lors de la suppression') }
  }
  const total = layers.reduce((sum, layer) => sum + techniqueCount(layer.layer_data), 0)
  const largest = Math.max(1, ...layers.map(layer => techniqueCount(layer.layer_data)))

  return <section className="ka-lw" aria-label="Workspace ATT&CK Layers">
    <header className="ka-lw-head">
      <div><small>WORKSPACE ATT&amp;CK</small><h2>Layers de couverture</h2><p>Calques ATT&amp;CK locaux, exportables au format Navigator. {state === 'ready' && <b>{layers.length} layer{layers.length > 1 ? 's' : ''} · {total} technique{total > 1 ? 's' : ''} référencée{total > 1 ? 's' : ''}</b>}</p></div>
      <div className="ka-lw-actions">
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={importFile} aria-label="Fichier Navigator JSON" />
        <button onClick={() => fileRef.current?.click()} disabled={importing}>{importing ? <Loader2 size={14} className="ka-spin" /> : <FileJson size={14} />} IMPORTER NAVIGATOR JSON</button>
        <button className="is-primary" aria-expanded={creating} onClick={() => setCreating(value => !value)}><Plus size={14} /> NOUVEAU LAYER</button>
      </div>
    </header>

    {creating && <form className="ka-lw-create" onSubmit={create} aria-label="Nouveau layer ATT&CK">
      <label>Nom *<input value={name} onChange={event => setName(event.target.value)} placeholder="ex. APT29 — Investigation Q1" required autoFocus /></label>
      <label>Description<input value={description} onChange={event => setDescription(event.target.value)} placeholder="Contexte, objectif…" /></label>
      <span className="ka-lw-create-actions"><button type="button" onClick={() => setCreating(false)}>Annuler</button><button type="submit" className="is-primary" disabled={saving}>{saving ? 'Création…' : 'Créer le layer'}</button></span>
    </form>}

    {state === 'loading' && <p className="ka-lw-state" role="status">Chargement des layers…</p>}
    {state === 'error' && <p className="ka-lw-state is-warn" role="status">Layers indisponibles. <button onClick={load}>Réessayer</button></p>}
    {state === 'ready' && !layers.length && <p className="ka-lw-state">Aucun layer. Créez-en un ou importez un JSON ATT&amp;CK Navigator.</p>}
    {state === 'ready' && layers.length > 0 && <ul className="ka-lw-list">{layers.map((layer, index) => {
      const count = techniqueCount(layer.layer_data)
      return <li key={layer.id} className="ka-lw-row">
        <button className="ka-lw-open" onClick={() => onOpenLayer(layer.id)} aria-label={`Ouvrir le layer ${layer.name}`}>
          <span className="ka-lw-top"><code>LAYER {String(index + 1).padStart(2, '0')}</code><span className="ka-lw-meta"><i>{layer.domain}</i>{layer.version && <i>v{layer.version}</i>}</span></span>
          <span className="ka-lw-name"><strong>{layer.name}</strong><small>{layer.description || 'Sans description'}</small></span>
          <span className="ka-lw-foot">
            <span className="ka-lw-count"><b>{count}</b> technique{count > 1 ? 's' : ''}<span className="ka-lw-meter" aria-hidden="true"><i style={{ width: `${count ? Math.max(6, (count / largest) * 100) : 0}%` }} /></span></span>
            <span className="ka-lw-date">Créé le {formatDate(layer.created_at)} · Mis à jour le {formatDate(layer.updated_at)}</span>
          </span>
        </button>
        <span className="ka-lw-row-actions">
          <button onClick={() => downloadLayer(layer.id, layer.name).catch(() => toast.error('Export du layer impossible. Réessayez.'))} aria-label={`Exporter le layer ${layer.name}`}><Download size={15} /></button>
          <button className="is-danger" onClick={() => setPendingDelete(layer)} aria-label={`Supprimer le layer ${layer.name}`}><Trash2 size={15} /></button>
        </span>
      </li>
    })}</ul>}

    <ConfirmModal open={pendingDelete !== null} title="SUPPRIMER CE LAYER ?" message={`Le layer « ${pendingDelete?.name ?? ''} » sera supprimé définitivement.`}
      confirmLabel="SUPPRIMER" danger onCancel={() => setPendingDelete(null)} onConfirm={remove} />
  </section>
}
