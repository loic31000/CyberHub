import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { cveApi, cisaApi } from '@/api/client'
import type { CVEEntry } from '@/types'
import type { CISAKEVEntry, EPSSScore } from '@/types/threat_intel'
import { AlertTriangle, ArrowLeft, Edit, ExternalLink, Flame, Trash2 } from 'lucide-react'
import ConfirmModal from '@/components/ConfirmModal'
import { toast } from '@/store/toast'
import CveHero from '@/cve26/CveHero'
import { SEVERITY_LABEL, SeverityBadge, cvssBand, SignalPanel, StatusBadge, formatDay, splitProducts } from '@/cve26/parts'
import '@/cve26/cve.css'

/*
 * An enrichment (CISA KEV, EPSS) has three outcomes the page keeps apart:
 * still loading, answered (with a value or none), or failed. A failure is
 * never shown as "not exploited" or "no score".
 */
type Enrichment<T> = { status: 'loading' } | { status: 'ready'; value: T | null } | { status: 'error' }

const httpStatus = (err: unknown) => (err as { response?: { status?: number } })?.response?.status

// One decimal, truncated: 0.998 reads 99,8 and never rounds up to 100.
const formatPercentile = (p: number) => (Math.floor(p * 1000) / 10).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function EnrichmentNote({ tone, children, onRetry }: { tone: 'muted' | 'warn'; children: React.ReactNode; onRetry?: () => void }) {
  return (
    <div role="status" className={`cv26-note${tone === 'warn' ? ' is-warn' : ''}`}>
      <span>{children}</span>
      {onRetry && <button type="button" className="cv26-btn" onClick={onRetry}>Réessayer</button>}
    </div>
  )
}


