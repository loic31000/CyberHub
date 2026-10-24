// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

  it('suggère la sévérité CVSS v3 du score saisi sans la changer d’office', async () => {
    vi.mocked(cveApi.create).mockResolvedValue(ENTRY)
    renderAt('/cve/new')
    fireEvent.change(screen.getByLabelText('CVE-ID *'), { target: { value: 'CVE-2026-0007' } })
    fireEvent.change(screen.getByLabelText('CVSS SCORE'), { target: { value: '9.3' } })
    expect((screen.getByLabelText('SÉVÉRITÉ') as HTMLSelectElement).value).toBe('none')
    expect(screen.getByText(/correspond à « Critique »/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }))
    expect((screen.getByLabelText('SÉVÉRITÉ') as HTMLSelectElement).value).toBe('critical')
    expect(screen.queryByText(/correspond à/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /CRÉER LA CVE/ }))
    await screen.findByText('Fiche CVE')
    expect(vi.mocked(cveApi.create).mock.calls[0][0]).toMatchObject({ cvss_score: 9.3, severity: 'critical' })
  })

  it('distingue CVSS non évalué, évalué à 0 et supérieur à 0, sans changer la sévérité', async () => {
    vi.mocked(cveApi.create).mockResolvedValue(ENTRY)
    renderAt('/cve/new')
    const summary = screen.getByRole('complementary', { name: 'Récapitulatif' })
    const cvss = screen.getByLabelText('CVSS SCORE') as HTMLInputElement
    expect(cvss.value).toBe('')
    expect(summary.querySelector('[data-cvss="unset"]')?.textContent).toBe('Non évaluéSera enregistré comme 0.0.')
    fireEvent.change(cvss, { target: { value: '0' } })
    expect(summary.querySelector('[data-cvss="zero"]')?.textContent).toContain('Évalué à zéro')
    fireEvent.change(cvss, { target: { value: '8,1' } })
    expect(within(summary).getByLabelText('CVSS 8.1 sur 10')).toBeTruthy()
    expect(summary.textContent).toContain('Plage CVSS v3.x du score : Élevée')
    expect((screen.getByLabelText('SÉVÉRITÉ') as HTMLSelectElement).value).toBe('none')

    // Not assessed is saved as 0: the backend stores a number only.
    fireEvent.change(screen.getByLabelText('CVE-ID *'), { target: { value: 'CVE-2026-0007' } })
    fireEvent.change(cvss, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /CRÉER LA CVE/ }))
    await screen.findByText('Fiche CVE')
    expect(vi.mocked(cveApi.create).mock.calls[0][0]).toMatchObject({ cvss_score: 0, severity: 'none' })
  })

  it('refuse un score hors de 0 à 10 et un CVE-ID mal formé, sans appeler le backend', () => {
    renderAt('/cve/new')
    fireEvent.change(screen.getByLabelText('CVE-ID *'), { target: { value: 'CVE-24-1' } })
    fireEvent.click(screen.getByRole('button', { name: /CRÉER LA CVE/ }))
    expect(screen.getByRole('alert').textContent).toBe('Format de CVE-ID attendu : CVE-AAAA-NNNN')
    expect(screen.getByLabelText('CVE-ID *').getAttribute('aria-invalid')).toBe('true')
    fireEvent.change(screen.getByLabelText('CVE-ID *'), { target: { value: 'CVE-2026-0007' } })
    fireEvent.change(screen.getByLabelText('CVSS SCORE'), { target: { value: '11' } })
    fireEvent.click(screen.getByRole('button', { name: /CRÉER LA CVE/ }))
    expect(screen.getByRole('alert').textContent).toBe('Le score CVSS doit être un nombre compris entre 0 et 10')
    expect(screen.getByLabelText('CVSS SCORE').getAttribute('aria-invalid')).toBe('true')
    expect(cveApi.create).not.toHaveBeenCalled()
  })

  it('accepte un CVE-ID avec quatre chiffres ou plus après l’année', async () => {
    for (const cveId of ['CVE-2024-6387', 'CVE-2024-12345', 'CVE-2024-123456']) {
      vi.mocked(cveApi.create).mockResolvedValueOnce(ENTRY)
      renderAt('/cve/new')
      fireEvent.change(screen.getByLabelText('CVE-ID *'), { target: { value: cveId } })
      fireEvent.click(screen.getByRole('button', { name: /CRÉER LA CVE/ }))
      await screen.findByText('Fiche CVE')
      expect(vi.mocked(cveApi.create).mock.lastCall?.[0]).toMatchObject({ cve_id: cveId })
      cleanup()
    }
    renderAt('/cve/new')
    fireEvent.change(screen.getByLabelText('CVE-ID *'), { target: { value: 'CVE-2024-123' } })
    fireEvent.click(screen.getByRole('button', { name: /CRÉER LA CVE/ }))
    expect(screen.getByRole('alert').textContent).toBe('Format de CVE-ID attendu : CVE-AAAA-NNNN')
  })

  it('cycle complet : vide → enregistré 0 → rechargé comme « non évalué ou 0.0 », sans affirmer plus', async () => {
    let saved: Record<string, unknown> = {}
    vi.mocked(cveApi.create).mockImplementation(async (payload) => { saved = { ...payload }; return { ...ENTRY, ...payload, id: 7 } as CVEEntry })
    renderAt('/cve/new')
    fireEvent.change(screen.getByLabelText('CVE-ID *'), { target: { value: 'CVE-2026-0007' } })
    fireEvent.click(screen.getByRole('button', { name: /CRÉER LA CVE/ }))
    await screen.findByText('Fiche CVE')
    expect(saved).toMatchObject({ cvss_score: 0, severity: 'none' })
    cleanup()

    // What the backend gives back holds only the number.
    vi.mocked(cveApi.get).mockResolvedValueOnce({ ...ENTRY, ...saved } as CVEEntry)
    vi.mocked(cveApi.update).mockResolvedValue(ENTRY)
    renderAt('/cve/7/edit')
    expect((await screen.findByLabelText('CVSS SCORE') as HTMLInputElement).value).toBe('')
    const summary = screen.getByRole('complementary', { name: 'Récapitulatif' })
    expect(summary.querySelector('[data-cvss="unset"]')?.textContent).toContain('Non évalué ou 0.0')
    expect(summary.textContent).not.toMatch(/^Non évalué$/m)
    fireEvent.click(screen.getByRole('button', { name: /METTRE À JOUR/ }))
    await screen.findByText('Fiche CVE')
    expect(vi.mocked(cveApi.update).mock.calls[0][1]).toMatchObject({ cvss_score: 0, severity: 'none' })
  })

  it('récapitule uniquement la saisie : identifiant, statut, produits et date', () => {
    renderAt('/cve/new')
    const summary = screen.getByRole('complementary', { name: 'Récapitulatif' })
    expect(summary.textContent).toContain('CVE-ID non renseigné')
    expect(summary.textContent).toContain('Aucun produit saisi')
    fireEvent.change(screen.getByLabelText('CVE-ID *'), { target: { value: 'cve-2026-0042' } })
    fireEvent.change(screen.getByLabelText('PRODUITS AFFECTÉS'), { target: { value: 'OpenSSH, glibc, OpenSSH' } })
    fireEvent.change(screen.getByLabelText('STATUT'), { target: { value: 'analyzed' } })
    fireEvent.change(screen.getByLabelText('DATE DE PUBLICATION'), { target: { value: '' } })
    expect(within(summary).getByText('CVE-2026-0042')).toBeTruthy()
    expect(within(summary).getAllByRole('listitem').map(li => li.textContent)).toEqual(['OpenSSH', 'glibc'])
    expect(within(summary).getByText('ANALYSÉ')).toBeTruthy()
    expect(summary.textContent).toContain('Non renseignée : la date du jour sera enregistrée')
  })

  it("garde la sévérité enregistrée d'une fiche, et lit un 0 sans sévérité comme non évalué", async () => {
    vi.mocked(cveApi.get).mockResolvedValueOnce({ ...ENTRY, cvss_score: 8.1, severity: 'critical' })
    renderAt('/cve/7/edit')
    const cvss = await screen.findByLabelText('CVSS SCORE') as HTMLInputElement
    expect(cvss.value).toBe('8.1')
    expect((screen.getByLabelText('SÉVÉRITÉ') as HTMLSelectElement).value).toBe('critical')
    expect(screen.getByText(/correspond à « Élevée »/)).toBeTruthy()
    cleanup()
    vi.mocked(cveApi.get).mockResolvedValueOnce({ ...ENTRY, cvss_score: 0, severity: 'none' })
    renderAt('/cve/7/edit')
    expect((await screen.findByLabelText('CVSS SCORE') as HTMLInputElement).value).toBe('')
    expect(screen.getByRole('complementary', { name: 'Récapitulatif' }).textContent).toContain('le backend ne distingue pas')
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
