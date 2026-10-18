// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import OSINTRunner from './OSINTRunner'
import { osintWmnApi } from '@/api/client'
import { toast } from '@/store/toast'
import type { OSINTJobDetail, OSINTJobSummary } from '@/types/osint'

vi.mock('@/api/client', () => ({
  osintWmnApi: { getMeta: vi.fn(), listJobs: vi.fn(), run: vi.fn(), getJob: vi.fn(), deleteJob: vi.fn(), importIoc: vi.fn(), updateDb: vi.fn() },
}))
vi.mock('@/store/toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))
// Visual pieces only: the polling under test lives in the page itself.
vi.mock('@/osint26/SignalGlobe', () => ({ default: () => null }))
vi.mock('@/osint26/OsintMotif', () => ({ default: () => null }))
vi.mock('@/hero/ModuleHero', () => ({ ModuleHero: () => null }))

const api = vi.mocked(osintWmnApi)
// jsdom has no scrollIntoView; opening a report scrolls its command bar into view.
Element.prototype.scrollIntoView ??= vi.fn()

// Fictional operations only.
const summary = (id: number, username: string, status: OSINTJobSummary['status'] = 'running'): OSINTJobSummary => ({
  id, username, status, total_sites: 10, checked_sites: 0, found_count: 0,
  filter_category: '', duration: 0, launched_by: '', created_at: '2099-01-01T00:00:00Z',
})
const job = (id: number, username: string, status: OSINTJobSummary['status'], checked = 0): OSINTJobDetail => ({
  ...summary(id, username, status), checked_sites: checked, results: [],
})
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
// getJob answers from a per-job queue, in call order.
type Answer = OSINTJobDetail | Promise<OSINTJobDetail> | (() => Promise<OSINTJobDetail>)
const answers = new Map<number, Answer[]>()
const answer = (id: number, ...values: Answer[]) => { answers.set(id, [...(answers.get(id) ?? []), ...values]) }
const nextAnswer = (id: number): Promise<OSINTJobDetail> => {
  const next = answers.get(id)?.shift()
  if (next === undefined) return new Promise(() => {})
  return typeof next === 'function' ? next() : Promise.resolve(next)
}
const polls = (id: number) => api.getJob.mock.calls.filter(([jobId]) => jobId === id).length
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))

