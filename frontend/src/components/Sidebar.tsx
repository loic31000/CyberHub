import { useEffect, useRef, useState } from 'react'
import type { FocusEvent, MouseEvent } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, PanelLeftOpen, SlidersHorizontal } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { NAV_GROUPS, NAV_ITEMS, navItemFor, type NavItem } from '@/shell/navigation'
import NavigationSections from '@/shell/NavigationSections'
import type { NavigationPreferences } from '@/shell/navigationPreferences'

/*
 * CyberHub 2026 navigation rail, shared by every page. The essential rail
 * shows chosen shortcuts; the full rail keeps every module and its groups.
 * Names remain available to assistive technology and in hover/focus tooltips.
 */

type Tooltip = { text: string; top: number; left: number } | null

export default function Sidebar({
  bgpAlertCount = 0,
  drawerOpen,
  onOpenDrawer,
  onCustomize,
  preferences,
  onToggleGroup,
}: {
  bgpAlertCount?: number
  drawerOpen: boolean
  onOpenDrawer: (trigger: HTMLElement) => void
  onCustomize: (trigger: HTMLElement) => void
  preferences: NavigationPreferences
  onToggleGroup: (id: string) => void
}) {
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const location = useLocation()
  const [tooltip, setTooltip] = useState<Tooltip>(null)
  const railRef = useRef<HTMLElement>(null)
  const dashboard = NAV_ITEMS.find((item) => item.id === 'dashboard')!
  const settings = NAV_ITEMS.find((item) => item.id === 'settings')
  const compactFavorites = preferences.favorites
    .map((id) => NAV_ITEMS.find((item) => item.id === id))
    .filter((item): item is NavItem => !!item && item.id !== dashboard.id && item.id !== settings?.id)
    .slice(0, 5)
  const activeItem = navItemFor(location.pathname)
  const temporaryActive = activeItem && activeItem.id !== dashboard.id && activeItem.id !== settings?.id
    && !compactFavorites.some((item) => item.id === activeItem.id) ? activeItem : null

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const active = [...(railRef.current?.querySelectorAll<HTMLElement>('.ch-rail-compact .ch-rail-item.is-active, .ch-rail-expanded .ch-nav-link.is-active') ?? [])]
        .find((item) => item.getClientRects().length > 0)
      active?.scrollIntoView({ block: 'nearest' })
    })
    return () => cancelAnimationFrame(frame)
  }, [location.pathname, preferences.mode, preferences.railContent, preferences.favorites])

  // One tooltip for the whole rail, placed next to the item (fixed position,
  // so the scrolling rail never clips it).
  const show = (event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
    const item = (event.target as HTMLElement).closest<HTMLElement>('[data-tooltip]')
    if (!item) return
    const rect = item.getBoundingClientRect()
    setTooltip({ text: item.dataset.tooltip ?? '', top: rect.top + rect.height / 2, left: rect.right + 12 })
  }
  const hide = () => setTooltip(null)

  const railLink = (item: NavItem, favorite = false, footer = false) => {
    const Icon = item.icon
    const badge = item.id === 'bgp-historian' && bgpAlertCount > 0 ? bgpAlertCount : 0
    const label = badge ? `${item.title} · ${badge} alerte${badge > 1 ? 's' : ''}` : item.title
    return (
      <NavLink key={item.id} to={item.route} end={item.end} aria-label={label}
        data-tooltip={favorite ? `Favori · ${label}` : label}
        className={({ isActive }) => `ch-rail-item${isActive ? ' is-active' : ''}${footer ? ' ch-rail-settings' : ''}`}
        onClick={hide}>
        <Icon size={20} aria-hidden="true" />
        {badge > 0 && <span className="ch-rail-badge" aria-hidden="true">{badge > 99 ? '99+' : badge}</span>}
      </NavLink>
    )
  }

  return (
    <aside ref={railRef} id="ch-rail" className="ch-rail" aria-label="Navigation principale" onMouseOver={show} onFocus={show} onMouseLeave={hide} onBlur={hide}>
      <nav className={`ch-rail-nav ch-rail-compact${preferences.railContent === 'essential' ? ' is-essential' : ''}`}
        aria-label={preferences.railContent === 'essential' ? 'Raccourcis CyberHub' : 'Modules CyberHub'} onScroll={hide}>
        {preferences.railContent === 'essential' ? (
          <>
            <div className="ch-rail-group" role="group" aria-label="Accueil">
              {railLink(dashboard)}
            </div>
            {(compactFavorites.length > 0 || temporaryActive) && (
              <div className="ch-rail-group" role="group" aria-label="Favoris et module courant">
                {compactFavorites.map((item) => railLink(item, true))}
                {temporaryActive && railLink(temporaryActive)}
              </div>
            )}
          </>
        ) : NAV_GROUPS.map((group) => (
          <div key={group.id} className="ch-rail-group" role="group" aria-label={`${group.code} · ${group.label}`}>
            {group.items.map((item) => railLink(item))}
          </div>
        ))}
      </nav>

      <div className="ch-rail-expanded">
        <div className="ch-rail-expanded-head"><span>NAVIGATION</span><strong>CyberHub / 2026</strong></div>
        <NavigationSections idPrefix="ch-expanded" preferences={preferences} onToggleGroup={onToggleGroup} bgpAlertCount={bgpAlertCount} />
      </div>

      <div className="ch-rail-foot">
        <button
          type="button"
          className="ch-rail-item"
          aria-label="Tous les modules"
          data-tooltip="Tous les modules"
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          aria-controls="ch-drawer"
          onClick={(event) => {
            hide()
            onOpenDrawer(event.currentTarget)
          }}
        >
          <PanelLeftOpen size={20} aria-hidden="true" /><span className="ch-rail-item-label">Tous les modules</span>
        </button>
        <button type="button" className="ch-rail-item ch-rail-customize" aria-label="Personnaliser la navigation"
          data-tooltip="Personnaliser la navigation"
          onClick={(event) => { hide(); onCustomize(event.currentTarget) }}>
          <SlidersHorizontal size={19} aria-hidden="true" /><span className="ch-rail-item-label">Personnaliser</span>
        </button>
        {preferences.railContent === 'essential' && settings && railLink(settings, false, true)}
        <button
          type="button"
          className="ch-rail-item is-danger"
          aria-label="Déconnexion"
          data-tooltip="Déconnexion"
          onClick={() => {
            logout()
            navigate('/login')
          }}
        >
          <LogOut size={20} aria-hidden="true" /><span className="ch-rail-item-label">Déconnexion</span>
        </button>
      </div>

      {tooltip && (
        <span className="ch-tooltip" aria-hidden="true" style={{ top: tooltip.top, left: tooltip.left }}>
          {tooltip.text}
        </span>
      )}
    </aside>
  )
}
