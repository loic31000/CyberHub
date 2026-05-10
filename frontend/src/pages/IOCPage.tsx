import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useIocStore } from '@/store/useIocStore'
import type { IOC, IOCCreatePayload, IOCType, IOCTLP, IOCStatus } from '@/types/ioc'
import { toast } from '@/store/toast'
import CorrelationPanel from '@/components/CorrelationPanel'
import ImportIOCModal from '@/components/ImportIOCModal'
import { correlationApi, hashApi, iocApi } from '@/api/client'
import type { CorrelationResult } from '@/types/correlation'
import type { HashAnalysisResponse, VirusTotalData, MalwareBazaarData, ThreatFoxData, URLhausData } from '@/types/hash'
import {
  ShieldBan, Plus, Search, Download, X, Trash2, Edit2,
  Globe, Hash, Link, Mail, Network, GitBranch, Loader2, RefreshCw, Shield, FolderOpen,
} from 'lucide-react'

// TLP labels sont standards — pas traduits
const TLP_OPTIONS: { value: IOCTLP; label: string; color: string }[] = [
  { value: 'white', label: 'TLP:WHITE', color: 'border-white/30 bg-white/10 text-white' },
  { value: 'green', label: 'TLP:GREEN', color: 'border-green-500/30 bg-green-500/10 text-green-400' },
  { value: 'amber', label: 'TLP:AMBER', color: 'border-amber-500/30 bg-amber-500/10 text-amber-400' },
  { value: 'red',   label: 'TLP:RED',   color: 'border-red-500/30 bg-red-500/10 text-red-400' },
]

const STATUS_COLORS: Record<IOCStatus, string> = {
  active:         'text-[#10b981]',
  archived:       'text-[#64748b]',
  false_positive: 'text-[#eab308]',
}

const IOC_TYPES: IOCType[] = ['ip', 'domain', 'hash', 'url', 'email']

function tlpBadge(tlp: IOCTLP) {
  const opt = TLP_OPTIONS.find(t => t.value === tlp)
  return opt
    ? <span className={`text-[10px] px-1.5 py-0.5 border font-mono uppercase tracking-wider ${opt.color}`}>{opt.label}</span>
    : null
}

function typeIcon(type: IOCType) {
  const cls = 'text-[#00d4ff]'
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
  catch { return raw.split(',').map(t => t.trim()).filter(Boolean) }
}

function tagsToJSON(input: string): string {
  const tags = input.split(',').map(t => t.trim()).filter(Boolean)
  return tags.length > 0 ? JSON.stringify(tags) : ''
}

// ── Formulaire (stylisé) ─────────────────────────────────────────────────────

interface IOCFormProps {
  initial?: Partial<IOC>
  onSubmit: (data: IOCCreatePayload) => Promise<void>
  onCancel: () => void
}

