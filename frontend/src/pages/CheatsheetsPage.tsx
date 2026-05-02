import { useState, useEffect, useCallback } from 'react'
import { Terminal, Copy, Search, ChevronRight, X, Check } from 'lucide-react'
import { cheatsheetsApi } from '@/api/client'
import type { CheatsheetSummary, Cheatsheet, CheatsheetCommand } from '@/types/cheatsheet'
import { toast } from '@/store/toast'

const CATEGORIES = ['Tous', 'Reconnaissance', 'Exploitation', 'Post-Exploitation', 'OSINT', 'Réseau', 'Cracking', 'Forensic']

interface CommandCardProps {
  cmd: CheatsheetCommand
}

function CommandCard({ cmd }: CommandCardProps) {
  const [vars, setVars] = useState<Record<string, string>>(() =>
    Object.fromEntries(cmd.vars.map((v) => [v, '']))
  )
  const [copied, setCopied] = useState(false)

  // Substituer les variables dans la commande
  const rendered = cmd.vars.reduce((acc, v) => {
    const val = vars[v] || `{${v}}`
    // replace all occurrences manually (avoid replaceAll ES2021+)
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
    <div className="border border-border rounded p-3 space-y-2 hover:border-cyber-cyan/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-text-secondary">{cmd.title}</p>
        <button
          onClick={handleCopy}
          className="shrink-0 text-text-muted hover:text-cyber-cyan transition-colors"
          title="Copier"
        >
          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
        </button>
      </div>

      {/* Variables interactives */}
      {cmd.vars.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {cmd.vars.map((v) => (
            <div key={v} className="flex items-center gap-1">
              <span className="text-xs text-text-muted font-mono">{v}=</span>
              <input
                type="text"
                value={vars[v]}
                onChange={(e) => setVars((prev) => ({ ...prev, [v]: e.target.value }))}
                placeholder={v}
                className="bg-bg-secondary border border-border rounded px-1.5 py-0.5 text-xs font-mono text-cyber-cyan focus:outline-none focus:border-cyber-cyan w-28"
              />
            </div>
          ))}
        </div>
      )}

      {/* Commande rendue */}
      <pre className="bg-bg-primary border border-border rounded px-3 py-2 text-xs font-mono text-green-300 whitespace-pre-wrap break-all">
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
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-full max-w-xl bg-bg-secondary border-l border-border flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-text-primary font-mono">{cheatsheet.tool}</h2>
            <p className="text-xs text-text-muted">{cheatsheet.description}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-cyber-red transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Commandes scrollables */}
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
  const [summaries, setSummaries]   = useState<CheatsheetSummary[]>([])
  const [loading, setLoading]       = useState(false)
  const [category, setCategory]     = useState('Tous')
  const [search, setSearch]         = useState('')
  const [selected, setSelected]     = useState<Cheatsheet | null>(null)
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

  const filtered = summaries.filter((s) => {
    const matchCat = category === 'Tous' || s.category === category
    const matchSearch = !search || s.tool.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <Terminal size={24} className="text-cyber-cyan" />
          Cheatsheets
        </h1>
        <p className="text-text-muted text-sm mt-1">
          Commandes de référence pour {summaries.length} outils de cybersécurité, avec variables interactives.
        </p>
      </div>

      {/* Filtres */}
      <div className="card mb-5 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un outil…"
            className="input w-full pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                category === cat
                  ? 'bg-cyber-cyan/20 border-cyber-cyan text-cyber-cyan'
                  : 'border-border text-text-muted hover:border-cyber-cyan/40'
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
            <div key={i} className="h-28 rounded border border-border bg-bg-hover animate-pulse" />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 text-text-muted">
          <Terminal size={40} className="mx-auto mb-3 opacity-30" />
          <p>Aucune cheatsheet trouvée</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((cs) => (
          <button
            key={cs.tool}
            onClick={() => openDetail(cs.tool)}
            disabled={loadingDetail}
            className="card text-left hover:border-cyber-cyan/60 transition-all hover:bg-cyber-cyan/5 group"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="font-mono text-sm font-bold text-text-primary group-hover:text-cyber-cyan transition-colors">
                {cs.tool}
              </span>
              <ChevronRight size={14} className="text-text-muted group-hover:text-cyber-cyan transition-colors shrink-0 mt-0.5" />
            </div>
            <p className="text-xs text-text-muted mb-3 line-clamp-2">{cs.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs px-2 py-0.5 rounded border border-border text-text-muted">{cs.category}</span>
              <span className="text-xs text-cyber-cyan font-mono">{cs.nb_commands} cmds</span>
            </div>
          </button>
        ))}
      </div>

      {/* Drawer de détail */}
      {selected && <CheatsheetDrawer cheatsheet={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
