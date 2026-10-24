import type { Playbook, PlaybookStep } from '@/types'

/* Fictional playbooks for the tests only; nothing here comes from the Docker database. */

export const step = (id: number, order: number, content: string, checked = false, playbookId = 1): PlaybookStep => ({
  id, playbook_id: playbookId, order, content, checked,
})

export const playbook = (id: number, title: string, scenario: string, steps: PlaybookStep[], description = `Procédure fictive ${id}`): Playbook => ({
  id, title, scenario, description, steps, created_at: '2026-10-20T10:00:00Z', updated_at: '2026-10-22T10:00:00Z',
})

export const deferred = <T,>() => {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
