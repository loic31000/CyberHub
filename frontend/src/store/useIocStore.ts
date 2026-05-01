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
  fetchIocs: () => Promise<void>
  fetchStats: () => Promise<void>
  createIoc: (data: IOCCreatePayload) => Promise<IOC>
  updateIoc: (id: number, data: IOCUpdatePayload) => Promise<IOC>
  deleteIoc: (id: number) => Promise<void>
  exportCSV: () => Promise<void>
}

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

  fetchIocs: async () => {
    set({ loading: true, error: null })
    try {
      const { filter, page, limit } = get()
      const res = await iocApi.list({ ...filter, page, limit })
      set({ iocs: res.items, total: res.total, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
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
    return ioc
  },

  deleteIoc: async (id) => {
    await iocApi.delete(id)
    set((s) => ({
      iocs: s.iocs.filter((i) => i.id !== id),
      total: s.total - 1,
    }))
    await get().fetchStats()
  },

  exportCSV: async () => {
    await iocApi.exportCSV()
  },
}))
