import { useState, useEffect, useCallback } from 'react'
import { Terminal, Copy, Search, ChevronRight, X, Check } from 'lucide-react'
import { cheatsheetsApi } from '@/api/client'
import type { CheatsheetSummary, Cheatsheet, CheatsheetCommand } from '@/types/cheatsheet'
import { toast } from '@/store/toast'

const CATEGORIES = ['Tous', 'Reconnaissance', 'Exploitation', 'Post-Exploitation', 'Pentest', 'OSINT', 'Web', 'Réseau', 'Linux', 'Windows', 'DevOps', 'Hash / Encodage', 'Cracking', 'Forensic']

interface CommandCardProps {
  cmd: CheatsheetCommand
}

function CommandCard({ cmd }: CommandCardProps) {
  const [vars, setVars] = useState<Record<string, string>>(() =>
    Object.fromEntries(cmd.vars.map(v => [v, '']))
  )
  const [copied, setCopied] = useState(false)

  const rendered = cmd.vars.reduce((acc, v) => {
    const val = vars[v] || `{${v}}`
    return acc.split(`{${v}}`).join(val)
  }, cmd.cmd)

  const handleCopy = () => {
    navigator.clipboard.writeText(rendered).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('Commande copiée !')
    })
  }

  return (
    <div className="border border-[#1e2d40] rounded p-3 space-y-2 hover:border-cyan-500/30 transition-colors bg-[#0a0f16]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-mono font-bold text-[#8a9ab0]">{cmd.title}</p>
        <button
          onClick={handleCopy}
          className="shrink-0 text-[#64748b] hover:text-cyan-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]"
          title="Copier"
          aria-label="Copier"
        >
          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
        </button>
      </div>

      {cmd.vars.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {cmd.vars.map(v => (
            <div key={v} className="flex items-center gap-1">
              <span className="text-[10px] font-mono text-[#4a6480]">{v}=</span>
              <input
                type="text"
                value={vars[v]}
                onChange={e => setVars(prev => ({ ...prev, [v]: e.target.value }))}
                placeholder={v}
                className="bg-[#0d131f] border border-[#1e2d40] rounded px-1.5 py-0.5 text-[10px] font-mono text-cyan-400 focus:outline-none focus:border-cyan-500/60 w-28"
              />
            </div>
          ))}
        </div>
      )}

      <pre className="bg-[#0d131f] border border-[#1e2d40] rounded px-3 py-2 text-xs font-mono text-green-300 whitespace-pre-wrap break-all">
        {rendered}
      </pre>
    </div>
  )
}

interface DrawerProps {
  cheatsheet: Cheatsheet
  onClose: () => void
}

function CheatsheetDrawer({ cheatsheet, onClose }: DrawerProps) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="w-full max-w-xl bg-[#0a0f16] border-l border-[#1e2d40] flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2d40]">
          <div>
            <h2 className="text-lg font-mono font-bold text-[#f1f5f9]">{cheatsheet.tool}</h2>
            <p className="text-[11px] font-mono text-[#64748b]">{cheatsheet.description}</p>
          </div>
          <button onClick={onClose} className="text-[#64748b] hover:text-red-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {cheatsheet.commands.map((cmd, i) => (
            <CommandCard key={i} cmd={cmd} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function CheatsheetsPage() {
  const [summaries, setSummaries] = useState<CheatsheetSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [category, setCategory] = useState('Tous')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Cheatsheet | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await cheatsheetsApi.list()
      setSummaries(res.cheatsheets)
    } catch {
      toast.error('Impossible de charger les cheatsheets')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openDetail = async (tool: string) => {
    setLoadingDetail(true)
    try {
      const cs = await cheatsheetsApi.getByTool(tool)
      setSelected(cs)
    } catch {
      toast.error('Cheatsheet introuvable')
    } finally {
      setLoadingDetail(false)
    }
  }

  const filtered = summaries.filter(s => {
    const matchCat = category === 'Tous' || s.category === category
    const matchSearch = !search ||
      s.tool.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div className="flex flex-col h-full bg-[#06080f] text-[#f1f5f9]">
      {/* Bandeau d'en-tête style BGPLookup */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d40] bg-[#0a0f16]/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Terminal className="text-cyan-400" size={20} />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#10b981] rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase">CHEATSHEETS // COMMAND</h1>
            <p className="text-[10px] text-[#64748b] font-mono">
              Commandes interactives pour outils de cybersécurité — {summaries.length} références
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px]">
          <span className="text-[#64748b]">SOURCE</span>
          <span className="text-[#10b981]">STATIC</span>
        </div>
      </div>

      {/* Zone de contenu scrollable */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Filtres */}
        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a6480]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un outil…"
              className="w-full bg-[#0d131f] border border-[#1e2d40] pl-9 pr-3 py-2 font-mono text-sm text-[#f1f5f9] placeholder-[#2a3f55] focus:outline-none focus:border-cyan-500/40"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1.5 border transition-colors ${
                  category === cat
                    ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400'
                    : 'border-[#1e2d40] bg-[#06080f] text-[#64748b] hover:border-cyan-500/40 hover:text-cyan-400'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Grille */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-28 border border-[#1e2d40] bg-[#0a0f16] animate-pulse" />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center border border-[#1e2d40] bg-[#0a0f16] py-24 text-center">
            <Terminal size={40} className="mb-4 text-[#1e2d40]" />
            <p className="font-mono text-sm uppercase tracking-widest text-[#64748b]">AUCUNE CHEATSHEET TROUVÉE</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(cs => (
            <button
              key={cs.tool}
              onClick={() => openDetail(cs.tool)}
              disabled={loadingDetail}
              className="group block border border-[#1e2d40] bg-[#0a0f16] p-4 text-left hover:border-cyan-500/40 transition-all hover:bg-cyan-500/5"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="font-mono text-sm font-bold text-[#f1f5f9] group-hover:text-cyan-400 transition-colors">
                  {cs.tool}
                </span>
                <ChevronRight size={14} className="text-[#64748b] group-hover:text-cyan-400 transition-colors shrink-0 mt-0.5" />
              </div>
              <p className="text-xs font-mono text-[#8a9ab0] mb-3 line-clamp-2">{cs.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono border border-[#1e2d40] bg-[#0d131f] px-2 py-0.5 text-[#64748b]">{cs.category}</span>
                <span className="text-[11px] font-mono text-cyan-400">{cs.nb_commands} cmds</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Drawer de détail */}
      {selected && <CheatsheetDrawer cheatsheet={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}