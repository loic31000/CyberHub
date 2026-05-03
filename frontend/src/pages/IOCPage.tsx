import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useIocStore } from '@/store/useIocStore'
import type { IOC, IOCCreatePayload, IOCType, IOCTLP, IOCStatus } from '@/types/ioc'
import { toast } from '@/store/toast'
import CorrelationPanel from '@/components/CorrelationPanel'
import { correlationApi, hashApi, iocApi } from '@/api/client'
import type { CorrelationResult } from '@/types/correlation'
import type { HashAnalysisResponse, VirusTotalData, MalwareBazaarData, ThreatFoxData, URLhausData } from '@/types/hash'
import {
  ShieldBan, Plus, Search, Download, X, Trash2, Edit2,
  Globe, Hash, Link, Mail, Network, GitBranch, Loader2, RefreshCw, Shield,
} from 'lucide-react'

// TLP labels sont standards — pas traduits
const TLP_OPTIONS: { value: IOCTLP; label: string; color: string }[] = [
  { value: 'white', label: 'TLP:WHITE', color: 'text-white border-white/40 bg-white/10' },
  { value: 'green', label: 'TLP:GREEN', color: 'text-green-400 border-green-400/40 bg-green-400/10' },
  { value: 'amber', label: 'TLP:AMBER', color: 'text-amber-400 border-amber-400/40 bg-amber-400/10' },
  { value: 'red',   label: 'TLP:RED',   color: 'text-red-400 border-red-400/40 bg-red-400/10' },
]

const STATUS_COLORS: Record<IOCStatus, string> = {
  active:         'text-cyber-green',
  archived:       'text-text-muted',
  false_positive: 'text-yellow-400',
}

const IOC_TYPES: IOCType[] = ['ip', 'domain', 'hash', 'url', 'email']

function tlpBadge(tlp: IOCTLP) {
  const opt = TLP_OPTIONS.find((t) => t.value === tlp)
  return opt
    ? <span className={`text-xs px-1.5 py-0.5 rounded border font-mono ${opt.color}`}>{opt.label}</span>
    : null
}

function typeIcon(type: IOCType) {
  const cls = 'text-cyber-cyan'
  switch (type) {
    case 'ip':     return <Network size={14} className={cls} />
    case 'domain': return <Globe   size={14} className={cls} />
    case 'hash':   return <Hash    size={14} className={cls} />
    case 'url':    return <Link    size={14} className={cls} />
    case 'email':  return <Mail    size={14} className={cls} />
  }
}

function parseTags(raw: string): string[] {
  if (!raw) return []
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [] }
  catch { return raw.split(',').map((t) => t.trim()).filter(Boolean) }
}

function tagsToJSON(input: string): string {
  const tags = input.split(',').map((t) => t.trim()).filter(Boolean)
  return tags.length > 0 ? JSON.stringify(tags) : ''
}

// ── Formulaire ────────────────────────────────────────────────────────────────

interface IOCFormProps {
  initial?: Partial<IOC>
  onSubmit: (data: IOCCreatePayload) => Promise<void>
  onCancel: () => void
}

