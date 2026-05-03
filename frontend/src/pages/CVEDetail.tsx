import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { cveApi, cisaApi } from '@/api/client'
import type { CVEEntry, CVEStatus } from '@/types'
import type { CISAKEVEntry, EPSSScore } from '@/types/threat_intel'
import { ArrowLeft, Edit, Trash2, ExternalLink, Flame, TrendingUp } from 'lucide-react'
import ConfirmModal from '@/components/ConfirmModal'
import { toast } from '@/store/toast'

const SEV_COLORS: Record<string, string> = {
  critical: 'bg-cyber-red/20 text-cyber-red border-cyber-red/40',
  high:     'bg-orange-500/20 text-orange-400 border-orange-400/40',
  medium:   'bg-yellow-500/20 text-yellow-400 border-yellow-400/40',
  low:      'bg-blue-500/20 text-blue-400 border-blue-400/40',
  none:     'bg-gray-500/20 text-gray-400 border-gray-400/40',
}

const STATUS_COLORS: Record<CVEStatus, string> = {
  new: 'text-cyber-cyan', analyzed: 'text-yellow-400', patched: 'text-cyber-green', na: 'text-text-muted',
}

export default function CVEDetail() {
    const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [cve, setCve] = useState<CVEEntry | null>(null)
  const [loading, setLoading]       = useState(true)
  const [deleting, setDeleting]     = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [kevEntry, setKevEntry]     = useState<CISAKEVEntry | null>(null)
  const [epss, setEpss]             = useState<EPSSScore | null>(null)

  const STATUS_LABELS: Record<CVEStatus, string> = {
    new: `Nouveau`,
    analyzed: `Analysé`,
    patched: `Patché`,
    na: `N/A`,
  }

  useEffect(() => {
    if (!id) return
    cveApi.get(Number(id))
      .then((data) => {
        setCve(data)
        // Enrichissement KEV + EPSS en parallèle
        cisaApi.checkKEV(data.cve_id)
          .then((r) => { if (r.exploited && r.entry) setKevEntry(r.entry) })
          .catch(() => {})
        cisaApi.getEPSS(data.cve_id)
          .then(setEpss)
          .catch(() => {})
      })
      .catch(() => navigate('/cve'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleDelete = async () => {
    if (!cve) return
    setDeleting(true)
    try {
      await cveApi.delete(cve.id)
      toast.success(`CVE ${cve.cve_id} supprimée`)
      navigate('/cve')
    } catch {
      toast.error(`Erreur lors de la sauvegarde`)
      setDeleting(false)
    }
  }

  if (loading) {
    return <div className="p-6 animate-pulse space-y-4">
      <div className="h-8 bg-bg-secondary rounded w-1/4" />
      <div className="h-32 bg-bg-secondary rounded" />
    </div>
  }
  if (!cve) return null

  const products = cve.products ? cve.products.split(',').map((p) => p.trim()).filter(Boolean) : []
  const nvdUrl = `https://nvd.nist.gov/vuln/detail/${cve.cve_id}`

  return (
    <div className="p-6 max-w-3xl space-y-6">
      {/* Back + actions */}
      <div className="flex items-center justify-between">
        <Link to="/cve" className="flex items-center gap-2 text-text-muted hover:text-text-primary text-sm transition-colors">
          <ArrowLeft size={16} />
          {`Retour aux CVE`}
        </Link>
        <div className="flex gap-2">
          <Link
            to={`/cve/${cve.id}/edit`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-border text-text-secondary hover:text-cyber-cyan hover:border-cyber-cyan/40 transition-colors"
          >
            <Edit size={14} />
            {`Modifier`}
          </Link>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-border text-text-secondary hover:text-cyber-red hover:border-cyber-red/40 transition-colors"
          >
            <Trash2 size={14} />
            {deleting ? '...' : `Supprimer`}
          </button>
        </div>
      </div>

      {/* Main card */}
      <div className="card space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-xs px-2 py-0.5 rounded border capitalize font-medium ${SEV_COLORS[cve.severity]}`}>
                {cve.severity}
              </span>
              {cve.cvss_score > 0 && (
                <span className="text-xs font-mono text-text-secondary">
                  {`Score CVSS`}: <span className="text-text-primary font-bold">{cve.cvss_score.toFixed(1)}</span>
                </span>
              )}
              <span className={`text-xs font-medium ${STATUS_COLORS[cve.status]}`}>
                {STATUS_LABELS[cve.status]}
              </span>
            </div>
            <h1 className="text-2xl font-bold font-mono text-cyber-cyan">{cve.cve_id}</h1>
          </div>
          <a
            href={nvdUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-text-muted hover:text-cyber-cyan transition-colors"
          >
            <ExternalLink size={13} />
            NVD
          </a>
        </div>

        {cve.description && (
          <p className="text-text-secondary text-sm leading-relaxed">{cve.description}</p>
        )}

        {/* CVSS bar */}
        {cve.cvss_score > 0 && (
          <div>
            <div className="flex justify-between text-xs text-text-muted mb-1">
              <span>{`CVSS:`}</span>
              <span className="text-text-primary font-mono font-bold">{cve.cvss_score.toFixed(1)} / 10</span>
            </div>
            <div className="h-2 bg-bg-hover rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  cve.cvss_score >= 9 ? 'bg-cyber-red' :
                  cve.cvss_score >= 7 ? 'bg-orange-400' :
                  cve.cvss_score >= 4 ? 'bg-yellow-400' : 'bg-blue-400'
                }`}
                style={{ width: `${(cve.cvss_score / 10) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Products */}
        {products.length > 0 && (
          <div>
            <p className="text-xs text-text-muted mb-2">{`Produits affectés`}</p>
            <div className="flex flex-wrap gap-2">
              {products.map((p, i) => (
                <span key={i} className="text-xs bg-bg-hover border border-border px-2 py-0.5 rounded text-text-secondary">
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border text-xs text-text-muted">
          <div>
            <span>{`Publié le`}</span>
            <p className="text-text-secondary mt-0.5">
              {cve.published_at ? new Date(cve.published_at).toLocaleDateString('fr-FR') : '—'}
            </p>
          </div>
          <div>
            <span>{`Ajouté le`}</span>
            <p className="text-text-secondary mt-0.5">
              {new Date(cve.created_at).toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>
      </div>

      {/* Section CISA KEV */}
      {kevEntry && (
        <div className="card border-red-500/40 bg-red-900/5">          <h2 className="text-sm font-semibold text-red-400 mb-3 uppercase tracking-wider flex items-center gap-2">
            <Flame size={15} className="animate-pulse" />
            Exploitation active — CISA KEV
          </h2>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-text-muted block mb-0.5">Produit</span>
              <span className="text-text-primary">{kevEntry.vendor_project} · {kevEntry.product}</span>
            </div>
            <div>
              <span className="text-text-muted block mb-0.5">Ajouté au KEV le</span>
              <span className="text-red-400 font-semibold">{kevEntry.date_added}</span>
            </div>
            <div>
              <span className="text-text-muted block mb-0.5">Action requise</span>
              <span className="text-text-primary">{kevEntry.required_action}</span>
            </div>
            <div>
              <span className="text-text-muted block mb-0.5">Date limite de remédiation</span>
              <span className="text-orange-400 font-semibold">{kevEntry.due_date || '—'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Section EPSS */}
      {epss && (
        <div className="card">
          <h2 className="text-sm font-semibold text-cyber-cyan mb-3 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp size={15} />
            EPSS Score
          </h2>
          <p className="text-xs text-text-muted mb-3">
            Probabilité d'exploitation dans les 30 prochains jours :{' '}
            <span className={`font-bold ${
              epss.score >= 0.7 ? 'text-red-400' :
              epss.score >= 0.3 ? 'text-orange-400' : 'text-gray-400'
            }`}>
              {(epss.score * 100).toFixed(1)}%
            </span>
            {' '}· Percentile {(epss.percentile * 100).toFixed(0)}e
          </p>
          <div className="h-2 bg-bg-hover rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                epss.score >= 0.7 ? 'bg-red-500' :
                epss.score >= 0.3 ? 'bg-orange-400' : 'bg-gray-500'
              }`}
              style={{ width: `${epss.score * 100}%` }}
            />
          </div>
          <p className="text-xs text-text-muted mt-2 opacity-60">Source : FIRST.org · {epss.date}</p>
        </div>
      )}

      {/* Notes */}
      {cve.notes && (
        <div className="card">
          <h2 className="text-sm font-semibold text-cyber-cyan mb-3 uppercase tracking-wider">
            📝 Notes & Analyse
          </h2>
          <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-wrap">{cve.notes}</p>
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        title={`Supprimer`}
        message={`Supprimer ${cve.cve_id} ? Cette action est irréversible.`}
        confirmLabel={`Supprimer`}
        danger
        onConfirm={() => { setConfirmOpen(false); handleDelete() }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
