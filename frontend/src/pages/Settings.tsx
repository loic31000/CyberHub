import { useRef, useState } from 'react'
import { Download, Upload, Database, Shield, Info, CheckCircle } from 'lucide-react'
import { settingsApi } from '@/api/client'
import { toast } from '@/store/toast'

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

  const handleBackup = async () => {
    setBackingUp(true)
    try {
      const res = await settingsApi.backup()
      toast.success(`${`Déclencher un backup maintenant`} : ${res.path}`)
    } catch {
      toast.error(`Déclencher un backup maintenant`)
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
      a.download = `cyber-hub-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Télécharger export JSON`)
    } catch {
      toast.error(`Télécharger export JSON`)
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
      toast.success(`Import terminé`)
    } catch {
      toast.error(`Choisir un fichier JSON`)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          <span className="text-cyber-cyan">&gt;</span> {`Paramètres`}
        </h1>
        <p className="text-text-muted text-sm mt-1">{`Gestion des données et sauvegardes`}</p>
      </div>

      {/* Section Backup */}
      <section className="card mb-4">
        <div className="flex items-start gap-3 mb-4">
          <Database size={20} className="text-cyber-cyan shrink-0 mt-0.5" />
          <div>
            <h2 className="text-text-primary font-semibold">{`Sauvegarde manuelle`}</h2>
            <p className="text-text-muted text-sm mt-0.5">{`Copie cyber-hub.db vers un fichier .db.bak daté dans le même dossier. Une sauvegarde automatique est aussi créée au démarrage et toutes les 24h.`}</p>
          </div>
        </div>
        <button
          onClick={handleBackup}
          disabled={backingUp}
          className="btn-secondary flex items-center gap-2"
        >
          <Database size={15} />
          {backingUp ? `Backup en cours…` : `Déclencher un backup maintenant`}
        </button>
      </section>

      {/* Section Export */}
      <section className="card mb-4">
        <div className="flex items-start gap-3 mb-4">
          <Download size={20} className="text-cyber-green shrink-0 mt-0.5" />
          <div>
            <h2 className="text-text-primary font-semibold">{`Exporter les données`}</h2>
            <p className="text-text-muted text-sm mt-0.5">{`Télécharge un fichier JSON contenant tous vos outils, writeups CTF, CVE et playbooks. Utilisable pour migrer vers une autre machine ou partager votre base.`}</p>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="btn-secondary flex items-center gap-2 border-cyber-green/40 text-cyber-green hover:bg-cyber-green/10"
        >
          <Download size={15} />
          {exporting ? `Export en cours…` : `Télécharger export JSON`}
        </button>
      </section>

      {/* Section Import */}
      <section className="card mb-6">
        <div className="flex items-start gap-3 mb-4">
          <Upload size={20} className="text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-text-primary font-semibold">{`Importer des données`}</h2>
            <p className="text-text-muted text-sm mt-0.5">{`Importe un fichier JSON exporté depuis Cyber-Hub. L'import est non-destructif : les entrées déjà présentes (même titre/ID) sont ignorées, seules les nouvelles sont ajoutées.`}</p>
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
          {importing ? `Import en cours…` : `Choisir un fichier JSON`}
        </button>

        {importResult && (
          <div className="mt-4 p-3 bg-cyber-green/5 border border-cyber-green/20 rounded">
            <div className="flex items-center gap-2 mb-2 text-cyber-green text-sm font-medium">
              <CheckCircle size={16} />
              {`Import terminé`}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-text-muted">
              {(
                [
                  [`Outils`,    importResult.tools],
                  [`Writeups CTF`,      importResult.ctf],
                  [`CVE`,      importResult.cve],
                  [`Playbooks`, importResult.playbooks],
                ] as [string, { created: number; skipped: number }][]
              ).map(([label, counts]) => (
                <div key={label} className="flex justify-between bg-bg-hover px-2 py-1 rounded">
                  <span>{label}</span>
                  <span>
                    <span className="text-cyber-green">+{counts.created}</span>
                    {counts.skipped > 0 && (
                      <span className="text-text-muted ml-1">({counts.skipped} {`ignorés`})</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Section Info */}
      <section className="card border-border/50">
        <div className="flex items-start gap-3">
          <Info size={20} className="text-text-muted shrink-0 mt-0.5" />
          <div className="text-text-muted text-sm space-y-1">
            <p>
              <strong className="text-text-primary">{`Cyber-Hub v0.6`}</strong> · {`Données 100% locales`}
              · <code className="text-xs">cyber-hub.db</code> ({`cyber-hub.db (SQLite)`})
            </p>
            <p className="flex items-center gap-1">
              <Shield size={12} className="text-cyber-green" />
              {`Mot de passe : bcrypt (coût 12) · JWT HS256 · CORS localhost uniquement`}
            </p>
            <p>
              {`Toutes les données restent sur votre machine. Aucune télémétrie, aucun serveur distant.`}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
