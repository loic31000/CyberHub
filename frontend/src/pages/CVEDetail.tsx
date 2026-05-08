import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { cveApi, cisaApi } from '@/api/client'
import type { CVEEntry, CVEStatus } from '@/types'
import type { CISAKEVEntry, EPSSScore } from '@/types/threat_intel'
import { ArrowLeft, Edit, Trash2, ExternalLink, Flame, TrendingUp, ShieldAlert } from 'lucide-react'
import ConfirmModal from '@/components/ConfirmModal'
import { toast } from '@/store/toast'

const SEV_COLORS: Record<string, string> = {
  critical: 'border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444]',
  high:     'border-[#f97316]/30 bg-[#f97316]/10 text-[#f97316]',
  medium:   'border-[#eab308]/30 bg-[#eab308]/10 text-[#eab308]',
  low:      'border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[#3b82f6]',
  none:     'border-[#64748b]/30 bg-[#64748b]/10 text-[#64748b]',
}

const STATUS_COLORS: Record<CVEStatus, string> = {
  new:      'text-[#00d4ff]',
  analyzed: 'text-[#eab308]',
  patched:  'text-[#10b981]',
  na:       'text-[#64748b]',
}

const STATUS_LABELS: Record<CVEStatus, string> = {
  new:      'NOUVEAU',
  analyzed: 'ANALYSÉ',
  patched:  'PATCHÉ',
  na:       'N/A',
}

