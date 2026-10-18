import { beforeEach, describe, expect, it, vi } from 'vitest'

// The HTTP instance the client creates, replaced to observe what reaches the transport.
const http = vi.hoisted(() => ({
  get: vi.fn(),
  interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
}))
vi.mock('axios', () => ({ default: { create: () => http } }))

import { osintWmnApi } from './client'

describe('osintWmnApi.getJob', () => {
  beforeEach(() => { http.get.mockReset() })

  it('transmet le signal d’annulation au transport HTTP', async () => {
    http.get.mockResolvedValue({ data: { id: 5 } })
    const controller = new AbortController()
    await expect(osintWmnApi.getJob(5, controller.signal)).resolves.toEqual({ id: 5 })
    expect(http.get).toHaveBeenCalledWith('/osint/jobs/5', { signal: controller.signal })
  })

  it('reste appelable sans signal', async () => {
    http.get.mockResolvedValue({ data: { id: 6 } })
    await expect(osintWmnApi.getJob(6)).resolves.toEqual({ id: 6 })
    expect(http.get).toHaveBeenCalledWith('/osint/jobs/6', { signal: undefined })
  })

  it('propage le rejet d’une requête annulée', async () => {
    const canceled = Object.assign(new Error('canceled'), { name: 'CanceledError', code: 'ERR_CANCELED' })
    http.get.mockRejectedValue(canceled)
    const controller = new AbortController()
    controller.abort()
    await expect(osintWmnApi.getJob(7, controller.signal)).rejects.toBe(canceled)
  })
})
