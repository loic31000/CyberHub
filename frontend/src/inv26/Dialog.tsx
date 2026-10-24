import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

/*
 * A modal dialog for Investigations: focus moves in on open, stays inside
 * (Tab wraps), Escape and the close button cancel, and focus goes back to
 * what opened it.
 */
export default function Dialog({ title, labelId, onClose, children, wide }: {
  title: string
  labelId: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const first = ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? ref.current?.querySelector<HTMLElement>('input, textarea, select, button')
    first?.focus()
    return () => previous?.focus()
  }, [])

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); return }
    if (event.key !== 'Tab' || !ref.current) return
    const focusable = [...ref.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')]
    if (!focusable.length) return
    const [first, last] = [focusable[0], focusable[focusable.length - 1]]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  return (
    <div className="iv26-layer" onMouseDown={(e) => { if (e.target === e.currentTarget) onCloseRef.current() }}>
      <div ref={ref} className={`iv26-dialog${wide ? ' is-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={labelId} onKeyDown={onKeyDown}>
        <div className="iv26-dialog-head">
          <h2 id={labelId}>{title}</h2>
          <button type="button" className="iv26-icon-btn" aria-label="Fermer" onClick={() => onCloseRef.current()}><X size={17} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
