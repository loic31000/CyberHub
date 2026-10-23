// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import IOCPage from './IOCPage'
import { iocApi } from '@/api/client'
import { useIocStore } from '@/store/useIocStore'

vi.mock('@/api/client', () => ({
  iocApi: { list: vi.fn(), stats: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), exportCSV: vi.fn() },
  correlationApi: { correlate: vi.fn() },
  hashApi: { analyze: vi.fn() },
}))

const list = vi.mocked(iocApi.list)
const queries = () => list.mock.calls.map(([params]) => params?.q)
const renderPage = () => render(<MemoryRouter initialEntries={['/ioc']}><IOCPage /></MemoryRouter>)
const type = (value: string) => fireEvent.change(screen.getByLabelText('Rechercher un IOC'), { target: { value } })

describe('IOC — recherche différée', () => {
  beforeEach(() => {
    useIocStore.setState({ iocs: [], total: 0, page: 1, limit: 50, stats: null, loading: false, error: null, filter: { status: 'active' } })
    list.mockResolvedValue({ items: [], total: 0, page: 1, limit: 50 })
    vi.mocked(iocApi.stats).mockResolvedValue({ total: 0, by_type: {} })
    vi.useFakeTimers()
  })
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks() })

  it('lance la recherche une fois le délai écoulé', async () => {
    renderPage()
    expect(queries()).toEqual([undefined])
    type('evil.example')
    await act(() => vi.advanceTimersByTimeAsync(349))
    expect(queries()).toEqual([undefined])
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(queries()).toEqual([undefined, 'evil.example'])
    expect(useIocStore.getState().filter.q).toBe('evil.example')
  })

  it("ne lance pas la recherche d'une saisie remplacée avant le délai", async () => {
    renderPage()
    type('evil')
    await act(() => vi.advanceTimersByTimeAsync(200))
    type('evil.example')
    await act(() => vi.advanceTimersByTimeAsync(350))
    expect(queries()).toEqual([undefined, 'evil.example'])
  })

  it('ne lance pas la recherche si la page est quittée avant le délai', async () => {
    const { unmount } = renderPage()
    type('evil.example')
    unmount()
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(queries()).toEqual([undefined])
    expect(useIocStore.getState().filter.q).toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })
})
