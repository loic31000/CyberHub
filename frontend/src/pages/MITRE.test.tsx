// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { mitreApi } from '@/api/client'
import type { MITRETechnique } from '@/types'
import MITRE from './MITRE'

vi.mock('@/api/client', () => ({
  mitreApi: { status: vi.fn(), tactics: vi.fn(), techniques: vi.fn(), technique: vi.fn() },
}))
vi.mock('@/mitre/MitreCircuit', () => ({ default: () => null }))

const technique = (id: string, full = false): MITRETechnique => ({
  id: Number(id.slice(1)), technique_id: id, name: `Technique ${id}`,
  description: full ? `Description complète ${id}` : undefined,
  tactics: '["initial-access"]', platforms: '[]', is_subtechnique: false,
  parent_id: '', url: '', created_at: '',
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(res => { resolve = res })
  return { promise, resolve }
}

const api = {
  status: vi.mocked(mitreApi.status),
  tactics: vi.mocked(mitreApi.tactics),
  techniques: vi.mocked(mitreApi.techniques),
  technique: vi.mocked(mitreApi.technique),
}

function Jump() {
  const navigate = useNavigate()
  return <>
    <button onClick={() => navigate('/mitre?technique=T1046')}>Ouvrir T1046</button>
    <button onClick={() => navigate('/mitre?technique=T1059')}>Ouvrir T1059</button>
  </>
}

function renderMitre(initialEntries: Parameters<typeof MemoryRouter>[0]['initialEntries'] = ['/mitre'], strict = false) {
  const tree = <MemoryRouter initialEntries={initialEntries}>
    <Jump />
    <Routes>
      <Route path="/ioc" element={<p>Investigation IOC</p>} />
      <Route path="/mitre" element={<MITRE />} />
    </Routes>
  </MemoryRouter>
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree)
}

beforeEach(() => {
  localStorage.clear()
  api.status.mockResolvedValue({ seeded: true, seeding: false, count: 855 })
  api.tactics.mockResolvedValue([])
  api.techniques.mockResolvedValue({ items: [technique('T1000')], total: 1, page: 1, limit: 60 })
  api.technique.mockImplementation(id => Promise.resolve(technique(id, true)))
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('MITRE — chargement du détail', () => {
  it.each(['/mitre?technique=T1046', '/mitre?id=T1046'])(
    'charge une seule fois une fiche complète via %s, même en StrictMode', async path => {
      renderMitre([path], true)
      expect(await screen.findByText('Description complète T1046')).toBeTruthy()
      await waitFor(() => expect(screen.getByRole('complementary', { name: 'Détail de T1046' }).getAttribute('aria-busy')).toBe('false'))
      expect(api.technique.mock.calls.map(([id]) => id)).toEqual(['T1046'])
    },
  )

  it('charge la fiche depuis la grille puis rend le focus à la carte avec Échap', async () => {
    renderMitre()
    const card = await screen.findByRole('button', { name: /T1000.*Technique T1000/ })
    card.focus()
    fireEvent.click(card)
    expect(await screen.findByText('Description complète T1000')).toBeTruthy()
    expect(api.technique.mock.calls.map(([id]) => id)).toEqual(['T1000'])
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Détail de T1000' })).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(card))
  })

  it('ignore une réponse tardive après un changement rapide du lien direct', async () => {
    const old = deferred<MITRETechnique>()
    api.technique.mockImplementation(id => id === 'T1046' ? old.promise : Promise.resolve(technique(id, true)))
    renderMitre(['/mitre?technique=T1046'])
    await waitFor(() => expect(api.technique).toHaveBeenCalledWith('T1046'))
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir T1059' }))
    expect(await screen.findByText('Description complète T1059')).toBeTruthy()
    await act(async () => old.resolve(technique('T1046', true)))
    expect(screen.getByRole('complementary', { name: 'Détail de T1059' })).toBeTruthy()
    expect(screen.queryByText('Description complète T1046')).toBeNull()
    expect(api.technique.mock.calls.map(([id]) => id)).toEqual(['T1046', 'T1059'])
  })

  it('ignore une ancienne réponse de la grille après une nouvelle sélection', async () => {
    const old = deferred<MITRETechnique>()
    api.techniques.mockResolvedValue({ items: [technique('T1000'), technique('T1001')], total: 2, page: 1, limit: 60 })
    api.technique.mockImplementation(id => id === 'T1000' ? old.promise : Promise.resolve(technique(id, true)))
    renderMitre()
    fireEvent.click(await screen.findByRole('button', { name: /T1000.*Technique T1000/ }))
    await waitFor(() => expect(api.technique).toHaveBeenCalledWith('T1000'))
    fireEvent.click(screen.getByRole('button', { name: /T1001.*Technique T1001/ }))
    expect(await screen.findByText('Description complète T1001')).toBeTruthy()
    await act(async () => old.resolve(technique('T1000', true)))
    expect(screen.getByRole('complementary', { name: 'Détail de T1001' })).toBeTruthy()
    expect(screen.queryByText('Description complète T1000')).toBeNull()
    expect(api.technique.mock.calls.map(([id]) => id)).toEqual(['T1000', 'T1001'])
  })

  it('conserve le retour vers IOC depuis une fiche ouverte par lien direct', async () => {
    renderMitre(['/ioc', { pathname: '/mitre', search: '?technique=T1046', state: { from: 'ioc' } }])
    expect(await screen.findByText('Description complète T1046')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: /Retour à l’investigation IOC/ })[0])
    expect(await screen.findByText('Investigation IOC')).toBeTruthy()
    expect(api.technique.mock.calls.map(([id]) => id)).toEqual(['T1046'])
  })
})
