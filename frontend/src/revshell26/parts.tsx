import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import type { RevShellOS } from '@/types/revshell'

/*
 * Shared pieces for the Reverse Shell console (styles in revshell26/revshell.css).
 * Purely presentational — the page keeps the data, debounce and API contract.
 * OS is always carried by its label, never by colour alone.
 */

export const OS_LABEL: Record<RevShellOS, string> = { linux: 'Linux', windows: 'Windows', cross: 'Cross-platform' }

export function OsMark({ os }: { os: string }) {
  const label = Object.prototype.hasOwnProperty.call(OS_LABEL, os) ? OS_LABEL[os as RevShellOS] : 'Unknown OS'
  return <span className="rs26-os" data-os={os}><i aria-hidden="true" />{label}</span>
}

export function CopyButton({ text, label = 'Copier', toast, onCopyError }: { text: string; label?: string; toast?: () => void; onCopyError?: () => void }) {
  const [copied, setCopied] = useState(false)
  const pending = useRef(false)
  const version = useRef(0)
  const copyTimer = useRef<number | null>(null)

  useEffect(() => {
    version.current += 1
    pending.current = false
    setCopied(false)
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current)
    copyTimer.current = null
    return () => {
      version.current += 1
      pending.current = false
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current)
      copyTimer.current = null
    }
  }, [text])

  const copy = async () => {
    if (pending.current) return
    pending.current = true
    const currentVersion = version.current
    try {
      const clipboard = navigator.clipboard
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('Clipboard unavailable')
      await clipboard.writeText(text)
      if (currentVersion !== version.current) return
      setCopied(true)
      toast?.()
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current)
      copyTimer.current = window.setTimeout(() => setCopied(false), 1800)
    } catch {
      if (currentVersion === version.current) {
        setCopied(false)
        onCopyError?.()
      }
    } finally {
      if (currentVersion === version.current) pending.current = false
    }
  }
  return (
    <button type="button" className="rs26-copy" data-copied={copied || undefined} onClick={copy} aria-label={copied ? 'Copié' : label}>
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      <span>{copied ? 'Copié' : 'Copier'}</span>
    </button>
  )
}

/*
 * A generated output block. `variant` drives the accent only: the payload is
 * the primary result (green), the listener secondary (amber).
 */
export function CodePanel({ title, code, variant, badge, onCopy, onCopyError, copyLabel }: {
  title: string; code: string; variant: 'payload' | 'listener'; badge?: ReactNode; onCopy?: () => void; onCopyError?: () => void; copyLabel?: string
}) {
  return (
    <section className="rs26-panel" data-variant={variant} aria-label={title}>
      <header className="rs26-panel-head">
        <div className="rs26-panel-id">
          <h3>{title}</h3>
          {badge}
        </div>
        <CopyButton text={code} label={copyLabel ?? `Copier ${title}`} toast={onCopy} onCopyError={onCopyError} />
      </header>
      <pre tabIndex={0} className="rs26-code"><code>{code}</code></pre>
    </section>
  )
}
