import { useEffect, useId, useRef, type ReactNode } from 'react'
import { AlertTriangle, X } from 'lucide-react'

/*
 * A modal dialog for Playbooks: focus moves in on open, stays inside (Tab
 * wraps), Escape and the close button cancel, and focus goes back to what
 * opened it.
 */
function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const labelId = useId()
  const ref = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const first = ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? ref.current?.querySelector<HTMLElement>('button')
    first?.focus()
    return () => previous?.focus()
  }, [])

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); return }
    if (event.key !== 'Tab' || !ref.current) return
    const focusable = [...ref.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled)')]
    if (!focusable.length) return
    const [first, last] = [focusable[0], focusable[focusable.length - 1]]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  return (
    <div className="pb26-layer" onMouseDown={(e) => { if (e.target === e.currentTarget) onCloseRef.current() }}>
      <div ref={ref} className="pb26-dialog" role="dialog" aria-modal="true" aria-labelledby={labelId} onKeyDown={onKeyDown}>
        <div className="pb26-dialog-head">
          <h2 id={labelId}>{title}</h2>
          <button type="button" className="pb26-icon-btn" aria-label="Fermer" onClick={() => onCloseRef.current()}><X size={17} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* An action that loses something, confirmed explicitly; Cancel has the focus first. */
export default function ConfirmDialog({ open, title, message, confirmLabel, busyLabel, busy, tone = 'danger', onConfirm, onCancel }: {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  busyLabel?: string
  busy?: boolean
  tone?: 'danger' | 'warn'
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <Dialog title={title} onClose={() => { if (!busy) onCancel() }}>
      <p className={`pb26-confirm is-${tone}`}><AlertTriangle size={18} aria-hidden="true" />{message}</p>
      <div className="pb26-dialog-actions">
        <button type="button" className="pb26-btn" onClick={onCancel} disabled={busy} data-autofocus>Annuler</button>
        <button type="button" className={`pb26-btn is-${tone}`} onClick={onConfirm} disabled={busy}>{busy ? busyLabel ?? 'Patientez…' : confirmLabel}</button>
      </div>
    </Dialog>
  )
}
