import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ExternalLink, FilePenLine, Trash2 } from 'lucide-react'
import { cisaApi, cloakAnnotationsApi, mitreApi } from '@/api/client'
import ConfirmModal from '@/components/ConfirmModal'
import { toast } from '@/store/toast'
import type { MITRETechnique } from '@/types'
import type { CISAKEVEntry, EPSSScore } from '@/types/threat_intel'
import type { CloakAnnotation } from '@/types/cloakAnnotation'
import { SOURCE_LABEL, cleanText, cloakRef, type KnowledgeItem, type Source } from './model'
import KnowledgeRecord from './KnowledgeRecord'
import AnnotationPanel from './records/AnnotationPanel'
import type { Enrichment } from './records/CveRecord'

/*
 * Knowledge Dossier: the record extracted from the catalogue, opened in the
 * centre (native <dialog>: focus containment, inert background, Escape).
 * One global vertical scroll, editorial sections, source actions in the
 * footer. Internal references (sub-technique, parent, LOLBins → ATT&CK) open
 * in this same dossier; "← Retour à …" walks back the trail or up the
 * hierarchy so the context is never lost.
 */

const SOURCE_TITLE: Record<Source, string> = { CVE: 'CVE', MITRE: 'MITRE ATT&CK', CLOAK: 'CLOAK', LOLBINS: 'LOLBINS · LOLBAS / GTFOBINS' }
/*
 * Transform that places the dossier over the record it was extracted from
 * (the active carousel card or a registry row). Null when motion is reduced,
 * when the Web Animations API is missing, or when there is no such origin —
 * the dossier then simply appears.
 */
function extraction(origin: HTMLElement | null, folder: HTMLElement): string | null {
  if (!origin?.isConnected || !origin.matches('.ka-focus-card, .ka-row') || typeof folder.animate !== 'function') return null
  if (!window.matchMedia?.('(prefers-reduced-motion: no-preference)').matches) return null
  const a = origin.getBoundingClientRect(), b = folder.getBoundingClientRect()
  if (!a.width || !b.width) return null
  const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2)
  return `translate(${dx}px, ${dy}px) scale(${a.width / b.width}, ${Math.min(1, a.height / b.height)})`
}

const httpStatus =(error: unknown) => (error as { response?: { status?: number } })?.response?.status
const attackUrl = (item: KnowledgeItem, detail?: MITRETechnique | null) => detail?.url || (item.original as MITRETechnique).url || `https://attack.mitre.org/techniques/${item.id.replace('.', '/')}/`

interface Props {
  item: KnowledgeItem
  allItems: KnowledgeItem[]
  annotations: Map<string, CloakAnnotation>
  /** Previous record in the navigation trail, if any. */
  previous?: KnowledgeItem
  editAnnotation?: boolean
  onOpen: (item: KnowledgeItem) => void
  onOpenRef: (source: Source, id: string) => void
  onBack: () => void
  onClose: () => void
  onDeleteCVE: (item: KnowledgeItem) => Promise<void>
  onEditCVE: (item: KnowledgeItem) => void
  onAnnotationSaved: (annotation: CloakAnnotation) => void
  onAnnotationDeleted: (ref: string) => void
}

