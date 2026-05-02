import { useState } from 'react'
import { GitBranch, Search, Clock, ShieldPlus, Trash2 } from 'lucide-react'
import { correlationApi, iocApi } from '@/api/client'
import type { CorrelationResult, CorrelationHistoryItem } from '@/types/correlation'
import type { IOCCreatePayload } from '@/types/ioc'
import CorrelationPanel from '@/components/CorrelationPanel'
import { toast } from '@/store/toast'

type IOCType = 'ip' | 'domain' | 'hash' | 'url' | 'email' | 'cidr'

const IOC_TYPES: { value: IOCType; label: string }[] = [
  { value: 'ip',     label: 'IP' },
  { value: 'domain', label: 'Domaine' },
  { value: 'hash',   label: 'Hash' },
  { value: 'url',    label: 'URL' },
  { value: 'email',  label: 'Email' },
  { value: 'cidr',   label: 'CIDR' },
]

export default function CorrelationPage() {
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
        tags:        result.techniques.slice(0, 3).map((t: import('@/types/correlation').CorrelationTechnique) => t.technique_id).join(','),
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
    } catch {
      toast.error('Impossible d\'invalider le cache')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleAnalyze()
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <GitBranch size={24} className="text-cyber-cyan" />
          Analyse de Corrélation
        </h1>
        <p className="text-text-muted text-sm mt-1">
          Corrèle un IOC avec MITRE ATT&CK, CLOAK, les outils, playbooks et CVE de votre base.
        </p>
      </div>

      {/* Formulaire d'analyse */}
      <div className="card space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Sélecteur de type */}
          <div className="flex gap-1 flex-wrap">
            {IOC_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setIocType(t.value)}
                className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                  iocType === t.value
                    ? 'bg-cyber-cyan/20 border-cyber-cyan text-cyber-cyan'
                    : 'border-border text-text-muted hover:border-cyber-cyan/40 hover:text-text-secondary'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            value={iocValue}
            onChange={(e) => setIocValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Entrez une valeur de type ${iocType}…`}
            className="input flex-1"
            spellCheck={false}
            autoComplete="off"
          />
          <button
            onClick={handleAnalyze}
            disabled={loading || !iocValue.trim()}
            className="btn-cyber flex items-center gap-2 px-4"
          >
            <Search size={16} />
            {loading ? 'Analyse…' : 'Analyser'}
          </button>
        </div>
      </div>

      {/* Résultat */}
      {(result || loading || error) && (
        <div className="space-y-3">
          <CorrelationPanel result={result} loading={loading} error={error} />

          {result && !loading && (
            <div className="flex gap-3">
              <button
                onClick={handleSaveAsIOC}
                disabled={saving}
                className="btn-secondary flex items-center gap-2 text-sm border-cyber-cyan/40 text-cyber-cyan hover:bg-cyber-cyan/10"
              >
                <ShieldPlus size={15} />
                {saving ? 'Sauvegarde…' : 'Sauvegarder comme IOC'}
              </button>
              <button
                onClick={handleInvalidateCache}
                className="btn-secondary flex items-center gap-2 text-sm border-border text-text-muted hover:text-cyber-red hover:border-cyber-red/40"
              >
                <Trash2 size={15} />
                Invalider le cache
              </button>
            </div>
          )}
        </div>
      )}

      {/* Historique récent */}
      <div className="card">
        <button
          onClick={loadHistory}
          className="flex items-center gap-2 w-full text-left"
        >
          <Clock size={16} className="text-cyber-cyan" />
          <span className="font-medium text-text-primary text-sm">Historique des analyses</span>
          {!historyLoaded && (
            <span className="ml-auto text-xs text-text-muted">Cliquer pour charger</span>
          )}
        </button>

        {historyLoading && (
          <div className="mt-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-bg-hover rounded animate-pulse" />
            ))}
          </div>
        )}

        {historyLoaded && history.length === 0 && (
          <p className="text-text-muted text-xs mt-3">Aucune analyse en cache.</p>
        )}

        {historyLoaded && history.length > 0 && (
          <div className="mt-3 divide-y divide-border">
            {history.map((item) => (
              <div
                key={`${item.ioc_type}-${item.ioc_value}`}
                className="flex items-center justify-between py-2 gap-3 cursor-pointer hover:bg-bg-hover px-1 rounded transition-colors"
                onClick={() => {
                  setIocType(item.ioc_type as IOCType)
                  setIocValue(item.ioc_value)
                  // Relancer l'analyse automatiquement
                  setResult(null)
                  setError(null)
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs bg-bg-hover border border-border px-1.5 py-0.5 rounded font-mono shrink-0">
                    {item.ioc_type}
                  </span>
                  <span className="text-sm text-text-primary font-mono truncate">
                    {item.ioc_value}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-xs text-text-muted">
                  
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
  )
}
