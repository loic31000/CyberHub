import { Settings } from 'lucide-react'
import type { ComponentType } from 'react'
import {
  MODULE_CATEGORIES,
  NAVIGATION_MODULES,
  categoryOf,
  type ModuleCategory,
} from '@/dashboard2026/environmentRegistry'

/*
 * Shared shell navigation (topbar, rail, drawer, global search).
 *
 * One source of truth: the module registry integrated with the Dashboard 2026
 * (names, Console routes, CORE / INTEL / OPS / MISC categories, icons and
 * search aliases). The shell only adds the Settings page, which is not one of
 * the 18 modules but has always been reachable from the sidebar.
 */

export type ShellIcon = ComponentType<{ size?: number | string; className?: string }>

export type NavItem = {
  id: string
  title: string
  description: string
  route: string
  category: ModuleCategory
  icon: ShellIcon
  keywords: string[]
  /* Active only on the exact route (another module lives under it). */
  end?: boolean
}

const SETTINGS: NavItem = {
  id: 'settings',
  title: 'Paramètres',
  description: 'Préférences et maintenance de CyberHub',
  route: '/settings',
  category: 'misc',
  icon: Settings,
  keywords: ['settings', 'configuration', 'préférences', 'compte', 'sauvegarde'],
}

const EXACT = new Set(['/dashboard', '/knowledge', '/bgp'])

export const NAV_ITEMS: NavItem[] = [
  ...NAVIGATION_MODULES.map((module) => ({
    id: module.id,
    title: module.title,
    description: module.description,
    route: module.route,
    category: module.category,
    icon: module.icon,
    keywords: module.keywords,
    end: EXACT.has(module.route),
  })),
  SETTINGS,
]

export const NAV_GROUPS = MODULE_CATEGORIES.map((category) => ({
  ...category,
  items: NAV_ITEMS.filter((item) => item.category === category.id),
}))

/* The item a path belongs to: the longest matching route prefix. */
export function navItemFor(pathname: string) {
  return (
    [...NAV_ITEMS]
      .sort((a, b) => b.route.length - a.route.length)
      .find((item) => pathname === item.route || pathname.startsWith(item.route + '/')) ?? null
  )
}

export function breadcrumbFor(pathname: string) {
  if (pathname === '/knowledge' || pathname.startsWith('/knowledge/')) {
    return { section: 'INTEL', label: 'Knowledge Atlas' }
  }
  const item = navItemFor(pathname)
  return item ? { section: categoryOf(item.category).code, label: item.title } : { section: 'CORE', label: 'Dashboard' }
}
