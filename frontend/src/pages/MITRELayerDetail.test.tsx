// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { attackLayerApi, mitreApi } from '@/api/client'
import type { MITRETactic, MITRETechnique, MITRETechniquesResponse } from '@/types'
import type { AttackLayer } from '@/types/attackLayer'
import MITRELayerDetail from './MITRELayerDetail'

vi.mock('@/api/client', () => ({
  attackLayerApi: { get: vi.fn(), update: vi.fn(), exportUrl: vi.fn() },
  mitreApi: { tactics: vi.fn(), techniques: vi.fn() },
}))
vi.mock('@/mitre/MitreCircuit', () => ({ default: () => null }))

const layer: AttackLayer = {
  id: 1, name: 'Layer de test', description: '', domain: 'enterprise-attack', version: '4.5',
  layer_data: '[]', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}
const tactics: MITRETactic[] = [
  { id: 1, tactic_id: 'TA0001', name: 'Initial Access', short_name: 'initial-access', description: '', url: '', display_order: 1, created_at: '' },
  { id: 2, tactic_id: 'TA0002', name: 'Execution', short_name: 'execution', description: '', url: '', display_order: 2, created_at: '' },
]
const tech = (id: string): MITRETechnique => ({
  id: Number(id.slice(1)), technique_id: id, name: `Technique ${id}`, tactics: '["initial-access"]',
  platforms: '[]', is_subtechnique: false, parent_id: '', url: '', created_at: '',
})
const response = (items: MITRETechnique[], total = items.length, page = 1): MITRETechniquesResponse =>
  ({ items, total, page, limit: 40 })
const pageOne = response(Array.from({ length: 40 }, (_, i) => tech(`T${1000 + i}`)), 80)
const pageTwo = response(Array.from({ length: 40 }, (_, i) => tech(`T${2000 + i}`)), 80, 2)
const found = response([tech('T1059')])

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const api = {
  get: vi.mocked(attackLayerApi.get),
  tactics: vi.mocked(mitreApi.tactics),
  techniques: vi.mocked(mitreApi.techniques),
}
const renderLayer = () => render(
  <MemoryRouter initialEntries={['/mitre/layers/1']}>
    <Routes><Route path="/mitre/layers/:id" element={<MITRELayerDetail />} /></Routes>
  </MemoryRouter>,
)
async function browse() {
  renderLayer()
  fireEvent.click(await screen.findByRole('tab', { name: /Parcourir la matrice/ }))
  await screen.findByRole('button', { name: /T1000.*ajouter au layer/ })
}
const search = (value: string) => fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher une technique' }), { target: { value } })
const nextPage = () => fireEvent.click(screen.getByRole('button', { name: /Suivant/ }))
const waitForSearch = async () => waitFor(() => expect(api.techniques.mock.calls.some(([p]) => p?.q === 'T1059')).toBe(true))

