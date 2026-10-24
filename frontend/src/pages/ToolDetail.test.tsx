// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ToolDetail from './ToolDetail'
import { toolsApi } from '@/api/client'
import { makeTool } from '@/tools26/__fixtures__'

vi.mock('@/api/client', () => ({ toolsApi: { get: vi.fn(), delete: vi.fn() } }))
vi.mock('@/tools26/ToolsHero', () => ({ default: () => <h1>Arsenal</h1> }))

const api = vi.mocked(toolsApi)
const renderAt = (path = '/tools/7') => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/tools/:id" element={<ToolDetail />} />
      <Route path="/tools/:id/edit" element={<p>EDIT</p>} />
      <Route path="/tools" element={<p>INDEX</p>} />
    </Routes>
  </MemoryRouter>,
)

describe('Outils 2026 — fiche', () => {
  beforeEach(() => { api.get.mockReset(); api.delete.mockReset() })
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('rend les champs opérationnels, les ancres et Markdown sans imbriquer les blocs pre', async () => {
    api.get.mockResolvedValue(makeTool(7, {
      name: 'Nmap', category: 'offensive', sub_category: 'network', os: 'linux',
      description: 'Scanner réseau de laboratoire', install: 'Installer le paquet.\n\n```bash\n# commentaire\nnmap -sV {{target}}\n```',
      usage: 'nmap [options] target', examples: 'Exemple documenté', defense: 'Limiter les scans',
      procedure: '1. Obtenir une autorisation', ethical_level: 'elevated',
      legal_notes: 'Sur réseau autorisé uniquement', ethical_use_cases: 'Laboratoire interne',
      command_template: 'nmap {{target}}', input_schema: '[{"key":"target","label":"Cible"}]',
      user_notes: 'Note opérateur', tags: 'scan, réseau',
    }))
    renderAt()
    expect(await screen.findByRole('heading', { name: 'Nmap' })).toBeTruthy()
    expect(screen.getByText('Scanner réseau de laboratoire')).toBeTruthy()
    expect(screen.getByText('Sur réseau autorisé uniquement')).toBeTruthy()
    expect(screen.getByText('Laboratoire interne')).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Tags' }).textContent).toContain('scan')
    expect(screen.getByRole('navigation', { name: 'Sommaire de la fiche' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Schéma des paramètres' }).getAttribute('href')).toBe('#tl26-s-schema')
    expect(screen.getByText('[{"key":"target","label":"Cible"}]')).toBeTruthy()
    expect(document.querySelector('.tl26-md pre')?.textContent).toContain('# commentaire')
    expect(document.querySelector('.tl26-md pre')?.textContent).toContain('nmap -sV {{target}}')
    expect(document.querySelector('.tl26-md pre .is-comment')).toBeTruthy()
    expect(document.querySelector('.tl26-md pre pre')).toBeNull()
    expect(document.querySelectorAll('.tl26-doc-section')).toHaveLength(9)
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    expect(await screen.findByText('EDIT')).toBeTruthy()
  })

  it('copie le contenu du bloc de commande via un bouton nommé', async () => {
    const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    api.get.mockResolvedValue(makeTool(10, { install: '```sh\necho safe\n```' }))
    renderAt('/tools/10')
    await screen.findByRole('heading', { name: 'Tool 10' })
    fireEvent.click(screen.getByRole('button', { name: 'Copier le bloc' }))
    await screen.findByRole('button', { name: 'Copié' })
    expect(writeText).toHaveBeenCalledWith('echo safe')
    if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor)
    else Reflect.deleteProperty(navigator, 'clipboard')
  })

  it('garde le sommaire visible lorsqu’il n’y a qu’une section documentée', async () => {
    api.get.mockResolvedValue(makeTool(8, { install: 'Un seul chapitre.' }))
    renderAt('/tools/8')
    expect(await screen.findByRole('heading', { name: 'Tool 8' })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Sommaire de la fiche' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Installation' }).getAttribute('href')).toBe('#tl26-s-install')
  })

  it('signale une fiche introuvable sans afficher de contrôles d’action', async () => {
    api.get.mockRejectedValue(new Error('404'))
    renderAt('/tools/999')
    expect(await screen.findByRole('heading', { name: 'Fiche non trouvée' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Supprimer' })).toBeNull()
  })

  it('annule le modal accessible au clavier et restaure le focus', async () => {
    api.get.mockResolvedValue(makeTool(7))
    renderAt()
    await screen.findByRole('heading', { name: 'Tool 7' })
    const deleteButton = screen.getByRole('button', { name: 'Supprimer' })
    deleteButton.focus()
    fireEvent.click(deleteButton)
    const dialog = screen.getByRole('alertdialog', { name: 'SUPPRIMER CET OUTIL ?' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy()
    const cancel = within(dialog).getByRole('button', { name: 'Annuler' })
    const confirm = within(dialog).getByRole('button', { name: 'Confirmer' })
    expect(document.activeElement).toBe(cancel)
    confirm.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(cancel)
    cancel.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(confirm)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(document.activeElement).toBe(deleteButton)
    expect(api.delete).not.toHaveBeenCalled()
  })

  it('gère un échec de suppression sans quitter la fiche et navigue après succès', async () => {
    api.get.mockResolvedValue(makeTool(7))
    api.delete.mockRejectedValueOnce(new Error('offline'))
    renderAt()
    await screen.findByRole('heading', { name: 'Tool 7' })
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Confirmer' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Tool 7' })).toBeTruthy()
    expect(api.delete).toHaveBeenCalledWith(7)

    api.delete.mockResolvedValueOnce({})
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Confirmer' }))
    await waitFor(() => expect(screen.getByText('INDEX')).toBeTruthy())
  })
})
