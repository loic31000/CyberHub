// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import CheatsheetsPage from './CheatsheetsPage'
import { cheatsheetsApi } from '@/api/client'
import { toast } from '@/store/toast'
import type { Cheatsheet, CheatsheetSummary } from '@/types/cheatsheet'
import { renderCommand } from '@/cheatsheets26/parts'

vi.mock('@/api/client', () => ({ cheatsheetsApi: { list: vi.fn(), getByTool: vi.fn() } }))
afterEach(() => { cleanup(); vi.clearAllMocks() })

const list = vi.mocked(cheatsheetsApi.list)
const getByTool = vi.mocked(cheatsheetsApi.getByTool)
const alpha: CheatsheetSummary = { tool: 'Alpha', category: 'Linux', description: 'Linux shell reference', nb_commands: 1 }
const beta: CheatsheetSummary = { tool: 'Beta', category: 'Specialty', description: 'Network reference', nb_commands: 2 }
const detail: Cheatsheet = {
  ...alpha,
  commands: [{ title: 'Lookup', cmd: 'tool --target {host} --again {host}', vars: ['host'] }],
}

describe('CheatsheetsPage', () => {
  beforeEach(() => {
    list.mockResolvedValue({ cheatsheets: [alpha, beta], total: 9 })
    getByTool.mockResolvedValue(detail)
  })
  it('loads summaries, derives categories, filters and resets combined search/category state', async () => {
    render(<CheatsheetsPage />)
    expect(await screen.findByText('Alpha')).toBeTruthy()
    expect(screen.getByText('9 RÉFÉRENCES')).toBeTruthy()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'network' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Specialty' } })
    expect(screen.getByText('Beta')).toBeTruthy()
    expect(screen.queryByText('Alpha')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /réinitialiser/i }))
    expect(screen.getByText('Alpha')).toBeTruthy()
    expect(screen.getByText('Beta')).toBeTruthy()
  })

  it('shows empty, error and retry states', async () => {
    list.mockRejectedValueOnce(new Error('offline'))
    render(<CheatsheetsPage />)
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    list.mockResolvedValueOnce({ cheatsheets: [alpha], total: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByText('Alpha')).toBeTruthy()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'nothing matches' } })
    expect(await screen.findByText('Aucune cheatsheet trouvée')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }))
    expect(screen.getByText('Alpha')).toBeTruthy()
  })

  it('opens the selected detail and traps focus while making the background inert', async () => {
    render(<CheatsheetsPage />)
    const opener = await screen.findByRole('button', { name: /Alpha/ })
    opener.focus()
    fireEvent.click(opener)
    const dialog = await screen.findByRole('dialog', { name: 'Alpha' })
    const close = screen.getByRole('button', { name: 'Fermer le panneau' })
    const background = document.querySelector('.cs26-frame') as HTMLElement
    expect(background.inert).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.activeElement).toBe(dialog)

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Copier la commande/ }))
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' })
    expect(document.activeElement).toBe(close)

    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(background.inert).toBe(false)
    expect(document.body.style.overflow).toBe('')
    expect(document.activeElement).toBe(opener)
    expect(getByTool).toHaveBeenCalledWith('Alpha')
  })

  it('ignores stale detail responses', async () => {
    let finishAlpha!: (value: Cheatsheet) => void
    getByTool.mockImplementation((tool) => tool === 'Alpha'
      ? new Promise(resolve => { finishAlpha = resolve })
      : Promise.resolve({ ...detail, tool: 'Beta' }))
    render(<CheatsheetsPage />)
    const alphaButton = await screen.findByRole('button', { name: /Alpha/ })
    const betaButton = screen.getByRole('button', { name: /Beta/ })
    act(() => { alphaButton.click(); betaButton.click() })
    expect(await screen.findByRole('dialog', { name: 'Beta' })).toBeTruthy()
    finishAlpha({ ...detail, tool: 'Alpha' })
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Beta' })).toBeTruthy())
    expect(screen.queryByRole('dialog', { name: 'Alpha' })).toBeNull()
  })
})

describe('Cheatsheets command substitution and clipboard', () => {
  beforeEach(() => {
    list.mockResolvedValue({ cheatsheets: [alpha, beta], total: 9 })
    getByTool.mockResolvedValue(detail)
  })

  it('keeps unresolved placeholders and does not reprocess placeholder-like replacement text', () => {
    const cmd = { title: 'safe', cmd: 'tool {a} {b} {a}', vars: ['a', 'b'] }
    expect(renderCommand(cmd, { a: '$HOME {b}', b: '' })).toBe('tool $HOME {b} {b} $HOME {b}')
    expect(renderCommand({ title: 'literal', cmd: 'echo done', vars: [] }, {})).toBe('echo done')
  })

  it('substitutes repeated variables literally and preserves empty placeholders', async () => {
    render(<CheatsheetsPage />)
    const opener = await screen.findByRole('button', { name: /Alpha/ })
    fireEvent.click(opener)
    await screen.findByRole('dialog', { name: 'Alpha' })
    const input = document.querySelector('.cs26-var input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '$HOME\\server {other}' } })
    expect(document.querySelector('.cs26-final pre')?.textContent).toBe('tool --target $HOME\\server {other} --again $HOME\\server {other}')
  })

  it('reports unavailable/rejected clipboard writes and only shows success after a resolved write', async () => {
    const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const error = vi.spyOn(toast, 'error')
    render(<CheatsheetsPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Alpha/ }))
    await screen.findByRole('dialog', { name: 'Alpha' })
    const copy = document.querySelector('.cs26-copy') as HTMLButtonElement

    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    fireEvent.click(copy)
    await waitFor(() => expect(error).toHaveBeenCalledWith('Impossible de copier la commande'))
    expect(screen.queryByText('Copié')).toBeNull()

    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    fireEvent.click(copy)
    expect(await screen.findByText('Copié')).toBeTruthy()
    expect(writeText).toHaveBeenCalledWith('tool --target {host} --again {host}')

    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    fireEvent.click(copy)
    await waitFor(() => expect(error).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('Copié')).toBeNull()
    error.mockRestore()
    if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor)
    else Reflect.deleteProperty(navigator, 'clipboard')
  })
})