beforeEach(() => {
  localStorage.clear()
  api.get.mockResolvedValue(layer)
  api.tactics.mockResolvedValue(tactics)
  api.techniques.mockResolvedValue(pageOne)
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('MITRE Layers — dernières requêtes gagnantes', () => {
  it('ignore une page 2 lente après une recherche plus récente', async () => {
    const slow = deferred<MITRETechniquesResponse>()
    api.techniques.mockImplementation(p => p?.page === 2 ? slow.promise : Promise.resolve(p?.q ? found : pageOne))
    await browse()
    nextPage()
    search('T1059')
    await waitForSearch()
    expect(await screen.findByRole('button', { name: /T1059.*ajouter au layer/ })).toBeTruthy()
    await act(async () => slow.resolve(pageTwo))
    expect(screen.getAllByRole('button', { name: /ajouter au layer/ })).toHaveLength(1)
    expect(screen.queryByText('Page 2 / 2')).toBeNull()
  })

  it('ne montre pas une ancienne réponse pendant les 300 ms du debounce', async () => {
    const slow = deferred<MITRETechniquesResponse>()
    api.techniques.mockImplementation(p => p?.page === 2 ? slow.promise : Promise.resolve(p?.q ? found : pageOne))
    await browse()
    nextPage()
    search('T1059')
    await act(async () => slow.resolve(pageTwo))
    expect(screen.queryByRole('button', { name: /T2000.*ajouter au layer/ })).toBeNull()
    expect(screen.queryByText('Aucun résultat')).toBeNull()
    await waitForSearch()
    expect(await screen.findByRole('button', { name: /T1059.*ajouter au layer/ })).toBeTruthy()
  })

  it('conserve les 300 ms de debounce même si la recherche revient à sa valeur précédente', async () => {
    await browse()
    search('T1059')
    search('')
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(api.techniques).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(api.techniques).toHaveBeenCalledTimes(2))
    expect(api.techniques.mock.calls[1][0]?.q).toBeUndefined()
  })

  it('ignore une page obsolète lors de changements rapides de tactique et de page', async () => {
    const slow = deferred<MITRETechniquesResponse>()
    const tacticResult = response([tech('T3000')])
    api.techniques.mockImplementation(p => p?.page === 2 ? slow.promise : Promise.resolve(p?.tactic ? tacticResult : pageOne))
    await browse()
    nextPage()
    fireEvent.click(screen.getByRole('button', { name: /Initial Access.*TA0001/ }))
    expect(await screen.findByRole('button', { name: /T3000.*ajouter au layer/ })).toBeTruthy()
    await act(async () => slow.resolve(pageTwo))
    expect(screen.getAllByRole('button', { name: /ajouter au layer/ })).toHaveLength(1)
    expect(screen.queryByText('Page 2 / 2')).toBeNull()
  })

  it('affiche une erreur distincte et permet de réessayer la page échouée', async () => {
    api.techniques.mockImplementationOnce(() => Promise.resolve(pageOne))
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(pageTwo)
    await browse()
    nextPage()
    expect(await screen.findByText('Chargement des techniques impossible')).toBeTruthy()
    expect(screen.queryByText('Aucun résultat')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByRole('button', { name: /T2000.*ajouter au layer/ })).toBeTruthy()
    expect(api.techniques.mock.calls[api.techniques.mock.calls.length - 1]?.[0]?.page).toBe(2)
  })

  it('ignore une ancienne erreur après un résultat récent', async () => {
    const slow = deferred<MITRETechniquesResponse>()
    api.techniques.mockImplementation(p => p?.page === 2 ? slow.promise : Promise.resolve(p?.q ? found : pageOne))
    await browse()
    nextPage()
    search('T1059')
    await waitForSearch()
    expect(await screen.findByRole('button', { name: /T1059.*ajouter au layer/ })).toBeTruthy()
    await act(async () => slow.reject(new Error('old failure')))
    expect(screen.queryByText('Chargement des techniques impossible')).toBeNull()
    expect(screen.getByRole('button', { name: /T1059.*ajouter au layer/ })).toBeTruthy()
  })

  it('ignore une réponse après un changement d’onglet ou un démontage', async () => {
    const slow = deferred<MITRETechniquesResponse>()
    api.techniques.mockImplementation(p => p?.page === 2 ? slow.promise : Promise.resolve(pageOne))
    await browse()
    nextPage()
    fireEvent.click(screen.getByRole('tab', { name: /Sélectionnées/ }))
    await act(async () => slow.resolve(pageTwo))
    fireEvent.click(screen.getByRole('tab', { name: /Parcourir la matrice/ }))
    expect(await screen.findByRole('button', { name: /T1000.*ajouter au layer/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /T2000.*ajouter au layer/ })).toBeNull()
    const later = deferred<MITRETechniquesResponse>()
    api.techniques.mockImplementation(p => p?.page === 2 ? later.promise : Promise.resolve(pageOne))
    nextPage()
    cleanup()
    await act(async () => later.resolve(pageTwo))
  })

  it('préserve la sélection et le retrait sans changer le format du layer', async () => {
    await browse()
    fireEvent.click(screen.getByRole('button', { name: /T1000.*ajouter au layer/ }))
    expect(screen.getByRole('button', { name: /T1000.*retirer du layer/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Sélectionnées/ }))
    expect(screen.getByRole('button', { name: 'Retirer T1000 du layer' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retirer T1000 du layer' }))
    expect(await screen.findByText('Aucune technique dans ce layer')).toBeTruthy()
  })

  it('distingue réellement une réponse vide d’une erreur', async () => {
    api.techniques.mockResolvedValue(response([]))
    renderLayer()
    fireEvent.click(await screen.findByRole('tab', { name: /Parcourir la matrice/ }))
    expect(await screen.findByText('Aucun résultat')).toBeTruthy()
    expect(screen.queryByText('Chargement des techniques impossible')).toBeNull()
  })
})
