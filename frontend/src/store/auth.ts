import { create } from 'zustand'

interface AuthState {
  token: string | null
  isAuthenticated: boolean
  setToken: (token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  // Restaurer le token depuis localStorage au démarrage
  token: localStorage.getItem('cyber_hub_token'),
  isAuthenticated: !!localStorage.getItem('cyber_hub_token'),

  setToken: (token: string) => {
    localStorage.setItem('cyber_hub_token', token)
    set({ token, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('cyber_hub_token')
    set({ token: null, isAuthenticated: false })
  },
}))
