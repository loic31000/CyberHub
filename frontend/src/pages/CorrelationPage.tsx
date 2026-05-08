import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GitBranch, Search, Clock, ShieldPlus, Trash2, Globe, X } from 'lucide-react'
import { correlationApi, iocApi } from '@/api/client'
import type { CorrelationResult, CorrelationHistoryItem } from '@/types/correlation'
import type { IOCCreatePayload } from '@/types/ioc'
import CorrelationPanel from '@/components/CorrelationPanel'
import { toast } from '@/store/toast'

type IOCType = 'ip' | 'domain' | 'hash' | 'url' | 'email' | 'cidr'

const IOC_TYPES: { value: IOCType; label: string }[] = [
  { value: 'ip',     label: 'IP' },
  { value: 'domain', label: 'DOMAINE' },
  { value: 'hash',   label: 'HASH' },
  { value: 'url',    label: 'URL' },
  { value: 'email',  label: 'EMAIL' },
  { value: 'cidr',   label: 'CIDR' },
]

export default function CorrelationPage() {
  const navigate = useNavigate()
  const [iocType,  setIocType]  = useState<IOCType>('ip')
  const [iocValue, setIocValue] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState<CorrelationResult | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  // Historique récent
  const [history,         setHistory]        = useState<CorrelationHistoryItem[]>([])
  const [historyLoading,  setHistoryLoading] = useState(false)
  const [historyLoaded,   setHistoryLoaded]  = useState(false)

  // Sauvegarder comme IOC
  const [saving, setSaving] = useState(false)

  const handleAnalyze = async () => {
    const val = iocValue.trim()
    if (!val) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await correlationApi.correlationAnalyze(iocType, val)
      setResult(res)
    } catch {
      setError('Erreur lors de l\'analyse. Vérifiez la valeur saisie.')
    } finally {
      setLoading(false)
    }
  }

  const loadHistory = async () => {
    if (historyLoaded) return
    setHistoryLoading(true)
    try {
      const items = await correlationApi.correlationHistory()
      setHistory(items)
      setHistoryLoaded(true)
    } catch {
      toast.error('Impossible de charger l\'historique')
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleSaveAsIOC = async () => {
    if (!result) return
    setSaving(true)
    try {
      const payload: IOCCreatePayload = {
        type:        iocType,
        value:       result.ioc_value,
        notes: `Analysé via Corrélation — ${result.techniques.length} technique(s) MITRE`,
        tlp:         'amber',
        status:      'active',
        tags:        result.techniques.slice(0, 3).map(t => t.technique_id).join(','),
      }
      await iocApi.create(payload)
      toast.success(`IOC ${result.ioc_value} sauvegardé`)
    } catch {
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleInvalidateCache = async () => {
    if (!result) return
    try {
      await correlationApi.correlationInvalidateCache(result.ioc_value)
      toast.success('Cache invalidé — relancez l\'analyse')
      setResult(null)
      setHistoryLoaded(false)
      setHistory([])
    } catch {
      toast.error('Impossible d\'invalider le cache')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleAnalyze()
  }

  const handleClearInput = () => {
    setIocValue('')
    setResult(null)
    setError(null)
  }

  return (
    <div className="flex flex-col h-full bg-[#06080f] text-[#f1f5f9]">
      {/* Bandeau d'en-tête style BGPLookup */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d40] bg-[#0a0f16]/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <GitBranch className="text-[#00d4ff]" size={20} />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#10b981] rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase">CORRELATION ENGINE // ANALYZE</h1>
            <p className="text-[10px] text-[#64748b] font-mono">
              Corrélation IOC → MITRE ATT&CK · CLOAK · Outils · Playbooks · CVE
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px]">
          <span className="text-[#64748b]">STATUS</span>
          <span className="text-[#10b981]">ONLINE</span>
          <button
            onClick={loadHistory}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2d40] hover:bg-[#2a3f55] text-[10px] font-bold border border-[#334155] transition-colors"
          >
            <Clock size={12} /> HISTORY
          </button>
        </div>
      </div>

      {/* Zone de contenu scrollable */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Formulaire d'analyse */}
        <div className="border border-[#1e2d40] bg-[#0a0f16] p-6 space-y-5">
          <h2 className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-[#8a9ab0] border-b border-[#1e2d40] pb-3">
            NOUVELLE ANALYSE
          </h2>

          <div className="space-y-4">
            {/* Sélecteur de type IOC */}
            <div className="flex flex-wrap gap-2">
              {IOC_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setIocType(t.value)}
                  className={`text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1.5 border transition-colors ${
                    iocType === t.value
                      ? 'border-[#00d4ff]/40 bg-[#00d4ff]/10 text-[#00d4ff]'
                      : 'border-[#1e2d40] text-[#64748b] hover:border-[#2a3f55] hover:text-[#8a9ab0]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Champ valeur + bouton analyser */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={iocValue}
                  onChange={e => setIocValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Entrez une valeur de type ${iocType.toUpperCase()}…`}
                  className="w-full bg-[#0d131f] border border-[#1e2d40] px-4 py-2.5 font-mono text-sm text-[#f1f5f9] placeholder-[#2a3f55] outline-none focus:border-[#00d4ff]/40"
                  spellCheck={false}
                  autoComplete="off"
                />
                {iocValue && (
                  <button
                    onClick={handleClearInput}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#f1f5f9]"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                onClick={handleAnalyze}
                disabled={loading || !iocValue.trim()}
                className="flex items-center gap-2 border border-[#00d4ff]/20 bg-[#00d4ff]/10 px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#00d4ff] transition-colors hover:bg-[#00d4ff]/20 disabled:opacity-40"
              >
                <Search size={14} />
                {loading ? 'ANALYSE...' : 'ANALYSER'}
              </button>
            </div>
          </div>
        </div>

        {/* Résultat de corrélation */}
        {(result || loading || error) && (
          <div className="space-y-4">
            <div className="border border-[#1e2d40] bg-[#0a0f16] overflow-hidden">
              <div className="flex items-center gap-2 border-b border-[#1e2d40] px-5 py-3">
                <GitBranch size={13} className="text-[#00d4ff]" />
                <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a9ab0]">
                  RÉSULTATS DE CORRÉLATION
                </h3>
              </div>
              <div className="p-5">
                <CorrelationPanel result={result} loading={loading} error={error} />
              </div>
            </div>

            {result && !loading && (
              <div className="flex flex-wrap gap-3 border-t border-[#1e2d40] pt-4">
                <button
                  onClick={handleSaveAsIOC}
                  disabled={saving}
                  className="flex items-center gap-2 border border-[#00d4ff]/20 bg-[#00d4ff]/10 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#00d4ff] transition-colors hover:bg-[#00d4ff]/20 disabled:opacity-50"
                >
                  <ShieldPlus size={13} />
                  {saving ? 'SAUVEGARDE...' : 'SAUVEGARDER COMME IOC'}
                </button>
                <button
                  onClick={handleInvalidateCache}
                  className="flex items-center gap-2 border border-[#ef4444]/20 bg-[#ef4444]/10 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ef4444] transition-colors hover:bg-[#ef4444]/20"
                >
                  <Trash2 size={13} />
                  INVALIDER LE CACHE
                </button>
                {(iocType === 'ip' || iocType === 'cidr') && (
                  <button
                    onClick={() => navigate(`/bgp?prefill=${encodeURIComponent(iocValue)}`)}
                    className="flex items-center gap-2 border border-blue-500/20 bg-blue-500/10 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-blue-400 transition-colors hover:bg-blue-500/20"
                  >
                    <Globe size={13} /> BGP LOOKUP
                  </button>
                )}
                {iocType === 'hash' && (
                  <button
                    onClick={() => navigate(`/ioc?search=${encodeURIComponent(iocValue)}`)}
                    className="flex items-center gap-2 border border-[#a855f7]/20 bg-[#a855f7]/10 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#a855f7] transition-colors hover:bg-[#a855f7]/20"
                  >
                    🔍 RECHERCHE DANS IOC
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Historique récent (card) */}
        <div className="border border-[#1e2d40] bg-[#0a0f16] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1e2d40] pb-3">
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-[#00d4ff]" />
              <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a9ab0]">
                HISTORIQUE DES ANALYSES
              </h3>
            </div>
            {!historyLoaded && (
              <button
                onClick={loadHistory}
                className="text-[10px] font-mono text-[#00d4ff] hover:underline"
              >
                CHARGER
              </button>
            )}
          </div>

          {historyLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-10 bg-[#0d131f] border border-[#1e2d40] animate-pulse" />
              ))}
            </div>
          )}

          {historyLoaded && history.length === 0 && (
            <p className="font-mono text-xs text-[#64748b]">Aucune analyse en cache.</p>
          )}

          {historyLoaded && history.length > 0 && (
            <div className="space-y-1">
              {history.map(item => (
                <div
                  key={`${item.ioc_type}-${item.ioc_value}`}
                  className="flex items-center justify-between py-2 px-2 cursor-pointer hover:bg-[#0d131f] transition-colors border border-transparent hover:border-[#1e2d40]"
                  onClick={() => {
                    setIocType(item.ioc_type as IOCType)
                    setIocValue(item.ioc_value)
                    setResult(null)
                    setError(null)
                    // Lancer l'analyse automatiquement après un court délai pour laisser l'UI se mettre à jour
                    setTimeout(() => handleAnalyze(), 50)
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono uppercase bg-[#0d131f] border border-[#1e2d40] px-1.5 py-0.5 text-[#64748b] shrink-0">
                      {item.ioc_type}
                    </span>
                    <span className="text-sm font-mono text-[#f1f5f9] truncate">
                      {item.ioc_value}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-[10px] font-mono text-[#64748b]">
                    <span>
                      {new Date(item.generated_at).toLocaleDateString('fr-FR', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}