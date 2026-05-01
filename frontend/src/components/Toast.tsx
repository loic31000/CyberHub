import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToastStore, type ToastItem, type ToastType } from '@/store/toast'

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={18} className="text-cyber-green shrink-0" />,
  error:   <XCircle    size={18} className="text-cyber-red   shrink-0" />,
  warning: <AlertTriangle size={18} className="text-yellow-400 shrink-0" />,
  info:    <Info       size={18} className="text-cyber-cyan  shrink-0" />,
}

const BORDERS: Record<ToastType, string> = {
  success: 'border-cyber-green/40',
  error:   'border-cyber-red/40',
  warning: 'border-yellow-400/40',
  info:    'border-cyber-cyan/40',
}

function ToastCard({ toast }: { toast: ToastItem }) {
  const remove = useToastStore((s) => s.remove)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Entrée avec légère animation
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-lg bg-bg-secondary border ${BORDERS[toast.type]}
        shadow-lg text-sm text-text-primary max-w-sm w-full
        transition-all duration-300
        ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}
    >
      {ICONS[toast.type]}
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={() => remove(toast.id)}
        className="text-text-muted hover:text-text-primary transition-colors shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastCard toast={t} />
        </div>
      ))}
    </div>
  )
}
