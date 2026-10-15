// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import NVDImportModal from './NVDImportModal'
import { cveApi } from '@/api/client'

vi.mock('@/api/client', () => ({ cveApi: { fetchFromNVD: vi.fn() } }))

const fetchFromNVD = vi.mocked(cveApi.fetchFromNVD)
const RESULT = { message: 'ok', created: 2, skipped: 1, total_remote: 3, total_available: 3 }

function Harness({ onSuccess = () => {} }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Ouvrir</button>
      {open && <NVDImportModal open onClose={() => setOpen(false)} onSuccess={onSuccess} />}
    </>
  )
}
const openDialog = () => {
  const opener = screen.getByRole('button', { name: 'Ouvrir' })
  opener.focus()
  fireEvent.click(opener)
  return { opener, dialog: screen.getByRole('dialog', { name: 'IMPORT NVD EN LIGNE' }) }
}

describe('CVE Watch — import NVD en ligne', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('prend le focus, se ferme avec Échap et rend le focus au bouton', () => {
    render(<Harness />)
    const { opener, dialog } = openDialog()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(screen.getByLabelText('Date début * (recommandée)'))
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('garde le focus dans la fenêtre avec Tab et Maj+Tab', () => {
    render(<Harness />)
    const { dialog } = openDialog()
    const close = screen.getByRole('button', { name: 'Fermer' })
    const submit = screen.getByRole('button', { name: 'IMPORTER DEPUIS NVD' })
    submit.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(submit)
  })

  it("affiche l'erreur de validation dans la fenêtre sans appeler l'API", () => {
    render(<Harness />)
    openDialog()
    fireEvent.click(screen.getByRole('button', { name: 'IMPORTER DEPUIS NVD' }))
    expect(screen.getByRole('alert').textContent).toContain('au moins un critère')
    fireEvent.change(screen.getByLabelText('Date début * (recommandée)'), { target: { value: '2026-05-10' } })
    fireEvent.change(screen.getByLabelText('Date fin (optionnelle)'), { target: { value: '2026-05-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'IMPORTER DEPUIS NVD' }))
    expect(screen.getByRole('alert').textContent).toContain('date de fin')
    expect(fetchFromNVD).not.toHaveBeenCalled()
  })

  it("n'envoie qu'une requête en cas de double soumission, sans journaliser la réponse", async () => {
    let finish!: (v: typeof RESULT) => void
    fetchFromNVD.mockReturnValue(new Promise((r) => { finish = r }))
    const log = vi.spyOn(console, 'log')
    const onSuccess = vi.fn()
    render(<Harness onSuccess={onSuccess} />)
    openDialog()
    fireEvent.change(screen.getByLabelText('Mot-clé (description)'), { target: { value: 'demo' } })
    const form = screen.getByRole('button', { name: 'IMPORTER DEPUIS NVD' }).closest('form') as HTMLFormElement
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(fetchFromNVD).toHaveBeenCalledTimes(1)
    // While it runs, the dialog cannot be closed.
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.getByRole('dialog')).toBeTruthy()
    finish(RESULT)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(log).not.toHaveBeenCalled()
    log.mockRestore()
  })

  it('affiche le message renvoyé par le backend en cas d’échec', async () => {
    fetchFromNVD.mockRejectedValue(Object.assign(new Error('Request failed with status code 502'), {
      response: { status: 502, data: { error: 'NVD a refusé la requête (quota dépassé)' } },
    }))
    render(<Harness />)
    openDialog()
    fireEvent.change(screen.getByLabelText('Mot-clé (description)'), { target: { value: 'demo' } })
    fireEvent.click(screen.getByRole('button', { name: 'IMPORTER DEPUIS NVD' }))
    expect((await screen.findByRole('alert')).textContent).toBe('NVD a refusé la requête (quota dépassé)')
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})
