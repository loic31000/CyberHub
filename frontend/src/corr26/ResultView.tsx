import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import type { CorrelationResult, CorrelationTechnique } from '@/types/correlation'
import { readableTactics } from '@/ioc26/intelligenceData'
import Learn from '@/learning/Learn'
import LearningModeSwitch from '@/learning/LearningModeSwitch'
import { useLearningMode } from '@/learning/preferences'
import type { LearningEvidence } from '@/learning/types'
import CorrelationMap from './CorrelationMap'
import { confidenceOf, formatDayTime, groupsOf, type GroupId } from './parts'

/*
 * "Why does CyberHub show me this?" (#78). The evidence is only what the
 * engine really used: its rationale, its confidence and the groups that hold
 * matches. A missing field is left out — no justification is written here.
 */
function correlationEvidence(result: CorrelationResult): LearningEvidence[] {
  const confidence = typeof result.confidence === 'number' ? confidenceOf(result.confidence) : null
  return [
    ...(result.rationale?.trim() ? [{ label: 'Lecture du moteur', value: result.rationale, source: 'Moteur de corrélation CyberHub' }] : []),
    ...(confidence ? [{ label: 'Confiance', value: `${confidence.pct} % · ${confidence.label}` }] : []),
    ...groupsOf(result).filter(group => group.count > 0).map(group => ({ label: group.label, value: String(group.count), source: 'Bases locales CyberHub' })),
  ]
}

/*
 * One correlation result read as an investigation: the map first, then the
 * engine's reading and what to do next, then numbered chapters that only
 * exist when the result holds matches for them. Each chapter has its own
 * shape so techniques, vulnerabilities and next moves never look alike.
 */
