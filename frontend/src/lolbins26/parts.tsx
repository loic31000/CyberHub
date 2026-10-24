import { useState } from 'react'
import { Check, Copy, Cpu, ShieldAlert, Terminal } from 'lucide-react'
import type { LOLBin, LOLBinCommand } from '@/types/lolbins'

/*
 * Shared pieces for the LOLBins / GTFOBins catalog (styles in
 * lolbins26/lolbins.css). The data contract is untouched: several fields are
 * JSON strings parsed here with a safe fallback, and OS / command type are
 * always carried by text, never colour alone. Nothing is executed — the page
 * only displays and copies text.
 */

/* Robust JSON parse: a malformed field falls back instead of throwing. */
export function parseJSON<T>(str: string | undefined, fallback: T): T {
  if (!str) return fallback
  try {
    const value = JSON.parse(str)
    return value == null ? fallback : (value as T)
  } catch {
    return fallback
  }
}
export const parseMitre = (raw?: string) => parseJSON<string[]>(raw, []).filter(Boolean)
export const parseCommands = (raw?: string) => parseJSON<LOLBinCommand[]>(raw, []).filter(c => getCommandText(c))
export const parseTags = (raw?: string) => parseJSON<string[]>(raw, []).filter(Boolean)

export const getCommandText = (cmd: LOLBinCommand): string => cmd.Command ?? cmd.commands ?? ''
export const getCommandDesc = (cmd: LOLBinCommand): string => cmd.Description ?? cmd.description ?? ''
export const getCommandType = (cmd: LOLBinCommand): string => cmd.type ?? cmd.Usecase ?? cmd.Category ?? ''
export const getCommandPriv = (cmd: LOLBinCommand): string => cmd.Privileges ?? ''

export const OS_LABEL: Record<LOLBin['os'], string> = { windows: 'Windows', linux: 'Linux' }
export const OS_SHORT: Record<LOLBin['os'], string> = { windows: 'WIN', linux: 'LIN' }

/* OS mark: icon + short code + full label, so the platform never reads by colour alone. */
export function OsMark({ os, long }: { os: LOLBin['os']; long?: boolean }) {
  return (
    <span className="lb26-os" data-os={os}>
      <Terminal size={13} aria-hidden="true" />
      {long ? OS_LABEL[os] : OS_SHORT[os]}
    </span>
  )
}

/* Elevated privileges stand out (text + mark); standard ones stay neutral. */
export function PrivMark({ priv }: { priv: string }) {
  const elevated = /^(administrator|admin|system|root|sudo)$/i.test(priv.trim())
  return (
    <span className="lb26-priv" data-elevated={elevated || undefined}>
      {elevated && <ShieldAlert size={12} aria-hidden="true" />}{priv}
    </span>
  )
}

export function CopyButton({ text, label = 'Copier la commande' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(text)
      .then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1800) })
      .catch(() => {})
  }
  return (
    <button type="button" className="lb26-copy" data-copied={copied || undefined} onClick={copy} aria-label={copied ? 'Copié' : label}>
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      <span>{copied ? 'Copié' : 'Copier'}</span>
    </button>
  )
}

/* One abuse command: use case, privileges, description, then the command line. */
export function CommandCard({ cmd, index }: { cmd: LOLBinCommand; index: number }) {
  const text = getCommandText(cmd)
  const desc = getCommandDesc(cmd)
  const type = getCommandType(cmd)
  const priv = getCommandPriv(cmd)
  const titleId = `lb26-cmd-${index}`
  return (
    <article className="lb26-cmd" aria-labelledby={titleId}>
      <header className="lb26-cmd-head">
        <h4 id={titleId} className="lb26-cmd-type">
          <Cpu size={13} aria-hidden="true" />{type || `Commande ${index + 1}`}
        </h4>
        {priv && <PrivMark priv={priv} />}
      </header>
      {desc && <p className="lb26-cmd-desc">{desc}</p>}
      <div className="lb26-cmd-line">
        <pre tabIndex={0} aria-label={`Commande ${type || index + 1}`}><code>{text}</code></pre>
        <CopyButton text={text} label={`Copier la commande ${type || index + 1}`} />
      </div>
    </article>
  )
}
