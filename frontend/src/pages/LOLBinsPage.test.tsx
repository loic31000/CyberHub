// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LOLBinsPage from './LOLBinsPage'
import { lolbinsApi } from '@/api/client'
import { toast } from '@/store/toast'
import type { LOLBin, LOLBinCategory, LOLBinsResponse } from '@/types/lolbins'

vi.mock('@/api/client', () => ({ lolbinsApi: { list: vi.fn(), getByName: vi.fn(), getCategories: vi.fn(), getByMitre: vi.fn() } }))

afterEach(() => { cleanup(); vi.clearAllMocks() })
const list = vi.mocked(lolbinsApi.list)
const getCategories = vi.mocked(lolbinsApi.getCategories)
const errorToast = vi.spyOn(toast, 'error')

const windows: LOLBin = {
  id: 1, name: 'CertUtil.exe', os: 'windows', description: 'Certificate utility', full_path: 'C:\\Windows\\System32\\certutil.exe',
  commands: JSON.stringify([{ Command: 'certutil.exe -urlcache {URL}', Description: 'Fetch a file', Usecase: 'Download', Privileges: 'User' }]),
  mitre_tech: '["T1105", "invalid-id"]', tags: '["Download:file", 2]', category: 'Download',
}
const linux: LOLBin = {
  id: 2, name: 'tar', os: 'linux', description: 'Archive utility', full_path: '/usr/bin/tar',
  commands: JSON.stringify([{ type: 'file-read', description: 'Read an archive', commands: 'tar -xf {FILE}' }]),
  mitre_tech: '[]', tags: '[]', category: 'file-read',
}
const categories: LOLBinCategory[] = [
  { os: 'windows', category: 'Download', count: 4 },
  { os: 'linux', category: 'file-read', count: 3 },
]
const response = (items: LOLBin[], total = items.length): LOLBinsResponse => ({
  items, total, win_count: 232, linux_count: 15,
})
const renderPage = () => render(<MemoryRouter><LOLBinsPage /></MemoryRouter>)

