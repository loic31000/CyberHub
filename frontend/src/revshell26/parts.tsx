import { useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import type { RevShellOS } from '@/types/revshell'

/*
 * Shared pieces for the Reverse Shell console (styles in revshell26/revshell.css).
 * Purely presentational — the page keeps the data, debounce and API contract.
 * OS is always carried by its label, never by colour alone.
 */

export const OS_LABEL: Record<RevShellOS, string> = { linux: 'Linux', windows: 'Windows', cross: 'Cross-platform' }

export function OsMark({ os }: { os: RevShellOS }) {
  return <span className="rs26-os" data-os={os}><i aria-hidden="true" />{OS_LABEL[os] ?? os}</span>
}

export function CopyButton({ text, label = 'Copier', toast }: { text: string; label?: string; toast?: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(text)
      .then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1800); toast?.() })
      .catch(() => {})
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
export function CodePanel({ title, code, variant, badge, onCopy, copyLabel }: {
  title: string; code: string; variant: 'payload' | 'listener'; badge?: ReactNode; onCopy?: () => void; copyLabel?: string
}) {
  return (
    <section className="rs26-panel" data-variant={variant} aria-label={title}>
      <header className="rs26-panel-head">
        <div className="rs26-panel-id">
          <h3>{title}</h3>
          {badge}
        </div>
        <CopyButton text={code} label={copyLabel ?? `Copier ${title}`} toast={onCopy} />
      </header>
      <pre tabIndex={0} className="rs26-code"><code>{code}</code></pre>
    </section>
  )
}
