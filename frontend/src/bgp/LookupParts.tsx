import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, ChevronRight, Copy, Crosshair, Database, Search, ShieldBan, Users } from 'lucide-react'
import type { BGPPeer, IPv4Prefix, IPv6Prefix } from '@/types/bgp'
import { ipv4Size, splitPrefix } from './format'

/** One relation group (peers, upstreams or downstreams) as returned by the API. */
export interface RelationGroup {
  items: BGPPeer[] | null
  loading: boolean
  error: string | null
}

export function EmptyState({ label = 'Aucune donnée' }: { label?: string }) {
  return (
    <div className="bgp-empty">
      <Database size={20} aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}

/** Which ASNs this visit has opened, and the one on screen. */
export interface VisitLens {
  current: number | null
  visited: ReadonlySet<number>
}

export type VisitState = 'current' | 'visited' | undefined

export const visitState = (asn: number, lens: VisitLens): VisitState =>
  asn === lens.current ? 'current' : lens.visited.has(asn) ? 'visited' : undefined

const VISIT_SUFFIX = { current: ', ASN en cours d’exploration', visited: ', déjà visité' } as const

/** Accessible name of a navigable ASN, with its visit state spelled out. */
export const visitLabel = (base: string, state: VisitState) => (state ? `${base}${VISIT_SUFFIX[state]}` : base)

/** Visible marker: an icon and a word, so the state never rests on colour alone. */
export function VisitMark({ state }: { state: VisitState }) {
  if (!state) return null
  return (
    <em className="bgp-visit" data-state={state}>
      {state === 'current' ? <Crosshair size={11} aria-hidden="true" /> : <Check size={11} aria-hidden="true" />}
      <span>{state === 'current' ? 'exploré' : 'visité'}</span>
    </em>
  )
}

function RelationNode({ item, lens, onOpen }: { item: BGPPeer; lens: VisitLens; onOpen: (asn: number) => void }) {
  const state = visitState(item.asn, lens)
  return (
    <button
      type="button"
      className="bgp-relation-node"
      data-visit={state}
      aria-current={state === 'current' ? 'true' : undefined}
      onClick={() => onOpen(item.asn)}
      aria-label={visitLabel(`Ouvrir AS${item.asn} ${item.name ?? ''}`.trim(), state)}
      title={item.name ? `AS${item.asn} · ${item.name}` : undefined}
    >
      <strong>AS{item.asn}</strong>
      <span>{item.name || 'Nom non renseigné'}</span>
      <VisitMark state={state} />
      {item.country_code && <small>{item.country_code}</small>}
      <ArrowRight size={13} className="bgp-node-go" aria-hidden="true" />
    </button>
  )
}

function groupContent(group: RelationGroup, limit: number, lens: VisitLens, onOpen: (asn: number) => void, more: ReactNode) {
  if (group.loading) return <p className="bgp-lane-state">Chargement…</p>
  if (group.error) return <p className="bgp-lane-state is-error" role="status">Relation indisponible</p>
  if (!group.items?.length) return <p className="bgp-lane-state">Aucune relation retournée</p>
  return (
    <div className="bgp-lane-nodes">
      {group.items.slice(0, limit).map(item => <RelationNode key={item.asn} item={item} lens={lens} onOpen={onOpen} />)}
      {group.items.length > limit && more}
    </div>
  )
}

const count = (group: RelationGroup) => (group.loading ? '…' : group.error || !group.items ? '—' : String(group.items.length))

type RelationTab = 'peers' | 'upstreams' | 'downstreams'

/**
 * The ASN at the centre, its transit providers on the left, its customers on
 * the right and its peers underneath. Every node is a relation the API
 * returned; the connectors are drawn per node, so an empty lane has none.
 */
export function RelationAtlas({ asn, name, upstreams, downstreams, peers, visited, onOpen, onShowAll }: {
  asn: number
  name: string
  upstreams: RelationGroup
  downstreams: RelationGroup
  peers: RelationGroup
  visited: ReadonlySet<number>
  onOpen: (asn: number) => void
  onShowAll: (tab: RelationTab) => void
}) {
  const lens: VisitLens = { current: asn, visited }
  const seen = new Set([upstreams, downstreams, peers].flatMap(g => g.items ?? []).map(r => r.asn).filter(n => visited.has(n) && n !== asn)).size
  const more = (group: RelationGroup, tab: RelationTab, label: string) => (
    <button type="button" className="bgp-lane-more" onClick={() => onShowAll(tab)}>
      +{(group.items?.length ?? 0) - (tab === 'peers' ? 9 : 6)} · voir les {group.items?.length} {label}
      <ChevronRight size={13} aria-hidden="true" />
    </button>
  )
  const lane = (direction: 'upstream' | 'downstream', group: RelationGroup, title: string, role: string, icon: ReactNode) => (
    <div className="bgp-lane" data-direction={direction} data-has-relations={Boolean(group.items?.length)}>
      <div className="bgp-lane-head">
        {icon}
        <span>{title}</span>
        <small>{role}</small>
        <b>{count(group)}</b>
      </div>
      {groupContent(group, 6, lens, onOpen, more(group, direction === 'upstream' ? 'upstreams' : 'downstreams', title.toLowerCase()))}
    </div>
  )

  return (
    <section className="bgp-atlas" aria-labelledby="bgp-atlas-title">
      <header className="bgp-section-head">
        <h3 id="bgp-atlas-title">Relations BGP observées</h3>
        <span>{seen > 0 ? <><b className="bgp-seen"><Check size={12} aria-hidden="true" /> {seen} déjà visité{seen > 1 ? 's' : ''}</b> · </> : null}Voisinage retourné par l’API · cliquer un ASN pour l’explorer</span>
      </header>
      <div className="bgp-topology">
        {lane('upstream', upstreams, 'Upstreams', 'transit', <ArrowUpRight size={14} aria-hidden="true" />)}
        <div className="bgp-core" aria-label={`ASN étudié AS${asn}`}>
          <span>ASN étudié</span>
          <strong>AS{asn}</strong>
          <small>{name || 'Nom non renseigné'}</small>
        </div>
        {lane('downstream', downstreams, 'Downstreams', 'clients', <ArrowDownRight size={14} aria-hidden="true" />)}
      </div>
      <div className="bgp-peering" data-has-relations={Boolean(peers.items?.length)}>
        <div className="bgp-lane-head">
          <Users size={14} aria-hidden="true" />
          <span>Peering</span>
          <small>interconnexions</small>
          <b>{count(peers)}</b>
        </div>
        {groupContent(peers, 9, lens, onOpen, more(peers, 'peers', 'peers'))}
      </div>
    </section>
  )
}

/**
 * The empty state teaches how to read the atlas with its own visual parts.
 * It is labelled as a reading guide; no network, ASN or relation is shown.
 */
export function AtlasSchematic() {
  const slot = (label: string) => <span className="bgp-schematic-slot">{label}</span>
  return (
    <figure className="bgp-atlas-schematic" aria-label="Schéma de lecture de l’atlas">
      <div className="bgp-topology">
        <div className="bgp-lane" data-direction="upstream" data-has-relations="true">
          <div className="bgp-lane-head"><ArrowUpRight size={14} aria-hidden="true" /><span>Upstreams</span><small>transit</small></div>
          <div className="bgp-lane-nodes">{slot('fournisseur de transit')}{slot('fournisseur de transit')}</div>
        </div>
        <div className="bgp-core is-schematic"><span>ASN étudié</span><strong>AS·····</strong><small>votre requête</small></div>
        <div className="bgp-lane" data-direction="downstream" data-has-relations="true">
          <div className="bgp-lane-head"><ArrowDownRight size={14} aria-hidden="true" /><span>Downstreams</span><small>clients</small></div>
          <div className="bgp-lane-nodes">{slot('réseau client')}{slot('réseau client')}{slot('réseau client')}</div>
        </div>
      </div>
      <figcaption>Schéma de lecture · aucun état réseau représenté</figcaption>
    </figure>
  )
}

const PAGE_SIZE = 25

function PagedTable<T>({ items, headers, label, renderRow, filterOf, filterLabel }: {
  items: T[]
  headers: string[]
  label: string
  renderRow: (item: T) => ReactNode
  filterOf: (item: T) => string
  filterLabel: string
}) {
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? items.filter(item => filterOf(item).toLowerCase().includes(needle)) : items
  }, [items, query, filterOf])
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const current = Math.min(page, pages)
  const slice = visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  return (
    <div className="bgp-table-block">
      <div className="bgp-table-tools">
        <label className="bgp-filter">
          <Search size={14} aria-hidden="true" />
          <span className="bgp-sr">{filterLabel}</span>
          <input type="search" value={query} placeholder={filterLabel} onChange={event => { setQuery(event.target.value); setPage(1) }} />
        </label>
        <span className="bgp-table-count">
          {query.trim() ? `${visible.length} / ${items.length}` : items.length} ligne{visible.length > 1 ? 's' : ''}
        </span>
      </div>
      <div className="bgp-table-scroll">
        <table aria-label={label}>
          <thead><tr>{headers.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
          <tbody>
            {slice.length === 0
              ? <tr><td colSpan={headers.length} className="bgp-table-none">Aucune ligne ne correspond au filtre</td></tr>
              : slice.map(renderRow)}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav className="bgp-pagination" aria-label="Pagination">
          <button type="button" className="bgp-icon-button" onClick={() => setPage(current - 1)} disabled={current === 1} aria-label="Page précédente">←</button>
          <span aria-live="polite">{current} / {pages}</span>
          <button type="button" className="bgp-icon-button" onClick={() => setPage(current + 1)} disabled={current === pages} aria-label="Page suivante">→</button>
        </nav>
      )}
    </div>
  )
}

