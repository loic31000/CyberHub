// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import InvestigationList from './InvestigationList'
import { investigationApi } from '@/api/client'
import type { Investigation, InvestigationListResponse } from '@/types/investigation'

vi.mock('@/api/client', () => ({ investigationApi: { list: vi.fn(), create: vi.fn(), delete: vi.fn() } }))
vi.mock('@/store/toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))

// Fictional cases only.
const inv = (id: number, title: string, status: Investigation['status'] = 'open', tags = ''): Investigation => ({
  id, title, description: `Fictional case ${id}`, status, tags, created_at: '2026-10-20T10:00:00Z', updated_at: '2026-10-22T10:00:00Z',
})
const page = (items: Investigation[], total = items.length): InvestigationListResponse => ({ items, total, page: 1, limit: 50 })
const deferred = <T,>() => { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
const list = vi.mocked(investigationApi.list)
const renderList = () => render(<MemoryRouter><InvestigationList /></MemoryRouter>)

describe('Investigations 2026 — liste', () => {
  beforeEach(() => vi.useRealTimers())
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('affiche les dossiers avec statut, tags et lien vers la fiche', async () => {
    list.mockResolvedValue(page([inv(12, 'Détournement AS64500', 'open', 'bgp, réseau'), inv(4, 'Revue des accès', 'archived')]))
    renderList()
    const link = await screen.findByRole('link', { name: 'Détournement AS64500' })
    expect(link.getAttribute('href')).toBe('/investigations/12')
    const row = link.closest('li') as HTMLElement
    expect(within(row).getByText('Ouverte')).toBeTruthy()
    expect(within(row).getByText('bgp')).toBeTruthy()
    expect(within(row).getByText('réseau')).toBeTruthy()
    expect(screen.getByText('2 DOSSIERS')).toBeTruthy()
  })

  it("ignore une réponse ancienne arrivée après un changement de filtre", async () => {
    const stale = deferred<InvestigationListResponse>()
    list.mockReturnValueOnce(stale.promise).mockResolvedValueOnce(page([inv(2, 'Dossier archivé', 'archived')]))
    renderList()
    fireEvent.click(within(screen.getByRole('group', { name: 'Filtrer par statut' })).getByRole('button', { name: /Archivée/ }))
    await screen.findByText('Dossier archivé')
    await act(async () => { stale.resolve(page([inv(1, 'Réponse périmée')])) })
    expect(screen.queryByText('Réponse périmée')).toBeNull()
    expect(list.mock.calls[1][0]).toMatchObject({ status: 'archived', page: 1 })
  })

  it('envoie une seule recherche quand la saisie se termine', async () => {
    list.mockResolvedValue(page([]))
    renderList()
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1))
    const field = screen.getByLabelText('Rechercher une investigation')
    for (const value of ['p', 'ph', 'phish']) fireEvent.change(field, { target: { value } })
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2), { timeout: 1000 })
    await new Promise(r => setTimeout(r, 400))
    expect(list).toHaveBeenCalledTimes(2)
    expect(list.mock.calls[1][0]).toMatchObject({ q: 'phish' })
  })

  it("distingue l'erreur, la liste vide et l'absence de résultat filtré", async () => {
    list.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(page([])).mockResolvedValueOnce(page([]))
    renderList()
    expect((await screen.findByRole('alert')).textContent).toContain('Impossible de charger les investigations')
    fireEvent.click(screen.getByRole('button', { name: /Réessayer/ }))
    expect(await screen.findByRole('heading', { name: 'Aucune investigation' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Clôturée/ }))
    expect(await screen.findByRole('heading', { name: 'Aucune investigation ne correspond' })).toBeTruthy()
  })

  it('crée une investigation, affiche une erreur du backend, et recharge la liste', async () => {
    list.mockResolvedValue(page([]))
    vi.mocked(investigationApi.create)
      .mockRejectedValueOnce({ response: { data: { error: 'status invalide (open|closed|archived)' } } })
      .mockResolvedValueOnce(inv(30, 'Nouveau dossier'))
    renderList()
    await screen.findByRole('heading', { name: 'Aucune investigation' })
    fireEvent.click(screen.getAllByRole('button', { name: /NOUVELLE INVESTIGATION/ })[0])
    const dialog = screen.getByRole('dialog', { name: 'Nouvelle investigation' })
    fireEvent.click(within(dialog).getByRole('button', { name: /Créer l’investigation/ }))
    expect(within(dialog).getByRole('alert').textContent).toBe('Le titre est requis')
    fireEvent.change(within(dialog).getByLabelText('TITRE *'), { target: { value: '  Nouveau dossier ' } })
    fireEvent.change(within(dialog).getByLabelText('TAGS'), { target: { value: 'apt; apt, #phishing' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /Créer l’investigation/ }))
    expect((await within(dialog).findByRole('alert')).textContent).toBe('status invalide (open|closed|archived)')
    fireEvent.click(within(dialog).getByRole('button', { name: /Créer l’investigation/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(vi.mocked(investigationApi.create).mock.calls[1][0]).toEqual({ title: 'Nouveau dossier', description: '', status: 'open', tags: 'apt, phishing' })
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
  })

  it('ne supprime un dossier qu’après confirmation', async () => {
    list.mockResolvedValue(page([inv(12, 'Dossier à supprimer')]))
    vi.mocked(investigationApi.delete).mockResolvedValue({})
    renderList()
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer Dossier à supprimer' }))
    const dialog = screen.getByRole('dialog', { name: 'Supprimer l’investigation ?' })
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Annuler' }))
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(investigationApi.delete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer Dossier à supprimer' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(investigationApi.delete).toHaveBeenCalledWith(12))
  })

  it('charge les dossiers suivants au-delà de 50', async () => {
    const first = Array.from({ length: 50 }, (_, i) => inv(100 - i, `Dossier ${100 - i}`))
    list.mockResolvedValueOnce(page(first, 51)).mockResolvedValueOnce({ items: [inv(1, 'Dossier 1')], total: 51, page: 2, limit: 50 })
    renderList()
    fireEvent.click(await screen.findByRole('button', { name: 'Charger 1 de plus' }))
    expect(await screen.findByText('Dossier 1')).toBeTruthy()
    expect(list.mock.calls[1][0]).toMatchObject({ page: 2 })
    expect(screen.queryByRole('button', { name: /de plus/ })).toBeNull()
  })
})
