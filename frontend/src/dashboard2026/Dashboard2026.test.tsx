// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import Dashboard2026 from './Dashboard2026'
import { bgpApi, cveApi, iocApi, statsApi, toolsApi } from '@/api/client'
import { LAYOUT_STORAGE_KEY } from './hooks/useDashboardLayout'

vi.mock('@/api/client', () => ({
  statsApi: { get: vi.fn() },
  toolsApi: { list: vi.fn() },
  bgpApi: { getAlerts: vi.fn() },
  iocApi: { list: vi.fn() },
  cveApi: { list: vi.fn() },
}))
// The circuit measures the real page; its own contract is tested separately.
vi.mock('./DashboardCircuit', () => ({ default: () => null, requestCircuitRecompute: vi.fn() }))

// Fictional data only.
const STATS = { tools_total: 59, offensive: 30, defensive: 29, ctf_total: 8, ctf_completed: 6, cve_total: 4, cve_critical: 1, playbooks_total: 19 }
const CVES = [
  { id: 1, cve_id: 'CVE-2099-0001', description: 'Oldest fictional entry', cvss_score: 5, severity: 'medium', products: '', status: 'new', notes: '', published_at: '2099-01-01T00:00:00Z', created_at: '2099-01-02T00:00:00Z', updated_at: '' },
  { id: 2, cve_id: 'CVE-2099-0002', description: 'Newest fictional entry', cvss_score: 9.8, severity: 'critical', products: '', status: 'new', notes: '', published_at: '2099-04-01T00:00:00Z', created_at: '2099-04-02T00:00:00Z', updated_at: '' },
  { id: 3, cve_id: 'CVE-2099-0003', description: 'Middle fictional entry', cvss_score: 7.5, severity: 'high', products: '', status: 'new', notes: '', published_at: '2099-03-01T00:00:00Z', created_at: '2099-03-02T00:00:00Z', updated_at: '' },
  { id: 4, cve_id: 'CVE-2099-0004', description: 'Second fictional entry', cvss_score: 0, severity: 'none', products: '', status: 'new', notes: '', published_at: '', created_at: '2099-02-01T00:00:00Z', updated_at: '' },
]
const ALERTS = [
  { id: 11, asn: 64500, alert_type: 'prefix_withdrawn', detected_at: '2099-05-01T00:00:00Z', acknowledged: false },
  { id: 12, asn: 64501, alert_type: 'new_peer', detected_at: '2099-05-02T00:00:00Z', acknowledged: true },
  { id: 13, asn: 64502, alert_type: 'new_prefix', detected_at: '2099-05-03T00:00:00Z', acknowledged: false },
]

const api = {
  stats: vi.mocked(statsApi.get), tools: vi.mocked(toolsApi.list), bgp: vi.mocked(bgpApi.getAlerts),
  ioc: vi.mocked(iocApi.list), cves: vi.mocked(cveApi.list),
}
function readyData() {
  api.stats.mockResolvedValue(STATS as never)
  api.tools.mockResolvedValue({ tools: [], count: 59 } as never)
  api.bgp.mockResolvedValue({ items: ALERTS, total: 3, limit: 5, offset: 0 } as never)
  api.ioc.mockResolvedValue({ items: [], total: 12, page: 1, limit: 1 } as never)
  api.cves.mockResolvedValue({ cves: CVES, count: 4 } as never)
}
function emptyData() {
  api.stats.mockResolvedValue({ ...STATS, tools_total: 0, ctf_total: 0 } as never)
  api.tools.mockResolvedValue({ tools: [], count: 0 } as never)
  api.bgp.mockResolvedValue({ items: [], total: 0, limit: 5, offset: 0 } as never)
  api.ioc.mockResolvedValue({ items: [], total: 0, page: 1, limit: 1 } as never)
  api.cves.mockResolvedValue({ cves: [], count: 0 } as never)
}

function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output> }
const renderDashboard = () => render(<MemoryRouter initialEntries={['/dashboard']}><Dashboard2026 /><Location /></MemoryRouter>)
const widgetOrder = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('.widget-grid > .widget')].map((w) => `${w.dataset.widget}:${w.dataset.size}`)

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as never
  window.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as never
})

