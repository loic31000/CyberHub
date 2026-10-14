import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import MitreCircuit from '@/mitre/MitreCircuit'
import { attackLayerApi, mitreApi } from '@/api/client'
import type { AttackLayer, LayerEntry } from '@/types/attackLayer'
import type { MITRETechnique, MITRETactic } from '@/types'
import { toast } from '@/store/toast'
import {
  ArrowLeft, Download, Search, X, Plus, Minus,
  Save, Edit, CheckSquare, Check, Loader2, AlertTriangle,
} from 'lucide-react'
import { LayersGlyph } from '@/dashboard2026/CyberGlyphs'
import { MitreHeader, SkeletonGrid, StateBlock, onTacticKeys, parseArr, tacticTone } from '@/mitre/MitreUi'

function parseLayerData(raw: string): LayerEntry[] {
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [] } catch { return [] }
}

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

  // Refetches whenever the tab, the search or the tactic changes.
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
    <div className="mx">
      <StateBlock page live icon={<Loader2 size={22} className="mx-spin" />} title="Chargement du layer…" />
    </div>
  )
  if (!layer) return (
    <div className="mx">
      <StateBlock page warn icon={<AlertTriangle size={22} />} title="Layer introuvable"
        actions={<button type="button" className="mx-btn is-primary" onClick={() => navigate('/mitre/layers')}><ArrowLeft size={14} />Retour aux layers</button>}>
        Ce layer n’existe pas ou n’a pas pu être chargé.
      </StateBlock>
    </div>
  )

  const saveButton = (
    <button type="button" onClick={handleSave} disabled={saving} className="mx-btn is-save">
      {saving ? <Loader2 size={14} className="mx-spin" /> : <Save size={14} aria-hidden="true" />}
      {saving ? 'Sauvegarde…' : 'Sauvegarder'}
    </button>
  )

  return (
    <div className="mx">
      <MitreCircuit />
      <MitreHeader
        breadcrumb="Intel / Layers ATT&CK"
        title={layer.name}
        compactTitle
        subtitle={layer.description || 'Layer ATT&CK local.'}
        status={dirty ? { text: 'NON SAUVEGARDÉ', tone: 'warn', mark: `${entries.length} TECH.` }
          : { text: 'SAUVEGARDÉ', mark: `${entries.length} TECH.` }}
        actions={
          <>
            <button type="button" onClick={() => navigate('/mitre/layers')} className="mx-btn is-ghost">
              <ArrowLeft size={14} aria-hidden="true" />Tous les layers
            </button>
            <button type="button" onClick={() => setEditing(v => !v)} className="mx-btn" aria-expanded={editing} aria-controls="mx-meta">
              <Edit size={14} aria-hidden="true" />Métadonnées
            </button>
            {dirty && saveButton}
            <button type="button" onClick={handleExport} className="mx-btn">
              <Download size={14} aria-hidden="true" />Exporter
            </button>
          </>
        }
        stats={[
          { label: 'Techniques', value: entries.length, cyan: true },
          { label: 'Domaine', value: layer.domain },
          { label: 'Mis à jour', value: new Date(layer.updated_at).toLocaleDateString('fr-FR') },
        ]}
      >
        <div className="mx-tabs" role="tablist" aria-label="Contenu du layer">
          <button type="button" role="tab" id="mx-tab-selected" aria-controls="mx-panel" aria-selected={tab === 'selected'}
            className="mx-tab" onClick={() => setTab('selected')}>
            <CheckSquare size={15} aria-hidden="true" />Sélectionnées<span className="mx-count">{entries.length}</span>
          </button>
          <button type="button" role="tab" id="mx-tab-browse" aria-controls="mx-panel" aria-selected={tab === 'browse'}
            className="mx-tab" onClick={() => setTab('browse')}>
            <Search size={15} aria-hidden="true" />Parcourir la matrice<span className="mx-count">{techTotal}</span>
          </button>
        </div>
      </MitreHeader>

      {/* Edit metadata */}
      {editing && (
        <form id="mx-meta" onSubmit={handleSaveMeta} className="mx-meta-form" aria-label="Métadonnées du layer">
          <div className="mx-field">
            <label htmlFor="mx-meta-name" className="mx-label">Nom *</label>
            <input id="mx-meta-name" value={editName} onChange={e => setEditName(e.target.value)} className="mx-input" required />
          </div>
          <div className="mx-field">
            <label htmlFor="mx-meta-desc" className="mx-label">Description</label>
            <input id="mx-meta-desc" value={editDesc} onChange={e => setEditDesc(e.target.value)} className="mx-input" />
          </div>
          <div className="mx-head-actions">
            <button type="button" onClick={() => setEditing(false)} className="mx-btn">Annuler</button>
            <button type="submit" disabled={saving} className="mx-btn is-primary">
              {saving ? <Loader2 size={14} className="mx-spin" /> : <Check size={14} aria-hidden="true" />}Enregistrer
            </button>
          </div>
        </form>
      )}

      {/* Content */}
      <div id="mx-panel" role="tabpanel" aria-labelledby={tab === 'selected' ? 'mx-tab-selected' : 'mx-tab-browse'}
        style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {tab === 'selected' ? (
          <div className="mx-scroll">
            {entries.length === 0 ? (
              <StateBlock icon={<LayersGlyph size={22} />} title="Aucune technique dans ce layer"
                actions={<button type="button" onClick={() => setTab('browse')} className="mx-btn is-primary"><Search size={14} />Parcourir les techniques</button>}>
                Ajoutez des techniques depuis la matrice pour construire ce layer.
              </StateBlock>
            ) : (
              <ul className="mx-grid" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {entries.map(entry => (
                  <li key={entry.technique_id} className="mx-entry">
                    <div style={{ minWidth: 0 }}>
                      <span className="mx-id">{entry.technique_id}</span>
                      {entry.name && <p>{entry.name}</p>}
                    </div>
                    <button type="button" onClick={() => removeEntry(entry.technique_id)} className="mx-icon-btn is-danger"
                      title="Retirer" aria-label={`Retirer ${entry.technique_id} du layer`}>
                      <Minus size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="mx-body">
            {/* Tactics */}
            <nav className="mx-rail" aria-label="Tactiques ATT&CK" onKeyDown={onTacticKeys}>
              <p className="mx-rail-title">Tactiques</p>
              <ul>
                <li>
                  <button type="button" className="mx-tactic is-all" aria-pressed={activeTactic === ''} onClick={() => setActiveTactic('')}>
                    <span>Toutes</span>
                  </button>
                </li>
              </ul>
              <hr />
              <ul>
                {tactics.map(tac => (
                  <li key={tac.tactic_id}>
                    <button type="button" className="mx-tactic" {...tacticTone(tac.short_name)} aria-pressed={activeTactic === tac.short_name}
                      onClick={() => setActiveTactic(tac.short_name)}>
                      <span>{tac.name}</span><small>{tac.tactic_id}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Techniques */}
            <section className="mx-main" aria-label="Techniques à ajouter">
              <div className="mx-toolbar" style={{ padding: '10px 20px' }}>
                <div className="mx-search" role="search">
                  <Search size={15} aria-hidden="true" />
                  <label htmlFor="mx-layer-q" className="mx-sr">Rechercher une technique</label>
                  <input id="mx-layer-q" type="search" value={query} onChange={e => setQuery(e.target.value)}
                    placeholder="Rechercher une technique : ID, nom…" className="mx-input" autoComplete="off" />
                  {query && (
                    <button type="button" onClick={() => setQuery('')} className="mx-clear" aria-label="Effacer la recherche"><X size={14} /></button>
                  )}
                </div>
              </div>
              <div className="mx-scroll">
                {techLoading ? (
                  <SkeletonGrid count={6} />
                ) : techniques.length === 0 ? (
                  <StateBlock icon={<Search size={22} />} title="Aucun résultat">Modifiez la recherche ou la tactique.</StateBlock>
                ) : (
                  <>
                    <div className="mx-grid">
                      {techniques.map(tech => {
                        const inLayer = entrySet.has(tech.technique_id)
                        const techTactics = parseArr(tech.tactics)
                        const tacticName = tactics.find(t => t.short_name === techTactics[0])?.name ?? techTactics[0]
                        return (
                          <button key={tech.technique_id} type="button" onClick={() => toggleTechnique(tech)}
                            aria-pressed={inLayer} className="mx-card" {...tacticTone(techTactics[0])}
                            aria-label={`${tech.technique_id} ${tech.name} : ${inLayer ? 'retirer du layer' : 'ajouter au layer'}`}>
                            <span className="mx-card-top">
                              <span className="mx-id">{tech.technique_id}</span>
                              <span className="mx-check" aria-hidden="true">{inLayer ? <Check size={13} /> : <Plus size={12} style={{ color: 'var(--mx-faint)' }} />}</span>
                            </span>
                            <span className="mx-card-name">{tech.name}</span>
                            {tacticName && <span className="mx-tactic-name">{tacticName}</span>}
                          </button>
                        )
                      })}
                    </div>
                    {totalPages > 1 && (
                      <nav className="mx-pager" aria-label="Pagination des techniques">
                        <button type="button" className="mx-btn" disabled={techPage === 1} onClick={() => fetchTechniques(techPage - 1)}>← Précédent</button>
                        <span>Page {techPage} / {totalPages}</span>
                        <button type="button" className="mx-btn" disabled={techPage === totalPages} onClick={() => fetchTechniques(techPage + 1)}>Suivant →</button>
                      </nav>
                    )}
                  </>
                )}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Unsaved changes */}
      {dirty && (
        <div className="mx-dirty" role="status">
          <span><AlertTriangle size={15} aria-hidden="true" />Modifications non sauvegardées</span>
          {saveButton}
        </div>
      )}
    </div>
  )
}
