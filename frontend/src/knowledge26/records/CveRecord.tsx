import type { CVEEntry } from '@/types'
import type { CISAKEVEntry, EPSSScore } from '@/types/threat_intel'
import { CvssMeter, SeverityBadge, StatusBadge, formatDay, splitProducts } from '@/cve26/parts'
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
  return kev.value ? 'Exploitation confirmée · CISA KEV' : 'Absente du catalogue local'
}
function epssText(epss?: Enrichment<EPSSScore>) {
  if (!epss || epss.status === 'loading') return 'Chargement…'
  if (epss.status === 'error') return UNAVAILABLE
  return epss.value ? `${(epss.value.score * 100).toFixed(1)} % · percentile ${(epss.value.percentile * 100).toFixed(1)} · FIRST.org ${epss.value.date}` : 'Aucun score obtenu'
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
    </Section>

    <Section index="02" title="INTELLIGENCE">
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

    <Section index="03" title="CONTENT" aside={`Produits affectés · ${products.length}`}>
      {products.length
        ? <ul className="ka-plain-list">{products.map(product => <li key={product}>{product}</li>)}</ul>
        : <p className="ka-empty-note">Aucun produit renseigné.</p>}
    </Section>

    <Section index="04" title="ANALYST DATA">
      {c.notes?.trim() ? <Prose>{c.notes}</Prose> : <p className="ka-empty-note">Aucune note d’analyse. « Modifier » permet d’en ajouter.</p>}
    </Section>
  </>
}
