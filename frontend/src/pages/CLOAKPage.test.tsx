// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import CLOAKPage from './CLOAKPage'
import { cloakAnnotationsApi } from '@/api/client'
import { toast } from '@/store/toast'
import type { CloakAnnotation } from '@/types/cloakAnnotation'
import { procUrl } from '@/cloak26/parts'

vi.mock('@/api/client', () => ({ cloakAnnotationsApi: { list: vi.fn(), upsert: vi.fn(), deleteByRef: vi.fn() } }))
vi.mock('@/store/toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))

const api = vi.mocked(cloakAnnotationsApi)
const toastMock = vi.mocked(toast)
const data = {
  tactics: [
    { id: 0, name: 'Unknown', techniques: [{ id: 1, name: 'Hidden' }] },
    { id: 1, name: 'Anonymous browsing', techniques: [{
      id: 11, name: 'Layer isolation', description: 'Separate identities and browser state.', type: 'Technical',
      procedures: [{ id: 'p-1', name: 'Isolation guide', description: 'Read https://example.org/isolation). Then https://example.net/guide.', type: 'Technical' }],
      subtechniques: [{ id: 111, name: 'Container separation', description: 'Use isolated profiles.', type: 'Physical', procedures: [] }],
    }] },
    { id: 2, name: 'Anonymous communication', techniques: [{ id: 22, name: 'Relay selection', type: 'Behavioral' }] },
  ],
}
const annotation = (ref = 'tac-1:te-11'): CloakAnnotation => ({
  id: 7, technique_ref: ref, user_notes: 'checked', status: 'vu_en_lab', counter_notes: '', tags: '',
  created_at: '2026-10-25', updated_at: '2026-10-25',
})

let fetchMock: ReturnType<typeof vi.fn>
let mediaMatches = false
const originalOverflow = document.body.style.overflow

function setMediaMatch(matches: boolean) {
  mediaMatches = matches
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: mediaMatches,
    media: '(max-width: 1240px)',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })))
}

function renderReady(annotationList: CloakAnnotation[] = []) {
  fetchMock.mockResolvedValue({ ok: true, json: async () => data })
  api.list.mockResolvedValue(annotationList)
  return render(<CLOAKPage />)
}

async function waitReady() {
  await waitFor(() => expect(document.querySelector('.ck26-tech-main')).toBeTruthy())
}

beforeEach(() => {
  vi.clearAllMocks()
  setMediaMatch(false)
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  document.body.style.overflow = ''
})

