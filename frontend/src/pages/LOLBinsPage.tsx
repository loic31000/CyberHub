import { useState, useEffect, useCallback } from 'react'
import { Terminal, Search, X, Copy, Check, ChevronRight } from 'lucide-react'
import { lolbinsApi } from '@/api/client'
import type { LOLBin, LOLBinCommand, LOLBinsResponse, LOLBinCategory } from '@/types/lolbins'

// Helper générique — utilisé pour commands, mitre_tech, tags
function parseJSON<T>(str: string, fallback: T): T {
  try { return JSON.parse(str) as T } catch { return fallback }
}

function parseMitreTech(raw: string): string[] {
  return parseJSON<string[]>(raw, [])
}

function parseCommands(raw: string): LOLBinCommand[] {
  return parseJSON<LOLBinCommand[]>(raw, [])
}

function getCommandText(cmd: LOLBinCommand): string {
  return cmd.Command ?? cmd.commands ?? ''
}

function getCommandDesc(cmd: LOLBinCommand): string {
  return cmd.Description ?? cmd.description ?? ''
}

// Couleur badge par type de commande
function cmdTypeBadgeCls(type: string): string {
  const t = type.toLowerCase()
  if (t === 'execute' || t === 'shell')       return 'bg-red-900/40 text-red-300 border border-red-700/40'
  if (t === 'download' || t === 'file-write') return 'bg-blue-900/40 text-blue-300 border border-blue-700/40'
  if (t === 'awl bypass')                     return 'bg-orange-900/40 text-orange-300 border border-orange-700/40'
  if (t === 'ads')                             return 'bg-yellow-900/40 text-yellow-300 border border-yellow-700/40'
  if (t === 'dump')                            return 'bg-purple-900/40 text-purple-300 border border-purple-700/40'
  if (t === 'sudo')                            return 'bg-orange-900/40 text-orange-300 border border-orange-700/40'
  if (t === 'file-read')                       return 'bg-blue-900/40 text-blue-300 border border-blue-700/40'
  return 'bg-gray-700 text-gray-300 border border-gray-600'
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-cyber-cyan transition-colors"
      title="Copier"
    >
      {copied ? <Check size={13} className="text-cyber-cyan" /> : <Copy size={13} />}
    </button>
  )
}

interface DrawerProps {
  item: LOLBin
  onClose: () => void
}