describe('Dashboard 2026 — comportement de référence', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('met en pause les animations du Dashboard uniquement quand l’onglet est masqué', () => {
    readyData()
    const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden')
    const { container } = renderDashboard()
    const root = container.querySelector('.cyber-dashboard-2026') as HTMLElement

    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    fireEvent(document, new Event('visibilitychange'))
    expect(root.hasAttribute('data-motion-paused')).toBe(true)

    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    fireEvent(document, new Event('visibilitychange'))
    expect(root.hasAttribute('data-motion-paused')).toBe(false)

    if (hiddenDescriptor) Object.defineProperty(document, 'hidden', hiddenDescriptor)
    else Reflect.deleteProperty(document, 'hidden')
  })

  it('affiche les cinq widgets dans leur ordre et leur taille par défaut', async () => {
    readyData()
    const { container } = renderDashboard()
    await screen.findByText('CVE-2099-0002')
    expect(widgetOrder(container)).toEqual(['network:standard', 'operations:compact', 'threat:compact', 'watch:compact', 'sync:large'])
    expect(screen.getByText('WIDGETS').parentElement?.textContent).toContain('5 affichés')
  })

  it("dérive l'état de l'environnement des seules données de l'API", async () => {
    readyData()
    renderDashboard()
    expect(await screen.findByText('59 outils · 8 writeups')).toBeTruthy()
    expect(screen.getByText('12 IOC enregistrés', { selector: '.environment-card *' })).toBeTruthy()
    expect(screen.getByText('3 alertes BGP enregistrées')).toBeTruthy()
    expect(screen.getAllByText('Accès au module')).toHaveLength(2)
  })

  it('montre les trois CVE les plus récentes, leur sévérité réelle, et ouvre la fiche', async () => {
    readyData()
    renderDashboard()
    const watch = (await screen.findByText('VEILLE CVE & SOURCES')).closest('section') as HTMLElement
    await within(watch).findByText('CVE-2099-0002')
    expect(within(watch).getAllByRole('button', { name: /CVE-2099/ }).map((b) => b.querySelector('strong')?.textContent))
      .toEqual(['CVE-2099-0002', 'CVE-2099-0003', 'CVE-2099-0004'])
    expect(within(watch).getByText('CRITIQUE')).toBeTruthy()
    expect(within(watch).getByText('4 CVE enregistrées')).toBeTruthy()
    fireEvent.click(within(watch).getByRole('button', { name: /CVE-2099-0003/ }))
    expect(screen.getByTestId('location').textContent).toBe('/knowledge?source=cve&id=CVE-2099-0003')
  })

  it('liste deux alertes BGP au plus dans Threat Monitor, avec leur état', async () => {
    readyData()
    renderDashboard()
    const threat = (await screen.findByText('THREAT MONITOR')).closest('section') as HTMLElement
    await within(threat).findByText('AS64500 · prefix withdrawn')
    expect(within(threat).getByText('AS64501 · new peer')).toBeTruthy()
    expect(within(threat).queryByText(/AS64502/)).toBeNull()
    expect(within(threat).getByText(/Non acquittée/)).toBeTruthy()
    expect(within(threat).getByText('12 IOC enregistrés')).toBeTruthy()
  })

  it('affiche le chargement sans valeur inventée', () => {
    for (const fn of Object.values(api)) fn.mockReturnValue(new Promise(() => {}) as never)
    renderDashboard()
    expect(screen.getAllByText('Chargement…').length).toBeGreaterThan(0)
    expect(screen.getByText('Chargement des alertes BGP…')).toBeTruthy()
    expect(screen.getByText('Chargement des CVE…')).toBeTruthy()
    expect(screen.queryByText(/\d+ IOC/)).toBeNull()
  })

  it("distingue l'erreur du vide et relance toutes les données", async () => {
    for (const fn of Object.values(api)) fn.mockRejectedValue(new Error('down'))
    renderDashboard()
    expect(await screen.findByText('Alertes BGP indisponibles')).toBeTruthy()
    expect(screen.getByText('Veille CVE indisponible')).toBeTruthy()
    expect(screen.queryByText('Aucune CVE enregistrée')).toBeNull()
    readyData()
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer les données' }))
    expect(await screen.findByText('59 outils · 8 writeups')).toBeTruthy()
    expect(api.stats).toHaveBeenCalledTimes(2)
  })

  it('affiche les états vides avec leur action', async () => {
    emptyData()
    renderDashboard()
    expect(await screen.findByText('Aucune CVE enregistrée')).toBeTruthy()
    expect(screen.getByText('Aucune alerte BGP à afficher')).toBeTruthy()
    expect(screen.getByText('Aucune alerte BGP')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /CVE & KEV/ }))
    expect(screen.getByTestId('location').textContent).toBe('/knowledge?source=cve')
  })

  it('respecte la disposition enregistrée : ordre, tailles et widgets masqués', async () => {
    readyData()
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify({ version: 1, envCards: ['system.console', 'system.bgp'], widgets: [
      { id: 'watch', visible: true, size: 'large' }, { id: 'network', visible: false, size: 'standard' },
      { id: 'threat', visible: true, size: 'standard' }, { id: 'operations', visible: false, size: 'compact' }, { id: 'sync', visible: true, size: 'standard' },
    ] }))
    const { container } = renderDashboard()
    await screen.findByText('CVE-2099-0002')
    expect(widgetOrder(container)).toEqual(['watch:large', 'threat:standard', 'sync:standard'])
    expect(screen.getByText('WIDGETS').parentElement?.textContent).toContain('3 affichés · 2 masqués')
    expect(container.querySelectorAll('.environment-card').length).toBe(2)
    expect(screen.queryByText('ACTIVITÉ RÉSEAU (APERÇU)')).toBeNull()
  })

  it('propose de réafficher les widgets quand tous sont masqués', async () => {
    readyData()
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify({ version: 1, envCards: [], widgets: ['network', 'operations', 'threat', 'watch', 'sync'].map((id) => ({ id, visible: false, size: id === 'sync' ? 'large' : id === 'network' ? 'standard' : 'compact' })) }))
    renderDashboard()
    expect(await screen.findByText('Tous les widgets sont masqués.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Afficher des widgets' }))
    expect(await screen.findByRole('dialog')).toBeTruthy()
  })

  it('replie et déplie un panneau, avec son résumé', async () => {
    readyData()
    renderDashboard()
    await screen.findByText('CVE-2099-0002')
    const toggle = screen.getByRole('button', { name: 'Replier Veille CVE et sources' })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    await act(async () => { fireEvent.click(toggle); await new Promise((r) => setTimeout(r, 220)) })
    const reopen = screen.getByRole('button', { name: 'Déplier Veille CVE et sources' })
    expect(reopen.getAttribute('aria-expanded')).toBe('false')
    expect(reopen.closest('section')?.classList.contains('is-collapsed')).toBe(true)
    fireEvent.click(reopen)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Replier Veille CVE et sources' })).toBeTruthy())
  })

  it('ouvre chaque personnalisation dans une fenêtre et rend le focus à son bouton', async () => {
    readyData()
    renderDashboard()
    await screen.findByText('CVE-2099-0002')
    const trigger = screen.getByRole('button', { name: /Personnaliser le Dashboard/ })
    trigger.focus()
    fireEvent.click(trigger)
    const dialog = await screen.findByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    const env = screen.getByRole('button', { name: 'Personnaliser' })
    env.focus()
    fireEvent.click(env)
    expect(await screen.findByRole('dialog')).toBeTruthy()
  })

  describe('une carte par module', () => {
    const cardTitles = (container: HTMLElement) => [...container.querySelectorAll('.environment-card strong')].map((s) => s.textContent)

    it('affiche les cinq cartes par défaut sans doublon, avec leurs états réels', async () => {
      readyData()
      const { container } = renderDashboard()
      expect(await screen.findByText('3 alertes BGP enregistrées')).toBeTruthy()
      expect(cardTitles(container)).toEqual(['Console', 'Knowledge Atlas', 'IOC Manager', 'OSINT Runner', 'BGP Historian'])
      expect(container.querySelectorAll('.environment-card.is-module')).toHaveLength(2)
      expect(container.querySelectorAll('.environment-card .mini-bars')).toHaveLength(3)
    })

    it('ouvre le bon module depuis chaque carte', async () => {
      readyData()
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify({ version: 1, envCards: [
        'system.console', 'module.mitre', 'module.ioc', 'module.osint', 'module.bgp-historian', 'module.bgp', 'module.cve',
      ], widgets: [] }))
      const { container } = renderDashboard()
      await screen.findByText('3 alertes BGP enregistrées')
      const routes: Record<string, string> = {
        Console: '/tools', 'Knowledge Atlas': '/knowledge', 'IOC Manager': '/ioc', 'OSINT Runner': '/osint',
        'BGP Historian': '/bgp/historian', 'BGP Lookup': '/bgp',
      }
      for (const [title, route] of Object.entries(routes)) {
        const card = [...container.querySelectorAll<HTMLElement>('.environment-card')].find((c) => c.querySelector('strong')?.textContent === title)!
        fireEvent.click(card)
        expect(screen.getByTestId('location').textContent).toBe(route)
      }
    })

    it('lit une ancienne disposition avec doublons sans perdre ordre ni widgets, puis la conserve au rechargement', async () => {
      readyData()
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify({ version: 1, envCards: [
        'system.bgp', 'module.bgp-historian', 'system.mitre', 'module.mitre', 'module.bgp', 'system.osint', 'module.osint',
      ], widgets: [{ id: 'watch', visible: true, size: 'large' }, { id: 'network', visible: false, size: 'standard' }] }))
      const first = renderDashboard()
      await screen.findByText('3 alertes BGP enregistrées')
      expect(cardTitles(first.container)).toEqual(['BGP Historian', 'Knowledge Atlas', 'BGP Lookup', 'OSINT Runner'])
      expect(widgetOrder(first.container)[0]).toBe('watch:large')
      expect(screen.queryByText('ACTIVITÉ RÉSEAU (APERÇU)')).toBeNull()

      // Move a card, then reload: the cleaned order is what is stored.
      fireEvent.click(screen.getByRole('button', { name: 'Personnaliser' }))
      const dialog = await screen.findByRole('dialog')
      fireEvent.click(within(dialog).getByRole('button', { name: 'Descendre BGP Historian' }))
      fireEvent.keyDown(dialog, { key: 'Escape' })
      first.unmount()
      const stored = JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) as string)
      expect(stored.envCards).toEqual(['module.knowledge', 'module.bgp-historian', 'module.bgp', 'module.osint'])
      const second = renderDashboard()
      await screen.findByText('3 alertes BGP enregistrées')
      expect(cardTitles(second.container)).toEqual(['Knowledge Atlas', 'BGP Historian', 'BGP Lookup', 'OSINT Runner'])
      expect(widgetOrder(second.container)[0]).toBe('watch:large')
    })

    it('ne propose aucun doublon dans Personnaliser : ajout, remplacement, retrait et réinitialisation', async () => {
      readyData()
      const { container } = renderDashboard()
      await screen.findByText('3 alertes BGP enregistrées')
      fireEvent.click(screen.getByRole('button', { name: 'Personnaliser' }))
      const dialog = await screen.findByRole('dialog')
      const catalog = () => [...dialog.querySelectorAll('.customize-catalog li strong')].map((s) => s.firstChild?.textContent)
      // 15 entries: Console and the 14 canonical modules, each once.
      expect(catalog()).toHaveLength(15)
      expect(new Set(catalog()).size).toBe(15)
      for (const title of ['MITRE', 'OSINT', 'BGP', 'Sources']) expect(catalog()).not.toContain(title)
      expect(within(dialog).getByRole('button', { name: 'BGP Historian : déjà affiché' })).toBeTruthy()

      // Add BGP Lookup: a separate module.
      fireEvent.click(within(dialog).getByRole('button', { name: 'Ajouter BGP Lookup' }))
      expect(cardTitles(container)).toContain('BGP Lookup')
      // Replacing a card cannot pick a card already shown.
      fireEvent.click(within(dialog).getByRole('button', { name: 'Remplacer Knowledge Atlas' }))
      expect(within(dialog).getByRole('button', { name: 'OSINT Runner : déjà affiché' })).toBeTruthy()
      fireEvent.click(within(dialog).getByRole('button', { name: 'Remplacer Knowledge Atlas par Playbooks' }))
      expect(cardTitles(container)).toEqual(['Console', 'Playbooks', 'IOC Manager', 'OSINT Runner', 'BGP Historian', 'BGP Lookup'])
      // Remove, then reset to the five original cards.
      fireEvent.click(within(dialog).getByRole('button', { name: 'Retirer IOC Manager' }))
      expect(cardTitles(container)).not.toContain('IOC Manager')
      fireEvent.click(within(dialog).getByRole('button', { name: /Réinitialiser/ }))
      fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmer' }))
      expect(cardTitles(container)).toEqual(['Console', 'Knowledge Atlas', 'IOC Manager', 'OSINT Runner', 'BGP Historian'])
      expect(localStorage.getItem(LAYOUT_STORAGE_KEY)).toBeNull()
    })
  })

  it('garde le globe présenté comme une illustration', async () => {
    readyData()
    renderDashboard()
    await screen.findByText('CVE-2099-0002')
    expect(screen.getByText('ILLUSTRATION')).toBeTruthy()
    expect(screen.getByText('Globe géographique illustratif · aucune donnée de trafic réel.')).toBeTruthy()
    expect(screen.getByText(/globe illustratif · circuit décoratif · aucune surveillance continue/)).toBeTruthy()
  })
})