afterEach(() => {
  cleanup()
  document.body.style.overflow = originalOverflow
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('CLOAK 2026', () => {
  it('extracts valid HTTP links, trims punctuation and leaves malformed URL-like text unlinked', () => {
    expect(procUrl('Read https://example.org/path.')).toEqual({
      url: 'https://example.org/path', urls: ['https://example.org/path'], clean: 'Read',
    })
    expect(procUrl('plain procedure text')).toEqual({ urls: [], clean: 'plain procedure text' })
    expect(procUrl('broken http://[::1/path and ftp://example.org')).toEqual({
      urls: [], clean: 'broken http://[::1/path and ftp://example.org',
    })
  })

  it('loads the framework, ignores Unknown as the active tactic and renders procedure sources safely', async () => {
    renderReady()
    await waitReady()
    expect(screen.getByRole('heading', { name: 'Anonymous browsing' })).toBeTruthy()
    expect(screen.queryByText('Hidden')).toBeNull()
    fireEvent.click(document.querySelector('.ck26-tech-main') as HTMLButtonElement)
    await screen.findByRole('dialog', { name: 'Inspecteur' })
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.ck26-proc-link'))
    expect(links.map(link => link.getAttribute('href'))).toEqual(['https://example.org/isolation', 'https://example.net/guide'])
    links.forEach(link => expect(link.getAttribute('rel')).toBe('noopener noreferrer'))
  })

  it('ignores a late JSON response after the page unmounts', async () => {
    let resolveFetch!: (response: { ok: boolean; json: () => Promise<unknown> }) => void
    fetchMock.mockImplementation(() => new Promise(resolve => { resolveFetch = resolve }))
    const { unmount } = render(<CLOAKPage />)
    unmount()
    await act(async () => resolveFetch({ ok: true, json: async () => data }))
    expect(screen.queryByRole('button', { name: /Annoter/ })).toBeNull()
  })

  it('shows a useful error for failed HTTP and malformed JSON without crashing', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, json: async () => ({ wrong: [] }) })
    const { unmount } = render(<CLOAKPage />)
    expect(await screen.findByRole('alert')).toBeTruthy()
    unmount()
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ tactics: [null, { id: 'bad', name: 'bad', techniques: [] }] }) })
    render(<CLOAKPage />)
    await waitFor(() => expect(document.querySelector('.ck26-state')).toBeTruthy())
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('normalizes incomplete records and safely displays unknown levels and missing arrays/descriptions', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ tactics: [{ id: 3, name: 'Odd', techniques: [{ id: 31, name: 'Uncatalogued', type: 'Unexpected', subtechniques: null }] }] }) })
    api.list.mockResolvedValue([{ ...annotation(), status: 'unexpected' as never }])
    render(<CLOAKPage />)
    expect(await screen.findByRole('button', { name: /Annoter Uncatalogued/ })).toBeTruthy()
    fireEvent.click(document.querySelector('.ck26-tech-main') as HTMLButtonElement)
    expect(await screen.findByRole('dialog', { name: 'Inspecteur' })).toBeTruthy()
    expect(document.querySelector('.ck26-prose')?.textContent).toBeTruthy()
  })

  it('keeps the framework usable and explains when personal annotations fail to load', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => data })
    api.list.mockRejectedValue(new Error('offline'))
    render(<CLOAKPage />)
    expect(await screen.findByText(/annotations personnelles/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Annoter Layer isolation/ })).toBeTruthy()
  })

  it('filters by technique or sub-technique and closes the inspector only when its selection disappears', async () => {
    renderReady()
    await waitReady()
    fireEvent.click(document.querySelector('.ck26-tech-main') as HTMLButtonElement)
    await screen.findByRole('dialog', { name: 'Inspecteur' })
    fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher une technique' }), { target: { value: 'not present' } })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Inspecteur' })).toBeNull(), { timeout: 1000 })
    fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher une technique' }), { target: { value: '' } })
    await waitFor(() => expect(document.querySelector('.ck26-tech-main')).toBeTruthy())
    fireEvent.click(document.querySelector('[data-level-btn="Physical"]') as HTMLButtonElement)
    expect(document.querySelector('.ck26-tech-main')).toBeTruthy()
    fireEvent.click(document.querySelector('.ck26-tech-main') as HTMLButtonElement)
    expect(await screen.findByRole('dialog', { name: 'Inspecteur' })).toBeTruthy()
  })

  it('debounces search and reset restores the complete active registry', async () => {
    renderReady()
    await waitReady()
    fireEvent.click(screen.getByRole('button', { name: /Toutes les tactiques/ }))
    const search = screen.getByRole('searchbox', { name: 'Rechercher une technique' })
    fireEvent.change(search, { target: { value: 'relay' } })
    await waitFor(() => expect(document.querySelector('.ck26-tech-main')?.textContent).toContain('Relay selection'), { timeout: 1200 })
    fireEvent.click(screen.getByRole('button', { name: /Réinitialiser/ }))
    await waitFor(() => expect(document.querySelectorAll('.ck26-tech-main')).toHaveLength(2), { timeout: 1200 })
    expect((search as HTMLInputElement).value).toBe('')
  })

  it('opens sub-techniques and keeps parent and sub-technique annotation refs separate', async () => {
    api.upsert.mockImplementation(async request => annotation(request.technique_ref))
    renderReady()
    await waitReady()
    fireEvent.click(document.querySelector('.ck26-tech-main') as HTMLButtonElement)
    fireEvent.click(await screen.findByRole('button', { name: 'Annoter la fiche' }))
    fireEvent.change(screen.getByLabelText('Notes personnelles'), { target: { value: 'parent note' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }))
    await waitFor(() => expect(api.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ technique_ref: 'tac-1:te-11' })))

    fireEvent.click(document.querySelector('.ck26-tech-main') as HTMLButtonElement)
    fireEvent.click(await screen.findByRole('button', { name: /Container separation/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Annoter la fiche' }))
    fireEvent.change(screen.getByLabelText('Notes personnelles'), { target: { value: 'sub note' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }))
    await waitFor(() => expect(api.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ technique_ref: 'tac-1:te-11:sub-111' })))
  })

  it('saves once on double click, reports failure, and ignores a late result after close', async () => {
    let resolveSave!: (value: CloakAnnotation) => void
    api.upsert.mockImplementation(() => new Promise(resolve => { resolveSave = resolve }))
    renderReady()
    await waitReady()
    fireEvent.click(screen.getByRole('button', { name: /Annoter Layer isolation/ }))
    fireEvent.change(await screen.findByLabelText('Notes personnelles'), { target: { value: 'temporary' } })
    const save = screen.getByRole('button', { name: 'Sauvegarder' })
    fireEvent.click(save); fireEvent.click(save)
    expect(api.upsert).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Fermer le panneau' }))
    await act(async () => resolveSave(annotation()))
    expect(toastMock.success).not.toHaveBeenCalled()

    api.upsert.mockRejectedValueOnce(new Error('offline'))
    fireEvent.click(screen.getByRole('button', { name: /Annoter Layer isolation/ }))
    fireEvent.change(await screen.findByLabelText('Notes personnelles'), { target: { value: 'retry' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }))
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('Erreur lors de la sauvegarde'))
    expect(screen.getByRole('dialog', { name: 'Inspecteur' })).toBeTruthy()
  })

  it('opens ConfirmModal, cancels on Escape, confirms deletion and leaves the panel after API error', async () => {
    api.upsert.mockResolvedValue(annotation())
    api.deleteByRef.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('offline'))
    renderReady([annotation()])
    await waitReady()
    fireEvent.click(document.querySelector('.ck26-tech-main') as HTMLButtonElement)
    fireEvent.click(await screen.findByRole('button', { name: 'Annoter la fiche' }))
    fireEvent.click(await screen.findByRole('button', { name: /Réinitialiser/ }))
    expect(await screen.findByRole('alertdialog')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByRole('dialog', { name: 'Inspecteur' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Réinitialiser/ }))
    fireEvent.click(await within(await screen.findByRole('alertdialog')).findByRole('button', { name: /Réinitialiser/ }))
    await waitFor(() => expect(api.deleteByRef).toHaveBeenCalledWith('tac-1:te-11'))

    fireEvent.click(document.querySelector('.ck26-tech-main') as HTMLButtonElement)
    fireEvent.click(await screen.findByRole('button', { name: 'Annoter la fiche' }))
    fireEvent.change(await screen.findByLabelText('Notes personnelles'), { target: { value: 'restore annotation' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }))
    await waitFor(() => expect(screen.queryByLabelText('Notes personnelles')).toBeNull())
    fireEvent.click(document.querySelector('.ck26-tech-main') as HTMLButtonElement)
    fireEvent.click(await screen.findByRole('button', { name: 'Annoter la fiche' }))
    fireEvent.click(await screen.findByRole('button', { name: /Réinitialiser/ }))
    fireEvent.click(await within(await screen.findByRole('alertdialog')).findByRole('button', { name: /Réinitialiser/ }))
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('Erreur lors de la suppression'))
    expect(screen.getByRole('dialog', { name: 'Inspecteur' })).toBeTruthy()
  })

  it('locks body scroll, traps Tab, closes with Escape and restores trigger focus in overlay mode', async () => {
    setMediaMatch(true)
    renderReady()
    await waitReady()
    const trigger = document.querySelector('.ck26-tech-main') as HTMLButtonElement
    trigger.focus()
    fireEvent.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: 'Inspecteur' })
    expect(document.body.style.overflow).toBe('hidden')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect((document.querySelector('.ck26-registry') as HTMLElement).inert).toBe(true)
    const focusables = within(dialog).getAllByRole('button')
    focusables[focusables.length - 1].focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(dialog.contains(document.activeElement)).toBe(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Inspecteur' })).toBeNull())
    expect(document.body.style.overflow).toBe('')
    expect(document.querySelector('.ck26-registry')?.hasAttribute('inert')).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })
})
