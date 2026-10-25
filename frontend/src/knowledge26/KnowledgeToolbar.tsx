import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { SOURCES, SOURCE_LABEL, facetDefs, sortOptions, type FacetState, type KnowledgeItem, type SortKey, type Source } from './model'

/*
 * Atlas command bar: source switch, then ONE command surface holding search,
 * sort and filters, then the view mode. Sort is a keyboard-accessible listbox
 * popover (not a native select); filters show their active count inline and
 * open a panel of styled — but real — checkboxes, with a local search for
 * long lists such as ATT&CK techniques.
 */

export const MODES = ['CAROUSEL', 'REGISTRY'] as const
export type Mode = typeof MODES[number]

interface Props {
  all: KnowledgeItem[]
  counts: Partial<Record<Source, number>>
  source: Source | 'TOUT'; onSource: (value: Source | 'TOUT') => void
  query: string; onQuery: (value: string) => void
  sort: SortKey; onSort: (value: SortKey) => void
  facets: FacetState; onFacets: (value: FacetState) => void
  mode: Mode; onMode: (value: Mode) => void
  grouped: boolean; onGrouped: (value: boolean) => void
  onlyTechniques: boolean; onOnlyTechniques: (value: boolean) => void
}

/* Closes a popover on outside click or Escape, returning focus to its trigger. */
function useDismiss(open: boolean, close: () => void, root: React.RefObject<HTMLElement>, trigger: React.RefObject<HTMLElement>) {
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => { if (root.current && !root.current.contains(event.target as Node)) close() }
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') { close(); trigger.current?.focus() } }
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open, close, root, trigger])
}

function SortMenu({ source, sort, onSort }: { source: Source | 'TOUT'; sort: SortKey; onSort: (value: SortKey) => void }) {
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), list = useRef<HTMLUListElement>(null)
  const options = sortOptions(source)
  const current = options.find(option => option.key === sort) ?? options[0]
  const close = () => setOpen(false)
  useDismiss(open, close, root, trigger)
  useEffect(() => { if (open) { setCursor(Math.max(0, options.findIndex(o => o.key === sort))); list.current?.focus() } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const choose = (key: SortKey) => { onSort(key); setOpen(false); trigger.current?.focus() }
  const onListKey = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setCursor(c => Math.min(options.length - 1, c + 1)) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setCursor(c => Math.max(0, c - 1)) }
    else if (event.key === 'Home') { event.preventDefault(); setCursor(0) }
    else if (event.key === 'End') { event.preventDefault(); setCursor(options.length - 1) }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(options[cursor].key) }
    else if (event.key === 'Tab') setOpen(false)
  }
  return <div className="ka-cmd-pop" ref={root}>
    <button ref={trigger} className="ka-cmd-btn" aria-label="Trier" aria-haspopup="listbox" aria-expanded={open}
      onClick={() => setOpen(value => !value)} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true) } }}>
      <small>SORT</small><span>{current.label}</span><i aria-hidden="true">▾</i>
    </button>
    {open && <ul ref={list} className="ka-sort-list" role="listbox" aria-label="Ordre de tri" tabIndex={-1} aria-activedescendant={`ka-sort-${options[cursor]?.key}`} onKeyDown={onListKey}>
      {options.map((option, index) => <li key={option.key} id={`ka-sort-${option.key}`} role="option" aria-selected={option.key === sort}
        data-cursor={index === cursor || undefined} onMouseEnter={() => setCursor(index)} onClick={() => choose(option.key)}>
        <span>{option.label}</span>{option.key === sort && <i aria-hidden="true">✓</i>}
      </li>)}
    </ul>}
  </div>
}

