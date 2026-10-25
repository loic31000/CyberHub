import { useRef, type CSSProperties, type ReactNode } from 'react'
import type { ViewProps } from './KnowledgeRegistry'
import { ANNOTATION_STATUS } from './KnowledgeRegistry'
import type { CVEEntry, MITRETechnique } from '@/types'
import type { LOLBin } from '@/types/lolbins'
import { CvssMeter, KevBadge, SeverityBadge, StatusBadge, formatDay, splitProducts } from '@/cve26/parts'
import { parseMitre } from '@/lolbins26/parts'
import { SOURCE_LABEL, cleanText, cloakRef, type KnowledgeItem } from './model'

/*
 * Focus carousel: a physical stack of digital record cards. Every card is a
 * bounded preview — source, ID, short context, title, a 3-line summary and
 * three classification cells — never the full record and never scrollable;
 * the complete record lives in the central dossier. At most five cards are
 * mounted, so 955 records cost five DOM cards.
 */

function Cells({ cells }: { cells: [string, ReactNode][] }) {
  return <span className="ka-card-cells">{cells.map(([label, value]) => <span key={label}><small>{label}</small><b>{value || '—'}</b></span>)}</span>
}

function Preview({ item, kev, status }: { item: KnowledgeItem; kev: boolean; status?: string }) {
  if (item.source === 'CVE') {
    const cve = item.original as CVEEntry
    const products = splitProducts(cve.products)
    return <>
      <span className="ka-card-top"><span className="ka-badge" data-source="CVE">CVE</span>{kev && <KevBadge title="Exploitée activement selon CISA KEV" />}</span>
      <span className="ka-card-rule" />
      <span className="ka-card-heading"><small>{products[0] ?? 'Produit non renseigné'}{products.length > 1 ? ` +${products.length - 1}` : ''}</small><strong className="is-mono">{cve.cve_id}</strong></span>
      <p>{cve.description || 'Sans description.'}</p>
      <span className="ka-card-signals" data-severity={cve.severity}><span><CvssMeter score={Number(cve.cvss_score)} severity={cve.severity} /><SeverityBadge severity={cve.severity} /></span><StatusBadge status={cve.status} /></span>
      <span className="ka-card-foot"><span>{formatDay(cve.published_at)}</span><span>OUVRIR LE DOSSIER ↗</span></span>
    </>
  }
  const head = <>
    <span className="ka-card-top"><span className="ka-badge" data-source={item.source}>{SOURCE_LABEL[item.source]}</span><code>{item.id}</code></span>
    <span className="ka-card-rule" />
  </>
  if (item.source === 'LOLBINS') {
    const bin = item.original as LOLBin
    const mitre = parseMitre(bin.mitre_tech)
    return <>
      {head}
      <span className="ka-card-heading"><small>{item.categories[0]}</small><strong>{item.title}</strong></span>
      <p>{item.description || 'Binaire documenté sans description.'}</p>
      <Cells cells={[['OS', bin.os === 'linux' ? 'Linux' : 'Windows'], ['COMMANDES', item.signal], ['ATT&CK', mitre[0] ? `${mitre[0]}${mitre.length > 1 ? ` +${mitre.length - 1}` : ''}` : '—']]} />
      <span className="ka-card-foot"><span>{bin.os === 'linux' ? 'GTFOBINS' : 'LOLBAS'}</span><span>OUVRIR LE DOSSIER ↗</span></span>
    </>
  }
  if (item.source === 'MITRE') {
    const technique = item.original as MITRETechnique
    return <>
      {head}
      <span className="ka-card-heading"><small>{item.facets.kind}{technique.is_subtechnique && cleanText(technique.parent_id) ? ` · ${cleanText(technique.parent_id)}` : ''}</small><strong>{item.title}</strong></span>
      <p>{item.description || 'Contexte détaillé disponible dans le dossier central.'}</p>
      <Cells cells={[['TACTIQUE', item.categories.slice(0, 2).join(' · ')], ['PLATEFORMES', item.facets.platform?.split('|').slice(0, 3).join(' · ')], ['NIVEAU', item.facets.kind]]} />
      <span className="ka-card-foot"><span>ATT&amp;CK KNOWLEDGE</span><span>OUVRIR LE DOSSIER ↗</span></span>
    </>
  }
  return <>
    {head}
    <span className="ka-card-heading"><small>{item.categories[0]}</small><strong>{item.title}</strong></span>
    <p>{item.description || 'Contexte détaillé disponible dans le dossier central.'}</p>
    <Cells cells={[['TACTIQUE', item.categories[0]], ['TYPE', item.signal], ['NIVEAU', item.facets.kind]]} />
    <span className="ka-card-foot"><span className={status ? 'is-annotated' : undefined}>{status ?? 'NON ANNOTÉ'}</span><span>OUVRIR LE DOSSIER ↗</span></span>
  </>
}

