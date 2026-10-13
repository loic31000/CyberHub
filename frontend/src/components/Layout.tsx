import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Menu, Search, Settings } from 'lucide-react'
import Sidebar from './Sidebar'
import ToastContainer from './Toast'
import SearchModal from './SearchModal'
import ModuleDrawer from '@/shell/ModuleDrawer'
import { breadcrumbFor } from '@/shell/navigation'
import { bgpApi } from '@/api/client'
import { useAuthStore } from '@/store/auth'
import '@/shell/shell.css'

/*
 * CyberHub 2026 shared shell: one topbar, one navigation rail, one
 * "Tous les modules" drawer and one global search for every page. The page
 * area below is unchanged: each module keeps its own layout and styles.
 */

function useClock() {
  const fmt = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const [time, setTime] = useState(fmt)
  useEffect(() => {
    const id = setInterval(() => setTime(fmt()), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

export default function Layout() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const searchTrigger = useRef<HTMLButtonElement>(null)
  const burger = useRef<HTMLButtonElement>(null)
  const searchReturnFocus = useRef<HTMLElement | null>(null)
  const drawerReturnFocus = useRef<HTMLElement | null>(null)
  const [bgpAlertCount, setBgpAlertCount] = useState(0)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const location = useLocation()
  const clock = useClock()
  const crumb = breadcrumbFor(location.pathname)

  const openSearch = (target: HTMLElement | null) => {
    searchReturnFocus.current = target ?? searchTrigger.current
    setDrawerOpen(false)
    setSearchOpen(true)
  }
  const closeSearch = () => {
    const target = searchReturnFocus.current
    setSearchOpen(false)
    window.setTimeout(() => (target?.isConnected ? target : searchTrigger.current)?.focus(), 0)
  }
  const openDrawer = (trigger: HTMLElement) => {
    drawerReturnFocus.current = trigger
    setSearchOpen(false)
    setDrawerOpen(true)
  }

  // Ctrl+K / Cmd+K opens the global search from any page.
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (!event.repeat) openSearch(document.activeElement instanceof HTMLElement ? document.activeElement : null)
      }
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [])

  // A route change closes the drawer.
  useEffect(() => setDrawerOpen(false), [location.pathname])

  useEffect(() => {
    if (!isAuthenticated) return
    bgpApi.getAlerts(1, 0).then((r) => setBgpAlertCount(r.total)).catch(() => {})
  }, [isAuthenticated])

  return (
    <div className="ch-shell flex flex-col h-screen overflow-hidden bg-[#06080f] text-[#f1f5f9] font-sans selection:bg-[#00d4ff]/30">
      <a className="ch-skip" href="#ch-main">
        Aller au contenu
      </a>

      <header className="ch-topbar">
        <button
          ref={burger}
          type="button"
          className="ch-icon-button"
          aria-label={drawerOpen ? 'Fermer tous les modules' : 'Ouvrir tous les modules'}
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          aria-controls="ch-drawer"
          onClick={(event) => (drawerOpen ? setDrawerOpen(false) : openDrawer(event.currentTarget))}
        >
          <Menu size={19} />
        </button>

        <Link to="/dashboard" className="ch-brand" aria-label="CyberHub, retour au Dashboard">
          <img src="/dashboard-2026/mark.svg" alt="" width={30} height={30} />
          <span>
            CYBER<b>HUB</b>
          </span>
        </Link>

        <button
          ref={searchTrigger}
          type="button"
          className="ch-search-trigger"
          aria-label="Ouvrir la recherche globale"
          aria-haspopup="dialog"
          aria-keyshortcuts="Control+K Meta+K"
          onClick={(event) => openSearch(event.currentTarget)}
        >
          <Search size={16} aria-hidden="true" />
          <span>Rechercher…</span>
          <kbd className="ch-kbd">Ctrl K</kbd>
        </button>

        <nav className="ch-breadcrumb" aria-label="Fil d’Ariane">
          <span aria-hidden="true">~ /</span>
          <span>{crumb.section} /</span>
          <span aria-current="page">{crumb.label}</span>
        </nav>

        <div className="ch-status">
          {bgpAlertCount > 0 && (
            <Link to="/bgp/historian" className="ch-alert-pill" aria-label={`${bgpAlertCount} alertes BGP enregistrées, ouvrir BGP Historian`}>
              {bgpAlertCount} BGP
            </Link>
          )}
          {/* Real state: the shell is only rendered for an authenticated session. */}
          <span className="ch-session">
            <i aria-hidden="true" />
            <span>SESSION AUTHENTIFIÉE</span>
          </span>
          <time className="ch-clock">{clock}</time>
          <NavLink to="/settings" className={({ isActive }) => `ch-topbar-icon${isActive ? ' is-active' : ''}`} aria-label="Paramètres">
            <Settings size={18} />
          </NavLink>
        </div>
      </header>

      <div className="ch-body">
        <Sidebar bgpAlertCount={bgpAlertCount} drawerOpen={drawerOpen} onOpenDrawer={openDrawer} />
        <main id="ch-main" className="flex-1 flex flex-col overflow-hidden relative">
          <div className="flex-1 overflow-auto z-10 custom-scrollbar">
            <Outlet />
          </div>
        </main>
      </div>

      <ModuleDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} returnFocus={drawerReturnFocus} bgpAlertCount={bgpAlertCount} />
      <ToastContainer />
      <SearchModal open={searchOpen} onClose={closeSearch} />
    </div>
  )
}