function IOCForm({ initial, onSubmit, onCancel }: IOCFormProps) {
  const [type, setType] = useState<IOCType>(initial?.type ?? 'ip')
  const [value, setValue] = useState(initial?.value ?? '')
  const [source, setSource] = useState(initial?.source ?? '')
  const [tlp, setTlp] = useState<IOCTLP>(initial?.tlp ?? 'white')
  const [status, setStatus] = useState<IOCStatus>(initial?.status ?? 'active')
  const [tags, setTags] = useState(() => parseTags(initial?.tags ?? '').join(', '))
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [mitre, setMitre] = useState(initial?.mitre_tech_id ?? '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) { toast.error('La valeur est requise'); return }
    setSaving(true)
    try {
      await onSubmit({ type, value: value.trim(), source: source.trim(), tlp, status,
        tags: tagsToJSON(tags), notes: notes.trim(), mitre_tech_id: mitre.trim() })
    } finally { setSaving(false) }
  }

  const inputCls = 'w-full bg-[#0d131f] border border-[#1e2d40] rounded px-3 py-2 font-mono text-sm text-[#f1f5f9] placeholder-[#334155] focus:outline-none focus:border-[#00d4ff]/60'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-3">
        <div className="w-36">
          <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1">TYPE *</label>
          <select value={type} onChange={e => setType(e.target.value as IOCType)} className={inputCls}>
            {IOC_TYPES.map(tp => <option key={tp} value={tp}>{tp.toUpperCase()}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1">VALEUR *</label>
          <input value={value} onChange={e => setValue(e.target.value)}
            placeholder={type === 'hash' ? 'md5/sha256...' : type === 'ip' ? '192.168.1.1' : type}
            className={inputCls} />
        </div>
      </div>
      <div>
        <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1">SOURCE</label>
        <input value={source} onChange={e => setSource(e.target.value)} placeholder="ex: VirusTotal, AbuseIPDB..." className={inputCls} />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1">TLP</label>
          <select value={tlp} onChange={e => setTlp(e.target.value as IOCTLP)} className={inputCls}>
            {TLP_OPTIONS.map(tp => <option key={tp.value} value={tp.value}>{tp.label}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1">STATUT</label>
          <select value={status} onChange={e => setStatus(e.target.value as IOCStatus)} className={inputCls}>
            <option value="active">ACTIF</option>
            <option value="archived">ARCHIVÉ</option>
            <option value="false_positive">FAUX POSITIF</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1">
          TAGS <span className="normal-case">(séparés par virgule)</span>
        </label>
        <input value={tags} onChange={e => setTags(e.target.value)} placeholder="ransomware, c2, apt28..." className={inputCls} />
      </div>
      <div>
        <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1">
          MITRE ATT&CK <span className="normal-case">(optionnel)</span>
        </label>
        <input value={mitre} onChange={e => setMitre(e.target.value)} placeholder="ex: T1046" className={inputCls} />
      </div>
      <div>
        <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1">NOTES</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Contexte, observations..." className={inputCls + ' resize-none'} />
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-xs font-mono border border-[#1e2d40] text-[#64748b] hover:text-[#f1f5f9] transition-colors">
          ANNULER
        </button>
        <button type="submit" disabled={saving} className="px-4 py-2 text-xs font-mono font-bold bg-[#00d4ff] text-[#06080f] rounded hover:bg-[#00d4ff]/80 disabled:opacity-50 transition-colors">
          {saving ? 'SAUVEGARDE...' : initial?.id ? 'METTRE À JOUR' : 'AJOUTER'}
        </button>
      </div>
    </form>
  )
}

// ── HashAnalysisPanel (stylisé) ──────────────────────────────────────────────

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
      <div className="flex items-center gap-2 text-[#64748b] text-sm py-4">
        <Loader2 size={16} className="animate-spin" />
        INTERROGATION DES SOURCES EN COURS...
      </div>
    )
  }

  if (!hashResult) {
    return <p className="text-[#64748b] text-sm py-4">Impossible de contacter les sources d'analyse.</p>
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
    if (status === 'found') return <span className="text-green-400 text-xs">✓ TROUVÉ</span>
    if (status === 'not_found') return <span className="text-[#64748b] text-xs">◌ INCONNU</span>
    if (status === 'skipped') return <span className="text-yellow-400 text-xs">⤳ IGNORÉ</span>
    if (status === 'not_configured') return <span className="text-orange-400 text-xs">⚙ NON CONFIGURÉ</span>
    return <span className="text-red-400 text-xs">✗ ERREUR</span>
  }

  return (
    <div className="space-y-4">
      {/* Résumé */}
      <div className={`border p-4 flex items-start justify-between gap-4 ${
        hashResult.found
          ? 'border-red-500/40 bg-red-500/5'
          : 'border-green-500/30 bg-green-500/5'
      }`}>
        <div className="flex-1">
          {hashResult.found ? (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-red-400 font-mono text-sm animate-pulse">⚠ MALWARE DÉTECTÉ</span>
              {hashResult.best_result && (
                <span className="text-[10px] px-2 py-0.5 border border-red-400/40 text-red-300 bg-red-400/10 font-mono">
                  VIA {hashResult.best_result.source.toUpperCase()}
                </span>
              )}
            </div>
          ) : (
            <p className="text-green-400 font-mono text-sm">✅ HASH PROPRE SUR TOUTES LES SOURCES</p>
          )}
          {threatName && (
            <p className="text-[#f1f5f9] font-mono text-xs mt-1">{threatName}</p>
          )}
          <p className="text-[#64748b] text-xs mt-1 font-mono">{hashResult.hash_type.toUpperCase()} · {hashResult.hash}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hashResult.from_cache && (
            <span className="text-[9px] text-[#64748b] px-2 py-0.5 border border-[#1e2d40] font-mono">🗄 CACHE</span>
          )}
          <button
            onClick={onForceRefresh}
            className="text-[10px] px-2 py-1 border border-[#1e2d40] text-[#64748b] hover:text-[#00d4ff] hover:border-[#00d4ff]/40 transition-colors flex items-center gap-1 font-mono"
          >
            <RefreshCw size={11} /> FORCER MAJ
          </button>
        </div>
      </div>

      {/* VirusTotal */}
      <div className="border border-[#1e2d40] bg-[#0a0f16] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-blue-400" />
            <span className="font-mono font-bold text-sm text-[#f1f5f9]">VirusTotal</span>
            {statusIcon(vtSource?.status ?? 'error')}
          </div>
          {vtData && (
            <div className="flex items-center gap-2">
              <div className={`text-sm font-mono font-bold ${
                vtData.detection_score > 50 ? 'text-red-400' :
                vtData.detection_score > 10 ? 'text-orange-400' : 'text-green-400'
              }`}>
                {vtData.stats.malicious}/{vtData.stats.malicious + vtData.stats.suspicious + vtData.stats.undetected + vtData.stats.harmless} MOTEURS
              </div>
            </div>
          )}
        </div>

        {vtSource?.status === 'not_configured' && (
          <div className="text-center py-3">
            <p className="text-[#64748b] text-sm mb-2">⚙ Clé API VirusTotal non configurée</p>
            <button
              onClick={() => navigate('/settings?section=virustotal')}
              className="text-xs text-[#00d4ff] hover:underline font-mono"
            >
              CONFIGURER DANS PARAMÈTRES →
            </button>
          </div>
        )}

        {vtData && (
          <>
            <div>
              <div className="flex justify-between text-[10px] font-mono text-[#64748b] mb-1">
                <span>SCORE DE DÉTECTION</span>
                <span className={vtData.detection_score > 50 ? 'text-red-400' : vtData.detection_score > 10 ? 'text-orange-400' : 'text-green-400'}>
                  {vtData.detection_score}%
                </span>
              </div>
              <div className="w-full bg-[#1e2d40] h-1.5">
                <div
                  className={`h-1.5 transition-all ${
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
                { label: 'Non détecté', val: vtData.stats.undetected, cls: 'text-[#64748b]' },
                { label: 'Sûr', val: vtData.stats.harmless, cls: 'text-green-400' },
              ].map(s => (
                <div key={s.label} className="bg-[#0d131f] border border-[#1e2d40] p-2">
                  <p className={`text-lg font-mono font-bold ${s.cls}`}>{s.val}</p>
                  <p className="text-[10px] font-mono text-[#64748b]">{s.label}</p>
                </div>
              ))}
            </div>

            {(vtData.threat_label || vtData.meaningful_name || vtData.type_description) && (
              <div className="text-xs space-y-0.5 text-[#64748b] font-mono">
                {vtData.threat_label && <p><span className="text-[#f1f5f9]">Menace :</span> <span className="text-red-300">{vtData.threat_label}</span></p>}
                {vtData.meaningful_name && <p><span className="text-[#f1f5f9]">Fichier :</span> {vtData.meaningful_name}</p>}
                {vtData.type_description && <p><span className="text-[#f1f5f9]">Type :</span> {vtData.type_description}</p>}
                {vtData.first_seen && <p><span className="text-[#f1f5f9]">1ère vue :</span> {new Date(vtData.first_seen).toLocaleDateString('fr-FR')}</p>}
              </div>
            )}

            {maliciousEngines.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-[#64748b] font-medium mb-1">MOTEURS AYANT DÉTECTÉ UNE MENACE :</p>
                <div className="overflow-x-auto max-h-48 overflow-y-auto border border-[#1e2d40]">
                  <table className="w-full text-[11px] font-mono">
                    <thead className="bg-[#0d131f] border-b border-[#1e2d40]">
                      <tr className="text-[#4a6480]">
                        <th className="text-left p-2">MOTEUR</th>
                        <th className="text-left p-2">CATÉGORIE</th>
                        <th className="text-left p-2">RÉSULTAT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {maliciousEngines.map(([engine, r]) => (
                        <tr key={engine} className="border-b border-[#1e2d40]">
                          <td className="p-2 text-[#f1f5f9]">{engine}</td>
                          <td className="p-2">
                            <span className={r.category === 'malicious' ? 'text-red-400' : 'text-orange-400'}>
                              {r.category}
                            </span>
                          </td>
                          <td className="p-2 text-[#8a9ab0] font-mono truncate max-w-[200px]">{r.result}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {Object.keys(vtData.malicious_engines || {}).length > 20 && (
                  <button
                    onClick={() => setShowAllEngines(v => !v)}
                    className="text-[10px] text-[#00d4ff] hover:underline mt-1 font-mono"
                  >
                    {showAllEngines ? 'RÉDUIRE' : `VOIR TOUS LES ${Object.keys(vtData.malicious_engines).length} MOTEURS →`}
                  </button>
                )}
              </div>
            )}

            {vtData.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {vtData.tags.map(t => (
                  <span key={t} className="text-[10px] px-2 py-0.5 border border-[#00d4ff]/30 text-[#00d4ff] font-mono">{t}</span>
                ))}
              </div>
            )}
          </>
        )}

        {vtSource?.status === 'error' && vtSource.error && (
          <p className="text-red-400 text-[11px] font-mono">{vtSource.error}</p>
        )}
        {vtSource?.status === 'not_found' && (
          <p className="text-[#64748b] text-xs font-mono">Hash inconnu de VirusTotal.</p>
        )}
      </div>

      {/* MalwareBazaar / ThreatFox / URLhaus */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* MalwareBazaar */}
        <div className="border border-[#1e2d40] bg-[#0a0f16] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-[#f1f5f9]">MalwareBazaar</span>
            {statusIcon(mbSource?.status ?? 'error')}
          </div>
          {mbData && (
            <div className="text-[11px] font-mono text-[#64748b] space-y-0.5">
              {mbData.file_type && <p><span className="text-[#8a9ab0]">Type :</span> {mbData.file_type}</p>}
              {mbData.signature && <p><span className="text-[#8a9ab0]">Signature :</span> <span className="text-red-300">{mbData.signature}</span></p>}
              {mbData.first_seen && <p><span className="text-[#8a9ab0]">1ère vue :</span> {mbData.first_seen}</p>}
              {mbData.reporter && <p><span className="text-[#8a9ab0]">Reporter :</span> {mbData.reporter}</p>}
              {mbData.tags && mbData.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {mbData.tags.map(t => <span key={t} className="px-1.5 py-0.5 border border-red-400/30 text-red-300 text-[9px]">{t}</span>)}
                </div>
              )}
            </div>
          )}
          {mbSource?.status === 'not_found' && <p className="text-xs text-[#64748b] font-mono">Hash inconnu.</p>}
          {mbSource?.status === 'error' && <p className="text-xs text-red-400 font-mono">{mbSource.error}</p>}
        </div>

        {/* ThreatFox */}
        <div className="border border-[#1e2d40] bg-[#0a0f16] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-[#f1f5f9]">ThreatFox</span>
            {statusIcon(tfSource?.status ?? 'error')}
          </div>
          {tfData && (
            <div className="text-[11px] font-mono text-[#64748b] space-y-0.5">
              {tfData.malware && <p><span className="text-[#8a9ab0]">Malware :</span> <span className="text-red-300">{tfData.malware}</span></p>}
              {tfData.threat_type && <p><span className="text-[#8a9ab0]">Type :</span> {tfData.threat_type}</p>}
              <p><span className="text-[#8a9ab0]">Confiance :</span> {tfData.confidence_level}%</p>
              {tfData.first_seen && <p><span className="text-[#8a9ab0]">1ère vue :</span> {tfData.first_seen}</p>}
            </div>
          )}
          {tfSource?.status === 'not_found' && <p className="text-xs text-[#64748b] font-mono">Hash inconnu.</p>}
          {tfSource?.status === 'error' && <p className="text-xs text-red-400 font-mono">{tfSource.error}</p>}
        </div>

        {/* URLhaus */}
        <div className="border border-[#1e2d40] bg-[#0a0f16] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-[#f1f5f9]">URLhaus</span>
            {statusIcon(uhSource?.status ?? 'error')}
          </div>
          {uhData && (
            <div className="text-[11px] font-mono text-[#64748b] space-y-0.5">
              {uhData.file_type && <p><span className="text-[#8a9ab0]">Type :</span> {uhData.file_type}</p>}
              {uhData.signature && <p><span className="text-[#8a9ab0]">Signature :</span> {uhData.signature}</p>}
              <p><span className="text-[#8a9ab0]">URLs associées :</span> {uhData.urls_count}</p>
              {uhData.urlhaus_reference && (
                <a href={uhData.urlhaus_reference} target="_blank" rel="noreferrer" className="text-[#00d4ff] hover:underline">Voir sur URLhaus →</a>
              )}
            </div>
          )}
          {uhSource?.status === 'skipped' && <p className="text-xs text-[#64748b] font-mono">Non applicable pour les hash MD5 (SHA256 requis).</p>}
          {uhSource?.status === 'not_found' && <p className="text-xs text-[#64748b] font-mono">Hash inconnu.</p>}
          {uhSource?.status === 'error' && <p className="text-xs text-red-400 font-mono">{uhSource.error}</p>}
        </div>
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function IOCPage() {
  const {
    iocs, total, loading, stats, filter,
    fetchIocs, fetchStats, setFilter,
    deleteIoc, exportCSV,
  } = useIocStore()

  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editTarget, setEditTarget] = useState<IOC | null>(null)
  const [search, setSearch] = useState('')
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null)

  // Sélection multiple
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const allSelected = iocs.length > 0 && iocs.every(ioc => selectedIds.has(ioc.id))
  const someSelected = !allSelected && iocs.some(ioc => selectedIds.has(ioc.id))

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
    if (isNaN(id)) return
    iocApi.get(id).then(ioc => setSelectedIOC(ioc)).catch(() => {})
  }, [searchParams])

  useEffect(() => { fetchIocs(); fetchStats() }, [])

  const handleSearch = (v: string) => {
    setSearch(v)
    setSelectedIds(new Set())
    if (searchTimeout) clearTimeout(searchTimeout)
    setSearchTimeout(setTimeout(() => setFilter({ q: v || undefined }), 350))
  }

  const handleDelete = async (ioc: IOC) => {
    if (!confirm(`Supprimer ${ioc.type.toUpperCase()} : ${ioc.value} ?`)) return
    try { await deleteIoc(ioc.id); toast.success('IOC supprimé') }
    catch { toast.error('Erreur lors de la suppression') }
  }

  const handleExport = async () => {
    try { await exportCSV(); toast.success('Export CSV téléchargé') }
    catch { toast.error('Erreur lors de l\'export') }
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
    } catch { /* silencieux */ }
    finally { setHashLoading(false) }
  }

  const handleToggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleToggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(iocs.map(ioc => ioc.id)))
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

  return (
    <div className="flex flex-col h-full bg-[#06080f] text-[#f1f5f9]">
      {/* Bandeau d'en-tête style BGPLookup */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d40] bg-[#0a0f16]/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <ShieldBan className="text-[#00d4ff]" size={20} />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#10b981] rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase">IOC MANAGER // INDEX</h1>
            <p className="text-[10px] text-[#64748b] font-mono">
              {total} indicateur{total > 1 ? 's' : ''} de compromission
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px]">
          <span className="text-[#64748b]">STATUS</span>
          <span className="text-[#10b981]">ACTIVE</span>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2d40] hover:bg-[#2a3f55] text-[10px] font-bold border border-[#334155] transition-colors"
          >
            <Download size={12} /> EXPORT CSV
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2d40] hover:bg-[#2a3f55] text-[10px] font-bold border border-[#334155] transition-colors"
          >
            <FolderOpen size={12} /> IMPORT CSV/TXT
          </button>
          <button
            onClick={() => { setShowForm(true); setEditTarget(null) }}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2d40] hover:bg-[#2a3f55] text-[10px] font-bold border border-[#334155] transition-colors"
          >
            <Plus size={12} /> NEW IOC
          </button>
        </div>
      </div>

      {/* Zone de contenu scrollable */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Barre de statistiques par type */}
        {stats && (
          <div className="grid grid-cols-5 gap-3">
            {IOC_TYPES.map(tp => (
              <div key={tp} className="border border-[#1e2d40] bg-[#0a0f16] p-3 text-center">
                <div className="text-2xl font-mono font-bold text-[#00d4ff]">{stats.by_type[tp] ?? 0}</div>
                <div className="text-[10px] font-mono text-[#64748b] uppercase tracking-wider flex items-center justify-center gap-1 mt-1">
                  {typeIcon(tp)} {tp}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filtres */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a6480]" />
            <input
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Rechercher un IOC…"
              className="w-full bg-[#0d131f] border border-[#1e2d40] pl-9 pr-3 py-2 font-mono text-sm text-[#f1f5f9] placeholder-[#2a3f55] focus:outline-none focus:border-[#00d4ff]/40"
            />
          </div>
          <select
            value={filter.type ?? ''}
            onChange={e => setFilter({ type: (e.target.value as IOCType) || undefined })}
            className="bg-[#0d131f] border border-[#1e2d40] px-3 py-2 font-mono text-sm text-[#f1f5f9] focus:outline-none focus:border-[#00d4ff]/40"
          >
            <option value="">TOUS LES TYPES</option>
            {IOC_TYPES.map(tp => <option key={tp} value={tp}>{tp.toUpperCase()}</option>)}
          </select>
          <select
            value={filter.tlp ?? ''}
            onChange={e => setFilter({ tlp: (e.target.value as IOCTLP) || undefined })}
            className="bg-[#0d131f] border border-[#1e2d40] px-3 py-2 font-mono text-sm text-[#f1f5f9] focus:outline-none focus:border-[#00d4ff]/40"
          >
            <option value="">TOUS TLP</option>
            {TLP_OPTIONS.map(tp => <option key={tp.value} value={tp.value}>{tp.label}</option>)}
          </select>
          <select
            value={filter.status ?? 'active'}
            onChange={e => setFilter({ status: (e.target.value as IOCStatus) || undefined })}
            className="bg-[#0d131f] border border-[#1e2d40] px-3 py-2 font-mono text-sm text-[#f1f5f9] focus:outline-none focus:border-[#00d4ff]/40"
          >
            <option value="">TOUS STATUTS</option>
            <option value="active">ACTIF</option>
            <option value="archived">ARCHIVÉ</option>
            <option value="false_positive">FAUX POSITIF</option>
          </select>
          {(filter.type || filter.tlp || (filter.status && filter.status !== 'active') || filter.q) && (
            <button
              onClick={() => { setSearch(''); setFilter({ type: undefined, tlp: undefined, status: 'active', q: undefined }) }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-mono border border-[#1e2d40] text-[#64748b] hover:border-red-500/40 hover:text-red-400 transition-colors"
            >
              <X size={13} /> RÉINITIALISER
            </button>
          )}
        </div>

        <div className="flex gap-6">
          {/* Tableau des IOC */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="text-center py-12 text-[#64748b] font-mono text-sm">CHARGEMENT...</div>
            ) : iocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center border border-[#1e2d40] bg-[#0a0f16] py-24 text-center">
                <ShieldBan size={40} className="mb-4 text-[#1e2d40]" />
                <p className="font-mono text-sm uppercase tracking-widest text-[#64748b]">AUCUN IOC TROUVÉ</p>
                <button onClick={() => setShowForm(true)} className="mt-2 font-mono text-xs text-[#00d4ff] hover:underline">
                  AJOUTER LE PREMIER IOC
                </button>
              </div>
            ) : (
              <div className="border border-[#1e2d40] bg-[#0a0f16] overflow-x-auto">
                {/* Barre d'actions groupées */}
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-red-500/10 border-b border-red-500/30">
                    <span className="text-sm font-mono text-red-400 font-bold">
                      {selectedIds.size} IOC{selectedIds.size > 1 ? 's' : ''} SÉLECTIONNÉ{selectedIds.size > 1 ? 'S' : ''}
                    </span>
                    <button
                      onClick={handleBulkDelete}
                      disabled={bulkDeleting}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold bg-red-500 text-white rounded hover:bg-red-500/80 disabled:opacity-50 transition-colors"
                    >
                      <Trash2 size={13} />
                      {bulkDeleting ? 'SUPPRESSION...' : 'SUPPRIMER LA SÉLECTION'}
                    </button>
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="text-xs font-mono text-[#64748b] hover:text-[#f1f5f9] transition-colors"
                    >
                      TOUT DÉSÉLECTIONNER
                    </button>
                  </div>
                )}
                <table className="w-full text-sm font-mono">
                  <thead>
                    <tr className="border-b border-[#1e2d40] text-[10px] text-[#4a6480] uppercase tracking-wider">
                      <th className="px-4 py-3 w-8">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={el => { if (el) el.indeterminate = someSelected }}
                          onChange={handleToggleAll}
                          className="w-4 h-4 rounded border-[#1e2d40] accent-[#00d4ff] cursor-pointer"
                        />
                      </th>
                      <th className="text-left px-4 py-3">TYPE</th>
                      <th className="text-left px-4 py-3">VALEUR</th>
                      <th className="text-left px-4 py-3">TLP</th>
                      <th className="text-left px-4 py-3">TAGS</th>
                      <th className="text-left px-4 py-3">STATUT</th>
                      <th className="text-right px-4 py-3">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2d40]">
                    {iocs.map(ioc => (
                      <tr key={ioc.id} className={`hover:bg-[#0d131f]/70 transition-colors group ${selectedIds.has(ioc.id) ? 'bg-[#00d4ff]/5' : ''}`}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(ioc.id)}
                            onChange={() => handleToggleSelect(ioc.id)}
                            className="w-4 h-4 rounded border-[#1e2d40] accent-[#00d4ff] cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 text-xs uppercase text-[#00d4ff]">
                            {typeIcon(ioc.type)} {ioc.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-[320px] break-all font-mono text-xs text-[#f1f5f9]">{ioc.value}</td>
                        <td className="px-4 py-3">{tlpBadge(ioc.tlp)}</td>
                        <td className="px-4 py-3">
                          {parseTags(ioc.tags).length > 0
                            ? <span className="text-[10px] font-mono text-[#64748b] border border-[#1e2d40] px-1.5 py-0.5">{parseTags(ioc.tags).length} tag{parseTags(ioc.tags).length > 1 ? 's' : ''}</span>
                            : <span className="text-[10px] text-[#2a3f55]">—</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          {ioc.status !== 'active' && (
                            <span className={`text-xs ${STATUS_COLORS[ioc.status] ?? 'text-[#64748b]'}`}>
                              {ioc.status === 'archived' ? 'ARCHIVÉ' : 'FAUX POSITIF'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setSelectedIOC(ioc); setActiveTab('details'); loadCorrelation(ioc) }}
                              className="p-1.5 rounded hover:bg-[#00d4ff]/10 text-[#64748b] hover:text-[#00d4ff] transition-colors" title="Voir détails">
                              <ShieldBan size={13} />
                            </button>
                            <button onClick={() => { setEditTarget(ioc); setShowForm(true) }}
                              className="p-1.5 rounded hover:bg-[#00d4ff]/10 text-[#64748b] hover:text-[#00d4ff] transition-colors" title="Modifier">
                              <Edit2 size={13} />
                            </button>
                            <button onClick={() => handleDelete(ioc)}
                              className="p-1.5 rounded hover:bg-red-500/10 text-[#64748b] hover:text-red-400 transition-colors" title="Supprimer">
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

          {/* Panneau latéral de détail */}
          {selectedIOC && (
            <div className="w-[500px] shrink-0 border border-[#00d4ff]/30 bg-[#0a0f16] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-[#1e2d40]">
                <h2 className="text-sm font-mono font-bold text-[#f1f5f9] flex items-center gap-2">
                  {typeIcon(selectedIOC.type)} IOC #{selectedIOC.id}
                </h2>
                <button onClick={() => setSelectedIOC(null)}
                  className="p-1 rounded hover:bg-[#1e2d40] text-[#64748b] hover:text-[#f1f5f9] transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* Onglets */}
              <div className="flex border-b border-[#1e2d40]">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`flex-1 px-4 py-3 text-xs font-mono font-bold uppercase tracking-wider transition-colors ${
                    activeTab === 'details'
                      ? 'text-[#00d4ff] border-b-2 border-[#00d4ff]'
                      : 'text-[#64748b] hover:text-[#f1f5f9]'
                  }`}
                >
                  DÉTAILS
                </button>
                <button
                  onClick={() => { setActiveTab('correlation'); loadCorrelation(selectedIOC) }}
                  className={`flex-1 px-4 py-3 text-xs font-mono font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${
                    activeTab === 'correlation'
                      ? 'text-[#00d4ff] border-b-2 border-[#00d4ff]'
                      : 'text-[#64748b] hover:text-[#f1f5f9]'
                  }`}
                >
                  <GitBranch size={12} /> CORRÉLATION
                </button>
                {selectedIOC.type === 'hash' && (
                  <button
                    onClick={() => { setActiveTab('hash_analysis'); loadHashAnalysis(selectedIOC) }}
                    className={`flex-1 px-4 py-3 text-xs font-mono font-bold uppercase tracking-wider transition-colors ${
                      activeTab === 'hash_analysis'
                        ? 'text-[#00d4ff] border-b-2 border-[#00d4ff]'
                        : 'text-[#64748b] hover:text-[#f1f5f9]'
                    }`}
                  >
                    ANALYSE HASH
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {activeTab === 'details' ? (
                  <>
                    {/* Carte 1 — Identité */}
                    <div className="border border-[#1e2d40] bg-[#0d131f]/60 rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1.5">TYPE</label>
                          <span className="text-sm font-mono text-[#00d4ff] uppercase flex items-center gap-1.5">
                            {typeIcon(selectedIOC.type)} {selectedIOC.type}
                          </span>
                        </div>
                        <div className="text-right">
                          <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1.5">TLP</label>
                          {tlpBadge(selectedIOC.tlp)}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1.5">VALEUR</label>
                        <p className="text-sm font-mono text-[#f1f5f9] break-all leading-relaxed">{selectedIOC.value}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#1e2d40]">
                        <div>
                          <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1.5">SOURCE</label>
                          <span className="text-xs font-mono text-[#f1f5f9]">{selectedIOC.source || '—'}</span>
                        </div>
                        <div>
                          <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1.5">STATUT</label>
                          <span className={`text-xs font-mono ${STATUS_COLORS[selectedIOC.status] ?? 'text-[#64748b]'}`}>
                            {selectedIOC.status === 'active' ? 'ACTIF'
                              : selectedIOC.status === 'archived' ? 'ARCHIVÉ'
                              : 'FAUX POSITIF'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Carte 2 — Classification */}
                    <div className="border border-[#1e2d40] bg-[#0d131f]/60 rounded-lg p-4 space-y-3">
                      <div>
                        <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-2">TAGS</label>
                        {parseTags(selectedIOC.tags).length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {parseTags(selectedIOC.tags).map(tag => (
                              <span key={tag} className="text-[10px] bg-[#0d131f] border border-[#1e2d40] px-2 py-1 text-[#64748b] font-mono">{tag}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs font-mono text-[#2a3f55]">—</span>
                        )}
                      </div>
                      <div className="pt-3 border-t border-[#1e2d40]">
                        <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-1.5">MITRE ATT&CK</label>
                        <span className={`text-sm font-mono ${selectedIOC.mitre_tech_id ? 'text-[#00d4ff]' : 'text-[#2a3f55]'}`}>
                          {selectedIOC.mitre_tech_id || '—'}
                        </span>
                      </div>
                    </div>

                    {/* Carte 3 — Notes */}
                    <div className={`border rounded-lg p-4 ${selectedIOC.notes ? 'border-[#1e2d40] bg-[#0d131f]/60' : 'border-[#1e2d40]/40'}`}>
                      <label className="text-[10px] font-mono text-[#4a6480] uppercase tracking-wider block mb-2">NOTES</label>
                      {selectedIOC.notes
                        ? <p className="text-sm font-mono text-[#cbd5e1] whitespace-pre-wrap leading-relaxed">{selectedIOC.notes}</p>
                        : <p className="text-xs font-mono text-[#2a3f55]">—</p>
                      }
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => { setEditTarget(selectedIOC); setShowForm(true); setSelectedIOC(null) }}
                        className="flex-1 px-3 py-2.5 text-xs font-mono font-bold bg-[#00d4ff] text-[#06080f] rounded hover:bg-[#00d4ff]/80 transition-colors">
                        MODIFIER
                      </button>
                      <button onClick={() => { handleDelete(selectedIOC); setSelectedIOC(null) }}
                        className="px-3 py-2.5 text-xs font-mono border border-red-500 text-red-400 rounded hover:bg-red-500/10 transition-colors">
                        SUPPRIMER
                      </button>
                    </div>
                  </>
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
      </div>

      {/* Modal Import IOC */}
      <ImportIOCModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => { fetchIocs(); fetchStats() }}
      />

      {/* Modale formulaire (création / édition) */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0a0f16] border border-[#1e2d40] p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-mono font-bold uppercase tracking-wider text-[#f1f5f9]">
                {editTarget ? 'MODIFIER L\'IOC' : 'NOUVEL IOC'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditTarget(null) }}
                className="p-1 rounded hover:bg-[#1e2d40] text-[#64748b] hover:text-[#f1f5f9] transition-colors">
                <X size={18} />
              </button>
            </div>
            <IOCForm
              initial={editTarget ?? undefined}
              onSubmit={async (data) => {
                if (editTarget?.id) {
                  await iocApi.update(editTarget.id, data)
                  toast.success('IOC mis à jour')
                } else {
                  await iocApi.create(data)
                  toast.success('IOC ajouté')
                }
                setShowForm(false)
                setEditTarget(null)
                fetchIocs()
                fetchStats()
              }}
              onCancel={() => { setShowForm(false); setEditTarget(null) }}
            />
          </div>
        </div>
      )}
    </div>
  )
}