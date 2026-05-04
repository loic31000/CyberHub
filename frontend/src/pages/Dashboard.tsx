import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { statsApi, toolsApi, bgpApi, iocApi } from '@/api/client'
import type { Stats, Tool } from '@/types'
import { 
  Database, Trophy, ShieldAlert, BookOpen, Activity, Shield, 
  AlertTriangle, GitBranch, ChevronRight, 
  Terminal, Crosshair, Search, EyeOff, Network 
} from 'lucide-react'

// Grande carte pour les 4 KPIs principaux
const StatCard = ({ item, onClick }: { item: any, onClick: () => void }) => (
  <div 
    onClick={onClick} 
    className="group relative bg-[#0a0e17] border border-[#1e2d40] rounded-md p-5 cursor-pointer overflow-hidden transition-all duration-300 hover:border-[#00d4ff]/50 hover:shadow-[0_0_20px_rgba(0,212,255,0.1)]"
  >
    <div className="absolute -inset-px bg-gradient-to-br from-[#00d4ff]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    <div className="relative z-10 flex flex-col h-full justify-between">
      <div className="flex justify-between items-start mb-6">
        <span className="text-[#64748b] text-[11px] font-mono uppercase tracking-widest">{item.label}</span>
        <div className="text-[#00d4ff] drop-shadow-[0_0_8px_rgba(0,212,255,0.8)]">
          {item.icon}
        </div>
      </div>
      <div>
        <div className="text-4xl font-mono font-light text-[#f1f5f9] mb-1 group-hover:text-[#00d4ff] transition-colors">
          {item.value ?? '00'}
        </div>
        <div className="text-[11px] text-[#94a3b8] font-mono">{item.sub}</div>
      </div>
    </div>
  </div>
)

