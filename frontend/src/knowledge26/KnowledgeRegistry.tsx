import { useState, type ReactNode } from 'react'
import { ExternalLink, FilePenLine, MessageSquareText, MoreHorizontal } from 'lucide-react'
import type { CloakAnnotation } from '@/types/cloakAnnotation'
import type { CVEEntry, MITRETechnique } from '@/types'
import type { LOLBin } from '@/types/lolbins'
import { KevBadge, SeverityBadge, splitProducts } from '@/cve26/parts'
import { parseMitre } from '@/lolbins26/parts'
import { SOURCE_LABEL, cloakRef, groupBySource, type KnowledgeItem, type Source } from './model'

/*
 * Unified registry. Every source renders through the SAME row grid —
 * SOURCE | ID | TITLE / SUMMARY | CONTEXT | SIGNAL | ACTIONS — with the same
 * height and density, so ALL never "breaks" when the list moves from CVE to
 * CLOAK. Sources differ only by their badge and a thin lateral accent; a
 * single-source view only renames the column headers.
 */

export interface ViewProps {
  items: KnowledgeItem[]
  selected: string | null
  onSelect: (item: KnowledgeItem) => void
  annotations?: Map<string, CloakAnnotation>
  onAnnotate?: (item: KnowledgeItem) => void
  kevFlags?: Set<string>
  /** Reserved for the upcoming ☆ FAVORI feature: keys of favourite records. */
  favorites?: ReadonlySet<string>
}

export const ANNOTATION_STATUS: Record<string, string> = { a_tester: 'À tester', vu_en_lab: 'Vu en lab', maitrise: 'Maîtrisé' }
const PAGE = 40

const HEADERS: Record<Source | 'TOUT', [string, string, string, string]> = {
  TOUT: ['IDENTIFIANT', 'TITRE / RÉSUMÉ', 'CONTEXTE', 'SIGNAL'],
  CVE: ['CVE ID', 'DESCRIPTION', 'PRODUITS', 'CVSS · KEV'],
  MITRE: ['ATT&CK ID', 'TECHNIQUE', 'TACTIQUE', 'PLATEFORMES · NIVEAU'],
  CLOAK: ['RÉF.', 'DOCTRINE', 'TACTIQUE', 'TYPE · ANNOTATION'],
  LOLBINS: ['BINAIRE', 'DESCRIPTION', 'OS · CATÉGORIE', 'COMMANDES · ATT&CK'],
}

/* First sentence as the title line, the rest as the summary line. */
function split(text: string): [string, string] {
  const clean = (text || '').replace(/\s+/g, ' ').trim()
  const match = clean.match(/^(.{20,160}?[.!?])\s+(.+)$/)
  return match ? [match[1], match[2]] : [clean, '']
}

interface Projection { title: string; summary: string; context: ReactNode; signal: ReactNode }
export function project(item: KnowledgeItem, annotation: CloakAnnotation | undefined, kev: boolean): Projection {
  if (item.source === 'CVE') {
    const cve = item.original as CVEEntry
    const [title, summary] = split(cve.description || 'Sans description')
    const products = splitProducts(cve.products)
    const score = Number(cve.cvss_score)
    return {
      title, summary,
      context: products.length ? <>{products.slice(0, 2).join(', ')}{products.length > 2 && <small> +{products.length - 2}</small>}</> : <span className="ka-dim">Produits non renseignés</span>,
      signal: <span className="ka-signal-cve" data-severity={cve.severity}><b>{score > 0 ? score.toFixed(1) : '—'}</b><SeverityBadge severity={cve.severity} />{kev && <KevBadge title="Exploitée activement selon CISA KEV" />}</span>,
    }
  }
  if (item.source === 'MITRE') {
    const technique = item.original as MITRETechnique
    return {
      title: item.title, summary: item.description,
      context: item.categories.join(' · '),
      signal: <span className="ka-signal-chips">{item.facets.platform?.split('|').filter(p => p !== '—').slice(0, 2).map(platform => <i key={platform}>{platform}</i>)}<em>{technique.is_subtechnique ? 'SOUS-TECH.' : 'TECHNIQUE'}</em></span>,
    }
  }
  if (item.source === 'CLOAK') {
    return {
      title: item.title, summary: item.description,
      context: item.categories[0],
      signal: <span className="ka-signal-chips"><i>{item.signal}</i>{annotation?.status ? <em className="is-annotated">{ANNOTATION_STATUS[annotation.status]}</em> : <em>{item.facets.kind === 'Sous-technique' ? 'SOUS-TECH.' : 'TECHNIQUE'}</em>}</span>,
    }
  }
  const bin = item.original as LOLBin
  const [title, summary] = split(item.description || 'Binaire documenté sans description.')
  const mitre = parseMitre(bin.mitre_tech)
  return {
    title, summary: summary || bin.full_path,
    context: <>{bin.os === 'linux' ? 'Linux' : 'Windows'}<small> · {item.categories[0]}</small></>,
    signal: <span className="ka-signal-chips"><i>{item.signal}</i>{mitre[0] && <em>{mitre[0]}{mitre.length > 1 ? ` +${mitre.length - 1}` : ''}</em>}</span>,
  }
}

