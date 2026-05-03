import { useRef, useState, useEffect } from 'react'
import { Download, Upload, Database, Shield, CheckCircle, RefreshCw, EyeOff, Search, Wifi, AlertTriangle, Link2 } from 'lucide-react'
import { settingsApi, settingsDbApi, osintWmnApi, hashApi, cisaApi, threatFeedsApi } from '@/api/client'
import { toast } from '@/store/toast'
import type { DBVersions } from '@/types/osint'
import type { ThreatFeedSync } from '@/types/threat_intel'

function fmtDate(iso: string): string {
  if (!iso || iso.startsWith('0001-')) return 'Jamais'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Settings() {
  const [backingUp, setBackingUp]     = useState(false)
  const [exporting, setExporting]     = useState(false)
  const [importing, setImporting]     = useState(false)
  const [importResult, setImportResult] = useState<null | {
    tools: { created: number; skipped: number }
    ctf:   { created: number; skipped: number }
    cve:   { created: number; skipped: number }
    playbooks: { created: number; skipped: number }
  }>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // DB Versions
  const [dbVersions, setDbVersions]       = useState<DBVersions | null>(null)
  const [updatingMitre, setUpdatingMitre] = useState(false)
  const [updatingCloak, setUpdatingCloak] = useState(false)
  const [updatingWmn, setUpdatingWmn]     = useState(false)

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
      toast.success('CISA KEV mis a jour : ' + r.count + ' entrees (' + r.new_items + ' nouvelles)')
      cisaApi.getStats().then(setCisaStats).catch(() => {})
    } catch {
      toast.error('Erreur lors de la mise a jour CISA KEV')
    } finally {
      setUpdatingKev(false)
    }
  }

  const handleSyncFeodo = async () => {
    setSyncingFeodo(true)
    try {
      const r = await threatFeedsApi.syncFeodo()
      toast.success('Feodo : ' + r.new_iocs + ' nouveaux IOCs C2 importes')
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
      toast.success('URLhaus : ' + r.new_iocs + ' nouvelles URLs malveillantes importees')
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

  // Scroll to virustotal section if ?section=virustotal
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('section') === 'virustotal' && vtRef.current) {
      setTimeout(() => vtRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }, [])

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
      toast.success('MITRE mis a jour : ' + r.technique_count + ' techniques')
      setDbVersions(prev => prev ? { ...prev, mitre: { ...prev.mitre, technique_count: r.technique_count, last_updated: r.updated_at } } : prev)
    } catch {
      toast.error('Erreur lors de la mise a jour MITRE')
    } finally {
      setUpdatingMitre(false)
    }
  }

  const handleUpdateCloak = async () => {
    setUpdatingCloak(true)
    try {
      const r = await settingsDbApi.updateCloak()
      toast.success('CLOAK mis a jour : ' + r.technique_count + ' techniques')
      setDbVersions(prev => prev ? { ...prev, cloak: { ...prev.cloak, technique_count: r.technique_count, last_updated: r.updated_at } } : prev)
    } catch {
      toast.error('Erreur lors de la mise a jour CLOAK')
    } finally {
      setUpdatingCloak(false)
    }
  }

  const handleUpdateWmn = async () => {
    setUpdatingWmn(true)
    try {
      const r = await osintWmnApi.updateDb()
      toast.success('WhatsMyName mis a jour : ' + r.site_count + ' sites')
      setDbVersions(prev => prev ? { ...prev, wmn: { site_count: r.site_count, last_updated: r.updated_at } } : prev)
    } catch {
      toast.error('Erreur lors de la mise a jour WhatsMyName')
    } finally {
      setUpdatingWmn(false)
    }
  }

  const handleBackup = async () => {
    setBackingUp(true)
    try {
      const res = await settingsApi.backup()
      toast.success('Backup declenche : ' + res.path)
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
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = 'cyber-hub-export-' + new Date().toISOString().slice(0, 10) + '.json'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Export JSON telecharge')
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
      const text    = await file.text()
      const payload = JSON.parse(text)
      const result  = await settingsApi.import(payload)
      setImportResult(result)
      toast.success('Import termine')
    } catch {
      toast.error('Erreur import')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          <span className="text-cyber-cyan">&gt;</span> Parametres
        </h1>
        <p className="text-text-muted text-sm mt-1">Gestion des donnees et sauvegardes</p>
      </div>

      {/* Section Backup */}
      <section className="card mb-4">
        <div className="flex items-start gap-3 mb-4">
          <Database size={20} className="text-cyber-cyan shrink-0 mt-0.5" />
          <div>
            <h2 className="text-text-primary font-semibold">Sauvegarde manuelle</h2>
            <p className="text-text-muted text-sm mt-0.5">Copie cyber-hub.db vers un fichier .db.bak date dans le meme dossier. Une sauvegarde automatique est aussi creee au demarrage et toutes les 24h.</p>
          </div>
        </div>
        <button
          onClick={handleBackup}
          disabled={backingUp}
          className="btn-secondary flex items-center gap-2"
        >
          <Database size={15} />
          {backingUp ? 'Backup en cours...' : 'Declencher un backup maintenant'}
        </button>
      </section>

      {/* Section Export */}
      <section className="card mb-4">
        <div className="flex items-start gap-3 mb-4">
          <Download size={20} className="text-cyber-green shrink-0 mt-0.5" />
          <div>
            <h2 className="text-text-primary font-semibold">Exporter les donnees</h2>
            <p className="text-text-muted text-sm mt-0.5">Telecharge un fichier JSON contenant tous vos outils, writeups CTF, CVE et playbooks.</p>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="btn-secondary flex items-center gap-2 border-cyber-green/40 text-cyber-green hover:bg-cyber-green/10"
        >
          <Download size={15} />
          {exporting ? 'Export en cours...' : 'Telecharger export JSON'}
        </button>
      </section>

      {/* Section Import */}
      <section className="card mb-6">
        <div className="flex items-start gap-3 mb-4">
          <Upload size={20} className="text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-text-primary font-semibold">Importer des donnees</h2>
            <p className="text-text-muted text-sm mt-0.5">Importe un fichier JSON exporte depuis Cyber-Hub. Import non-destructif : les entrees deja presentes sont ignorees.</p>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          onChange={handleImportFile}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="btn-secondary flex items-center gap-2 border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/10"
        >
          <Upload size={15} />
          {importing ? 'Import en cours...' : 'Choisir un fichier JSON'}
        </button>

        {importResult && (
          <div className="mt-4 p-3 bg-cyber-green/5 border border-cyber-green/20 rounded">
            <div className="flex items-center gap-2 mb-2 text-cyber-green text-sm font-medium">
              <CheckCircle size={16} />
              Import termine
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-text-muted">
              {(
                [
                  ['Outils',       importResult.tools],
                  ['Writeups CTF', importResult.ctf],
                  ['CVE',          importResult.cve],
                  ['Playbooks',    importResult.playbooks],
                ] as [string, { created: number; skipped: number }][]
              ).map(([label, counts]) => (
                <div key={label} className="flex justify-between bg-bg-hover px-2 py-1 rounded">
                  <span>{label}</span>
                  <span>
                    <span className="text-cyber-green">+{counts.created}</span>
                    {counts.skipped > 0 && (
                      <span className="text-text-muted ml-1">({counts.skipped} ignores)</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Section Bases de donnees */}
      <section className="mb-6">
        <h2 className="text-text-primary font-semibold mb-3 flex items-center gap-2">
          <Database size={16} className="text-cyber-cyan" />
          Bases de donnees
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

          {/* MITRE */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-purple-400" />
              <span className="font-semibold text-text-primary text-sm">MITRE ATT&amp;CK Enterprise</span>
            </div>
            <div className="text-xs text-text-muted space-y-0.5">
              <p>{dbVersions ? dbVersions.mitre.technique_count + ' techniques' : '...'}</p>
              <p>{'MAJ : ' + (dbVersions ? fmtDate(dbVersions.mitre.last_updated) : '...')}</p>
            </div>
            <button
              onClick={handleUpdateMitre}
              disabled={updatingMitre}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-purple-900/30 border border-purple-700/40 text-purple-300 hover:bg-purple-900/50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={13} className={updatingMitre ? 'animate-spin' : ''} />
              {updatingMitre ? 'Telechargement... (~50MB)' : 'Mettre a jour'}
            </button>
          </div>

          {/* CLOAK */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <EyeOff size={18} className="text-yellow-400" />
              <span className="font-semibold text-text-primary text-sm">CLOAK OpSec</span>
            </div>
            <div className="text-xs text-text-muted space-y-0.5">
              <p>{dbVersions ? dbVersions.cloak.technique_count + ' sous-techniques' : '...'}</p>
              <p>{'MAJ : ' + (dbVersions ? fmtDate(dbVersions.cloak.last_updated) : '...')}</p>
            </div>
            <button
              onClick={handleUpdateCloak}
              disabled={updatingCloak}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-yellow-900/30 border border-yellow-700/40 text-yellow-300 hover:bg-yellow-900/50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={13} className={updatingCloak ? 'animate-spin' : ''} />
              {updatingCloak ? 'Telechargement...' : 'Mettre a jour'}
            </button>
          </div>

          {/* WhatsMyName */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Search size={18} className="text-cyan-400" />
              <span className="font-semibold text-text-primary text-sm">WhatsMyName Database</span>
            </div>
            <div className="text-xs text-text-muted space-y-0.5">
              <p>{dbVersions ? dbVersions.wmn.site_count + ' sites' : '...'}</p>
              <p>{'MAJ : ' + (dbVersions ? fmtDate(dbVersions.wmn.last_updated) : '...')}</p>
            </div>
            <button
              onClick={handleUpdateWmn}
              disabled={updatingWmn}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-cyan-900/30 border border-cyan-700/40 text-cyan-300 hover:bg-cyan-900/50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={13} className={updatingWmn ? 'animate-spin' : ''} />
              {updatingWmn ? 'Telechargement wmn-data.json...' : 'Mettre a jour'}
            </button>
          </div>

          {/* CISA KEV */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-400" />
              <span className="font-semibold text-text-primary text-sm">CISA KEV</span>
            </div>
            <div className="text-xs text-text-muted space-y-0.5">
              <p>{cisaStats ? cisaStats.total_entries + ' vulnérabilités exploitées' : '...'}</p>
              <p>{'MAJ : ' + (cisaStats ? fmtDate(cisaStats.last_updated) : '...')}</p>
            </div>
            <button
              onClick={handleUpdateKev}
              disabled={updatingKev}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-red-900/30 border border-red-700/40 text-red-300 hover:bg-red-900/50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={13} className={updatingKev ? 'animate-spin' : ''} />
              {updatingKev ? 'Telechargement...' : 'Mettre a jour'}
            </button>
          </div>

        </div>
      </section>

      {/* Threat Feeds */}
      <section className="mb-6">
        <h2 className="text-text-primary font-semibold mb-3 flex items-center gap-2">
          <Wifi size={16} className="text-orange-400" />
          Threat Feeds
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

          {/* Feodo Tracker */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Wifi size={18} className="text-orange-400" />
              <span className="font-semibold text-text-primary text-sm">Feodo Tracker (IPs C2)</span>
            </div>
            <p className="text-xs text-text-muted">IPs de serveurs C2 actifs (Cobalt Strike, Emotet, QakBot…)</p>
            <div className="text-xs text-text-muted space-y-0.5">
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
              className="flex items-center gap-2 px-3 py-2 text-xs rounded border border-orange-500/40 text-orange-400 hover:bg-orange-500/10 transition-colors disabled:opacity-50 w-fit"
            >
              <RefreshCw size={12} className={syncingFeodo ? 'animate-spin' : ''} />
              {syncingFeodo ? 'Sync en cours…' : 'Synchroniser'}
            </button>
          </div>

          {/* URLhaus */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Link2 size={18} className="text-purple-400" />
              <span className="font-semibold text-text-primary text-sm">URLhaus (URLs malveillantes)</span>
            </div>
            <p className="text-xs text-text-muted">URLs de distribution de malwares actives (abuse.ch)</p>
            <div className="text-xs text-text-muted space-y-0.5">
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
              className="flex items-center gap-2 px-3 py-2 text-xs rounded border border-purple-500/40 text-purple-400 hover:bg-purple-500/10 transition-colors disabled:opacity-50 w-fit"
            >
              <RefreshCw size={12} className={syncingUrlhaus ? 'animate-spin' : ''} />
              {syncingUrlhaus ? 'Sync en cours…' : 'Synchroniser'}
            </button>
          </div>

        </div>
      </section>

      {/* VirusTotal API Key */}
      <section ref={vtRef} className="mb-6">
        <h2 className="text-text-primary font-semibold mb-3 flex items-center gap-2">
          <Shield size={16} className="text-cyber-cyan" />
          VirusTotal
        </h2>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-3">
          {vtConfig?.configured ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle size={14} className="text-cyber-green" />
                <span className="text-text-primary">Clé configurée :</span>
                <code className="font-mono text-text-muted">{vtConfig.masked_key}</code>
              </div>
              <button
                onClick={handleDeleteVT}
                disabled={deletingVt}
                className="flex items-center gap-2 px-3 py-2 text-xs rounded border border-cyber-red/40 text-cyber-red hover:bg-cyber-red/10 transition-colors disabled:opacity-50"
              >
                <EyeOff size={12} />
                {deletingVt ? 'Suppression…' : 'Supprimer la clé'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-text-muted">Entrez votre clé API VirusTotal pour enrichir l'analyse de hash.</p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={vtKey}
                  onChange={(e) => setVtKey(e.target.value)}
                  placeholder="Clé API VirusTotal…"
                  className="flex-1 bg-bg-secondary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-cyber-cyan"
                />
                <button
                  onClick={handleSaveVT}
                  disabled={savingVt || !vtKey.trim()}
                  className="px-4 py-2 text-sm bg-cyber-cyan text-bg-primary font-semibold rounded hover:bg-cyber-cyan/80 disabled:opacity-50 transition-colors"
                >
                  {savingVt ? 'Sauvegarde…' : 'Sauvegarder'}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>


    </div>
  )
}