export function PrefixTable({ family, prefixes, onCopy, onExport }: {
  family: 4 | 6
  prefixes: (IPv4Prefix | IPv6Prefix)[]
  onCopy: (value: string) => void
  onExport: (prefix: string) => void
}) {
  if (prefixes.length === 0) return <EmptyState />
  return (
    <PagedTable
      items={prefixes}
      label={`Préfixes IPv${family} annoncés`}
      filterLabel="Filtrer préfixe, nom ou pays"
      filterOf={p => `${p.prefix} ${p.name} ${p.country_code} ${p.description}`}
      headers={family === 4 ? ['Préfixe', 'Taille', 'Nom', 'Pays', 'Actions'] : ['Préfixe', 'Nom', 'Pays', 'Actions']}
      renderRow={p => {
        const [address, length] = splitPrefix(p.prefix)
        return (
          <tr key={p.prefix}>
            <td className="bgp-prefix"><span>{address}</span><b>{length}</b></td>
            {family === 4 && <td className="bgp-cell-muted">{ipv4Size(p.cidr)}</td>}
            <td>{p.name || '—'}{p.description && p.description !== p.name && <small>{p.description}</small>}</td>
            <td className="bgp-cell-muted">{p.country_code || '—'}</td>
            <td>
              <div className="bgp-row-actions">
                <button type="button" className="bgp-icon-button" onClick={() => onCopy(p.prefix)} title="Copier" aria-label={`Copier le préfixe ${p.prefix}`}><Copy size={13} /></button>
                <button type="button" className="bgp-icon-button is-labelled" onClick={() => onExport(p.prefix)} title="Exporter en IOC" aria-label={`Exporter ${p.prefix} en IOC`}><ShieldBan size={13} /><span>IOC</span></button>
              </div>
            </td>
          </tr>
        )
      }}
    />
  )
}

