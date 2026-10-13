import { useState } from 'react'
import type { FocusEvent, MouseEvent } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut, PanelLeftOpen } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { NAV_GROUPS } from '@/shell/navigation'

/*
 * CyberHub 2026 navigation rail, shared by every page: all modules as icons,
 * grouped CORE / INTEL / OPS / MISC with their real names and routes, plus
 * the "Tous les modules" drawer and the logout. Names are given by
 * aria-label and shown in a tooltip on hover and keyboard focus.
 */

type Tooltip = { text: string; top: number; left: number } | null

export default function Sidebar({
  bgpAlertCount = 0,
  drawerOpen,
  onOpenDrawer,
}: {
  bgpAlertCount?: number
  drawerOpen: boolean
  onOpenDrawer: (trigger: HTMLElement) => void
}) {
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [tooltip, setTooltip] = useState<Tooltip>(null)

  // One tooltip for the whole rail, placed next to the item (fixed position,
  // so the scrolling rail never clips it).
  const show = (event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
    const item = (event.target as HTMLElement).closest<HTMLElement>('[data-tooltip]')
    if (!item) return
    const rect = item.getBoundingClientRect()
    setTooltip({ text: item.dataset.tooltip ?? '', top: rect.top + rect.height / 2, left: rect.right + 12 })
  }
  const hide = () => setTooltip(null)

  return (
    <aside id="ch-rail" className="ch-rail" aria-label="Navigation principale" onMouseOver={show} onFocus={show} onMouseLeave={hide} onBlur={hide}>
      <nav className="ch-rail-nav" aria-label="Modules CyberHub">
        {NAV_GROUPS.map((group) => (
          <div key={group.id} className="ch-rail-group" role="group" aria-label={`${group.code} · ${group.label}`}>
            {group.items.map(({ id, title, route, icon: Icon, end }) => {
              const badge = id === 'bgp-historian' && bgpAlertCount > 0 ? bgpAlertCount : 0
              const label = badge ? `${title} · ${badge} alerte${badge > 1 ? 's' : ''}` : title
              return (
                <NavLink
                  key={route}
                  to={route}
                  end={end}
                  aria-label={label}
                  data-tooltip={label}
                  className={({ isActive }) => `ch-rail-item${isActive ? ' is-active' : ''}`}
                  onClick={hide}
                >
                  <Icon size={20} />
                  {badge > 0 && (
                    <span className="ch-rail-badge" aria-hidden="true">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

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
          <PanelLeftOpen size={20} />
        </button>
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
          <LogOut size={20} />
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
