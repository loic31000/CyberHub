// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '@/App'

vi.mock('./useStoryRuntime', () => ({ useStoryRuntime: vi.fn() }))

describe('public Landing route', () => {
  it('renders the fictional Terminal to IOC story without the authenticated shell', async () => {
    render(
      <MemoryRouter initialEntries={['/welcome']}>
        <AppRoutes />
      </MemoryRouter>,
    )

    const heading = await screen.findByRole('heading', { level: 1 })
    expect(heading.textContent).toContain("Un indice n'est pas")
    const executionNote = document.querySelector('.terminal-bottom > span')
    expect(executionNote?.textContent?.replace(/\s+/g, ' ').trim()).toContain(
      'aucune commande réellement exécutée',
    )
    expect(screen.getByRole('button', { name: /rejouer/i })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: /navigation principale/i })).toBeTruthy()
  })

  it('does not read the authentication store on the public route', () => {
    const storageRead = vi.spyOn(Storage.prototype, 'getItem')

    render(
      <MemoryRouter initialEntries={['/welcome']}>
        <AppRoutes />
      </MemoryRouter>,
    )

    expect(storageRead).not.toHaveBeenCalled()
    storageRead.mockRestore()
  })
})
