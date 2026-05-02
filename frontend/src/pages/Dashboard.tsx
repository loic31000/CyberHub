import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { statsApi, toolsApi } from '@/api/client'
import type { Stats, Tool } from '@/types'
import { Database, Trophy, ShieldAlert, BookOpen, ChevronRight, Activity, Crosshair } from 'lucide-react'
import ToolCard from '@/components/ToolCard'

// Composant interne pour l'effet "Spotlight/Glow" façon React Bits
const BentoCard = ({ item, onClick, soonLabel }: { item: any, onClick: () => void, soonLabel: string }) => {
  const isActive = item.status === 'active'

  return (
    <div
      onClick={isActive ? onClick : undefined}
      className={`relative group overflow-hidden rounded-xl border border-gray-800 bg-[#0a0f16] ${
        isActive ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'
      } transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`}
    >
      {/* Effet de glow au survol (CSS pur via Tailwind) */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${item.glowColor} opacity-0 group-hover:opacity-10 transition-opacity duration-500`}
      />

      {/* Ligne lumineuse en haut de la carte */}
      <div className={`absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r ${item.lineColor} opacity-50 group-hover:opacity-100 transition-opacity`} />

      <div className="relative z-10 p-5 flex flex-col h-full justify-between">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-2 rounded-lg bg-gray-900/50 border border-gray-800 ${item.textColor} group-hover:scale-110 transition-transform`}>
            {item.icon}
          </div>
          {isActive ? (
            <ChevronRight size={18} className="text-gray-600 group-hover:text-white transition-colors" />
          ) : (
            <span className="text-[10px] uppercase tracking-wider text-text-muted bg-gray-800/50 px-2 py-1 rounded">{soonLabel}</span>
          )}
        </div>

        <div>
          {item.value && (
            <div className={`text-3xl font-bold tracking-tight mb-1 ${item.textColor} drop-shadow-sm`}>
              {item.value}
            </div>
          )}
          <h3 className="text-text-primary font-medium text-sm">
            {item.label}
          </h3>
          <p className="text-text-muted text-xs mt-1 h-4">
            {item.sub}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
    const [stats, setStats] = useState<Stats | null>(null)
  const [recentTools, setRecentTools] = useState<Tool[]>([])

  useEffect(() => {
    statsApi.get().then(setStats).catch(() => {})
    toolsApi.list().then(r => setRecentTools(r.tools)).catch(() => {})
  }, [])

  // Fusion des stats et des modules pour un rendu "Bento Grid" ultra moderne
  const bentoItems = [
    {
      label: `Outils & Procédures`,
      value: stats?.tools_total ?? '—',
      sub: `${stats?.offensive ?? 0} offensifs · ${stats?.defensive ?? 0} défensifs`,
      icon: <Database size={22} />,
      textColor: 'text-cyber-cyan',
      glowColor: 'from-cyber-cyan via-transparent to-transparent',
      lineColor: 'from-cyber-cyan/80 to-transparent',
      path: '/tools',
      status: 'active',
      span: 'col-span-1 md:col-span-2 lg:col-span-1' // Plus large sur tablette
    },
    {
      label: `Writeups CTF`,
      value: stats?.ctf_total ?? '—',
      sub: `${stats?.ctf_completed ?? 0} ${`complétés à ce jour`}`,
      icon: <Trophy size={22} />,
      textColor: 'text-yellow-400',
      glowColor: 'from-yellow-400 via-transparent to-transparent',
      lineColor: 'from-yellow-400/80 to-transparent',
      path: '/ctf',
      status: 'active',
      span: 'col-span-1'
    },
    {
      label: `CVE Suivies`,
      value: stats?.cve_total ?? '—',
      sub: `${stats?.cve_critical ?? 0} ${`vulnérabilités critiques`}`,
      icon: <ShieldAlert size={22} />,
      textColor: 'text-cyber-red',
      glowColor: 'from-cyber-red via-transparent to-transparent',
      lineColor: 'from-cyber-red/80 to-transparent',
      path: '/cve',
      status: 'active',
      span: 'col-span-1'
    },
    {
      label: `Playbooks IR`,
      value: stats?.playbooks_total ?? '—',
      sub: `Procédures de réponse à incident`,
      icon: <BookOpen size={22} />,
      textColor: 'text-cyber-green',
      glowColor: 'from-cyber-green via-transparent to-transparent',
      lineColor: 'from-cyber-green/80 to-transparent',
      path: '/playbooks',
      status: 'active',
      span: 'col-span-1'
    },
    {
      label: `MITRE ATT&CK`,
      value: null,
      sub: `Cartographie des tactiques`,
      icon: <Crosshair size={22} />,
      textColor: 'text-purple-400',
      glowColor: 'from-purple-400 via-transparent to-transparent',
      lineColor: 'from-purple-400/80 to-transparent',
      path: '/mitre',
      status: 'active',
      span: 'col-span-1'
    },
    {
      label: `IOC Manager`,
      value: null,
      sub: `Gestion des indicateurs de compromission`,
      icon: <Activity size={22} />,
      textColor: 'text-blue-400',
      glowColor: 'from-blue-400 via-transparent to-transparent',
      lineColor: 'from-blue-400/80 to-transparent',
      path: '/ioc',
      status: 'active',
      span: 'col-span-1 md:col-span-2 lg:col-span-1'
    },
  ]

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      {/* Header modernisé avec subtil effet text-glow */}
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">
            <span className="text-cyber-cyan drop-shadow-[0_0_8px_rgba(0,255,255,0.4)] mr-2">&gt;</span>
            Dashboard
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-2 h-2 rounded-full bg-cyber-green animate-pulse shadow-[0_0_8px_rgba(0,255,0,0.6)]" />
            <p className="text-text-muted text-sm font-mono">
              {`Système Actif · Données 100% locales`}
            </p>
          </div>
        </div>
      </div>

      {/* Grille Bento (Stats + Navigation fusionnées) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-14">
        {bentoItems.map((item) => (
          <div key={item.label} className={item.span}>
            <BentoCard
              item={item}
              onClick={() => item.path && navigate(item.path)}
              soonLabel={`Bientôt`}
            />
          </div>
        ))}
      </div>

      {/* Outils récents - Rendu plus propre avec séparateur */}
      <div>
        <div className="flex items-end justify-between mb-6 pb-4 border-b border-gray-800/50">
          <div>
            <h2 className="text-xl text-text-primary font-semibold tracking-wide">
              <span className="text-cyber-cyan opacity-80 mr-2">//</span>
              {`Outils récemment consultés`}
            </h2>
          </div>
          <button
            onClick={() => navigate('/tools')}
            className="text-cyber-cyan/80 text-sm hover:text-cyber-cyan hover:underline flex items-center gap-1 transition-colors"
          >
            {`Explorer la base`} <ChevronRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {recentTools.slice(0, 6).map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </div>
    </div>
  )
}