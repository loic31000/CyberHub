import { useRef, useState, useEffect } from 'react'
import { Download, Upload, Database, Shield, CheckCircle, RefreshCw, EyeOff, Search, Wifi, AlertTriangle, Link2, Settings as SettingsIcon } from 'lucide-react'
import { settingsApi, settingsDbApi, osintWmnApi, hashApi, cisaApi, threatFeedsApi } from '@/api/client'
import { toast } from '@/store/toast'
import type { DBVersions } from '@/types/osint'
import type { ThreatFeedSync } from '@/types/threat_intel'

function fmtDate(iso: string): string {
  if (!iso || iso.startsWith('0001-')) return 'Jamais'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface ImportStats {
  tools: { created: number; skipped: number }
  ctf: { created: number; skipped: number }
  cve: { created: number; skipped: number }
  playbooks: { created: number; skipped: number }
}

export default function Settings() {
  const [backingUp, setBackingUp] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportStats | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // DB Versions
  const [dbVersions, setDbVersions] = useState<DBVersions | null>(null)
  const [updatingMitre, setUpdatingMitre] = useState(false)
  const [updatingCloak, setUpdatingCloak] = useState(false)
  const [updatingWmn, setUpdatingWmn] = useState(false)

  useEffect(() => {
    settingsDbApi.getVersions().then(setDbVersions).catch(() => {})
  }, [])

  // CISA KEV
  const [cisaStats, setCisaStats] = useState<{ total_entries: number; last_updated: string } | null>(null)
  const [updatingKev, setUpdatingKev] = useState(false)

  // Threat Feeds
  const [feedStatus, setFeedStatus] = useState<{ feodo?: ThreatFeedSync; urlhaus?: ThreatFeedSync } | null>(null)
  const [syncingFeodo, setSyncingFeodo] = useState(false)
  const [syncingUrlhaus, setSyncingUrlhaus] = useState(false)

  useEffect(() => {
    cisaApi.getStats().then(setCisaStats).catch(() => {})
    threatFeedsApi.getStatus().then(setFeedStatus).catch(() => {})
  }, [])

  const handleUpdateKev = async () => {
    setUpdatingKev(true)
    try {
      const r = await cisaApi.updateKEV()
      toast.success(`CISA KEV mis à jour : ${r.count} entrées (${r.new_items} nouvelles)`)
      cisaApi.getStats().then(setCisaStats).catch(() => {})
    } catch {
      toast.error('Erreur lors de la mise à jour CISA KEV')
    } finally {
      setUpdatingKev(false)
    }
  }

  const handleSyncFeodo = async () => {
    setSyncingFeodo(true)
    try {
      const r = await threatFeedsApi.syncFeodo()
      toast.success(`Feodo : ${r.new_iocs} nouveaux IOCs C2 importés`)
      threatFeedsApi.getStatus().then(setFeedStatus).catch(() => {})
    } catch {
      toast.error('Erreur sync Feodo Tracker')
    } finally {
      setSyncingFeodo(false)
    }
  }

  const handleSyncUrlhaus = async () => {
    setSyncingUrlhaus(true)
    try {
      const r = await threatFeedsApi.syncURLhaus()
      toast.success(`URLhaus : ${r.new_iocs} nouvelles URLs malveillantes importées`)
      threatFeedsApi.getStatus().then(setFeedStatus).catch(() => {})
    } catch {
      toast.error('Erreur sync URLhaus')
    } finally {
      setSyncingUrlhaus(false)
    }
  }

  // VT key management
  const [vtConfig, setVtConfig] = useState<{ configured: boolean; masked_key: string } | null>(null)
  const [vtKey, setVtKey] = useState('')
  const [savingVt, setSavingVt] = useState(false)
  const [deletingVt, setDeletingVt] = useState(false)
  const vtRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    hashApi.vtGetConfig().then(setVtConfig).catch(() => {})
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('section') === 'virustotal' && vtRef.current) {
      setTimeout(() => vtRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }, [])

  // NVD API Key
  const [nvdConfig, setNvdConfig] = useState<{ has_key: boolean; masked: string } | null>(null)
  const [nvdKey, setNvdKey] = useState('')
  const [savingNvd, setSavingNvd] = useState(false)
  const [deletingNvd, setDeletingNvd] = useState(false)

  useEffect(() => {
    settingsApi.getNvdKey().then(setNvdConfig).catch(() => {})
  }, [])

  const handleSaveNVD = async () => {
    if (!nvdKey.trim()) return
    setSavingNvd(true)
    try {
      await settingsApi.setNvdKey(nvdKey.trim())
      toast.success('Clé NVD sauvegardée')
      const cfg = await settingsApi.getNvdKey()
      setNvdConfig(cfg)
      setNvdKey('')
    } catch {
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSavingNvd(false)
    }
  }

  const handleDeleteNVD = async () => {
    setDeletingNvd(true)
    try {
      await settingsApi.deleteNvdKey()
      toast.success('Clé NVD supprimée')
      setNvdConfig({ has_key: false, masked: '' })
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setDeletingNvd(false)
    }
  }

  const handleSaveVT = async () => {
    if (!vtKey.trim()) return
    setSavingVt(true)
    try {
      await hashApi.vtSaveKey(vtKey.trim())
      toast.success('Clé VirusTotal sauvegardée')
      const cfg = await hashApi.vtGetConfig()
      setVtConfig(cfg)
      setVtKey('')
    } catch {
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSavingVt(false)
    }
  }

  const handleDeleteVT = async () => {
    setDeletingVt(true)
    try {
      await hashApi.vtDeleteKey()
      toast.success('Clé VirusTotal supprimée')
      setVtConfig({ configured: false, masked_key: '' })
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setDeletingVt(false)
    }
  }

  const handleUpdateMitre = async () => {
    setUpdatingMitre(true)
    try {
      const r = await settingsDbApi.updateMitre()
      toast.success(`MITRE mis à jour : ${r.technique_count} techniques`)
      setDbVersions(prev => prev ? { ...prev, mitre: { ...prev.mitre, technique_count: r.technique_count, last_updated: r.updated_at } } : prev)
    } catch {
      toast.error('Erreur lors de la mise à jour MITRE')
    } finally {
      setUpdatingMitre(false)
    }
  }

  const handleUpdateCloak = async () => {
    setUpdatingCloak(true)
    try {
      const r = await settingsDbApi.updateCloak()
      toast.success(`CLOAK mis à jour : ${r.technique_count} techniques`)
      setDbVersions(prev => prev ? { ...prev, cloak: { ...prev.cloak, technique_count: r.technique_count, last_updated: r.updated_at } } : prev)
    } catch {
      toast.error('Erreur lors de la mise à jour CLOAK')
    } finally {
      setUpdatingCloak(false)
    }
  }

  const handleUpdateWmn = async () => {
    setUpdatingWmn(true)
    try {
      const r = await osintWmnApi.updateDb()
      toast.success(`WhatsMyName mis à jour : ${r.site_count} sites`)
      setDbVersions(prev => prev ? { ...prev, wmn: { site_count: r.site_count, last_updated: r.updated_at } } : prev)
    } catch {
      toast.error('Erreur lors de la mise à jour WhatsMyName')
    } finally {
      setUpdatingWmn(false)
    }
  }

  const handleBackup = async () => {
    setBackingUp(true)
    try {
      const res = await settingsApi.backup()
      toast.success(`Backup déclenché : ${res.path}`)
    } catch {
      toast.error('Erreur backup')
    } finally {
      setBackingUp(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const data = await settingsApi.export()
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'cyber-hub-export-' + new Date().toISOString().slice(0, 10) + '.json'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Export JSON téléchargé')
    } catch {
      toast.error('Erreur export')
    } finally {
      setExporting(false)
    }
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const text = await file.text()
      const payload = JSON.parse(text)
      const result = await settingsApi.import(payload)
      setImportResult(result as ImportStats)
      toast.success('Import terminé')
    } catch (err) {
      console.error(err)
      toast.error('Erreur import')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#06080f] text-[#f1f5f9]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d40] bg-[#0a0f16]/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <SettingsIcon className="text-[#00d4ff]" size={20} />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#10b981] rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase">SYSTEM // CONFIGURATION</h1>
            <p className="text-[10px] text-[#64748b] font-mono">Gestion des données, sauvegardes et mises à jour</p>
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px]">
          <span className="text-[#64748b]">STATUS</span>
          <span className="text-[#10b981]">ONLINE</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Backup */}
        <div className="border border-[#1e2d40] bg-[#0a0f16] p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Database size={18} className="text-[#00d4ff]" />
            <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#f1f5f9]">Sauvegarde manuelle</h2>
          </div>
          <p className="text-[11px] font-mono text-[#8a9ab0] leading-relaxed">
            Copie <code className="px-1 text-[#00d4ff]">cyber-hub.db</code> vers un fichier <code className="px-1 text-[#00d4ff]">.db.bak</code> daté dans le même dossier.
            Une sauvegarde automatique est également créée au démarrage et toutes les 24h.
          </p>
          <button
            onClick={handleBackup}
            disabled={backingUp}
            className="flex items-center gap-2 border border-[#00d4ff]/20 bg-[#00d4ff]/10 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#00d4ff] transition-colors hover:bg-[#00d4ff]/20 disabled:opacity-40"
          >
            <Database size={14} />
            {backingUp ? 'BACKUP EN COURS...' : 'DÉCLENCHER UN BACKUP'}
          </button>
        </div>

        {/* Export */}
        <div className="border border-[#1e2d40] bg-[#0a0f16] p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Download size={18} className="text-[#10b981]" />
            <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#f1f5f9]">Exporter les données</h2>
          </div>
          <p className="text-[11px] font-mono text-[#8a9ab0] leading-relaxed">
            Télécharge un fichier JSON contenant tous vos outils, writeups CTF, CVE et playbooks.
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 border border-[#10b981]/20 bg-[#10b981]/10 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#10b981] transition-colors hover:bg-[#10b981]/20 disabled:opacity-40"
          >
            <Download size={14} />
            {exporting ? 'EXPORT EN COURS...' : 'TÉLÉCHARGER EXPORT JSON'}
          </button>
        </div>

        {/* Import */}
        <div className="border border-[#1e2d40] bg-[#0a0f16] p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Upload size={18} className="text-[#eab308]" />
            <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#f1f5f9]">Importer des données</h2>
          </div>
          <p className="text-[11px] font-mono text-[#8a9ab0] leading-relaxed">
            Importe un fichier JSON exporté depuis Cyber-Hub. Import non destructif : les entrées déjà présentes sont ignorées.
          </p>
          <input ref={fileRef} type="file" accept=".json" onChange={handleImportFile} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 border border-[#eab308]/20 bg-[#eab308]/10 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#eab308] transition-colors hover:bg-[#eab308]/20 disabled:opacity-40"
          >
            <Upload size={14} />
            {importing ? 'IMPORT EN COURS...' : 'CHOISIR UN FICHIER JSON'}
          </button>

          {importResult && (
            <div className="mt-4 p-3 border-l-2 border-[#10b981] bg-[#10b981]/5">
              <div className="flex items-center gap-2 mb-2 text-[#10b981] text-[11px] font-mono font-bold">
                <CheckCircle size={14} />
                IMPORT TERMINÉ
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-[#8a9ab0]">
                {[
                  { label: 'Outils', counts: importResult.tools },
                  { label: 'Writeups CTF', counts: importResult.ctf },
                  { label: 'CVE', counts: importResult.cve },
                  { label: 'Playbooks', counts: importResult.playbooks },
                ].map(({ label, counts }) => (
                  <div key={label} className="flex justify-between bg-[#0d131f] border border-[#1e2d40] px-2 py-1">
                    <span>{label}</span>
                    <span>
                      <span className="text-[#10b981]">+{counts.created}</span>
                      {counts.skipped > 0 && <span className="text-[#64748b] ml-1">({counts.skipped} ignorés)</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bases de données */}
        <div className="space-y-3">
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a9ab0] flex items-center gap-2">
            <Database size={14} className="text-[#00d4ff]" /> BASES DE DONNÉES
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* MITRE */}
            <div className="border border-[#1e2d40] bg-[#0a0f16] p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-purple-400" />
                <span className="font-mono text-[11px] font-bold text-[#f1f5f9]">MITRE ATT&CK</span>
              </div>
              <div className="text-[10px] font-mono text-[#64748b] space-y-0.5">
                <p>{dbVersions ? `${dbVersions.mitre.technique_count} techniques` : '...'}</p>
                <p>MAJ : {dbVersions ? fmtDate(dbVersions.mitre.last_updated) : '...'}</p>
              </div>
              <button
                onClick={handleUpdateMitre}
                disabled={updatingMitre}
                className="flex items-center justify-center gap-2 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest border border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors disabled:opacity-40"
              >
                <RefreshCw size={11} className={updatingMitre ? 'animate-spin' : ''} />
                {updatingMitre ? 'TÉLÉCHARGEMENT...' : 'METTRE À JOUR'}
              </button>
            </div>

            {/* CLOAK */}
            <div className="border border-[#1e2d40] bg-[#0a0f16] p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <EyeOff size={16} className="text-yellow-400" />
                <span className="font-mono text-[11px] font-bold text-[#f1f5f9]">CLOAK OpSec</span>
              </div>
              <div className="text-[10px] font-mono text-[#64748b] space-y-0.5">
                <p>{dbVersions ? `${dbVersions.cloak.technique_count} sous-techniques` : '...'}</p>
                <p>MAJ : {dbVersions ? fmtDate(dbVersions.cloak.last_updated) : '...'}</p>
              </div>
              <button
                onClick={handleUpdateCloak}
                disabled={updatingCloak}
                className="flex items-center justify-center gap-2 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors disabled:opacity-40"
              >
                <RefreshCw size={11} className={updatingCloak ? 'animate-spin' : ''} />
                {updatingCloak ? 'TÉLÉCHARGEMENT...' : 'METTRE À JOUR'}
              </button>
            </div>

            {/* WhatsMyName */}
            <div className="border border-[#1e2d40] bg-[#0a0f16] p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Search size={16} className="text-cyan-400" />
                <span className="font-mono text-[11px] font-bold text-[#f1f5f9]">WhatsMyName</span>
              </div>
              <div className="text-[10px] font-mono text-[#64748b] space-y-0.5">
                <p>{dbVersions ? `${dbVersions.wmn.site_count} sites` : '...'}</p>
                <p>MAJ : {dbVersions ? fmtDate(dbVersions.wmn.last_updated) : '...'}</p>
              </div>
              <button
                onClick={handleUpdateWmn}
                disabled={updatingWmn}
                className="flex items-center justify-center gap-2 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors disabled:opacity-40"
              >
                <RefreshCw size={11} className={updatingWmn ? 'animate-spin' : ''} />
                {updatingWmn ? 'TÉLÉCHARGEMENT...' : 'METTRE À JOUR'}
              </button>
            </div>

            {/* CISA KEV */}
            <div className="border border-[#1e2d40] bg-[#0a0f16] p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-400" />
                <span className="font-mono text-[11px] font-bold text-[#f1f5f9]">CISA KEV</span>
              </div>
              <div className="text-[10px] font-mono text-[#64748b] space-y-0.5">
                <p>{cisaStats ? `${cisaStats.total_entries} vulnérabilités` : '...'}</p>
                <p>MAJ : {cisaStats ? fmtDate(cisaStats.last_updated) : '...'}</p>
              </div>
              <button
                onClick={handleUpdateKev}
                disabled={updatingKev}
                className="flex items-center justify-center gap-2 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40"
              >
                <RefreshCw size={11} className={updatingKev ? 'animate-spin' : ''} />
                {updatingKev ? 'TÉLÉCHARGEMENT...' : 'METTRE À JOUR'}
              </button>
            </div>
          </div>
        </div>

        {/* Threat Feeds */}
        <div className="space-y-3">
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a9ab0] flex items-center gap-2">
            <Wifi size={14} className="text-orange-400" /> THREAT FEEDS
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Feodo Tracker */}
            <div className="border border-[#1e2d40] bg-[#0a0f16] p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Wifi size={16} className="text-orange-400" />
                <span className="font-mono text-[11px] font-bold text-[#f1f5f9]">Feodo Tracker (IPs C2)</span>
              </div>
              <p className="text-[10px] font-mono text-[#64748b]">IPs de serveurs C2 actifs (Cobalt Strike, Emotet, QakBot…)</p>
              <div className="text-[10px] font-mono text-[#64748b] space-y-0.5">
                {feedStatus?.feodo ? (
                  <>
                    <p>Dernière sync : {new Date(feedStatus.feodo.last_sync).toLocaleString('fr-FR')}</p>
                    <p>IOCs : {feedStatus.feodo.item_count} · Nouveaux : {feedStatus.feodo.new_items}</p>
                  </>
                ) : (
                  <p className="italic opacity-60">Jamais synchronisé</p>
                )}
              </div>
              <button
                onClick={handleSyncFeodo}
                disabled={syncingFeodo}
                className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest border border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors disabled:opacity-40 w-fit"
              >
                <RefreshCw size={11} className={syncingFeodo ? 'animate-spin' : ''} />
                {syncingFeodo ? 'SYNC EN COURS...' : 'SYNCHRONISER'}
              </button>
            </div>

            {/* URLhaus */}
            <div className="border border-[#1e2d40] bg-[#0a0f16] p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Link2 size={16} className="text-purple-400" />
                <span className="font-mono text-[11px] font-bold text-[#f1f5f9]">URLhaus (URLs malveillantes)</span>
              </div>
              <p className="text-[10px] font-mono text-[#64748b]">URLs de distribution de malwares actives (abuse.ch)</p>
              <div className="text-[10px] font-mono text-[#64748b] space-y-0.5">
                {feedStatus?.urlhaus ? (
                  <>
                    <p>Dernière sync : {new Date(feedStatus.urlhaus.last_sync).toLocaleString('fr-FR')}</p>
                    <p>IOCs : {feedStatus.urlhaus.item_count} · Nouveaux : {feedStatus.urlhaus.new_items}</p>
                  </>
                ) : (
                  <p className="italic opacity-60">Jamais synchronisé</p>
                )}
              </div>
              <button
                onClick={handleSyncUrlhaus}
                disabled={syncingUrlhaus}
                className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest border border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors disabled:opacity-40 w-fit"
              >
                <RefreshCw size={11} className={syncingUrlhaus ? 'animate-spin' : ''} />
                {syncingUrlhaus ? 'SYNC EN COURS...' : 'SYNCHRONISER'}
              </button>
            </div>
          </div>
        </div>

        {/* VirusTotal API Key */}
        <div ref={vtRef} className="space-y-3">
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a9ab0] flex items-center gap-2">
            <Shield size={14} className="text-[#00d4ff]" /> VIRUSTOTAL
          </h2>
          <div className="border border-[#1e2d40] bg-[#0a0f16] p-5 space-y-3">
            {vtConfig?.configured ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <CheckCircle size={14} className="text-[#10b981]" />
                  <span className="text-[#f1f5f9]">Clé configurée :</span>
                  <code className="font-mono text-[#64748b]">{vtConfig.masked_key}</code>
                </div>
                <button
                  onClick={handleDeleteVT}
                  disabled={deletingVt}
                  className="flex items-center gap-2 border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40"
                >
                  <EyeOff size={12} />
                  {deletingVt ? 'SUPPRESSION...' : 'SUPPRIMER LA CLÉ'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] font-mono text-[#8a9ab0]">
                  Entrez votre clé API VirusTotal pour enrichir l'analyse de hash.
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={vtKey}
                    onChange={e => setVtKey(e.target.value)}
                    placeholder="Clé API VirusTotal…"
                    className="flex-1 bg-[#0d131f] border border-[#1e2d40] px-3 py-2 font-mono text-sm text-[#f1f5f9] placeholder-[#334155] focus:outline-none focus:border-[#00d4ff]/60"
                  />
                  <button
                    onClick={handleSaveVT}
                    disabled={savingVt || !vtKey.trim()}
                    className="px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-widest bg-[#00d4ff] text-[#06080f] rounded hover:bg-[#00d4ff]/80 disabled:opacity-40 transition-colors"
                  >
                    {savingVt ? 'SAUVEGARDE...' : 'SAUVEGARDER'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* NVD API Key */}
        <div className="space-y-3">
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a9ab0] flex items-center gap-2">
            <Shield size={14} className="text-[#00d4ff]" /> NVD API KEY
          </h2>
          <div className="border border-[#1e2d40] bg-[#0a0f16] p-5 space-y-3">
            {nvdConfig?.has_key ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <CheckCircle size={14} className="text-[#10b981]" />
                  <span className="text-[#f1f5f9]">Clé configurée :</span>
                  <code className="font-mono text-[#64748b]">{nvdConfig.masked}</code>
                </div>
                <button
                  onClick={handleDeleteNVD}
                  disabled={deletingNvd}
                  className="flex items-center gap-2 border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40"
                >
                  <EyeOff size={12} />
                  {deletingNvd ? 'SUPPRESSION...' : 'SUPPRIMER LA CLÉ'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] font-mono text-[#8a9ab0]">
                  Clé API NVD optionnelle — augmente la limite de 5 à 50 req/30s pour l'import CVE.
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={nvdKey}
                    onChange={e => setNvdKey(e.target.value)}
                    placeholder="Clé API NVD…"
                    className="flex-1 bg-[#0d131f] border border-[#1e2d40] px-3 py-2 font-mono text-sm text-[#f1f5f9] placeholder-[#334155] focus:outline-none focus:border-[#00d4ff]/60"
                  />
                  <button
                    onClick={handleSaveNVD}
                    disabled={savingNvd || !nvdKey.trim()}
                    className="px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-widest bg-[#00d4ff] text-[#06080f] rounded hover:bg-[#00d4ff]/80 disabled:opacity-40 transition-colors"
                  >
                    {savingNvd ? 'SAUVEGARDE...' : 'SAUVEGARDER'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}