export default function ResultView({ result, actions }: { result: CorrelationResult; actions: ReactNode }) {
  const next = result.next_actions ?? []
  // In guided mode the rationale and next actions are read inside the Learning block, once.
  const guided = useLearningMode() === 'guided'
  const context = [
    result.tools?.length, result.lolbins?.length, result.cloak_tactics?.length, result.notes?.length,
  ].some(Boolean)
  const respond = Boolean(result.playbooks?.length || result.investigations?.length || result.attack_layers?.length)
  const anything = Boolean(result.techniques?.length || result.cves?.length || respond || context)
  let chapter = 0
  const number = () => String(++chapter).padStart(2, '0')

  return (
    <article className="cr26-result">
      <CorrelationMap result={result} />

      <div className="cr26-reading">
        <div className="cr26-reading-text">
          <p className="cr26-meta">
            Analysé le {formatDayTime(result.generated_at)}
            {result.from_cache && <span> · résultat en cache</span>}
          </p>
          {result.rationale && !guided && <p className="cr26-rationale">{result.rationale}</p>}
          <Learn id="correlation" evidence={correlationEvidence(result)} next={next.length ? next : undefined} />
          <LearningModeSwitch />
        </div>
        <div className="cr26-actions">{actions}</div>
      </div>

      {next.length > 0 && !guided && (
        <section className="cr26-next" aria-labelledby="cr26-next-title">
          <h3 id="cr26-next-title">Prochaines étapes</h3>
          <ol>{next.map((action, i) => <li key={i}><span aria-hidden="true">{i + 1}</span>{action}</li>)}</ol>
        </section>
      )}

      {!anything && <p className="cr26-nomatch">Aucune correspondance dans les données locales pour cet indicateur.</p>}

      {anything && (
        <div className="cr26-path">
          {result.techniques?.length > 0 && (
            <Chapter id="mitre" n={number()} title="Techniques MITRE ATT&CK" count={result.techniques.length}
              lead="Comportements adverses associés à l’indicateur, regroupés par tactique.">
              <Techniques techniques={result.techniques} />
            </Chapter>
          )}

          {result.cves?.length > 0 && (
            <Chapter id="cve" n={number()} title="CVE liées" count={result.cves.length}
              lead="Vulnérabilités critiques rapprochées (CVSS ≥ 7.0), de la plus grave à la moins grave.">
              <ul className="cr26-cves">
                {[...result.cves].sort((a, b) => b.cvss_score - a.cvss_score).map(cve => (
                  <li key={cve.cve_id} data-critical={cve.cvss_score >= 9 || undefined}>
                    <span className="cr26-cvss"><b>{cve.cvss_score.toFixed(1)}</b><small>CVSS</small></span>
                    <div>
                      <span className="cr26-id">{cve.cve_id}</span>
                      <p>{cve.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Chapter>
          )}

          {respond && (
            <Chapter id="playbooks" n={number()} title="Répondre" count={(result.playbooks?.length ?? 0) + (result.investigations?.length ?? 0) + (result.attack_layers?.length ?? 0)}
              lead="Procédures, dossiers et couvertures ATT&CK déjà présents dans CyberHub.">
              <div className="cr26-columns">
                {result.playbooks?.length > 0 && (
                  <Column id="playbooks-list" title="Playbooks suggérés" count={result.playbooks.length}>
                    <LinkList items={result.playbooks.map(p => ({ key: p.id, to: `/playbooks/${p.id}`, label: p.title }))} />
                  </Column>
                )}
                {result.investigations?.length > 0 && (
                  <Column id="investigations" title="Investigations liées" count={result.investigations.length}>
                    <LinkList items={result.investigations.map(i => ({ key: i.id, to: `/investigations/${i.id}`, label: i.title, meta: i.status }))} />
                  </Column>
                )}
                {result.attack_layers?.length > 0 && (
                  <Column id="layers" title="Layers ATT&CK" count={result.attack_layers.length}>
                    <LinkList items={result.attack_layers.map(l => ({ key: l.id, to: `/knowledge?workspace=layers&id=${l.id}`, label: l.name }))} />
                  </Column>
                )}
              </div>
            </Chapter>
          )}

          {context && (
            <Chapter id="tools" n={number()} title="Outils et contexte" count={(result.tools?.length ?? 0) + (result.lolbins?.length ?? 0) + (result.cloak_tactics?.length ?? 0) + (result.notes?.length ?? 0)}
              lead="De quoi mener l’analyse : outils, binaires détournables, OpSec et notes internes.">
              <div className="cr26-columns">
                {result.tools?.length > 0 && (
                  <Column id="tools-list" title="Outils recommandés" count={result.tools.length}>
                    <LinkList items={result.tools.map(t => ({ key: t.name, to: '/tools', label: t.name, meta: t.category }))} />
                  </Column>
                )}
                {result.lolbins?.length > 0 && (
                  <Column id="lolbins" title="LOLBins / GTFOBins" count={result.lolbins.length}>
                    <LinkList items={result.lolbins.map(l => ({ key: `${l.os}-${l.name}`, to: `/knowledge?source=lolbins&id=${encodeURIComponent(l.name)}`, label: l.name, meta: [l.os, l.category].filter(Boolean).join(' · ') }))} />
                  </Column>
                )}
                {result.cloak_tactics?.length > 0 && (
                  <Column id="cloak" title="CLOAK OpSec" count={result.cloak_tactics.length}>
                    <ul className="cr26-plain">
                      {result.cloak_tactics.map(t => <li key={t.name}><b>{t.name}</b>{t.description && <span>{t.description}</span>}</li>)}
                    </ul>
                  </Column>
                )}
                {result.notes?.length > 0 && (
                  <Column id="notes" title="Notes pertinentes" count={result.notes.length}>
                    <LinkList items={result.notes.map(n => ({ key: n.id, to: '/notes', label: n.title, meta: n.excerpt }))} />
                  </Column>
                )}
              </div>
            </Chapter>
          )}
        </div>
      )}
    </article>
  )
}

/* Techniques grouped under their first readable tactic, in the order they came. */
function Techniques({ techniques }: { techniques: CorrelationTechnique[] }) {
  const byTactic = new Map<string, { t: CorrelationTechnique; others: string[] }[]>()
  for (const t of techniques) {
    const [first = 'Sans tactique', ...others] = readableTactics(t.tactic)
    byTactic.set(first, [...(byTactic.get(first) ?? []), { t, others }])
  }
  return (
    <div className="cr26-tactic-groups">
      {[...byTactic].map(([tactic, rows]) => (
        <div key={tactic} className="cr26-tactic">
          <h4>{tactic}</h4>
          <ul>
            {rows.map(({ t, others }) => (
              <li key={t.technique_id}>
                <Link to={`/knowledge?source=mitre&id=${encodeURIComponent(t.technique_id)}`} aria-label={`${t.technique_id} ${t.name}, ouvrir dans Knowledge Atlas`}>
                  <span className="cr26-id">{t.technique_id}</span>
                  <span className="cr26-row-title">{t.name}</span>
                  {others.length > 0 && <span className="cr26-also">aussi : {others.join(', ')}</span>}
                  <ArrowUpRight size={15} aria-hidden="true" className="cr26-row-go" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function Chapter({ id, n, title, count, lead, children }: { id: GroupId; n: string; title: string; count: number; lead: string; children: ReactNode }) {
  return (
    <section id={`cr26-${id}`} className="cr26-chapter" aria-labelledby={`cr26-${id}-title`} tabIndex={-1}>
      <header className="cr26-chapter-head">
        <span className="cr26-chapter-n" aria-hidden="true">{n}</span>
        <h3 id={`cr26-${id}-title`}>{title}</h3>
        <span className="cr26-count">{count}</span>
        <p>{lead}</p>
      </header>
      <div className="cr26-chapter-body">{children}</div>
    </section>
  )
}

/* Sub-groups inside a chapter; their anchors keep the map's links working. */
function Column({ id, title, count, children }: { id: string; title: string; count: number; children: ReactNode }) {
  return (
    <section id={`cr26-${id}`} className="cr26-column" aria-label={title} tabIndex={-1}>
      <h4>{title} <span>{count}</span></h4>
      {children}
    </section>
  )
}

function LinkList({ items }: { items: { key: string | number; to: string; label: string; meta?: string }[] }) {
  return (
    <ul className="cr26-links">
      {items.map(item => (
        <li key={item.key}>
          <Link to={item.to}>
            <span className="cr26-link-label">{item.label}</span>
            {item.meta && <span className="cr26-link-meta">{item.meta}</span>}
            <ArrowUpRight size={14} aria-hidden="true" className="cr26-row-go" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