const renderPage = () => render(<MemoryRouter initialEntries={['/osint']}><OSINTRunner /></MemoryRouter>)
async function launch(username: string, jobId: number) {
  api.run.mockResolvedValueOnce({ job_id: jobId })
  fireEvent.change(screen.getByLabelText('Pseudonyme ciblé'), { target: { value: username } })
  fireEvent.click(screen.getByRole('button', { name: 'Lancer la recherche' }))
  await advance(0)
}
async function follow(username: string) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Ouvrir l’opération @${username},`), hidden: true }))
  await advance(0)
}

describe('OSINT — suivi d’une recherche', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    answers.clear()
    api.getMeta.mockResolvedValue({ last_updated: '', site_count: 10, categories: [] })
    api.listJobs.mockResolvedValue({ jobs: [], total: 0 })
    api.getJob.mockImplementation(nextAnswer)
  })
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks() })

  it('interroge le serveur chaque seconde pendant le scan, puis affiche le rapport', async () => {
    renderPage()
    await advance(0)
    answer(7, job(7, 'alice_1', 'running', 3), job(7, 'alice_1', 'done', 10))
    await launch('alice_1', 7)
    expect(api.run).toHaveBeenCalledWith('alice_1', '')
    await advance(999)
    expect(polls(7)).toBe(0)
    await advance(1)
    expect(polls(7)).toBe(1)
    await advance(1000)
    expect(polls(7)).toBe(2)
    expect(toast.success).toHaveBeenCalledOnce()
    await advance(5000)
    expect(polls(7)).toBe(2)
  })

  it('attend la réponse en cours avant la requête suivante', async () => {
    renderPage()
    await advance(0)
    const slow = deferred<OSINTJobDetail>()
    answer(7, slow.promise, job(7, 'alice_1', 'running', 5))
    await launch('alice_1', 7)
    await advance(5000)
    expect(polls(7)).toBe(1)
    slow.resolve(job(7, 'alice_1', 'running', 2))
    await advance(1000)
    expect(polls(7)).toBe(2)
  })

  it('ne termine qu’une fois quand une réponse tardive arrive après la fin', async () => {
    renderPage()
    await advance(0)
    const first = deferred<OSINTJobDetail>()
    const second = deferred<OSINTJobDetail>()
    answer(7, first.promise, second.promise)
    await launch('alice_1', 7)
    await advance(2000)
    first.resolve(job(7, 'alice_1', 'done', 10))
    await advance(0)
    second.resolve(job(7, 'alice_1', 'done', 10))
    await advance(3000)
    expect(toast.success).toHaveBeenCalledOnce()
    expect(polls(7)).toBe(1)
  })

  it('ignore une réponse de l’ancienne opération après en avoir suivi une autre', async () => {
    api.listJobs.mockResolvedValue({ jobs: [summary(1, 'alpha'), summary(2, 'bravo')], total: 2 })
    renderPage()
    await advance(0)
    const late = deferred<OSINTJobDetail>()
    answer(1, job(1, 'alpha', 'running'), late.promise)
    answer(2, job(2, 'bravo', 'running'), job(2, 'bravo', 'running', 4))
    await follow('alpha')
    await advance(1000)
    expect(polls(1)).toBe(2)
    await follow('bravo')
    // The old operation's answer arrives while bravo is followed: it must change nothing.
    late.resolve(job(1, 'alpha', 'done', 10))
    await advance(0)
    expect(toast.success).not.toHaveBeenCalled()
    expect(screen.getByRole('region', { name: 'Recherche de bravo en cours' })).toBeTruthy()
    await advance(1000)
    expect(polls(2)).toBe(2)
  })

  it('ne fait plus rien une fois la page quittée', async () => {
    const { unmount } = renderPage()
    await advance(0)
    const inFlight = deferred<OSINTJobDetail>()
    answer(7, inFlight.promise)
    await launch('alice_1', 7)
    await advance(1000)
    unmount()
    inFlight.resolve(job(7, 'alice_1', 'done', 10))
    await advance(5000)
    expect(polls(7)).toBe(1)
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('signale un suivi interrompu après trois échecs, puis reprend', async () => {
    renderPage()
    await advance(0)
    const down = () => Promise.reject(new Error('fictional outage'))
    answer(7, down, down, down, job(7, 'alice_1', 'running', 6))
    await launch('alice_1', 7)
    await advance(2000)
    expect(screen.queryByText(/Suivi interrompu/)).toBeNull()
    await advance(1000)
    expect(screen.getByText(/Suivi interrompu/)).toBeTruthy()
    await advance(1000)
    expect(screen.queryByText(/Suivi interrompu/)).toBeNull()
    expect(polls(7)).toBe(4)
    await advance(1000)
    expect(polls(7)).toBe(5)
  })
})

// The AbortSignal given to each getJob call (polling and history), in call order.
const signalsOf = (id: number) => api.getJob.mock.calls.filter(([jobId]) => jobId === id).map((call) => (call as unknown[])[1] as AbortSignal | undefined)
// A request that never answers by itself.
const pending = () => new Promise<OSINTJobDetail>(() => {})
// A transport that honours cancellation: the request fails once its signal is aborted.
function rejectOnAbort() {
  api.getJob.mockImplementation(((id: number, signal?: AbortSignal) => {
    const next = nextAnswer(id)
    if (!signal) return next
    return new Promise<OSINTJobDetail>((resolve, reject) => {
      signal.addEventListener('abort', () => reject(Object.assign(new Error('canceled'), { name: 'CanceledError', code: 'ERR_CANCELED' })))
      next.then(resolve, reject)
    })
  }) as typeof api.getJob)
}
const click = (username: string) => fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Ouvrir l’opération @${username},`), hidden: true }))

