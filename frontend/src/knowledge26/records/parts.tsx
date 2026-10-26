import type { ReactNode } from 'react'
import type { CloakAnnotation } from '@/types/cloakAnnotation'
import type { KnowledgeItem, Source } from '../model'

/*
 * Editorial primitives of the dossier. A dossier reads as a knowledge sheet:
 * numbered sections (01 OVERVIEW, 02 INTELLIGENCE…), airy fact columns
 * separated by hairlines, prose — never cards nested in a card and never a
 * grid of twenty metadata boxes.
 */

export interface RecordContext {
  allItems: KnowledgeItem[]
  annotations: Map<string, CloakAnnotation>
  /** Opens another loaded record in the same dossier. */
  onOpen: (item: KnowledgeItem) => void
  /** Resolves source + ID inside Atlas (fetching ATT&CK techniques when needed). */
  onOpenRef: (source: Source, id: string) => void
}

/** `lead`: one short line saying what the section holds, when the title alone is not explicit enough. */
export function Section({ index, title, aside, lead, children }: { index: string; title: string; aside?: ReactNode; lead?: string; children: ReactNode }) {
  return <section className="ka-sec">
    <header className="ka-sec-head"><span className="ka-sec-index">{index}</span><h3>{title}</h3>{aside && <span className="ka-sec-aside">{aside}</span>}{lead && <p className="ka-sec-lead">{lead}</p>}</header>
    <div className="ka-sec-body">{children}</div>
  </section>
}

export function Facts({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <dl className={`ka-facts${wide ? ' is-wide' : ''}`}>{children}</dl>
}
export function Fact({ label, children, span }: { label: string; children: ReactNode; span?: boolean }) {
  return <div className={`ka-fact${span ? ' is-span' : ''}`}><dt>{label}</dt><dd>{children}</dd></div>
}

export function Prose({ children }: { children: ReactNode }) {
  return <p className="ka-prose">{children}</p>
}

export function Subhead({ children, count }: { children: ReactNode; count?: number }) {
  return <h4 className="ka-subhead">{children}{typeof count === 'number' && <span> · {count}</span>}</h4>
}

/** Internal reference: navigates inside Atlas instead of leaving for a legacy page. */
export function RefButton({ id, label, onClick }: { id: string; label?: string; onClick: () => void }) {
  return <button type="button" className="ka-ref" onClick={onClick} aria-label={`Ouvrir ${id}${label ? ` ${label}` : ''} dans Atlas`}>
    <code>{id}</code>{label && <span>{label}</span>}<i aria-hidden="true">↗</i>
  </button>
}

export const ANNOTATION_LABEL: Record<string, string> = { a_tester: 'À tester', vu_en_lab: 'Vu en lab', maitrise: 'Maîtrisé' }
