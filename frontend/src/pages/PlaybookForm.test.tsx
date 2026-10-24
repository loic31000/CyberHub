// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import PlaybookForm from './PlaybookForm'
import { playbookApi } from '@/api/client'
import { playbook, step } from '@/pb26/__fixtures__'

vi.mock('@/api/client', () => ({ playbookApi: { get: vi.fn(), create: vi.fn(), update: vi.fn() } }))
vi.mock('@/store/toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))

const api = vi.mocked(playbookApi)
const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/playbooks/new" element={<PlaybookForm />} />
      <Route path="/playbooks/:id/edit" element={<PlaybookForm />} />
      <Route path="/playbooks/:id" element={<p>DETAIL</p>} />
      <Route path="/playbooks" element={<p>INDEX</p>} />
    </Routes>
  </MemoryRouter>,
)
const stepInputs = () => screen.getAllByLabelText(/^Étape \d+$/) as HTMLInputElement[]
const values = () => stepInputs().map(i => i.value)

describe('Playbooks 2026 — formulaire', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('valide les saisies avant tout envoi', async () => {
    renderAt('/playbooks/new')
    fireEvent.click(screen.getByRole('button', { name: /Créer le playbook/ }))
    expect(screen.getByText('Le titre est requis')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe('Ajoutez au moins une étape')
    expect(document.activeElement).toBe(screen.getByLabelText('Titre *'))
    fireEvent.change(screen.getByLabelText('Titre *'), { target: { value: 'R' } })
    expect(screen.getByText(/au moins 2 caractères/)).toBeTruthy()
    expect(api.create).not.toHaveBeenCalled()
  })

  it('ajoute, réordonne et supprime des étapes, puis crée le playbook', async () => {
    api.create.mockResolvedValue(playbook(42, 'Réponse DDoS', 'ddos', []))
    renderAt('/playbooks/new')
    fireEvent.change(screen.getByLabelText('Titre *'), { target: { value: '  Réponse DDoS ' } })
    fireEvent.change(screen.getByLabelText('Scénario'), { target: { value: 'Déni de Service' } })
    expect((screen.getByLabelText('Scénario') as HTMLInputElement).value).toBe('deni-de-service')
    fireEvent.change(stepInputs()[0], { target: { value: 'Activer le scrubbing' } })
    // Enter adds a step below and focuses it.
    fireEvent.keyDown(stepInputs()[0], { key: 'Enter' })
    expect(document.activeElement).toBe(stepInputs()[1])
    fireEvent.change(stepInputs()[1], { target: { value: 'Prévenir le FAI' } })
    fireEvent.click(screen.getByRole('button', { name: /Ajouter une étape/ }))
    fireEvent.change(stepInputs()[2], { target: { value: 'Vérifier les logs' } })
    fireEvent.click(screen.getByRole('button', { name: 'Monter l’étape 3' }))
    expect(values()).toEqual(['Activer le scrubbing', 'Vérifier les logs', 'Prévenir le FAI'])
    fireEvent.keyDown(stepInputs()[0], { key: 'ArrowDown', altKey: true })
    expect(values()).toEqual(['Vérifier les logs', 'Activer le scrubbing', 'Prévenir le FAI'])
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer l’étape 2' }))
    expect(values()).toEqual(['Vérifier les logs', 'Prévenir le FAI'])
    fireEvent.click(screen.getByRole('button', { name: /Créer le playbook/ }))
    expect(await screen.findByText('DETAIL')).toBeTruthy()
    expect(api.create).toHaveBeenCalledWith({
      title: 'Réponse DDoS', scenario: 'deni-de-service', description: '',
      steps: [{ content: 'Vérifier les logs', order: 1 }, { content: 'Prévenir le FAI', order: 2 }],
    })
  })

  it('garde les saisies et affiche l’erreur du backend si l’enregistrement échoue', async () => {
    api.create.mockRejectedValueOnce({ response: { data: { error: "Key: 'PlaybookCreateRequest.Title' Error" } } })
    renderAt('/playbooks/new')
    fireEvent.change(screen.getByLabelText('Titre *'), { target: { value: 'Réponse DDoS' } })
    fireEvent.change(stepInputs()[0], { target: { value: 'Activer le scrubbing' } })
    fireEvent.click(screen.getByRole('button', { name: /Créer le playbook/ }))
    expect((await screen.findByRole('alert')).textContent).toContain('PlaybookCreateRequest.Title')
    expect(values()).toEqual(['Activer le scrubbing'])
    expect((screen.getByRole('button', { name: /Créer le playbook/ }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('charge un playbook existant, prévient de la perte de progression et enregistre', async () => {
    api.get.mockResolvedValue(playbook(7, 'Réponse Ransomware', 'ransomware', [step(2, 2, 'Deux', true, 7), step(1, 1, 'Un', false, 7)]))
    api.update.mockResolvedValue(playbook(7, 'Réponse Ransomware v2', 'ransomware', []))
    renderAt('/playbooks/7/edit')
    expect(await screen.findByDisplayValue('Réponse Ransomware')).toBeTruthy()
    expect(values()).toEqual(['Un', 'Deux'])
    expect(screen.getByRole('note').textContent).toContain('1 étape déjà validée')
    fireEvent.change(screen.getByLabelText('Titre *'), { target: { value: 'Réponse Ransomware v2' } })
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer les modifications/ }))
    expect(await screen.findByText('DETAIL')).toBeTruthy()
    expect(api.update).toHaveBeenCalledWith(7, expect.objectContaining({ title: 'Réponse Ransomware v2', steps: [{ content: 'Un', order: 1 }, { content: 'Deux', order: 2 }] }))
  })

  it('demande confirmation avant de quitter un formulaire modifié', async () => {
    renderAt('/playbooks/new')
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(await screen.findByText('INDEX')).toBeTruthy()
    cleanup()
    renderAt('/playbooks/new')
    fireEvent.change(screen.getByLabelText('Titre *'), { target: { value: 'Brouillon' } })
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    const dialog = screen.getByRole('dialog', { name: 'Quitter sans enregistrer ?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }))
    expect((screen.getByLabelText('Titre *') as HTMLInputElement).value).toBe('Brouillon')
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Quitter' }))
    await waitFor(() => expect(screen.getByText('INDEX')).toBeTruthy())
  })

  it('repart d’un formulaire vide quand on passe de l’édition à la création', async () => {
    api.get.mockResolvedValue(playbook(7, 'Réponse Ransomware', 'ransomware', [step(1, 1, 'Un', false, 7)]))
    render(
      <MemoryRouter initialEntries={['/playbooks/7/edit']}>
        <Link to="/playbooks/new">NOUVEAU</Link>
        <Routes>
          <Route path="/playbooks/new" element={<PlaybookForm />} />
          <Route path="/playbooks/:id/edit" element={<PlaybookForm />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByDisplayValue('Réponse Ransomware')).toBeTruthy()
    fireEvent.click(screen.getByText('NOUVEAU'))
    expect(await screen.findByRole('heading', { name: 'Nouveau playbook' })).toBeTruthy()
    expect((screen.getByLabelText('Titre *') as HTMLInputElement).value).toBe('')
  })

  it('affiche un état dédié si le playbook à modifier est introuvable', async () => {
    api.get.mockRejectedValue({ response: { status: 404 } })
    renderAt('/playbooks/99/edit')
    expect(await screen.findByRole('heading', { name: 'Playbook introuvable' })).toBeTruthy()
  })
})
