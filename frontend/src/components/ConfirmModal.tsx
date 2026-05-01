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
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="bg-bg-secondary border border-border rounded-lg shadow-xl p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle
            size={22}
            className={danger ? 'text-cyber-red shrink-0 mt-0.5' : 'text-yellow-400 shrink-0 mt-0.5'}
          />
          <div>
            <h3 className="text-text-primary font-semibold">{title}</h3>
            <p className="text-text-muted text-sm mt-1">{message}</p>
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
