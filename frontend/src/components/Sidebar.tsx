import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import {
  LayoutDashboard, Wrench, FileText, ShieldAlert,
  BookOpen, LogOut, Shield, Search, Settings,
  Crosshair, ShieldBan, EyeOff, Network, History, GitBranch, Terminal,
} from 'lucide-react'
import clsx from 'clsx'
import { bgpApi } from '@/api/client'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  disabled?: boolean
  badge?: number
  end?: boolean
}

interface Props {
  onSearchOpen?: () => void
}

export default function Sidebar({ onSearchOpen }: Props) {
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  // Badge alertes BGP non acquittées
  const [bgpAlertCount, setBgpAlertCount] = useState(0)

  useEffect(() => {
    if (!isAuthenticated) return

    const fetchAlertCount = () => {
      bgpApi
        .getAlerts(1, 0)
        .then((r) => setBgpAlertCount(r.total))
        .catch(() => {
          // Silencieux — le module BGP peut ne pas avoir de données encore
        })
    }

    fetchAlertCount()
    // Vérification périodique toutes les 60 secondes
    const interval = setInterval(fetchAlertCount, 60_000)
    return () => clearInterval(interval)
  }, [isAuthenticated])

  const navItems: NavItem[] = [
    { to: '/dashboard',   label: 'Dashboard',      icon: <LayoutDashboard size={18} /> },
    { to: '/tools',       label: 'Outils',          icon: <Wrench size={18} /> },
    { to: '/ctf',         label: 'Writeups CTF',    icon: <FileText size={18} /> },
    { to: '/cve',         label: 'Veille CVE',      icon: <ShieldAlert size={18} /> },
    { to: '/playbooks',   label: 'Playbooks',       icon: <BookOpen size={18} /> },
    { to: '/mitre',       label: 'MITRE ATT&CK',   icon: <Crosshair size={18} /> },
    { to: '/cloak',       label: 'CLOAK OpSec',     icon: <EyeOff size={18} /> },
    { to: '/ioc',         label: 'IOC Manager',     icon: <ShieldBan size={18} /> },
    { to: '/correlation', label: 'Corrélation',     icon: <GitBranch size={18} /> },
    { to: '/osint',       label: 'OSINT Runner',   icon: <Search size={18} /> },
    { to: '/notes',       label: 'Notes',           icon: <FileText size={18} /> },
    { to: '/cheatsheets', label: 'Cheatsheets',     icon: <Terminal size={18} /> },
    { to: '/lolbins',     label: 'LOLBins',         icon: <Terminal size={18} /> },
    { to: '/bgp',         label: 'BGP Lookup',      icon: <Network size={18} />, end: true },
    { to: '/bgp/historian', label: 'BGP Historian', icon: <History size={18} />, badge: bgpAlertCount },
    { to: '/settings',    label: 'Paramètres',      icon: <Settings size={18} /> },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="w-56 min-h-screen bg-bg-secondary border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-2">
          <Shield size={22} className="text-cyber-cyan" />
          <span className="text-cyber-cyan font-bold text-lg tracking-wider">
            CYBER<span className="text-text-primary">HUB</span>
          </span>
        </div>
        <p className="text-text-muted text-xs mt-1">v0.8 · local & offline</p>
      </div>

      {/* Barre de recherche rapide Ctrl+K */}
      <div className="px-3 pt-3">
        <button
          onClick={onSearchOpen}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-bg-primary hover:border-accent/50 transition-colors text-text-muted hover:text-text-secondary group"
          title="Ctrl+K"
        >
          <Search size={14} className="flex-shrink-0" />
          <span className="flex-1 text-left text-xs truncate">Rechercher…</span>
          <kbd className="hidden group-hover:inline-block text-xs border border-border rounded px-1 leading-tight flex-shrink-0">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) =>
          item.disabled ? (
            <div
              key={item.to}
              className="flex items-center gap-3 px-3 py-2 rounded text-text-muted cursor-not-allowed opacity-40"
              title="Bientôt disponible"
            >
              {item.icon}
              <span className="text-sm">{item.label}</span>
              <span className="ml-auto text-xs bg-bg-hover px-1.5 rounded">bientôt</span>
            </div>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end ?? false}
              className={({ isActive }) =>
                clsx('nav-item text-sm', isActive && 'active')
              }
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {/* Badge (ex: alertes BGP non acquittées) */}
              {item.badge !== undefined && item.badge > 0 && (
                <span className="ml-auto px-1.5 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold leading-none min-w-[18px] text-center">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </NavLink>
          ),
        )}
      </nav>

      {/* Bas : logout */}
      <div className="p-3 border-t border-border">
        <button
          onClick={handleLogout}
          className="nav-item text-sm w-full text-cyber-red hover:text-cyber-red hover:bg-cyber-red/10"
        >
          <LogOut size={18} /> Déconnexion
        </button>
      </div>
    </aside>
  )
}
