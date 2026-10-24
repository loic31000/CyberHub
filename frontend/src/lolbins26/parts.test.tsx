// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CopyButton, CommandCard, getCommandDesc, getCommandPriv, getCommandText, getCommandType, isMitreId, parseCommands, parseJSON, parseMitre, parseTags } from './parts'
import type { LOLBinCommand } from '@/types/lolbins'
import { toast } from '@/store/toast'

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('LOLBins JSON fields', () => {
  it('uses safe fallbacks for empty, null, invalid JSON and wrong top-level types', () => {
    expect(parseJSON('', [])).toEqual([])
    expect(parseJSON('null', ['safe'])).toEqual(['safe'])
    expect(parseJSON('{broken', ['safe'])).toEqual(['safe'])
    expect(parseJSON('{"value":1}', ['safe'])).toEqual(['safe'])
  })

  it('keeps only non-empty string MITRE IDs and tags from arrays with mixed elements', () => {
    expect(parseMitre('["T1105", "t1059.001", "", 12, null, " invalid "]')).toEqual(['T1105', 't1059.001', 'invalid'])
    expect(parseMitre('{}')).toEqual([])
    expect(parseTags('["Execute:EXE", 4, null, "", " Download "]')).toEqual(['Execute:EXE', 'Download'])
    expect(parseTags('null')).toEqual([])
    expect(isMitreId('T1059')).toBe(true)
    expect(isMitreId('t1059.001')).toBe(true)
    expect(isMitreId('T1059.1')).toBe(false)
    expect(isMitreId('T12345')).toBe(false)
  })

  it('parses complete Windows/Linux commands and ignores incomplete or wrongly typed entries', () => {
    const commands = parseCommands(JSON.stringify([
      { Command: 'certutil.exe -urlcache', Description: 'Download through a signed binary', Usecase: 'Download', Privileges: 'User' },
      { commands: 'tar -xf archive.tar', description: 'Extract an archive', type: 'file-read' },
      null,
      [],
      { Command: 12, commands: false, Description: {} },
      { Command: '  ' },
    ]))
    expect(commands).toHaveLength(2)
    expect(getCommandText(commands[0])).toBe('certutil.exe -urlcache')
    expect(getCommandDesc(commands[0])).toBe('Download through a signed binary')
    expect(getCommandType(commands[0])).toBe('Download')
    expect(getCommandPriv(commands[0])).toBe('User')
    expect(getCommandText(commands[1])).toBe('tar -xf archive.tar')
    expect(getCommandType(commands[1])).toBe('file-read')
    expect(parseCommands('[]')).toEqual([])
    expect(parseCommands('not json')).toEqual([])
  })

  it('supports command field alternatives and type/use-case/category fallback order', () => {
    const cmd = { commands: 'tar {FILE}', type: 'file-write', Usecase: 'ignored', Category: 'ignored' } as LOLBinCommand
    expect(getCommandText(cmd)).toBe('tar {FILE}')
    expect(getCommandType(cmd)).toBe('file-write')
    expect(getCommandType({ Category: 'Execute' })).toBe('Execute')
  })
})

describe('LOLBins clipboard', () => {
  it('confirms only a successful Clipboard API write and reports unavailable/rejected writes', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const error = vi.spyOn(toast, 'error')
    try {
      render(<CopyButton text={'long command\nwith exact spacing  '} />)
      const button = screen.getByRole('button', { name: 'Copier la commande' })

      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
      fireEvent.click(button)
      await waitFor(() => expect(error).toHaveBeenCalledWith('Impossible de copier la commande'))
      expect(screen.queryByText('Copié')).toBeNull()

      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
      fireEvent.click(button)
      expect(await screen.findByText('Copié')).toBeTruthy()
      expect(writeText).toHaveBeenCalledWith('long command\nwith exact spacing  ')

      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
      fireEvent.click(button)
      await waitFor(() => expect(error).toHaveBeenCalledTimes(2))
      expect(screen.queryByText('Copié')).toBeNull()
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original)
      else Reflect.deleteProperty(navigator, 'clipboard')
      error.mockRestore()
    }
  })

  it('renders command type, privileges, description, and exact copy text without executing it', () => {
    const command: LOLBinCommand = { Command: 'cmd.exe /c whoami', Description: 'synthetic display', Usecase: 'Proxy execution', Privileges: 'Administrator' }
    render(<CommandCard cmd={command} index={0} />)
    expect(screen.getByText('Proxy execution')).toBeTruthy()
    expect(screen.getByText('Administrator')).toBeTruthy()
    expect(screen.getByText('synthetic display')).toBeTruthy()
    expect(screen.getByLabelText('Commande Proxy execution').textContent).toBe('cmd.exe /c whoami')
    expect(screen.getByRole('button', { name: 'Copier la commande Proxy execution' })).toBeTruthy()
  })
})