function IOCForm({ initial, onSubmit, onCancel }: IOCFormProps) {
    const [type, setType]     = useState<IOCType>(initial?.type ?? 'ip')
  const [value, setValue]   = useState(initial?.value ?? '')
  const [source, setSource] = useState(initial?.source ?? '')
  const [tlp, setTlp]       = useState<IOCTLP>(initial?.tlp ?? 'white')
  const [status, setStatus] = useState<IOCStatus>(initial?.status ?? 'active')
  const [tags, setTags]     = useState(() => parseTags(initial?.tags ?? '').join(', '))
  const [notes, setNotes]   = useState(initial?.notes ?? '')
  const [mitre, setMitre]   = useState(initial?.mitre_tech_id ?? '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) { toast.error(`La valeur est requise`); return }
    setSaving(true)
    try {
      await onSubmit({ type, value: value.trim(), source: source.trim(), tlp, status,
        tags: tagsToJSON(tags), notes: notes.trim(), mitre_tech_id: mitre.trim() })
    } finally { setSaving(false) }
  }

  const inputCls = 'w-full bg-bg-secondary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-cyber-cyan'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-3">
        <div className="w-36">
          <label className="text-xs text-text-muted block mb-1">{`Type *`}</label>
          <select value={type} onChange={(e) => setType(e.target.value as IOCType)} className={inputCls}>
            {IOC_TYPES.map((tp) => <option key={tp} value={tp}>{tp.toUpperCase()}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs text-text-muted block mb-1">{`Valeur *`}</label>
          <input value={value} onChange={(e) => setValue(e.target.value)}
            placeholder={type === 'hash' ? 'md5/sha256...' : type === 'ip' ? '192.168.1.1' : type}
            className={inputCls} />
        </div>
      </div>
      <div>
        <label className="text-xs text-text-muted block mb-1">{`Source`}</label>
        <input value={source} onChange={(e) => setSource(e.target.value)} placeholder={`ex: VirusTotal, AbuseIPDB, manuel...`} className={inputCls} />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs text-text-muted block mb-1">{`TLP`}</label>
          <select value={tlp} onChange={(e) => setTlp(e.target.value as IOCTLP)} className={inputCls}>
            {TLP_OPTIONS.map((tp) => <option key={tp.value} value={tp.value}>{tp.label}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs text-text-muted block mb-1">{`Statut`}</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as IOCStatus)} className={inputCls}>
            <option value="active">{`Actif`}</option>
            <option value="archived">{`Archivé`}</option>
            <option value="false_positive">{`Faux positif`}</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-text-muted block mb-1">
          {`Tags`} <span className="opacity-50">{`(séparés par virgule)`}</span>
        </label>
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder={`ransomware, c2, apt28...`} className={inputCls} />
      </div>
      <div>
        <label className="text-xs text-text-muted block mb-1">
          {`Technique MITRE ATT&CK`} <span className="opacity-50">{`(optionnel)`}</span>
        </label>
        <input value={mitre} onChange={(e) => setMitre(e.target.value)} placeholder={`ex: T1046`} className={inputCls} />
      </div>
      <div>
        <label className="text-xs text-text-muted block mb-1">{`Notes`}</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder={`Contexte, observations...`} className={inputCls + ' resize-none'} />
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-text-muted hover:text-text-primary border border-border rounded transition-colors">
          {`Annuler`}
        </button>
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-cyber-cyan text-bg-primary font-semibold rounded hover:bg-cyber-cyan/80 disabled:opacity-50 transition-colors">
          {saving ? `Sauvegarde…` : initial?.id ? `Mettre à jour` : `Ajouter`}
        </button>
      </div>
    </form>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

// ── HashAnalysisPanel ────────────────────────────────────────────────────────

function HashAnalysisPanel({
  hashResult,
  hashLoading,
  onForceRefresh,
}: {
  hashResult: HashAnalysisResponse | null
  hashLoading: boolean
  onForceRefresh: () => void
}) {
  const navigate = useNavigate()
  const [showAllEngines, setShowAllEngines] = useState(false)

  if (hashLoading) {
    return (
      <div className="flex items-center gap-2 text-text-muted text-sm py-4">
        <Loader2 size={16} className="animate-spin" />
        Interrogation des sources en cours…
      </div>
    )
  }

  if (!hashResult) {
    return <p className="text-text-muted text-sm py-4">Impossible de contacter les sources d'analyse.</p>
  }

  const sources = hashResult.sources ?? []
  const mbSource = sources.find(s => s.source === 'malwarebazaar')
  const tfSource = sources.find(s => s.source === 'threatfox')
  const uhSource = sources.find(s => s.source === 'urlhaus')
  const vtSource = sources.find(s => s.source === 'virustotal')
  const vtData = vtSource?.found ? (vtSource.data as VirusTotalData) : null
  const mbData = mbSource?.found ? (mbSource.data as MalwareBazaarData) : null
  const tfData = tfSource?.found ? (tfSource.data as ThreatFoxData) : null
  const uhData = uhSource?.found ? (uhSource.data as URLhausData) : null

  const threatName = vtData?.threat_label || mbData?.signature || tfData?.malware || null

  const maliciousEngines = vtData
    ? Object.entries(vtData.malicious_engines || {}).slice(0, showAllEngines ? undefined : 20)
    : []

  const statusIcon = (status: string) => {
    if (status === 'found') return <span className="text-green-400 text-xs">✅ Trouvé</span>
    if (status === 'not_found') return <span className="text-text-muted text-xs">⬜ Inconnu</span>
    if (status === 'skipped') return <span className="text-yellow-400 text-xs">⏭️ Ignoré</span>
    if (status === 'not_configured') return <span className="text-orange-400 text-xs">⚙️ Non configuré</span>
    return <span className="text-red-400 text-xs">❌ Erreur</span>
  }

  return (
    <div className="space-y-4">
      {/* Résumé */}
      <div className={`rounded-lg p-4 border flex items-start justify-between gap-4 ${
        hashResult.found
          ? 'bg-red-900/20 border-red-500/40'
          : 'bg-green-900/10 border-green-500/30'
      }`}>
        <div className="flex-1">
          {hashResult.found ? (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-red-400 font-bold text-sm animate-pulse">⚠️ MALWARE DÉTECTÉ</span>
              {hashResult.best_result && (
                <span className="text-xs px-2 py-0.5 rounded border border-red-400/40 text-red-300 bg-red-400/10">
                  Via {hashResult.best_result.source}
                </span>
              )}
            </div>
          ) : (
            <p className="text-green-400 font-semibold text-sm">✅ Hash propre sur toutes les sources vérifiées</p>
          )}
          {threatName && (
            <p className="text-text-primary font-mono text-xs mt-1">{threatName}</p>
          )}
          <p className="text-text-muted text-xs mt-1 font-mono">{hashResult.hash_type.toUpperCase()} · {hashResult.hash}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hashResult.from_cache && (
            <span className="text-xs text-text-muted px-2 py-0.5 rounded border border-border">🗄️ Cache</span>
          )}
          <button
            onClick={onForceRefresh}
            className="text-xs px-2 py-1 rounded border border-border text-text-muted hover:text-cyber-cyan hover:border-cyber-cyan transition-colors flex items-center gap-1"
          >
            <RefreshCw size={11} /> Forcer MAJ
          </button>
        </div>
      </div>

      {/* VirusTotal */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-blue-400" />
            <span className="font-semibold text-text-primary text-sm">VirusTotal</span>
            {statusIcon(vtSource?.status ?? 'error')}
          </div>
          {vtData && (
            <div className="flex items-center gap-2">
              <div className={`text-sm font-bold font-mono ${
                vtData.detection_score > 50 ? 'text-red-400' :
                vtData.detection_score > 10 ? 'text-orange-400' : 'text-green-400'
              }`}>
                {vtData.stats.malicious}/{vtData.stats.malicious + vtData.stats.suspicious + vtData.stats.undetected + vtData.stats.harmless} moteurs
              </div>
            </div>
          )}
        </div>

        {vtSource?.status === 'not_configured' && (
          <div className="text-center py-3">
            <p className="text-text-muted text-sm mb-2">⚙️ Clé API VirusTotal non configurée</p>
            <button
              onClick={() => navigate('/settings?section=virustotal')}
              className="text-xs text-cyber-cyan hover:underline"
            >
              Configurer dans Paramètres →
            </button>
          </div>
        )}

        {vtData && (
          <>
            <div>
              <div className="flex justify-between text-xs text-text-muted mb-1">
                <span>Score de détection</span>
                <span className={vtData.detection_score > 50 ? 'text-red-400' : vtData.detection_score > 10 ? 'text-orange-400' : 'text-green-400'}>
                  {vtData.detection_score}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    vtData.detection_score > 50 ? 'bg-red-500' :
                    vtData.detection_score > 10 ? 'bg-orange-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${vtData.detection_score}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Malveillant', val: vtData.stats.malicious, cls: 'text-red-400' },
                { label: 'Suspect', val: vtData.stats.suspicious, cls: 'text-orange-400' },
                { label: 'Non détecté', val: vtData.stats.undetected, cls: 'text-text-muted' },
                { label: 'Sûr', val: vtData.stats.harmless, cls: 'text-green-400' },
              ].map(s => (
                <div key={s.label} className="bg-bg-primary rounded p-2 border border-border">
                  <p className={`text-lg font-bold font-mono ${s.cls}`}>{s.val}</p>
                  <p className="text-xs text-text-muted">{s.label}</p>
                </div>
              ))}
            </div>

            {(vtData.threat_label || vtData.meaningful_name || vtData.type_description) && (
              <div className="text-xs space-y-0.5 text-text-muted">
                {vtData.threat_label && <p><span className="text-text-primary">Menace :</span> <span className="text-red-300 font-mono">{vtData.threat_label}</span></p>}
                {vtData.meaningful_name && <p><span className="text-text-primary">Fichier :</span> {vtData.meaningful_name}</p>}
                {vtData.type_description && <p><span className="text-text-primary">Type :</span> {vtData.type_description}</p>}
                {vtData.first_seen && <p><span className="text-text-primary">1ère vue :</span> {new Date(vtData.first_seen).toLocaleDateString('fr-FR')}</p>}
              </div>
            )}

            {maliciousEngines.length > 0 && (
              <div>
                <p className="text-xs text-text-muted font-medium mb-1">Moteurs ayant détecté une menace :</p>
                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-text-muted border-b border-border">
                        <th className="text-left pb-1 pr-3">Moteur</th>
                        <th className="text-left pb-1 pr-3">Catégorie</th>
                        <th className="text-left pb-1">Résultat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {maliciousEngines.map(([engine, r]) => (
                        <tr key={engine} className="border-b border-border/30">
                          <td className="py-1 pr-3 text-text-primary">{engine}</td>
                          <td className="py-1 pr-3">
                            <span className={r.category === 'malicious' ? 'text-red-400' : 'text-orange-400'}>
                              {r.category}
                            </span>
                          </td>
                          <td className="py-1 text-text-muted font-mono truncate max-w-[200px]">{r.result}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {Object.keys(vtData.malicious_engines || {}).length > 20 && (
                  <button
                    onClick={() => setShowAllEngines(v => !v)}
                    className="text-xs text-cyber-cyan hover:underline mt-1"
                  >
                    {showAllEngines ? 'Réduire' : `Voir tous les ${Object.keys(vtData.malicious_engines).length} moteurs →`}
                  </button>
                )}
              </div>
            )}

            {vtData.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {vtData.tags.map(t => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded border border-cyber-cyan/30 text-cyber-cyan">{t}</span>
                ))}
              </div>
            )}
          </>
        )}

        {vtSource?.status === 'error' && vtSource.error && (
          <p className="text-red-400 text-xs">{vtSource.error}</p>
        )}

        {vtSource?.status === 'not_found' && (
          <p className="text-text-muted text-xs">Hash inconnu de VirusTotal.</p>
        )}
      </div>

      {/* MalwareBazaar / ThreatFox / URLhaus compact cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* MalwareBazaar */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-primary">MalwareBazaar</span>
            {statusIcon(mbSource?.status ?? 'error')}
          </div>
          {mbData && (
            <div className="text-xs text-text-muted space-y-0.5">
              {mbData.file_type && <p><span className="text-text-primary">Type :</span> {mbData.file_type}</p>}
              {mbData.signature && <p><span className="text-text-primary">Signature :</span> <span className="text-red-300">{mbData.signature}</span></p>}
              {mbData.first_seen && <p><span className="text-text-primary">1ère vue :</span> {mbData.first_seen}</p>}
              {mbData.reporter && <p><span className="text-text-primary">Reporter :</span> {mbData.reporter}</p>}
              {mbData.tags && mbData.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {mbData.tags.map(t => (
                    <span key={t} className="px-1.5 py-0.5 rounded border border-red-400/30 text-red-300">{t}</span>
                  ))}
                </div>
              )}
            </div>
          )}
          {mbSource?.status === 'not_found' && <p className="text-xs text-text-muted">Hash inconnu.</p>}
          {mbSource?.status === 'error' && <p className="text-xs text-red-400">{mbSource.error}</p>}
        </div>

        {/* ThreatFox */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-primary">ThreatFox</span>
            {statusIcon(tfSource?.status ?? 'error')}
          </div>
          {tfData && (
            <div className="text-xs text-text-muted space-y-0.5">
              {tfData.malware && <p><span className="text-text-primary">Malware :</span> <span className="text-red-300">{tfData.malware}</span></p>}
              {tfData.threat_type && <p><span className="text-text-primary">Type :</span> {tfData.threat_type}</p>}
              <p><span className="text-text-primary">Confiance :</span> {tfData.confidence_level}%</p>
              {tfData.first_seen && <p><span className="text-text-primary">1ère vue :</span> {tfData.first_seen}</p>}
            </div>
          )}
          {tfSource?.status === 'not_found' && <p className="text-xs text-text-muted">Hash inconnu.</p>}
          {tfSource?.status === 'error' && <p className="text-xs text-red-400">{tfSource.error}</p>}
        </div>

        {/* URLhaus */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-primary">URLhaus</span>
            {statusIcon(uhSource?.status ?? 'error')}
          </div>
          {uhData && (
            <div className="text-xs text-text-muted space-y-0.5">
              {uhData.file_type && <p><span className="text-text-primary">Type :</span> {uhData.file_type}</p>}
              {uhData.signature && <p><span className="text-text-primary">Signature :</span> {uhData.signature}</p>}
              <p><span className="text-text-primary">URLs associées :</span> {uhData.urls_count}</p>
              {uhData.urlhaus_reference && (
                <a href={uhData.urlhaus_reference} target="_blank" rel="noreferrer" className="text-cyber-cyan hover:underline">
                  Voir sur URLhaus →
                </a>
              )}
            </div>
          )}
          {uhSource?.status === 'skipped' && (
            <p className="text-xs text-text-muted">Non applicable pour les hash MD5 (SHA256 requis).</p>
          )}
          {uhSource?.status === 'not_found' && <p className="text-xs text-text-muted">Hash inconnu.</p>}
          {uhSource?.status === 'error' && <p className="text-xs text-red-400">{uhSource.error}</p>}
        </div>
      </div>
    </div>
  )
}

export default function IOCPage() {
    const {
    iocs, total, loading, stats, filter,
    fetchIocs, fetchStats, setFilter,
    createIoc, updateIoc, deleteIoc, exportCSV,
  } = useIocStore()

  const [showForm, setShowForm]     = useState(false)
  const [editTarget, setEditTarget] = useState<IOC | null>(null)
  const [search, setSearch]         = useState('')
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null)

  // Sélection multiple
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const allSelected = iocs.length > 0 && iocs.every((ioc) => selectedIds.has(ioc.id))
  const someSelected = !allSelected && iocs.some((ioc) => selectedIds.has(ioc.id))

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleToggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(iocs.map((ioc) => ioc.id)))
    }
  }

  const handleBulkDelete = async () => {
    const count = selectedIds.size
    if (!confirm(`Supprimer ${count} IOC${count > 1 ? 's' : ''} sélectionné${count > 1 ? 's' : ''} ?`)) return
    setBulkDeleting(true)
    let errors = 0
    for (const id of Array.from(selectedIds)) {
      try { await deleteIoc(id) } catch { errors++ }
    }
    setBulkDeleting(false)
    setSelectedIds(new Set())
    if (errors === 0) toast.success(`${count} IOC${count > 1 ? 's' : ''} supprimé${count > 1 ? 's' : ''}`)
    else toast.error(`${errors} erreur(s) lors de la suppression`)
  }

  // Vue détail
  const [selectedIOC, setSelectedIOC] = useState<IOC | null>(null)
  const [correlationResult, setCorrelationResult] = useState<CorrelationResult | null>(null)
  const [correlationLoading, setCorrelationLoading] = useState(false)
  const [correlationError, setCorrelationError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'details' | 'correlation' | 'hash_analysis'>('details')
  const [hashResult, setHashResult] = useState<HashAnalysisResponse | null>(null)
  const [hashLoading, setHashLoading] = useState(false)
  const [searchParams] = useSearchParams()

  // Détecter automatiquement quand l'onglet Analyse Hash est actif pour un IOC hash
  useEffect(() => {
    if (selectedIOC && selectedIOC.type === 'hash' && activeTab === 'hash_analysis') {
      loadHashAnalysis(selectedIOC)
    }
  }, [selectedIOC, activeTab])

  useEffect(() => {
    const selectedId = searchParams.get('selected')
    if (!selectedId) return
    const id = Number(selectedId)
    if (Number.isNaN(id)) return

    iocApi.get(id).then((ioc) => setSelectedIOC(ioc)).catch(() => {})
  }, [searchParams])

  useEffect(() => { fetchIocs(); fetchStats() }, [])

  const handleSearch = (v: string) => {
    setSearch(v)
    setSelectedIds(new Set())
    if (searchTimeout) clearTimeout(searchTimeout)
    setSearchTimeout(setTimeout(() => setFilter({ q: v || undefined }), 350))
  }

  const handleCreate = async (data: IOCCreatePayload) => {
    try { await createIoc(data); toast.success(`IOC ajouté`); setShowForm(false) }
    catch { toast.error(`Erreur lors de l'ajout`) }
  }

  const handleUpdate = useCallback(async (data: IOCCreatePayload) => {
    if (!editTarget) return
    try { await updateIoc(editTarget.id, data); toast.success(`IOC mis à jour`); setEditTarget(null) }
    catch { toast.error(`Erreur lors de la mise à jour`) }
  }, [editTarget, updateIoc])

  const handleDelete = async (ioc: IOC) => {
    if (!confirm(`Supprimer ${ioc.type.toUpperCase()} : ${ioc.value} ?`)) return
    try { await deleteIoc(ioc.id); toast.success(`IOC supprimé`) }
    catch { toast.error(`Erreur lors de la suppression`) }
  }

  const handleExport = async () => {
    try { await exportCSV(); toast.success(`Export CSV téléchargé`) }
    catch { toast.error(`Erreur lors de l'export`) }
  }

  const loadCorrelation = async (ioc: IOC) => {
    setCorrelationLoading(true)
    setCorrelationError(null)
    try {
      const result = await correlationApi.correlationByIOCId(ioc.id)
      setCorrelationResult(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de chargement'
      setCorrelationError(msg)
    } finally {
      setCorrelationLoading(false)
    }
  }

  const loadHashAnalysis = async (ioc: IOC) => {
    setHashLoading(true)
    setHashResult(null)
    try {
      const result = await hashApi.hashAnalyze(ioc.value)
      setHashResult(result)
    } catch {
      // silencieux si MalwareBazaar indisponible
    } finally {
      setHashLoading(false)
    }
  }


  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <ShieldBan size={24} className="text-cyber-red" />
            {`IOC Manager`}
          </h1>
          <p className="text-text-muted text-sm mt-1">
            {total} {total > 1 ? `indicateurs de compromission` : `indicateur de compromission`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded text-text-muted hover:text-cyber-cyan hover:border-cyber-cyan transition-colors">
            <Download size={15} /> {`Export CSV`}
          </button>
          <button onClick={() => { setShowForm(true); setEditTarget(null) }} className="flex items-center gap-2 px-3 py-2 text-sm bg-cyber-cyan text-bg-primary font-semibold rounded hover:bg-cyber-cyan/80 transition-colors">
            <Plus size={15} /> {`Ajouter IOC`}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-1 bg-bg-secondary border border-border rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-cyber-cyan">{stats.total}</div>
            <div className="text-xs text-text-muted mt-0.5">{`Total actifs`}</div>
          </div>
          {IOC_TYPES.map((tp) => (
            <div key={tp} className="col-span-1 bg-bg-secondary border border-border rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-text-primary">{stats.by_type[tp] ?? 0}</div>
              <div className="text-xs text-text-muted mt-0.5 flex items-center justify-center gap-1">
                {typeIcon(tp)} {tp.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={(e) => handleSearch(e.target.value)}
            placeholder={`${`Rechercher`}…`}
            className="w-full bg-bg-secondary border border-border rounded pl-9 pr-3 py-2 text-sm text-text-primary focus:outline-none focus:border-cyber-cyan" />
        </div>
        <select value={filter.type ?? ''} onChange={(e) => setFilter({ type: (e.target.value as IOCType) || undefined })}
          className="bg-bg-secondary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-cyber-cyan">
          <option value="">{`Tous les types`}</option>
          {IOC_TYPES.map((tp) => <option key={tp} value={tp}>{tp.toUpperCase()}</option>)}
        </select>
        <select value={filter.tlp ?? ''} onChange={(e) => setFilter({ tlp: (e.target.value as IOCTLP) || undefined })}
          className="bg-bg-secondary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-cyber-cyan">
          <option value="">{`Tous TLP`}</option>
          {TLP_OPTIONS.map((tp) => <option key={tp.value} value={tp.value}>{tp.label}</option>)}
        </select>
        <select value={filter.status ?? 'active'} onChange={(e) => setFilter({ status: (e.target.value as IOCStatus) || undefined })}
          className="bg-bg-secondary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-cyber-cyan">
          <option value="">{`Tous statuts`}</option>
          <option value="active">{`Actif`}</option>
          <option value="archived">{`Archivé`}</option>
          <option value="false_positive">{`Faux positif`}</option>
        </select>
        {(filter.type || filter.tlp || (filter.status && filter.status !== 'active') || filter.q) && (
          <button onClick={() => { setSearch(''); setFilter({ type: undefined, tlp: undefined, status: 'active', q: undefined }) }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-text-muted border border-border rounded hover:text-cyber-red hover:border-cyber-red transition-colors">
            <X size={13} /> {`Réinitialiser`}
          </button>
        )}
      </div>

      <div className="flex gap-6">
        {/* Table */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="text-center py-12 text-text-muted text-sm">{`Chargement…`}</div>
          ) : iocs.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <ShieldBan size={40} className="mx-auto text-text-muted opacity-40" />
              <p className="text-text-muted">{`Aucun IOC trouvé`}</p>
              <button onClick={() => setShowForm(true)} className="text-sm text-cyber-cyan hover:underline">
                {`Ajouter le premier IOC`}
              </button>
            </div>
          ) : (
            <div className="bg-bg-secondary border border-border rounded-lg overflow-hidden">
              {/* Barre d'actions groupées */}
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-cyber-red/10 border-b border-cyber-red/30">
                  <span className="text-sm text-cyber-red font-medium">
                    {selectedIds.size} IOC{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-cyber-red text-white rounded hover:bg-cyber-red/80 disabled:opacity-50 transition-colors"
                  >
                    <Trash2 size={13} />
                    {bulkDeleting ? `Suppression…` : `Supprimer la sélection`}
                  </button>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="text-xs text-text-muted hover:text-text-primary transition-colors"
                  >
                    Tout désélectionner
                  </button>
                </div>
              )}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-text-muted text-xs">
                    <th className="px-4 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => { if (el) el.indeterminate = someSelected }}
                        onChange={handleToggleAll}
                        className="w-4 h-4 rounded border-border accent-cyber-cyan cursor-pointer"
                      />
                    </th>
                    <th className="text-left px-4 py-3 font-medium">{`Type`}</th>
                    <th className="text-left px-4 py-3 font-medium">{`Valeur`}</th>
                    <th className="text-left px-4 py-3 font-medium">{`Source`}</th>
                    <th className="text-left px-4 py-3 font-medium">{`TLP`}</th>
                    <th className="text-left px-4 py-3 font-medium">{`Tags`}</th>
                    <th className="text-left px-4 py-3 font-medium">{`MITRE`}</th>
                    <th className="text-left px-4 py-3 font-medium">{`Statut`}</th>
                    <th className="text-right px-4 py-3 font-medium">{`Actions`}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {iocs.map((ioc) => (
                    <tr key={ioc.id} className={`hover:bg-bg-primary/50 transition-colors group ${selectedIds.has(ioc.id) ? 'bg-cyber-cyan/5' : ''}`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(ioc.id)}
                          onChange={() => handleToggleSelect(ioc.id)}
                          className="w-4 h-4 rounded border-border accent-cyber-cyan cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 font-mono text-xs uppercase text-cyber-cyan">
                          {typeIcon(ioc.type)} {ioc.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[260px]">
                        <span className="font-mono text-xs text-text-primary break-all">{ioc.value}</span>
                      </td>
                      <td className="px-4 py-3 text-text-muted text-xs max-w-[120px] truncate">{ioc.source || '—'}</td>
                      <td className="px-4 py-3">{tlpBadge(ioc.tlp)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {parseTags(ioc.tags).slice(0, 3).map((tag) => (
                            <span key={tag} className="text-xs bg-bg-primary border border-border rounded px-1.5 py-0.5 text-text-muted">{tag}</span>
                          ))}
                          {parseTags(ioc.tags).length > 3 && (
                            <span className="text-xs text-text-muted">+{parseTags(ioc.tags).length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {ioc.mitre_tech_id
                          ? <span className="font-mono text-xs text-cyber-cyan">{ioc.mitre_tech_id}</span>
                          : <span className="text-text-muted text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs ${STATUS_COLORS[ioc.status] ?? 'text-text-muted'}`}>
                          {ioc.status === 'active' ? `Actif`
                            : ioc.status === 'archived' ? `Archivé`
                            : `Faux positif`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setSelectedIOC(ioc); setActiveTab('details'); loadCorrelation(ioc) }}
                            className="p-1.5 rounded hover:bg-cyber-cyan/10 text-text-muted hover:text-cyber-cyan transition-colors" title={`Voir détails`}>
                            <ShieldBan size={13} />
                          </button>
                          <button onClick={() => { setEditTarget(ioc); setShowForm(true) }}
                            className="p-1.5 rounded hover:bg-cyber-cyan/10 text-text-muted hover:text-cyber-cyan transition-colors" title={`Modifier`}>
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => handleDelete(ioc)}
                            className="p-1.5 rounded hover:bg-cyber-red/10 text-text-muted hover:text-cyber-red transition-colors" title={`Supprimer`}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Vue détail */}
        {selectedIOC && (
          <div className="w-[500px] shrink-0 bg-bg-secondary border border-cyber-cyan/30 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                {typeIcon(selectedIOC.type)} IOC #{selectedIOC.id}
              </h2>
              <button onClick={() => setSelectedIOC(null)}
                className="p-1 rounded hover:bg-bg-primary text-text-muted hover:text-text-primary transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Onglets */}
            <div className="flex border-b border-border">
              <button
                onClick={() => setActiveTab('details')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'details'
                    ? 'text-cyber-cyan border-b-2 border-cyber-cyan'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                Détails
              </button>
              <button
                onClick={() => { setActiveTab('correlation'); loadCorrelation(selectedIOC) }}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'correlation'
                    ? 'text-cyber-cyan border-b-2 border-cyber-cyan'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <GitBranch size={14} />
                Corrélation
              </button>
              {selectedIOC.type === 'hash' && (
                <button
                  onClick={() => { setActiveTab('hash_analysis'); loadHashAnalysis(selectedIOC) }}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'hash_analysis'
                      ? 'text-cyber-cyan border-b-2 border-cyber-cyan'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  Analyse Hash
                </button>
              )}
            </div>

            {/* Contenu onglet */}
            <div className="p-4">
              {activeTab === 'details' ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Type</label>
                    <span className="text-sm text-text-primary uppercase">{selectedIOC.type}</span>
                  </div>
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Valeur</label>
                    <span className="text-sm text-text-primary font-mono break-all">{selectedIOC.value}</span>
                  </div>
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Source</label>
                    <span className="text-sm text-text-primary">{selectedIOC.source || '—'}</span>
                  </div>
                  <div>
                    <label className="text-xs text-text-muted block mb-1">TLP</label>
                    {tlpBadge(selectedIOC.tlp)}
                  </div>
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Statut</label>
                    <span className={`text-sm ${STATUS_COLORS[selectedIOC.status] ?? 'text-text-muted'}`}>
                      {selectedIOC.status === 'active' ? 'Actif'
                        : selectedIOC.status === 'archived' ? 'Archivé'
                        : 'Faux positif'}
                    </span>
                  </div>
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Tags</label>
                    <div className="flex flex-wrap gap-1">
                      {parseTags(selectedIOC.tags).map((tag) => (
                        <span key={tag} className="text-xs bg-bg-primary border border-border rounded px-2 py-1 text-text-muted">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Technique MITRE</label>
                    <span className="text-sm text-text-primary">{selectedIOC.mitre_tech_id || '—'}</span>
                  </div>
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Notes</label>
                    <p className="text-sm text-text-primary whitespace-pre-wrap">{selectedIOC.notes || '—'}</p>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => { setEditTarget(selectedIOC); setShowForm(true); setSelectedIOC(null) }}
                      className="flex-1 px-3 py-2 text-sm bg-cyber-cyan text-bg-primary font-semibold rounded hover:bg-cyber-cyan/80 transition-colors">
                      Modifier
                    </button>
                    <button onClick={() => { handleDelete(selectedIOC); setSelectedIOC(null) }}
                      className="px-3 py-2 text-sm border border-cyber-red text-cyber-red rounded hover:bg-cyber-red/10 transition-colors">
                      Supprimer
                    </button>
                  </div>
                </div>
              ) : activeTab === 'correlation' ? (
                <CorrelationPanel
                  result={correlationResult}
                  loading={correlationLoading}
                  error={correlationError}
                />
              ) : (
                <HashAnalysisPanel
                  hashResult={hashResult}
                  hashLoading={hashLoading}
                  onForceRefresh={() => {
                    if (!selectedIOC) return
                    hashApi.deleteCache(selectedIOC.value).finally(() => loadHashAnalysis(selectedIOC))
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modale Creation/Edition */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-secondary border border-border rounded-xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-text-primary">
                {editTarget ? `Modifier IOC` : `Ajouter un IOC`}
              </h2>
              <button onClick={() => { setShowForm(false); setEditTarget(null) }}
                className="p-1 rounded hover:bg-bg-primary text-text-muted hover:text-text-primary transition-colors">
                <X size={18} />
              </button>
            </div>
            <IOCForm
              initial={editTarget ?? undefined}
              onSubmit={editTarget ? handleUpdate : handleCreate}
              onCancel={() => { setShowForm(false); setEditTarget(null) }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
