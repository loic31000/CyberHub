import { useState, useEffect, useCallback } from 'react'
import { Terminal, Search, X, Copy, Check, ChevronRight } from 'lucide-react'
import { lolbinsApi } from '@/api/client'
import type { LOLBin, LOLBinCommand, LOLBinsResponse, LOLBinCategory } from '@/types/lolbins'
import { toast } from '@/store/toast'

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
  if (t === 'execute' || t === 'shell')       return 'border-red-500/30 bg-red-500/10 text-red-400'
  if (t === 'download' || t === 'file-write') return 'border-blue-500/30 bg-blue-500/10 text-blue-400'
  if (t === 'awl bypass')                     return 'border-orange-500/30 bg-orange-500/10 text-orange-400'
  if (t === 'ads')                            return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
  if (t === 'dump')                           return 'border-purple-500/30 bg-purple-500/10 text-purple-400'
  if (t === 'sudo')                           return 'border-orange-500/30 bg-orange-500/10 text-orange-400'
  if (t === 'file-read')                      return 'border-blue-500/30 bg-blue-500/10 text-blue-400'
  return 'border-gray-600 bg-gray-700/40 text-gray-300'
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
      className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-cyan-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]"
      title="Copier"
      aria-label="Copier"
    >
      {copied ? <Check size={13} className="text-cyan-400" /> : <Copy size={13} />}
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
    <div className="w-[480px] shrink-0 bg-[#0a0f16] border border-cyan-500/30 rounded-none flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#1e2d40]">
        <div className="flex items-center gap-2">
          <Terminal size={16} className={item.os === 'windows' ? 'text-blue-400' : 'text-orange-400'} />
          <span className="font-mono font-bold text-[#f1f5f9]">{item.name}</span>
          <span className={`text-[10px] px-2 py-0.5 border font-mono uppercase tracking-widest ${
            item.os === 'windows'
              ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
              : 'border-orange-500/30 bg-orange-500/10 text-orange-400'
          }`}>
            {item.os === 'windows' ? 'WIN' : 'LIN'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-[#1e2d40] text-[#64748b] hover:text-[#f1f5f9] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]"
          aria-label="Fermer"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Chemin */}
        {item.full_path && (
          <div>
            <p className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider mb-1">CHEMIN COMPLET</p>
            <code className="text-xs font-mono text-cyan-400 bg-[#0d131f] border border-[#1e2d40] px-3 py-1.5 block">
              {item.full_path}
            </code>
          </div>
        )}

        {/* Description */}
        <div>
          <p className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider mb-1">DESCRIPTION</p>
          <p className="text-sm font-mono text-[#cbd5e1]">{item.description}</p>
        </div>

        {/* Techniques MITRE */}
        {mitreTechs.length > 0 && (
          <div>
            <p className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider mb-2">TECHNIQUES MITRE ATT&CK</p>
            <div className="flex flex-wrap gap-1.5">
              {mitreTechs.map((t) => (
                <span
                  key={t}
                  className="text-[11px] px-2 py-1 border border-purple-500/30 bg-purple-500/10 text-purple-400 font-mono"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Commandes */}
        <div>
          <p className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider mb-2">COMMANDES D'ABUS</p>
          <div className="space-y-3">
            {commands.map((cmd, i) => {
              const cmdText = getCommandText(cmd)
              const cmdDesc = getCommandDesc(cmd)
              const cmdType = cmd.type ?? cmd.Usecase ?? cmd.Category ?? ''
              const cmdPriv = cmd.Privileges ?? ''
              if (!cmdText) return null
              return (
                <div key={i} className="bg-[#0d131f] border border-[#1e2d40] overflow-hidden">
                  {(cmdDesc || cmdType || cmdPriv) && (
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1e2d40]">
                      {cmdType && (
                        <span className={`text-[10px] px-1.5 py-0.5 font-mono uppercase border ${cmdTypeBadgeCls(cmdType)}`}>
                          {cmdType}
                        </span>
                      )}
                      {cmdPriv && (
                        <span className={`text-[10px] px-1.5 py-0.5 font-mono uppercase border ${
                          cmdPriv === 'Administrator' || cmdPriv === 'root'
                            ? 'border-red-500/30 bg-red-500/10 text-red-400'
                            : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
                        }`}>
                          {cmdPriv}
                        </span>
                      )}
                      {cmdDesc && (
                        <span className="text-[11px] text-[#8a9ab0] flex-1 truncate">{cmdDesc}</span>
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
      className={`text-left w-full p-4 border transition-colors ${
        selected
          ? 'border-cyan-500/60 bg-cyan-500/5'
          : 'border-[#1e2d40] bg-[#0a0f16] hover:border-cyan-500/40'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono font-bold text-sm text-[#f1f5f9] truncate">{item.name}</span>
          <span className={`shrink-0 text-[10px] px-1.5 py-0.5 border ${
            item.os === 'windows'
              ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
              : 'border-orange-500/30 bg-orange-500/10 text-orange-400'
          }`}>
            {item.os === 'windows' ? 'WIN' : 'LIN'}
          </span>
        </div>
        <ChevronRight size={14} className="text-[#64748b] shrink-0 mt-0.5" />
      </div>
      {item.category && (
        <span className="text-[10px] px-2 py-0.5 border border-[#1e2d40] bg-[#0d131f] text-[#8a9ab0] font-mono mb-2 inline-block">
          {item.category}
        </span>
      )}
      <p className="text-xs font-mono text-[#8a9ab0] line-clamp-2 mt-1">{item.description}</p>
      <div className="flex items-center gap-3 mt-2">
        {commands.length > 0 && (
          <span className="text-xs text-cyan-400">{commands.length} cmd{commands.length > 1 ? 's' : ''}</span>
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
      toast.error('Erreur de chargement des LOLBins')
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
    <div className="flex flex-col h-full bg-[#06080f] text-[#f1f5f9]">
      {/* Bandeau d'en-tête style BGPLookup */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d40] bg-[#0a0f16]/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Terminal className="text-cyan-400" size={20} />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#10b981] rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase">LOLBINS // INDEX</h1>
            <p className="text-[10px] text-[#64748b] font-mono">
              Living-Off-the-Land binaries — techniques d'abus sur binaires légitimes
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px]">
          <span className="text-[#64748b]">WIN</span>
          <span className="text-blue-400 font-bold">{data?.win_count ?? 0}</span>
          <span className="text-[#64748b] ml-2">LIN</span>
          <span className="text-orange-400 font-bold">{data?.linux_count ?? 0}</span>
        </div>
      </div>

      {/* Zone de contenu scrollable */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Onglets OS */}
        <div className="flex gap-1 border-b border-[#1e2d40]">
          {(['windows', 'linux'] as const).map((os) => (
            <button
              key={os}
              onClick={() => { setActiveOS(os); setActiveCategory(''); setSelectedItem(null) }}
              className={`px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-widest transition-colors border-b-2 -mb-px ${
                activeOS === os
                  ? os === 'windows'
                    ? 'border-blue-400 text-blue-400'
                    : 'border-orange-400 text-orange-400'
                  : 'border-transparent text-[#64748b] hover:text-[#8a9ab0]'
              }`}
            >
              {os === 'windows' ? 'WINDOWS (LOLBAS)' : 'LINUX (GTFOBins)'}
            </button>
          ))}
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a6480]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un binaire..."
              className="w-full bg-[#0d131f] border border-[#1e2d40] pl-9 pr-3 py-2 font-mono text-sm text-[#f1f5f9] placeholder-[#2a3f55] outline-none focus:border-cyan-500/40"
            />
          </div>
          <input
            value={mitreFilter}
            onChange={(e) => setMitreFilter(e.target.value)}
            placeholder="Filtrer MITRE (ex: T1105)"
            className="w-48 bg-[#0d131f] border border-[#1e2d40] px-3 py-2 font-mono text-sm text-[#f1f5f9] placeholder-[#2a3f55] outline-none focus:border-purple-500/40"
          />
          {(search || activeCategory || mitreFilter) && (
            <button
              onClick={() => { setSearch(''); setActiveCategory(''); setMitreFilter('') }}
              className="flex items-center gap-1 px-3 py-2 text-sm font-mono border border-[#1e2d40] text-[#64748b] hover:border-red-500/40 hover:text-red-400 transition-colors"
            >
              <X size={13} /> RÉINITIALISER
            </button>
          )}
        </div>

        {/* Catégories */}
        {filteredCategories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCategory('')}
              className={`text-[10px] font-mono px-3 py-1.5 border transition-colors ${
                activeCategory === ''
                  ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400'
                  : 'border-[#1e2d40] text-[#64748b] hover:border-cyan-500/40 hover:text-cyan-400'
              }`}
            >
              TOUS
            </button>
            {filteredCategories.map((cat) => (
              <button
                key={cat.category}
                onClick={() => setActiveCategory(cat.category === activeCategory ? '' : cat.category)}
                className={`text-[10px] font-mono px-3 py-1.5 border transition-colors ${
                  activeCategory === cat.category
                    ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400'
                    : 'border-[#1e2d40] text-[#64748b] hover:border-cyan-500/40 hover:text-cyan-400'
                }`}
              >
                {cat.category.toUpperCase()} <span className="opacity-60">({cat.count})</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-6">
          {/* Grille */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="text-center py-12 text-[#64748b] font-mono text-sm">CHARGEMENT...</div>
            ) : !data || data.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center border border-[#1e2d40] bg-[#0a0f16] py-24 text-center">
                <Terminal size={40} className="mb-4 text-[#1e2d40]" />
                <p className="font-mono text-sm uppercase tracking-widest text-[#64748b]">AUCUN RÉSULTAT</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
          </div>

          {/* Drawer détail */}
          {selectedItem && (
            <LOLBinDrawer item={selectedItem} onClose={() => setSelectedItem(null)} />
          )}
        </div>
      </div>
    </div>
  )
}