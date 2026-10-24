import type { PlaybookCreateRequest } from '@/types'

/*
 * The form's step editor as pure functions. Each draft keeps a client key so
 * React keeps focus and input state on the right row when steps move.
 */

export interface StepDraft { key: number; content: string }

export interface Draft {
  title: string
  scenario: string
  description: string
  steps: StepDraft[]
}

export const LIMITS = { title: 120, description: 1000, step: 500, steps: 100 } as const

let nextKey = 1
export const newStep = (content = ''): StepDraft => ({ key: nextKey++, content })

export const emptyDraft = (): Draft => ({ title: '', scenario: '', description: '', steps: [newStep()] })

export function insertStep(steps: StepDraft[], after: number, step = newStep()): StepDraft[] {
  return [...steps.slice(0, after + 1), step, ...steps.slice(after + 1)]
}

/* The last row is kept, emptied, so the editor never has nothing to type in. */
export function removeStep(steps: StepDraft[], index: number): StepDraft[] {
  const next = steps.filter((_, i) => i !== index)
  return next.length ? next : [newStep()]
}

export function moveStep(steps: StepDraft[], from: number, to: number): StepDraft[] {
  if (from === to || from < 0 || to < 0 || from >= steps.length || to >= steps.length) return steps
  const next = [...steps]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export const editStep = (steps: StepDraft[], index: number, content: string): StepDraft[] =>
  steps.map((s, i) => (i === index ? { ...s, content } : s))

export interface DraftErrors {
  title?: string
  description?: string
  steps?: string
  step?: Record<number, string>
}

/* Mirrors the backend (title required, min 2) plus limits that keep cards readable. */
export function validate(draft: Draft): DraftErrors {
  const errors: DraftErrors = {}
  const title = draft.title.trim()
  if (!title) errors.title = 'Le titre est requis'
  else if (title.length < 2) errors.title = 'Le titre doit contenir au moins 2 caractères'
  else if (title.length > LIMITS.title) errors.title = `${LIMITS.title} caractères au maximum`
  if (draft.description.trim().length > LIMITS.description) errors.description = `${LIMITS.description} caractères au maximum`

  const filled = draft.steps.filter(s => s.content.trim())
  if (!filled.length) errors.steps = 'Ajoutez au moins une étape'
  else if (filled.length > LIMITS.steps) errors.steps = `${LIMITS.steps} étapes au maximum`
  const step: Record<number, string> = {}
  draft.steps.forEach(s => { if (s.content.trim().length > LIMITS.step) step[s.key] = `${LIMITS.step} caractères au maximum` })
  if (Object.keys(step).length) errors.step = step
  return errors
}

export const hasErrors = (e: DraftErrors) => Boolean(e.title || e.description || e.steps || e.step)

/* The backend's create/update body: empty rows dropped, order renumbered from 1. */
export function toPayload(draft: Draft): PlaybookCreateRequest {
  return {
    title: draft.title.trim(),
    scenario: draft.scenario.trim().replace(/-+$/, ''),
    description: draft.description.trim(),
    steps: draft.steps
      .map(s => s.content.trim())
      .filter(Boolean)
      .map((content, i) => ({ content, order: i + 1 })),
  }
}

/* Two drafts are the same when they would save the same playbook. */
export const sameDraft = (a: Draft, b: Draft) => JSON.stringify(toPayload(a)) === JSON.stringify(toPayload(b))
