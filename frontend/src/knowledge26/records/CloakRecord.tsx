import type { ReactNode } from 'react'
import type { CloakProcedure, CloakSubTechnique } from '@/types/cloak'
import { cloakRef, type KnowledgeItem } from '../model'
import Learn from '@/learning/Learn'
import type { LearningEvidence } from '@/learning/types'
import { ANNOTATION_LABEL, Fact, Facts, Prose, RefButton, Section, type RecordContext } from './parts'

/*
 * CLOAK dossier. A parent technique lists ALL its sub-techniques like the
 * former module — ID, name, type, summary and annotation status — and each
 * opens in this same dossier (the dossier then offers "← Retour à …"). The
 * analyst section shows the annotation, or the editor slot when editing.
 */

const procUrls = (description = '') => [...new Set((description.match(/https?:\/\/[^\s<>"']+/g) ?? []).map(url => url.replace(/[.,;!?)]+$/, '')))]

/* Learning evidence (#78): the dataset fields of this entry and the local annotation, nothing inferred. */
function cloakEvidence(item: KnowledgeItem, subs: number, procs: { description?: string }[], status: string | undefined, annotated: boolean): LearningEvidence[] {
  const type = item.signal?.trim()
  const links = procs.reduce((sum, procedure) => sum + procUrls(procedure.description).length, 0)
  return [
    { label: 'Référence', value: item.id, source: 'CLOAK' },
    ...(item.categories[0] ? [{ label: 'Tactique', value: item.categories[0] }] : []),
    ...(type && type !== 'Non renseigné' ? [{ label: 'Type', value: type }] : []),
    { label: 'Niveau', value: item.metadata.find(m => m[0] === 'Niveau')?.[1] || item.facets.kind },
    ...(subs ? [{ label: 'Sous-techniques', value: String(subs) }] : []),
    ...(procs.length ? [{ label: 'Procédures', value: String(procs.length) }] : []),
    ...(links ? [{ label: 'Liens externes', value: String(links) }] : []),
    ...(annotated ? [{ label: 'Annotation', value: status ? ANNOTATION_LABEL[status] ?? status : 'Notes présentes', source: 'Annotation locale CyberHub' }] : []),
  ]
}

export default function CloakRecord({ item, ctx, analyst }: { item: KnowledgeItem; ctx: RecordContext; analyst: ReactNode }) {
  const entry = item.original as { subtechniques?: CloakSubTechnique[]; procedures?: CloakProcedure[]; __parentId?: number }
  const subs = entry.subtechniques ?? []
  const procs = item.procedures ?? entry.procedures ?? []
  const ref = cloakRef(item)
  const sameTactic = (candidate: KnowledgeItem) => candidate.source === 'CLOAK' && candidate.categories[0] === item.categories[0]
  const annotation = ctx.annotations.get(ref)
  const parent = entry.__parentId ? ctx.allItems.find(candidate => sameTactic(candidate) && candidate.id === `TE-${entry.__parentId}`) : null

  return <>
    <Section index="01" title="OVERVIEW">
      <Prose>{item.description?.trim() || 'Description non disponible.'}</Prose>
      <Facts>
        <Fact label="Tactique">{item.categories[0] || '—'}</Fact>
        <Fact label="Niveau">{item.facets.kind}</Fact>
        <Fact label="Type">{item.signal || '—'}</Fact>
        {parent && <Fact label="Technique parent"><RefButton id={parent.id} label={parent.title} onClick={() => ctx.onOpen(parent)} /></Fact>}
      </Facts>
      <Learn id="cloak" evidence={cloakEvidence(item, subs.length, procs, annotation?.status, Boolean(annotation))} />
    </Section>

    {(subs.length > 0 || procs.length > 0) && <Section index="02" title={subs.length && procs.length ? 'SUB-TECHNIQUES · PROCEDURES' : subs.length ? 'SUB-TECHNIQUES' : 'PROCEDURES'}
      lead={subs.length && procs.length ? 'Variantes de cette technique et procédures (outils, services) référencées par CLOAK.' : subs.length ? 'Variantes de cette technique référencées par CLOAK.' : 'Procédures (outils, services) référencées par CLOAK.'}>
      {subs.length > 0 && <>
        <h4 className="ka-subhead">SOUS-TECHNIQUES · {subs.length}</h4>
        <ol className="ka-subtable">{subs.map(sub => {
          const child = ctx.allItems.find(candidate => sameTactic(candidate) && candidate.id === `ST-${sub.id}`)
          const status = ctx.annotations.get(`${ref}:sub-${sub.id}`)?.status
          const cells = <>
            <code>ST-{sub.id}</code>
            <span className="ka-subtable-name"><strong>{sub.name}</strong>{sub.description && <small>{sub.description}</small>}</span>
            <span className="ka-subtable-type">{sub.type || '—'}</span>
            <span className={`ka-subtable-status${status ? ' is-annotated' : ''}`}>{status ? ANNOTATION_LABEL[status] : 'Non annoté'}</span>
          </>
          return <li key={sub.id}>{child
            ? <button type="button" onClick={() => ctx.onOpen(child)}>{cells}<i>OUVRIR ↗</i></button>
            : <div>{cells}<i /></div>}</li>
        })}</ol>
      </>}
      {procs.length > 0 && <>
        <h4 className="ka-subhead">PROCÉDURES / OUTILS · {procs.length}</h4>
        <ol className="ka-procedures">{procs.map((procedure, index) => {
          const urls = procUrls(procedure.description)
          return <li key={index}>
            <h5>{procedure.name}{urls.length > 0 && <span>{urls.map((url, n) => <a key={url} href={url} target="_blank" rel="noopener noreferrer">Source{urls.length > 1 ? ` ${n + 1}` : ''} ↗</a>)}</span>}</h5>
            {procedure.description && <p>{procedure.description.replace(/https?:\/\/\S+/g, '').trim()}</p>}
          </li>
        })}</ol>
      </>}
    </Section>}

    <Section index={subs.length || procs.length ? '03' : '02'} title="ANNOTATION" lead="Annotation locale de l’analyste : statut, notes, contre-mesures, tags.">{analyst}</Section>
  </>
}