describe('LOLBinsPage', () => {
  beforeEach(() => {
    list.mockResolvedValue(response([windows]))
    getCategories.mockResolvedValue(categories)
  })

  it('distinguishes global OS counts, filtered totals and the current loaded page', async () => {
    list.mockResolvedValue(response(Array.from({ length: 100 }, (_, i) => ({ ...windows, id: i + 1, name: `Binary-${i + 1}` })), 232))
    renderPage()
    await waitFor(() => expect(document.body.textContent).toContain('100 affichés sur 232'))
    expect(screen.getByText(/247 BINAIRES.*WIN 232.*LIN 15/)).toBeTruthy()
    expect(list).toHaveBeenCalledWith({ os: 'windows', search: undefined, category: undefined, mitre: undefined })
  })

  it('loads categories, combines filters, resets them and switches OS parameters', async () => {
    renderPage()
    await screen.findByRole('button', { name: /CertUtil\.exe/ })
    const search = screen.getByRole('searchbox', { name: 'Rechercher un binaire' })
    const mitre = screen.getByRole('searchbox', { name: 'Filtrer par technique MITRE' })
    fireEvent.change(search, { target: { value: 'certutil' } })
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2), { timeout: 1500 })
    fireEvent.change(mitre, { target: { value: 'T1105' } })
    await waitFor(() => expect(list).toHaveBeenCalledTimes(3), { timeout: 1500 })
    fireEvent.change(screen.getByRole('combobox', { name: 'Catégorie' }), { target: { value: 'Download' } })
    await waitFor(() => expect(list).toHaveBeenCalledTimes(4), { timeout: 1500 })
    expect(list).toHaveBeenLastCalledWith({ os: 'windows', search: 'certutil', category: 'Download', mitre: 'T1105' })

    fireEvent.keyDown(screen.getByRole('tab', { name: /Windows/ }), { key: 'ArrowRight' })
    await waitFor(() => expect(list).toHaveBeenCalledTimes(5), { timeout: 1500 })
    expect(list).toHaveBeenLastCalledWith({ os: 'linux', search: 'certutil', category: undefined, mitre: 'T1105' })
    fireEvent.click(screen.getByRole('button', { name: /réinitialiser/i }))
    await waitFor(() => expect(list).toHaveBeenCalledTimes(6), { timeout: 1500 })
    expect(list).toHaveBeenLastCalledWith({ os: 'linux', search: undefined, category: undefined, mitre: undefined })
    expect(screen.getByRole('tab', { name: /Linux/ }).getAttribute('aria-selected')).toBe('true')
  })

  it('keeps the latest result when a previous search resolves later', async () => {
    let resolveInitial!: (value: LOLBinsResponse) => void
    let resolveSearch!: (value: LOLBinsResponse) => void
    list.mockImplementation(params => new Promise(resolve => {
      if (params?.search) resolveSearch = resolve
      else resolveInitial = resolve
    }))
    renderPage()
    await waitFor(() => expect(resolveInitial).toBeTypeOf('function'))
    fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher un binaire' }), { target: { value: 'latest' } })
    await waitFor(() => expect(resolveSearch).toBeTypeOf('function'), { timeout: 1500 })
    resolveSearch(response([{ ...linux, id: 8, name: 'Latest result' }], 1))
    expect(await screen.findByText('Latest result')).toBeTruthy()
    resolveInitial(response([{ ...windows, id: 9, name: 'Stale result' }], 1))
    await waitFor(() => expect(screen.queryByText('Stale result')).toBeNull())
    expect(screen.getByText('Latest result')).toBeTruthy()
  })

  it('opens a detail with safe parsed fields, links only valid ATT&CK IDs, and closes on OS change', async () => {
    renderPage()
    const opener = await screen.findByRole('button', { name: /CertUtil\.exe/ })
    opener.focus()
    fireEvent.click(opener)
    const dialog = await screen.findByRole('dialog', { name: 'CertUtil.exe' })
    expect((screen.getByText('Chemin complet').parentElement?.querySelector('pre') as HTMLElement).textContent).toBe(windows.full_path)
    expect(screen.getByRole('link', { name: 'T1105' }).getAttribute('href')).toBe('/mitre?id=T1105')
    expect(screen.getByText('invalid-id').closest('a')).toBeNull()
    expect(dialog.textContent).toContain('Download')
    expect(dialog.textContent).toContain('User')
    expect(dialog.textContent).toContain('Download:file')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect((document.querySelector('.lb26-frame') as HTMLElement).inert).toBe(true)
    fireEvent.click(screen.getByRole('tab', { name: /Linux/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('tab', { name: /Linux/ }).getAttribute('aria-selected')).toBe('true')
  })

  it('traps focus in the panel and restores the opener on Escape and scrim close', async () => {
    renderPage()
    const opener = await screen.findByRole('button', { name: /CertUtil\.exe/ })
    opener.focus()
    fireEvent.click(opener)
    const dialog = await screen.findByRole('dialog', { name: 'CertUtil.exe' })
    expect(document.activeElement).toBe(dialog)
    expect((document.querySelector('.lb26-frame') as HTMLElement).inert).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Copier la commande/ }))
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fermer le panneau' }))
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(opener)
    expect((document.querySelector('.lb26-frame') as HTMLElement).inert).toBe(false)
    expect(document.body.style.overflow).toBe('')

    fireEvent.click(opener)
    await screen.findByRole('dialog', { name: 'CertUtil.exe' })
    fireEvent.click(document.querySelector('.lb26-panel-scrim') as HTMLElement)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(opener)
  })

  it('shows a clear empty state when a filtered catalogue has no matches', async () => {
    list.mockResolvedValue(response([]))
    renderPage()
    expect(await screen.findByText('Ce catalogue est vide.')).toBeTruthy()
  })

  it('shows a retry action after list failure and a stable empty-commands message for malformed data', async () => {
    list.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(response([{ ...windows, commands: '{invalid' }]))
    renderPage()
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    fireEvent.click(await screen.findByRole('button', { name: /CertUtil\.exe/ }))
    expect(await screen.findByText('Aucune commande renseignée pour ce binaire.')).toBeTruthy()
    expect(errorToast).toHaveBeenCalledWith('Erreur de chargement des LOLBins')
  })
})