export default function KnowledgeCarousel({ items, selected, onSelect, onFocus, annotations = new Map(), kevFlags = new Set(), favorites }: ViewProps & { onFocus: (key: string) => void }) {
  const touch = useRef<number | null>(null)
  const index = Math.max(0, items.findIndex(item => item.key === selected))
  const move = (delta: number) => { const item = items[index + delta]; if (item) onFocus(item.key) }
  const active = items[index]
  const position = items.length > 1 ? (index / (items.length - 1)) * 100 : 0
  return <section className="ka-carousel" aria-label="Carousel de connaissances" tabIndex={0}
    onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); move(e.key === 'ArrowRight' ? 1 : -1) } }}
    onTouchStart={e => { touch.current = e.touches[0].clientX }}
    onTouchEnd={e => { if (touch.current !== null) { const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 50) move(dx < 0 ? 1 : -1); touch.current = null } }}>
    <div className="ka-focus-label"><span>FOCUS COLLECTION</span><span aria-live="polite">{active ? `${SOURCE_LABEL[active.source]} · ${active.id}` : ''}</span></div>
    <div className="ka-stage">
      <span className="ka-floor" aria-hidden="true" />
      {items.slice(Math.max(0, index - 2), index + 3).map(item => {
        const offset = items.indexOf(item) - index
        const cve = item.source === 'CVE' ? item.original as CVEEntry : null
        const status = item.source === 'CLOAK' ? annotations.get(cloakRef(item))?.status : undefined
        return <button key={item.key} className={`ka-focus-card ${offset === 0 ? 'is-active' : ''}`} data-source={item.source}
          data-severity={cve?.severity} data-favorite={favorites?.has(item.key) || undefined}
          style={{ '--offset': offset, '--depth': Math.abs(offset) } as CSSProperties}
          tabIndex={offset === 0 ? 0 : -1} aria-label={`${offset === 0 ? 'Ouvrir' : 'Sélectionner'} ${item.id}`}
          onClick={() => offset === 0 ? onSelect(item) : onFocus(item.key)}>
          <Preview item={item} kev={!!cve && (kevFlags.has(cve.cve_id) || !!cve.kev_exploited)} status={status ? ANNOTATION_STATUS[status] : undefined} />
        </button>
      })}
    </div>
    <div className="ka-carousel-nav">
      <button disabled={index === 0} onClick={() => move(-1)}>← <span>Précédente</span></button>
      <div className="ka-position" role="progressbar" aria-label="Position dans la collection" aria-valuemin={1} aria-valuemax={items.length} aria-valuenow={index + 1}>
        <span className="ka-position-track"><i style={{ width: `${position}%` }} /><b style={{ left: `${position}%` }} /></span>
        <span><strong>{String(index + 1).padStart(3, '0')}</strong> / {String(items.length).padStart(3, '0')}</span>
        <small>← → · SWIPE</small>
      </div>
      <button disabled={index >= items.length - 1} onClick={() => move(1)}><span>Suivante</span> →</button>
    </div>
  </section>
}
