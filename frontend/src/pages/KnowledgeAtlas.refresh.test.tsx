// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { attackLayerApi, cisaApi, cloakAnnotationsApi, cveApi, lolbinsApi, mitreApi } from '@/api/client'
import KnowledgeAtlas from './KnowledgeAtlas'
import type { CVEEntry, CVEsResponse, MITRETechnique, MITRETechniquesResponse } from '@/types'
import type { LOLBin, LOLBinsResponse } from '@/types/lolbins'
import type { AttackLayer } from '@/types/attackLayer'

/*
 * #77 — initial render stability after a refresh. Each source answers through
 * a deferred promise so the tests choose the arrival order, and a
 * MutationObserver counts every carousel card ever mounted: a stable first
 * render mounts each visible card exactly once.
 */

vi.mock('@/api/client', () => ({
  cveApi: { list: vi.fn(), importNVD: vi.fn(), fetchFromNVD: vi.fn(), delete: vi.fn(), create: vi.fn(), update: vi.fn() },
  mitreApi: { techniques: vi.fn(), tactics: vi.fn(), technique: vi.fn() },
  cloakAnnotationsApi: { list: vi.fn(), upsert: vi.fn(), deleteByRef: vi.fn() },
  cisaApi: { checkKEV: vi.fn(), getEPSS: vi.fn(), batchCheckKEV: vi.fn() },
  lolbinsApi: { list: vi.fn(), getCategories: vi.fn() },
  attackLayerApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), import: vi.fn(), exportUrl: (id: number) => `/api/mitre/layers/${id}/export` },
}))

const cve = { id: 1, cve_id: 'CVE-2026-1234', description: 'Synthetic vulnerability', severity: 'critical', cvss_score: 9.8, status: 'new', products: 'Test product' } as CVEEntry
const technique = { technique_id: 'T1059', name: 'Command Interpreter', description: 'PowerShell test', tactics: '["execution"]', platforms: '["Windows"]', is_subtechnique: false } as MITRETechnique
const cloak = { tactics: [{ id: 1, name: 'Anonymous browsing', description: '', type: '', techniques: [{ id: 20, name: 'Anti-fingerprinting', description: 'Tor browser', type: 'Technical', procedures: [], subtechniques: [{ id: 21, name: 'Isolate sessions', description: 'Session procedure', type: 'Technical', procedures: [] }] }] }] }
const lolbin = { id: 7, name: 'awk', os: 'linux', description: 'Pattern scanning.', full_path: '/usr/bin/awk', commands: '[]', mitre_tech: '["T1059"]', tags: '[]', category: 'Shell', command_count: 0 } as LOLBin
const layer = { id: 3, name: 'APT29', description: 'Q1', domain: 'enterprise-attack', version: '14', layer_data: '[]', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-02T00:00:00Z' } as AttackLayer

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void }
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void
  const promise = new Promise<T>((ok, ko) => { resolve = ok; reject = ko })
  return { promise, resolve, reject }
}

let gates: { CVE: Deferred<CVEsResponse>; MITRE: Deferred<MITRETechniquesResponse>; CLOAK: Deferred<Response>; LOLBINS: Deferred<LOLBinsResponse> }
type Gate = keyof typeof gates
const answer: Record<Gate, () => void> = {
  CVE: () => gates.CVE.resolve({ cves: [cve], count: 1 }),
  MITRE: () => gates.MITRE.resolve({ items: [technique], total: 300, page: 1, limit: 100 }),
  CLOAK: () => gates.CLOAK.resolve({ ok: true, json: async () => cloak } as Response),
  LOLBINS: () => gates.LOLBINS.resolve({ items: [lolbin], total: 1, win_count: 0, linux_count: 1 }),
}
const settle = async (source: Gate, fail = false) => {
  await act(async () => { if (fail) gates[source].reject(new Error('offline')); else answer[source]() })
  await act(async () => { await Promise.resolve() })
}

let mounted: number
let observer: MutationObserver
beforeEach(() => {
  vi.clearAllMocks()
  gates = { CVE: deferred(), MITRE: deferred(), CLOAK: deferred(), LOLBINS: deferred() }
  vi.mocked(cveApi.list).mockImplementation(() => gates.CVE.promise)
  vi.mocked(mitreApi.techniques).mockImplementation(() => gates.MITRE.promise)
  vi.mocked(mitreApi.tactics).mockResolvedValue([])
  vi.mocked(mitreApi.technique).mockImplementation(async id => ({ ...technique, technique_id: id, name: `Fetched ${id}` }))
  vi.mocked(lolbinsApi.list).mockImplementation(() => gates.LOLBINS.promise)
  vi.mocked(lolbinsApi.getCategories).mockResolvedValue([])
  vi.mocked(cloakAnnotationsApi.list).mockResolvedValue([])
  vi.mocked(cisaApi.batchCheckKEV).mockResolvedValue({})
  vi.mocked(cisaApi.checkKEV).mockResolvedValue({ exploited: false, entry: null })
  vi.mocked(cisaApi.getEPSS).mockResolvedValue({ cve_id: cve.cve_id, score: .1, percentile: .2, date: '2026-10-25' })
  vi.mocked(attackLayerApi.list).mockResolvedValue({ items: [layer], total: 1 })
  vi.mocked(attackLayerApi.get).mockResolvedValue(layer)
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => gates.CLOAK.promise))
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  mounted = 0
  observer = new MutationObserver(records => {
    for (const record of records) record.addedNodes.forEach(node => {
      if (!(node instanceof HTMLElement)) return
      mounted += (node.matches('.ka-focus-card') ? 1 : 0) + node.querySelectorAll('.ka-focus-card').length
    })
  })
  observer.observe(document.body, { childList: true, subtree: true })
})
afterEach(() => { observer.disconnect(); cleanup(); vi.unstubAllGlobals() })

