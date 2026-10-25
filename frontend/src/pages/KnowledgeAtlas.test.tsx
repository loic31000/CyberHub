// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { attackLayerApi, cveApi, mitreApi, cloakAnnotationsApi, cisaApi, lolbinsApi } from '@/api/client'
import KnowledgeAtlas from './KnowledgeAtlas'
import { filterItems, fromCLOAK, fromLOLBIN, groupBySource, relevance, sortItems, stringArray } from '@/knowledge26/model'
import type { CVEEntry, MITRETechnique } from '@/types'
import type { LOLBin } from '@/types/lolbins'
import type { AttackLayer } from '@/types/attackLayer'

vi.mock('@/api/client', () => ({
  cveApi: { list: vi.fn(), importNVD: vi.fn(), fetchFromNVD: vi.fn(), delete: vi.fn(), create: vi.fn(), update: vi.fn() },
  mitreApi: { techniques: vi.fn(), tactics: vi.fn(), technique: vi.fn() },
  cloakAnnotationsApi: { list: vi.fn(), upsert: vi.fn(), deleteByRef: vi.fn() },
  cisaApi: { checkKEV: vi.fn(), getEPSS: vi.fn(), batchCheckKEV: vi.fn() },
  lolbinsApi: { list: vi.fn(), getCategories: vi.fn() },
  attackLayerApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), import: vi.fn(), exportUrl: (id: number) => `/api/mitre/layers/${id}/export` },
}))
const cve = { id: 1, cve_id: 'CVE-2026-1234', description: 'Synthetic vulnerability', severity: 'critical', cvss_score: 9.8, status: 'new', products: 'Test product' } as CVEEntry
const technique = { technique_id: 'T1059', name: 'Command Interpreter', description: 'PowerShell test', tactics: '["execution"]', platforms: '["Windows","Linux"]', is_subtechnique: false } as MITRETechnique
const subTechnique = { ...technique, technique_id: 'T1059.001', name: 'PowerShell', is_subtechnique: true, parent_id: 'T1059' } as MITRETechnique
const cloak = { tactics: [{ id: 1, name: 'Anonymous browsing', description: '', type: '', techniques: [{ id: 20, name: 'Anti-fingerprinting', description: 'Tor browser', type: 'Technical', procedures: [{ id: 1, name: 'Browser profile', description: 'Synthetic procedure', type: '' }], subtechniques: [{ id: 21, name: 'Isolate sessions', description: 'Session procedure', type: 'Technical', procedures: [] }] }] }] }
const lolbin = { id: 7, name: 'Certutil.exe', os: 'windows', description: 'Download and decode files.', full_path: 'C:\\Windows\\System32\\certutil.exe', commands: JSON.stringify([{ Command: 'certutil.exe -urlcache -f http://lab/a a', Description: 'Download a file', Usecase: 'Download', Privileges: 'User', MitreID: 'T1105' }]), mitre_tech: '["T1105","T1059"]', tags: '["download"]', category: 'Download', command_count: 1 } as LOLBin
const layer = { id: 3, name: 'APT29', description: 'Q1 coverage', domain: 'enterprise-attack', version: '14', layer_data: JSON.stringify([{ technique_id: 'T1003', name: 'Credential Dumping', color: '', comment: '', score: 0, enabled: true }]), created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-02T00:00:00Z' } as AttackLayer

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(cveApi.list).mockResolvedValue({ cves: [cve], count: 500 })
  vi.mocked(mitreApi.techniques).mockResolvedValue({ items: [technique], total: 800, page: 1, limit: 100 })
  vi.mocked(mitreApi.tactics).mockResolvedValue([])
  vi.mocked(mitreApi.technique).mockImplementation(async id => id === 'T1059.001' ? subTechnique : { ...technique, technique_id: id, description: 'Full technique description', detection: 'Audit process execution' })
  vi.mocked(cloakAnnotationsApi.list).mockResolvedValue([])
  vi.mocked(cisaApi.checkKEV).mockResolvedValue({ exploited: false, entry: null })
  vi.mocked(cisaApi.getEPSS).mockResolvedValue({ cve_id: cve.cve_id, score: .42, percentile: .81, date: '2026-10-25' })
  vi.mocked(cisaApi.batchCheckKEV).mockResolvedValue({ [cve.cve_id]: true })
  vi.mocked(cveApi.importNVD).mockResolvedValue({ message: 'ok', created: 1, skipped: 0, total: 1 })
  vi.mocked(cveApi.fetchFromNVD).mockResolvedValue({ message: 'ok', created: 1, skipped: 0, total_remote: 1, total_available: 1 })
  vi.mocked(cveApi.delete).mockResolvedValue(undefined)
  vi.mocked(cveApi.create).mockImplementation(async payload => ({ ...cve, ...payload, id: 42, created_at: '', updated_at: '' }))
  vi.mocked(cveApi.update).mockImplementation(async (id, payload) => ({ ...cve, ...payload, id, created_at: '', updated_at: '' }))
  vi.mocked(cloakAnnotationsApi.upsert).mockImplementation(async request => ({ id: 1, ...request, created_at: '', updated_at: 'saved' }))
  vi.mocked(cloakAnnotationsApi.deleteByRef).mockResolvedValue(undefined)
  vi.mocked(lolbinsApi.list).mockResolvedValue({ items: [lolbin], total: 1, win_count: 1, linux_count: 0 })
  vi.mocked(lolbinsApi.getCategories).mockResolvedValue([{ os: 'windows', category: 'Download', count: 1 }])
  vi.mocked(attackLayerApi.list).mockResolvedValue({ items: [layer], total: 1 })
  vi.mocked(attackLayerApi.get).mockResolvedValue(layer)
  vi.mocked(attackLayerApi.create).mockImplementation(async payload => ({ ...layer, id: 9, name: payload.name, description: payload.description ?? '', layer_data: '[]' }))
  vi.mocked(attackLayerApi.update).mockImplementation(async (_id, data) => ({ ...layer, ...data }))
  vi.mocked(attackLayerApi.delete).mockResolvedValue(undefined)
  vi.mocked(attackLayerApi.import).mockResolvedValue({ layer, imported: 4 })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => cloak }))
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); this.querySelector('button')?.focus() }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

