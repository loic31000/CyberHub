import { create } from 'zustand'
import { iocApi } from '@/api/client'
import type { IOC, IOCCreatePayload, IOCFilter, IOCStats, IOCUpdatePayload } from '@/types/ioc'

interface IocState {
  iocs: IOC[]
  total: number
  page: number
  limit: number
  stats: IOCStats | null
  loading: boolean
  error: string | null
  filter: IOCFilter

  setFilter: (f: Partial<IOCFilter>) => void
  setPage: (page: number) => void
  fetchIocs: () => Promise<void>
  fetchStats: () => Promise<void>
  createIoc: (data: IOCCreatePayload) => Promise<IOC>
  updateIoc: (id: number, data: IOCUpdatePayload) => Promise<IOC>
  deleteIoc: (id: number) => Promise<void>
  exportCSV: () => Promise<void>
}

// Latest request wins: each fetchIocs() call takes a ticket as soon as it is
// made, and only the latest ticket may write iocs, total, loading or error.
let latestList = 0
let listInFlight = false

export const useIocStore = create<IocState>((set, get) => ({
  iocs: [],
  total: 0,
  page: 1,
  limit: 50,
  stats: null,
  loading: false,
  error: null,
  filter: { status: 'active' },

  setFilter: (f) => {
    set((s) => ({ filter: { ...s.filter, ...f }, page: 1 }))
    get().fetchIocs()
  },
  setPage: (page) => {
    set({ page })
    get().fetchIocs()
  },

  fetchIocs: async () => {
    const request = ++latestList
    listInFlight = true
    set({ loading: true, error: null })
    try {
      const { filter, page, limit } = get()
      const res = await iocApi.list({ ...filter, page, limit })
      if (request === latestList) set({ iocs: res.items, total: res.total, loading: false })
    } catch (e) {
      if (request === latestList) set({ error: String(e), loading: false })
    } finally {
      if (request === latestList) listInFlight = false
    }
  },

  fetchStats: async () => {
    try {
      const stats = await iocApi.stats()
      set({ stats })
    } catch {
      // stats non-bloquantes
    }
  },

  createIoc: async (data) => {
    const ioc = await iocApi.create(data)
    await get().fetchIocs()
    await get().fetchStats()
    return ioc
  },

  updateIoc: async (id, data) => {
    const ioc = await iocApi.update(id, data)
    set((s) => ({
      iocs: s.iocs.map((i) => (i.id === id ? ioc : i)),
    }))
    // A GET still in flight may predate the change: replace it by one for the current filter and page.
    if (listInFlight) void get().fetchIocs()
    return ioc
  },

  deleteIoc: async (id) => {
    await iocApi.delete(id)
    set((s) => ({
      iocs: s.iocs.filter((i) => i.id !== id),
      // A list fetched after the deletion no longer holds it nor counts it.
      total: s.iocs.some((i) => i.id === id) ? s.total - 1 : s.total,
    }))
    if (listInFlight) void get().fetchIocs()
    await get().fetchStats()
  },

  exportCSV: async () => {
    await iocApi.exportCSV()
  },
}))
