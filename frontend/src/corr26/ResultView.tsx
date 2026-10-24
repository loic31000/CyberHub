import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import type { CorrelationResult } from '@/types/correlation'
import { readableTactics } from '@/ioc26/intelligenceData'
import { confidenceOf, formatDayTime, groupsOf, typeLabel, type GroupId } from './parts'

/*
 * One correlation result: the indicator and its score first, then a contents
 * line that jumps to each group, then the groups that matched. Groups with no
 * match are named once at the end instead of drawing empty boxes.
 */
export default function ResultView({ result, actions }: { result: CorrelationResult; actions: ReactNode }) {
  const c = confidenceOf(result.confidence)
  const groups = groupsOf(result)
  const found = groups.filter(g => g.count > 0)
  const missing = groups.filter(g => g.count === 0)
  const next = result.next_actions ?? []

  return (
    <article className="cr26-result" aria-labelledby="cr26-result-title">
      <header className="cr26-summary">
        <div className="cr26-summary-main">
          <span className="cr26-tag">{typeLabel(result.ioc_type)}</span>
          <h2 id="cr26-result-title" className="cr26-ioc">{result.ioc_value}</h2>
          <p className="cr26-meta">
            Analysé le {formatDayTime(result.generated_at)}
            {result.from_cache && <span className="cr26-cache"> · résultat en cache</span>}
          </p>
          {result.rationale && <p className="cr26-rationale">{result.rationale}</p>}
          <div className="cr26-actions">{actions}</div>
        </div>
        <div className="cr26-score" data-level={c.level}>
          <span className="cr26-score-label">Confiance</span>
          <b>{c.pct}<small>%</small></b>
          <span className="cr26-meter" role="img" aria-label={`${c.label}, ${c.pct} %`}><i style={{ width: `${c.pct}%` }} /></span>
          <span className="cr26-score-word">{c.label}</span>
          <p>Pondération des liens trouvés dans les données locales, pas un niveau de menace.</p>
        </div>
      </header>

      {found.length > 0 && (
        <nav className="cr26-contents" aria-label="Correspondances">
          {found.map(g => (
            <a key={g.id} href={`#cr26-${g.id}`}>{g.label}<b>{g.count}</b></a>
          ))}
        </nav>
      )}

      {next.length > 0 && (
        <section className="cr26-next" aria-labelledby="cr26-next-title">
          <h3 id="cr26-next-title">Actions recommandées</h3>
          <ol>{next.map((action, i) => <li key={i}>{action}</li>)}</ol>
        </section>
      )}

      {found.length === 0 && (
        <p className="cr26-nomatch">Aucune correspondance dans les données locales pour cet indicateur.</p>
      )}

      {result.techniques?.length > 0 && (
        <Group id="mitre" title="Techniques MITRE ATT&CK" count={result.techniques.length}>
          <ul className="cr26-techniques">
            {result.techniques.map(t => (
              <li key={t.technique_id}>
                <Link to={`/mitre?id=${encodeURIComponent(t.technique_id)}`} className="cr26-row-link" aria-label={`${t.technique_id} ${t.name}, ouvrir dans MITRE`}>
                  <span className="cr26-id">{t.technique_id}</span>
                  <span className="cr26-row-title">{t.name}</span>
                  <span className="cr26-tactics">{readableTactics(t.tactic).map(tactic => <span key={tactic}>{tactic}</span>)}</span>
                  <ArrowUpRight size={15} aria-hidden="true" className="cr26-row-go" />
                </Link>
              </li>
            ))}
          </ul>
        </Group>
      )}

      {result.cves?.length > 0 && (
        <Group id="cve" title="CVE liées" count={result.cves.length} note="CVSS ≥ 7.0">
          <ul className="cr26-cves">
            {result.cves.map(cve => (
              <li key={cve.cve_id} data-critical={cve.cvss_score >= 9 || undefined}>
                <span className="cr26-id">{cve.cve_id}</span>
                <span className="cr26-cvss">CVSS {cve.cvss_score.toFixed(1)}</span>
                <p>{cve.description}</p>
              </li>
            ))}
          </ul>
        </Group>
      )}

      <div className="cr26-related">
        {result.playbooks?.length > 0 && (
          <Group id="playbooks" title="Playbooks suggérés" count={result.playbooks.length} compact>
            <LinkList items={result.playbooks.map(p => ({ key: p.id, to: `/playbooks/${p.id}`, label: p.title }))} />
          </Group>
        )}
        {result.investigations?.length > 0 && (
          <Group id="investigations" title="Investigations liées" count={result.investigations.length} compact>
            <LinkList items={result.investigations.map(i => ({ key: i.id, to: `/investigations/${i.id}`, label: i.title, meta: i.status }))} />
          </Group>
        )}
        {result.attack_layers?.length > 0 && (
          <Group id="layers" title="Layers ATT&CK" count={result.attack_layers.length} compact>
            <LinkList items={result.attack_layers.map(l => ({ key: l.id, to: `/mitre/layers/${l.id}`, label: l.name }))} />
          </Group>
        )}
        {result.tools?.length > 0 && (
          <Group id="tools" title="Outils recommandés" count={result.tools.length} compact>
            <LinkList items={result.tools.map(t => ({ key: t.name, to: '/tools', label: t.name, meta: t.category }))} />
          </Group>
        )}
        {result.lolbins?.length > 0 && (
          <Group id="lolbins" title="LOLBins / GTFOBins" count={result.lolbins.length} compact>
            <LinkList items={result.lolbins.map(l => ({ key: `${l.os}-${l.name}`, to: '/lolbins', label: l.name, meta: [l.os, l.category].filter(Boolean).join(' · ') }))} />
          </Group>
        )}
        {result.notes?.length > 0 && (
          <Group id="notes" title="Notes pertinentes" count={result.notes.length} compact>
            <LinkList items={result.notes.map(n => ({ key: n.id, to: '/notes', label: n.title, meta: n.excerpt }))} />
          </Group>
        )}
        {result.cloak_tactics?.length > 0 && (
          <Group id="cloak" title="CLOAK OpSec" count={result.cloak_tactics.length} compact>
            <ul className="cr26-plain">
              {result.cloak_tactics.map(t => <li key={t.name}><b>{t.name}</b>{t.description && <span>{t.description}</span>}</li>)}
            </ul>
          </Group>
        )}
      </div>

      {found.length > 0 && missing.length > 0 && (
        <p className="cr26-missing">Sans correspondance : {missing.map(g => g.label).join(', ')}.</p>
      )}
    </article>
  )
}

function Group({ id, title, count, note, compact, children }: { id: GroupId; title: string; count: number; note?: string; compact?: boolean; children: ReactNode }) {
  return (
    <section id={`cr26-${id}`} className={`cr26-group${compact ? ' is-compact' : ''}`} aria-labelledby={`cr26-${id}-title`} tabIndex={-1}>
      <header>
        <h3 id={`cr26-${id}-title`}>{title}</h3>
        <span className="cr26-count">{count}</span>
        {note && <small>{note}</small>}
      </header>
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
          </Link>
        </li>
      ))}
    </ul>
  )
}
