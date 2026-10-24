import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { scenarioLabel } from './parts'

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/*
 * The scenario filter: one button that opens a searchable list, so dozens of
 * scenarios never sit on the page. Keyboard: ↑ ↓ move, Enter picks, Escape
 * closes and gives focus back to the button. "" means every scenario.
 */
export default function ScenarioPicker({ options, total, value, onChange }: {
  options: [string, number][]
  total: number
  value: string
  onChange: (slug: string) => void
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const input = useRef<HTMLInputElement>(null)

  // The first row is always "every scenario"; the rest follow the search.
  const rows = useMemo(() => {
    const q = fold(query.trim())
    const matching = options.filter(([slug]) => !q || fold(scenarioLabel(slug)).includes(q) || slug.includes(q))
    return [['', total] as [string, number], ...matching]
  }, [options, query, total])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(Math.max(0, [['', total], ...options].findIndex(([slug]) => slug === value)))
    input.current?.focus()
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open]) // only on opening: the list must not jump while the user types

  useEffect(() => { setActive(a => Math.min(a, rows.length - 1)) }, [rows.length])

  // The active row stays in view while arrows move through a long list.
  useEffect(() => {
    if (open) document.getElementById(`${id}-opt-${active}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [active, open, id])

  const close = () => { setOpen(false); trigger.current?.focus() }
  const pick = (slug: string) => { onChange(slug); close() }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, rows.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(rows.length - 1) }
    else if (e.key === 'Enter') { e.preventDefault(); if (rows[active]) pick(rows[active][0]) }
    else if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'Tab') setOpen(false)
  }

  const label = value ? scenarioLabel(value) : 'Tous les scénarios'
  const count = value ? options.find(([s]) => s === value)?.[1] ?? 0 : total

  return (
    <div className="pb26-picker" ref={root}>
      <div className={`pb26-picker-field${value ? ' is-set' : ''}`}>
        <button
          ref={trigger}
          type="button"
          className="pb26-picker-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Scénario : ${label}`}
          onClick={() => setOpen(o => !o)}
        >
          <span className="pb26-picker-kicker" aria-hidden="true">Scénario</span>
          <span className="pb26-picker-value" aria-hidden="true">{label}</span>
          <span className="pb26-count" aria-hidden="true">{count}</span>
          <ChevronDown size={16} aria-hidden="true" className="pb26-picker-chevron" />
        </button>
        {value && (
          <button type="button" className="pb26-picker-clear" aria-label="Retirer le filtre de scénario" onClick={() => onChange('')}>
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <div className="pb26-pop" role="dialog" aria-label="Choisir un scénario">
          <div className="pb26-pop-search">
            <Search size={15} aria-hidden="true" />
            <input
              ref={input}
              role="combobox"
              aria-expanded="true"
              aria-controls={`${id}-list`}
              aria-activedescendant={rows[active] ? `${id}-opt-${active}` : undefined}
              aria-autocomplete="list"
              aria-label="Filtrer les scénarios"
              placeholder="Rechercher un scénario"
              value={query}
              onChange={e => { setQuery(e.target.value); setActive(e.target.value.trim() ? 1 : 0) }}
              onKeyDown={onKey}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <ul id={`${id}-list`} role="listbox" aria-label="Scénarios" className="pb26-pop-list">
            {rows.map(([slug, n], i) => (
              <li
                key={slug || 'all'}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={slug === value}
                data-active={i === active || undefined}
                onMouseEnter={() => setActive(i)}
                onMouseDown={e => e.preventDefault()}
                onClick={() => pick(slug)}
              >
                <span className="pb26-pop-check" aria-hidden="true">{slug === value && <Check size={14} />}</span>
                <span className="pb26-pop-label">{slug ? scenarioLabel(slug) : 'Tous les scénarios'}</span>
                <span className="pb26-count">{n}</span>
              </li>
            ))}
            {rows.length === 1 && query.trim() && <li className="pb26-pop-empty" role="presentation">Aucun scénario ne correspond</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
