// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'
import { useAuthStore } from '@/store/auth'
import { authApi } from '@/api/client'

vi.mock('@/api/client', () => ({
  authApi: {
    getStatus: vi.fn(),
    login: vi.fn(),
    setup: vi.fn(),
  },
  bgpApi: { getAlerts: vi.fn().mockResolvedValue({ total: 0 }) },
}))
vi.mock('@/pages/Dashboard', () => ({ default: () => <div>Dashboard chargé</div> }))
vi.mock('@/pages/Tools', () => ({ default: () => <div>Outils chargés</div> }))

describe('navigation et authentification', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({ token: null, isAuthenticated: false })
    window.history.replaceState({}, '', '/dashboard')
    vi.mocked(authApi.getStatus).mockResolvedValue({ is_setup: true })
    vi.mocked(authApi.login).mockResolvedValue({ token: 'test-token', message: 'OK' })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('redirige une route protégée vers la connexion', async () => {
    render(<App />)
    await waitFor(() => expect(window.location.pathname).toBe('/login'), { timeout: 5000 })
    expect(await screen.findByRole('heading', { name: 'CYBER-HUB' })).toBeTruthy()
  })

  it('ouvre les routes protégées après connexion et navigue entre elles', async () => {
    render(<App />)
    await waitFor(() => expect(window.location.pathname).toBe('/login'), { timeout: 5000 })
    await screen.findByRole('heading', { name: 'CYBER-HUB' })
    const password = document.querySelector('input[type="password"]')
    expect(password).not.toBeNull()
    fireEvent.change(password!, { target: { value: 'test-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Connexion' }))
    await screen.findByText('Dashboard chargé', {}, { timeout: 5000 })
    expect(localStorage.getItem('cyber_hub_token')).toBe('test-token')
    expect(window.location.pathname).toBe('/dashboard')
    const toolsLink = screen.getByRole('link', { name: /Outils/ })
    expect(toolsLink.getAttribute('href')).toBe('/tools')
    fireEvent.click(toolsLink)
    await waitFor(() => expect(window.location.pathname).toBe('/tools'), { timeout: 5000 })
    await screen.findByText('Outils chargés', {}, { timeout: 5000 })
  })

  it('demande huit caractères avant la configuration initiale', async () => {
    vi.mocked(authApi.getStatus).mockResolvedValue({ is_setup: false })
    vi.mocked(authApi.setup).mockResolvedValue({ token: 'setup-token', message: 'OK' })
    render(<App />)
    await waitFor(() => expect(window.location.pathname).toBe('/login'), { timeout: 5000 })
    await screen.findByPlaceholderText('Min. 8 caractères')
    const password = document.querySelector('input[type="password"]')
    expect(password).not.toBeNull()

    fireEvent.change(password!, { target: { value: 'sept123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Configurer' }))
    expect(screen.getByText('Le mot de passe doit contenir au moins 8 caractères')).toBeTruthy()
    expect(authApi.setup).not.toHaveBeenCalled()

    fireEvent.change(password!, { target: { value: 'huit1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Configurer' }))
    await screen.findByText('Dashboard chargé')
    expect(authApi.setup).toHaveBeenCalledWith('huit1234')
    expect(window.location.pathname).toBe('/dashboard')
  })
})
