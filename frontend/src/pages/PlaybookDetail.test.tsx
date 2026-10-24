// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PlaybookDetail from './PlaybookDetail'
import { playbookApi } from '@/api/client'
import { toast } from '@/store/toast'
import type { PlaybookStep } from '@/types'
import { deferred, playbook, step } from '@/pb26/__fixtures__'

vi.mock('@/api/client', () => ({ playbookApi: { get: vi.fn(), toggleStep: vi.fn(), reset: vi.fn(), delete: vi.fn() } }))
vi.mock('@/store/toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))

const api = vi.mocked(playbookApi)
const fixture = () => playbook(7, 'Réponse Ransomware', 'ransomware', [
  step(11, 1, 'Isoler la machine', true, 7),
  step(12, 2, 'Prévenir le RSSI', false, 7),
  step(13, 3, 'Préserver les preuves', false, 7),
])
const renderAt = (path = '/playbooks/7') => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/playbooks/:id" element={<PlaybookDetail />} />
      <Route path="/playbooks" element={<p>INDEX</p>} />
    </Routes>
  </MemoryRouter>,
)
const box = (name: RegExp) => screen.getByRole('checkbox', { name })

describe('Playbooks 2026 — détail et checklist', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('affiche la checklist ordonnée et une progression calculée sur les étapes cochées', async () => {
    api.get.mockResolvedValue(fixture())
    renderAt()
    await screen.findByRole('heading', { name: 'Réponse Ransomware' })
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes.map(b => b.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false'])
    expect(screen.getByRole('img', { name: /1 étapes validées sur 3, 33 %/ })).toBeTruthy()
    expect(screen.getByText('n° 2')).toBeTruthy()
  })

  it('applique la valeur renvoyée par le serveur et met à jour la progression', async () => {
    api.get.mockResolvedValue(fixture())
    api.toggleStep.mockResolvedValue(step(12, 2, 'Prévenir le RSSI', true, 7))
    renderAt()
    await screen.findByRole('heading', { name: 'Réponse Ransomware' })
    fireEvent.click(box(/Prévenir le RSSI/))
    await waitFor(() => expect(box(/Prévenir le RSSI/).getAttribute('aria-checked')).toBe('true'))
    expect(api.toggleStep).toHaveBeenCalledWith(7, 12)
    expect(screen.getByRole('img', { name: /2 étapes validées sur 3, 67 %/ })).toBeTruthy()
  })

  it('ignore un second clic tant que la bascule précédente n’a pas répondu', async () => {
    api.get.mockResolvedValue(fixture())
    const pending = deferred<PlaybookStep>()
    api.toggleStep.mockReturnValueOnce(pending.promise)
    renderAt()
    await screen.findByRole('heading', { name: 'Réponse Ransomware' })
    fireEvent.click(box(/Prévenir le RSSI/))
    fireEvent.click(box(/Prévenir le RSSI/))
    fireEvent.click(box(/Prévenir le RSSI/))
    expect(api.toggleStep).toHaveBeenCalledTimes(1)
    expect(box(/Prévenir le RSSI/).getAttribute('aria-busy')).toBe('true')
    // A reset cannot start while a toggle is in flight.
    expect((screen.getByRole('button', { name: /Réinitialiser/ }) as HTMLButtonElement).disabled).toBe(true)
    await act(async () => { pending.resolve(step(12, 2, 'Prévenir le RSSI', true, 7)) })
    expect(box(/Prévenir le RSSI/).getAttribute('aria-checked')).toBe('true')
    expect(box(/Prévenir le RSSI/).getAttribute('aria-busy')).toBeNull()
  })

  it('resynchronise depuis le serveur quand une bascule échoue', async () => {
    const synced = fixture()
    synced.steps[1].checked = true
    api.get.mockResolvedValueOnce(fixture()).mockResolvedValueOnce(synced)
    api.toggleStep.mockRejectedValue(new Error('timeout'))
    renderAt()
    await screen.findByRole('heading', { name: 'Réponse Ransomware' })
    fireEvent.click(box(/Prévenir le RSSI/))
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(box(/Prévenir le RSSI/).getAttribute('aria-checked')).toBe('true'))
    expect(toast.error).toHaveBeenCalled()
  })

  it('demande confirmation avant de réinitialiser, et Échap annule', async () => {
    api.get.mockResolvedValue(fixture())
    api.reset.mockResolvedValue({})
    renderAt()
    await screen.findByRole('heading', { name: 'Réponse Ransomware' })
    fireEvent.click(screen.getByRole('button', { name: /Réinitialiser/ }))
    let dialog = screen.getByRole('dialog', { name: 'Réinitialiser la checklist ?' })
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Annuler' }))
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(api.reset).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Réinitialiser/ }))
    dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Réinitialiser' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(api.reset).toHaveBeenCalledWith(7)
    expect(screen.getAllByRole('checkbox').every(b => b.getAttribute('aria-checked') === 'false')).toBe(true)
  })

  it('navigue au clavier entre les étapes', async () => {
    api.get.mockResolvedValue(fixture())
    renderAt()
    await screen.findByRole('heading', { name: 'Réponse Ransomware' })
    const [first, second, third] = screen.getAllByRole('checkbox')
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(second)
    fireEvent.keyDown(second, { key: 'End' })
    expect(document.activeElement).toBe(third)
    fireEvent.keyDown(third, { key: 'Home' })
    expect(document.activeElement).toBe(first)
  })

  it('supprime après confirmation puis revient à la liste', async () => {
    api.get.mockResolvedValue(fixture())
    api.delete.mockResolvedValue({})
    renderAt()
    await screen.findByRole('heading', { name: 'Réponse Ransomware' })
    fireEvent.click(screen.getByRole('button', { name: /Supprimer/ }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Supprimer le playbook ?' })).getByRole('button', { name: 'Supprimer' }))
    expect(await screen.findByText('INDEX')).toBeTruthy()
    expect(api.delete).toHaveBeenCalledWith(7)
  })

  it('distingue un playbook introuvable d’une panne du backend', async () => {
    api.get.mockRejectedValueOnce({ response: { status: 404 } })
    renderAt()
    expect(await screen.findByRole('heading', { name: 'Playbook introuvable' })).toBeTruthy()
    cleanup()
    api.get.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(fixture())
    renderAt()
    expect((await screen.findByRole('alert')).textContent).toContain('Impossible de charger ce playbook')
    fireEvent.click(screen.getByRole('button', { name: /Réessayer/ }))
    expect(await screen.findByRole('heading', { name: 'Réponse Ransomware' })).toBeTruthy()
  })
})
