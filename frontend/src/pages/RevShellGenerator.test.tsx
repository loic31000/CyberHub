// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { revshellApi } from '@/api/client'
import { toast } from '@/store/toast'
import type { RevShellParams, RevShellResponse } from '@/types/revshell'
import RevShellGenerator from './RevShellGenerator'

vi.mock('@/api/client', () => ({ revshellApi: { generate: vi.fn() } }))

const generate = vi.mocked(revshellApi.generate)
const successToast = vi.spyOn(toast, 'success')
const errorToast = vi.spyOn(toast, 'error')
const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

const output = (name: string, fields: Partial<RevShellResponse> = {}): RevShellResponse => ({
  payload: `payload-${name}`,
  listener: `listener-${name}`,
  lang: 'bash',
  os: 'linux',
  ...fields,
})

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const renderPage = () => render(<RevShellGenerator />)
const changeHost = (value: string) => fireEvent.change(screen.getByLabelText('LHOST'), { target: { value } })
const changePort = (value: string) => fireEvent.change(screen.getByLabelText('LPORT'), { target: { value } })
const advanceDebounce = async () => act(async () => { await vi.advanceTimersByTimeAsync(300) })
const flushPromises = async () => act(async () => { await Promise.resolve(); await Promise.resolve() })
const setClipboard = (value: Clipboard | undefined) => Object.defineProperty(navigator, 'clipboard', { configurable: true, value })

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  generate.mockReset()
  generate.mockResolvedValue(output('default'))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor)
  else Reflect.deleteProperty(navigator, 'clipboard')
})

