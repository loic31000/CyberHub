import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import {
  LayoutDashboard, Wrench, FileText, ShieldAlert, BookOpen, LogOut, Settings,
  ShieldBan, EyeOff, Network, History, GitBranch, Terminal, StickyNote, ChevronRight, Search, Binary, Zap
} from 'lucide-react'
import clsx from 'clsx'

export default function Sidebar({ collapsed, bgpAlertCount = 0 }: any) {
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const groups = [
    {
      section: 'CORE',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, end: true },
        { to: '/tools', label: 'Outils', icon: <Wrench size={18} /> },
        { to: '/ctf', label: 'Writeups', icon: <FileText size={18} /> },
      ],
    },
    {
      section: 'INTEL',
      items: [
        { to: '/cve', label: 'CVE & KEV', icon: <ShieldAlert size={18} /> },
        { to: '/playbooks', label: 'Playbooks', icon: <BookOpen size={18} /> },
        { to: '/mitre', label: 'MITRE ATT&CK', icon: <Terminal size={18} /> },
        { to: '/lolbins', label: 'LOLBins', icon: <Terminal size={18} /> },
      ],
    },
    {
      section: 'OPS',
      items: [
        { to: '/cloak', label: 'CLOAK OpSec', icon: <EyeOff size={18} /> },
        { to: '/ioc', label: 'IOC Manager', icon: <ShieldBan size={18} /> },
        { to: '/correlation', label: 'Corrélation', icon: <GitBranch size={18} /> },
        { to: '/osint', label: 'OSINT Runner', icon: <Search size={18} /> },
      ],
    },
    {
      section: 'MISC',
      items: [
        { to: '/notes', label: 'Notes', icon: <StickyNote size={18} /> },
        { to: '/cheatsheets', label: 'Cheatsheets', icon: <ChevronRight size={18} /> },
        { to: '/encoder', label: 'Encoder/Decoder', icon: <Binary size={18} /> },
        { to: '/revshell', label: 'RevShell Gen', icon: <Zap size={18} /> },
        { to: '/bgp', label: 'BGP Lookup', icon: <Network size={18} />, end: true },
        { to: '/bgp/historian', label: 'BGP Historian', icon: <History size={18} />, badge: bgpAlertCount },
        { to: '/settings', label: 'Paramètres', icon: <Settings size={18} /> },
      ],
    },
  ]

  return (
    <aside className={clsx('bg-[#06080f] border-r border-[#1e2d40] flex flex-col transition-all duration-300', collapsed ? 'w-20' : 'w-64')}>
      
      {/* MENU DE NAVIGATION - POLICE PLUS LISIBLE (text-sm font-medium) */}
      <nav className="flex-1 overflow-y-auto py-6 space-y-6 custom-scrollbar">
        {groups.map((g) => (
          <div key={g.section} className="mb-2">
            {!collapsed && <div className="px-6 mb-3 text-[10px] font-bold text-[#4a6480] tracking-[0.15em]">{g.section}</div>}
            
            {g.items.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => clsx(
                'flex items-center gap-3 py-2.5 text-sm font-medium transition-colors relative group',
                collapsed ? 'justify-center mx-4 rounded-md' : 'px-6',
                isActive ? 'text-[#00d4ff] bg-[#00d4ff]/5' : 'text-[#8a9ab0] hover:text-[#e2e8f0] hover:bg-[#1e2d40]/40'
              )}>
                {({ isActive }) => (
                  <>
                    {isActive && !collapsed && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#00d4ff] shadow-[0_0_8px_#00d4ff]" />}
                    <span className={clsx(isActive ? 'text-[#00d4ff]' : 'text-[#64748b] group-hover:text-[#8a9ab0]')}>{i.icon}</span>
                    {!collapsed && <span className="truncate">{i.label}</span>}
                    {i.badge ? <span className={clsx("bg-[#ef4444] text-white text-[10px] px-1.5 py-0.5 rounded font-mono", collapsed ? "absolute top-1 right-1" : "ml-auto")}>{i.badge}</span> : null}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* FOOTER DECONNEXION */}
      <div className="p-4 border-t border-[#1e2d40]">
        <button onClick={() => { logout(); navigate('/login') }} className={clsx("flex items-center gap-3 text-[#ef4444] hover:bg-[#ef4444]/10 w-full rounded transition-colors text-sm font-medium", collapsed ? 'justify-center p-2' : 'px-3 py-2.5')}>
          <LogOut size={18} /> {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  )
}