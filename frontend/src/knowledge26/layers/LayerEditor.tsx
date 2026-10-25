import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, Check, Download, Edit, Minus, Plus, Save, Search } from 'lucide-react'
import { attackLayerApi, mitreApi } from '@/api/client'
import ConfirmModal from '@/components/ConfirmModal'
import { toast } from '@/store/toast'
import type { AttackLayer, LayerEntry } from '@/types/attackLayer'
import type { MITRETactic, MITRETechnique } from '@/types'
import { stringArray } from '../model'
import { downloadLayer, formatDate, parseEntries } from './layerIO'

/*
 * One ATT&CK layer, edited inside Atlas: name/description metadata, the
 * selected techniques (each opens its ATT&CK dossier in Atlas), the matrix
 * browser with search + tactic filter + paging, add/remove, an explicit
 * unsaved-changes state, save and Navigator export. Leaving with unsaved
 * changes asks for confirmation.
 */

const LIMIT = 40
type Browse = { status: 'loading' | 'error' } | { status: 'ready'; items: MITRETechnique[]; total: number }

export default function LayerEditor({ id, onClose, onOpenTechnique }: { id: number; onClose: () => void; onOpenTechnique: (id: string) => void }) {
  const [layer, setLayer] = useState<AttackLayer | null>(null)
  const [failed, setFailed] = useState(false)
  const [entries, setEntries] = useState<LayerEntry[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tactics, setTactics] = useState<MITRETactic[]>([])
  const [tab, setTab] = useState<'selected' | 'browse'>('selected')
  const [editingMeta, setEditingMeta] = useState(false)
  const [metaName, setMetaName] = useState('')
  const [metaDesc, setMetaDesc] = useState('')
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [tactic, setTactic] = useState('')
  const [page, setPage] = useState(1)
  const [browse, setBrowse] = useState<Browse>({ status: 'loading' })
  const [leaving, setLeaving] = useState(false)
  const version = useRef(0)

  useEffect(() => {
    let active = true
    Promise.all([attackLayerApi.get(id), mitreApi.tactics()])
      .then(([value, list]) => { if (!active) return; setLayer(value); setEntries(parseEntries(value.layer_data)); setMetaName(value.name); setMetaDesc(value.description); setTactics(list) })
      .catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [id])

  useEffect(() => { const timer = setTimeout(() => setDebounced(query.trim()), 250); return () => clearTimeout(timer) }, [query])
  useEffect(() => { setPage(1) }, [debounced, tactic])

  const fetchPage = useCallback(async () => {
    const current = ++version.current
    setBrowse({ status: 'loading' })
    try {
      const result = await mitreApi.techniques({ q: debounced || undefined, tactic: tactic || undefined, page, limit: LIMIT })
      if (current === version.current) setBrowse({ status: 'ready', items: result.items ?? [], total: result.total })
    } catch { if (current === version.current) setBrowse({ status: 'error' }) }
  }, [debounced, tactic, page])
  useEffect(() => { if (tab === 'browse') void fetchPage() }, [tab, fetchPage])
  useEffect(() => () => { version.current++ }, [])

  const selected = new Set(entries.map(entry => entry.technique_id))
  const toggle = (technique: MITRETechnique) => {
    setEntries(previous => selected.has(technique.technique_id)
      ? previous.filter(entry => entry.technique_id !== technique.technique_id)
      : [...previous, { technique_id: technique.technique_id, name: technique.name, color: '', comment: '', score: 0, enabled: true }])
    setDirty(true)
  }
  const remove = (techniqueId: string) => { setEntries(previous => previous.filter(entry => entry.technique_id !== techniqueId)); setDirty(true) }

  const save = async () => {
    setSaving(true)
    try { setLayer(await attackLayerApi.update(id, { layer_data: JSON.stringify(entries) })); setDirty(false); toast.success('Layer sauvegardé') }
    catch { toast.error('Erreur lors de la sauvegarde') }
    finally { setSaving(false) }
  }
  const saveMeta = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!metaName.trim()) { toast.error('Le nom est requis'); return }
    setSaving(true)
    try { setLayer(await attackLayerApi.update(id, { name: metaName.trim(), description: metaDesc.trim() })); setEditingMeta(false); toast.success('Métadonnées mises à jour') }
    catch { toast.error('Erreur lors de la mise à jour') }
    finally { setSaving(false) }
  }

  if (failed) return <section className="ka-lw"><p className="ka-lw-state is-warn" role="status">Layer introuvable ou indisponible. <button onClick={onClose}>Retour aux layers</button></p></section>
  if (!layer) return <section className="ka-lw"><p className="ka-lw-state" role="status">Chargement du layer…</p></section>

  const pages = browse.status === 'ready' ? Math.max(1, Math.ceil(browse.total / LIMIT)) : 1
  const saveButton = <button className="is-save" onClick={save} disabled={saving}><Save size={14} /> {saving ? 'Sauvegarde…' : 'Sauvegarder'}</button>

  return <section className="ka-lw" aria-label={`Layer ${layer.name}`}>
    <header className="ka-lw-head">
      <div>
        <button className="ka-back" onClick={() => dirty ? setLeaving(true) : onClose()}><ArrowLeft size={13} /> Tous les layers</button>
        <small>LAYER ATT&amp;CK · {layer.domain}{layer.version ? ` · v${layer.version}` : ''}</small>
        <h2>{layer.name}</h2>
        <p>{layer.description || 'Sans description.'} <b>{entries.length} technique{entries.length > 1 ? 's' : ''} · mis à jour le {formatDate(layer.updated_at)}</b></p>
      </div>
      <div className="ka-lw-actions">
        <span className={`ka-lw-state-pill${dirty ? ' is-dirty' : ''}`} role="status">{dirty ? 'NON SAUVEGARDÉ' : 'SAUVEGARDÉ'}</span>
        <button aria-expanded={editingMeta} onClick={() => setEditingMeta(value => !value)}><Edit size={14} /> MÉTADONNÉES</button>
        {dirty && saveButton}
        <button onClick={() => downloadLayer(id, layer.name).catch(() => toast.error('Erreur lors de l’export'))}><Download size={14} /> EXPORTER JSON</button>
      </div>
    </header>

    {editingMeta && <form className="ka-lw-create" onSubmit={saveMeta} aria-label="Métadonnées du layer">
      <label>Nom *<input value={metaName} onChange={event => setMetaName(event.target.value)} required /></label>
      <label>Description<input value={metaDesc} onChange={event => setMetaDesc(event.target.value)} /></label>
      <span className="ka-lw-create-actions"><button type="button" onClick={() => setEditingMeta(false)}>Annuler</button><button type="submit" className="is-primary" disabled={saving}><Check size={14} /> Enregistrer</button></span>
    </form>}

    <div className="ka-lw-tabs" role="tablist" aria-label="Contenu du layer">
      <button role="tab" aria-selected={tab === 'selected'} onClick={() => setTab('selected')}>Techniques sélectionnées <b>{entries.length}</b></button>
      <button role="tab" aria-selected={tab === 'browse'} onClick={() => setTab('browse')}><Search size={14} /> Parcourir la matrice{browse.status === 'ready' && <b>{browse.total}</b>}</button>
    </div>

    {tab === 'selected' ? (entries.length
      ? <ul className="ka-lw-entries">{entries.map(entry => <li key={entry.technique_id}>
          <button className="ka-ref" onClick={() => onOpenTechnique(entry.technique_id)} aria-label={`Ouvrir ${entry.technique_id} dans Atlas`}><code>{entry.technique_id}</code><span>{entry.name}</span><i aria-hidden="true">↗</i></button>
          <button className="ka-lw-remove" onClick={() => remove(entry.technique_id)} aria-label={`Retirer ${entry.technique_id} du layer`}><Minus size={14} /></button>
        </li>)}</ul>
      : <div className="ka-lw-empty">
          <span className="ka-lw-empty-glyph" aria-hidden="true"><i /><i /><i /></span>
          <strong>Aucune technique sélectionnée</strong>
          <p>Ce layer est vide. Ajoutez des techniques depuis la matrice ATT&amp;CK pour construire la couverture.</p>
          <button className="is-primary" onClick={() => setTab('browse')}><Search size={14} /> Parcourir la matrice</button>
        </div>)
    : <div className="ka-lw-browse">
        <div className="ka-lw-filters">
          <label className="ka-lw-search"><Search size={14} aria-hidden="true" /><input type="search" aria-label="Rechercher une technique" placeholder="ID ou nom de technique…" value={query} onChange={event => setQuery(event.target.value)} /></label>
          <label className="ka-lw-tactic">Tactique<select value={tactic} onChange={event => setTactic(event.target.value)}><option value="">Toutes les tactiques</option>{tactics.map(entry => <option key={entry.tactic_id} value={entry.short_name}>{entry.name}</option>)}</select></label>
        </div>
        {browse.status === 'loading' && <p className="ka-lw-state" role="status">Chargement des techniques…</p>}
        {browse.status === 'error' && <p className="ka-lw-state is-warn" role="status"><AlertTriangle size={14} /> Techniques indisponibles. <button onClick={() => void fetchPage()}>Réessayer</button></p>}
        {browse.status === 'ready' && (browse.items.length
          ? <ul className="ka-lw-matrix">{browse.items.map(technique => {
              const inLayer = selected.has(technique.technique_id)
              const tacticName = tactics.find(entry => entry.short_name === stringArray(technique.tactics)[0])?.name
              return <li key={technique.technique_id}><button aria-pressed={inLayer} onClick={() => toggle(technique)} aria-label={`${technique.technique_id} ${technique.name} : ${inLayer ? 'retirer du layer' : 'ajouter au layer'}`}>
                <span><code>{technique.technique_id}</code>{inLayer ? <Check size={13} /> : <Plus size={13} />}</span><strong>{technique.name}</strong>{tacticName && <small>{tacticName}</small>}
              </button></li>
            })}</ul>
          : <p className="ka-lw-state">Aucun résultat. Modifiez la recherche ou la tactique.</p>)}
        {browse.status === 'ready' && pages > 1 && <nav className="ka-lw-pager" aria-label="Pagination des techniques">
          <button disabled={page === 1} onClick={() => setPage(value => value - 1)}>← Précédent</button><span>Page {page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage(value => value + 1)}>Suivant →</button>
        </nav>}
      </div>}

    {dirty && <div className="ka-lw-dirty" role="status"><span><AlertTriangle size={15} /> Modifications non sauvegardées</span>{saveButton}</div>}
    <ConfirmModal open={leaving} title="QUITTER SANS SAUVEGARDER ?" message="Les modifications de ce layer seront perdues." confirmLabel="QUITTER" danger
      onCancel={() => setLeaving(false)} onConfirm={() => { setLeaving(false); onClose() }} />
  </section>
}
