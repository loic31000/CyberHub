import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { statsApi, toolsApi, bgpApi, iocApi } from '@/api/client'
import type { Stats, Tool } from '@/types'
import {
  Database, Trophy, ShieldAlert, BookOpen, Activity, Shield,
  AlertTriangle, GitBranch, ChevronRight,
  Terminal, Crosshair, Search, EyeOff, Network,
  ClipboardList, History, StickyNote, BookMarked, Code2, Zap,
} from 'lucide-react'

// ─── Grande carte KPI ────────────────────────────────────────────────────────
const StatCard = ({ item, onClick }: { item: any; onClick: () => void }) => (
  <div
    onClick={onClick}
    className="group relative bg-[#0a0e17] border border-[#1e2d40] rounded-md p-5 cursor-pointer overflow-hidden transition-all duration-300 hover:border-[#00d4ff]/50 hover:shadow-[0_0_20px_rgba(0,212,255,0.1)]"
  >
    <div className="absolute -inset-px bg-gradient-to-br from-[#00d4ff]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-md" />
    <div className="relative z-10 flex flex-col h-full justify-between">
      <div className="flex justify-between items-start mb-6">
        <span className="text-[#64748b] text-[11px] font-mono uppercase tracking-widest">{item.label}</span>
        <div className="text-[#00d4ff] drop-shadow-[0_0_8px_rgba(0,212,255,0.8)]">
          {item.icon}
        </div>
      </div>
      <div>
        <div className="text-4xl font-mono font-light text-[#f1f5f9] mb-1 group-hover:text-[#00d4ff] transition-colors">
          {item.value ?? '—'}
        </div>
        <div className="text-[11px] text-[#94a3b8] font-mono">{item.sub}</div>
      </div>
    </div>
  </div>
)