export default function CVEDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [cve, setCve] = useState<CVEEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [kev, setKev] = useState<Enrichment<CISAKEVEntry>>({ status: 'loading' })
  const [kevAttempt, setKevAttempt] = useState(0)
  const [epss, setEpss] = useState<Enrichment<EPSSScore>>({ status: 'loading' })
  const [epssAttempt, setEpssAttempt] = useState(0)

  // The entry itself; a request for a previous id is cancelled and ignored.
  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    const { signal } = controller
    setLoading(true)
    setLoadError(false)
    setCve(null)
    cveApi.get(Number(id), signal)
      .then((data) => { if (!signal.aborted) setCve(data) })
      .catch((err) => {
        if (signal.aborted) return
        if (httpStatus(err) === 404) {
          toast.error('CVE introuvable')
          navigate('/cve', { replace: true })
        } else setLoadError(true)
      })
      .finally(() => { if (!signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [id, navigate, loadAttempt])

  const cveId = cve?.cve_id
  useEffect(() => {
    if (!cveId) return
    const controller = new AbortController()
    setKev({ status: 'loading' })
    cisaApi.checkKEV(cveId, controller.signal)
      .then((r) => { if (!controller.signal.aborted) setKev({ status: 'ready', value: r.exploited ? r.entry : null }) })
      .catch(() => { if (!controller.signal.aborted) setKev({ status: 'error' }) })
    return () => controller.abort()
  }, [cveId, kevAttempt])

  // EPSS: a 404 means no usable score came back. The backend also answers 404
  // when FIRST.org's reply cannot be read, so the page does not claim that no
  // score exists. Anything else is a failure.
  useEffect(() => {
    if (!cveId) return
    const controller = new AbortController()
    setEpss({ status: 'loading' })
    cisaApi.getEPSS(cveId, controller.signal)
      .then((score) => { if (!controller.signal.aborted) setEpss({ status: 'ready', value: score }) })
      .catch((err) => {
        if (controller.signal.aborted) return
        setEpss(httpStatus(err) === 404 ? { status: 'ready', value: null } : { status: 'error' })
      })
    return () => controller.abort()
  }, [cveId, epssAttempt])

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
      <div className="cv26"><div className="cv26-frame">
        <CveHero status={{ text: 'CHARGEMENT', tone: 'busy' }} />
        <div className="cv26-loading" role="status">Chargement de la fiche…</div>
      </div></div>
    )
  }
  if (loadError) {
    return (
      <div className="cv26"><div className="cv26-frame">
        <CveHero status={{ text: 'FICHE INDISPONIBLE', tone: 'warn' }} />
        <div role="alert" className="cv26-state is-error">
          <AlertTriangle size={30} aria-hidden="true" />
          <h2>Impossible de charger cette CVE</h2>
          <p>Le backend local n’a pas répondu.</p>
          <div className="cv26-actions">
            <button type="button" className="cv26-btn" onClick={() => setLoadAttempt((n) => n + 1)}>Réessayer</button>
            <Link to="/cve" className="cv26-btn">Retour à l’index</Link>
          </div>
        </div>
      </div></div>
    )
  }
  if (!cve) return null

  const kevEntry = kev.status === 'ready' ? kev.value : null
  const epssScore = epss.status === 'ready' ? epss.value : null
  const products = splitProducts(cve.products)
  const nvdUrl = `https://nvd.nist.gov/vuln/detail/${cve.cve_id}`

  return (
    <div className="cv26">
      <div className="cv26-frame">
        <CveHero status={{ text: 'FICHE', mark: cve.cve_id }} />

        <nav className="cv26-crumbs" aria-label="Navigation">
          <Link to="/cve" className="cv26-link"><ArrowLeft size={14} aria-hidden="true" /> Index CVE &amp; KEV</Link>
          <a href={nvdUrl} target="_blank" rel="noopener noreferrer" className="cv26-link">
            Fiche NVD <ExternalLink size={13} aria-hidden="true" />
          </a>
        </nav>

        <article className="cv26-dossier" data-severity={cve.severity} aria-labelledby="cv26-cve-title">
          <header className="cv26-dossier-head">
            <div>
              <h2 id="cv26-cve-title">{cve.cve_id}</h2>
              <div className="cv26-dossier-tags">
                <SeverityBadge severity={cve.severity} />
                <StatusBadge status={cve.status} />
                {kevEntry && <span className="cv26-kev"><Flame size={11} aria-hidden="true" />KEV</span>}
              </div>
            </div>
            <div className="cv26-dossier-actions">
              <Link to={`/cve/${cve.id}/edit`} className="cv26-btn"><Edit size={14} aria-hidden="true" /> Modifier</Link>
              <button type="button" className="cv26-btn is-danger" onClick={() => setConfirmOpen(true)} disabled={deleting}>
                <Trash2 size={14} aria-hidden="true" /> {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </header>

          {cve.description
            ? <p className="cv26-desc-full">{cve.description}</p>
            : <p className="cv26-desc-full cv26-muted">Aucune description enregistrée.</p>}

          <div className="cv26-signals">
            {/* CVSS: technical severity, as recorded in the local entry. */}
            <SignalPanel kind="cvss" title="Gravité CVSS" source="fiche locale">
              {cve.cvss_score > 0 ? (
                <>
                  <div className="cv26-signal-figure"><b>{cve.cvss_score.toFixed(1)}</b><small>/ 10 · {SEVERITY_LABEL[cve.severity]}</small></div>
                  <div className="cv26-track" data-severity={cve.severity} aria-hidden="true"><i style={{ width: `${(cve.cvss_score / 10) * 100}%` }} /></div>
                  <div className="cv26-track-scale" aria-hidden="true">
                    {[0, 4, 7, 9, 10].map(mark => <span key={mark} style={{ left: `${mark * 10}%` }}>{mark}</span>)}
                  </div>
                  {/* The recorded severity is kept as is: it may be an analyst's or another CVSS version's rating. */}
                  {cvssBand(cve.cvss_score) !== cve.severity && (
                    <p className="cv26-signal-aside">
                      Sévérité enregistrée « {SEVERITY_LABEL[cve.severity]} » ; le score {cve.cvss_score.toFixed(1)} correspond à « {SEVERITY_LABEL[cvssBand(cve.cvss_score)]} » dans les plages CVSS v3.x. La version CVSS de la fiche n’est pas enregistrée.
                    </p>
                  )}
                </>
              ) : (
                <p>Score CVSS enregistré : 0.0. La fiche ne distingue pas un score non évalué d’un score nul.</p>
              )}
            </SignalPanel>

            {/* CISA KEV: confirmed exploitation, independent from CVSS and EPSS. */}
            <SignalPanel kind="kev" title="Exploitation CISA KEV" source="catalogue KEV local">
              {kev.status === 'loading' && <EnrichmentNote tone="muted">Vérification CISA KEV…</EnrichmentNote>}
              {kev.status === 'error' && (
                <EnrichmentNote tone="warn" onRetry={() => setKevAttempt((n) => n + 1)}>
                  Statut CISA KEV indisponible : impossible de dire si cette CVE est exploitée activement.
                </EnrichmentNote>
              )}
              {kev.status === 'ready' && !kevEntry && <EnrichmentNote tone="muted">Absente du catalogue CISA KEV local.</EnrichmentNote>}
              {kevEntry && (
                <div className="cv26-kev-yes">
                  <h3><Flame size={15} aria-hidden="true" />EXPLOITATION ACTIVE — CISA KEV</h3>
                  <dl className="cv26-kev-facts">
                    <div><dt>Produit</dt><dd>{kevEntry.vendor_project} · {kevEntry.product}</dd></div>
                    {kevEntry.vulnerability_name && <div><dt>Nom</dt><dd>{kevEntry.vulnerability_name}</dd></div>}
                    <div><dt>Ajoutée le</dt><dd>{kevEntry.date_added || '—'}</dd></div>
                    <div><dt>Action</dt><dd>{kevEntry.required_action}</dd></div>
                    <div><dt>Échéance</dt><dd>{kevEntry.due_date || '—'}</dd></div>
                  </dl>
                </div>
              )}
            </SignalPanel>

            {/* EPSS: probability of exploitation in the next 30 days, from FIRST.org. */}
            <SignalPanel kind="epss" title="Probabilité EPSS" source={epssScore?.date ? `FIRST.org · ${epssScore.date}` : 'FIRST.org'}>
              {epss.status === 'loading' && <EnrichmentNote tone="muted">Récupération du score EPSS…</EnrichmentNote>}
              {epss.status === 'error' && (
                <EnrichmentNote tone="warn" onRetry={() => setEpssAttempt((n) => n + 1)}>
                  Score EPSS indisponible : la récupération auprès de FIRST.org a échoué.
                </EnrichmentNote>
              )}
              {epss.status === 'ready' && !epssScore && (
                <EnrichmentNote tone="muted">Aucun score EPSS obtenu pour cette CVE : FIRST.org n’en publie peut-être pas, ou sa réponse était inexploitable.</EnrichmentNote>
              )}
              {epssScore && (
                <>
                  <div className="cv26-signal-figure"><b>{(epssScore.score * 100).toFixed(1)}%</b><small>probabilité estimée d’exploitation sur 30 jours</small></div>
                  <div className="cv26-track" aria-hidden="true"><i style={{ width: `${Math.min(100, epssScore.score * 100)}%` }} /></div>
                  <p>Percentile <b>{formatPercentile(epssScore.percentile)}</b> : score plus élevé que {formatPercentile(epssScore.percentile)} % des CVE notées par FIRST.org.</p>
                  <p className="cv26-signal-aside">Estimation statistique de FIRST.org, pas une exploitation observée : l’exploitation confirmée relève de CISA KEV.</p>
                </>
              )}
            </SignalPanel>
          </div>

          <div>
            <h3 className="cv26-section-title">Produits concernés</h3>
            {products.length > 0
              ? <ul className="cv26-product-list">{products.map(p => <li key={p}>{p}</li>)}</ul>
              : <p className="cv26-pending">Aucun produit renseigné.</p>}
          </div>

          <dl className="cv26-facts" aria-label="Dates et provenance">
            <div><dt>Publiée le</dt><dd>{formatDay(cve.published_at)}</dd></div>
            <div><dt>Ajoutée à l’index</dt><dd>{formatDay(cve.created_at)}</dd></div>
            <div><dt>Modifiée le</dt><dd>{formatDay(cve.updated_at)}</dd></div>
            <div><dt>Référence</dt><dd><a href={nvdUrl} target="_blank" rel="noopener noreferrer" className="cv26-link">nvd.nist.gov <ExternalLink size={12} aria-hidden="true" /></a></dd></div>
          </dl>

          {cve.notes && (
            <div>
              <h3 className="cv26-section-title">Notes &amp; analyse</h3>
              <p className="cv26-notes">{cve.notes}</p>
            </div>
          )}
        </article>
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
