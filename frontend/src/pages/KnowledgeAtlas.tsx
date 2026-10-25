import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileJson, Layers, Plus, RadioTower } from 'lucide-react'
import { cveApi } from '@/api/client'
import NVDImportModal from '@/components/NVDImportModal'
import { toast } from '@/store/toast'
import KnowledgeHero from '@/knowledge26/KnowledgeHero'
import KnowledgeToolbar, { type Mode } from '@/knowledge26/KnowledgeToolbar'
import KnowledgeRegistry from '@/knowledge26/KnowledgeRegistry'
import KnowledgeCarousel from '@/knowledge26/KnowledgeCarousel'
import KnowledgeInspector from '@/knowledge26/KnowledgeInspector'
import LayersWorkspace from '@/knowledge26/layers/LayersWorkspace'
import CveEditor from '@/knowledge26/records/CveEditor'
import type { CVEEntry } from '@/types'
import { useKnowledge } from '@/knowledge26/useKnowledge'
import { SOURCES, SOURCE_LABEL, filterItems, sortItems, sortOptions, type FacetState, type KnowledgeItem, type SortKey, type Source } from '@/knowledge26/model'
import '@/cve26/cve.css'
import '@/lolbins26/lolbins.css'
import '@/knowledge26/knowledge.css'
import '@/knowledge26/dossier.css'
import '@/knowledge26/layers.css'

/*
 * Knowledge Atlas — the unified consultation interface meant to replace the
 * CVE, ATT&CK, CLOAK and LOLBins modules, plus the ATT&CK Layers workspace.
 * URL: ?source=&q=&id= for records, ?workspace=layers&id= for layers.
 */

const asSource = (value: string | null): Source | 'TOUT' => {
  const upper = value?.toUpperCase()
  if (upper === 'ATTACK' || upper === 'ATT&CK') return 'MITRE'
  return upper && (SOURCES as readonly string[]).includes(upper) ? upper as Source : 'TOUT'
}

