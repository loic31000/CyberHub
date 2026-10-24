// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CTFList from './CTFList'
import { ctfApi } from '@/api/client'
import { makeCTF } from '@/ctf26/__fixtures__'

vi.mock('@/api/client', () => ({ ctfApi: { list: vi.fn() } }))
vi.mock('@/store/toast', () => ({ toast: { error: vi.fn() } }))
vi.mock('@/ctf26/CtfHero', () => ({ default: () => <h1>CTF Journal</h1> }))

const api = vi.mocked(ctfApi)
const response = (writeups = [makeCTF()], count = writeups.length, totalPages = 1) => ({ writeups, count, total_pages: totalPages })
const renderList = () => render(
  <MemoryRouter initialEntries={['/ctf']}>
    <Routes>
      <Route path="/ctf" element={<CTFList />} />
      <Route path="/ctf/new" element={<p>NEW WRITEUP</p>} />
      <Route path="/ctf/:id" element={<p>CTF REPORT</p>} />
    </Routes>
  </MemoryRouter>,
)
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('CTF 2026 — liste', () => {
  beforeEach(() => api.list.mockReset().mockResolvedValue(response()))
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('utilise le contrat de pagination du backend, navigue jusqu’à la dernière page et revient en page 1 avec les filtres', async () => {
    api.list.mockResolvedValue(response([makeCTF(1)], 31, 3))
    renderList()
    expect(await screen.findByRole('link', { name: 'Challenge 1' })).toBeTruthy()
    expect(api.list).toHaveBeenCalledWith({ platform: '', difficulty: '', search: '', page: 1, limit: 15 })
    expect(document.querySelector('.ct26-page-note')?.textContent).toContain('0 terminé')
    expect(document.querySelector('.ct26-register-head p')?.textContent).toContain('page 1 / 3')

    fireEvent.click(screen.getByRole('button', { name: '2' }))
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })))
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 })))

    api.list.mockResolvedValueOnce(response([makeCTF(2)], 1, 1))
    fireEvent.change(screen.getByRole('combobox', { name: 'Plateforme' }), { target: { value: 'TryHackMe' } })
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ platform: 'TryHackMe', difficulty: '', search: '', page: 1, limit: 15 }))
    expect(screen.queryByRole('button', { name: '3' })).toBeNull()
  })

  it('combine la recherche et les filtres, puis efface tout', async () => {
    api.list.mockResolvedValue(response([makeCTF()], 1, 1))
    renderList()
    await screen.findByRole('link', { name: 'Challenge 1' })
    fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher un writeup' }), { target: { value: 'machine' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Plateforme' }), { target: { value: 'Root-Me' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Difficulté' }), { target: { value: 'hard' } })
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ platform: 'Root-Me', difficulty: 'hard', search: 'machine', page: 1, limit: 15 }))
    fireEvent.click(screen.getByRole('button', { name: 'Effacer les filtres' }))
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ platform: '', difficulty: '', search: '', page: 1, limit: 15 }))
  })

  it('ouvre une fiche depuis son entrée du registre', async () => {
    api.list.mockResolvedValue(response([makeCTF(12, { title: 'Open this report' })], 1, 1))
    renderList()
    fireEvent.click(await screen.findByRole('link', { name: 'Open this report' }))
    expect(await screen.findByText('CTF REPORT')).toBeTruthy()
  })

  it('ignore les réponses réseau obsolètes lors d’un changement rapide de recherche', async () => {
    const oldRequest = deferred<ReturnType<typeof response>>()
    const currentRequest = deferred<ReturnType<typeof response>>()
    api.list.mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(currentRequest.promise)
    renderList()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher un writeup' }), { target: { value: 'newer' } })
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2))
    currentRequest.resolve(response([makeCTF(2, { title: 'Newer result' })]))
    expect(await screen.findByRole('link', { name: 'Newer result' })).toBeTruthy()
    oldRequest.resolve(response([makeCTF(1, { title: 'Stale result' })]))
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Stale result' })).toBeNull())
    expect(screen.getByRole('link', { name: 'Newer result' })).toBeTruthy()
  })

  it('affiche les états erreur, retry et vide; les actions Nouveau et fiche naviguent', async () => {
    api.list.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response([], 0, 0))
    renderList()
    expect(await screen.findByRole('alert')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByRole('heading', { name: 'Aucun writeup trouvé' })).toBeTruthy()
    fireEvent.click(screen.getByRole('link', { name: 'crée le premier writeup' }))
    expect(await screen.findByText('NEW WRITEUP')).toBeTruthy()
  })
})
