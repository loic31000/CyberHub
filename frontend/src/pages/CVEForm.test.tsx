// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CVEForm from './CVEForm'
import { cveApi } from '@/api/client'
import type { CVEEntry } from '@/types'

vi.mock('@/api/client', () => ({ cveApi: { get: vi.fn(), create: vi.fn(), update: vi.fn() } }))

// A fictional entry.
const ENTRY = {
  id: 7, cve_id: 'CVE-2026-0007', description: 'Fictional entry', cvss_score: 5, severity: 'medium',
  products: 'demo', status: 'new', notes: '', published_at: '2026-01-01T00:00:00Z', created_at: '2026-01-02T00:00:00Z',
} as CVEEntry

const renderAt = (url: string) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/cve/new" element={<CVEForm />} />
      <Route path="/cve/:id/edit" element={<CVEForm />} />
      <Route path="/cve/:id" element={<p>Fiche CVE</p>} />
      <Route path="/cve" element={<p>Index CVE</p>} />
    </Routes>
  </MemoryRouter>,
)

describe('CVE Watch — formulaire', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it("crée une CVE une seule fois malgré une double soumission, puis ouvre sa fiche", async () => {
    let finish!: (v: CVEEntry) => void
    vi.mocked(cveApi.create).mockReturnValue(new Promise((r) => { finish = r }))
    renderAt('/cve/new')
    fireEvent.change(screen.getByLabelText('CVE-ID *'), { target: { value: 'cve-2026-0007' } })
    const form = screen.getByRole('button', { name: /CRÉER LA CVE/ }).closest('form') as HTMLFormElement
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(cveApi.create).toHaveBeenCalledTimes(1)
    expect(vi.mocked(cveApi.create).mock.calls[0][0]).toMatchObject({ cve_id: 'CVE-2026-0007' })
    finish(ENTRY)
    expect(await screen.findByText('Fiche CVE')).toBeTruthy()
  })

  it("affiche l'erreur du backend et permet de soumettre à nouveau", async () => {
    vi.mocked(cveApi.create).mockRejectedValueOnce({ response: { data: { error: 'CVE déjà existante' } } }).mockResolvedValueOnce(ENTRY)
    renderAt('/cve/new')
    fireEvent.change(screen.getByLabelText('CVE-ID *'), { target: { value: 'CVE-2026-0007' } })
    fireEvent.click(screen.getByRole('button', { name: /CRÉER LA CVE/ }))
    expect((await screen.findByRole('alert')).textContent).toBe('CVE déjà existante')
    fireEvent.click(screen.getByRole('button', { name: /CRÉER LA CVE/ }))
    expect(await screen.findByText('Fiche CVE')).toBeTruthy()
    expect(cveApi.create).toHaveBeenCalledTimes(2)
  })

  it("modifie une CVE existante, et Annuler ramène à sa fiche", async () => {
    vi.mocked(cveApi.get).mockResolvedValue(ENTRY)
    vi.mocked(cveApi.update).mockResolvedValue(ENTRY)
    renderAt('/cve/7/edit')
    const description = await screen.findByLabelText('DESCRIPTION')
    expect((description as HTMLTextAreaElement).value).toBe('Fictional entry')
    fireEvent.change(description, { target: { value: 'Updated fictional entry' } })
    fireEvent.click(screen.getByRole('button', { name: /METTRE À JOUR/ }))
    await screen.findByText('Fiche CVE')
    expect(vi.mocked(cveApi.update).mock.calls[0]).toMatchObject([7, { description: 'Updated fictional entry' }])
    cleanup()
    renderAt('/cve/7/edit')
    fireEvent.click(await screen.findByRole('button', { name: 'ANNULER' }))
    await waitFor(() => expect(screen.getByText('Fiche CVE')).toBeTruthy())
  })
})
