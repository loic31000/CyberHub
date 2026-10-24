// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CTFDetail from './CTFDetail'
import { ctfApi } from '@/api/client'
import { makeCTF } from '@/ctf26/__fixtures__'

vi.mock('@/api/client', () => ({ ctfApi: { get: vi.fn(), delete: vi.fn() } }))
vi.mock('@/store/toast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/ctf26/CtfHero', () => ({ default: () => <h1>CTF Report</h1> }))

const api = vi.mocked(ctfApi)
const renderAt = (path = '/ctf/7') => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/ctf/:id" element={<CTFDetail />} />
      <Route path="/ctf/:id/edit" element={<p>EDIT REPORT</p>} />
      <Route path="/ctf" element={<p>CTF INDEX</p>} />
    </Routes>
  </MemoryRouter>,
)

describe('CTF 2026 — fiche', () => {
  beforeEach(() => { api.get.mockReset(); api.delete.mockReset() })
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('rend les champs, flags séparés, Markdown GFM et blocs de code sans pre imbriqué', async () => {
    api.get.mockResolvedValue(makeCTF(7, {
      title: 'Lame', platform: 'HackTheBox', machine_name: 'Lame', difficulty: 'easy', category: 'linux',
      completed: true, flags: ' HTB{user} , , HTB{root} ', tags: 'linux, privesc',
      content: '# Résumé\n\nInline `id` et commentaire.\n\n> Citation\n\n- item\n\n| étape | résultat |\n| --- | --- |\n| scan | ouvert |\n\n```bash\n# commentaire\nnmap -sV\n```\n\n[référence](https://example.test)',
    }))
    renderAt()
    expect(await screen.findByRole('heading', { name: 'Lame' })).toBeTruthy()
    expect(screen.getByText('Lame', { selector: 'dd' })).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Flags' }).textContent).toContain('HTB{user}')
    expect(screen.getByRole('list', { name: 'Flags' }).textContent).toContain('HTB{root}')
    expect(screen.getAllByRole('listitem').some(item => item.textContent?.trim() === '')).toBe(false)
    expect(document.querySelector('.ct26-md table')?.textContent).toContain('ouvert')
    expect(document.querySelector('.ct26-md pre')?.textContent).toContain('# commentaire')
    expect(document.querySelector('.ct26-md pre pre')).toBeNull()
    expect(screen.getByText('id', { selector: 'code' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'référence' }).getAttribute('rel')).toBe('noreferrer noopener')
    fireEvent.click(screen.getByRole('button', { name: 'Copier le bloc' }))
    expect(screen.getByRole('button', { name: 'Copier le bloc' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Modifier' }).getAttribute('href')).toBe('/ctf/7/edit')
  })

  it('copie un bloc de code uniquement à la demande', async () => {
    const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    try {
      api.get.mockResolvedValue(makeCTF(11, { content: '```sh\necho safe\n```' }))
      renderAt('/ctf/11')
      await screen.findByRole('heading', { name: 'Challenge 11' })
      fireEvent.click(screen.getByRole('button', { name: 'Copier le bloc' }))
      expect(await screen.findByRole('button', { name: 'Copié' })).toBeTruthy()
      expect(writeText).toHaveBeenCalledWith('echo safe')
    } finally {
      if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor)
      else Reflect.deleteProperty(navigator, 'clipboard')
    }
  })

  it('valide un ID avant le fetch et affiche l’état introuvable', async () => {
    renderAt('/ctf/not-a-number')
    expect(await screen.findByRole('heading', { name: 'Writeup non trouvé' })).toBeTruthy()
    expect(api.get).not.toHaveBeenCalled()
  })

  it('confirme au clavier et ne supprime pas tant que la confirmation n’est pas activée', async () => {
    api.get.mockResolvedValue(makeCTF(7))
    renderAt()
    await screen.findByRole('heading', { name: 'Challenge 7' })
    const deleteButton = screen.getByRole('button', { name: 'Supprimer' })
    deleteButton.focus()
    fireEvent.click(deleteButton)
    const dialog = screen.getByRole('alertdialog', { name: 'SUPPRIMER CE WRITEUP ?' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Annuler' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(document.activeElement).toBe(deleteButton)
    expect(api.delete).not.toHaveBeenCalled()
  })

  it('reste sur la fiche si la suppression échoue et navigue après succès', async () => {
    api.get.mockResolvedValue(makeCTF(7))
    api.delete.mockRejectedValueOnce(new Error('offline'))
    renderAt()
    await screen.findByRole('heading', { name: 'Challenge 7' })
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'SUPPRIMER' }))
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith(7))
    expect(screen.getByRole('heading', { name: 'Challenge 7' })).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('Le writeup est toujours affiché')
    expect(api.get).toHaveBeenCalledTimes(1)

    api.delete.mockResolvedValueOnce({})
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'SUPPRIMER' }))
    await waitFor(() => expect(screen.getByText('CTF INDEX')).toBeTruthy())
  })
})
