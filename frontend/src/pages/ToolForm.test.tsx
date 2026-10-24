// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ToolForm from './ToolForm'
import { toolsApi } from '@/api/client'
import { makeTool } from '@/tools26/__fixtures__'

vi.mock('@/api/client', () => ({ toolsApi: { get: vi.fn(), create: vi.fn(), update: vi.fn() } }))

const api = vi.mocked(toolsApi)
const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/tools/new" element={<ToolForm />} />
      <Route path="/tools/:id/edit" element={<ToolForm />} />
      <Route path="/tools/:id" element={<p>DETAIL</p>} />
      <Route path="/tools" element={<p>INDEX</p>} />
    </Routes>
  </MemoryRouter>,
)
const fillRequired = () => {
  fireEvent.change(screen.getByLabelText(/Nom/), { target: { value: 'Nmap' } })
  fireEvent.change(screen.getByLabelText('Description *'), { target: { value: 'Analyse réseau documentée' } })
}

describe('Outils 2026 — formulaire', () => {
  beforeEach(() => { vi.mocked(api.get).mockReset(); vi.mocked(api.create).mockReset(); vi.mocked(api.update).mockReset() })
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('valide les longueurs après trim, le JSON et place le focus sur le premier champ invalide', async () => {
    api.create.mockResolvedValue(makeTool(42, { name: 'nmap' }))
    renderAt('/tools/new')
    const name = screen.getByLabelText(/Nom/) as HTMLInputElement
    const description = screen.getByLabelText('Description *') as HTMLTextAreaElement
    const schema = screen.getByLabelText('Schéma JSON des paramètres') as HTMLTextAreaElement

    fireEvent.change(name, { target: { value: '  a  ' } })
    fireEvent.change(description, { target: { value: 'Description valide' } })
    fireEvent.click(screen.getByRole('button', { name: "Créer l'outil" }))
    expect(screen.getByText('NOM REQUIS (MIN 2 CARACTÈRES)')).toBeTruthy()
    expect(name.getAttribute('aria-invalid')).toBe('true')
    expect(name.getAttribute('aria-describedby')).toContain('tl26-err-name')
    expect(document.activeElement).toBe(name)
    expect(api.create).not.toHaveBeenCalled()

    fireEvent.change(name, { target: { value: 'Nmap' } })
    fireEvent.change(description, { target: { value: '   x   ' } })
    fireEvent.click(screen.getByRole('button', { name: "Créer l'outil" }))
    expect(screen.getByText('DESCRIPTION REQUISE (MIN 10 CARACTÈRES)')).toBeTruthy()
    expect(document.activeElement).toBe(description)

    fireEvent.change(description, { target: { value: 'Description valide' } })
    fireEvent.change(schema, { target: { value: '{invalid' } })
    fireEvent.click(screen.getByRole('button', { name: "Créer l'outil" }))
    expect(screen.getByText('JSON INVALIDE')).toBeTruthy()
    expect(document.activeElement).toBe(schema)
    expect(api.create).not.toHaveBeenCalled()

    fireEvent.change(schema, { target: { value: '[{"key":"target","label":"Cible"}]' } })
    fireEvent.change(screen.getByLabelText('Gabarit de commande'), { target: { value: 'nmap {{target}}' } })
    fireEvent.change(screen.getByRole('combobox', { name: /Catégorie/ }), { target: { value: 'offensive' } })
    fireEvent.change(screen.getByLabelText('Sous-catégorie'), { target: { value: 'network' } })
    fireEvent.change(screen.getByRole('combobox', { name: /OS/ }), { target: { value: 'linux' } })
    fireEvent.change(screen.getByLabelText('Tags'), { target: { value: 'scan, réseau' } })
    fireEvent.change(screen.getByLabelText('Notes légales'), { target: { value: 'Cadre autorisé' } })
    fireEvent.change(screen.getByLabelText("Cas d'usage éthique"), { target: { value: 'Laboratoire' } })
    fireEvent.change(screen.getByLabelText('Notes personnelles'), { target: { value: 'À documenter' } })
    fireEvent.click(screen.getByRole('button', { name: /Installation/ }))
    fireEvent.change(screen.getByLabelText('Installation (Markdown)'), { target: { value: 'Paquet système' } })
    fireEvent.click(screen.getByRole('button', { name: "Créer l'outil" }))
    expect(await screen.findByText('DETAIL')).toBeTruthy()
    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Nmap', category: 'offensive', sub_category: 'network', os: 'linux',
      description: 'Description valide', install: 'Paquet système', command_template: 'nmap {{target}}',
      input_schema: '[{"key":"target","label":"Cible"}]', tags: 'scan, réseau',
      legal_notes: 'Cadre autorisé', ethical_use_cases: 'Laboratoire', user_notes: 'À documenter',
    }))
  })

  it('charge les champs de la fiche en édition et permet de replier une section de documentation', async () => {
    api.get.mockResolvedValue(makeTool(7, {
      name: 'Traceroute', description: 'Mesure les routes réseau', install: 'Installer paquet',
      usage: 'traceroute {{target}}', examples: 'exemple', defense: 'surveiller', procedure: 'étapes',
      ethical_level: 'elevated', legal_notes: 'Audit autorisé', ethical_use_cases: 'Lab interne',
      command_template: 'traceroute {{target}}', input_schema: '[{"key":"target"}]',
      user_notes: 'Note privée', tags: 'network, trace', category: 'offensive', sub_category: 'network', os: 'linux',
    }))
    api.update.mockResolvedValue(makeTool(7, { name: 'Traceroute v2' }))
    renderAt('/tools/7/edit')
    expect(await screen.findByDisplayValue('Traceroute')).toBeTruthy()
    expect(api.get).toHaveBeenCalledWith(7)
    expect((screen.getByLabelText('Description *') as HTMLTextAreaElement).value).toBe('Mesure les routes réseau')
    expect((screen.getByLabelText('Gabarit de commande') as HTMLInputElement).value).toBe('traceroute {{target}}')
    expect((screen.getByLabelText('Schéma JSON des paramètres') as HTMLTextAreaElement).value).toBe('[{"key":"target"}]')
    expect((screen.getByLabelText('Notes légales') as HTMLTextAreaElement).value).toBe('Audit autorisé')
    const installToggle = screen.getByRole('button', { name: /Installation/ })
    expect(installToggle.getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById(installToggle.getAttribute('aria-controls')!)).toBeTruthy()
    fireEvent.click(installToggle)
    expect(installToggle.getAttribute('aria-expanded')).toBe('false')
    expect((screen.getByRole('combobox', { name: /Catégorie/ }) as HTMLSelectElement).value).toBe('offensive')
    expect((screen.getByLabelText('Sous-catégorie') as HTMLSelectElement).value).toBe('network')
    expect((screen.getByRole('combobox', { name: /OS/ }) as HTMLSelectElement).value).toBe('linux')
    expect(screen.getByRole('group', { name: 'Niveau éthique' }).querySelector('input:checked')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Description *'), { target: { value: 'Mesure les routes réseau version 2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }))
    expect(await screen.findByText('DETAIL')).toBeTruthy()
    expect(api.update).toHaveBeenCalledWith(7, expect.objectContaining({
      name: 'Traceroute', description: 'Mesure les routes réseau version 2',
      install: 'Installer paquet', usage: 'traceroute {{target}}', examples: 'exemple',
      defense: 'surveiller', procedure: 'étapes', input_schema: '[{"key":"target"}]',
      legal_notes: 'Audit autorisé', ethical_use_cases: 'Lab interne', user_notes: 'Note privée', tags: 'network, trace',
    }))
  })

  it('garde l’édition bloquée si le chargement échoue, puis propose un nouvel essai', async () => {
    api.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(makeTool(9, { name: 'Rescue' }))
    renderAt('/tools/9/edit')
    expect(await screen.findByRole('heading', { name: 'Impossible de charger cette fiche' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: "Créer l'outil" })).toBeNull()
    expect(api.create).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByDisplayValue('Rescue')).toBeTruthy()
  })

  it('affiche les erreurs API et désactive les actions pendant la sauvegarde', async () => {
    let reject!: (reason?: unknown) => void
    api.create.mockReturnValue(new Promise((_resolve, rej) => { reject = rej }))
    render(<MemoryRouter initialEntries={['/tools', '/tools/new']} initialIndex={1}>
      <Routes>
        <Route path="/tools/new" element={<ToolForm />} />
        <Route path="/tools" element={<p>INDEX</p>} />
      </Routes>
    </MemoryRouter>)
    fillRequired()
    const submit = screen.getByRole('button', { name: "Créer l'outil" }) as HTMLButtonElement
    fireEvent.click(submit)
    expect(submit.disabled).toBe(true)
    reject(new Error('offline'))
    expect(await screen.findByText('Enregistrement impossible. Réessaie.')).toBeTruthy()
    expect((screen.getByRole('button', { name: "Créer l'outil" }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByLabelText(/Nom/) as HTMLInputElement).value).toBe('Nmap')
  })

  it('annule et revient à la liste sans soumettre', async () => {
    render(<MemoryRouter initialEntries={['/tools', '/tools/new']} initialIndex={1}>
      <Routes>
        <Route path="/tools/new" element={<ToolForm />} />
        <Route path="/tools" element={<p>INDEX</p>} />
      </Routes>
    </MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    await waitFor(() => expect(screen.getByText('INDEX')).toBeTruthy())
    expect(api.create).not.toHaveBeenCalled()
  })
})