export default function CVEDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [cve, setCve] = useState<CVEEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [kevEntry, setKevEntry] = useState<CISAKEVEntry | null>(null)
  const [epss, setEpss] = useState<EPSSScore | null>(null)

  useEffect(() => {
    if (!id) return
    cveApi.get(Number(id))
      .then((data) => {
        setCve(data)
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
      toast.error('Erreur lors de la suppression')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#06080f]">
        <p className="font-mono text-xs text-[#64748b]">CHARGEMENT...</p>
      </div>
    )
  }
  if (!cve) return null

  const products = cve.products ? cve.products.split(',').map(p => p.trim()).filter(Boolean) : []
  const nvdUrl = `https://nvd.nist.gov/vuln/detail/${cve.cve_id}`

  return (
    <div className="flex flex-col h-full bg-[#06080f] text-[#f1f5f9]">
      {/* Bandeau d'en-tête style BGPLookup */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d40] bg-[#0a0f16]/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <ShieldAlert className="text-[#00d4ff]" size={20} />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#10b981] rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-[0.2em] uppercase">CVE WATCH // DETAIL</h1>
            <p className="text-[10px] text-[#64748b] font-mono">
              {cve.cve_id} • {cve.severity.toUpperCase()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/cve"
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1e2d40] hover:bg-[#2a3f55] text-[10px] font-bold border border-[#334155] transition-colors"
          >
            <ArrowLeft size={12} /> BACK TO INDEX
          </Link>
        </div>
      </div>

      {/* Zone de contenu scrollable */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Carte principale */}
        <div className="border border-[#1e2d40] bg-[#0a0f16] p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${SEV_COLORS[cve.severity]}`}>
                {cve.severity}
              </span>
              {cve.cvss_score > 0 && (
                <span className="text-[11px] font-mono text-[#8a9ab0]">
                  CVSS <span className="text-[#f1f5f9] font-bold">{cve.cvss_score.toFixed(1)}</span>
                </span>
              )}
              <span className={`text-[11px] font-mono font-bold uppercase tracking-wider ${STATUS_COLORS[cve.status]}`}>
                {STATUS_LABELS[cve.status]}
              </span>
            </div>
            <a
              href={nvdUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] font-mono text-[#4a6480] hover:text-[#00d4ff] transition-colors"
            >
              <ExternalLink size={12} /> NVD
            </a>
          </div>

          <h1 className="break-words font-mono text-2xl font-bold uppercase tracking-[0.15em] text-[#00d4ff]">
            {cve.cve_id}
          </h1>

          {cve.description && (
            <p className="font-mono text-[13px] leading-relaxed text-[#cbd5e1]">
              {cve.description}
            </p>
          )}

          {/* Barre CVSS */}
          {cve.cvss_score > 0 && (
            <div>
              <div className="flex justify-between text-[10px] font-mono text-[#64748b] mb-1">
                <span>SCORE CVSS</span>
                <span className="text-[#f1f5f9] font-bold">{cve.cvss_score.toFixed(1)} / 10</span>
              </div>
              <div className="h-1.5 bg-[#1e2d40] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    cve.cvss_score >= 9 ? 'bg-[#ef4444]' :
                    cve.cvss_score >= 7 ? 'bg-[#f97316]' :
                    cve.cvss_score >= 4 ? 'bg-[#eab308]' : 'bg-[#3b82f6]'
                  }`}
                  style={{ width: `${(cve.cvss_score / 10) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Produits */}
          {products.length > 0 && (
            <div>
              <p className="text-[10px] font-mono text-[#4a6480] mb-2 uppercase tracking-widest">PRODUITS AFFECTÉS</p>
              <div className="flex flex-wrap gap-2">
                {products.map((p, i) => (
                  <span key={i} className="text-[11px] font-mono bg-[#0d131f] border border-[#1e2d40] px-2 py-1 text-[#8a9ab0]">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#1e2d40]">
            <div>
              <p className="text-[10px] font-mono text-[#4a6480] uppercase tracking-widest">PUBLIÉ LE</p>
              <p className="text-[11px] font-mono text-[#f1f5f9] mt-1">
                {cve.published_at ? new Date(cve.published_at).toLocaleDateString('fr-FR') : '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-[#4a6480] uppercase tracking-widest">AJOUTÉ LE</p>
              <p className="text-[11px] font-mono text-[#f1f5f9] mt-1">
                {new Date(cve.created_at).toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex gap-3 pt-2 border-t border-[#1e2d40]">
            <Link
              to={`/cve/${cve.id}/edit`}
              className="flex items-center gap-2 border border-[#00d4ff]/20 bg-[#00d4ff]/10 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#00d4ff] transition-colors hover:bg-[#00d4ff]/20"
            >
              <Edit size={13} /> MODIFIER
            </Link>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={deleting}
              className="flex items-center gap-2 border border-[#ef4444]/20 bg-[#ef4444]/10 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ef4444] transition-colors hover:bg-[#ef4444]/20 disabled:opacity-50"
            >
              <Trash2 size={13} /> {deleting ? '...' : 'SUPPRIMER'}
            </button>
          </div>
        </div>

        {/* Section CISA KEV */}
        {kevEntry && (
          <div className="border-l-2 border-[#ef4444] bg-[#ef4444]/5 p-5">
            <h2 className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#ef4444] mb-3">
              <Flame size={14} className="animate-pulse" /> EXPLOITATION ACTIVE — CISA KEV
            </h2>
            <div className="grid grid-cols-1 gap-3 text-[11px] font-mono sm:grid-cols-2">
              <div>
                <span className="text-[#4a6480]">PRODUIT :</span>{' '}
                <span className="text-[#f1f5f9]">{kevEntry.vendor_project} · {kevEntry.product}</span>
              </div>
              <div>
                <span className="text-[#4a6480]">AJOUTÉ LE :</span>{' '}
                <span className="text-[#ef4444] font-bold">{kevEntry.date_added}</span>
              </div>
              <div>
                <span className="text-[#4a6480]">ACTION REQUISE :</span>{' '}
                <span className="text-[#f1f5f9]">{kevEntry.required_action}</span>
              </div>
              <div>
                <span className="text-[#4a6480]">DATE LIMITE :</span>{' '}
                <span className="text-[#f97316] font-bold">{kevEntry.due_date || '—'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Section EPSS */}
        {epss && (
          <div className="border border-[#1e2d40] bg-[#0a0f16] p-5">
            <h2 className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#00d4ff] mb-3">
              <TrendingUp size={14} /> EPSS SCORE
            </h2>
            <p className="text-[11px] font-mono text-[#8a9ab0] mb-2">
              Probabilité d’exploitation dans les 30 prochains jours :
              <span className={`ml-2 font-bold ${
                epss.score >= 0.7 ? 'text-[#ef4444]' :
                epss.score >= 0.3 ? 'text-[#f97316]' : 'text-[#64748b]'
              }`}>
                {(epss.score * 100).toFixed(1)}%
              </span>
              {' · '}Percentile {(epss.percentile * 100).toFixed(0)}e
            </p>
            <div className="h-1.5 bg-[#1e2d40] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  epss.score >= 0.7 ? 'bg-[#ef4444]' :
                  epss.score >= 0.3 ? 'bg-[#f97316]' : 'bg-[#64748b]'
                }`}
                style={{ width: `${epss.score * 100}%` }}
              />
            </div>
            <p className="text-[10px] font-mono text-[#4a6480] mt-2">Source : FIRST.org · {epss.date}</p>
          </div>
        )}

        {/* Notes d'analyse */}
        {cve.notes && (
          <div className="border border-[#1e2d40] bg-[#0a0f16] p-5">
            <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a9ab0] mb-3">
              📝 NOTES & ANALYSE
            </h2>
            <div className="prose prose-invert prose-sm max-w-none text-[#cbd5e1] [&_code]:bg-[#0d131f] [&_code]:border [&_code]:border-[#1e2d40] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[#00d4ff] [&_code]:font-mono [&_code]:text-xs">
              <p className="whitespace-pre-wrap font-mono text-sm">{cve.notes}</p>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="SUPPRIMER CETTE CVE ?"
        message={`"${cve.cve_id}" — CETTE ACTION EST IRRÉVERSIBLE.`}
        confirmLabel="SUPPRIMER"
        danger
        onConfirm={() => { setConfirmOpen(false); handleDelete() }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}