// Ligne compacte pour les modules secondaires (côté droit)
const CompactModule = ({ item, onClick }: { item: any, onClick: () => void }) => (
  <div 
    onClick={onClick}
    className="flex items-center justify-between p-3 bg-[#0a0e17] border border-[#1e2d40] rounded-md hover:border-[#00d4ff]/50 hover:bg-[#00d4ff]/5 cursor-pointer transition-all group"
  >
    <div className="flex items-center gap-3">
      <div className="p-1.5 bg-[#06080f] border border-[#1e2d40] rounded group-hover:border-[#00d4ff]/30 text-[#64748b] group-hover:text-[#00d4ff] transition-colors">
        {item.icon}
      </div>
      <div>
        <div className="text-sm font-medium text-[#f1f5f9] group-hover:text-[#00d4ff] transition-colors">{item.label}</div>
        <div className="text-[10px] font-mono text-[#64748b]">{item.sub}</div>
      </div>
    </div>
    <div className="text-xs font-mono text-[#f1f5f9] group-hover:text-[#00d4ff] transition-colors bg-[#06080f] px-2 py-1 rounded border border-[#1e2d40] group-hover:border-[#00d4ff]/30">
      {item.value}
    </div>
  </div>
)

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentTools, setRecentTools] = useState<Tool[]>([])
  const [bgpAlerts, setBgpAlerts] = useState<any[]>([])
  const [iocCount, setIocCount] = useState<number>(0)

  useEffect(() => {
    statsApi.get().then(setStats).catch(() => {})
    toolsApi.list().then(r => setRecentTools(r.tools)).catch(() => {})
    bgpAlerts // trigger the api call just below
    bgpApi.getAlerts(5, 0).then(r => setBgpAlerts(r.items ?? [])).catch(() => {})
    iocApi.list({ limit: 1 } as any).then(r => setIocCount(r.total ?? 0)).catch(() => {})
  }, [])

  // Seulement les 4 métriques principales en haut
  const mainKpis = [
    { label: 'Payloads', value: stats?.tools_total, sub: 'Scripts & exploits', icon: <Database size={20}/>, path: '/tools' },
    { label: 'Writeups', value: stats?.ctf_total, sub: 'CTF Database', icon: <Trophy size={20}/>, path: '/ctf' },
    { label: 'Veille Live', value: stats?.cve_total, sub: 'CVE & KEV Live', icon: <ShieldAlert size={20}/>, path: '/cve' },
    { label: 'Playbooks', value: stats?.playbooks_total, sub: 'IR Procedures', icon: <BookOpen size={20}/>, path: '/playbooks' },
  ]

  // Le reste passe en format liste compacte sur le côté
  const tacticalModules = [
    { label: 'Intelligence', value: iocCount > 0 ? `+${iocCount}` : '0', sub: 'IOCs matched', icon: <Activity size={16}/>, path: '/ioc' },
    { label: 'MITRE ATT&CK', value: '823', sub: 'TTPs indexés', icon: <Crosshair size={16}/>, path: '/mitre' },
    { label: 'LOLBins', value: '142', sub: 'Living off the land', icon: <Terminal size={16}/>, path: '/lolbins' },
    { label: 'OSINT Runner', value: 'Ready', sub: 'External Intel', icon: <Search size={16}/>, path: '/osint' },
    { label: 'CLOAK OpSec', value: 'Active', sub: 'Evasion & stealth', icon: <EyeOff size={16}/>, path: '/cloak' },
    { label: 'Corrélations', value: 'Auto', sub: 'Cross-module sync', icon: <GitBranch size={16}/>, path: '/correlation' },
  ]

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8">
      
      {/* HEADER AVEC GROS TITRE IMPACTANT */}
      <div className="flex justify-between items-end border-b border-[#1e2d40] pb-6">
        <div>
          <h2 className="text-3xl text-[#f1f5f9] font-black tracking-tighter m-0 flex items-center gap-3">
            <span className="w-2 h-7 bg-[#00d4ff] shadow-[0_0_12px_#00d4ff]" />
            TERMINAL_OVERVIEW
          </h2>
          <div className="text-xs text-[#00d4ff]/70 font-mono mt-2 animate-pulse">
            {'>'} SYSTEM READY // ENCRYPTED SESSION ACTIVE
          </div>
        </div>
      </div>

      {/* TOP KPIs (Seulement 4, ça respire) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {mainKpis.map(item => (
          <StatCard key={item.label} item={item} onClick={() => navigate(item.path)} />
        ))}
      </div>

      {/* MAIN CONTENT SPLIT */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* COLONNE GAUCHE (Plus large) : Activité récente et Journaux */}
        <div className="xl:col-span-2 space-y-8">
          
          {/* RECENT ACTIVITY */}
          <div>
            <h3 className="text-[11px] font-mono text-[#64748b] uppercase tracking-[0.2em] flex items-center gap-2 mb-4">
              <div className="w-1 h-1 bg-[#00d4ff] rounded-full shadow-[0_0_5px_#00d4ff]" />
              Dernières Opérations
            </h3>
            <div className="bg-[#0a0e17] border border-[#1e2d40] rounded-md divide-y divide-[#1e2d40]">
              {recentTools.slice(0, 6).map(t => (
                <div key={t.id} className="p-4 flex items-center justify-between hover:bg-[#1e2d40]/20 transition-colors group cursor-pointer" onClick={() => navigate(`/tools/${t.id}`)}>
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-[#06080f] border border-[#1e2d40] rounded group-hover:border-[#00d4ff]/30">
                      <Terminal className="text-[#64748b] group-hover:text-[#00d4ff]" size={16} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#f1f5f9] group-hover:text-[#00d4ff] transition-colors">{t.name}</div>
                      <div className="text-[10px] font-mono text-[#64748b]">{t.category}</div>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-[#1e2d40] group-hover:text-[#00d4ff]" />
                </div>
              ))}
              {recentTools.length === 0 && (
                <div className="p-8 text-center text-xs text-[#64748b] font-mono">
                  Aucun payload indexé récemment.
                </div>
              )}
            </div>
          </div>

          {/* SYNC STATUS WIDGET */}
          <div className="bg-[#0a0e17] border border-[#1e2d40] rounded-md p-5 flex items-center gap-6">
            <div className="p-3 bg-[#06080f] border border-[#1e2d40] rounded-full">
              <Shield size={24} className="text-[#00d4ff]" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-xs font-mono text-[#f1f5f9] uppercase">Database Sync Status</span>
                <span className="text-[10px] font-mono text-[#00d4ff]">NOMINAL (100%)</span>
              </div>
              <div className="h-1.5 w-full bg-[#1e2d40] rounded-full overflow-hidden">
                <div className="h-full bg-[#00d4ff] shadow-[0_0_8px_#00d4ff]" style={{ width: '100%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* COLONNE DROITE : Alertes & Modules Tactiques */}
        <div className="space-y-8">
          
          {/* THREAT MONITOR */}
          <div>
            <h3 className="text-[11px] font-mono text-[#64748b] uppercase tracking-[0.2em] flex items-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-ping" />
              Threat Monitor
            </h3>
            <div className="bg-[#0a0e17] border border-[#ef4444]/30 rounded-md p-4 relative overflow-hidden group cursor-pointer hover:border-[#ef4444]/60 transition-colors" onClick={() => navigate('/bgp/historian')}>
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                <AlertTriangle size={60} className="text-[#ef4444]" />
              </div>
              <div className="space-y-2 relative z-10">
                {bgpAlerts.length > 0 ? bgpAlerts.slice(0,3).map(a => (
                  <div key={a.id} className="text-[11px] font-mono bg-[#ef4444]/5 border border-[#ef4444]/10 p-2.5 rounded text-[#ef4444] flex items-center gap-2">
                    <Network size={12} />
                    <span>ASN {a.asn} - {a.alert_type}</span>
                  </div>
                )) : (
                  <div className="text-[11px] font-mono text-[#ef4444] bg-[#ef4444]/5 p-3 rounded border border-[#ef4444]/10">
                    Awaiting routing anomalies...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* TACTICAL MODULES */}
          <div>
            <h3 className="text-[11px] font-mono text-[#64748b] uppercase tracking-[0.2em] flex items-center gap-2 mb-4">
              <div className="w-1 h-1 bg-[#10b981] rounded-full shadow-[0_0_5px_#10b981]" />
              Modules Tactiques
            </h3>
            <div className="flex flex-col gap-2">
              {tacticalModules.map(item => (
                <CompactModule key={item.label} item={item} onClick={() => navigate(item.path)} />
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}