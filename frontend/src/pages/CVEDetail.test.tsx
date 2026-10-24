// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CVEDetail from './CVEDetail'
import { cveApi, cisaApi } from '@/api/client'
import type { CVEEntry } from '@/types'

vi.mock('@/api/client', () => ({
  cveApi: { get: vi.fn(), delete: vi.fn() },
  cisaApi: { checkKEV: vi.fn(), getEPSS: vi.fn() },
}))

// A fictional entry.
const ENTRY = {
  id: 7, cve_id: 'CVE-2026-0007', description: 'Fictional entry', cvss_score: 9.1, severity: 'critical',
  products: 'demo', status: 'new', notes: '', published_at: '2026-01-01T00:00:00Z', created_at: '2026-01-02T00:00:00Z',
} as CVEEntry
const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } })

const renderDetail = () => render(
  <MemoryRouter initialEntries={['/cve/7']}>
    <Routes>
      <Route path="/cve/:id" element={<CVEDetail />} />
      <Route path="/cve" element={<p>Index CVE</p>} />
    </Routes>
  </MemoryRouter>,
)

describe('CVE Watch — fiche', () => {
  beforeEach(() => {
    vi.mocked(cveApi.get).mockResolvedValue(ENTRY)
    vi.mocked(cisaApi.checkKEV).mockResolvedValue({ exploited: false, entry: null })
    vi.mocked(cisaApi.getEPSS).mockResolvedValue({ cve_id: ENTRY.cve_id, score: 0.42, percentile: 0.9, date: '2026-10-01' })
  })
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it("distingue l'absence du catalogue KEV d'une erreur KEV", async () => {
    renderDetail()
    expect(await screen.findByText('Absente du catalogue CISA KEV local.')).toBeTruthy()
    cleanup()
    vi.mocked(cisaApi.checkKEV).mockRejectedValue(httpError(500))
    renderDetail()
    expect(await screen.findByText(/Statut CISA KEV indisponible/)).toBeTruthy()
    expect(screen.queryByText('Absente du catalogue CISA KEV local.')).toBeNull()
  })

  it("distingue l'absence de score EPSS (404) d'une erreur de récupération, et permet de réessayer", async () => {
    vi.mocked(cisaApi.getEPSS).mockRejectedValueOnce(httpError(404))
    renderDetail()
    // A 404 may also hide an unreadable reply from FIRST.org: the note says so, without claiming no score exists.
    const note = await screen.findByText(/^Aucun score EPSS obtenu pour cette CVE/)
    expect(note.textContent).toContain('réponse était inexploitable')
    expect(note.textContent).not.toMatch(/Aucun score EPSS publié/)
    cleanup()
    vi.mocked(cisaApi.getEPSS).mockRejectedValueOnce(httpError(502))
    renderDetail()
    expect(await screen.findByText(/Score EPSS indisponible/)).toBeTruthy()
    expect(screen.queryByText(/Aucun score EPSS obtenu/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByText('42.0%')).toBeTruthy()
  })

  it('affiche les champs KEV quand la CVE est exploitée', async () => {
    vi.mocked(cisaApi.checkKEV).mockResolvedValue({ exploited: true, entry: {
      id: 1, cve_id: ENTRY.cve_id, vendor_project: 'Demo', product: 'Widget', vulnerability_name: 'Fictional flaw',
      date_added: '2026-02-01', short_description: '', required_action: 'Apply update', due_date: '2026-03-01', notes: '',
    } })
    renderDetail()
    expect(await screen.findByText('EXPLOITATION ACTIVE — CISA KEV')).toBeTruthy()
    expect(screen.getByText('Demo · Widget')).toBeTruthy()
    expect(screen.getByText('Apply update')).toBeTruthy()
  })

  it('garde CVSS, KEV et EPSS dans trois panneaux distincts et ne pousse jamais le percentile à 100', async () => {
    vi.mocked(cisaApi.getEPSS).mockResolvedValue({ cve_id: ENTRY.cve_id, score: 0.942, percentile: 0.998, date: '2026-10-22' })
    renderDetail()
    expect(await screen.findByText('94.2%')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Gravité CVSS' }).textContent).toContain('9.1')
    expect(screen.getByRole('region', { name: 'Exploitation CISA KEV' }).textContent).toContain('Absente du catalogue CISA KEV local.')
    const epss = screen.getByRole('region', { name: 'Probabilité EPSS' })
    expect(epss.textContent).toContain('99,8')
    expect(epss.textContent).not.toContain('100')
  })

  it('signale l’écart entre la sévérité enregistrée et la plage CVSS v3, sans la modifier', async () => {
    vi.mocked(cveApi.get).mockResolvedValue({ ...ENTRY, cvss_score: 8.1, severity: 'critical' })
    renderDetail()
    const cvss = await screen.findByRole('region', { name: 'Gravité CVSS' })
    expect(cvss.textContent).toContain('8.1')
    expect(cvss.textContent).toContain('Critique')
    expect(cvss.textContent).toContain('correspond à « Élevée » dans les plages CVSS v3.x')
    cleanup()
    vi.mocked(cveApi.get).mockResolvedValue(ENTRY) // 9.1, critical: consistent
    renderDetail()
    expect((await screen.findByRole('region', { name: 'Gravité CVSS' })).textContent).not.toContain('plages CVSS')
  })

  it('dit factuellement ce qu’est un score CVSS de 0 enregistré', async () => {
    vi.mocked(cveApi.get).mockResolvedValue({ ...ENTRY, cvss_score: 0, severity: 'none' })
    renderDetail()
    const cvss = await screen.findByRole('region', { name: 'Gravité CVSS' })
    expect(cvss.textContent).toContain('Score CVSS enregistré : 0.0')
    expect(cvss.textContent).toContain('ne distingue pas un score non évalué d’un score nul')
  })

  it('présente EPSS comme une probabilité estimée, distincte d’une exploitation observée', async () => {
    renderDetail()
    const epss = await screen.findByRole('region', { name: 'Probabilité EPSS' })
    await within(epss).findByText('42.0%')
    expect(epss.textContent).toContain('probabilité estimée d’exploitation sur 30 jours')
    expect(epss.textContent).toContain('pas une exploitation observée')
    expect(epss.textContent).toContain('FIRST.org')
  })

  it("propose de réessayer quand la fiche ne charge pas, et revient à l'index si elle n'existe pas", async () => {
    vi.mocked(cveApi.get).mockRejectedValueOnce(httpError(500)).mockResolvedValueOnce(ENTRY)
    renderDetail()
    expect((await screen.findByRole('alert')).textContent).toContain('Impossible de charger cette CVE')
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByRole('heading', { name: 'CVE-2026-0007' })).toBeTruthy()
    cleanup()
    vi.mocked(cveApi.get).mockRejectedValueOnce(httpError(404))
    renderDetail()
    expect(await screen.findByText('Index CVE')).toBeTruthy()
  })
})
