import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronRight, Star } from 'lucide-react'
import { NAV_GROUPS, NAV_ITEMS, navItemFor, type NavItem } from './navigation'
import type { NavigationPreferences } from './navigationPreferences'

export default function NavigationSections({ idPrefix, preferences, onToggleGroup, onNavigate, bgpAlertCount = 0 }: {
  idPrefix: string
  preferences: NavigationPreferences
  onToggleGroup: (id: string) => void
  onNavigate?: () => void
  bgpAlertCount?: number
}) {
  const location = useLocation()
  const active = navItemFor(location.pathname)
  const favorites = preferences.favorites
    .map((id) => NAV_ITEMS.find((item) => item.id === id))
    .filter((item): item is NavItem => !!item)

  const link = (item: NavItem, favorite = false) => {
    const Icon = item.icon
    const count = item.id === 'bgp-historian' ? bgpAlertCount : 0
    const label = count > 0 ? `${item.title} · ${count} alerte${count > 1 ? 's' : ''}` : item.title
    return (
      <li key={item.id}>
        <NavLink to={item.route} end={item.end} aria-label={label}
          className={({ isActive }) => `ch-nav-link${isActive ? ' is-active' : ''}`}
          onClick={onNavigate}>
          <Icon size={17} aria-hidden="true" />
          <span className="ch-nav-copy"><strong>{item.title}</strong><small>{item.description}</small></span>
          {favorite ? <Star size={12} className="ch-nav-star" aria-hidden="true" /> : <ChevronRight size={13} className="ch-nav-arrow" aria-hidden="true" />}
        </NavLink>
      </li>
    )
  }

  return (
    <nav className="ch-nav-sections" aria-label="Modules CyberHub">
      {favorites.length > 0 && (
        <section className="ch-nav-group is-favorites" aria-labelledby={`${idPrefix}-favorites`}>
          <h3 id={`${idPrefix}-favorites`} className="ch-nav-group-title"><Star size={12} aria-hidden="true" /> FAVORIS</h3>
          <ul className="ch-nav-list">{favorites.map((item) => link(item, true))}</ul>
        </section>
      )}
      {NAV_GROUPS.map((group) => {
        const collapsed = preferences.collapsed.includes(group.id)
        return (
          <section key={group.id} className="ch-nav-group" aria-labelledby={`${idPrefix}-${group.id}`}>
            <h3 id={`${idPrefix}-${group.id}`}>
              <button type="button" className={`ch-nav-group-toggle${active?.category === group.id ? ' is-current' : ''}`}
                aria-expanded={!collapsed} aria-controls={`${idPrefix}-list-${group.id}`}
                onClick={() => onToggleGroup(group.id)}>
                <b>{group.code}</b><span>{group.label}</span><ChevronDown size={13} aria-hidden="true" />
              </button>
            </h3>
            <ul id={`${idPrefix}-list-${group.id}`} className="ch-nav-list" hidden={collapsed}>
              {group.items.map((item) => link(item))}
            </ul>
          </section>
        )
      })}
    </nav>
  )
}
