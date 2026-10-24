// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Tools from './Tools'
import { toolsApi } from '@/api/client'
import { makeTool } from '@/tools26/__fixtures__'

vi.mock('@/api/client', () => ({ toolsApi: { list: vi.fn(), getCategories: vi.fn() } }))
vi.mock('@/store/toast', () => ({ toast: { error: vi.fn() } }))

const api = vi.mocked(toolsApi)
const response = (tools = [makeTool()], totalPages = 1) => ({ tools, count: tools.length, total_pages: totalPages })
const renderList = () => render(<MemoryRouter><Tools /></MemoryRouter>)
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('Outils 2026 — liste', () => {
  beforeEach(() => {
    api.list.mockReset().mockResolvedValue(response())
    api.getCategories.mockReset().mockResolvedValue(['forensics', 'network'])
  })
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('charge la première page, expose la navigation et ouvre/ferme les filtres accessibles', async () => {
    api.list.mockResolvedValue(response([makeTool(1, { name: 'Nmap' })], 3))
    renderList()
    expect(await screen.findByRole('link', { name: 'Nmap' })).toBeTruthy()
    expect(api.list).toHaveBeenCalledWith({ category: '', os: '', search: '', sub_category: '', page: 1, limit: 18 })
    expect(screen.getByRole('link', { name: /Nouvel outil/ }).getAttribute('href')).toBe('/tools/new')
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeTruthy()

    const toggle = screen.getByRole('button', { name: 'Filtres' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(toggle.hasAttribute('aria-controls')).toBe(false)
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById(toggle.getAttribute('aria-controls')!)).toBeTruthy()
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })

  it('combine les filtres, revient en page 1 et efface tous les critères', async () => {
    api.list.mockResolvedValue(response([makeTool()], 3))
    renderList()
    await screen.findByRole('link', { name: 'Tool 1' })
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })))

    fireEvent.click(screen.getByRole('button', { name: 'Filtres' }))
    fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher un outil' }), { target: { value: 'nmap' } })
    fireEvent.click(screen.getByRole('group', { name: 'Catégorie' }).querySelector('button[data-cat="offensive"]')!)
    fireEvent.click(screen.getByRole('group', { name: 'OS' }).querySelectorAll('button')[1])
    fireEvent.change(screen.getByLabelText('Sous-catégorie'), { target: { value: 'network' } })

    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({
      category: 'offensive', os: 'windows', search: 'nmap', sub_category: 'network', page: 1, limit: 18,
    }))
    fireEvent.click(screen.getByRole('button', { name: 'Tout effacer' }))
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({
      category: '', os: '', search: '', sub_category: '', page: 1, limit: 18,
    }))
  })

  it('ignore les réponses obsolètes quand la recherche change rapidement', async () => {
    const oldRequest = deferred<ReturnType<typeof response>>()
    const currentRequest = deferred<ReturnType<typeof response>>()
    api.list.mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(currentRequest.promise)
    renderList()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher un outil' }), { target: { value: 'recent' } })
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2))

    currentRequest.resolve(response([makeTool(2, { name: 'Résultat récent' })]))
    expect(await screen.findByRole('link', { name: 'Résultat récent' })).toBeTruthy()
    oldRequest.resolve(response([makeTool(1, { name: 'Résultat périmé' })]))
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Résultat périmé' })).toBeNull())
    expect(screen.getByRole('link', { name: 'Résultat récent' })).toBeTruthy()
  })

  it('affiche les états erreur et vide avec réessai', async () => {
    api.list.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response([], 1))
    renderList()
    expect((await screen.findByRole('alert')).textContent).toContain('Impossible de charger les outils')
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByRole('heading', { name: 'Aucun outil trouvé' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /crée le premier outil/ }).getAttribute('href')).toBe('/tools/new')
  })
})