describe('Reverse Shell Generator request state', () => {
  it('does not request for an empty or whitespace-only LHOST and trims hostnames before sending', async () => {
    renderPage()
    expect(generate).not.toHaveBeenCalled()
    changeHost('   ')
    await advanceDebounce()
    expect(generate).not.toHaveBeenCalled()

    changeHost('  relay.example  ')
    await advanceDebounce()
    expect(generate).toHaveBeenCalledWith({ ip: 'relay.example', port: 4444, lang: 'bash', encode: 'none' })
  })

  it('debounces input and exposes the loading status only for the current intent', async () => {
    renderPage()
    changeHost('10.10.14.7')
    expect(screen.getByRole('status').textContent).toMatch(/g.n.ration/i)
    await act(async () => { await vi.advanceTimersByTimeAsync(299) })
    expect(generate).not.toHaveBeenCalled()
    await advanceDebounce()
    expect(generate).toHaveBeenCalledTimes(1)
    expect(screen.getByText('payload-default')).toBeTruthy()
  })

  it('lets the newest host request win when the older request resolves last', async () => {
    const slow = deferred<RevShellResponse>()
    const fast = deferred<RevShellResponse>()
    generate.mockImplementation((params: RevShellParams) => params.ip === 'host-a' ? slow.promise : fast.promise)
    renderPage()
    changeHost('host-a')
    await advanceDebounce()
    changeHost('host-b')
    await advanceDebounce()
    await act(async () => fast.resolve(output('host-b')))
    expect(screen.getByText('payload-host-b')).toBeTruthy()
    await act(async () => slow.resolve(output('host-a')))
    expect(screen.getByText('payload-host-b')).toBeTruthy()
    expect(screen.queryByText('payload-host-a')).toBeNull()
  })

  it('ignores an obsolete rejection and cannot let its finally block stop the current loading state', async () => {
    const oldRequest = deferred<RevShellResponse>()
    const newRequest = deferred<RevShellResponse>()
    generate.mockImplementation((params: RevShellParams) => params.ip === 'old-host' ? oldRequest.promise : newRequest.promise)
    renderPage()
    changeHost('old-host')
    await advanceDebounce()
    changeHost('new-host')
    await advanceDebounce()
    await act(async () => oldRequest.reject(new Error('sensitive backend detail')))
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    await act(async () => newRequest.resolve(output('new-host')))
    expect(screen.getByText('payload-new-host')).toBeTruthy()
    expect(screen.queryByText('sensitive backend detail')).toBeNull()
  })

  it('does not restore an old result after LHOST is cleared during a request', async () => {
    const pending = deferred<RevShellResponse>()
    generate.mockReturnValue(pending.promise)
    renderPage()
    changeHost('10.0.0.1')
    await advanceDebounce()
    changeHost('')
    await act(async () => pending.resolve(output('stale')))
    expect(screen.getByText(/Entrez un LHOST/)).toBeTruthy()
    expect(screen.queryByText('payload-stale')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it.each([
    ['LPORT', () => changePort('8443'), { ip: '10.0.0.1', port: 8443, lang: 'bash', encode: 'none' }],
    ['language', () => fireEvent.click(screen.getByRole('button', { name: /Python 3/ })), { ip: '10.0.0.1', port: 4444, lang: 'python3', encode: 'none' }],
    ['encoding', () => fireEvent.click(screen.getByRole('button', { name: 'Base64' })), { ip: '10.0.0.1', port: 4444, lang: 'bash', encode: 'base64' }],
  ] as const)('invalidates an in-flight response when %s changes', async (_name, change, expected) => {
    const previous = deferred<RevShellResponse>()
    generate.mockImplementationOnce(() => previous.promise).mockResolvedValue(output('current'))
    renderPage()
    changeHost('10.0.0.1')
    await advanceDebounce()
    change()
    await advanceDebounce()
    expect(generate).toHaveBeenLastCalledWith(expected)
    await act(async () => previous.resolve(output('obsolete')))
    expect(screen.getByText('payload-current')).toBeTruthy()
    expect(screen.queryByText('payload-obsolete')).toBeNull()
  })

  it('only sends the final value after several rapid configuration changes', async () => {
    renderPage()
    changeHost('10.0.0.1')
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })
    changeHost('10.0.0.2')
    changePort('65535')
    fireEvent.click(screen.getByRole('button', { name: 'URL' }))
    await advanceDebounce()
    expect(generate).toHaveBeenCalledTimes(1)
    expect(generate).toHaveBeenCalledWith({ ip: '10.0.0.2', port: 65535, lang: 'bash', encode: 'url' })
  })

  it('accepts a long host string without applying an IPv4-only rule', async () => {
    const host = `${'relay-'.repeat(500)}example.test`
    renderPage()
    changeHost(host)
    await advanceDebounce()
    expect(generate).toHaveBeenCalledWith({ ip: host, port: 4444, lang: 'bash', encode: 'none' })
  })
})

describe('Reverse Shell LPORT validation', () => {
  it.each(['', '0', '65536', '-1', '1.5', 'invalid', '999999999999999999999999'])('rejects invalid port input %j without a request', async value => {
    renderPage()
    changeHost('10.0.0.1')
    changePort(value)
    expect(screen.getByRole('alert').textContent).toMatch(/1-65535/)
    expect(screen.getByLabelText('LPORT').getAttribute('aria-invalid')).toBe('true')
    await advanceDebounce()
    expect(generate).not.toHaveBeenCalled()
  })

  it.each(['1', '65535'])('accepts boundary port %s and sends it as a number', async value => {
    renderPage()
    changePort(value)
    changeHost('192.0.2.10')
    await advanceDebounce()
    expect(generate).toHaveBeenCalledWith({ ip: '192.0.2.10', port: Number(value), lang: 'bash', encode: 'none' })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps an invalid edit visible and resumes after a valid correction', async () => {
    renderPage()
    changeHost('host.local')
    changePort('65536')
    await advanceDebounce()
    expect(generate).not.toHaveBeenCalled()
    changePort('8080')
    await advanceDebounce()
    expect(generate).toHaveBeenCalledWith({ ip: 'host.local', port: 8080, lang: 'bash', encode: 'none' })
  })
})

describe('Reverse Shell errors and results', () => {
  it.each([400, 401, 403, 500, 'network'])('shows a generic visible error for API failure %s', async failure => {
    generate.mockRejectedValue(typeof failure === 'number' ? { response: { status: failure }, message: 'secret detail' } : new Error('secret detail'))
    renderPage()
    changeHost('10.0.0.8')
    await advanceDebounce()
    expect(screen.getByRole('alert').textContent).toMatch(/Impossible de g.n.rer le payload/)
    expect(screen.queryByText(/secret detail/)).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it.each([
    ['Linux', 'Bash', 'bash', 'linux'],
    ['Windows', 'PowerShell', 'powershell', 'windows'],
    ['Cross-Platform', 'Java', 'java', 'cross'],
  ] as const)('supports the %s language family', async (group, language, lang, os) => {
    generate.mockResolvedValue(output('family', { lang, os }))
    renderPage()
    expect(screen.getByRole('group', { name: group })).toBeTruthy()
    if (language !== 'Bash') fireEvent.click(screen.getByRole('button', { name: new RegExp(language) }))
    changeHost('10.0.0.8')
    await advanceDebounce()
    expect(screen.getAllByText(new RegExp(group === 'Cross-Platform' ? 'Cross-platform' : group, 'i')).length).toBeGreaterThan(0)
  })

  it('renders an unexpected API OS value safely and preserves Java and Go build notes', async () => {
    generate.mockResolvedValue(output('odd', { os: 'unexpected' as RevShellResponse['os'], lang: 'java' }))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Java/ }))
    changeHost('10.0.0.9')
    await advanceDebounce()
    expect(screen.getByText('Unknown OS')).toBeTruthy()
    expect(screen.getByText(/javac Exploit.java/)).toBeTruthy()
  })

  it('keeps PowerShell Base64 encoding and its existing instruction', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /PowerShell/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Base64' }))
    changeHost('host.example')
    await advanceDebounce()
    expect(generate).toHaveBeenCalledWith({ ip: 'host.example', port: 4444, lang: 'powershell', encode: 'base64' })
    expect(screen.getByText(/EncodedCommand/)).toBeTruthy()
  })

  it('preserves the existing Go build note', async () => {
    generate.mockResolvedValue(output('go', { lang: 'golang', os: 'cross' }))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /^Cross-Platform.*Go$/ }))
    changeHost('host.example')
    await advanceDebounce()
    expect(screen.getByText(/go run exploit.go/)).toBeTruthy()
  })

  it('sends all three existing encodings in order without stale output', async () => {
    renderPage()
    changeHost('10.0.0.10')
    await advanceDebounce()
    fireEvent.click(screen.getByRole('button', { name: 'Base64' }))
    await advanceDebounce()
    fireEvent.click(screen.getByRole('button', { name: 'URL' }))
    await advanceDebounce()
    fireEvent.click(screen.getByRole('button', { name: 'Aucun' }))
    await advanceDebounce()
    expect(generate.mock.calls.map(([params]) => params.encode)).toEqual(['none', 'base64', 'url', 'none'])
  })

  it('keeps language and encoding aria-pressed state synchronized', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'URL' }))
    fireEvent.click(screen.getByRole('button', { name: /Python 3/ }))
    expect(screen.getByRole('button', { name: 'URL' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /Python 3/ }).getAttribute('aria-pressed')).toBe('true')
  })
})