const view = (entry = '/knowledge') => render(<MemoryRouter initialEntries={[entry]}><KnowledgeAtlas /></MemoryRouter>)
const loadingScene = () => screen.queryByRole('status', { name: 'Chargement de l’index Atlas' })
const cards = () => document.querySelectorAll('.ka-focus-card')
const activeCard = () => document.querySelector('.ka-focus-card.is-active')?.getAttribute('aria-label')

async function loadInOrder(order: Gate[]) {
  view()
  for (const source of order.slice(0, -1)) {
    await settle(source)
    expect(loadingScene()).toBeTruthy()
    expect(cards()).toHaveLength(0)
    expect(document.querySelectorAll('.ka-row')).toHaveLength(0)
  }
  await settle(order[order.length - 1])
  await screen.findByText('5 fiches dans la sélection')
  expect(loadingScene()).toBeNull()
  return activeCard()
}

describe('Knowledge Atlas — initial render after refresh (#77)', () => {
  it('composes ALL once, after every source has settled (CVE → MITRE → CLOAK → LOLBins)', async () => {
    const active = await loadInOrder(['CVE', 'MITRE', 'CLOAK', 'LOLBINS'])
    expect(active).toBe('Ouvrir CVE-2026-1234')
    expect(cards().length).toBeGreaterThan(0)
    expect(mounted).toBe(cards().length)
  })

  it('reaches the same final composition whatever the arrival order (LOLBins → CLOAK → CVE → MITRE)', async () => {
    const active = await loadInOrder(['LOLBINS', 'CLOAK', 'CVE', 'MITRE'])
    expect(active).toBe('Ouvrir CVE-2026-1234')
    expect(mounted).toBe(cards().length)
  })

  it('shows the real state of each source while loading, without invented counts', async () => {
    view(); await settle('CVE'); await settle('CLOAK', true)
    const scene = loadingScene()!
    expect(within(scene).getByText('CVE · prêt')).toBeTruthy()
    expect(within(scene).getByText('CLOAK · indisponible')).toBeTruthy()
    expect(within(scene).getByText('ATT&CK · chargement…')).toBeTruthy()
    expect(within(scene).getByText('LOLBINS · chargement…')).toBeTruthy()
    expect(scene.textContent).not.toMatch(/\d+ fiches/)
  })

  it('finishes initialising when a source fails and keeps the others usable', async () => {
    view()
    await settle('CVE'); await settle('MITRE'); await settle('CLOAK', true); await settle('LOLBINS')
    expect(await screen.findByText('3 fiches dans la sélection')).toBeTruthy()
    expect(screen.getByText(/CLOAK indisponible/)).toBeTruthy()
    expect(loadingScene()).toBeNull()
    expect(mounted).toBe(cards().length)
  })

  it('shows a single-source view as soon as that source is ready', async () => {
    view('/knowledge?source=cve')
    await settle('CVE')
    expect(await screen.findByText('1 fiches dans la sélection')).toBeTruthy()
    expect(activeCard()).toBe('Ouvrir CVE-2026-1234')
    expect(loadingScene()).toBeNull()
  })

  it('opens a deep-linked record after refresh with the carousel already centred on it', async () => {
    view('/knowledge?source=cloak&id=ST-21')
    await settle('CLOAK')
    expect(within(await screen.findByRole('dialog')).getByRole('heading', { level: 2, name: 'Isolate sessions' })).toBeTruthy()
    expect(activeCard()).toBe('Ouvrir ST-21')
    expect(mounted).toBe(cards().length)
  })

  it('resolves a deep-linked ATT&CK record outside the loaded page before composing', async () => {
    view('/knowledge?source=mitre&id=T1002')
    await settle('MITRE')
    expect(within(await screen.findByRole('dialog')).getByText('T1002')).toBeTruthy()
    expect(mitreApi.technique).toHaveBeenCalledWith('T1002')
    expect(activeCard()).toBe('Ouvrir T1002')
    expect(mounted).toBe(cards().length)
  })

  it('does not block the Layers workspace on knowledge sources', async () => {
    view('/knowledge?workspace=layers&id=3')
    expect(await screen.findByRole('heading', { name: 'APT29' })).toBeTruthy()
    expect(loadingScene()).toBeNull()
  })

  it('never re-mounts the composed view on later navigation or paging', async () => {
    view('/knowledge?source=mitre'); await settle('MITRE')
    await screen.findByText('1 fiches dans la sélection')
    const first = mounted
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir T1059' }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: /Fermer/ }))
    expect(loadingScene()).toBeNull()
    expect(mounted).toBe(first)
    vi.mocked(mitreApi.techniques).mockResolvedValueOnce({ items: [{ ...technique, technique_id: 'T1060', name: 'Next page' }], total: 300, page: 2, limit: 100 })
    fireEvent.click(screen.getByRole('button', { name: /Charger 100 fiches/ }))
    await screen.findByText('2 fiches dans la sélection')
    expect(loadingScene()).toBeNull()
  })

  it('never duplicates record keys across sources', async () => {
    await loadInOrder(['MITRE', 'LOLBINS', 'CVE', 'CLOAK'])
    fireEvent.click(screen.getByRole('button', { name: /REGISTRY/ }))
    const rows = Array.from(document.querySelectorAll('.ka-row')).map(row => `${row.getAttribute('data-source')}:${row.querySelector('code')?.textContent}`)
    expect(rows).toHaveLength(5)
    expect(new Set(rows).size).toBe(rows.length)
  })
})
