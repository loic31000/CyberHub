import { useId } from 'react'
import { AlertTriangle } from 'lucide-react'
import Dialog from './Dialog'

/* A destructive action, confirmed explicitly; Cancel has the focus first. */
export default function ConfirmDialog({ open, title, message, confirmLabel, busy, onConfirm, onCancel }: {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const labelId = useId()
  if (!open) return null
  return (
    <Dialog title={title} labelId={labelId} onClose={() => { if (!busy) onCancel() }}>
      <p className="iv26-confirm"><AlertTriangle size={18} aria-hidden="true" />{message}</p>
      <div className="iv26-dialog-actions">
        <button type="button" className="iv26-btn" onClick={onCancel} disabled={busy} data-autofocus>Annuler</button>
        <button type="button" className="iv26-btn is-danger" onClick={onConfirm} disabled={busy}>{busy ? 'Suppression…' : confirmLabel}</button>
      </div>
    </Dialog>
  )
}
