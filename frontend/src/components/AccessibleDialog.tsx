import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import '@/mitre/mitre.css'

/*
 * Shared accessible dialog retained after the legacy ATT&CK pages were
 * removed. The class names intentionally preserve the existing visual
 * contract for IOC and OSINT consumers.
 */
export function Dialog({ title, onClose, children, footer }: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const box = ref.current
    const focusables = () => [...(box?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, select, a[href]') ?? [])]
    const first = box?.querySelector<HTMLElement>('[autofocus], input, textarea') ?? focusables()[0]
    first?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
      } else if (event.key === 'Tab') {
        const items = focusables()
        if (!items.length) return
        const [head, tail] = [items[0], items[items.length - 1]]
        if (event.shiftKey && document.activeElement === head) { event.preventDefault(); tail.focus() }
        else if (!event.shiftKey && document.activeElement === tail) { event.preventDefault(); head.focus() }
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  return (
    <div className="mx-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div ref={ref} className="mx-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="mx-dialog-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="mx-icon-btn" onClick={onClose} aria-label="Fermer"><X size={16} /></button>
        </div>
        <div className="mx-dialog-body">{children}</div>
        {footer && <div className="mx-dialog-foot">{footer}</div>}
      </div>
    </div>
  )
}