export default function KnowledgeAtlas() {
  const [params, setParams] = useSearchParams()
  const paramsKey = params.toString()
  const workspace = params.get('workspace') === 'layers' ? 'layers' : 'knowledge'
  const layerId = workspace === 'layers' && /^[1-9]\d*$/.test(params.get('id') ?? '') ? Number(params.get('id')) : null
  const source = asSource(params.get('source'))
  const query = params.get('q') ?? ''
  const [sort, setSort] = useState<SortKey>('relevance')
  const [facets, setFacets] = useState<FacetState>({})
  const [mode, setMode] = useState<Mode>('CAROUSEL')
  const [grouped, setGrouped] = useState(false)
  const [onlyTechniques, setOnlyTechniques] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [dossier, setDossier] = useState<KnowledgeItem | null>(null)
  const [trail, setTrail] = useState<KnowledgeItem[]>([])
  const [annotationTarget, setAnnotationTarget] = useState<string | null>(null)
  const [nvdOpen, setNvdOpen] = useState(false)
  const [cveEditor, setCveEditor] = useState<{ entry?: CVEEntry } | null>(null)
  const handledRequest = useRef('')
  const internalNavigation = useRef('')
  const fileRef = useRef<HTMLInputElement>(null)
  const data = useKnowledge(onlyTechniques)
  const { collections, all } = data

  const items = useMemo(() => sortItems(
    filterItems(all, source, query, facets).filter(item => !(onlyTechniques && item.source === 'MITRE' && (item.original as { is_subtechnique?: boolean }).is_subtechnique)),
    sort, query), [all, source, query, facets, sort, onlyTechniques])
  const loading = SOURCES.some(target => !collections[target])
  const sourceReady = source !== 'TOUT' && !!collections[source]

  const recordParams = (item: KnowledgeItem, action?: 'edit') => {
    const next = new URLSearchParams({ source: item.source.toLowerCase(), id: item.id })
    if (query.trim()) next.set('q', query.trim())
    if (action) next.set('action', action)
    return next
  }
  const openFresh = (item: KnowledgeItem, annotate = false, syncUrl = true) => {
    setTrail([]); setSelected(item.key); setDossier(item); setAnnotationTarget(annotate ? item.key : null)
    if (syncUrl) { internalNavigation.current = `${item.source}:${item.id}:`; setParams(recordParams(item)) }
  }
  const openInDossier = (item: KnowledgeItem) => {
    if (dossier && dossier.key !== item.key) setTrail(previous => [...previous, dossier])
    setSelected(item.key); setDossier(item); setAnnotationTarget(null); internalNavigation.current = `${item.source}:${item.id}:`; setParams(recordParams(item))
  }
  const openRef = async (target: Source, id: string) => {
    const item = await data.resolve(target, id)
    if (!item) { toast.error(`${SOURCE_LABEL[target]} ${id} introuvable dans Atlas`); return }
    if (dossier) openInDossier(item); else openFresh(item)
  }
  const back = () => {
    const previous = trail[trail.length - 1]
    if (!previous) return
    setTrail(trail.slice(0, -1)); setSelected(previous.key); setDossier(previous); setAnnotationTarget(null); internalNavigation.current = `${previous.source}:${previous.id}:`; setParams(recordParams(previous))
  }

  // URL is the navigation contract: refresh, Back and Forward restore records/editors.
  useEffect(() => {
    if (workspace === 'layers') { setDossier(null); setCveEditor(null); handledRequest.current = ''; return }
    const id = params.get('id')?.trim()
    const action = params.get('action')
    if (!id) {
      handledRequest.current = ''
      setDossier(null); setTrail([]); setAnnotationTarget(null)
      setCveEditor(action === 'new' && source === 'CVE' ? previous => previous ?? {} : null)
      return
    }
    if (source === 'TOUT' || !sourceReady) return
    const key = `${source}:${id}:${action ?? ''}`
    if (internalNavigation.current === key) { internalNavigation.current = ''; handledRequest.current = key; return }
    if (handledRequest.current === key) return
    handledRequest.current = key
    let active = true
    data.resolve(source, id).then(item => {
      if (!active) return
      if (!item) { toast.error(`${SOURCE_LABEL[source]} ${id} introuvable dans Atlas`); return }
      setSelected(item.key); setAnnotationTarget(null)
      if (source === 'CVE' && action === 'edit') { setDossier(null); setCveEditor({ entry: item.original as CVEEntry }); return }
      setCveEditor(null)
      setTrail([]); setDossier(item)
    })
    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, workspace, source, sourceReady])

  const changeWorkspace = (value: 'knowledge' | 'layers') => setParams(value === 'layers' ? new URLSearchParams({ workspace: 'layers' }) : new URLSearchParams())
  const changeLayer = (id: number | null) => { const next = new URLSearchParams({ workspace: 'layers' }); if (id) next.set('id', String(id)); setParams(next) }
  const changeSource = (value: Source | 'TOUT') => {
    const next = new URLSearchParams(); if (value !== 'TOUT') next.set('source', value.toLowerCase()); if (query.trim()) next.set('q', query.trim()); setParams(next)
    setFacets({}); if (!sortOptions(value).some(option => option.key === sort)) setSort('relevance')
  }
  const changeQuery = (value: string) => { const next = new URLSearchParams(); if (source !== 'TOUT') next.set('source', source.toLowerCase()); if (value.trim()) next.set('q', value); setParams(next, { replace: true }) }
  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    try { const result = await cveApi.importNVD(JSON.parse(await file.text()) as object); toast.success(`Import terminé : ${result.created} ajoutées, ${result.skipped} ignorées`); await data.refreshCVE() }
    catch { toast.error('Import impossible : vérifiez le fichier NVD JSON 2.0') }
  }
  const deleteCVE = async (item: KnowledgeItem) => {
    try { await cveApi.delete((item.original as { id: number }).id); data.removeItem('CVE', item.key); setParams(new URLSearchParams({ source: 'cve' })); setDossier(null); setTrail([]); toast.success(`${item.id} supprimée`) }
    catch { toast.error('Erreur lors de la suppression') }
  }
  const editCVE = (item: KnowledgeItem) => { setDossier(null); setTrail([]); setCveEditor({ entry: item.original as CVEEntry }); setParams(recordParams(item, 'edit')) }
  const pageable = (source === 'CVE' || source === 'MITRE') && (collections[source]?.items.length ?? 0) < (collections[source]?.total ?? 0)
  const counts = Object.fromEntries(SOURCES.map(target => [target, collections[target]?.items.length])) as Partial<Record<Source, number>>

  return <div className="ka-page" data-workspace={workspace} data-dossier={dossier ? '' : undefined}>
    <KnowledgeHero loaded={all.length} />
    <nav className="ka-workspace" aria-label="Espaces Atlas">
      <button aria-pressed={workspace === 'knowledge'} onClick={() => changeWorkspace('knowledge')}>KNOWLEDGE<small>{all.length}</small></button>
      <button aria-pressed={workspace === 'layers'} onClick={() => changeWorkspace('layers')}><Layers size={13} /> LAYERS ATT&amp;CK</button>
    </nav>

    {workspace === 'layers'
      ? <LayersWorkspace openId={layerId} onOpenLayer={changeLayer} onOpenTechnique={id => void openRef('MITRE', id)} />
      : <>
        <KnowledgeToolbar all={all} counts={counts} source={source} onSource={changeSource} query={query} onQuery={changeQuery} sort={sort} onSort={setSort}
          facets={facets} onFacets={setFacets} mode={mode} onMode={setMode} grouped={grouped} onGrouped={setGrouped} onlyTechniques={onlyTechniques} onOnlyTechniques={setOnlyTechniques} />
        {source === 'CVE' && <div className="ka-context-actions" aria-label="Actions CVE">
          <button onClick={() => setNvdOpen(true)}><RadioTower size={14} /> IMPORT NVD EN LIGNE</button>
          <button onClick={() => fileRef.current?.click()}><FileJson size={14} /> FICHIER NVD JSON</button>
          <button onClick={() => { setCveEditor({}); setParams(new URLSearchParams({ source: 'cve', action: 'new' })) }}><Plus size={14} /> NOUVELLE CVE</button>
          <input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={importFile} aria-label="Fichier NVD JSON" />
        </div>}
        {source === 'MITRE' && <div className="ka-context-actions" aria-label="Actions ATT&CK">
          <button onClick={() => changeWorkspace('layers')}><Layers size={14} /> LAYERS ATT&amp;CK →</button>
        </div>}
        <div className="ka-status">
          <span aria-live="polite">{loading ? 'Chargement des collections…' : `${items.length} fiches dans la sélection`}</span>
          <span>INDEX LOCAL · {all.length} LOADED</span>
          <span>{SOURCES.map(target => `${SOURCE_LABEL[target]} ${collections[target]?.items.length ?? '…'} / ${collections[target]?.total ?? '…'}`).join(' · ')}</span>
        </div>
        {SOURCES.some(target => collections[target]?.error) && <div className="ka-error" role="status">{SOURCES.filter(target => collections[target]?.error).map(target => SOURCE_LABEL[target]).join(', ')} indisponible. Les autres collections restent accessibles. <button onClick={data.retry}>Réessayer</button></div>}
        {data.annotationError && <div className="ka-error" role="status">Annotations CLOAK indisponibles. Le référentiel reste consultable.</div>}
        {!loading && !items.length && <p className="ka-empty">Aucune connaissance pour cette sélection.</p>}
        {mode === 'REGISTRY' && <KnowledgeRegistry items={items} selected={selected} onSelect={item => openFresh(item)} annotations={data.annotations} onAnnotate={item => openFresh(item, true)} kevFlags={data.kevFlags} grouped={grouped && source === 'TOUT'} source={source} onEdit={editCVE} />}
        {mode === 'CAROUSEL' && items.length > 0 && <KnowledgeCarousel items={items} selected={selected} onSelect={item => openFresh(item)} onFocus={setSelected} annotations={data.annotations} kevFlags={data.kevFlags} />}
        {pageable && <button className="ka-load-page" disabled={collections[source as Source]?.loadingMore} onClick={() => data.loadMore(source as Source)}>{collections[source as Source]?.loadingMore ? 'Chargement…' : `Charger 100 fiches supplémentaires · ${collections[source as Source]?.items.length} / ${collections[source as Source]?.total}`}</button>}
      </>}

    <footer className="ka-footnote">KNOWLEDGE ATLAS · UNIFIED KNOWLEDGE BASE <span>CVE · MITRE ATT&amp;CK · CLOAK (GPL-2.0) · LOLBAS · GTFOBINS</span></footer>
    {dossier && <KnowledgeInspector item={dossier} allItems={all} annotations={data.annotations} previous={trail[trail.length - 1]} editAnnotation={annotationTarget === dossier.key}
      onOpen={openInDossier} onOpenRef={(target, id) => void openRef(target, id)} onBack={back} onClose={() => { const next = new URLSearchParams({ source: dossier.source.toLowerCase() }); if (query.trim()) next.set('q', query.trim()); setParams(next); setDossier(null); setTrail([]); setAnnotationTarget(null) }}
      onDeleteCVE={deleteCVE} onEditCVE={editCVE} onAnnotationSaved={data.saveAnnotation} onAnnotationDeleted={data.dropAnnotation} />}
    {cveEditor && <CveEditor entry={cveEditor.entry} onClose={() => { const next = new URLSearchParams({ source: 'cve' }); if (cveEditor.entry) next.set('id', cveEditor.entry.cve_id); setParams(next); setCveEditor(null) }} onSaved={entry => {
      const item = data.upsertCVE(entry); setCveEditor(null); openFresh(item)
      toast.success(cveEditor.entry ? `${entry.cve_id} mise à jour` : `${entry.cve_id} créée`)
    }} />}
    <NVDImportModal open={nvdOpen} onClose={() => setNvdOpen(false)} onSuccess={data.refreshCVE} />
  </div>
}
