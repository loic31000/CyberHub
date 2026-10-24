// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CorrelationPage from './CorrelationPage'
import { correlationApi, iocApi } from '@/api/client'
import { toast } from '@/store/toast'
import type { CorrelationResult } from '@/types/correlation'
import { correlationResult, deferred } from '@/corr26/__fixtures__'

vi.mock('@/api/client', () => ({
  correlationApi: { correlationAnalyze: vi.fn(), correlationHistory: vi.fn(), correlationInvalidateCache: vi.fn() },
  iocApi: { create: vi.fn() },
}))
vi.mock('@/store/toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))

const api = vi.mocked(correlationApi)
const renderPage = () => render(
  <MemoryRouter initialEntries={['/correlation']}>
    <Routes>
      <Route path="/correlation" element={<CorrelationPage />} />
      <Route path="/bgp" element={<p>BGP</p>} />
    </Routes>
  </MemoryRouter>,
)
const field = () => screen.getByLabelText(/^Valeur de l’indicateur/) as HTMLInputElement
const analyze = async (value = ' 203.0.113.42 ') => {
  fireEvent.change(field(), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: 'Analyser' }))
}

describe('Corrélation 2026', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('présente l’analyse initiale et un sélecteur de type au clavier', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'Analysez un indicateur' })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Analyser' }) as HTMLButtonElement).disabled).toBe(true)
    const ip = screen.getByRole('radio', { name: 'IP' })
    expect(ip.getAttribute('aria-checked')).toBe('true')
    ip.focus()
    fireEvent.keyDown(ip, { key: 'ArrowRight' })
    const domain = screen.getByRole('radio', { name: 'Domaine' })
    expect(domain.getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(domain)
    fireEvent.keyDown(domain, { key: 'ArrowLeft' })
    fireEvent.keyDown(screen.getByRole('radio', { name: 'IP' }), { key: 'ArrowLeft' })
    expect(screen.getByRole('radio', { name: 'CIDR' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getAllByRole('radio').filter(r => r.tabIndex === 0)).toHaveLength(1)
  })

  it('affiche un résultat complet : indicateur, confiance, techniques MITRE et groupes', async () => {
    api.correlationAnalyze.mockResolvedValue(correlationResult())
    renderPage()
    await analyze()
    expect(api.correlationAnalyze).toHaveBeenCalledWith('ip', '203.0.113.42')
    expect(await screen.findByRole('heading', { name: '203.0.113.42' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Confiance forte, 72 %' })).toBeTruthy()
    const mitre = screen.getByRole('region', { name: 'Techniques MITRE ATT&CK' })
    const link = within(mitre).getByRole('link', { name: /T1071 Application Layer Protocol/ })
    expect(link.getAttribute('href')).toBe('/mitre?id=T1071')
    expect(within(mitre).getByText('Command and Control')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Réponse Ransomware/ }).getAttribute('href')).toBe('/playbooks/3')
    expect(screen.getByRole('link', { name: /Campagne fictive/ }).getAttribute('href')).toBe('/investigations/8')
    expect(within(screen.getByRole('navigation', { name: 'Correspondances' })).getByRole('link', { name: /CVE/ }).getAttribute('href')).toBe('#cr26-cve')
    expect(screen.getByText(/Sans correspondance : .*Notes/)).toBeTruthy()
    expect(screen.getByText('Bloquer l’adresse sur le pare-feu périmétrique')).toBeTruthy()
  })

  it('montre le chargement puis l’erreur, et relance l’analyse', async () => {
    const pending = deferred<CorrelationResult>()
    api.correlationAnalyze.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(correlationResult())
    renderPage()
    await analyze()
    expect(screen.getByRole('status', { name: 'Analyse en cours' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Analyse…' })).toBeTruthy()
    await act(async () => { pending.reject(new Error('down')) })
    expect((await screen.findByRole('alert')).textContent).toContain('Vérifiez la valeur saisie')
    fireEvent.click(screen.getByRole('button', { name: /Réessayer/ }))
    expect(await screen.findByRole('heading', { name: '203.0.113.42' })).toBeTruthy()
    expect(api.correlationAnalyze).toHaveBeenCalledTimes(2)
  })

  it('sauvegarde comme IOC avec le même contenu qu’avant', async () => {
    api.correlationAnalyze.mockResolvedValue(correlationResult())
    vi.mocked(iocApi.create).mockResolvedValue({} as never)
    renderPage()
    await analyze()
    fireEvent.click(await screen.findByRole('button', { name: /Sauvegarder comme IOC/ }))
    await waitFor(() => expect(iocApi.create).toHaveBeenCalledWith({
      type: 'ip', value: '203.0.113.42', notes: 'Analysé via Corrélation — 2 technique(s) MITRE', tlp: 'amber', status: 'active', tags: 'T1071,T1041',
    }))
    expect(toast.success).toHaveBeenCalled()
  })

  it('propose BGP pour une IP et invalide le cache', async () => {
    api.correlationAnalyze.mockResolvedValue(correlationResult())
    api.correlationInvalidateCache.mockResolvedValue({})
    renderPage()
    await analyze()
    fireEvent.click(await screen.findByRole('button', { name: 'Invalider le cache' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Analysez un indicateur' })).toBeTruthy())
    expect(api.correlationInvalidateCache).toHaveBeenCalledWith('203.0.113.42')
    await analyze()
    fireEvent.click(await screen.findByRole('button', { name: /BGP Lookup/ }))
    expect(await screen.findByText('BGP')).toBeTruthy()
  })

  it('charge l’historique à la demande, avec états vide et liste', async () => {
    api.correlationHistory.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { ioc_type: 'domain', ioc_value: 'exemple-malveillant.test', generated_at: '2026-10-22T08:00:00Z', from_cache: true },
    ])
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Charger l’historique' }))
    expect(await screen.findByText('Aucune analyse en cache.')).toBeTruthy()
    cleanup()
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Charger l’historique' }))
    const item = await screen.findByRole('button', { name: 'Relancer l’analyse de exemple-malveillant.test (Domaine)' })
    fireEvent.click(item)
    expect(field().value).toBe('exemple-malveillant.test')
    expect(screen.getByRole('radio', { name: 'Domaine' }).getAttribute('aria-checked')).toBe('true')
  })

  it('signale une analyse sans aucune correspondance', async () => {
    api.correlationAnalyze.mockResolvedValue(correlationResult({ techniques: [], cves: [], playbooks: [], investigations: [], attack_layers: [], tools: [], lolbins: [], cloak_tactics: [], notes: [], next_actions: [] }))
    renderPage()
    await analyze()
    expect(await screen.findByText('Aucune correspondance dans les données locales pour cet indicateur.')).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: 'Correspondances' })).toBeNull()
  })
})
