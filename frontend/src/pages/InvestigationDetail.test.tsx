// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import InvestigationDetail from './InvestigationDetail'
import { investigationApi } from '@/api/client'
import type { EventListResponse, Investigation, InvestigationEvent } from '@/types/investigation'
import { localInputValue } from '@/inv26/EventDialog'
import { sourceLink } from '@/inv26/Timeline'

vi.mock('@/api/client', () => ({
  investigationApi: { get: vi.fn(), update: vi.fn(), listEvents: vi.fn(), createEvent: vi.fn(), deleteEvent: vi.fn() },
}))
vi.mock('@/store/toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))

// Fictional case and events only.
const CASE: Investigation = { id: 12, title: 'Détournement AS64500', description: 'Annonces inattendues.', status: 'open', tags: 'bgp, réseau', created_at: '2026-10-20T10:00:00Z', updated_at: '2026-10-22T10:00:00Z' }
const ev = (id: number, timestamp: string, title: string, extra: Partial<InvestigationEvent> = {}): InvestigationEvent => ({
  id, investigation_id: 12, timestamp, title, description: '', event_type: 'manual', severity: 'info', source_module: '', source_entity_id: '', metadata: '', created_at: timestamp, updated_at: timestamp, ...extra,
})
const EVENTS = [
  ev(1, '2026-10-21T08:00:00Z', 'Alerte BGP', { event_type: 'bgp', severity: 'high', source_module: 'bgp', source_entity_id: '41' }),
  ev(2, '2026-10-21T12:00:00Z', 'CVE liée', { event_type: 'cve', severity: 'critical', source_module: 'cve', source_entity_id: 'CVE-2024-6387', metadata: '{"cvss":8.1}' }),
  ev(3, '2026-10-23T09:00:00Z', 'Contact opérateur'),
]
const events = (items: InvestigationEvent[]): EventListResponse => ({ items, total: items.length })
const deferred = <T,>() => { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
const api = vi.mocked(investigationApi)
const renderDetail = (path = '/investigations/12') => render(
  <MemoryRouter initialEntries={[path]}><Routes><Route path="/investigations/:id" element={<InvestigationDetail />} /></Routes></MemoryRouter>,
)

describe('Investigations 2026 — fiche', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('affiche le dossier, ses faits et la chronologie groupée par jour', async () => {
    api.get.mockResolvedValue(CASE)
    api.listEvents.mockResolvedValue(events(EVENTS))
    renderDetail()
    expect(await screen.findByRole('heading', { name: 'Détournement AS64500' })).toBeTruthy()
    const days = await screen.findAllByRole('region', { name: /octobre 2026/ })
    expect(days).toHaveLength(2)
    expect(within(days[0]).getAllByRole('article')).toHaveLength(2)
    expect(screen.getByText('Élevés ou critiques').nextElementSibling?.textContent).toBe('2')
    // A CVE source links to the catalogue; metadata is shown as written, formatted.
    expect(screen.getByRole('link', { name: 'Source : cve · CVE-2024-6387' }).getAttribute('href')).toBe('/cve?find=CVE-2024-6387')
    // A bare BGP number could be an alert, a snapshot or an ASN: no link is claimed.
    expect(screen.queryByRole('link', { name: 'Source : bgp · 41' })).toBeNull()
    expect(screen.getByText('Source : bgp · 41')).toBeTruthy()
    // The event type stays the one chosen by the user.
    expect(screen.getByText('CVE liée').closest('article')?.textContent).toContain('CVE')
  })

  it('ne crée des liens intermodules que pour des références explicites', () => {
    expect(sourceLink({ source_module: 'cve', source_entity_id: 'CVE-2024-6387' })).toBe('/cve?find=CVE-2024-6387')
    expect(sourceLink({ source_module: 'CVE', source_entity_id: 'cve-2024-123456' })).toBe('/cve?find=CVE-2024-123456')
    expect(sourceLink({ source_module: 'cve', source_entity_id: '7' })).toBe('/cve/7')
    expect(sourceLink({ source_module: 'cve', source_entity_id: '0' })).toBeNull()
    expect(sourceLink({ source_module: 'cve', source_entity_id: '203.0.113.7' })).toBeNull()
    expect(sourceLink({ source_module: 'bgp', source_entity_id: 'AS64500' })).toBe('/bgp/historian?asn=64500')
    expect(sourceLink({ source_module: 'bgp', source_entity_id: '41' })).toBeNull()
    expect(sourceLink({ source_module: 'ioc', source_entity_id: '88' })).toBeNull()
    expect(sourceLink({ source_module: '', source_entity_id: 'CVE-2024-6387' })).toBeNull()
  })

  it('affiche les métadonnées JSON formatées, et le texte libre tel quel', async () => {
    api.get.mockResolvedValue(CASE)
    api.listEvents.mockResolvedValue(events([EVENTS[1], ev(5, '2026-10-21T13:00:00Z', 'Note libre', { metadata: 'pas du JSON {' })]))
    renderDetail()
    const details = await screen.findAllByText('Métadonnées')
    fireEvent.click(details[0]); (details[0].closest('details') as HTMLDetailsElement).open = true
    fireEvent(details[0].closest('details')!, new Event('toggle'))
    fireEvent.click(details[1]); (details[1].closest('details') as HTMLDetailsElement).open = true
    fireEvent(details[1].closest('details')!, new Event('toggle'))
    const pres = await waitFor(() => { const p = document.querySelectorAll('.iv26-meta pre'); expect(p).toHaveLength(2); return p })
    expect(pres[0].textContent).toBe('{\n  "cvss": 8.1\n}')
    expect(pres[1].textContent).toBe('pas du JSON {')
  })

  it("distingue un dossier introuvable d'une erreur du backend", async () => {
    api.get.mockRejectedValueOnce({ response: { status: 404 } })
    api.listEvents.mockResolvedValue(events([]))
    renderDetail()
    expect(await screen.findByRole('heading', { name: 'Investigation introuvable' })).toBeTruthy()
    cleanup()
    api.get.mockRejectedValueOnce({ response: { status: 500 } }).mockResolvedValueOnce(CASE)
    renderDetail()
    expect((await screen.findByRole('alert')).textContent).toContain('Impossible de charger ce dossier')
    fireEvent.click(screen.getByRole('button', { name: /Réessayer/ }))
    expect(await screen.findByRole('heading', { name: 'Détournement AS64500' })).toBeTruthy()
  })

  it('applique les filtres côté API et ignore une réponse dépassée', async () => {
    api.get.mockResolvedValue(CASE)
    const stale = deferred<EventListResponse>()
    api.listEvents.mockReturnValueOnce(stale.promise).mockResolvedValueOnce(events([EVENTS[1]]))
    renderDetail()
    await screen.findByRole('heading', { name: 'Détournement AS64500' })
    fireEvent.change(screen.getByLabelText('Filtrer par sévérité'), { target: { value: 'critical' } })
    expect(await screen.findByText('CVE liée')).toBeTruthy()
    await act(async () => { stale.resolve(events(EVENTS)) })
    expect(screen.queryByText('Contact opérateur')).toBeNull()
    expect(api.listEvents.mock.calls[1][1]).toMatchObject({ severity: 'critical', order: 'asc' })
    expect(screen.getByText(/Événements \(filtrés\)/)).toBeTruthy()
  })

  it("ajoute un événement à l'heure locale par défaut et l'insère dans l'ordre", async () => {
    api.get.mockResolvedValue(CASE)
    api.listEvents.mockResolvedValue(events([EVENTS[0], EVENTS[2]]))
    api.createEvent.mockImplementation(async (_id, payload) => ev(9, payload.timestamp!, payload.title, { severity: payload.severity, event_type: payload.event_type }))
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter un événement/ }))
    const dialog = screen.getByRole('dialog', { name: 'Nouvel événement' })
    const when = within(dialog).getByLabelText('DATE ET HEURE') as HTMLInputElement
    // Local date and hour of this browser, not UTC.
    expect(when.value.slice(0, 13)).toBe(localInputValue(new Date()).slice(0, 13))
    fireEvent.change(when, { target: { value: '2026-10-22T10:30' } })
    fireEvent.change(within(dialog).getByLabelText('TITRE *'), { target: { value: 'IOC observé' } })
    fireEvent.change(within(dialog).getByLabelText('SÉVÉRITÉ'), { target: { value: 'medium' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /Ajouter à la chronologie/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(api.createEvent.mock.calls[0][1]).toMatchObject({ title: 'IOC observé', severity: 'medium', timestamp: new Date('2026-10-22T10:30').toISOString() })
    const titles = screen.getAllByRole('article').map(a => a.querySelector('h4')?.textContent)
    expect(titles).toEqual(['Alerte BGP', 'IOC observé', 'Contact opérateur'])
  })

  it("ne supprime un événement qu'après confirmation", async () => {
    api.get.mockResolvedValue(CASE)
    api.listEvents.mockResolvedValue(events(EVENTS))
    api.deleteEvent.mockResolvedValue({})
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer l’événement Contact opérateur' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(screen.queryByText('Contact opérateur')).toBeNull())
    expect(api.deleteEvent).toHaveBeenCalledWith(3)
  })

  it('modifie le dossier et affiche une erreur du backend sans perdre la saisie', async () => {
    api.get.mockResolvedValue(CASE)
    api.listEvents.mockResolvedValue(events([]))
    api.update.mockRejectedValueOnce({ response: { data: { error: 'aucun champ valide' } } }).mockResolvedValueOnce({ ...CASE, title: 'Titre revu', status: 'closed' })
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: /Modifier/ }))
    fireEvent.change(screen.getByLabelText('TITRE *'), { target: { value: 'Titre revu' } })
    fireEvent.change(screen.getByLabelText('STATUT'), { target: { value: 'closed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect((await screen.findByRole('alert')).textContent).toBe('aucun champ valide')
    expect((screen.getByLabelText('TITRE *') as HTMLInputElement).value).toBe('Titre revu')
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByRole('heading', { name: 'Titre revu' })).toBeTruthy()
    expect(api.update.mock.calls[1]).toEqual([12, { title: 'Titre revu', description: 'Annonces inattendues.', status: 'closed', tags: 'bgp, réseau' }])
  })
})
