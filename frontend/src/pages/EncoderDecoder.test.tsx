// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, render, waitFor } from '@testing-library/react'
import EncoderDecoder from './EncoderDecoder'
import { toast } from '@/store/toast'

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
const restoreClipboard = () => {
  if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor)
  else Reflect.deleteProperty(navigator, 'clipboard')
}

afterEach(() => {
  cleanup()
  restoreClipboard()
  vi.restoreAllMocks()
})

const renderPage = () => render(<EncoderDecoder />)
const setInput = (value: string) => fireEvent.change(screen.getByLabelText('Texte à transformer'), { target: { value } })
const setClipboard = (value: Clipboard | undefined) => Object.defineProperty(navigator, 'clipboard', { configurable: true, value })

describe('EncoderDecoder page', () => {
  it('exposes labelled controls, semantic operation groups, active state and visible focus styling', () => {
    renderPage()
    expect(screen.getByRole('region', { name: 'Opération' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Base64' })).toBeTruthy()
    expect(screen.getByLabelText('Texte à transformer')).toBeTruthy()
    expect(screen.getByLabelText('Résultat')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Base64 Encode' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Base64 Decode' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: 'Clear' }).className).toContain('en26-tool')
  })

  it('recomputes on operation changes without stale errors or changing the input', () => {
    renderPage()
    setInput('%')
    expect((screen.getByLabelText('Résultat') as HTMLTextAreaElement).value).toBe('JQ==')
    fireEvent.click(screen.getByRole('button', { name: 'URL Decode' }))
    expect(screen.getByRole('alert').textContent).toContain('URL invalide')
    fireEvent.click(screen.getByRole('button', { name: 'URL Encode' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect((screen.getByLabelText('Résultat') as HTMLTextAreaElement).value).toBe('%25')
    expect((screen.getByLabelText('Texte à transformer') as HTMLTextAreaElement).value).toBe('%')
    expect(screen.getByRole('button', { name: 'URL Encode' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'URL Decode' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('recomputes Hex to ROT13 and Decode to Encode from the unchanged input', () => {
    renderPage()
    setInput('48656c6c6f')
    fireEvent.click(screen.getByRole('button', { name: 'Hex Decode' }))
    expect((screen.getByLabelText('Résultat') as HTMLTextAreaElement).value).toBe('Hello')
    fireEvent.click(screen.getByRole('button', { name: 'ROT13 ROT13' }))
    expect((screen.getByLabelText('Résultat') as HTMLTextAreaElement).value).toBe('48656p6p6s')
    expect((screen.getByLabelText('Texte à transformer') as HTMLTextAreaElement).value).toBe('48656c6c6f')
    fireEvent.click(screen.getByRole('button', { name: 'Hex Encode' }))
    expect((screen.getByLabelText('Résultat') as HTMLTextAreaElement).value).toBe('34383635366336633666')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('Clear empties both panes, removes errors, resets counters and disables dependent actions', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Base64 Decode' }))
    setInput('%%%')
    expect(screen.getByRole('alert')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Swap' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Copier' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect((screen.getByLabelText('Texte à transformer') as HTMLTextAreaElement).value).toBe('')
    expect((screen.getByLabelText('Résultat') as HTMLTextAreaElement).value).toBe('')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getAllByText('0 car.')).toHaveLength(2)
    expect((screen.getByRole('button', { name: 'Clear' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Swap' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Copier' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('Swap preserves the selected operation and recalculates the output from the new input', () => {
    renderPage()
    setInput('Hello')
    fireEvent.click(screen.getByRole('button', { name: 'Swap' }))
    expect((screen.getByLabelText('Texte à transformer') as HTMLTextAreaElement).value).toBe('SGVsbG8=')
    expect((screen.getByLabelText('Résultat') as HTMLTextAreaElement).value).toBe('U0dWc2JHOD0=')
    expect(screen.getByRole('button', { name: 'Base64 Encode' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Base64 Decode' }))
    setInput('SGVsbG8=')
    expect((screen.getByLabelText('Résultat') as HTMLTextAreaElement).value).toBe('Hello')
    fireEvent.click(screen.getByRole('button', { name: 'Swap' }))
    expect((screen.getByLabelText('Texte à transformer') as HTMLTextAreaElement).value).toBe('Hello')
    expect(screen.getByRole('alert').textContent).toContain('Base64 invalide')
    expect(screen.getByRole('button', { name: 'Base64 Decode' }).getAttribute('aria-pressed')).toBe('true')
  })

  it.each([
    ['ROT13', 'rot13', 'Hello', 'Uryyb', 'Hello'],
    ['HTML', 'html-encode', '<x>', '&lt;x&gt;', '&amp;lt;x&amp;gt;'],
  ])('Swap under %s keeps its active operation', (_label, operation, original, firstOutput, swappedOutput) => {
    renderPage()
    const operationButton = screen.getByRole('button', { name: `${_label} ${operation === 'rot13' ? 'ROT13' : 'Encode'}` })
    fireEvent.click(operationButton)
    setInput(original)
    expect((screen.getByLabelText('Résultat') as HTMLTextAreaElement).value).toBe(firstOutput)
    fireEvent.click(screen.getByRole('button', { name: 'Swap' }))
    expect((screen.getByLabelText('Texte à transformer') as HTMLTextAreaElement).value).toBe(firstOutput)
    expect((screen.getByLabelText('Résultat') as HTMLTextAreaElement).value).toBe(swappedOutput)
    expect(operationButton.getAttribute('aria-pressed')).toBe('true')
  })

  it('handles long values without truncating the computed output', () => {
    renderPage()
    const input = 'a'.repeat(5000)
    setInput(input)
    expect((screen.getByLabelText('Résultat') as HTMLTextAreaElement).value).toBe(btoa(input))
    fireEvent.click(screen.getByRole('button', { name: 'Swap' }))
    expect((screen.getByLabelText('Texte à transformer') as HTMLTextAreaElement).value).toBe(btoa(input))
    expect((screen.getByLabelText('Résultat') as HTMLTextAreaElement).value).toBe(btoa(btoa(input)))
    expect(Array.from(document.querySelectorAll('.en26-count'), element => element.textContent)).toEqual([
      `${btoa(input).length.toLocaleString('fr-FR')} car.`,
      `${btoa(btoa(input)).length.toLocaleString('fr-FR')} car.`,
    ])
  })

  it('confirms only successful Clipboard writes, reports unavailable/rejected writes and clears stale confirmation', async () => {
    const success = vi.spyOn(toast, 'success')
    const error = vi.spyOn(toast, 'error')
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard({ writeText } as unknown as Clipboard)
    renderPage()
    setInput('Hello')
    fireEvent.click(screen.getByRole('button', { name: 'Copier' }))
    expect(await screen.findByRole('button', { name: 'Copié' })).toBeTruthy()
    expect(writeText).toHaveBeenCalledWith('SGVsbG8=')
    expect(success).toHaveBeenCalledWith('Copié dans le presse-papiers')

    setInput('Changed')
    expect(screen.getByRole('button', { name: 'Copier' })).toBeTruthy()
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('permission denied')) } as unknown as Clipboard)
    fireEvent.click(screen.getByRole('button', { name: 'Copier' }))
    await waitFor(() => expect(error).toHaveBeenCalledWith('Impossible de copier le résultat'))
    expect(screen.queryByRole('button', { name: 'Copié' })).toBeNull()

    setClipboard(undefined)
    fireEvent.click(screen.getByRole('button', { name: 'Copier' }))
    await waitFor(() => expect(error).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('button', { name: 'Copié' })).toBeNull()
  })
})
