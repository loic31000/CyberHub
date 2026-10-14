import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search, X } from 'lucide-react'

export type Choice = { value: string; label: string; count?: number }

type Place = { left: number; width: number; top?: number; bottom?: number; maxHeight: number }
const GAP = 6
const MARGIN = 12

/*
 * An exclusive choice in a panel anchored to its button (native radios:
 * arrows move, Space selects, Enter or a click selects and closes). Escape,
 * a click outside or the close button close it; focus returns to the button.
 *
 * The panel is portalled to <body> with a fixed position computed from the
 * button: no container (overflow, stacking context) can clip it. It opens
 * downwards when there is room, otherwise upwards, stays in the viewport and
 * scrolls inside when the list is long. Re-placed on resize and scroll.
 */
export function ChoiceMenu({ title, button, choices, value, onChange, filterable, disabled, className, align = 'start', width = 420 }: {
  title: string
  button: ReactNode
  choices: Choice[]
  value: string
  onChange: (value: string) => void
  filterable?: boolean
  disabled?: boolean
  className?: string
  align?: 'start' | 'end'
  width?: number
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [place, setPlace] = useState<Place | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const id = useId()

  const close = useCallback((focus = true) => {
    setOpen(false)
    setFilter('')
    setPlace(null)
    if (focus) requestAnimationFrame(() => trigger.current?.focus())
  }, [])

  // Where the panel goes: under the button if it fits, else above; inside the viewport.
  const measure = useCallback(() => {
    const b = trigger.current?.getBoundingClientRect()
    if (!b) return
    const vw = window.innerWidth, vh = window.innerHeight
    const w = Math.min(width, vw - 2 * MARGIN)
    const left = Math.min(Math.max(MARGIN, align === 'end' ? b.right - w : b.left), vw - MARGIN - w)
    const below = vh - b.bottom - GAP - MARGIN
    const above = b.top - GAP - MARGIN
    const natural = panel.current?.scrollHeight ?? 360
    const down = below >= Math.min(natural, 280) || below >= above
    setPlace(down
      ? { left, width: w, top: b.bottom + GAP, maxHeight: Math.max(160, below) }
      : { left, width: w, bottom: vh - b.top + GAP, maxHeight: Math.max(160, above) })
  }, [align, width])

  useLayoutEffect(() => { if (open) measure() }, [open, measure])

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      measure()
      const checked = panel.current?.querySelector<HTMLInputElement>('input[type="radio"]:checked')
      ;(filterable ? panel.current?.querySelector<HTMLInputElement>('input[type="search"]') : checked)?.focus()
    })
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!panel.current?.contains(t) && !trigger.current?.contains(t)) close(false)
    }
    const onMove = () => measure()
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [open, filterable, measure, close])

  const needle = filter.trim().toLowerCase()
  const shown = choices.filter((c) => !needle || c.label.toLowerCase().includes(needle))

  return (
    <div className={`os26-menu${className ? ` ${className}` : ''}`}>
      <button type="button" ref={trigger} className="os26-menu-button" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
        disabled={disabled} onClick={() => (open ? close() : setOpen(true))}>
        {button}<ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && createPortal(
        <div ref={panel} id={id} className={`os26-menu-panel os26-layer${className ? ` ${className}` : ''}`} role="dialog" aria-label={title}
          style={place ? { left: place.left, width: place.width, top: place.top, bottom: place.bottom, maxHeight: place.maxHeight } : { visibility: 'hidden' }}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() } }}
          // Leaving the panel by Tab closes it (no keyboard trap).
          onBlur={(e) => { if (!panel.current?.contains(e.relatedTarget as Node) && e.relatedTarget !== trigger.current && e.relatedTarget) close(false) }}>
          <header>
            <strong>{title}</strong>
            <button type="button" className="os26-icon-btn" onClick={() => close()} aria-label="Fermer" title="Fermer"><X size={15} /></button>
          </header>
          {filterable && (
            <label className="os26-menu-filter">
              <Search size={14} aria-hidden="true" />
              <span className="os26-sr">Rechercher dans la liste</span>
              <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Rechercher…" />
            </label>
          )}
          <div className="os26-menu-list" role="radiogroup" aria-label={title}>
            {shown.map((c) => (
              <label key={c.value} className={value === c.value ? 'is-checked' : ''}>
                <input type="radio" name={id} value={c.value} checked={value === c.value}
                  onChange={() => onChange(c.value)}
                  onClick={(e) => { if (e.detail > 0) close() }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onChange(c.value); close() } }} />
                <span>{c.label}</span>
                {c.count !== undefined && <small>{c.count.toLocaleString('fr-FR')}</small>}
              </label>
            ))}
            {shown.length === 0 && <p className="os26-menu-empty">Aucune entrée ne correspond.</p>}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