async function setup(entry = '/knowledge') { render(<MemoryRouter initialEntries={[entry]}><KnowledgeAtlas /></MemoryRouter>); await screen.findByText('5 fiches dans la sélection') }
const mode = (name: string) => fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }))
const pick = (label: string) => fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${label}\\s*[\\d…]`) }))
const search = (value: string) => fireEvent.change(screen.getByRole('textbox'), { target: { value } })
const dialog = () => screen.getByRole('dialog')
const openSort = () => fireEvent.click(screen.getByRole('button', { name: 'Trier' }))
const sortBy = (label: string) => { openSort(); fireEvent.click(screen.getByRole('option', { name: label })) }
const heading = () => within(dialog()).getByRole('heading', { level: 2 }).textContent

function HistoryProbe() {
  const location = useLocation()
  const navigate = useNavigate()
  return <aside><output data-testid="atlas-location">{location.pathname}{location.search}</output><button onClick={() => navigate(-1)}>Historique précédent</button><button onClick={() => navigate(1)}>Historique suivant</button></aside>
}

describe('Knowledge Atlas — consultation', () => {
  it('opens in the signature carousel mode by default', async () => {
    await setup()
    expect(screen.getByRole('button', { name: /01CAROUSEL/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('region', { name: 'Carousel de connaissances' })).toBeTruthy()
  })
  it('loads four read-only sources with bounded API queries and honest totals', async () => {
    await setup()
    expect(cveApi.list).toHaveBeenCalledWith({ page: 1, limit: 100 }, expect.any(AbortSignal))
    expect(mitreApi.techniques).toHaveBeenCalledWith({ page: 1, limit: 100 })
    expect(fetch).toHaveBeenCalledWith('/data/cloak.json', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(lolbinsApi.list).toHaveBeenCalledWith({ os: 'windows', category: 'Download' })
    expect(screen.getByText(/CVE 1 \/ 500/)).toBeTruthy()
    expect(screen.getByText(/LOLBINS 1 \/ 1/)).toBeTruthy()
  })
  it('announces the four sources in the hero', async () => {
    await setup()
    expect(screen.getByText('04 SOURCES')).toBeTruthy()
    expect(screen.getByText('CVE · ATT&CK')).toBeTruthy()
    expect(screen.getByText('CLOAK · LOLBINS')).toBeTruthy()
  })
  it('keeps available collections when one fails and supports retry', async () => {
    vi.mocked(cveApi.list).mockRejectedValueOnce(new Error('offline'))
    render(<MemoryRouter><KnowledgeAtlas /></MemoryRouter>)
    await screen.findByText(/CVE indisponible/)
    expect(screen.getByText('Command Interpreter')).toBeTruthy()
    fireEvent.click(screen.getByText('Réessayer'))
    await screen.findByText('5 fiches dans la sélection')
  })
  it('filters by source', async () => {
    await setup(); pick('ATT&CK')
    expect(screen.queryByText('Anti-fingerprinting')).toBeNull()
    expect(screen.getByText('Command Interpreter')).toBeTruthy()
  })
  it('searches IDs, descriptions and procedures', async () => {
    await setup(); search('powershell'); expect(screen.getByText('1 fiches dans la sélection')).toBeTruthy()
    search('Browser profile'); expect(screen.getByText('Anti-fingerprinting')).toBeTruthy()
    search('CVE-2026'); expect(screen.getByText('1 fiches dans la sélection')).toBeTruthy()
  })
  it('shows an empty search state', async () => { await setup(); search('missing-item'); expect(screen.getByText(/Aucune connaissance/)).toBeTruthy() })
  it('preserves selected record and query across views', async () => {
    await setup(); search('Tor'); mode('REGISTRY'); fireEvent.click(screen.getByRole('button', { name: /Anti-fingerprinting/ }))
    fireEvent.click(screen.getByRole('button', { name: /Fermer/ })); mode('CAROUSEL')
    expect(screen.getByRole('button', { name: 'Ouvrir TE-20' })).toBeTruthy()
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Tor')
    mode('REGISTRY'); expect(document.querySelector('.ka-row.is-selected')).toBeTruthy()
  })
  it('navigates carousel with arrow keys and buttons without opening the dossier', async () => {
    await setup(); const carousel = screen.getByRole('region', { name: 'Carousel de connaissances' })
    const activeId = () => screen.getByRole('button', { name: /^Ouvrir / }).getAttribute('aria-label')
    const first = activeId()
    fireEvent.keyDown(carousel, { key: 'ArrowRight' }); const afterKey = activeId(); expect(afterKey).not.toBe(first)
    fireEvent.click(screen.getByRole('button', { name: 'Suivante →' })); expect(activeId()).not.toBe(afterKey)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('keeps every carousel card a bounded preview without scrolling', async () => {
    await setup(); search('Tor')
    const card = document.querySelector('.ka-focus-card.is-active') as HTMLElement
    expect(card.querySelector('.ka-card-body')).toBeNull()
    expect(within(card).getByText('Tor browser')).toBeTruthy()
    expect(within(card).getByText('OUVRIR LE DOSSIER ↗')).toBeTruthy()
    expect(within(card).queryByText('Browser profile')).toBeNull()
  })
  it('does not invent relations or mutate source objects', () => {
    const before = JSON.stringify(cloak); const items = fromCLOAK(cloak)
    expect(items).toHaveLength(2); expect(JSON.stringify(cloak)).toBe(before)
    expect(items.every(item => !('related' in item))).toBe(true)
    expect(filterItems(items, 'CLOAK', 'session')[0].id).toBe('ST-21')
  })
  it('filters structural CLOAK containers while retaining real techniques and sub-techniques', () => {
    const source = { tactics: [
      { id: 0, name: 'Unknown', description: '', type: '', techniques: [{ id: 1, name: 'Unknown', description: '', type: '', procedures: [{ id: 1, name: 'Raw procedure', description: 'container payload', type: '' }], subtechniques: [] }] },
      ...cloak.tactics,
      { id: 2, name: 'Risk management', description: '', type: '', techniques: [{ id: 3, name: 'Techniques', description: '', type: '', procedures: [], subtechniques: [] }] },
    ] }
    const items = fromCLOAK(source)
    expect(items.map(item => item.title)).toEqual(['Anti-fingerprinting', 'Isolate sessions'])
    expect(items.some(item => /unknown|^techniques$/i.test(item.title))).toBe(false)
  })
  it('never exposes CLOAK dataset containers as techniques or parents', () => {
    const source = { tactics: [{ id: 13, name: 'Reduce attack surface', description: '', type: '', techniques: [
      { id: 'UL-ST-13', name: 'Unlinked Subtechniques', description: 'Subtechniques without a TechniqueID', type: '', procedures: [], subtechniques: [{ id: 455, name: 'OCR reader', description: 'Read text offline', type: 'Technical', procedures: [] }] },
      { id: 'TL-13', name: 'Tactic-level TTPs & Procedures', description: 'Items linked to this tactic', type: '', procedures: [{ id: 9, name: 'Tactic procedure', description: 'Linked to the tactic', type: '' }], subtechniques: [] },
    ] }] }
    const items = fromCLOAK(source as never)
    expect(items.map(item => item.title)).toEqual(['OCR reader'])
    expect(items.some(item => /unlinked|tactic-level|UL-ST|TL-/i.test(`${item.id} ${item.title}`))).toBe(false)
    const orphan = items.find(item => item.id === 'ST-455')!
    expect((orphan.original as { __parentId?: number }).__parentId).toBeUndefined()
    expect((orphan.original as { __ref: string }).__ref).toBe('tac-13:te-UL-ST-13:sub-455')
    expect(items.some(item => item.id.startsWith('TAC-'))).toBe(false)
  })
  it('exposes no synthetic or structural CLOAK record from the real dataset', () => {
    const real = JSON.parse(readFileSync(resolve(__dirname, '../../public/data/cloak.json'), 'utf-8'))
    const items = fromCLOAK(real)
    expect(items.length).toBeGreaterThan(500)
    const synthetic = items.filter(item => /^(TAC|TL|UL-ST)-/i.test(item.id) || /^(TE|ST)-(TL|UL)/i.test(item.id))
    const structural = items.filter(item => /^(unknown|techniques?|sub-techniques?|unlinked subtechniques|tactic-level ttps & procedures)$/i.test(item.title.trim()))
    expect(synthetic.map(item => item.id)).toEqual([])
    expect(structural.map(item => item.title)).toEqual([])
    expect(items.every(item => /^(TE|ST)-\d+$/.test(item.id))).toBe(true)
  })
  it('keeps structural CLOAK containers out of the Carousel and the Registry', async () => {
    const withContainers = { tactics: [{ ...cloak.tactics[0], techniques: [...cloak.tactics[0].techniques,
      { id: 'TL-1', name: 'Tactic-level TTPs & Procedures', description: 'Items linked to this tactic', type: '', procedures: [{ id: 2, name: 'Tactic procedure', description: 'x', type: '' }], subtechniques: [] },
      { id: 'UL-ST-1', name: 'Unlinked Subtechniques', description: 'Without parent', type: '', procedures: [], subtechniques: [] }] }] }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => withContainers }))
    await setup(); pick('CLOAK')
    expect(document.body.textContent).not.toMatch(/Tactic-level|Unlinked|TAC-|TL-1|UL-ST/)
    mode('REGISTRY')
    expect(Array.from(document.querySelectorAll('.ka-row code')).map(node => node.textContent).sort()).toEqual(['ST-21', 'TE-20'])
    expect(document.body.textContent).not.toMatch(/Tactic-level|Unlinked|TAC-|TL-1|UL-ST/)
  })
  it('shows no parent for an orphan CLOAK sub-technique in the dossier', async () => {
    const orphanData = { tactics: [{ id: 13, name: 'Reduce attack surface', description: '', type: '', techniques: [{ id: 'UL-ST-13', name: 'Unlinked Subtechniques', description: '', type: '', procedures: [], subtechniques: [{ id: 455, name: 'OCR reader', description: 'Read text offline', type: 'Technical', procedures: [] }] }] }] }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => orphanData }))
    render(<MemoryRouter><KnowledgeAtlas /></MemoryRouter>); await screen.findByText('4 fiches dans la sélection')
    search('OCR'); fireEvent.click(screen.getByRole('button', { name: 'Ouvrir ST-455' }))
    expect(within(dialog()).queryByRole('button', { name: /Retour à/ })).toBeNull()
    expect(dialog().textContent).not.toMatch(/Unlinked|UL-ST/i)
    expect(within(dialog()).getByText('Sous-technique')).toBeTruthy()
  })
  it('rejects invalid CLOAK and tolerates malformed ATT&CK arrays', () => {
    expect(() => fromCLOAK({} as never)).toThrow()
    expect(stringArray('invalid')).toEqual([]); expect(stringArray('[1,"Windows"]')).toEqual(['Windows'])
  })
  it('opens the central dossier from a deep link (source + id)', async () => {
    render(<MemoryRouter initialEntries={['/knowledge?source=mitre&id=T1059']}><KnowledgeAtlas /></MemoryRouter>)
    const opened = await screen.findByRole('dialog')
    expect(within(opened).getByText('T1059')).toBeTruthy()
    expect(within(opened).getByRole('link', { name: /ATT&CK OFFICIEL/ }).getAttribute('href')).toContain('attack.mitre.org')
  })
  it.each([
    ['/knowledge?source=cve&id=CVE-2026-1234', 'CVE-2026-1234'],
    ['/knowledge?source=cloak&id=TE-20', 'Anti-fingerprinting'],
    ['/knowledge?source=lolbins&id=Certutil.exe', 'Certutil.exe'],
  ])('restores the requested dossier from %s', async (entry, expected) => {
    render(<MemoryRouter initialEntries={[entry]}><KnowledgeAtlas /></MemoryRouter>)
    expect(within(await screen.findByRole('dialog')).getByRole('heading', { name: expected })).toBeTruthy()
  })
  it('opens CVE create and edit directly from the URL contract', async () => {
    const create = render(<MemoryRouter initialEntries={['/knowledge?source=cve&action=new']}><KnowledgeAtlas /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Nouvelle vulnérabilité' })).toBeTruthy()
    create.unmount()
    render(<MemoryRouter initialEntries={['/knowledge?source=cve&id=CVE-2026-1234&action=edit']}><KnowledgeAtlas /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Modifier la vulnérabilité' })).toBeTruthy()
  })
  it('restores dossiers with browser Back and Forward', async () => {
    render(<MemoryRouter initialEntries={['/knowledge']}><KnowledgeAtlas /><HistoryProbe /></MemoryRouter>)
    await screen.findByText('5 fiches dans la sélection')
    pick('CVE')
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir CVE-2026-1234' }))
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(screen.getByTestId('atlas-location').textContent).toBe('/knowledge?source=cve&id=CVE-2026-1234')
    fireEvent.click(screen.getByRole('button', { name: 'Historique précédent' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Historique suivant' }))
    expect(await screen.findByRole('dialog')).toBeTruthy()
  })
})

describe('Knowledge Atlas — unified registry and sorting', () => {
  it('opens ALL on CVE first, identically in the Carousel and the Registry (#95)', async () => {
    await setup()
    expect(document.querySelector('.ka-focus-card.is-active')?.getAttribute('aria-label')).toBe('Ouvrir CVE-2026-1234')
    mode('REGISTRY')
    const order = Array.from(document.querySelectorAll('.ka-row')).map(row => row.getAttribute('data-source'))
    expect(order).toEqual(['CVE', 'MITRE', 'CLOAK', 'CLOAK', 'LOLBINS'])
  })
  it('keeps the search ranking ahead of the product order (#95)', async () => {
    await setup(); search('certutil'); mode('REGISTRY')
    expect(document.querySelector('.ka-row')?.getAttribute('data-source')).toBe('LOLBINS')
  })
  it('renders ALL with one identical row structure for every source', async () => {
    await setup(); mode('REGISTRY')
    const rows = Array.from(document.querySelectorAll('.ka-row'))
    expect(rows).toHaveLength(5)
    expect(new Set(rows.map(row => row.getAttribute('data-source')))).toEqual(new Set(['CVE', 'MITRE', 'CLOAK', 'LOLBINS']))
    for (const row of rows) {
      expect(Array.from(row.children).map(child => child.className.split(' ')[0] || child.tagName)).toEqual(['ka-badge', 'CODE', 'ka-row-title', 'ka-row-context', 'ka-row-signal', 'SPAN'])
    }
    expect(document.querySelector('.ka-cve-row, .ka-domain-row')).toBeNull()
  })
  it('sorts the selection and keeps the order when switching views', async () => {
    await setup()
    sortBy('Nom Z→A')
    mode('REGISTRY')
    const titles = Array.from(document.querySelectorAll('.ka-row')).map(row => row.getAttribute('data-title') || '')
    expect(titles).toHaveLength(5)
    expect(titles).toEqual([...titles].sort((a, b) => b.localeCompare(a, 'fr', { numeric: true })))
  })
  it('ranks exact identifiers first with the relevance sort', async () => {
    await setup(); search('T1059'); mode('REGISTRY')
    const rows = Array.from(document.querySelectorAll('.ka-row'))
    expect(rows.map(row => row.getAttribute('data-source'))).toEqual(['MITRE', 'LOLBINS'])
    openSort(); expect(screen.getByRole('option', { name: 'Pertinence' }).getAttribute('aria-selected')).toBe('true')
  })
  it('groups the unified registry by source with real headers', async () => {
    await setup(); mode('REGISTRY')
    fireEvent.click(screen.getByRole('checkbox', { name: /Grouper par source/ }))
    expect(screen.getAllByRole('heading', { level: 3 }).map(node => node.textContent)).toEqual(['CVECVE — 1', 'ATT&CKATT&CK — 1', 'CLOAKCLOAK — 2', 'LOLBINSLOLBINS — 1'])
  })
  it('drives the sort popover from the keyboard and returns focus', async () => {
    await setup()
    const trigger = screen.getByRole('button', { name: 'Trier' })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    const list = screen.getByRole('listbox', { name: 'Ordre de tri' })
    fireEvent.keyDown(list, { key: 'ArrowDown' }); fireEvent.keyDown(list, { key: 'Enter' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(trigger.textContent).toContain('Identifiant A→Z')
    expect(document.activeElement).toBe(trigger)
    openSort(); fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })
  it('offers source-specific sorts (CVSS for CVE)', async () => {
    await setup(); pick('CVE')
    openSort(); expect(screen.getByRole('option', { name: 'CVSS décroissant' })).toBeTruthy()
  })
  it('applies contextual CVE filters and counts active ones', async () => {
    await setup(); pick('CVE')
    fireEvent.click(screen.getByRole('button', { name: /FILTERS/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'critical' }))
    expect(screen.getByText('1 fiches dans la sélection')).toBeTruthy()
    expect(screen.getByRole('button', { name: /FILTERS/ }).textContent).toContain('01')
    fireEvent.click(screen.getByRole('button', { name: /Réinitialiser · 1/ }))
    expect(screen.getByText('1 fiches dans la sélection')).toBeTruthy()
    expect(screen.getByRole('button', { name: /FILTERS/ }).textContent).not.toContain('01')
  })
  it('ranks, groups and models records purely', () => {
    const items = [...fromCLOAK(cloak), fromLOLBIN(lolbin)]
    expect(relevance(items[2], 'certutil.exe')).toBe(100)
    expect(sortItems(items, 'relevance', 'session')[0].id).toBe('ST-21')
    expect(groupBySource(items).map(group => group.source)).toEqual(['CLOAK', 'LOLBINS'])
    expect(fromLOLBIN(lolbin).facets).toEqual({ os: 'Windows', category: 'Download', mitre: 'T1105|T1059' })
  })
})

describe('Knowledge Atlas — CVE parity', () => {
  it('shows CVE intelligence and source actions', async () => {
    await setup(); mode('REGISTRY'); fireEvent.click(screen.getByRole('button', { name: /Synthetic vulnerability/ }))
    expect(within(dialog()).getByText('Test product')).toBeTruthy()
    expect(within(dialog()).getByText('Chronologie')).toBeTruthy()
    expect(screen.getByRole('link', { name: /NVD/ }).getAttribute('href')).toContain('nvd.nist.gov/vuln/detail/CVE-2026-1234')
    expect(within(dialog()).getByRole('button', { name: /Modifier/ })).toBeTruthy()
    expect(dialog().querySelector('a[href^="/cve"]')).toBeNull()
    expect(dialog().querySelector('.ka-dossier-folder')?.getAttribute('data-severity')).toBe('critical')
  })
  it('creates a CVE inside Atlas with the legacy validation rules', async () => {
    await setup(); pick('CVE'); fireEvent.click(screen.getByRole('button', { name: /NOUVELLE CVE/ }))
    const editor = screen.getByRole('dialog', { name: 'Nouvelle vulnérabilité' })
    fireEvent.change(within(editor).getByRole('textbox', { name: /CVE-ID/ }), { target: { value: 'bad-id' } })
    fireEvent.click(within(editor).getByRole('button', { name: /Créer la fiche/ }))
    expect(within(editor).getByRole('alert').textContent).toContain('CVE-AAAA-NNNN')
    fireEvent.change(within(editor).getByRole('textbox', { name: /CVE-ID/ }), { target: { value: 'CVE-2026-9999' } })
    fireEvent.change(within(editor).getByRole('textbox', { name: /Score CVSS/ }), { target: { value: '11' } })
    fireEvent.click(within(editor).getByRole('button', { name: /Créer la fiche/ }))
    expect(within(editor).getByRole('alert').textContent).toContain('entre 0 et 10')
    fireEvent.change(within(editor).getByRole('textbox', { name: /Score CVSS/ }), { target: { value: '9,1' } })
    fireEvent.click(within(editor).getByRole('button', { name: /Plage CVSS : Critique/ }))
    fireEvent.click(within(editor).getByRole('radio', { name: 'ANALYSÉ' }))
    fireEvent.change(within(editor).getByRole('textbox', { name: /Produits affectés/ }), { target: { value: 'Alpha, Beta' } })
    fireEvent.click(within(editor).getByRole('button', { name: /Créer la fiche/ }))
    await waitFor(() => expect(cveApi.create).toHaveBeenCalledWith(expect.objectContaining({ cve_id: 'CVE-2026-9999', cvss_score: 9.1, severity: 'critical', status: 'analyzed', products: 'Alpha, Beta' })))
    expect(await screen.findByRole('heading', { level: 2, name: 'CVE-2026-9999' })).toBeTruthy()
    expect(screen.getByText('2 fiches dans la sélection')).toBeTruthy()
  })
  it('edits a CVE from its dossier and reopens the updated record', async () => {
    await setup(); pick('CVE'); mode('REGISTRY'); fireEvent.click(screen.getByRole('button', { name: /Synthetic vulnerability/ }))
    fireEvent.click(within(dialog()).getByRole('button', { name: /Modifier/ }))
    const editor = screen.getByRole('dialog', { name: 'Modifier la vulnérabilité' })
    expect((within(editor).getByRole('textbox', { name: /CVE-ID/ }) as HTMLInputElement).readOnly).toBe(true)
    fireEvent.change(within(editor).getByRole('textbox', { name: /Description/ }), { target: { value: 'Updated description' } })
    fireEvent.click(within(editor).getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(cveApi.update).toHaveBeenCalledWith(1, expect.objectContaining({ cve_id: 'CVE-2026-1234', description: 'Updated description', cvss_score: 9.8 })))
    expect(await within(screen.getByRole('dialog')).findByText('Updated description')).toBeTruthy()
  })
  it('cancels the CVE editor without saving', async () => {
    await setup(); pick('CVE'); fireEvent.click(screen.getByRole('button', { name: /NOUVELLE CVE/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(cveApi.create).not.toHaveBeenCalled()
  })
  it('contains keyboard focus and returns it to the originating record', async () => {
    await setup(); mode('REGISTRY'); const trigger = screen.getByRole('button', { name: /Synthetic vulnerability/ }); trigger.focus(); fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: /Fermer/ })); expect(document.activeElement).toBe(trigger)
  })
  it('exposes the three CVE operational actions only in the CVE context', async () => {
    await setup(); pick('CVE')
    expect(screen.getByRole('button', { name: /IMPORT NVD EN LIGNE/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /FICHIER NVD JSON/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /NOUVELLE CVE/ })).toBeTruthy()
    expect(document.querySelector('a[href="/cve/new"]')).toBeNull()
    pick('ATT&CK')
    expect(screen.queryByRole('button', { name: /IMPORT NVD/ })).toBeNull()
  })
  it('imports an NVD JSON file and refreshes the shared CVE collection', async () => {
    await setup(); pick('CVE')
    const file = new File(['{"vulnerabilities":[]}'], 'nvd.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: async () => '{"vulnerabilities":[]}' })
    fireEvent.change(screen.getByLabelText('Fichier NVD JSON'), { target: { files: [file] } })
    await waitFor(() => expect(cveApi.importNVD).toHaveBeenCalledWith({ vulnerabilities: [] }))
    await waitFor(() => expect(cveApi.list).toHaveBeenCalledTimes(2))
  })
  it('reuses the online NVD modal and refreshes Atlas after a successful import', async () => {
    await setup(); pick('CVE'); fireEvent.click(screen.getByRole('button', { name: /IMPORT NVD/ }))
    fireEvent.change(screen.getByLabelText(/Date début/), { target: { value: '2026-10-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'IMPORTER DEPUIS NVD' }))
    await waitFor(() => expect(cveApi.fetchFromNVD).toHaveBeenCalledWith(expect.objectContaining({ pub_start_date: expect.stringContaining('2026-10-01') })))
    await waitFor(() => expect(cveApi.list).toHaveBeenCalledTimes(2))
  })
  it('deletes a CVE through ConfirmModal and removes it from the shared state', async () => {
    await setup(); pick('CVE'); mode('REGISTRY')
    fireEvent.click(screen.getByRole('button', { name: /Synthetic vulnerability/ }))
    fireEvent.click(within(dialog()).getByRole('button', { name: /Supprimer/ }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'SUPPRIMER' }))
    await waitFor(() => expect(cveApi.delete).toHaveBeenCalledWith(1))
    expect(screen.queryByText('Synthetic vulnerability')).toBeNull()
  })
  it('keeps KEV and EPSS failures distinct from negative enrichment results', async () => {
    vi.mocked(cisaApi.checkKEV).mockRejectedValueOnce(new Error('offline'))
    vi.mocked(cisaApi.getEPSS).mockRejectedValueOnce(new Error('offline'))
    await setup(); pick('CVE'); mode('REGISTRY')
    fireEvent.click(screen.getByRole('button', { name: /Synthetic vulnerability/ }))
    expect(await within(dialog()).findAllByText('Indisponible (erreur réseau)')).toHaveLength(2)
    expect(within(dialog()).queryByText(/Absente du catalogue/)).toBeNull()
  })
  it('renders complete KEV and EPSS enrichment without confusing probability and exploitation', async () => {
    vi.mocked(cisaApi.checkKEV).mockResolvedValueOnce({ exploited: true, entry: { id: 1, cve_id: cve.cve_id, vendor_project: 'Vendor', product: 'Product', vulnerability_name: 'Active exploit', date_added: '2026-10-01', short_description: '', required_action: 'Apply mitigations', due_date: '2026-11-01', notes: '' } })
    await setup(); pick('CVE'); mode('REGISTRY'); fireEvent.click(screen.getByRole('button', { name: /Synthetic vulnerability/ }))
    expect(await within(dialog()).findByText('Vendor · Product')).toBeTruthy()
    expect(within(dialog()).getByText(/42.0 % · percentile 81.0 · FIRST.org/)).toBeTruthy()
    expect(within(dialog()).getByText('Apply mitigations')).toBeTruthy()
    expect(within(dialog()).getByText('2026-11-01')).toBeTruthy()
  })
})

describe('Knowledge Atlas — ATT&CK parity', () => {
  it('keeps metadata and the official link when MITRE detail is unavailable', async () => {
    vi.mocked(mitreApi.technique).mockRejectedValueOnce(new Error('offline'))
    await setup(); mode('REGISTRY'); fireEvent.click(screen.getByRole('button', { name: /Command Interpreter/ }))
    expect(await screen.findByText(/Fiche détaillée indisponible/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /ATT&CK OFFICIEL/ }).getAttribute('href')).toContain('attack.mitre.org')
  })
  it('preserves ATT&CK IDs, platforms, detection and the official link', async () => {
    await setup(); mode('REGISTRY'); fireEvent.click(screen.getByRole('button', { name: /Command Interpreter/ }))
    expect(within(dialog()).getAllByText('Windows / Linux').length).toBeGreaterThan(0)
    expect(await screen.findByText('Full technique description')).toBeTruthy()
    expect(screen.getByText('Audit process execution')).toBeTruthy()
  })
  it('navigates from a technique to its sub-technique inside Atlas and back', async () => {
    vi.mocked(mitreApi.techniques).mockImplementation(async params => params?.q === 'T1059.' ? { items: [subTechnique], total: 1, page: 1, limit: 100 } : { items: [technique], total: 800, page: 1, limit: 100 })
    await setup(); mode('REGISTRY'); fireEvent.click(screen.getByRole('button', { name: /Command Interpreter/ }))
    fireEvent.click(await within(dialog()).findByRole('button', { name: /Ouvrir T1059.001 PowerShell dans Atlas/ }))
    await waitFor(() => expect(heading()).toBe('PowerShell'))
    expect(mitreApi.technique).toHaveBeenCalledWith('T1059.001')
    fireEvent.click(within(dialog()).getByRole('button', { name: /Retour à Command Interpreter/ }))
    expect(heading()).toBe('Command Interpreter')
  })
  it('never shows null-like ATT&CK values and counts only real data sources', async () => {
    vi.mocked(mitreApi.technique).mockResolvedValueOnce({ ...technique, description: 'null', detection: 'undefined', data_sources: 'null' } as unknown as MITRETechnique)
    await setup(); mode('REGISTRY'); fireEvent.click(screen.getByRole('button', { name: /Command Interpreter/ }))
    await waitFor(() => expect(mitreApi.technique).toHaveBeenCalled())
    await within(dialog()).findByText('Non renseignées.')
    expect(dialog().textContent).not.toMatch(/\bnull\b|\bundefined\b/)
    expect(within(dialog()).getByRole('heading', { level: 4, name: 'Sources de données' })).toBeTruthy()
  })
  it('keeps real ATT&CK data sources and drops empty entries from the count', async () => {
    vi.mocked(mitreApi.technique).mockResolvedValueOnce({ ...technique, data_sources: 'Process: Process Creation, null, , Command: Command Execution' })
    await setup(); mode('REGISTRY'); fireEvent.click(screen.getByRole('button', { name: /Command Interpreter/ }))
    await waitFor(() => expect(Array.from(dialog().querySelectorAll('h4')).map(h => h.textContent)).toContain('Sources de données · 2'))
    expect(within(dialog()).getByText('Command: Command Execution')).toBeTruthy()
  })
  it('lists the LOLBins implementing a technique', async () => {
    await setup(); mode('REGISTRY'); fireEvent.click(screen.getByRole('button', { name: /Command Interpreter/ }))
    fireEvent.click(within(dialog()).getByRole('button', { name: /Ouvrir Certutil.exe/ }))
    expect(heading()).toBe('Certutil.exe')
  })
  it('filters MITRE by platform and excludes sub-techniques explicitly', async () => {
    vi.mocked(mitreApi.techniques).mockResolvedValueOnce({ items: [technique, subTechnique], total: 2, page: 1, limit: 100 })
    render(<MemoryRouter><KnowledgeAtlas /></MemoryRouter>); await screen.findByText('6 fiches dans la sélection')
    pick('ATT&CK'); fireEvent.click(screen.getByRole('button', { name: /FILTERS/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Exclure les sous-techniques/ }))
    expect(screen.queryByText('PowerShell')).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Windows' }))
    expect(screen.getByText('Command Interpreter')).toBeTruthy()
  })
  it('loads the next MITRE page progressively without mounting 855 carousel cards', async () => {
    await setup(); pick('ATT&CK')
    vi.mocked(mitreApi.techniques).mockResolvedValueOnce({ items: [{ ...technique, technique_id: 'T1060', name: 'Next page' }], total: 800, page: 2, limit: 100 })
    fireEvent.click(screen.getByRole('button', { name: /Charger 100 fiches/ }))
    await waitFor(() => expect(mitreApi.techniques).toHaveBeenLastCalledWith({ page: 2, limit: 100 }))
    expect(document.querySelectorAll('.ka-focus-card').length).toBeLessThanOrEqual(5)
  })
  it('resolves an exact MITRE sub-technique deep-link outside the loaded page', async () => {
    render(<MemoryRouter initialEntries={['/knowledge?source=mitre&id=T1059.001']}><KnowledgeAtlas /></MemoryRouter>)
    expect(within(await screen.findByRole('dialog')).getByText('T1059.001')).toBeTruthy()
    expect(mitreApi.technique).toHaveBeenCalledWith('T1059.001')
  })
})

describe('Knowledge Atlas — CLOAK parity', () => {
  it('opens a CLOAK technique with its procedures and annotation action', async () => {
    await setup(); mode('REGISTRY'); fireEvent.click(screen.getByRole('button', { name: /Anti-fingerprinting/ }))
    expect(within(dialog()).getByText('Browser profile')).toBeTruthy()
    expect(within(dialog()).getByRole('button', { name: /Annoter/ })).toBeTruthy()
    fireEvent(dialog(), new Event('cancel', { bubbles: false, cancelable: true })); expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('lists every sub-technique of a parent with its type and annotation status', async () => {
    vi.mocked(cloakAnnotationsApi.list).mockResolvedValueOnce([{ id: 2, technique_ref: 'tac-1:te-20:sub-21', status: 'vu_en_lab', user_notes: '', counter_notes: '', tags: '', created_at: '', updated_at: '' }])
    await setup(); search('Tor'); fireEvent.click(screen.getByRole('button', { name: 'Ouvrir TE-20' }))
    expect(within(dialog()).getByText('SOUS-TECHNIQUES · 1')).toBeTruthy()
    const row = within(dialog()).getByRole('button', { name: /ST-21.*Isolate sessions.*OUVRIR/ })
    expect(within(row).getByText('Technical')).toBeTruthy()
    expect(within(row).getByText('Vu en lab')).toBeTruthy()
  })
  it('opens a sub-technique in the same dossier and walks back to its parent', async () => {
    await setup(); search('Tor'); fireEvent.click(screen.getByRole('button', { name: 'Ouvrir TE-20' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: /ST-21.*Isolate sessions.*OUVRIR/ }))
    expect(heading()).toBe('Isolate sessions')
    fireEvent.click(within(dialog()).getByRole('button', { name: /Retour à Anti-fingerprinting/ }))
    expect(heading()).toBe('Anti-fingerprinting')
  })
  it('offers the parent of a sub-technique opened directly', async () => {
    await setup(); search('session'); fireEvent.click(screen.getByRole('button', { name: 'Ouvrir ST-21' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: /Retour à Anti-fingerprinting/ }))
    expect(heading()).toBe('Anti-fingerprinting')
  })
  it('saves a parent CLOAK annotation and reflects its status in the shared views', async () => {
    await setup(); search('Tor'); fireEvent.click(screen.getByRole('button', { name: 'Ouvrir TE-20' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Annoter' }))
    fireEvent.click(screen.getByRole('button', { name: 'À tester' }))
    fireEvent.change(screen.getByLabelText('Notes personnelles'), { target: { value: 'Lab note' } })
    fireEvent.change(screen.getByLabelText('Contre-mesures'), { target: { value: 'Isolate' } })
    fireEvent.change(screen.getByLabelText('Tags personnels'), { target: { value: 'lab' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }))
    await waitFor(() => expect(cloakAnnotationsApi.upsert).toHaveBeenCalledWith({ technique_ref: 'tac-1:te-20', status: 'a_tester', user_notes: 'Lab note', counter_notes: 'Isolate', tags: 'lab' }))
    expect(await within(dialog()).findByText('Lab note')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Fermer/ }))
    expect(screen.getByText('À tester')).toBeTruthy()
    mode('REGISTRY'); expect(document.querySelector('.ka-signal-chips .is-annotated')?.textContent).toBe('À tester')
  })
  it('cancels an annotation edit without saving', async () => {
    await setup(); search('Tor'); fireEvent.click(screen.getByRole('button', { name: 'Ouvrir TE-20' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Annoter' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Annuler' }))
    expect(cloakAnnotationsApi.upsert).not.toHaveBeenCalled()
    expect(within(dialog()).getByRole('button', { name: 'Annoter' })).toBeTruthy()
  })
  it('keeps sub-technique annotation refs separate and supports reset via ConfirmModal', async () => {
    vi.mocked(cloakAnnotationsApi.list).mockResolvedValueOnce([{ id: 2, technique_ref: 'tac-1:te-20:sub-21', status: 'vu_en_lab', user_notes: 'sub', counter_notes: '', tags: '', created_at: '', updated_at: '' }])
    await setup(); search('session'); fireEvent.click(screen.getByRole('button', { name: 'Ouvrir ST-21' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: /Modifier l’annotation/ }))
    fireEvent.click(screen.getByRole('button', { name: /Réinitialiser/ }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /RÉINITIALISER/ }))
    await waitFor(() => expect(cloakAnnotationsApi.deleteByRef).toHaveBeenCalledWith('tac-1:te-20:sub-21'))
    expect(cloakAnnotationsApi.deleteByRef).not.toHaveBeenCalledWith('tac-1:te-20')
    expect(await within(dialog()).findByRole('button', { name: 'Annoter' })).toBeTruthy()
  })
})

describe('Knowledge Atlas — LOLBins source', () => {
  it('filters LOLBins by OS, category and ATT&CK technique', async () => {
    await setup(); pick('LOLBINS')
    expect(screen.getByText('1 fiches dans la sélection')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /FILTERS/ }))
    for (const value of ['Windows', 'Download', 'T1105', 'T1059']) expect(screen.getByRole('checkbox', { name: value })).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: 'T1105' }))
    expect(screen.getByText('1 fiches dans la sélection')).toBeTruthy()
  })
  it('searches inside a long ATT&CK filter list with real checkboxes', async () => {
    const many = Array.from({ length: 14 }, (_, i) => `T${1200 + i}`)
    vi.mocked(lolbinsApi.list).mockResolvedValue({ items: [{ ...lolbin, mitre_tech: JSON.stringify(many) }], total: 1, win_count: 1, linux_count: 0 })
    await setup(); pick('LOLBINS'); fireEvent.click(screen.getByRole('button', { name: /FILTERS/ }))
    const group = screen.getByRole('group', { name: /Technique ATT&CK/ })
    expect(within(group).getAllByRole('checkbox')).toHaveLength(14)
    fireEvent.change(within(group).getByRole('searchbox'), { target: { value: '1213' } })
    expect(within(group).getAllByRole('checkbox')).toHaveLength(1)
    fireEvent.click(within(group).getByRole('checkbox', { name: 'T1213' }))
    expect(within(group).getByText('01')).toBeTruthy()
    expect(screen.getByText('1 fiches dans la sélection')).toBeTruthy()
  })
  it('shows a LOLBins preview card without the full command', async () => {
    await setup(); pick('LOLBINS')
    const card = document.querySelector('.ka-focus-card.is-active') as HTMLElement
    for (const text of ['LOLBINS', 'Certutil.exe', 'Windows', '1 commande', 'T1105 +1', 'LOLBAS']) expect(within(card).getAllByText(text).length).toBeGreaterThan(0)
    expect(card.textContent).not.toContain('-urlcache')
  })
  it('opens a LOLBins dossier with commands, copy and in-Atlas ATT&CK links', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await setup(); pick('LOLBINS'); fireEvent.click(screen.getByRole('button', { name: 'Ouvrir Certutil.exe' }))
    expect(within(dialog()).getByText('certutil.exe -urlcache -f http://lab/a a')).toBeTruthy()
    expect(within(dialog()).getByText('C:\\Windows\\System32\\certutil.exe')).toBeTruthy()
    expect(within(dialog()).getByText('download')).toBeTruthy()
    fireEvent.click(within(dialog()).getByRole('button', { name: /Copier la commande Download/ }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('certutil.exe -urlcache -f http://lab/a a'))
    expect(dialog().querySelector('a[href^="/mitre"], a[href^="/lolbins"], a[href^="/cloak"]')).toBeNull()
    fireEvent.click(within(dialog()).getByRole('button', { name: /Ouvrir T1059 Command Interpreter dans Atlas/ }))
    await waitFor(() => expect(heading()).toBe('Command Interpreter'))
    fireEvent.click(within(dialog()).getByRole('button', { name: /Retour à Certutil.exe/ }))
    expect(heading()).toBe('Certutil.exe')
  })
  it('resolves an ATT&CK technique that is not loaded when following a LOLBins link', async () => {
    await setup(); pick('LOLBINS'); fireEvent.click(screen.getByRole('button', { name: 'Ouvrir Certutil.exe' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: /Ouvrir T1105 dans Atlas/ }))
    await waitFor(() => expect(mitreApi.technique).toHaveBeenCalledWith('T1105'))
    await waitFor(() => expect(within(dialog()).getByText('T1105')).toBeTruthy())
  })
})

describe('Knowledge Atlas — ATT&CK Layers workspace', () => {
  const openWorkspace = async () => { await setup(); fireEvent.click(screen.getByRole('button', { name: /^LAYERS ATT&CK$/ })); await screen.findByText('APT29') }
  it('lists layers with counts and dates, outside the knowledge views', async () => {
    await openWorkspace()
    expect(screen.queryByRole('region', { name: 'Carousel de connaissances' })).toBeNull()
    expect(screen.getByText('1 technique', { exact: false })).toBeTruthy()
    expect(screen.getByText(/Mis à jour le 02\/10\/2026/)).toBeTruthy()
  })
  it('opens the Layers workspace and a layer directly from their URLs', async () => {
    const list = render(<MemoryRouter initialEntries={['/knowledge?workspace=layers']}><KnowledgeAtlas /></MemoryRouter>)
    expect(await screen.findByRole('button', { name: 'Ouvrir le layer APT29' })).toBeTruthy()
    list.unmount()
    render(<MemoryRouter initialEntries={['/knowledge?workspace=layers&id=3']}><KnowledgeAtlas /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'APT29' })).toBeTruthy()
    expect(attackLayerApi.get).toHaveBeenCalledWith(3)
  })
  it('creates, imports and deletes layers', async () => {
    await openWorkspace()
    fireEvent.click(screen.getByRole('button', { name: /NOUVEAU LAYER/ }))
    fireEvent.change(screen.getByLabelText(/Nom/), { target: { value: 'New layer' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer le layer' }))
    await waitFor(() => expect(attackLayerApi.create).toHaveBeenCalledWith({ name: 'New layer', description: '' }))
    const file = new File(['{}'], 'navigator.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: async () => '{"name":"Nav","techniques":[]}' })
    fireEvent.change(screen.getByLabelText('Fichier Navigator JSON'), { target: { files: [file] } })
    await waitFor(() => expect(attackLayerApi.import).toHaveBeenCalledWith({ name: 'Nav', techniques: [] }))
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer le layer APT29' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'SUPPRIMER' }))
    await waitFor(() => expect(attackLayerApi.delete).toHaveBeenCalledWith(3))
  })
  it('exports a layer through the authenticated endpoint', async () => {
    const createObjectURL = vi.fn(() => 'blob:layer'); const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    await openWorkspace()
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['{}']) } as Response)
    fireEvent.click(screen.getByRole('button', { name: 'Exporter le layer APT29' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/mitre/layers/3/export', expect.objectContaining({ headers: expect.objectContaining({ Authorization: expect.stringContaining('Bearer') }) })))
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled())
  })
  it('edits a layer: browse, add, remove, metadata and save', async () => {
    await openWorkspace(); fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le layer APT29' }))
    await screen.findByRole('heading', { name: 'APT29' })
    expect(screen.getByText('SAUVEGARDÉ')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Parcourir la matrice/ }))
    fireEvent.click(await screen.findByRole('button', { name: /T1059 Command Interpreter : ajouter au layer/ }))
    expect(screen.getAllByText('NON SAUVEGARDÉ').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('tab', { name: /Techniques sélectionnées/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Retirer T1003 du layer' }))
    fireEvent.click(screen.getAllByRole('button', { name: /Sauvegarder/ })[0])
    await waitFor(() => expect(attackLayerApi.update).toHaveBeenCalledWith(3, { layer_data: JSON.stringify([{ technique_id: 'T1059', name: 'Command Interpreter', color: '', comment: '', score: 0, enabled: true }]) }))
    fireEvent.click(screen.getByRole('button', { name: /MÉTADONNÉES/ }))
    fireEvent.change(screen.getByLabelText(/Nom/), { target: { value: 'APT29 v2' } })
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }))
    await waitFor(() => expect(attackLayerApi.update).toHaveBeenCalledWith(3, { name: 'APT29 v2', description: 'Q1 coverage' }))
  })
  it('opens a layer technique as an ATT&CK dossier in Atlas', async () => {
    await openWorkspace(); fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le layer APT29' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Ouvrir T1003 dans Atlas' }))
    await waitFor(() => expect(mitreApi.technique).toHaveBeenCalledWith('T1003'))
    expect(within(await screen.findByRole('dialog')).getByText('T1003')).toBeTruthy()
  })
  it('shows an integrated empty state for a layer without techniques', async () => {
    vi.mocked(attackLayerApi.get).mockResolvedValueOnce({ ...layer, layer_data: '[]' })
    await openWorkspace(); fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le layer APT29' }))
    expect(await screen.findByText('Aucune technique sélectionnée')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Parcourir la matrice/ }))
    expect(screen.getByRole('tab', { name: /Parcourir la matrice/ }).getAttribute('aria-selected')).toBe('true')
  })
  it('asks before leaving a layer with unsaved changes', async () => {
    await openWorkspace(); fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le layer APT29' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Retirer T1003 du layer' }))
    fireEvent.click(screen.getByRole('button', { name: /Tous les layers/ }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'QUITTER' }))
    expect(await screen.findByRole('button', { name: 'Ouvrir le layer APT29' })).toBeTruthy()
    expect(attackLayerApi.update).not.toHaveBeenCalled()
  })
})
