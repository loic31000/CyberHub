// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CVEList from './CVEList'
import { cveApi, cisaApi } from '@/api/client'
import type { CVEEntry } from '@/types'

vi.mock('@/api/client', () => ({
  cveApi: { list: vi.fn(), importNVD: vi.fn(), fetchFromNVD: vi.fn() },
  cisaApi: { batchCheckKEV: vi.fn(), checkKEV: vi.fn() },
}))

// Fictional entries only.
const cve = (id: number, cveId: string): CVEEntry => ({
  id, cve_id: cveId, description: `Fictional entry ${cveId}`, cvss_score: 7.5, severity: 'high',
  products: 'demo', status: 'new', notes: '', published_at: '2026-01-01T00:00:00Z', created_at: '2026-01-02T00:00:00Z',
} as CVEEntry)
const page = (cves: CVEEntry[], totalPages = 1) => ({ cves, count: cves.length, total_pages: totalPages })

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const renderList = (url = '/cve') => render(<MemoryRouter initialEntries={[url]}><CVEList /></MemoryRouter>)
const list = vi.mocked(cveApi.list)
const batch = vi.mocked(cisaApi.batchCheckKEV)
const check = vi.mocked(cisaApi.checkKEV)

describe('CVE Watch — liste', () => {
  beforeEach(() => {
    batch.mockResolvedValue({})
    check.mockResolvedValue({ exploited: false, entry: null })
  })
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('ignore une réponse ancienne arrivée après un changement de filtre', async () => {
    const stale = deferred<ReturnType<typeof page>>()
    list.mockReturnValueOnce(stale.promise as never).mockResolvedValueOnce(page([cve(2, 'CVE-2026-0002')]) as never)
    renderList()
    fireEvent.click(within(screen.getByRole('group', { name: 'Filtrer par sévérité' })).getByRole('button', { name: 'Critique' }))
    await screen.findByText('CVE-2026-0002')
    // The first request was cancelled, then answers late anyway.
    expect((list.mock.calls[0][1] as AbortSignal).aborted).toBe(true)
    stale.resolve(page([cve(1, 'CVE-2026-0001')]))
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByText('CVE-2026-0001')).toBeNull()
    expect(screen.getByText('CVE-2026-0002')).toBeTruthy()
    expect(list.mock.calls[1][0]).toMatchObject({ severity: 'critical', page: 1 })
  })

  it("ignore la page demandée avant un changement de filtre, même si elle répond en dernier", async () => {
    const stale = deferred<ReturnType<typeof page>>()
    list
      .mockResolvedValueOnce(page([cve(1, 'CVE-2026-0001')], 3) as never)
      .mockReturnValueOnce(stale.promise as never)
      .mockResolvedValueOnce(page([cve(3, 'CVE-2026-0003')]) as never)
    renderList()
    await screen.findByText('CVE-2026-0001')
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
    expect(list.mock.calls[1][0]).toMatchObject({ page: 2 })
    fireEvent.change(screen.getByLabelText('Filtrer par statut'), { target: { value: 'patched' } })
    await screen.findByText('CVE-2026-0003')
    stale.resolve(page([cve(2, 'CVE-2026-0002')], 3))
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByText('CVE-2026-0002')).toBeNull()
    expect(list.mock.calls[2][0]).toMatchObject({ status: 'patched', page: 1 })
  })

  it('affiche la liste sans attendre CISA KEV, puis le badge ; détails demandés pour les seules CVE signalées', async () => {
    const kev = deferred<Record<string, boolean>>()
    list.mockResolvedValue(page([cve(1, 'CVE-2026-0001'), cve(2, 'CVE-2026-0002'), cve(3, 'CVE-2026-0003')]) as never)
    batch.mockReturnValue(kev.promise as never)
    check.mockResolvedValue({ exploited: true, entry: { vulnerability_name: 'Fictional flaw' } as never })
    renderList()
    await screen.findByText('CVE-2026-0003')
    expect(screen.queryByText('KEV')).toBeNull()
    kev.resolve({ 'CVE-2026-0001': false, 'CVE-2026-0002': true, 'CVE-2026-0003': false })
    const badge = await screen.findByText('KEV')
    expect(batch).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(badge.closest('span')?.getAttribute('title')).toBe('Exploitée activement — Fictional flaw'))
    expect(check).toHaveBeenCalledTimes(1)
    expect(check.mock.calls[0][0]).toBe('CVE-2026-0002')
  })

  it("signale une erreur CISA KEV au lieu de laisser croire à l'absence d'exploitation", async () => {
    list.mockResolvedValue(page([cve(1, 'CVE-2026-0001')]) as never)
    batch.mockRejectedValue(new Error('network'))
    renderList()
    await screen.findByText('CVE-2026-0001')
    expect(await screen.findByText(/Statut CISA KEV indisponible/)).toBeTruthy()
    expect(screen.queryByText('KEV')).toBeNull()
  })

  it("distingue une erreur de chargement d'une liste vide, et permet de réessayer", async () => {
    list.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(page([cve(1, 'CVE-2026-0001')]) as never)
    renderList()
    expect((await screen.findByRole('alert')).textContent).toContain('Impossible de charger les CVE')
    expect(screen.queryByText('Aucune CVE trouvée')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    await screen.findByText('CVE-2026-0001')
  })

  it('applique le lien direct ?find= dès la première requête', async () => {
    list.mockResolvedValue(page([cve(1, 'CVE-2026-0001')]) as never)
    renderList('/cve?find=CVE-2026-0001')
    await screen.findByText('CVE-2026-0001')
    expect(list).toHaveBeenCalledTimes(1)
    expect(list.mock.calls[0][0]).toMatchObject({ search: 'CVE-2026-0001', page: 1 })
    expect((screen.getByLabelText('Rechercher une CVE') as HTMLInputElement).value).toBe('CVE-2026-0001')
  })

  it('résume la page affichée à partir des lignes reçues, sans métrique globale inventée', async () => {
    const critical = { ...cve(1, 'CVE-2026-0001'), severity: 'critical', cvss_score: 9.8 } as CVEEntry
    list.mockResolvedValue({ cves: [critical, cve(2, 'CVE-2026-0002'), cve(3, 'CVE-2026-0003')], count: 57, total_pages: 3 } as never)
    batch.mockResolvedValue({ 'CVE-2026-0001': true })
    renderList()
    const summary = await screen.findByRole('list', { name: 'Composition de cette page' })
    await waitFor(() => expect(summary.textContent).toContain('Exploitées (KEV) 1'))
    expect(summary.textContent).toContain('Critique 1')
    expect(summary.textContent).toContain('Élevée 2')
    expect(screen.getByText('57')).toBeTruthy()
    expect(screen.getByText('page 1 / 3')).toBeTruthy()
    // The badge still reads "KEV"; its meaning is spelled out for screen readers.
    expect(screen.getByText('KEV').closest('.cv26-kev-wrap')?.textContent).toContain('exploitée activement selon CISA')
    expect(screen.getByLabelText('CVSS 9.8 sur 10')).toBeTruthy()
  })

  it('envoie une seule requête pour une saisie rapide dans la recherche', async () => {
    list.mockResolvedValue(page([]) as never)
    renderList()
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1))
    const field = screen.getByLabelText('Rechercher une CVE')
    for (const value of ['l', 'lo', 'log', 'log4']) fireEvent.change(field, { target: { value } })
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2), { timeout: 1000 })
    await new Promise((r) => setTimeout(r, 400))
    expect(list).toHaveBeenCalledTimes(2)
    expect(list.mock.calls[1][0]).toMatchObject({ search: 'log4', page: 1 })
  })
})
