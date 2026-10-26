import { useEffect, useId, useState, type ReactNode } from 'react'
import { LEARNING, type LearningId } from './content'
import { useLearningMode } from './preferences'
import type { LearningEvidence } from './types'
import './learning.css'

/*
 * Contextual explanation of one concept, in the user's Learning mode:
 *  - off: nothing (the business data stays visible, it is not rendered here);
 *  - essential: one quiet line (definition + key limit) and a "Comprendre"
 *    keyboard disclosure;
 *  - guided: the same block opened on C'EST QUOI ? · POURQUOI ? · PREUVE ·
 *    LIMITE · ENSUITE; folding it back gives the essential line.
 * PREUVE only lists real facts passed by the caller; an empty list shows a
 * sober fallback and an absent list hides the section — nothing is invented.
 */

interface LearnProps {
  id: LearningId
  /** Real facts of the object on screen. Omit for a pure concept explanation. */
  evidence?: LearningEvidence[]
  /** Runtime follow-ups (e.g. the engine's next_actions); replace the generic ones. */
  next?: string[]
}

function Part({ tag, children }: { tag: string; children: ReactNode }) {
  return <div className="lr-part"><dt className="lr-tag">{tag}</dt><dd>{children}</dd></div>
}

export default function Learn({ id, evidence, next }: LearnProps) {
  const mode = useLearningMode()
  const [open, setOpen] = useState(mode === 'guided')
  const bodyId = useId()
  useEffect(() => { setOpen(mode === 'guided') }, [mode])
  if (mode === 'off') return null

  const entry = LEARNING[id]
  const steps = next ?? entry.next
  return <aside className="lr" data-mode={mode} data-open={open || undefined} aria-label={`Comprendre : ${entry.label}`}>
    <p className="lr-hint">
      <span className="lr-name">{entry.label}</span>
      {!open && <span className="lr-essential">{entry.essential}</span>}
      <button type="button" className="lr-toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(value => !value)}>
        {open ? 'Replier' : 'Comprendre'}
      </button>
    </p>
    <div id={bodyId} hidden={!open}>{open && <dl className="lr-body">
      <Part tag="C’EST QUOI ?">{entry.what}</Part>
      <Part tag="POURQUOI ?">{entry.why}</Part>
      {evidence && <Part tag="PREUVE">{evidence.length
        ? <ul className="lr-evidence">{evidence.map(item => <li key={item.label}>
            <span>{item.label}</span><b>{item.value}</b>{item.source && <small>{item.source}</small>}
          </li>)}</ul>
        : <span className="lr-empty">Aucune donnée disponible pour étayer cette lecture.</span>}
      </Part>}
      <Part tag="LIMITE">{entry.limit}</Part>
      {steps.length > 0 && <Part tag="ENSUITE"><ol className="lr-next">{steps.map(step => <li key={step}>{step}</li>)}</ol></Part>}
    </dl>}</div>
  </aside>
}
