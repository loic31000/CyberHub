// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import CTFForm from './CTFForm'
import { ctfApi } from '@/api/client'
import { makeCTF } from '@/ctf26/__fixtures__'

vi.mock('@/api/client', () => ({ ctfApi: { get: vi.fn(), create: vi.fn(), update: vi.fn() } }))
vi.mock('@/ctf26/CtfHero', () => ({ default: () => <h1>CTF Form</h1> }))

const api = vi.mocked(ctfApi)
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(res => { resolve = res })
  return { promise, resolve }
}
const renderAt = (path = '/ctf/new') => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/ctf/new" element={<CTFForm />} />
      <Route path="/ctf/:id/edit" element={<CTFForm />} />
      <Route path="/ctf/:id" element={<p>SAVED REPORT</p>} />
      <Route path="/ctf" element={<p>CTF INDEX</p>} />
    </Routes>
  </MemoryRouter>,
)

describe('CTF 2026 — formulaire', () => {
  beforeEach(() => {
    api.get.mockReset()
    api.create.mockReset()
    api.update.mockReset()
  })
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('valide les titres requis et la longueur minimale du contrat backend avec focus sur le champ', async () => {
    renderAt()
    const title = screen.getByLabelText(/Titre/)
    fireEvent.click(screen.getByRole('button', { name: 'Créer le writeup' }))
    expect(title.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(title)
    expect(screen.getByText('Le titre est requis', { selector: 'p' })).toBeTruthy()
    fireEvent.change(title, { target: { value: 'A' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer le writeup' }))
    expect(screen.getByText('Le titre doit comporter au moins deux caractères', { selector: 'p' })).toBeTruthy()
    expect(api.create).not.toHaveBeenCalled()
  })

  it('préserve tous les champs à la création et permet la prévisualisation Markdown', async () => {
    api.create.mockResolvedValue(makeCTF(21, { title: 'Lame report' }))
    renderAt()
    fireEvent.change(screen.getByLabelText(/Titre/), { target: { value: 'Lame report' } })
    fireEvent.change(screen.getByLabelText('Plateforme'), { target: { value: 'HackTheBox' } })
    fireEvent.change(screen.getByLabelText('Nom de la machine'), { target: { value: 'Lame' } })
    fireEvent.change(screen.getByLabelText('Difficulté'), { target: { value: 'easy' } })
    fireEvent.change(screen.getByLabelText('Catégorie'), { target: { value: 'linux, pwn' } })
    fireEvent.change(screen.getByLabelText('Tags'), { target: { value: 'smb, privesc' } })
    fireEvent.click(screen.getByLabelText(/Machine terminée/))
    fireEvent.change(screen.getByLabelText('Flags'), { target: { value: 'HTB{user}, HTB{root}' } })
    fireEvent.change(screen.getByLabelText('Contenu du writeup (Markdown)'), { target: { value: '## Résumé\n\n| a | b |\n|---|---|\n| 1 | 2 |' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aperçu' }))
    expect(document.querySelector('.ct26-preview table')?.textContent).toContain('2')
    fireEvent.click(screen.getByRole('button', { name: 'Éditer' }))
    expect(screen.getByLabelText('Contenu du writeup (Markdown)')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Créer le writeup' }))

    await waitFor(() => expect(api.create).toHaveBeenCalledWith({
      title: 'Lame report', platform: 'HackTheBox', machine_name: 'Lame', difficulty: 'easy',
      category: 'linux, pwn', content: '## Résumé\n\n| a | b |\n|---|---|\n| 1 | 2 |',
      flags: 'HTB{user}, HTB{root}', tags: 'smb, privesc', completed: true,
    }))
    expect(await screen.findByText('SAVED REPORT')).toBeTruthy()
  })

  it('charge et conserve les valeurs existantes en édition, y compris completed=false', async () => {
    const existing = makeCTF(8, {
      title: 'Existing writeup', platform: 'Root-Me', machine_name: 'Alpha', difficulty: 'hard',
      category: 'crypto', content: '## Notes\nsecret-safe mock', flags: 'RM{one}, RM{two}', tags: 'crypto, rsa', completed: false,
    })
    api.get.mockResolvedValue(existing)
    api.update.mockResolvedValue(existing)
    renderAt('/ctf/8/edit')
    expect(await screen.findByDisplayValue('Existing writeup')).toBeTruthy()
    expect(screen.getByLabelText('Plateforme')).toHaveProperty('value', 'Root-Me')
    expect(screen.getByLabelText('Nom de la machine')).toHaveProperty('value', 'Alpha')
    expect(screen.getByLabelText('Difficulté')).toHaveProperty('value', 'hard')
    expect(screen.getByLabelText('Catégorie')).toHaveProperty('value', 'crypto')
    expect(screen.getByLabelText('Flags')).toHaveProperty('value', 'RM{one}, RM{two}')
    expect(screen.getByLabelText('Tags')).toHaveProperty('value', 'crypto, rsa')
    expect(screen.getByLabelText(/Machine terminée/)).toHaveProperty('checked', false)
    fireEvent.click(screen.getByRole('button', { name: 'Mettre à jour' }))
    await waitFor(() => expect(api.update).toHaveBeenCalledWith(8, {
      title: existing.title, platform: existing.platform, machine_name: existing.machine_name,
      difficulty: existing.difficulty, category: existing.category, content: existing.content,
      flags: existing.flags, tags: existing.tags, completed: false,
    }))
    expect(await screen.findByText('SAVED REPORT')).toBeTruthy()
  })

  it('réinitialise les valeurs en passant directement du mode édition à la création', async () => {
    api.get.mockResolvedValue(makeCTF(8, { title: 'Old report' }))
    render(
      <MemoryRouter initialEntries={['/ctf/8/edit']}>
        <Link to="/ctf/new">Passer à la création</Link>
        <Routes>
          <Route path="/ctf/new" element={<CTFForm />} />
          <Route path="/ctf/:id/edit" element={<CTFForm />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByDisplayValue('Old report')).toBeTruthy()
    fireEvent.click(screen.getByRole('link', { name: 'Passer à la création' }))
    expect(await screen.findByRole('heading', { name: 'Créer un writeup' })).toBeTruthy()
    expect(screen.getByLabelText(/Titre/)).toHaveProperty('value', '')
  })

  it('affiche l’échec de chargement en édition et permet de réessayer sans sauvegarder', async () => {
    api.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(makeCTF(9))
    renderAt('/ctf/9/edit')
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(api.update).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByDisplayValue('Challenge 9')).toBeTruthy()
    expect(api.get).toHaveBeenCalledTimes(2)
  })

  it('affiche une erreur API de sauvegarde et laisse le formulaire modifiable', async () => {
    api.create.mockRejectedValueOnce({ response: { data: { error: 'Validation serveur' } } })
    renderAt()
    fireEvent.change(screen.getByLabelText(/Titre/), { target: { value: 'Valid title' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer le writeup' }))
    expect(await screen.findByText('Validation serveur')).toBeTruthy()
    expect(screen.getByDisplayValue('Valid title')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Créer le writeup' })).toHaveProperty('disabled', false)
  })

  it('désactive le formulaire pendant la sauvegarde puis va à la fiche créée', async () => {
    const pending = deferred<ReturnType<typeof makeCTF>>()
    api.create.mockReturnValueOnce(pending.promise)
    renderAt()
    fireEvent.change(screen.getByLabelText(/Titre/), { target: { value: 'Pending writeup' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer le writeup' }))
    expect(screen.getByRole('button', { name: 'Enregistrement…' })).toHaveProperty('disabled', true)
    pending.resolve(makeCTF(44, { title: 'Pending writeup' }))
    expect(await screen.findByText('SAVED REPORT')).toBeTruthy()
  })

  it('Annuler depuis la création retourne au journal sans appeler l’API', async () => {
    renderAt()
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(await screen.findByText('CTF INDEX')).toBeTruthy()
    expect(api.create).not.toHaveBeenCalled()
  })
})
