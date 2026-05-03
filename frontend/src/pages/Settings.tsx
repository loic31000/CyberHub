import { useRef, useState, useEffect } from 'react'
import { Download, Upload, Database, Shield, Info, CheckCircle, RefreshCw, EyeOff, Search, Trash2 } from 'lucide-react'
import { settingsApi, settingsDbApi, osintWmnApi, hashApi } from '@/api/client'
import { toast } from '@/store/toast'
import type { DBVersions } from '@/types/osint'

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

        </div>
      </section>

      {/* Section Clés API */}
      <section ref={vtRef} className="mb-6">
        <h2 className="text-text-primary font-semibold mb-3 flex items-center gap-2">
          <Shield size={16} className="text-blue-400" />
          Clés API
        </h2>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Shield size={20} className="text-blue-400 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-text-primary text-sm">VirusTotal</span>
                <a
                  href="https://www.virustotal.com/gui/join-us"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-cyber-cyan hover:underline"
                >
                  Obtenir une clé gratuite →
                </a>
              </div>
              <p className="text-text-muted text-xs mt-0.5">500 requêtes/jour gratuites · Analyse de hashes, IPs, URLs</p>
            </div>
          </div>

          {vtConfig === null ? (
            <p className="text-text-muted text-xs animate-pulse">Chargement…</p>
          ) : vtConfig.configured ? (
            <div className="flex items-center gap-3">
              <code className="text-xs text-text-muted font-mono bg-bg-primary px-3 py-1.5 rounded border border-border flex-1">
                {vtConfig.masked_key}
              </code>
              <button
                onClick={handleDeleteVT}
                disabled={deletingVt}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors"
              >
                <Trash2 size={12} />
                {deletingVt ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="password"
                value={vtKey}
                onChange={e => setVtKey(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveVT()}
                placeholder="Coller votre clé API VirusTotal ici"
                className="flex-1 bg-bg-primary border border-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder-text-muted focus:border-cyber-cyan focus:outline-none font-mono"
              />
              <button
                onClick={handleSaveVT}
                disabled={savingVt || !vtKey.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30 disabled:opacity-40 transition-colors"
              >
                {savingVt ? <RefreshCw size={12} className="animate-spin" /> : null}
                {savingVt ? 'Sauvegarde…' : '💾 Sauvegarder'}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Section Info */}
      <section className="card border-border/50">
        <div className="flex items-start gap-3">
          <Info size={20} className="text-text-muted shrink-0 mt-0.5" />
          <div className="text-text-muted text-sm space-y-1">
            <p>
              <strong className="text-text-primary">Cyber-Hub v0.9</strong> · Donnees 100% locales
              · <code className="text-xs">cyber-hub.db</code> (SQLite)
            </p>
            <p className="flex items-center gap-1">
              <Shield size={12} className="text-cyber-green" />
              Mot de passe : bcrypt (cout 12) · JWT HS256 · CORS localhost uniquement
            </p>
            <p>
              Toutes les donnees restent sur votre machine. Aucune telemetrie, aucun serveur distant.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