// ─── Module tactique compact ──────────────────────────────────────────────────
const CompactModule = ({ item, onClick }: { item: any; onClick: () => void }) => (
  <div
    onClick={onClick}
    className="flex items-center justify-between p-3 bg-[#0a0e17] border border-[#1e2d40] rounded-md hover:border-[#00d4ff]/50 hover:bg-[#00d4ff]/5 cursor-pointer transition-all group"
  >
    <div className="flex items-center gap-3">
      <div className="p-1.5 bg-[#06080f] border border-[#1e2d40] rounded group-hover:border-[#00d4ff]/30 text-[#64748b] group-hover:text-[#00d4ff] transition-colors shrink-0">
        {item.icon}
      </div>
      <div>
        <div className="text-xs font-semibold text-[#f1f5f9] group-hover:text-[#00d4ff] transition-colors">{item.label}</div>
        <div className="text-[10px] font-mono text-[#64748b]">{item.sub}</div>
      </div>
    </div>
    <div className="text-xs font-mono text-[#f1f5f9] group-hover:text-[#00d4ff] transition-colors bg-[#06080f] px-2 py-1 rounded border border-[#1e2d40] group-hover:border-[#00d4ff]/30 shrink-0">
      {item.value}
    </div>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats]             = useState<Stats | null>(null)
  const [recentTools, setRecentTools] = useState<Tool[]>([])
  const [bgpAlerts, setBgpAlerts]     = useState<any[]>([])
  const [iocCount, setIocCount]       = useState<number>(0)

  useEffect(() => {
    statsApi.get().then(setStats).catch(() => {})
    toolsApi.list().then(r => setRecentTools(r.tools)).catch(() => {})
    bgpApi.getAlerts(5, 0).then(r => setBgpAlerts(r.items ?? [])).catch(() => {})
    iocApi.list({ limit: 1 } as any).then(r => setIocCount(r.total ?? 0)).catch(() => {})
  }, [])

  const mainKpis = [
    { label: 'Tools',       value: stats?.tools_total,     sub: 'Fiches techniques', icon: <Database size={20}/>,    path: '/tools' },
    { label: 'Writeups',    value: stats?.ctf_total,       sub: 'CTF Database',      icon: <Trophy size={20}/>,      path: '/ctf' },
    { label: 'Veille Live', value: stats?.cve_total,       sub: 'CVE & KEV Live',    icon: <ShieldAlert size={20}/>, path: '/cve' },
    { label: 'Playbooks',   value: stats?.playbooks_total, sub: 'IR Procedures',     icon: <BookOpen size={20}/>,    path: '/playbooks' },
  ]

  const tacticalModules = [
    { label: 'IOC Manager',    value: iocCount > 0 ? `+${iocCount}` : '0', sub: 'IOCs indexés',          icon: <Activity size={14}/>,      path: '/ioc' },
    { label: 'MITRE ATT&CK',  value: '823',    sub: 'TTPs Enterprise',       icon: <Crosshair size={14}/>,    path: '/mitre' },
    { label: 'LOLBins',       value: '232',    sub: 'Windows + Linux',       icon: <Terminal size={14}/>,     path: '/lolbins' },
    { label: 'OSINT Runner',  value: 'Ready',  sub: 'External Intel',        icon: <Search size={14}/>,       path: '/osint' },
    { label: 'CLOAK OpSec',   value: '720',    sub: 'Evasion & stealth',     icon: <EyeOff size={14}/>,       path: '/cloak' },
    { label: 'Corrélations',  value: 'Auto',   sub: '9 moteurs actifs',      icon: <GitBranch size={14}/>,    path: '/correlation' },
    { label: 'Investigations',value: 'Active', sub: 'Timeline & events',     icon: <ClipboardList size={14}/>,path: '/investigations' },
    { label: 'BGP Historian', value: 'Live',   sub: 'Snapshots AS',          icon: <History size={14}/>,      path: '/bgp/historian' },
    { label: 'Notes Ops',     value: 'Local',  sub: 'Éditeur opérationnel',  icon: <StickyNote size={14}/>,   path: '/notes' },
    { label: 'Cheatsheets',   value: '35+',    sub: 'Commandes clés',        icon: <BookMarked size={14}/>,   path: '/cheatsheets' },
    { label: 'Encoder',       value: 'x5',     sub: 'B64 · URL · Hex · ROT', icon: <Code2 size={14}/>,        path: '/encoder' },
    { label: 'RevShell Gen',  value: '16',     sub: 'Langages payloads',     icon: <Zap size={14}/>,          path: '/revshell' },
  ]

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-end border-b border-[#1e2d40] pb-5">
        <div>
          <h2 className="text-2xl text-[#f1f5f9] font-bold tracking-tighter m-0 flex items-center gap-3">
            <span className="w-2 h-6 bg-[#00d4ff] shadow-[0_0_12px_#00d4ff] shrink-0" />
            TERMINAL_OVERVIEW
          </h2>
          <div className="text-xs text-[#00d4ff]/70 font-mono mt-2 animate-pulse pl-5">
            {'>'} SYSTEM READY // ENCRYPTED SESSION ACTIVE
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-3 font-mono text-[10px]">
          <div className="flex items-center gap-1.5 bg-[#0a0e17] border border-[#1e2d40] px-2.5 py-1 rounded">
            <div className="w-1.5 h-1.5 rounded-full bg-[#10b981] shadow-[0_0_4px_#10b981]" />
            <span className="text-[#64748b]">ALL SYSTEMS</span>
            <span className="text-[#10b981] font-bold">NOMINAL</span>
          </div>
          <div className="bg-[#0a0e17] border border-[#1e2d40] px-2.5 py-1 rounded text-[#64748b]">
            {tacticalModules.length} MODULES ACTIFS
          </div>
        </div>
      </div>

      {/* ── 4 KPI CARDS ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {mainKpis.map(item => (
          <StatCard key={item.label} item={item} onClick={() => navigate(item.path)} />
        ))}
      </div>

      {/* ── MAIN LAYOUT ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── GAUCHE : Dernières Opérations + Sync Status ─────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          <div>
            <h3 className="text-[11px] font-mono text-[#64748b] uppercase tracking-[0.2em] flex items-center gap-2 mb-4">
              <div className="w-1 h-1 bg-[#00d4ff] rounded-full shadow-[0_0_5px_#00d4ff]" />
              Dernières Opérations
            </h3>
            <div className="bg-[#0a0e17] border border-[#1e2d40] rounded-md divide-y divide-[#1e2d40]">
              {recentTools.slice(0, 6).map(t => (
                <div
                  key={t.id}
                  onClick={() => navigate(`/tools/${t.id}`)}
                  className="p-4 flex items-center justify-between hover:bg-[#1e2d40]/20 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-[#06080f] border border-[#1e2d40] rounded group-hover:border-[#00d4ff]/30">
                      <Terminal className="text-[#64748b] group-hover:text-[#00d4ff] transition-colors" size={16} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#f1f5f9] group-hover:text-[#00d4ff] transition-colors">{t.name}</div>
                      <div className="text-[10px] font-mono text-[#64748b]">{t.category}</div>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-[#1e2d40] group-hover:text-[#00d4ff] transition-colors" />
                </div>
              ))}
              {recentTools.length === 0 && (
                <div className="p-8 text-center text-xs text-[#64748b] font-mono">
                  Aucun payload indexé récemment.
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#0a0e17] border border-[#1e2d40] rounded-md p-5 flex items-center gap-6">
            <div className="p-3 bg-[#06080f] border border-[#1e2d40] rounded-full shrink-0">
              <Shield size={24} className="text-[#00d4ff]" />
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              <div className="flex justify-between items-end gap-2">
                <span className="text-xs font-mono text-[#f1f5f9] uppercase truncate">Database Sync Status</span>
                <span className="text-[10px] font-mono text-[#00d4ff] shrink-0">NOMINAL (100%)</span>
              </div>
              <div className="h-1.5 w-full bg-[#1e2d40] rounded-full overflow-hidden">
                <div className="h-full bg-[#00d4ff] shadow-[0_0_8px_#00d4ff] rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── DROITE : Threat Monitor + Modules Tactiques ─────────────────── */}
        <div className="space-y-6">

          <div>
            <h3 className="text-[11px] font-mono text-[#64748b] uppercase tracking-[0.2em] flex items-center gap-2 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-ping" />
              Threat Monitor
            </h3>
            <div
              onClick={() => navigate('/bgp/historian')}
              className="bg-[#0a0e17] border border-[#ef4444]/30 rounded-md relative overflow-hidden group cursor-pointer hover:border-[#ef4444]/60 transition-colors flex items-center justify-center py-4 px-4 min-h-[60px]"
            >
              <div className="absolute top-0 right-0 p-1.5 opacity-[0.10] group-hover:opacity-[0.20] transition-opacity pointer-events-none">
                <AlertTriangle size={48} className="text-[#ef4444]" />
              </div>
              <div className="relative z-10 w-full">
                {bgpAlerts.length > 0 ? (
                  <div className="space-y-1.5">
                    {bgpAlerts.slice(0, 3).map(a => (
                      <div key={a.id} className="text-[11px] font-mono bg-[#ef4444]/5 border border-[#ef4444]/10 px-3 py-2 rounded text-[#ef4444] flex items-center gap-2">
                        <Network size={12} className="shrink-0" />
                        <span className="truncate">ASN {a.asn} — {a.alert_type}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] font-mono text-[#ef4444] bg-[#ef4444]/5 px-3 py-2 rounded border border-[#ef4444]/10 text-center">
                    Awaiting routing anomalies...
                  </div>
                )}
              </div>
            </div>
          </div>

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
