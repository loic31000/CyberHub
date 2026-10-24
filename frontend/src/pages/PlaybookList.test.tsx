// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PlaybookList from './PlaybookList'
import { playbookApi } from '@/api/client'
import { playbook, step } from '@/pb26/__fixtures__'

vi.mock('@/api/client', () => ({ playbookApi: { list: vi.fn() } }))

const list = vi.mocked(playbookApi.list)
const renderList = () => render(<MemoryRouter><PlaybookList /></MemoryRouter>)
const fixtures = [
  playbook(1, 'Réponse Ransomware', 'ransomware', [step(1, 1, 'Isoler la machine', true), step(2, 2, 'Prévenir le RSSI')]),
  playbook(2, 'Investigation Phishing', 'phishing', [step(3, 1, 'Analyser les en-têtes')]),
  playbook(3, 'Campagne phishing ciblée', 'phishing', [step(4, 1, 'Bloquer l’expéditeur', true)]),
]

describe('Playbooks 2026 — liste', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('affiche les cartes avec scénario, progression réelle et lien', async () => {
    list.mockResolvedValue({ playbooks: fixtures, count: 3 })
    renderList()
    const link = await screen.findByRole('link', { name: 'Réponse Ransomware' })
    expect(link.getAttribute('href')).toBe('/playbooks/1')
    const card = link.closest('li') as HTMLElement
    expect(within(card).getByText('1/2 étapes')).toBeTruthy()
    expect(within(card).getByText('50%')).toBeTruthy()
    expect(within(card).getByText('En cours')).toBeTruthy()
    expect(screen.getByText('3 PLAYBOOKS')).toBeTruthy()
    // Every playbook is fetched at once so filters see the full set.
    expect(list).toHaveBeenCalledWith()
  })

  it('filtre par recherche, scénario et progression, avec un compteur exact', async () => {
    list.mockResolvedValue({ playbooks: fixtures, count: 3 })
    renderList()
    await screen.findByText('Réponse Ransomware')
    fireEvent.click(screen.getByRole('button', { name: 'Scénario : Tous les scénarios' }))
    fireEvent.click(screen.getByRole('option', { name: /Phishing/ }))
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.queryByText('Réponse Ransomware')).toBeNull()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    fireEvent.click(within(screen.getByRole('group', { name: 'Progression' })).getByRole('button', { name: /Terminé/ }))
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('Campagne phishing ciblée')).toBeTruthy()
    expect(screen.getByText(/sur 3/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retirer le filtre de scénario' }))
    expect(screen.getByRole('button', { name: 'Scénario : Tous les scénarios' })).toBeTruthy()
    fireEvent.click(within(screen.getByRole('group', { name: 'Progression' })).getByRole('button', { name: 'Tous' }))
    fireEvent.change(screen.getByLabelText('Rechercher un playbook'), { target: { value: 'expediteur' } })
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    fireEvent.change(screen.getByLabelText('Rechercher un playbook'), { target: { value: 'introuvable' } })
    expect(screen.getByRole('heading', { name: 'Aucun playbook ne correspond' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Effacer les filtres' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('cherche un scénario dans la liste déroulante, au clavier, avec compteurs', async () => {
    list.mockResolvedValue({ playbooks: fixtures, count: 3 })
    renderList()
    await screen.findByText('Réponse Ransomware')
    const trigger = screen.getByRole('button', { name: 'Scénario : Tous les scénarios' })
    fireEvent.click(trigger)
    const box = screen.getByRole('combobox', { name: 'Filtrer les scénarios' })
    expect(document.activeElement).toBe(box)
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(['Tous les scénarios3', 'Phishing2', 'Ransomware1'])
    fireEvent.change(box, { target: { value: 'ranso' } })
    expect(screen.getAllByRole('option')).toHaveLength(2)
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Scénario : Ransomware' })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Scénario : Ransomware' }))
    fireEvent.click(screen.getByRole('button', { name: 'Scénario : Ransomware' }))
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('distingue le chargement, l’erreur avec réessai et la liste vide', async () => {
    list.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce({ playbooks: [], count: 0 })
    renderList()
    expect(screen.getByRole('status', { name: 'Chargement des playbooks' })).toBeTruthy()
    expect((await screen.findByRole('alert')).textContent).toContain('Impossible de charger les playbooks')
    expect(screen.getByText('DONNÉES INDISPONIBLES')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Réessayer/ }))
    expect(await screen.findByRole('heading', { name: 'Aucun playbook' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Créer le premier playbook/ }).getAttribute('href')).toBe('/playbooks/new')
  })
})
