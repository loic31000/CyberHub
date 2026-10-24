import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Clock, ShieldPlus, Globe, X, AlertCircle, RefreshCw, GitBranch, ArrowRight } from 'lucide-react'
import { correlationApi, iocApi } from '@/api/client'
import type { CorrelationResult, CorrelationHistoryItem } from '@/types/correlation'
import type { IOCCreatePayload } from '@/types/ioc'
import { toast } from '@/store/toast'
import CorrHero from '@/corr26/CorrHero'
import ResultView from '@/corr26/ResultView'
import { IOC_TYPES, confidenceOf, formatDayTime, typeLabel, type IOCType } from '@/corr26/parts'
import '@/corr26/corr.css'

/*
 * Correlation engine: one indicator in, its links to MITRE ATT&CK, CVE,
 * playbooks and local data out. The handlers below are the module's existing
 * behaviour, unchanged; this file only lays them out.
 */
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

  const typeRefs = useRef(new Map<IOCType, HTMLButtonElement>())
  const valueRef = useRef<HTMLInputElement>(null)

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

  // The type picker is a radio group: arrows move and select, Tab leaves it.
  const onTypeKey = (event: React.KeyboardEvent, index: number) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = IOC_TYPES[(index + step + IOC_TYPES.length) % IOC_TYPES.length].value
    setIocType(next)
    typeRefs.current.get(next)?.focus()
  }

  const example = IOC_TYPES.find(t => t.value === iocType)?.example
  const heroStatus = loading
    ? { text: 'ANALYSE EN COURS', tone: 'busy' as const }
    : error
      ? { text: 'ANALYSE ÉCHOUÉE', tone: 'warn' as const }
      : result
        ? { text: `${confidenceOf(result.confidence).pct} %`, mark: result.from_cache ? 'EN CACHE' : 'CONFIANCE' }
        : { text: 'PRÊT', mark: 'LOCAL' }

  const actions = result && (
    <>
      <button type="button" className="cr26-btn is-primary" onClick={handleSaveAsIOC} disabled={saving}>
        <ShieldPlus size={15} aria-hidden="true" /> {saving ? 'Sauvegarde…' : 'Sauvegarder comme IOC'}
      </button>
      {(iocType === 'ip' || iocType === 'cidr') && (
        <button type="button" className="cr26-btn" onClick={() => navigate(`/bgp?prefill=${encodeURIComponent(iocValue)}`)}>
          <Globe size={15} aria-hidden="true" /> BGP Lookup
        </button>
      )}
      {iocType === 'hash' && (
        <button type="button" className="cr26-btn" onClick={() => navigate(`/ioc?search=${encodeURIComponent(iocValue)}`)}>
          <Search size={15} aria-hidden="true" /> Rechercher dans IOC
        </button>
      )}
      <button type="button" className="cr26-text-btn" onClick={handleInvalidateCache}>Invalider le cache</button>
    </>
  )

  return (
    <div className="cr26">
      <div className="cr26-frame">
        <CorrHero status={heroStatus} />

        <section className="cr26-console" aria-label="Nouvelle analyse">
          <div className="cr26-types" role="radiogroup" aria-label="Type d’indicateur">
            {IOC_TYPES.map((t, i) => (
              <button
                key={t.value}
                ref={el => { if (el) typeRefs.current.set(t.value, el); else typeRefs.current.delete(t.value) }}
                type="button"
                role="radio"
                aria-checked={iocType === t.value}
                tabIndex={iocType === t.value ? 0 : -1}
                onClick={() => setIocType(t.value)}
                onKeyDown={e => onTypeKey(e, i)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="cr26-query">
            <div className="cr26-input">
              <span className="cr26-input-type" aria-hidden="true">{typeLabel(iocType)}</span>
              <input
                ref={valueRef}
                type="text"
                value={iocValue}
                onChange={e => setIocValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={example}
                aria-label={`Valeur de l’indicateur (${typeLabel(iocType)})`}
                spellCheck={false}
                autoComplete="off"
              />
              {iocValue && (
                <button type="button" className="cr26-icon-btn" onClick={() => { handleClearInput(); valueRef.current?.focus() }} aria-label="Effacer">
                  <X size={16} />
                </button>
              )}
            </div>
            <button type="button" className="cr26-btn is-primary is-lg" onClick={handleAnalyze} disabled={loading || !iocValue.trim()}>
              <Search size={17} aria-hidden="true" /> {loading ? 'Analyse…' : 'Analyser'}
            </button>
          </div>
        </section>

        <div className="cr26-layout">
          <div className="cr26-main" aria-busy={loading || undefined}>
            {loading && (
              <div className="cr26-loading" role="status" aria-label="Analyse en cours">
                <div className="cr26-sk is-head" /><div className="cr26-sk is-line" /><div className="cr26-sk is-block" /><div className="cr26-sk is-block" />
              </div>
            )}

            {error && !loading && (
              <div className="cr26-state is-error" role="alert">
                <AlertCircle size={26} aria-hidden="true" />
                <h2>L’analyse a échoué</h2>
                <p>{error}</p>
                <button type="button" className="cr26-btn" onClick={handleAnalyze} disabled={!iocValue.trim()}><RefreshCw size={14} aria-hidden="true" /> Réessayer</button>
              </div>
            )}

            {result && !loading && <ResultView result={result} actions={actions} />}

            {!result && !loading && !error && (
              <div className="cr26-intro">
                <GitBranch size={26} aria-hidden="true" />
                <h2>Analysez un indicateur</h2>
                <p>Choisissez son type, saisissez sa valeur puis lancez l’analyse. Le moteur le rapproche des données locales de CyberHub :</p>
                <ul>
                  <li>techniques MITRE ATT&CK et layers</li>
                  <li>CVE critiques</li>
                  <li>playbooks et investigations</li>
                  <li>outils, LOLBins, CLOAK et notes</li>
                </ul>
              </div>
            )}
          </div>

          <aside className="cr26-history" aria-labelledby="cr26-history-title">
            <header>
              <h2 id="cr26-history-title"><Clock size={15} aria-hidden="true" /> Historique</h2>
              {historyLoaded && <span className="cr26-count">{history.length}</span>}
            </header>

            {!historyLoaded && !historyLoading && (
              <div className="cr26-history-empty">
                <p>Les analyses gardées en cache apparaissent ici.</p>
                <button type="button" className="cr26-btn" onClick={loadHistory}>Charger l’historique</button>
              </div>
            )}

            {historyLoading && (
              <div className="cr26-history-loading" role="status" aria-label="Chargement de l’historique">
                {[0, 1, 2].map(i => <div key={i} className="cr26-sk is-row" />)}
              </div>
            )}

            {historyLoaded && history.length === 0 && (
              <p className="cr26-history-empty">Aucune analyse en cache.</p>
            )}

            {historyLoaded && history.length > 0 && (
              <ul className="cr26-history-list">
                {history.map(item => (
                  <li key={`${item.ioc_type}-${item.ioc_value}`}>
                    <button
                      type="button"
                      aria-label={`Relancer l’analyse de ${item.ioc_value} (${typeLabel(item.ioc_type)})`}
                      onClick={() => {
                        setIocType(item.ioc_type as IOCType)
                        setIocValue(item.ioc_value)
                        setResult(null)
                        setError(null)
                        // Lancer l'analyse automatiquement après un court délai pour laisser l'UI se mettre à jour
                        setTimeout(() => handleAnalyze(), 50)
                      }}
                    >
                      <span className="cr26-history-type">{typeLabel(item.ioc_type)}</span>
                      <span className="cr26-history-value">{item.ioc_value}</span>
                      <span className="cr26-history-date">{formatDayTime(item.generated_at)}</span>
                      <ArrowRight size={14} aria-hidden="true" className="cr26-history-go" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
