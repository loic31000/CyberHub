import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import {
  LayoutDashboard, Wrench, FileText, ShieldAlert, BookOpen, LogOut, Search, Settings,
  ShieldBan, EyeOff, Network, History, GitBranch, Terminal, StickyNote, ChevronRight, Menu
} from 'lucide-react'
import clsx from 'clsx'

export default function Sidebar({ collapsed, setCollapsed, onSearchOpen, bgpAlertCount = 0 }: any) {
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const groups = [
    {
      section: 'CORE',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} />, end: true },
        { to: '/tools', label: 'Outils', icon: <Wrench size={16} /> },
        { to: '/ctf', label: 'Writeups CTF', icon: <FileText size={16} /> },
      ],
    },
    {
      section: 'INTEL',
      items: [
        { to: '/cve', label: 'CVE & KEV', icon: <ShieldAlert size={16} /> },
        { to: '/playbooks', label: 'Playbooks IR', icon: <BookOpen size={16} /> },
        { to: '/mitre', label: 'MITRE ATT&CK', icon: <Terminal size={16} /> },
        { to: '/lolbins', label: 'LOLBins', icon: <Terminal size={16} /> },
        // THREAT FEEDS SUPPRIMÉ ICI
      ],
    },
    {
      section: 'OPS',
      items: [
        { to: '/cloak', label: 'CLOAK OpSec', icon: <EyeOff size={16} /> },
        { to: '/ioc', label: 'IOC Manager', icon: <ShieldBan size={16} /> },
        { to: '/correlation', label: 'Corrélation', icon: <GitBranch size={16} /> },
        { to: '/osint', label: 'OSINT Runner', icon: <Search size={16} /> },
      ],
    },
    {
      section: 'MISC',
      items: [
        { to: '/notes', label: 'Notes', icon: <StickyNote size={16} /> },
        { to: '/cheatsheets', label: 'Cheatsheets', icon: <ChevronRight size={16} /> },
        { to: '/bgp', label: 'BGP Lookup', icon: <Network size={16} />, end: true },
        { to: '/bgp/historian', label: 'BGP Historian', icon: <History size={16} />, badge: bgpAlertCount },
        { to: '/settings', label: 'Paramètres', icon: <Settings size={16} /> },
      ],
    },
  ]

  return (
    <aside className={clsx('flex flex-col border-r bg-[#0a0e17] transition-all duration-300', collapsed ? 'w-16' : 'w-64')} style={{ borderColor: '#1e3045' }}>
      <div className="p-3 border-b flex justify-center" style={{ borderColor: '#1e3045' }}>
        {collapsed ? (
          <button onClick={() => setCollapsed(false)} className="p-2 text-[#4a6480] hover:text-[#00d4ff]"><Menu size={20}/></button>
        ) : (
          <button onClick={onSearchOpen} className="w-full flex items-center justify-between px-3 py-2 rounded bg-[#06080f] border border-[#1e3045] text-[#4a6480] text-xs font-mono">
            <span>SEARCH_</span>
            <kbd className="opacity-50">⌘K</kbd>
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 custom-scrollbar">
        {groups.map((g) => (
          <div key={g.section} className="mb-6">
            {!collapsed && <div className="px-6 mb-2 text-[9px] font-bold text-[#4a6480] tracking-[0.2em]">{g.section}</div>}
            {g.items.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => clsx(
                'flex items-center gap-3 px-6 py-2 text-xs font-mono transition-colors relative group',
                isActive ? 'text-[#00d4ff] bg-[#00d4ff]/5' : 'text-[#8a9ab0] hover:text-[#e2e8f0] hover:bg-[#1e3045]/30'
              )}>
                {({ isActive }) => (
                  <>
                    {isActive && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#00d4ff] shadow-[0_0_8px_#00d4ff]" />}
                    <span className={clsx(isActive && 'text-[#00d4ff]')}>{i.icon}</span>
                    {!collapsed && <span className="truncate">{i.label}</span>}
                    {i.badge ? <span className="ml-auto bg-[#ef4444] text-white text-[10px] px-1 rounded">{i.badge}</span> : null}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t" style={{ borderColor: '#1e3045' }}>
        <button onClick={() => { logout(); navigate('/login') }} className="flex items-center gap-3 text-[#ef4444] hover:bg-[#ef4444]/10 w-full p-2 rounded transition-colors text-xs font-mono">
          <LogOut size={16} /> {!collapsed && "SHUTDOWN"}
        </button>
      </div>
    </aside>
  )
}