function LOLBinDrawer({ item, onClose }: DrawerProps) {
  const mitreTechs = parseMitreTech(item.mitre_tech)
  const commands = parseCommands(item.commands)

  return (
    <div className="w-[480px] shrink-0 bg-bg-secondary border border-cyber-cyan/30 rounded-lg overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Terminal size={16} className={item.os === 'windows' ? 'text-blue-400' : 'text-orange-400'} />
          <span className="font-bold text-text-primary font-mono">{item.name}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            item.os === 'windows'
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
          }`}>
            {item.os === 'windows' ? 'Windows' : 'Linux'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-bg-primary text-text-muted hover:text-text-primary transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Chemin */}
        {item.full_path && (
          <div>
            <p className="text-xs text-text-muted mb-1">Chemin complet</p>
            <code className="text-xs font-mono text-cyber-cyan bg-bg-primary px-3 py-1.5 rounded border border-border block">
              {item.full_path}
            </code>
          </div>
        )}

        {/* Description */}
        <div>
          <p className="text-xs text-text-muted mb-1">Description</p>
          <p className="text-sm text-text-primary">{item.description}</p>
        </div>

        {/* Techniques MITRE */}
        {mitreTechs.length > 0 && (
          <div>
            <p className="text-xs text-text-muted mb-2">Techniques MITRE ATT&amp;CK</p>
            <div className="flex flex-wrap gap-1.5">
              {mitreTechs.map((t) => (
                <span
                  key={t}
                  className="text-xs px-2 py-1 rounded border border-purple-500/40 bg-purple-500/10 text-purple-300 font-mono"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Commandes */}
        <div>
          <p className="text-xs text-text-muted mb-2">Commandes d&apos;abus</p>
          <div className="space-y-3">
            {commands.map((cmd, i) => {
              const cmdText = getCommandText(cmd)
              const cmdDesc = getCommandDesc(cmd)
              const cmdType = cmd.type ?? cmd.Usecase ?? cmd.Category ?? ''
              const cmdPriv = cmd.Privileges ?? ''
              if (!cmdText) return null
              return (
                <div key={i} className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
                  {(cmdDesc || cmdType || cmdPriv) && (
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700">
                      {cmdType && (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${cmdTypeBadgeCls(cmdType)}`}>
                          {cmdType}
                        </span>
                      )}
                      {cmdPriv && (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          cmdPriv === 'Administrator' || cmdPriv === 'root'
                            ? 'bg-red-900/40 text-red-300 border border-red-700/40'
                            : 'bg-yellow-900/30 text-yellow-300 border border-yellow-700/30'
                        }`}>
                          {cmdPriv}
                        </span>
                      )}
                      {cmdDesc && (
                        <span className="text-xs text-gray-400 flex-1 truncate">{cmdDesc}</span>
                      )}
                    </div>
                  )}
                  <div className="flex items-start gap-2 p-3">
                    <code className="flex-1 text-green-400 font-mono text-xs whitespace-pre-wrap break-all leading-relaxed">
                      {cmdText}
                    </code>
                    <CopyButton text={cmdText} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

interface LOLBinCardProps {
  item: LOLBin
  selected: boolean
  onClick: () => void
}

function LOLBinCard({ item, selected, onClick }: LOLBinCardProps) {
  const mitreTechs = parseMitreTech(item.mitre_tech)
  const commands = parseCommands(item.commands)

  return (
    <button
      onClick={onClick}
      className={`text-left w-full p-4 rounded-lg border transition-colors ${
        selected
          ? 'border-cyber-cyan/60 bg-cyber-cyan/5'
          : 'border-border bg-bg-secondary hover:border-border/80 hover:bg-bg-secondary/80'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold font-mono text-sm text-text-primary truncate">{item.name}</span>
          <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full ${
            item.os === 'windows'
              ? 'bg-blue-500/20 text-blue-300'
              : 'bg-orange-500/20 text-orange-300'
          }`}>
            {item.os === 'windows' ? 'Win' : 'Lin'}
          </span>
        </div>
        <ChevronRight size={14} className="text-text-muted shrink-0 mt-0.5" />
      </div>
      {item.category && (
        <span className="text-xs px-2 py-0.5 rounded bg-bg-primary border border-border text-text-muted mb-2 inline-block">
          {item.category}
        </span>
      )}
      <p className="text-xs text-text-muted line-clamp-2 mt-1">{item.description}</p>
      <div className="flex items-center gap-3 mt-2">
        {commands.length > 0 && (
          <span className="text-xs text-cyber-cyan">{commands.length} cmd{commands.length > 1 ? 's' : ''}</span>
        )}
        {mitreTechs.length > 0 && (
          <span className="text-xs text-purple-400">{mitreTechs[0]}{mitreTechs.length > 1 ? ` +${mitreTechs.length - 1}` : ''}</span>
        )}
      </div>
    </button>
  )
}

export default function LOLBinsPage() {
  const [data, setData] = useState<LOLBinsResponse | null>(null)
  const [categories, setCategories] = useState<LOLBinCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<LOLBin | null>(null)

  const [activeOS, setActiveOS] = useState<'windows' | 'linux'>('windows')
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('')
  const [mitreFilter, setMitreFilter] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await lolbinsApi.list({
        os: activeOS,
        search: search || undefined,
        category: activeCategory || undefined,
        mitre: mitreFilter || undefined,
      })
      setData(result)
    } catch {
      // silencieux
    } finally {
      setLoading(false)
    }
  }, [activeOS, search, activeCategory, mitreFilter])

  useEffect(() => {
    lolbinsApi.getCategories().then(setCategories).catch(() => {})
  }, [])

  useEffect(() => {
    const t = setTimeout(fetchData, 300)
    return () => clearTimeout(t)
  }, [fetchData])

  const filteredCategories = categories.filter((c) => c.os === activeOS)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Terminal size={24} className="text-cyber-cyan" />
            LOLBins &amp; GTFOBins
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Living-Off-the-Land binaries — techniques d&apos;abus sur binaires légitimes
          </p>
        </div>
        <div className="flex gap-4 text-sm text-text-muted">
          <span><span className="text-blue-300 font-bold">{data?.win_count ?? 0}</span> Windows</span>
          <span><span className="text-orange-300 font-bold">{data?.linux_count ?? 0}</span> Linux</span>
        </div>
      </div>

      {/* Onglets OS */}
      <div className="flex gap-1 border-b border-border">
        {(['windows', 'linux'] as const).map((os) => (
          <button
            key={os}
            onClick={() => { setActiveOS(os); setActiveCategory(''); setSelectedItem(null) }}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeOS === os
                ? os === 'windows'
                  ? 'border-blue-400 text-blue-300'
                  : 'border-orange-400 text-orange-300'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            {os === 'windows' ? 'Windows (LOLBAS)' : 'Linux (GTFOBins)'}
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un binaire..."
            className="w-full bg-bg-secondary border border-border rounded pl-9 pr-3 py-2 text-sm text-text-primary focus:outline-none focus:border-cyber-cyan"
          />
        </div>
        <input
          value={mitreFilter}
          onChange={(e) => setMitreFilter(e.target.value)}
          placeholder="Filtrer MITRE (ex: T1105)"
          className="w-48 bg-bg-secondary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-purple-400 font-mono"
        />
        {(search || activeCategory || mitreFilter) && (
          <button
            onClick={() => { setSearch(''); setActiveCategory(''); setMitreFilter('') }}
            className="flex items-center gap-1 px-3 py-2 text-sm text-text-muted border border-border rounded hover:text-cyber-red hover:border-cyber-red transition-colors"
          >
            <X size={13} /> Réinitialiser
          </button>
        )}
      </div>

      {/* Catégories */}
      {filteredCategories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory('')}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              activeCategory === ''
                ? 'border-cyber-cyan text-cyber-cyan bg-cyber-cyan/10'
                : 'border-border text-text-muted hover:border-text-muted'
            }`}
          >
            Tous
          </button>
          {filteredCategories.map((cat) => (
            <button
              key={cat.category}
              onClick={() => setActiveCategory(cat.category === activeCategory ? '' : cat.category)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                activeCategory === cat.category
                  ? 'border-cyber-cyan text-cyber-cyan bg-cyber-cyan/10'
                  : 'border-border text-text-muted hover:border-text-muted'
              }`}
            >
              {cat.category} <span className="opacity-60">({cat.count})</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-6">
        {/* Grille */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="text-center py-12 text-text-muted text-sm">Chargement…</div>
          ) : !data || data.items.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <Terminal size={40} className="mx-auto text-text-muted opacity-40" />
              <p className="text-text-muted">Aucun résultat</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.items.map((item) => (
                <LOLBinCard
                  key={item.id}
                  item={item}
                  selected={selectedItem?.id === item.id}
                  onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                />
              ))}
            </div>
          )}
          {data && data.total > 100 && (
            <p className="text-center text-text-muted text-xs mt-4">
              Affichage des 100 premiers sur {data.total} — affinez votre recherche
            </p>
          )}
        </div>

        {/* Drawer détail */}
        {selectedItem && (
          <LOLBinDrawer item={selectedItem} onClose={() => setSelectedItem(null)} />
        )}
      </div>
    </div>
  )
}
