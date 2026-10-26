import type { CVEEntry } from '@/types'
import type { CISAKEVEntry, EPSSScore } from '@/types/threat_intel'
import { CvssMeter, SEVERITY_LABEL, SeverityBadge, StatusBadge, formatDay, splitProducts } from '@/cve26/parts'
import Learn from '@/learning/Learn'
import type { LearningEvidence } from '@/learning/types'
import type { KnowledgeItem } from '../model'
import { Fact, Facts, Prose, Section, Subhead } from './parts'

/*
 * CVE dossier — parity with CVEDetail: description, status and dates, CVSS
 * with its scale, CISA KEV (required action and due date), EPSS, affected
 * products and the analyst's notes. KEV/EPSS failures stay distinct from a
 * negative answer ("Indisponible" vs "Absente" / "Aucun score").
 */

export type Enrichment<T> = { status: 'loading' } | { status: 'ready'; value: T | null } | { status: 'error' }

const UNAVAILABLE = 'Indisponible (erreur réseau)'

function kevText(kev?: Enrichment<CISAKEVEntry>) {
  if (!kev || kev.status === 'loading') return 'Vérification…'
  if (kev.status === 'error') return UNAVAILABLE
  return kev.value ? 'Exploitation connue · CISA KEV' : 'Absente du catalogue local'
}
function epssText(epss?: Enrichment<EPSSScore>) {
  if (!epss || epss.status === 'loading') return 'Chargement…'
  if (epss.status === 'error') return UNAVAILABLE
  return epss.value ? `${(epss.value.score * 100).toFixed(1)} % · percentile ${(epss.value.percentile * 100).toFixed(1)} · FIRST.org ${epss.value.date}` : 'Aucun score obtenu'
}

/*
 * Learning evidence (#78): only values actually present on this record, with
 * their source. A pending or failed enrichment yields no evidence (sober
 * fallback) rather than a guess.
 */
function cvssEvidence(score: number, severity: CVEEntry['severity']): LearningEvidence[] {
  if (!(score > 0)) return []
  return [{ label: 'Score de base', value: `${score.toFixed(1)} / 10`, source: 'Fiche CVE CyberHub' }, { label: 'Sévérité enregistrée', value: SEVERITY_LABEL[severity] ?? severity }]
}
function kevEvidence(kev?: Enrichment<CISAKEVEntry>): LearningEvidence[] {
  if (kev?.status !== 'ready') return []
  if (!kev.value) return [{ label: 'Catalogue KEV', value: 'Absente du catalogue local', source: 'CISA KEV' }]
  return [
    { label: 'Catalogue KEV', value: 'Présente', source: 'CISA KEV' },
    ...(kev.value.date_added ? [{ label: 'Ajoutée le', value: kev.value.date_added }] : []),
    ...(kev.value.due_date ? [{ label: 'Échéance CISA', value: kev.value.due_date }] : []),
  ]
}
function epssEvidence(epss?: Enrichment<EPSSScore>): LearningEvidence[] {
  if (epss?.status !== 'ready') return []
  if (!epss.value) return [{ label: 'Score EPSS', value: 'Aucun score publié', source: 'FIRST.org' }]
  return [
    { label: 'Probabilité', value: `${(epss.value.score * 100).toFixed(1)} %`, source: `FIRST.org · ${epss.value.date}` },
    { label: 'Percentile', value: (epss.value.percentile * 100).toFixed(1) },
  ]
}

export default function CveRecord({ item, kev, epss }: { item: KnowledgeItem; kev?: Enrichment<CISAKEVEntry>; epss?: Enrichment<EPSSScore> }) {
  const c = item.original as CVEEntry
  const score = Number(c.cvss_score)
  const products = splitProducts(c.products)
  const entry = kev?.status === 'ready' ? kev.value : null
  return <>
    <Section index="01" title="OVERVIEW">
      <Prose>{c.description?.trim() || 'Description non disponible.'}</Prose>
      <Facts>
        <Fact label="Statut"><StatusBadge status={c.status} /></Fact>
        <Fact label="Sévérité"><SeverityBadge severity={c.severity} /></Fact>
      </Facts>
      <Subhead>Chronologie</Subhead>
      <Facts>
        <Fact label="Publication">{formatDay(c.published_at)}</Fact>
        <Fact label="Modification">{formatDay(c.updated_at)}</Fact>
      </Facts>
      <Learn id="cve" />
    </Section>

    <Section index="02" title="INTELLIGENCE" lead="Trois signaux distincts : gravité (CVSS), exploitation connue (KEV), probabilité (EPSS).">
      <div className="ka-intel">
        <div className="ka-intel-col" data-severity={c.severity}>
          <span className="ka-intel-label">CVSS</span>
          <CvssMeter score={score} severity={c.severity} />
          <span className="ka-cvss-scale" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(10, score)) * 10}%` }} /></span>
          <small>Score de base · échelle 0–10</small>
        </div>
        <div className="ka-intel-col" data-kev={entry ? 'true' : undefined}>
          <span className="ka-intel-label">CISA KEV</span>
          <strong>{kevText(kev)}</strong>
          {entry && <small>Ajoutée le {entry.date_added || '—'}</small>}
        </div>
        <div className="ka-intel-col">
          <span className="ka-intel-label">EPSS</span>
          <strong>{epssText(epss)}</strong>
          <small>Probabilité d’exploitation, distincte de l’exploitation confirmée</small>
        </div>
      </div>
      <div className="lr-columns">
        <Learn id="cvss" evidence={cvssEvidence(score, c.severity)} />
        <Learn id="kev" evidence={kevEvidence(kev)} />
        <Learn id="epss" evidence={epssEvidence(epss)} />
      </div>
      {entry && <>
        <Subhead>Fiche CISA KEV</Subhead>
        <Facts>
          <Fact label="Éditeur · produit">{entry.vendor_project} · {entry.product}</Fact>
          <Fact label="Vulnérabilité">{entry.vulnerability_name || '—'}</Fact>
          <Fact label="Échéance">{entry.due_date || '—'}</Fact>
          <Fact label="Action requise" span>{entry.required_action || '—'}</Fact>
        </Facts>
      </>}
    </Section>

    <Section index="03" title="AFFECTED SCOPE" aside={`Produits affectés · ${products.length}`}>
      {products.length
        ? <ul className="ka-plain-list">{products.map(product => <li key={product}>{product}</li>)}</ul>
        : <p className="ka-empty-note">Aucun produit renseigné.</p>}
    </Section>

    <Section index="04" title="ANALYST NOTES">
      {c.notes?.trim() ? <Prose>{c.notes}</Prose> : <p className="ka-empty-note">Aucune note d’analyse. « Modifier » permet d’en ajouter.</p>}
    </Section>
  </>
}