function Row({ item, selected, annotation, kev, favorite, onSelect, onAnnotate, onEdit }: {
  item: KnowledgeItem; selected: boolean; annotation?: CloakAnnotation; kev: boolean; favorite: boolean
  onSelect: (item: KnowledgeItem) => void; onAnnotate?: (item: KnowledgeItem) => void; onEdit?: (item: KnowledgeItem) => void
}) {
  const [menu, setMenu] = useState(false)
  const row = project(item, annotation, kev)
  const attack = item.source === 'MITRE' ? (item.original as MITRETechnique).url || `https://attack.mitre.org/techniques/${item.id.replace('.', '/')}/` : ''
  return <li className="ka-row-wrap">
    <button className={`ka-row ${selected ? 'is-selected' : ''}`} data-source={item.source} data-title={item.title} data-favorite={favorite || undefined} onClick={() => onSelect(item)}>
      <span className="ka-badge" data-source={item.source}>{SOURCE_LABEL[item.source]}</span>
      <code>{item.id}</code>
      <span className="ka-row-title"><strong>{row.title}</strong><small>{row.summary || '—'}</small></span>
      <span className="ka-row-context">{row.context}</span>
      <span className="ka-row-signal">{row.signal}</span>
      <span aria-hidden="true" />
    </button>
    <div className="ka-row-actions">
      <button aria-label={`Actions pour ${item.id}`} aria-expanded={menu} onClick={() => setMenu(value => !value)}><MoreHorizontal size={16} /></button>
      {menu && <div className="ka-row-menu" onMouseLeave={() => setMenu(false)}>
        <button onClick={() => { onSelect(item); setMenu(false) }}>Ouvrir le dossier</button>
        {item.source === 'CVE' && onEdit && <button onClick={() => { onEdit(item); setMenu(false) }}><FilePenLine size={13} /> Modifier</button>}
        {item.source === 'MITRE' && <a href={attack} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> ATT&amp;CK officiel</a>}
        {item.source === 'CLOAK' && <button onClick={() => { onAnnotate?.(item); setMenu(false) }}><MessageSquareText size={13} /> {annotation ? 'Modifier l’annotation' : 'Annoter'}</button>}
      </div>}
    </div>
  </li>
}

export default function KnowledgeRegistry({ items, selected, onSelect, annotations = new Map(), onAnnotate, kevFlags = new Set(), favorites, grouped, source, onEdit }: ViewProps & { grouped?: boolean; source: Source | 'TOUT'; onEdit?: (item: KnowledgeItem) => void }) {
  const [limits, setLimits] = useState<Record<string, number>>({})
  const headers = HEADERS[source]
  const renderRows = (list: KnowledgeItem[], group: string) => {
    const limit = limits[group] ?? PAGE
    return <>
      {list.slice(0, limit).map(item => {
        const cve = item.source === 'CVE' ? item.original as CVEEntry : null
        return <Row key={item.key} item={item} selected={selected === item.key} annotation={annotations.get(cloakRef(item))}
          kev={!!cve && (kevFlags.has(cve.cve_id) || !!cve.kev_exploited)} favorite={!!favorites?.has(item.key)} onSelect={onSelect} onAnnotate={onAnnotate} onEdit={onEdit} />
      })}
      {list.length > limit && <li className="ka-more-row"><button className="ka-more" onClick={() => setLimits(previous => ({ ...previous, [group]: limit + PAGE }))}>Afficher {PAGE} fiches supplémentaires ({limit} / {list.length})</button></li>}
    </>
  }
  return <div className="ka-registry" data-scope={source}>
    <div className="ka-columns" aria-hidden="true"><span>SOURCE</span>{headers.map(label => <span key={label}>{label}</span>)}<span>ACTIONS</span></div>
    <ul>{grouped
      ? groupBySource(items).map(group => <li key={group.source} className="ka-group">
          <h3 className="ka-group-head" data-source={group.source}><span className="ka-badge" data-source={group.source}>{SOURCE_LABEL[group.source]}</span>{SOURCE_LABEL[group.source]} — {group.items.length}</h3>
          <ul>{renderRows(group.items, group.source)}</ul>
        </li>)
      : renderRows(items, 'ALL')}
    </ul>
  </div>
}