describe('Reverse Shell clipboard', () => {
  const loadResult = async () => {
    renderPage()
    changeHost('10.0.0.3')
    await advanceDebounce()
  }

  it('copies payload and listener only after the clipboard promise succeeds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    await loadResult()
    fireEvent.click(screen.getByRole('button', { name: 'Copier le payload' }))
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('payload-default')
    expect(screen.getByRole('button', { name: /^Copi\u00e9$/ }).getAttribute('data-copied')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Copier le listener' }))
    await flushPromises()
    expect(writeText).toHaveBeenLastCalledWith('listener-default')
    expect(successToast).toHaveBeenCalledTimes(2)
  })

  it('reports missing and rejected clipboard APIs without a false copied state', async () => {
    setClipboard(undefined)
    await loadResult()
    fireEvent.click(screen.getByRole('button', { name: 'Copier le payload' }))
    await flushPromises()
    expect(errorToast).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Copier le payload' }).getAttribute('data-copied')).toBeNull()

    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    setClipboard({ writeText } as unknown as Clipboard)
    fireEvent.click(screen.getByRole('button', { name: 'Copier le listener' }))
    await flushPromises()
    expect(errorToast).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: 'Copier le listener' }).getAttribute('data-copied')).toBeNull()
  })

  it('does not duplicate concurrent double-clicks and clears Copied for a new output', async () => {
    const write = deferred<void>()
    const writeText = vi.fn(() => write.promise)
    setClipboard({ writeText } as unknown as Clipboard)
    generate.mockResolvedValueOnce(output('first')).mockResolvedValueOnce(output('second'))
    await loadResult()
    const copy = screen.getByRole('button', { name: 'Copier le payload' })
    fireEvent.click(copy)
    fireEvent.click(copy)
    expect(writeText).toHaveBeenCalledTimes(1)
    await act(async () => write.resolve())
    expect(screen.getByRole('button', { name: /^Copi\u00e9$/ }).getAttribute('data-copied')).toBe('true')
    changeHost('10.0.0.4')
    await advanceDebounce()
    expect(screen.queryByRole('button', { name: /^Copi\u00e9$/ })).toBeNull()
    expect(screen.getByText('payload-second')).toBeTruthy()
  })
})

describe('Reverse Shell result recovery', () => {
  it('replaces a previous result with the generic error and recovers on the next valid input', async () => {
    generate.mockResolvedValueOnce(output('previous'))
      .mockRejectedValueOnce({ response: { status: 500 }, message: 'internal token detail' })
      .mockResolvedValueOnce(output('recovered'))
    renderPage()
    changeHost('host-previous')
    await advanceDebounce()
    expect(screen.getByText('payload-previous')).toBeTruthy()

    changeHost('host-fails')
    expect(screen.queryByText('payload-previous')).toBeNull()
    await advanceDebounce()
    expect(screen.getByRole('alert').textContent).toMatch(/Impossible de g.n.rer le payload/)
    expect(screen.queryByText(/internal token detail/)).toBeNull()

    changeHost('host-recovers')
    await advanceDebounce()
    expect(screen.getByText('payload-recovered')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
