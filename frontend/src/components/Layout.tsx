import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import ToastContainer from './Toast'
import SearchModal from './SearchModal'
import { bgpApi } from '@/api/client'
import { useAuthStore } from '@/store/auth'
import { ChevronLeft, Search } from 'lucide-react'

const ROUTE_META: Record<string, { section: string; label: string }> = {
  '/dashboard':     { section: 'CORE',  label: 'DASHBOARD' },
  '/tools':         { section: 'CORE',  label: 'OUTILS' },
  '/ctf':           { section: 'CORE',  label: 'WRITEUPS CTF' },
  '/cve':           { section: 'INTEL', label: 'VEILLE CVE & KEV' },
  '/playbooks':     { section: 'INTEL', label: 'PLAYBOOKS IR' },
  '/mitre':         { section: 'INTEL', label: 'MITRE ATT&CK' },
  '/lolbins':       { section: 'INTEL', label: 'LOLBINS & GTFO' },
  '/cloak':         { section: 'OPS',   label: 'CLOAK OPSEC' },
  '/ioc':           { section: 'OPS',   label: 'IOC MANAGER' },
  '/correlation':   { section: 'OPS',   label: 'CORRÉLATION' },
  '/osint':         { section: 'OPS',   label: 'OSINT RUNNER' },
  '/notes':         { section: 'MISC',  label: 'NOTES OPÉRATIONNELLES' },
  '/cheatsheets':   { section: 'MISC',  label: 'CHEATSHEETS' },
  '/bgp':           { section: 'MISC',  label: 'BGP LOOKUP' },
  '/bgp/historian': { section: 'MISC',  label: 'BGP HISTORIAN' },
  '/settings':      { section: 'MISC',  label: 'PARAMÈTRES' },
}

function useClock() {
  const fmt = () => new Date().toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false })
  const [time, setTime] = useState(fmt)
  useEffect(() => {
    const id = setInterval(() => setTime(fmt()), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

export default function Layout() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [collapsed, setCollapsed]   = useState(false)
  const [bgpAlertCount, setBgpAlertCount] = useState(0)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const location = useLocation()
  const clock = useClock()

  const segments = location.pathname.split('/').filter(Boolean)
  const top = '/' + (segments[0] ?? '')
  const meta = ROUTE_META[location.pathname] ?? ROUTE_META[top] ?? { section: 'CORE', label: 'DASHBOARD' }

  useEffect(() => {
    if (!isAuthenticated) return
    bgpApi.getAlerts(1, 0).then((r) => setBgpAlertCount(r.total)).catch(() => {})
  }, [isAuthenticated])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#06080f] text-[#f1f5f9] font-sans selection:bg-[#00d4ff]/30">
      
      {/* TOPBAR alignée (h-16) */}
      <header className="flex items-stretch h-16 border-b bg-[#0a0e17] flex-shrink-0 z-20" style={{ borderColor: '#1e2d40' }}>
        
        {/* ZONE LOGO STRICTEMENT ALIGNÉE AVEC LA SIDEBAR (w-64 ou w-20) */}
        <div className={`flex items-center px-6 border-r transition-[width] duration-300 overflow-hidden ${collapsed ? 'w-20 justify-center' : 'w-64 justify-between'}`} style={{ borderColor: '#1e2d40' }}>
          <div className="flex items-center gap-3">
            
            {/* ENCADRÉ CARRÉ NÉON */}
            <div 
              className="flex items-center justify-center w-8 h-8 border border-[#00d4ff] shadow-[0_0_10px_#00d4ff] rounded-md flex-shrink-0 cursor-pointer hover:drop-shadow-[0_0_5px_rgba(0,212,255,0.8)] transition-all"
              onClick={() => setCollapsed(!collapsed)}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#00d4ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>

            {/* GROS TITRE */}
            {!collapsed && (
              <h1 className="text-xl font-black tracking-widest text-[#f1f5f9] flex items-center m-0">
                CYBER<span className="text-[#00d4ff]">HUB</span>
              </h1>
            )}
          </div>
          
          {/* BOUTON DE RÉTRACTATION */}
          {!collapsed && (
            <button 
              onClick={() => setCollapsed(true)} 
              className="text-[#64748b] hover:text-[#00d4ff] transition-colors flex-shrink-0 flex items-center justify-center"
              title="Réduire le menu"
            >
              <ChevronLeft size={18} />
            </button>
          )}
        </div>

        {/* SEARCH BAR & BREADCRUMB */}
        <div className="flex-1 flex items-center px-6 gap-6">
          <button onClick={() => setSearchOpen(true)} className="flex items-center gap-2 text-[#64748b] hover:text-[#00d4ff] transition-colors text-xs font-mono group">
            <Search size={14} className="opacity-50 group-hover:opacity-100" />
            <span>[CTRL+K] COMMAND_SEARCH</span>
          </button>
          
          <div className="h-4 w-px bg-[#1e2d40]" />

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-[#64748b]">~ /</span>
            <span className="text-[#64748b]">{meta.section} /</span>
            <span className="text-[#f1f5f9] font-medium">{meta.label}</span>
          </div>
        </div>

        {/* RIGHT ACTIONS */}
        <div className="flex items-center gap-5 px-6 font-mono text-[11px]">
          {bgpAlertCount > 0 && (
            <div className="text-[#ef4444] border border-[#ef4444]/30 bg-[#ef4444]/10 px-2 py-0.5 rounded">
              {bgpAlertCount} BGP ALERTS
            </div>
          )}
          <div className="flex items-center gap-2 text-[#64748b]">
            <div className="w-2 h-2 rounded-full bg-[#10b981]" />
            <span>ONLINE</span>
          </div>
          <span className="text-[#64748b]">{clock}</span>
        </div>
      </header>

      {/* BODY */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} bgpAlertCount={bgpAlertCount} />
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <div className="absolute inset-0 pointer-events-none opacity-[0.02] bg-[repeating-linear-gradient(0deg,transparent,transparent_1px,#fff_1px,#fff_2px)] z-50" />
          <div className="flex-1 overflow-auto z-10 custom-scrollbar"><Outlet /></div>
        </main>
      </div>
      <ToastContainer />
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}