export function RelationTable({ label, relations, current, visited, onCopy, onOpen }: {
  label: string
  relations: BGPPeer[]
  current: number
  visited: ReadonlySet<number>
  onCopy: (value: string) => void
  onOpen: (asn: number) => void
}) {
  if (relations.length === 0) return <EmptyState />
  const lens: VisitLens = { current, visited }
  return (
    <PagedTable
      items={relations}
      label={label}
      filterLabel="Filtrer ASN, nom ou pays"
      filterOf={r => `AS${r.asn} ${r.name} ${r.description} ${r.country_code}`}
      headers={['ASN', 'Nom', 'Pays', 'Actions']}
      renderRow={r => {
        const state = visitState(r.asn, lens)
        return (
          <tr key={r.asn} data-visit={state}>
            <td className="bgp-asn-cell"><span>AS{r.asn}</span><VisitMark state={state} /></td>
            <td>{r.name || '—'}{r.description && r.description !== r.name && <small>{r.description}</small>}</td>
            <td className="bgp-cell-muted">{r.country_code || '—'}</td>
            <td>
              <div className="bgp-row-actions">
                <button type="button" className="bgp-icon-button" onClick={() => onCopy(String(r.asn))} title="Copier ASN" aria-label={`Copier l'ASN ${r.asn}`}><Copy size={13} /></button>
                <button type="button" className="bgp-icon-button is-labelled" onClick={() => onOpen(r.asn)} title="Explorer cet ASN" aria-label={visitLabel(`Ouvrir l'ASN ${r.asn}`, state)}><span>Explorer</span><ChevronRight size={13} /></button>
              </div>
            </td>
          </tr>
        )
      }}
    />
  )
}
