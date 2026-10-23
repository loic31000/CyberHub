import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useIocStore } from '@/store/useIocStore'
import type { IOC, IOCCreatePayload, IOCType, IOCTLP, IOCStatus } from '@/types/ioc'
import { toast } from '@/store/toast'
import CorrelationPanel, { IocCorrelationSummary } from '@/components/CorrelationPanel'
import ImportIOCModal from '@/components/ImportIOCModal'
import { Dialog } from '@/mitre/MitreUi'
import { ModuleHero } from '@/hero/ModuleHero'
import IocMotif from '@/ioc26/IocMotif'
import { IocDisplaySettings, useIocDensity } from '@/ioc26/IocPreferences'
import IntelligenceMap from '@/ioc26/IntelligenceMap'
import { prepareIntelligenceData } from '@/ioc26/intelligenceData'
import '@/ioc26/ioc.css'
import { correlationApi, hashApi, iocApi } from '@/api/client'
import type { CorrelationResult } from '@/types/correlation'
import type { HashAnalysisResponse, VirusTotalData, MalwareBazaarData, ThreatFoxData, URLhausData } from '@/types/hash'
import {
  ShieldBan, Plus, Search, Download, X, Trash2, Edit2, Copy, SlidersHorizontal,
  Globe, Hash, Link, Mail, Network, GitBranch, Loader2, RefreshCw, Shield, FolderOpen, Maximize2,
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

const IOC_TYPES: IOCType[] = ['ip', 'domain', 'hash', 'url', 'email', 'cidr']

function tlpBadge(tlp: IOCTLP) {
  const opt = TLP_OPTIONS.find(t => t.value === tlp)
  return opt
    ? <span className={`ioc26-tlp border font-mono uppercase ${opt.color}`}>{opt.label}</span>
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
    case 'cidr':   return <Network size={14} className={cls} />
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

function formatIocDate(value: string): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
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
  const [submitError, setSubmitError] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    if (!value.trim()) { toast.error('La valeur est requise'); return }
    setSubmitError(false)
    setSaving(true)
    try {
      await onSubmit({ type, value: value.trim(), source: source.trim(), tlp, status,
        tags: tagsToJSON(tags), notes: notes.trim(), mitre_tech_id: mitre.trim() })
    } catch {
      setSubmitError(true)
      toast.error('Impossible de sauvegarder cet IOC')
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="ioc26-form">
      <p className="ioc26-dialog-description">{initial?.id ? 'Mettre à jour cet indicateur et sa classification.' : 'Ajouter un indicateur à l’index local.'} <span>Les champs marqués * sont obligatoires.</span></p>
      <div className="ioc26-form-grid ioc26-form-primary">
        <div className="ioc26-field">
          <label htmlFor="ioc-form-type">Type d’indicateur <span aria-hidden="true">*</span></label>
          <select id="ioc-form-type" value={type} onChange={e => setType(e.target.value as IOCType)} required>
            {IOC_TYPES.map(tp => <option key={tp} value={tp}>{tp.toUpperCase()}</option>)}
          </select>
        </div>
        <div className="ioc26-field">
          <label htmlFor="ioc-form-value">Valeur <span aria-hidden="true">*</span></label>
          <input id="ioc-form-value" value={value} onChange={e => setValue(e.target.value)} required
            placeholder={type === 'hash' ? 'md5/sha256...' : type === 'ip' ? '192.168.1.1' : type}
          />
        </div>
      </div>
      <div className="ioc26-field">
        <label htmlFor="ioc-form-source">Source</label>
        <input id="ioc-form-source" value={source} onChange={e => setSource(e.target.value)} placeholder="Ex. : VirusTotal, AbuseIPDB…" />
      </div>
      <div className="ioc26-form-grid">
        <div className="ioc26-field">
          <label htmlFor="ioc-form-tlp">Classification TLP</label>
          <select id="ioc-form-tlp" value={tlp} onChange={e => setTlp(e.target.value as IOCTLP)}>
            {TLP_OPTIONS.map(tp => <option key={tp.value} value={tp.value}>{tp.label}</option>)}
          </select>
        </div>
        <div className="ioc26-field">
          <label htmlFor="ioc-form-status">Statut</label>
          <select id="ioc-form-status" value={status} onChange={e => setStatus(e.target.value as IOCStatus)}>
            <option value="active">ACTIF</option>
            <option value="archived">ARCHIVÉ</option>
            <option value="false_positive">FAUX POSITIF</option>
          </select>
        </div>
      </div>
      <div className="ioc26-form-grid">
        <div className="ioc26-field">
          <label htmlFor="ioc-form-tags">Tags <span className="ioc26-field-hint">séparés par virgule</span></label>
          <input id="ioc-form-tags" value={tags} onChange={e => setTags(e.target.value)} placeholder="ransomware, c2, apt28…" />
        </div>
        <div className="ioc26-field">
          <label htmlFor="ioc-form-mitre">Référence MITRE ATT&CK</label>
          <input id="ioc-form-mitre" value={mitre} onChange={e => setMitre(e.target.value)} placeholder="Ex. : T1046" />
        </div>
      </div>
      <div className="ioc26-field">
        <label htmlFor="ioc-form-notes">Notes</label>
        <textarea id="ioc-form-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Contexte, observations…" />
      </div>
      {submitError && <p className="ioc26-form-error" role="alert">Enregistrement impossible. Vérifiez la connexion au service, puis réessayez.</p>}
      <div className="ioc26-dialog-actions">
        <button type="button" onClick={onCancel} className="ioc26-btn" disabled={saving}>
          Annuler
        </button>
        <button type="submit" disabled={saving} className="ioc26-btn is-primary">
          {saving && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
          {saving ? 'Enregistrement…' : initial?.id ? 'Enregistrer les modifications' : 'Ajouter l’IOC'}
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
  const checkedSources = sources.filter(s => s.status === 'found' || s.status === 'not_found').length
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
          : checkedSources ? 'border-green-500/30 bg-green-500/5' : 'border-amber-500/30 bg-amber-500/5'
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
            <p className={checkedSources ? 'text-green-400 font-mono text-sm' : 'text-amber-300 font-mono text-sm'}>
              {checkedSources ? `Aucune correspondance dans ${checkedSources} source${checkedSources > 1 ? 's' : ''} consultée${checkedSources > 1 ? 's' : ''}` : 'Analyse non concluante : aucune source disponible'}
            </p>
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
            className="text-[10px] px-2 py-1 border border-[#1e2d40] text-[#64748b] hover:text-[#00d4ff] hover:border-[#00d4ff]/40 transition-colors flex items-center gap-1 font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]"
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
  const [density, setDensity] = useIocDensity()
  const {
    iocs, total, page, limit, loading, error, stats, filter,
    fetchIocs, fetchStats, setFilter, setPage,
    deleteIoc, exportCSV,
  } = useIocStore()

  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editTarget, setEditTarget] = useState<IOC | null>(null)
  const [search, setSearch] = useState(filter.q ?? '')
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const detailOpener = useRef<HTMLElement | null>(null)
  const detailClose = useRef<HTMLButtonElement>(null)
  const analysisModeButton = useRef<HTMLButtonElement>(null)
  const [deepAnalysis, setDeepAnalysis] = useState(false)
  const [analysisView, setAnalysisView] = useState<'map' | 'list'>('map')

  // Sélection multiple
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<IOC | null>(null)

  const allSelected = iocs.length > 0 && iocs.every(ioc => selectedIds.has(ioc.id))
  const someSelected = !allSelected && iocs.some(ioc => selectedIds.has(ioc.id))

  // Vue détail
  const [selectedIOC, setSelectedIOC] = useState<IOC | null>(null)
  const [correlationResult, setCorrelationResult] = useState<CorrelationResult | null>(null)
  const intelligenceData = useMemo(() => correlationResult ? prepareIntelligenceData(correlationResult) : null, [correlationResult])
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
    // Back from MITRE: the investigation comes back as it was left (deep analysis, open group).
    const deep = searchParams.get('analysis') === 'deep'
    iocApi.get(id).then(ioc => {
      setSelectedIOC(ioc)
      setActiveTab('details')
      if (deep) { setDeepAnalysis(true); loadCorrelation(ioc) }
    }).catch(() => {})
  }, [searchParams])
  const restoredGroup = searchParams.get('group')

  useEffect(() => { fetchIocs(); fetchStats() }, [])
  // Une recherche différée encore en attente ne doit pas partir après avoir quitté la page.
  useEffect(() => () => { if (searchTimeout) clearTimeout(searchTimeout) }, [searchTimeout])

  const handleSearch = (v: string) => {
    setSearch(v)
    setSelectedIds(new Set())
    if (searchTimeout) clearTimeout(searchTimeout)
    setSearchTimeout(setTimeout(() => setFilter({ q: v || undefined }), 350))
  }
  const resetFilters = () => {
    if (searchTimeout) clearTimeout(searchTimeout)
    setSearch('')
    setFilter({ type: undefined, tlp: undefined, status: 'active', q: undefined })
  }

  const handleDelete = (ioc: IOC) => setDeleteTarget(ioc)
  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteIoc(deleteTarget.id)
      if (selectedIOC?.id === deleteTarget.id) setSelectedIOC(null)
      setDeleteTarget(null)
      toast.success('IOC supprimé')
    } catch { toast.error('Erreur lors de la suppression') }
  }

  const openDetail = (ioc: IOC) => {
    detailOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSelectedIOC(ioc)
    setActiveTab('details')
    loadCorrelation(ioc)
  }
  const closeDetail = () => {
    setSelectedIOC(null)
    setDeepAnalysis(false)
    const opener = detailOpener.current
    window.setTimeout(() => { if (opener?.isConnected) opener.focus() }, 0)
  }
  useEffect(() => {
    if (!selectedIOC) return
    detailClose.current?.focus()
  }, [selectedIOC?.id])
  useEffect(() => {
    if (!selectedIOC) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (deepAnalysis) { setDeepAnalysis(false); requestAnimationFrame(() => analysisModeButton.current?.focus()) }
      else closeDetail()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedIOC?.id, deepAnalysis])

  const copyValue = async (value: string) => {
    try { await navigator.clipboard.writeText(value); toast.success('Valeur copiée') }
    catch { toast.error('Impossible de copier la valeur') }
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
    setBulkDeleting(true)
    let errors = 0
    for (const id of Array.from(selectedIds)) {
      try { await deleteIoc(id) } catch { errors++ }
    }
    setBulkDeleting(false)
    setConfirmBulk(false)
    setSelectedIds(new Set())
    if (errors === 0) toast.success(`${count} IOC${count > 1 ? 's' : ''} supprimé${count > 1 ? 's' : ''}`)
    else toast.error(`${errors} erreur(s) lors de la suppression`)
  }

  return (
    <div className="ioc26" data-density={density}>
      <div className="ioc26-top">
        <ModuleHero breadcrumb="OPS / IOC MANAGER" title="IOC" accent="MANAGER" typeOnce="ioc"
          subtitle="Rechercher, classer et gérer les indicateurs de compromission."
          motif={<IocMotif />}
          index={{ label: 'OPS / 2026', lines: ['INDICATEURS', 'CLASSIFICATION TLP', 'CORRÉLATION & ANALYSE'],
            status: stats ? { text: `${stats.total.toLocaleString('fr-FR')} IOC`, mark: 'INDEX LOCAL' } : undefined }} />
        <div className="ioc26-actions" aria-label="Actions IOC Manager">
          <span className="ioc26-total">{total.toLocaleString('fr-FR')} résultat{total > 1 ? 's' : ''}</span>
          <button type="button" onClick={handleExport} className="ioc26-btn"><Download size={15} />Exporter CSV</button>
          <button type="button" onClick={() => setShowImport(true)} className="ioc26-btn"><FolderOpen size={15} />Importer CSV/TXT</button>
          <IocDisplaySettings density={density} onChange={setDensity} />
          <button type="button" onClick={() => { setShowForm(true); setEditTarget(null) }} className="ioc26-btn is-primary"><Plus size={16} />Ajouter un IOC</button>
        </div>
      </div>

      {/* Zone de contenu scrollable */}
      <div className="ioc26-content">
        <div className={`ioc26-investigation${selectedIOC ? ' has-inspector' : ''}${deepAnalysis ? ' is-deep' : ''}`}>
        <div className="ioc26-left">
        {/* Barre de statistiques par type */}
        {stats && (
          <div className="ioc26-stats" aria-label="Indicateurs par type">
            {IOC_TYPES.map(tp => (
              <div key={tp} className="ioc26-stat">
                {typeIcon(tp)}<span>{tp.toUpperCase()}</span><strong>{stats.by_type[tp] ?? 0}</strong>
              </div>
            ))}
          </div>
        )}

        {/* Filtres */}
        <div className="ioc26-filterbox">
          <div className="ioc26-searchrow">
          <div className="ioc26-search">
            <Search size={16} aria-hidden="true" />
            <label htmlFor="ioc26-search" className="ioc26-sr">Rechercher un IOC</label>
            <input
              id="ioc26-search" type="search"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Rechercher une IP, un domaine, une URL, un hash…"
            />
          </div>
          <button type="button" className="ioc26-btn" aria-expanded={filtersOpen} aria-controls="ioc26-advanced"
            onClick={() => setFiltersOpen(v => !v)}>
            <SlidersHorizontal size={15} aria-hidden="true" />Filtres
          </button>
          </div>
          {!filtersOpen && <div className="ioc26-active-filters" aria-label="Filtres actifs">
            {filter.type && <button type="button" onClick={() => setFilter({ type: undefined })}>Type : {filter.type.toUpperCase()}<X size={12} /></button>}
            {filter.tlp && <button type="button" onClick={() => setFilter({ tlp: undefined })}>TLP : {filter.tlp.toUpperCase()}<X size={12} /></button>}
            {filter.status && <button type="button" onClick={() => setFilter({ status: undefined })}>Statut : {filter.status === 'active' ? 'Actif' : filter.status === 'archived' ? 'Archivé' : 'Faux positif'}<X size={12} /></button>}
            {(filter.type || filter.tlp || filter.status !== 'active' || filter.q) && <button type="button" className="ioc26-clear" onClick={resetFilters}>Réinitialiser</button>}
          </div>}
          <div id="ioc26-advanced" className="ioc26-advanced" hidden={!filtersOpen}>
          <label>Type
          <select
            value={filter.type ?? ''}
            onChange={e => setFilter({ type: (e.target.value as IOCType) || undefined })}
          >
            <option value="">TOUS LES TYPES</option>
            {IOC_TYPES.map(tp => <option key={tp} value={tp}>{tp.toUpperCase()}</option>)}
          </select>
          </label>
          <label>Classification TLP
          <select
            value={filter.tlp ?? ''}
            onChange={e => setFilter({ tlp: (e.target.value as IOCTLP) || undefined })}
          >
            <option value="">TOUS TLP</option>
            {TLP_OPTIONS.map(tp => <option key={tp.value} value={tp.value}>{tp.label}</option>)}
          </select>
          </label>
          <label>Statut
          <select
            value={filter.status ?? ''}
            onChange={e => setFilter({ status: (e.target.value as IOCStatus) || undefined })}
          >
            <option value="">TOUS STATUTS</option>
            <option value="active">ACTIF</option>
            <option value="archived">ARCHIVÉ</option>
            <option value="false_positive">FAUX POSITIF</option>
          </select>
          </label>
          <button type="button" onClick={resetFilters} className="ioc26-btn"><X size={14} />Réinitialiser les filtres</button>
          </div>
        </div>

          {/* Tableau des IOC */}
          <div className="ioc26-list">
            {error ? (
              <div className="ioc26-state" role="alert"><ShieldBan size={26} /><strong>Impossible de charger les IOC</strong><p>Vérifiez la connexion au service puis réessayez.</p><button type="button" className="ioc26-btn" onClick={fetchIocs}><RefreshCw size={14} />Réessayer</button></div>
            ) : loading ? (
              <div className="ioc26-state" role="status"><Loader2 size={22} className="animate-spin" />Chargement des indicateurs…</div>
            ) : iocs.length === 0 ? (
              <div className="ioc26-state">
                <ShieldBan size={30} /><strong>Aucun IOC trouvé</strong>
                <p>{filter.q || filter.type || filter.tlp || filter.status !== 'active' ? 'Modifiez vos critères pour élargir la recherche.' : 'Ajoutez un indicateur pour commencer.'}</p>
                <button type="button" onClick={() => { setEditTarget(null); setShowForm(true) }} className="ioc26-btn is-primary"><Plus size={14} />Ajouter un IOC</button>
              </div>
            ) : (
              <div className="ioc26-table-wrap">
                {/* Barre d'actions groupées */}
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-red-500/10 border-b border-red-500/30">
                    <span className="text-sm font-mono text-red-400 font-bold">
                      {selectedIds.size} IOC{selectedIds.size > 1 ? 's' : ''} SÉLECTIONNÉ{selectedIds.size > 1 ? 'S' : ''}
                    </span>
                    <button
                      onClick={() => setConfirmBulk(true)}
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
                <table className="ioc26-table">
                  <thead>
                    <tr className="border-b border-[#1e2d40] text-[10px] text-[#4a6480] uppercase tracking-wider">
                      <th className="px-4 py-3 w-8">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={el => { if (el) el.indeterminate = someSelected }}
                          onChange={handleToggleAll}
                          aria-label="Sélectionner tous les IOC affichés"
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
                      <tr key={ioc.id} data-selected={selectedIOC?.id === ioc.id || selectedIds.has(ioc.id)} className="ioc26-row group">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(ioc.id)}
                            onChange={() => handleToggleSelect(ioc.id)}
                            aria-label={`Sélectionner ${ioc.value}`}
                            className="w-4 h-4 rounded border-[#1e2d40] accent-[#00d4ff] cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 text-xs uppercase text-[#00d4ff]">
                            {typeIcon(ioc.type)} {ioc.type}
                          </span>
                        </td>
                        <td className="ioc26-value-cell"><button type="button" className="ioc26-value" onClick={() => openDetail(ioc)}
                          aria-label={`Inspecter ${ioc.type} ${ioc.value}`} title={ioc.value}>{ioc.value}</button>
                          {ioc.source && <small className="ioc26-value-source" title={ioc.source}>Source : {ioc.source}</small>}
                        </td>
                        <td className="px-4 py-3">{tlpBadge(ioc.tlp)}</td>
                        <td className="px-4 py-3">
                          {parseTags(ioc.tags).length > 0
                            ? <span className="ioc26-tag-count" title={parseTags(ioc.tags).join(', ')}>{parseTags(ioc.tags).length} tag{parseTags(ioc.tags).length > 1 ? 's' : ''}</span>
                            : <span className="text-[10px] text-[#2a3f55]">—</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          <span className={`ioc26-status is-${ioc.status} ${STATUS_COLORS[ioc.status] ?? ''}`}>
                            {ioc.status === 'active' ? 'Actif' : ioc.status === 'archived' ? 'Archivé' : 'Faux positif'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="ioc26-row-actions">
                            <button onClick={() => openDetail(ioc)}
                              className="p-1.5 rounded hover:bg-[#00d4ff]/10 text-[#64748b] hover:text-[#00d4ff] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]" title="Voir détails" aria-label={`Voir les détails de ${ioc.value}`}>
                              <ShieldBan size={13} />
                            </button>
                            <button onClick={() => { setEditTarget(ioc); setShowForm(true) }}
                              className="p-1.5 rounded hover:bg-[#00d4ff]/10 text-[#64748b] hover:text-[#00d4ff] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]" title="Modifier" aria-label={`Modifier ${ioc.value}`}>
                              <Edit2 size={13} />
                            </button>
                            <button onClick={() => handleDelete(ioc)}
                              className="p-1.5 rounded hover:bg-red-500/10 text-[#64748b] hover:text-red-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff]" title="Supprimer" aria-label={`Supprimer ${ioc.value}`}>
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
            {total > limit && !loading && !error && <nav className="ioc26-pager" aria-label="Pagination des IOC">
            <button type="button" className="ioc26-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Précédent</button>
            <span>Page {page} / {Math.ceil(total / limit)}</span>
            <button type="button" className="ioc26-btn" disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(page + 1)}>Suivant →</button>
            </nav>}
          </div>
        </div>

          {/* Panneau latéral de détail */}
          {selectedIOC && (
            <aside className={`ioc26-inspector${deepAnalysis ? ' is-deep' : ''}`} aria-label={`Détail de ${selectedIOC.value}`}>
              <div className="ioc26-inspector-head">
                <div className="ioc26-inspector-topline">
                  <span>INTELLIGENCE / INDICATEUR</span>
                  <div className="ioc26-inspector-controls">
                    <button ref={analysisModeButton} type="button" className="ioc26-analysis-mode" onClick={() => {
                      if (!deepAnalysis && !correlationLoading && (!correlationResult || correlationResult.ioc_value !== selectedIOC.value)) loadCorrelation(selectedIOC)
                      setDeepAnalysis(value => !value)
                    }}>
                      {deepAnalysis ? 'Revenir à l’inspecteur' : <><Maximize2 size={13} aria-hidden="true" />Analyse approfondie</>}
                    </button>
                  <button ref={detailClose} onClick={closeDetail}
                    className="ioc26-inspector-close"
                    aria-label="Fermer le détail">
                    <X size={17} />
                  </button>
                  </div>
                </div>
                <div className="ioc26-inspector-heading">
                  <h2>{typeIcon(selectedIOC.type)} {selectedIOC.type.toUpperCase()}</h2>
                  <span>#{selectedIOC.id}</span>
                </div>
                <div className="ioc26-inspector-value">
                  <p tabIndex={selectedIOC.value.length > 150 ? 0 : undefined}>{selectedIOC.value}</p>
                  <button type="button" className="ioc26-btn" onClick={() => copyValue(selectedIOC.value)}><Copy size={14} />Copier</button>
                </div>
                <dl className="ioc26-inspector-meta">
                  <div><dt>CLASSIFICATION</dt><dd>{tlpBadge(selectedIOC.tlp)}</dd></div>
                  <div><dt>STATUT</dt><dd className={`is-${selectedIOC.status}`}>
                    {selectedIOC.status === 'active' ? 'Actif' : selectedIOC.status === 'archived' ? 'Archivé' : 'Faux positif'}
                  </dd></div>
                  <div><dt>SOURCE</dt><dd title={selectedIOC.source || undefined}>{selectedIOC.source || '—'}</dd></div>
                </dl>
              </div>

              {/* Onglets */}
              {!deepAnalysis && <div className="flex border-b border-[#1e2d40]">
                <button
                  onClick={() => setActiveTab('details')}
                  aria-pressed={activeTab === 'details'}
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
                  aria-pressed={activeTab === 'correlation'}
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
                    aria-pressed={activeTab === 'hash_analysis'}
                    className={`flex-1 px-4 py-3 text-xs font-mono font-bold uppercase tracking-wider transition-colors ${
                      activeTab === 'hash_analysis'
                        ? 'text-[#00d4ff] border-b-2 border-[#00d4ff]'
                        : 'text-[#64748b] hover:text-[#f1f5f9]'
                    }`}
                  >
                    ANALYSE HASH
                  </button>
                )}
              </div>}

              <div className={`ioc26-inspector-body flex-1 overflow-y-auto p-4 space-y-4${deepAnalysis ? ' is-deep' : ''}`}>
                {deepAnalysis ? (
                  <div className="ioc26-analysis">
                    <div className="ioc26-analysis-switch" role="group" aria-label="Mode de consultation des corrélations">
                      <button type="button" aria-pressed={analysisView === 'map'} onClick={() => setAnalysisView('map')}>Cartographie</button>
                      <button type="button" aria-pressed={analysisView === 'list'} onClick={() => setAnalysisView('list')}>Liste</button>
                    </div>
                    {analysisView === 'list' ? <CorrelationPanel variant="ioc" result={correlationResult} loading={correlationLoading} error={correlationError} />
                      : correlationLoading || correlationError ? <CorrelationPanel variant="ioc" result={correlationResult} loading={correlationLoading} error={correlationError} />
                      : correlationResult && intelligenceData ? <>
                        <IocCorrelationSummary result={correlationResult} compact />
                        <IntelligenceMap key={selectedIOC.id} ioc={selectedIOC} data={intelligenceData}
                          initialGroup={restoredGroup === 'mitre' || restoredGroup === 'cve' || restoredGroup === 'playbooks' ? restoredGroup : null} />
                      </> : <p role="status">Aucune donnée de corrélation disponible.</p>}
                  </div>
                ) : activeTab === 'details' ? (
                  <>
                    <section className="ioc26-detail-group">
                      <h3>Contexte de l’indicateur</h3>
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
                      <div className="ioc26-detail-dates">
                        <div><span>Créé le</span><time>{formatIocDate(selectedIOC.created_at)}</time></div>
                        <div><span>Mis à jour</span><time>{formatIocDate(selectedIOC.updated_at)}</time></div>
                      </div>
                    </section>

                    <section className="ioc26-detail-group">
                      <h3>Notes</h3>
                      {selectedIOC.notes
                        ? <p className="text-sm font-mono text-[#cbd5e1] whitespace-pre-wrap leading-relaxed">{selectedIOC.notes}</p>
                        : <p className="text-xs font-mono text-[#2a3f55]">—</p>
                      }
                    </section>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => { setEditTarget(selectedIOC); setShowForm(true); setSelectedIOC(null) }}
                        className="flex-1 px-3 py-2.5 text-xs font-mono font-bold bg-[#00d4ff] text-[#06080f] rounded hover:bg-[#00d4ff]/80 transition-colors">
                        MODIFIER
                      </button>
                      <button onClick={() => handleDelete(selectedIOC)}
                        className="px-3 py-2.5 text-xs font-mono border border-red-500 text-red-400 rounded hover:bg-red-500/10 transition-colors">
                        SUPPRIMER
                      </button>
                    </div>
                  </>
                ) : activeTab === 'correlation' ? (
                  <div className="ioc26-correlation"><CorrelationPanel
                      variant="ioc"
                      result={correlationResult}
                      loading={correlationLoading}
                      error={correlationError}
                    /></div>
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
            </aside>
          )}
        </div>
      </div>

      {/* Modal Import IOC */}
      <ImportIOCModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => { fetchIocs(); fetchStats() }}
      />

      {deleteTarget && <Dialog title="Supprimer l’IOC" onClose={() => setDeleteTarget(null)} footer={<>
        <button type="button" className="ioc26-btn" onClick={() => setDeleteTarget(null)}>Annuler</button>
        <button type="button" className="ioc26-btn is-danger" onClick={confirmDelete}><Trash2 size={14} />Supprimer</button>
      </>}>
        <p>Supprimer définitivement <strong className="ioc26-confirm-value">{deleteTarget.value}</strong> ?</p>
      </Dialog>}

      {confirmBulk && <Dialog title="Supprimer la sélection" onClose={() => setConfirmBulk(false)} footer={<>
        <button type="button" className="ioc26-btn" onClick={() => setConfirmBulk(false)} disabled={bulkDeleting}>Annuler</button>
        <button type="button" className="ioc26-btn is-danger" onClick={handleBulkDelete} disabled={bulkDeleting}><Trash2 size={14} />{bulkDeleting ? 'Suppression…' : 'Supprimer'}</button>
      </>}>
        <p>Supprimer définitivement {selectedIds.size} IOC{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''} ?</p>
      </Dialog>}

      {/* Modale formulaire (création / édition) */}
      {showForm && createPortal(
        <div className="ioc26-form-dialog">
        <Dialog title={editTarget ? 'Modifier l’IOC' : 'Nouvel IOC'} onClose={() => { setShowForm(false); setEditTarget(null) }}>
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
        </Dialog>
        </div>
      , document.body)}
    </div>
  )
}