export default function KnowledgeInspector(props: Props) {
  const { item, allItems, annotations, previous, onOpen, onOpenRef, onClose } = props
  const dialogRef = useRef<HTMLDialogElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const folderRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const closing = useRef(false)
  const [mitre, setMitre] = useState<MITRETechnique | null>(null)
  const [mitreError, setMitreError] = useState(false)
  const [kev, setKev] = useState<Enrichment<CISAKEVEntry>>({ status: 'loading' })
  const [epss, setEpss] = useState<Enrichment<EPSSScore>>({ status: 'loading' })
  const [editRequested, setEditRequested] = useState(Boolean(props.editAnnotation))
  const [confirm, setConfirm] = useState<'cve' | 'annotation' | null>(null)
  const annotation = annotations.get(cloakRef(item)) ?? null

  useEffect(() => { setEditRequested(Boolean(props.editAnnotation)) }, [item.key, props.editAnnotation])
  useEffect(() => { bodyRef.current?.scrollTo?.({ top: 0 }) }, [item.key])
  useEffect(() => {
    let active = true
    setMitre(null); setMitreError(false)
    if (item.source === 'MITRE') mitreApi.technique(item.id).then(v => { if (active) setMitre(v) }).catch(() => { if (active) setMitreError(true) })
    return () => { active = false }
  }, [item.key, item.source, item.id])
  useEffect(() => {
    if (item.source !== 'CVE') return
    const controller = new AbortController(); setKev({ status: 'loading' }); setEpss({ status: 'loading' })
    cisaApi.checkKEV(item.id, controller.signal).then(r => { if (!controller.signal.aborted) setKev({ status: 'ready', value: r.exploited ? r.entry : null }) }).catch(() => { if (!controller.signal.aborted) setKev({ status: 'error' }) })
    cisaApi.getEPSS(item.id, controller.signal).then(v => { if (!controller.signal.aborted) setEpss({ status: 'ready', value: v }) }).catch(e => { if (!controller.signal.aborted) setEpss(httpStatus(e) === 404 ? { status: 'ready', value: null } : { status: 'error' }) })
    return () => controller.abort()
  }, [item.key, item.id, item.source])
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    openerRef.current = opener
    const dialog = dialogRef.current
    dialog?.showModal()
    const folder = folderRef.current
    const from = folder && extraction(opener, folder)
    if (folder && from) {
      folder.dataset.extracting = ''
      folder.getAnimations().forEach(animation => animation.cancel())
      folder.animate([{ transform: from, opacity: .55 }, { transform: 'none', opacity: 1 }], { duration: 460, easing: 'cubic-bezier(.16,.86,.22,1)' })
        .finished.then(() => { delete folder.dataset.extracting }, () => {})
    }
    return () => { dialog?.close(); if (opener?.isConnected) opener.focus() }
  }, [])

  /* Closing plays the extraction backwards toward the card, briefly; instant when motion is reduced. */
  const close = () => {
    const folder = folderRef.current
    const to = folder && extraction(openerRef.current, folder)
    if (!folder || !to || closing.current) { onClose(); return }
    closing.current = true
    folder.animate([{ transform: 'none', opacity: 1 }, { transform: to, opacity: 0 }], { duration: 220, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' })
      .finished.then(onClose, onClose)
  }

  /* Hierarchy fallback when the dossier was opened directly on a child record. */
  const original = item.original as { __parentId?: number; is_subtechnique?: boolean; parent_id?: string }
  const cloakParent = item.source === 'CLOAK' && original.__parentId
    ? allItems.find(c => c.source === 'CLOAK' && c.id === `TE-${original.__parentId}` && c.categories[0] === item.categories[0]) : undefined
  const back = previous ? { label: previous.title === previous.id ? previous.id : previous.title, go: props.onBack }
    : cloakParent ? { label: cloakParent.title, go: () => onOpen(cloakParent) }
    : item.source === 'MITRE' && original.is_subtechnique && cleanText(original.parent_id) ? { label: cleanText(original.parent_id), go: () => onOpenRef('MITRE', cleanText(original.parent_id)) }
    : null

  const analyst = item.source === 'CLOAK'
    ? <AnnotationPanel key={`${item.key}:${annotation?.updated_at ?? 'none'}`} item={item} annotation={annotation} startEditing={editRequested}
        onReset={() => setConfirm('annotation')} onSaved={value => { setEditRequested(false); props.onAnnotationSaved(value) }} />
    : null

  return createPortal(
    <dialog className="ka-dossier" ref={dialogRef} aria-labelledby="ka-dossier-title" data-source={item.source} onCancel={event => { event.preventDefault(); close() }}>
      <div className="ka-dossier-scrim" onClick={close} aria-hidden="true" />
      <div className="ka-dossier-folder" ref={folderRef} data-source={item.source} data-severity={item.source === 'CVE' ? (item.original as { severity?: string }).severity : undefined}>
      <span className="ka-dossier-tab" aria-hidden="true"><i />{SOURCE_LABEL[item.source]} · {item.id}</span>
      <article className="ka-dossier-sheet">
        <header className="ka-dossier-head">
          <span>{SOURCE_TITLE[item.source]} · KNOWLEDGE DOSSIER</span>
          <span className="ka-dossier-ref">REF · {item.source}:{item.id}</span>
          <button className="ka-dossier-close" onClick={close} aria-label="Fermer le dossier">✕</button>
        </header>
        <div className="ka-dossier-body" ref={bodyRef}>
          <div className="ka-dossier-title">
            {back && <button className="ka-back" onClick={back.go}><ArrowLeft size={13} /> Retour à {back.label}</button>}
            <div className="ka-dossier-lead"><span className="ka-badge" data-source={item.source}>{SOURCE_LABEL[item.source]}</span><code className="ka-dossier-id">{item.id}</code></div>
            <h2 id="ka-dossier-title">{item.title}</h2>
            <p className="ka-dossier-signal">{item.categories.join(' / ')} · {item.signal}</p>
          </div>
          <KnowledgeRecord item={item} ctx={{ allItems, annotations, onOpen, onOpenRef }}
            enriched={mitre} pending={item.source === 'MITRE' && !mitre && !mitreError} failed={mitreError} kev={kev} epss={epss} analyst={analyst} />
        </div>
        <footer className="ka-dossier-foot">
          <span>Knowledge Atlas · fiche de connaissance</span>
          <div className="ka-dossier-actions">
            {item.source === 'CVE' && <>
              <a href={`https://nvd.nist.gov/vuln/detail/${item.id}`} target="_blank" rel="noopener noreferrer">NVD <ExternalLink size={13} /></a>
              <button onClick={() => props.onEditCVE(item)}><FilePenLine size={13} /> Modifier</button>
              <button className="is-danger" onClick={() => setConfirm('cve')}><Trash2 size={13} /> Supprimer</button>
            </>}
            {item.source === 'MITRE' && <a href={attackUrl(item, mitre)} target="_blank" rel="noopener noreferrer">ATT&amp;CK OFFICIEL <ExternalLink size={13} /></a>}
          </div>
        </footer>
      </article>
      </div>
      <ConfirmModal open={confirm !== null} title={confirm === 'cve' ? 'SUPPRIMER CETTE CVE ?' : 'RÉINITIALISER L’ANNOTATION ?'}
        message={confirm === 'cve' ? `${item.id} sera supprimée définitivement.` : 'Les notes personnelles de cette fiche seront supprimées.'}
        confirmLabel={confirm === 'cve' ? 'SUPPRIMER' : 'RÉINITIALISER'} danger onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          const kind = confirm; setConfirm(null)
          if (kind === 'cve') { await props.onDeleteCVE(item); return }
          const ref = cloakRef(item)
          try { await cloakAnnotationsApi.deleteByRef(ref); setEditRequested(false); props.onAnnotationDeleted(ref); toast.success('Annotation supprimée') }
          catch { toast.error('Erreur lors de la suppression') }
        }} />
    </dialog>, document.body)
}