describe('OSINT — annulation réseau du suivi', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    answers.clear()
    api.getMeta.mockResolvedValue({ last_updated: '', site_count: 10, categories: [] })
    api.listJobs.mockResolvedValue({ jobs: [summary(1, 'alpha'), summary(2, 'bravo')], total: 2 })
    api.getJob.mockImplementation(nextAnswer)
  })
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks() })

  it('donne à chaque requête de suivi son propre signal', async () => {
    renderPage()
    await advance(0)
    answer(7, job(7, 'alice_1', 'running', 2), job(7, 'alice_1', 'running', 4))
    await launch('alice_1', 7)
    await advance(2000)
    const [first, second] = signalsOf(7)
    expect(first).toBeInstanceOf(AbortSignal)
    expect(second).toBeInstanceOf(AbortSignal)
    expect(second).not.toBe(first)
    expect([first?.aborted, second?.aborted]).toEqual([false, false])
  })

  it('annule la requête en cours quand une autre opération est suivie', async () => {
    renderPage()
    await advance(0)
    answer(1, job(1, 'alpha', 'running'), pending)
    answer(2, job(2, 'bravo', 'running'))
    await follow('alpha')
    await advance(1000)
    const polling = signalsOf(1)[1]
    expect(polling?.aborted).toBe(false)
    await follow('bravo')
    expect(polling?.aborted).toBe(true)
  })

  it('le démontage annule la requête active, sans toast tardif', async () => {
    const { unmount } = renderPage()
    await advance(0)
    const inFlight = deferred<OSINTJobDetail>()
    answer(7, inFlight.promise)
    await launch('alice_1', 7)
    await advance(1000)
    unmount()
    expect(signalsOf(7)[0]?.aborted).toBe(true)
    // A transport ignoring the cancellation still answers: the answer is ignored.
    inFlight.resolve(job(7, 'alice_1', 'done', 10))
    await advance(3000)
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('ne compte pas une annulation comme un échec du suivi', async () => {
    rejectOnAbort()
    renderPage()
    await advance(0)
    const down = () => Promise.reject(new Error('fictional outage'))
    answer(1, job(1, 'alpha', 'running'), pending)
    answer(2, job(2, 'bravo', 'running'), down, down, down)
    await follow('alpha')
    await advance(1000)
    await follow('bravo')
    await advance(2000)
    expect(screen.queryByText(/Suivi interrompu/)).toBeNull()
    await advance(1000)
    expect(screen.getByText(/Suivi interrompu/)).toBeTruthy()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('ignore une réponse arrivée juste avant l’annulation', async () => {
    const { unmount } = renderPage()
    await advance(0)
    const inFlight = deferred<OSINTJobDetail>()
    answer(7, inFlight.promise)
    await launch('alice_1', 7)
    await advance(1000)
    inFlight.resolve(job(7, 'alice_1', 'done', 10))
    unmount()
    await advance(1000)
    expect(toast.success).not.toHaveBeenCalled()
  })
})

describe('OSINT — ouverture depuis l’historique', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    answers.clear()
    api.getMeta.mockResolvedValue({ last_updated: '', site_count: 10, categories: [] })
    api.getJob.mockImplementation(nextAnswer)
  })
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks() })
  const history = (...jobs: OSINTJobSummary[]) => api.listJobs.mockResolvedValue({ jobs, total: jobs.length })

  it('deux sélections rapides : seule la dernière est appliquée', async () => {
    history(summary(1, 'alpha', 'done'), summary(2, 'bravo', 'done'))
    renderPage()
    await advance(0)
    const alpha = deferred<OSINTJobDetail>()
    const bravo = deferred<OSINTJobDetail>()
    answer(1, alpha.promise)
    answer(2, bravo.promise)
    click('alpha')
    click('bravo')
    bravo.resolve(job(2, 'bravo', 'done', 10))
    await advance(0)
    alpha.resolve(job(1, 'alpha', 'done', 10))
    await advance(0)
    expect(screen.getByRole('region', { name: '@bravo' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: '@alpha' })).toBeNull()
  })

  it('une erreur de la première sélection ne remplace pas la seconde', async () => {
    history(summary(1, 'alpha', 'done'), summary(2, 'bravo', 'done'))
    renderPage()
    await advance(0)
    const alpha = deferred<OSINTJobDetail>()
    answer(1, alpha.promise)
    answer(2, job(2, 'bravo', 'done', 10))
    click('alpha')
    click('bravo')
    await advance(0)
    alpha.reject(new Error('fictional outage'))
    await advance(0)
    expect(toast.error).not.toHaveBeenCalled()
    expect(screen.getByRole('region', { name: '@bravo' })).toBeTruthy()
  })

  it('une ancienne réponse n’arrête pas le suivi de la dernière opération choisie', async () => {
    history(summary(1, 'alpha'), summary(2, 'bravo'))
    renderPage()
    await advance(0)
    const alpha = deferred<OSINTJobDetail>()
    answer(1, alpha.promise)
    answer(2, job(2, 'bravo', 'running'), job(2, 'bravo', 'running', 3))
    click('alpha')
    await follow('bravo')
    alpha.resolve(job(1, 'alpha', 'running'))
    await advance(1000)
    expect(polls(1)).toBe(1)
    expect(polls(2)).toBe(2)
    expect(screen.getByRole('region', { name: 'Recherche de bravo en cours' })).toBeTruthy()
  })

  it('une ouverture en attente n’interrompt pas une recherche lancée ensuite', async () => {
    history(summary(3, 'charlie', 'done'))
    renderPage()
    await advance(0)
    const charlie = deferred<OSINTJobDetail>()
    answer(3, charlie.promise)
    answer(7, job(7, 'alice_1', 'running', 2))
    click('charlie')
    await launch('alice_1', 7)
    charlie.resolve(job(3, 'charlie', 'done', 10))
    await advance(1000)
    expect(polls(7)).toBe(1)
    expect(screen.getByRole('region', { name: 'Recherche de alice_1 en cours' })).toBeTruthy()
  })

  it('une opération terminée s’ouvre en rapport, sans suivi', async () => {
    history(summary(1, 'alpha', 'done'))
    renderPage()
    await advance(0)
    answer(1, job(1, 'alpha', 'done', 10))
    await follow('alpha')
    await advance(3000)
    expect(screen.getByRole('region', { name: '@alpha' })).toBeTruthy()
    expect(polls(1)).toBe(1)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('le démontage invalide une ouverture en attente', async () => {
    history(summary(1, 'alpha'))
    const { unmount } = renderPage()
    await advance(0)
    const alpha = deferred<OSINTJobDetail>()
    answer(1, alpha.promise)
    click('alpha')
    unmount()
    expect(signalsOf(1)[0]?.aborted).toBe(true)
    alpha.reject(new Error('fictional outage'))
    await advance(3000)
    expect(toast.error).not.toHaveBeenCalled()
    expect(polls(1)).toBe(1)
  })
})
