import { useEffect, useId, useRef, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Cloud, Globe, Monitor, Network, Server, Smartphone, X } from 'lucide-react'
import { LayersGlyph, MitreGlyph } from '@/dashboard2026/CyberGlyphs'
import { ModuleHero, type HeroIndex } from '@/hero/ModuleHero'
import MitreMotif from './MitreMotif'
import './mitre.css'

/*
 * Shared pieces of the MITRE ATT&CK module (Explorer, Layers, Layer detail):
 * the page header with its Explorer / Layers tabs, platform badges, states and
 * an accessible dialog. Styles live in mitre.css, scoped under `.mx`.
 */

export function parseArr(raw?: string): string[] {
  if (!raw) return []
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [] }
  catch { return [] }
}

/* The tactic's colour comes from mitre.css (`[data-tactic]`); unknown tactics stay cyan. */
export const tacticTone = (shortName?: string) => (shortName ? { 'data-tactic': shortName } : {})

const PLATFORM_ICONS: Record<string, typeof Monitor> = {
  Windows: Monitor, Linux: Server, macOS: Monitor,
  Android: Smartphone, iOS: Smartphone, Cloud: Cloud,
  Network: Network, IaaS: Cloud, SaaS: Cloud,
  Azure: Cloud, 'Google Workspace': Cloud,
  'Office 365': Globe, 'Azure AD': Cloud,
}

export function PlatformIcon({ name, size = 12 }: { name: string; size?: number }) {
  const Icon = PLATFORM_ICONS[name] ?? Globe
  return <Icon size={size} aria-hidden="true" />
}

export function PlatformTag({ name }: { name: string }) {
  return <span className="mx-tag"><PlatformIcon name={name} size={11} />{name}</span>
}

/*
 * Module header, three bands: identity (the CyberHub 2026 hero with the
 * ATT&CK motif), key figures with the page's tools, then the module tabs.
 */
/* The cartouche's domains; its status line comes from each page's real state. */
const INDEX_LINES = ['ATT&CK ENTERPRISE', 'TACTICS & TECHNIQUES', 'LAYERS ATT&CK']

export function MitreHeader({ breadcrumb, title, accent, subtitle, compactTitle, status, actions, stats, children, below }: {
  breadcrumb: string
  /* The page's tools band (search, filters), drawn over the same light circuit. */
  below?: ReactNode
  status?: HeroIndex['status']
  title: string
  accent?: string
  subtitle?: ReactNode
  compactTitle?: boolean
  actions?: ReactNode
  stats?: { label: string; value: ReactNode; cyan?: boolean }[]
  children?: ReactNode
}) {
  return (
    <div className="mx-top">
      <header className="mx-head">
      <ModuleHero breadcrumb={breadcrumb} title={title} accent={accent} subtitle={subtitle} compactTitle={compactTitle} typeOnce="mitre" motif={<MitreMotif />}
        index={{ label: 'INTEL / 2026', lines: INDEX_LINES, status }} />
      {((stats && stats.length > 0) || actions) && (
        <div className="mx-head-row">
          {stats && stats.length > 0 ? (
            <dl className="mx-stats">
              {stats.map((s) => (
                <div key={s.label} className={`mx-stat${s.cyan ? ' is-cyan' : ''}`}>
                  <dt className="mx-stat-label">{s.label}</dt>
                  <dd className="mx-stat-value">{s.value}</dd>
                </div>
              ))}
            </dl>
          ) : <span />}
          {actions && <div className="mx-head-actions">{actions}</div>}
        </div>
      )}
      {children ?? <ModuleTabs />}
      </header>
      {below}
    </div>
  )
}

/* Navigation between the matrix and the layers. */
export function ModuleTabs() {
  return (
    <nav className="mx-tabs" aria-label="MITRE ATT&CK">
      <NavLink to="/mitre" end className={({ isActive }) => `mx-tab${isActive ? ' is-active' : ''}`}>
        <MitreGlyph size={16} />Explorer la matrice
      </NavLink>
      <NavLink to="/mitre/layers" className={({ isActive }) => `mx-tab${isActive ? ' is-active' : ''}`}>
        <LayersGlyph size={16} />Layers ATT&CK
      </NavLink>
    </nav>
  )
}

export function StateBlock({ icon, title, children, actions, warn, page, live }: {
  icon: ReactNode
  title: string
  children?: ReactNode
  actions?: ReactNode
  warn?: boolean
  page?: boolean
  live?: boolean
}) {
  return (
    <div className={`mx-state${page ? ' is-page' : ''}`} role={live ? 'status' : undefined}>
      <span className={`mx-state-icon${warn ? ' is-warn' : ''}`} aria-hidden="true">{icon}</span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {actions && <div className="mx-state-actions">{actions}</div>}
    </div>
  )
}

export function SkeletonGrid({ count = 9 }: { count?: number }) {
  return (
    <div className="mx-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => <div key={i} className="mx-skeleton" />)}
    </div>
  )
}

/*
 * Modal dialog: focus moves inside on open, Tab stays inside, Escape and the
 * backdrop close it, and focus returns to the opener on close.
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
    <div className="mx-dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
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

/*
 * MITRE descriptions as readable text: paragraphs, Markdown links and inline
 * code (`x` or <code>x</code>), citations removed. Builds React nodes, never HTML.
 */
const INLINE = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|<code>([\s\S]*?)<\/code>|`([^`]+)`/g

function inline(text: string) {
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0
    if (at > last) out.push(text.slice(last, at))
    if (m[1]) out.push(<a key={at} href={m[2]} target="_blank" rel="noopener noreferrer">{m[1]}</a>)
    else out.push(<code key={at}>{m[3] ?? m[4]}</code>)
    last = at + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function RichText({ text }: { text?: string }) {
  const clean = (text ?? '').replace(/\(Citation:[^)]+\)/g, '').trim()
  if (!clean) return <div className="mx-rich"><p>—</p></div>
  return (
    <div className="mx-rich">
      {clean.split(/\n\s*\n/).map((para, i) => <p key={i}>{inline(para.trim())}</p>)}
    </div>
  )
}

/* Arrow keys, Home and End move between the tactic filters of a list. */
export function onTacticKeys(event: React.KeyboardEvent<HTMLElement>) {
  const keys = ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End']
  if (!keys.includes(event.key)) return
  const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('.mx-tactic')]
  const at = items.indexOf(document.activeElement as HTMLButtonElement)
  if (at < 0) return
  event.preventDefault()
  const next = event.key === 'Home' ? 0
    : event.key === 'End' ? items.length - 1
    : event.key === 'ArrowDown' || event.key === 'ArrowRight' ? Math.min(items.length - 1, at + 1)
    : Math.max(0, at - 1)
  items[next].focus()
}