function FacetGroup({ label, values, selected, onToggle }: { label: string; values: string[]; selected: Set<string>; onToggle: (value: string) => void }) {
  const [needle, setNeedle] = useState('')
  const long = values.length > 10
  const shown = needle ? values.filter(value => value.toLocaleLowerCase().includes(needle.toLocaleLowerCase())) : values
  return <fieldset className="ka-facet">
    <legend><span>{label}</span>{selected.size > 0 && <b>{String(selected.size).padStart(2, '0')}</b>}<small>{values.length}</small></legend>
    {long && <input className="ka-facet-search" type="search" aria-label={`Rechercher dans ${label}`} placeholder={`Filtrer ${label.toLocaleLowerCase()}…`} value={needle} onChange={event => setNeedle(event.target.value)} />}
    <div className={`ka-facet-list${long ? ' is-long' : ''}`}>{shown.map(value =>
      <label key={value} className="ka-check"><input type="checkbox" checked={selected.has(value)} onChange={() => onToggle(value)} /><span>{value}</span></label>)}
      {!shown.length && <p className="ka-facet-empty">Aucune valeur.</p>}
    </div>
  </fieldset>
}

export default function KnowledgeToolbar(props: Props) {
  const { all, counts, source, query, sort, facets, mode, grouped } = props
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null)
  const defs = facetDefs(source)
  const active = Object.values(facets).reduce((sum, values) => sum + values.size, 0)
  const close = () => setOpen(false)
  useDismiss(open, close, root, trigger)
  useEffect(() => { setOpen(false) }, [source])

  const values = (key: string) => [...new Set(all.filter(item => source === 'TOUT' || item.source === source).flatMap(item => item.facets[key]?.split('|') ?? []).filter(value => value && value !== '—'))]
    .sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }))
  const toggle = (facet: string, value: string) => {
    const next = new Set(facets[facet] ?? [])
    if (next.has(value)) next.delete(value); else next.add(value)
    props.onFacets({ ...facets, [facet]: next })
  }

  return <div className="ka-toolbar">
    <div className="ka-source-switch" aria-label="Sources">{(['TOUT', ...SOURCES] as const).map(value =>
      <button key={value} aria-pressed={source === value} data-source={value} onClick={() => props.onSource(value)}>
        <span>{value === 'TOUT' ? 'ALL' : SOURCE_LABEL[value]}</span><small>{value === 'TOUT' ? all.length : counts[value] ?? '…'}</small>
      </button>)}
    </div>
    <div className="ka-command" role="search">
      <label className="ka-search"><span aria-hidden="true">⌕</span><input aria-label="Rechercher dans les connaissances chargées" placeholder="ID, technique, binaire, produit, doctrine…" value={query} onChange={event => props.onQuery(event.target.value)} /></label>
      <SortMenu source={source} sort={sort} onSort={props.onSort} />
      {defs.length > 0 && <div className="ka-cmd-pop" ref={root}>
        <button ref={trigger} className="ka-cmd-btn" aria-expanded={open} aria-haspopup="dialog" data-active={active > 0 || undefined} onClick={() => setOpen(value => !value)}>
          <small>FILTERS</small>{active > 0 && <b>{String(active).padStart(2, '0')}</b>}<i aria-hidden="true">▾</i>
        </button>
        {open && <div className="ka-filters-pop" role="group" aria-label="Filtres contextuels">
          <header><span>Filtres · {SOURCE_LABEL[source as Source]}</span>{active > 0 && <button className="ka-filters-clear" onClick={() => props.onFacets({})}>Réinitialiser · {active}</button>}</header>
          <div className="ka-filters-body">
            {defs.map(definition => { const list = values(definition.key); return list.length > 0 && <FacetGroup key={definition.key} label={definition.label} values={list} selected={facets[definition.key] ?? new Set()} onToggle={value => toggle(definition.key, value)} /> })}
            {source === 'MITRE' && <label className="ka-check ka-only-tech"><input type="checkbox" checked={props.onlyTechniques} onChange={event => props.onOnlyTechniques(event.target.checked)} /><span>Exclure les sous-techniques</span></label>}
          </div>
        </div>}
      </div>}
    </div>
    {source === 'TOUT' && mode === 'REGISTRY' && <label className="ka-check ka-group-toggle"><input type="checkbox" checked={grouped} onChange={event => props.onGrouped(event.target.checked)} /><span>Grouper par source</span></label>}
    <div className="ka-mode-switch" aria-label="Mode de consultation">{MODES.map((value, index) =>
      <button key={value} aria-pressed={mode === value} onClick={() => props.onMode(value)}><small>0{index + 1}</small>{value}</button>)}
    </div>
  </div>
}
