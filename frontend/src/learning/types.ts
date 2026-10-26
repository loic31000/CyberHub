import type { ReactNode } from 'react'

/*
 * Learning / Explain (#78). Every complex object can answer the same five
 * questions: C'EST QUOI ? · POURQUOI ? · PREUVE · LIMITE · ENSUITE.
 * The static, versioned part (what / why / limit / next) lives in content.ts;
 * the evidence comes from the object on screen at runtime, never from prose.
 */

export const LEARNING_MODES = ['off', 'essential', 'guided'] as const
export type LearningMode = typeof LEARNING_MODES[number]

export interface LearningEntry {
  id: string
  /** Short concept name, used in headings and accessible labels. */
  label: string
  /** One line for the essential mode: the definition and its key limit, nothing more. */
  essential: string
  what: string
  why: string
  limit: string
  /** Generic follow-ups; a runtime `next` (e.g. the engine's next_actions) replaces them. */
  next: string[]
}

/** One real fact backing the explanation, with its provenance when known. */
export interface LearningEvidence {
  label: string
  value: ReactNode
  source?: string
}
