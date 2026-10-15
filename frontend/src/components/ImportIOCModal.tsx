import { useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Upload, FileText, CheckCircle, AlertTriangle } from 'lucide-react'
import { iocApi } from '@/api/client'
import { Dialog } from '@/mitre/MitreUi'
import type { IOCTLP, IOCStatus } from '@/types/ioc'
import type { ImportResult } from '@/types/threat_intel'

interface Props {
  open: boolean
  onClose: () => void
  onImported: () => void
}

const TLP_OPTIONS: { value: IOCTLP; label: string }[] = [
  { value: 'white', label: 'TLP:WHITE' },
  { value: 'green', label: 'TLP:GREEN' },
  { value: 'amber', label: 'TLP:AMBER' },
  { value: 'red',   label: 'TLP:RED'   },
]

const STATUS_OPTIONS: { value: IOCStatus; label: string }[] = [
  { value: 'active',         label: 'Actif'         },
  { value: 'archived',       label: 'Archivé'       },
  { value: 'false_positive', label: 'Faux positif'  },
]

function detectType(value: string): string {
  const v = value.trim()
  if (/^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/.test(v)) return 'cidr'
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) return 'ip'
  if (/^[a-fA-F0-9]{64}$/.test(v)) return 'hash (SHA256)'
  if (/^[a-fA-F0-9]{32}$/.test(v)) return 'hash (MD5)'
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return 'email'
  if (/^https?:\/\//.test(v)) return 'url'
  if (v.includes('.') && !v.includes(' ')) return 'domain'
  return 'inconnu'
}

export default function ImportIOCModal({ open, onClose, onImported }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<{ value: string; type: string }[]>([])
  const [lineCount, setLineCount] = useState(0)
  const [tlp, setTlp] = useState<IOCTLP>('white')
  const [status, setStatus] = useState<IOCStatus>('active')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragging, setDragging] = useState(false)

  const processFile = useCallback((f: File) => {
    setFile(f)
    setResult(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = (e.target?.result as string) ?? ''
      const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'))
      setLineCount(lines.length)
      const isCSV = f.name.endsWith('.csv') || (lines[0] ?? '').includes(',')
      const firstLines = lines.slice(0, 5).map(line => {
        const value = isCSV ? line.split(',')[0].replace(/"/g, '').trim() : line.trim()
        return { value, type: detectType(value) }
      })
      setPreview(firstLines)
    }
    reader.readAsText(f)
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) processFile(f)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith('.csv') || f.name.endsWith('.txt'))) processFile(f)
  }

  const handleImport = async () => {
    if (!file || importing) return
    setImporting(true)
    try {
      const res = await iocApi.importCSV(file, tlp, status)
      setResult(res)
      if (res.imported > 0) onImported()
    } catch {
      setResult({ imported: 0, skipped_duplicates: 0, skipped_invalid: 0, errors: ['Erreur lors de l\'import'] })
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setPreview([])
    setLineCount(0)
    setResult(null)
    setImporting(false)
    onClose()
  }

  if (!open) return null

  return createPortal(
    <div className="ioc26-import-dialog">
    <Dialog title="Importer des IOC — CSV / TXT" onClose={handleClose}>
      <div className="ioc26-import-content">
        <p className="ioc26-dialog-description">Importer des indicateurs depuis un fichier CSV ou TXT. Les options ci-dessous s’appliquent aux lignes importées.</p>

        {/* Drop zone */}
        <label className={`ioc26-import-drop border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            dragging ? 'border-cyber-cyan bg-cyber-cyan/5' : 'border-border hover:border-cyber-cyan/50'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <input ref={fileInputRef} type="file" accept=".csv,.txt" className="ioc26-file-input" onChange={handleFileChange} aria-label="Choisir un fichier CSV ou TXT" />
          {file ? (
            <div className="ioc26-import-file flex items-center justify-center gap-2 text-cyber-cyan">
              <FileText size={20} />
              <span className="font-medium text-sm">{file.name}</span>
              <span className="text-text-muted text-xs">({lineCount} lignes)</span>
            </div>
          ) : (
            <div className="text-text-muted space-y-1">
              <Upload size={28} className="mx-auto opacity-40" />
              <p className="text-sm">Glisser un fichier ici ou <span className="text-cyber-cyan">parcourir</span></p>
              <p className="ioc26-import-format">Formats acceptés : CSV et TXT · Max 10 000 IOC</p>
            </div>
          )}
        </label>

        {/* Aperçu */}
        {preview.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-text-muted font-medium">Aperçu des 5 premières lignes :</p>
            <div className="bg-bg-primary rounded border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-text-muted">
                    <th className="px-3 py-2 text-left">Valeur</th>
                    <th className="px-3 py-2 text-left">Type détecté</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-b border-border/30">
                      <td className="px-3 py-1.5 font-mono text-text-primary truncate max-w-[220px]">{row.value}</td>
                      <td className="px-3 py-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          row.type === 'inconnu' ? 'bg-red-900/30 text-red-400' : 'bg-cyber-cyan/10 text-cyber-cyan'
                        }`}>{row.type}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Options */}
        {file && !result && (
          <div className="ioc26-form-grid">
            <div className="ioc26-field">
              <label htmlFor="ioc-import-tlp">TLP par défaut</label>
              <select id="ioc-import-tlp" value={tlp} onChange={e => setTlp(e.target.value as IOCTLP)}>
                {TLP_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="ioc26-field">
              <label htmlFor="ioc-import-status">Statut par défaut</label>
              <select id="ioc-import-status" value={status} onChange={e => setStatus(e.target.value as IOCStatus)}>
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Résultat */}
        {result && (
          <div role={result.imported > 0 ? 'status' : 'alert'} className={`rounded-lg p-4 border space-y-2 ${
            result.imported > 0 ? 'bg-green-900/10 border-green-500/30' : 'bg-red-900/10 border-red-500/30'
          }`}>
            <div className="flex items-center gap-2 text-sm font-medium">
              {result.imported > 0
                ? <><CheckCircle size={16} className="text-green-400" /><span className="text-green-400">Import terminé</span></>
                : <><AlertTriangle size={16} className="text-red-400" /><span className="text-red-400">Aucun IOC importé</span></>
              }
            </div>
            <div className="text-xs text-text-muted space-y-0.5">
              <p><span className="text-green-400 font-semibold">✅ {result.imported}</span> importé{result.imported > 1 ? 's' : ''}</p>
              <p><span className="text-yellow-400">{result.skipped_duplicates}</span> doublon{result.skipped_duplicates > 1 ? 's' : ''} ignoré{result.skipped_duplicates > 1 ? 's' : ''}</p>
              <p><span className="text-red-400">{result.skipped_invalid}</span> invalide{result.skipped_invalid > 1 ? 's' : ''} ignoré{result.skipped_invalid > 1 ? 's' : ''}</p>
              {result.errors.length > 0 && (
                <p className="text-red-400 text-xs">{result.errors[0]}</p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="ioc26-dialog-actions">
          <button type="button" onClick={handleClose} className="ioc26-btn">
            {result ? 'Fermer' : 'Annuler'}
          </button>
          {!result && file && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="ioc26-btn is-primary"
            >
              {importing && <div className="w-3 h-3 border-2 border-bg-primary/40 border-t-bg-primary rounded-full animate-spin" aria-hidden="true" />}
              {importing ? 'Import en cours…' : `Importer ${lineCount} ligne${lineCount > 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </Dialog>
    </div>, document.body
  )
}
