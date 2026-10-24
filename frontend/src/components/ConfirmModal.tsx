import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

export default function ConfirmModal({
  open,
  title = 'Confirmation',
  message,
  confirmLabel = 'Confirmer',
  onConfirm,
  onCancel,
  danger = true,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? [])
    focusable()[0]?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancelRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) {
        event.preventDefault()
        dialog?.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
        tabIndex={-1}
        className="bg-bg-secondary border border-border rounded-lg shadow-xl p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle
            size={22}
            className={danger ? 'text-cyber-red shrink-0 mt-0.5' : 'text-yellow-400 shrink-0 mt-0.5'}
          />
          <div>
            <h3 id="confirm-modal-title" className="text-text-primary font-semibold">{title}</h3>
            <p id="confirm-modal-message" className="text-text-muted text-sm mt-1">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} className="btn-secondary">
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors
              ${danger
                ? 'bg-cyber-red/20 text-cyber-red border border-cyber-red/40 hover:bg-cyber-red/30'
                : 'btn-primary'
              }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
