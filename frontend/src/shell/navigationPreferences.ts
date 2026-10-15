import { useEffect, useState } from 'react'
import { NAV_GROUPS, NAV_ITEMS } from './navigation'

export type NavigationMode = 'auto' | 'compact' | 'expanded'
export type NavigationDensity = 'standard' | 'comfort'
export type RailContent = 'essential' | 'full'

export type NavigationPreferences = {
  mode: NavigationMode
  density: NavigationDensity
  railContent: RailContent
  favorites: string[]
  collapsed: string[]
}

const KEY = 'cyberhub.navigation.v1'
const ITEM_IDS = new Set(NAV_ITEMS.map((item) => item.id))
const GROUP_IDS = new Set(NAV_GROUPS.map((group) => group.id))

export const DEFAULT_NAVIGATION: NavigationPreferences = {
  mode: 'auto',
  density: 'standard',
  railContent: 'essential',
  favorites: [],
  collapsed: [],
}

function validIds(value: unknown, allowed: Set<string>) {
  return Array.isArray(value)
    ? [...new Set(value.filter((id): id is string => typeof id === 'string' && allowed.has(id)))]
    : []
}

export function readNavigationPreferences(): NavigationPreferences {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_NAVIGATION }
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return { ...DEFAULT_NAVIGATION }
    const prefs = value as Partial<NavigationPreferences>
    return {
      mode: prefs.mode === 'compact' || prefs.mode === 'expanded' ? prefs.mode : 'auto',
      density: prefs.density === 'comfort' ? 'comfort' : 'standard',
      railContent: prefs.railContent === 'full' ? 'full' : 'essential',
      favorites: validIds(prefs.favorites, ITEM_IDS),
      collapsed: validIds(prefs.collapsed, GROUP_IDS),
    }
  } catch {
    return { ...DEFAULT_NAVIGATION }
  }
}

export function useNavigationPreferences() {
  const [preferences, setPreferences] = useState(readNavigationPreferences)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(preferences)) } catch { /* storage can be unavailable */ }
  }, [preferences])

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === KEY) setPreferences(readNavigationPreferences())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  return [preferences, setPreferences] as const
}
