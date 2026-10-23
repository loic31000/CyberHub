import { beforeEach, describe, expect, it, vi } from 'vitest'
import { iocApi } from '@/api/client'
import type { IOC, IOCListResponse, IOCStats } from '@/types/ioc'
import { useIocStore } from './useIocStore'

vi.mock('@/api/client', () => ({
  iocApi: {
    list: vi.fn(), stats: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), exportCSV: vi.fn(),
  },
}))

const api = {
  list: vi.mocked(iocApi.list),
  stats: vi.mocked(iocApi.stats),
  create: vi.mocked(iocApi.create),
  update: vi.mocked(iocApi.update),
  delete: vi.mocked(iocApi.delete),
}

const ioc = (id: number, value = `ioc-${id}`): IOC => ({
  id, value, type: 'domain', source: 'test', tlp: 'white', status: 'active',
  tags: '[]', notes: '', mitre_tech_id: '', created_at: '', updated_at: '',
})
const list = (items: IOC[], total = items.length, page = 1): IOCListResponse =>
  ({ items, total, page, limit: 50 })
const stats: IOCStats = { total: 1, by_type: { domain: 1 } }

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.resetAllMocks()
  useIocStore.setState({
    iocs: [], total: 0, page: 1, limit: 50, stats: null,
    loading: false, error: null, filter: { status: 'active' },
  })
  api.stats.mockResolvedValue(stats)
})

describe('IOC list requests', () => {
  it('keeps a new search when a slow page 2 returns, without ending loading early', async () => {
    const old = deferred<IOCListResponse>()
    const recent = deferred<IOCListResponse>()
    api.list.mockReturnValueOnce(old.promise).mockReturnValueOnce(recent.promise)

    useIocStore.getState().setPage(2)
    useIocStore.getState().setFilter({ q: 'recent' })
    expect(api.list.mock.calls.map(([p]) => [p?.page, p?.q])).toEqual([[2, undefined], [1, 'recent']])
    old.resolve(list([ioc(2)], 100, 2))
    await old.promise
    expect(useIocStore.getState().loading).toBe(true)
    expect(useIocStore.getState().iocs).toEqual([])
    expect(useIocStore.getState().total).toBe(0)

    recent.resolve(list([ioc(1)], 1))
    await recent.promise
    expect(useIocStore.getState()).toMatchObject({ iocs: [ioc(1)], total: 1, page: 1, error: null })
  })

  it('ignores two filters resolved out of order', async () => {
    const first = deferred<IOCListResponse>()
    const second = deferred<IOCListResponse>()
    api.list.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    useIocStore.getState().setFilter({ type: 'ip' })
    useIocStore.getState().setFilter({ type: 'domain' })
    expect(api.list.mock.calls.map(([p]) => p?.type)).toEqual(['ip', 'domain'])

    second.resolve(list([ioc(3)], 1))
    await second.promise
    first.resolve(list([ioc(4)], 42))
    await first.promise
    expect(useIocStore.getState().total).toBe(1)
    expect(useIocStore.getState()).toMatchObject({ iocs: [ioc(3)], loading: false, error: null })
  })

  it('ignores an old error after a newer success', async () => {
    const old = deferred<IOCListResponse>()
    const recent = deferred<IOCListResponse>()
    api.list.mockReturnValueOnce(old.promise).mockReturnValueOnce(recent.promise)
    void useIocStore.getState().fetchIocs()
    const current = useIocStore.getState().fetchIocs()
    recent.resolve(list([ioc(5)]))
    await current
    old.reject(new Error('old error'))
    await old.promise.catch(() => undefined)
    expect(useIocStore.getState().error).toBeNull()
    expect(useIocStore.getState()).toMatchObject({ iocs: [ioc(5)], total: 1, loading: false })
  })

  it('ignores an old success after a newer error', async () => {
    const old = deferred<IOCListResponse>()
    const recent = deferred<IOCListResponse>()
    api.list.mockReturnValueOnce(old.promise).mockReturnValueOnce(recent.promise)
    void useIocStore.getState().fetchIocs()
    const current = useIocStore.getState().fetchIocs()
    recent.reject(new Error('recent error'))
    await current
    old.resolve(list([ioc(6)]))
    await old.promise
    expect(useIocStore.getState().error).toContain('recent error')
    expect(useIocStore.getState()).toMatchObject({ iocs: [], total: 0, loading: false })
  })

  it('uses the latest page when changing page during a load', async () => {
    const first = deferred<IOCListResponse>()
    const second = deferred<IOCListResponse>()
    api.list.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    useIocStore.getState().setPage(2)
    useIocStore.getState().setPage(3)
    second.resolve(list([ioc(30)], 150, 3))
    await second.promise
    first.resolve(list([ioc(20)], 150, 2))
    await first.promise
    expect(useIocStore.getState().page).toBe(3)
    expect(useIocStore.getState().iocs).toEqual([ioc(30)])
  })

  it('refreshes after creation and rejects the pre-create GET', async () => {
    const old = deferred<IOCListResponse>()
    const refreshed = deferred<IOCListResponse>()
    api.list.mockReturnValueOnce(old.promise).mockReturnValueOnce(refreshed.promise)
    api.create.mockResolvedValue(ioc(7))
    void useIocStore.getState().fetchIocs()
    const creating = useIocStore.getState().createIoc({ type: 'domain', value: 'ioc-7' })
    await vi.waitFor(() => expect(api.list).toHaveBeenCalledTimes(2))
    old.resolve(list([]))
    await old.promise
    expect(useIocStore.getState().loading).toBe(true)
    refreshed.resolve(list([ioc(7)]))
    await creating
    expect(useIocStore.getState()).toMatchObject({ iocs: [ioc(7)], total: 1, loading: false })
    expect(api.stats).toHaveBeenCalledOnce()
  })

  it('does not restore an old IOC after an update during a GET', async () => {
    const old = deferred<IOCListResponse>()
    const refreshed = deferred<IOCListResponse>()
    useIocStore.setState({ iocs: [ioc(8)], total: 1 })
    api.list.mockReturnValueOnce(old.promise).mockReturnValueOnce(refreshed.promise)
    api.update.mockResolvedValue(ioc(8, 'updated'))
    void useIocStore.getState().fetchIocs()
    await useIocStore.getState().updateIoc(8, { value: 'updated' })
    // The local update applies at once; the GET in flight may predate it, so a new one replaces it.
    expect(useIocStore.getState().iocs).toEqual([ioc(8, 'updated')])
    expect(api.list).toHaveBeenCalledTimes(2)
    old.resolve(list([ioc(8)]))
    await old.promise
    expect(useIocStore.getState()).toMatchObject({ iocs: [ioc(8, 'updated')], loading: true })
    refreshed.resolve(list([ioc(8, 'updated')]))
    await refreshed.promise
    expect(useIocStore.getState()).toMatchObject({ iocs: [ioc(8, 'updated')], total: 1, loading: false, error: null })
  })

  it('does not resurrect a deleted IOC from an old GET', async () => {
    const old = deferred<IOCListResponse>()
    const refreshed = deferred<IOCListResponse>()
    useIocStore.setState({ iocs: [ioc(9), ioc(10)], total: 2 })
    api.list.mockReturnValueOnce(old.promise).mockReturnValueOnce(refreshed.promise)
    api.delete.mockResolvedValue(undefined)
    void useIocStore.getState().fetchIocs()
    await useIocStore.getState().deleteIoc(9)
    expect(useIocStore.getState()).toMatchObject({ iocs: [ioc(10)], total: 1 })
    old.resolve(list([ioc(9), ioc(10)]))
    await old.promise
    expect(useIocStore.getState()).toMatchObject({ iocs: [ioc(10)], total: 1, loading: true })
    refreshed.resolve(list([ioc(10)]))
    await refreshed.promise
    expect(useIocStore.getState()).toMatchObject({ iocs: [ioc(10)], total: 1, loading: false })
    expect(api.stats).toHaveBeenCalledOnce()
  })

  it('still loads the new filter when a mutation lands during its GET', async () => {
    const forFilter = deferred<IOCListResponse>()
    const refreshed = deferred<IOCListResponse>()
    useIocStore.setState({ iocs: [ioc(11), ioc(12)], total: 2 })
    api.list.mockReturnValueOnce(forFilter.promise).mockReturnValueOnce(refreshed.promise)
    api.delete.mockResolvedValue(undefined)
    useIocStore.getState().setFilter({ q: 'twelve' })
    await useIocStore.getState().deleteIoc(11)
    // The replacement GET asks for the current filter, and its result is applied.
    expect(api.list.mock.calls.map(([p]) => p?.q)).toEqual(['twelve', 'twelve'])
    forFilter.resolve(list([ioc(11), ioc(12)]))
    await forFilter.promise
    refreshed.resolve(list([ioc(12)]))
    await refreshed.promise
    expect(useIocStore.getState()).toMatchObject({ iocs: [ioc(12)], total: 1, loading: false, filter: { q: 'twelve' } })
  })

  it('keeps a plain local update when no GET is in flight', async () => {
    useIocStore.setState({ iocs: [ioc(13)], total: 1 })
    api.update.mockResolvedValue(ioc(13, 'updated'))
    await useIocStore.getState().updateIoc(13, { value: 'updated' })
    expect(api.list).not.toHaveBeenCalled()
    expect(useIocStore.getState()).toMatchObject({ iocs: [ioc(13, 'updated')], total: 1, loading: false })
  })

  it('applies an update that returns just after a GET carrying the old value', async () => {
    const before = deferred<IOCListResponse>()
    let finishUpdate!: (value: IOC) => void
    useIocStore.setState({ iocs: [ioc(16)], total: 1 })
    api.list.mockReturnValueOnce(before.promise)
    api.update.mockReturnValue(new Promise<IOC>((res) => { finishUpdate = res }))
    const updating = useIocStore.getState().updateIoc(16, { value: 'updated' })
    void useIocStore.getState().fetchIocs()
    before.resolve(list([ioc(16)], 1))
    await before.promise
    await vi.waitFor(() => expect(useIocStore.getState().loading).toBe(false))
    finishUpdate(ioc(16, 'updated'))
    await updating
    expect(api.list).toHaveBeenCalledOnce()
    expect(useIocStore.getState()).toMatchObject({ iocs: [ioc(16, 'updated')], total: 1, loading: false, error: null })
  })

  it('applies a deletion that returns just after a GET still listing the IOC', async () => {
    const before = deferred<IOCListResponse>()
    let finishDelete!: () => void
    useIocStore.setState({ iocs: [ioc(17), ioc(18)], total: 2 })
    api.list.mockReturnValueOnce(before.promise)
    api.delete.mockReturnValue(new Promise<void>((res) => { finishDelete = res }))
    const deleting = useIocStore.getState().deleteIoc(17)
    void useIocStore.getState().fetchIocs()
    before.resolve(list([ioc(17), ioc(18)], 2))
    await before.promise
    await vi.waitFor(() => expect(useIocStore.getState().loading).toBe(false))
    finishDelete()
    await deleting
    expect(api.list).toHaveBeenCalledOnce()
    expect(useIocStore.getState()).toMatchObject({ iocs: [ioc(18)], total: 1, loading: false, error: null })
  })

  it('leaves the GET in flight alone when a mutation fails', async () => {
    const current = deferred<IOCListResponse>()
    useIocStore.setState({ iocs: [ioc(19)], total: 1 })
    api.list.mockReturnValueOnce(current.promise)
    api.update.mockRejectedValue(new Error('update failed'))
    void useIocStore.getState().fetchIocs()
    await expect(useIocStore.getState().updateIoc(19, { value: 'updated' })).rejects.toThrow('update failed')
    current.resolve(list([ioc(19), ioc(20)], 2))
    await current.promise
    expect(api.list).toHaveBeenCalledOnce()
    expect(useIocStore.getState()).toMatchObject({ iocs: [ioc(19), ioc(20)], total: 2, loading: false, error: null })
  })

  it('does not count a deletion twice when the list already reflects it', async () => {
    const after = deferred<IOCListResponse>()
    useIocStore.setState({ iocs: [ioc(14), ioc(15)], total: 2 })
    api.list.mockReturnValueOnce(after.promise)
    let finishDelete!: () => void
    api.delete.mockReturnValue(new Promise<void>((res) => { finishDelete = res }))
    const deleting = useIocStore.getState().deleteIoc(14)
    void useIocStore.getState().fetchIocs()
    // The server deleted it already: the GET answers before the DELETE does.
    after.resolve(list([ioc(15)], 1))
    await after.promise
    await vi.waitFor(() => expect(useIocStore.getState().loading).toBe(false))
    finishDelete()
    await deleting
    expect(useIocStore.getState()).toMatchObject({ iocs: [ioc(15)], total: 1 })
  })
})
