import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react'
import './module-hero.css'

/*
 * CyberHub 2026 module hero: the Dashboard's "Terminal Overview" language
 * (navy card, cyan edge accent, white + cyan display title typed in like a
 * terminal, mono breadcrumb) for module pages. Each module brings its own
 * electronic motif on the right, drawn with the board primitives below and
 * the same parts as the Dashboard's CH processor.
 *
 * Styles live in module-hero.css, scoped under `.chh`.
 */

/*
 * Moving between pages of the same module does not type the title again: a
 * module's hero is either still mounted (the next page renders before the old
 * one unmounts) or left the page moments ago.
 */
const mounted = new Map<string, number>()
const leftAt = new Map<string, number>()
const SAME_VISIT_MS = 3000

/*
 * The Dashboard's typing effect: glyphs appear one by one behind a cyan
 * cursor (about 1.1 s for MITRE ATT&CK), once per arrival on the module.
 * Glyphs only change opacity, so the layout never moves; screen readers get
 * the full title; reduced motion shows it at once (module-hero.css).
 */
function TypedTitle({ id, title, accent, module }: { id: string; title: string; accent?: string; module: string }) {
  const [mode] = useState(() => {
    const left = leftAt.get(module)
    return (mounted.get(module) ?? 0) > 0 || (left !== undefined && Date.now() - left < SAME_VISIT_MS) ? 'still' : 'type'
  })
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    mounted.set(module, (mounted.get(module) ?? 0) + 1)
    let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => setTyping(true)) })
    return () => {
      cancelAnimationFrame(frame)
      mounted.set(module, (mounted.get(module) ?? 1) - 1)
      leftAt.set(module, Date.now())
    }
  }, [module])

  let step = 0
  const glyphs = (word: string) => [...word].map((char) => {
    const order = step++
    return <i key={order} className="chh-glyph" style={{ '--glyph': order } as CSSProperties}>{char}</i>
  })
  const first = glyphs(title)
  step += 1 // the space is one more keystroke for the cursor
  const second = accent ? glyphs(accent) : null
  const state = mode === 'still' ? ' is-still' : typing ? ' is-typing' : ''
  return (
    <h1 id={id} className={`chh-title chh-typed${state}${accent ? '' : ' no-accent'}`}>
      <span className="chh-sr">{accent ? `${title} ${accent}` : title}</span>
      <i className="chh-typed-word" aria-hidden="true">{first}</i>
      {second && <>{' '}<span aria-hidden="true">{second}</span></>}
    </h1>
  )
}

/*
 * The right-hand cartouche, built like the Dashboard's: a cyan label, a few
 * mono lines naming the module's domains, and a status line at the bottom
 * that only states what the page actually knows.
 */
export type HeroIndex = {
  label: string
  lines: string[]
  status?: { text: string; mark?: string; tone?: 'ok' | 'busy' | 'warn' }
}

function Index({ index }: { index: HeroIndex }) {
  const { status } = index
  return (
    <div className="chh-index">
      <div className="chh-index-lines" aria-hidden="true">
        <span className="chh-index-label">{index.label}</span>
        {index.lines.map((line) => <span key={line}>{line}</span>)}
      </div>
      {status && (
        <p className={`chh-status is-${status.tone ?? 'ok'}`}>
          <strong><i aria-hidden="true" />{status.text}</strong>
          {status.mark && <span>{status.mark}</span>}
        </p>
      )}
    </div>
  )
}

export function ModuleHero({ breadcrumb, title, accent, subtitle, motif, index, compactTitle, typeOnce }: {
  breadcrumb: string
  title: ReactNode
  accent?: string
  subtitle?: ReactNode
  motif?: ReactNode
  index?: HeroIndex
  /* Long titles (a layer name, a case title) use a smaller size. */
  compactTitle?: boolean
  /* Types a string title once per arrival on this module (module key). */
  typeOnce?: string
}) {
  const id = useId()
  return (
    <section className={`chh${motif ? ' has-motif' : ''}${index ? ' has-index' : ''}`} aria-labelledby={id}>
      <div className="chh-copy">
        <span className="chh-crumb">{breadcrumb}</span>
        {typeOnce && typeof title === 'string' && !compactTitle ? (
          <TypedTitle id={id} title={title} accent={accent} module={typeOnce} />
        ) : (
          <h1 id={id} className={`chh-title${compactTitle ? ' is-compact' : ''}`}>
            {title}{accent && <> <span>{accent}</span></>}
          </h1>
        )}
        {subtitle && <p className="chh-sub">{subtitle}</p>}
      </div>
      {motif && <div className="chh-motif" aria-hidden="true">{motif}</div>}
      {index && <Index index={index} />}
    </section>
  )
}

/* ---------- board primitives for hero motifs (SVG user units) ---------- */

type P = [number, number]
const d = (pts: P[]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('')

/* A copper trace between two real pins. */
export function Trace({ pts, bus }: { pts: P[]; bus?: boolean }) {
  return <path className={bus ? 'chh-bus' : 'chh-trace'} d={d(pts)} />
}

export function Via({ x, y, r = 2.4 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle className="chh-via" cx={x} cy={y} r={r} />
      <circle className="chh-hole" cx={x} cy={y} r={r * 0.42} />
    </g>
  )
}

/* Pins along one side of a package, at the given positions; `from` is the package edge. */
export function Pins({ side, at, from, len = 5 }: { side: 'l' | 'r' | 't' | 'b'; at: number[]; from: number; len?: number }) {
  return (
    <g className="chh-pin">
      {at.map((v) => {
        if (side === 'l') return <rect key={v} x={from - len} y={v - 1} width={len} height={2} />
        if (side === 'r') return <rect key={v} x={from} y={v - 1} width={len} height={2} />
        if (side === 't') return <rect key={v} x={v - 1} y={from - len} width={2} height={len} />
        return <rect key={v} x={v - 1} y={from} width={2} height={len} />
      })}
    </g>
  )
}

/* A plain package body (SOIC, connector, BGA outline) with its offset shadow. */
export function Body({ x, y, w, h, r = 3 }: { x: number; y: number; w: number; h: number; r?: number }) {
  return (
    <g>
      <rect className="chh-shadow" x={x + 2} y={y + 3} width={w} height={h} rx={r} />
      <rect className="chh-body" x={x} y={y} width={w} height={h} rx={r} />
    </g>
  )
}

/* A small SMD part (capacitor, resistor) with its two pads. */
export function Smd({ x, y, vertical }: { x: number; y: number; vertical?: boolean }) {
  return vertical ? (
    <g>
      <rect className="chh-cap" x={x - 2.5} y={y - 4.5} width={5} height={9} rx={1} />
      <rect className="chh-pad" x={x - 2.5} y={y - 4.5} width={5} height={2} />
      <rect className="chh-pad" x={x - 2.5} y={y + 2.5} width={5} height={2} />
    </g>
  ) : (
    <g>
      <rect className="chh-cap" x={x - 4.5} y={y - 2.5} width={9} height={5} rx={1} />
      <rect className="chh-pad" x={x - 4.5} y={y - 2.5} width={2} height={5} />
      <rect className="chh-pad" x={x + 2.5} y={y - 2.5} width={2} height={5} />
    </g>
  )
}

/*
 * A signal pulse along a path. It travels during the first fifth of `period`
 * (keyframes in module-hero.css), starting at `delay`; anything synchronised
 * with its arrival (a node lighting up) uses <Arrival> with the same timing.
 * Hidden under prefers-reduced-motion.
 */
export function Pulse({ path, period, delay, tone = 'cyan' }: {
  path: string; period: number; delay: number; tone?: 'cyan' | 'ice' | 'white'
}) {
  const style = { offsetPath: `path("${path}")`, animationDuration: `${period}s`, animationDelay: `${delay}s` } as CSSProperties
  return (
    <g className={`chh-pulse is-${tone}`} style={style}>
      <circle className="chh-pulse-soft" r={3.2} />
      <circle className="chh-pulse-core" r={1.6} />
    </g>
  )
}

/* Lights its children when the pulse with the same period and delay arrives. */
export function Arrival({ period, delay, children }: { period: number; delay: number; children: ReactNode }) {
  return <g className="chh-arrival" style={{ animationDuration: `${period}s`, animationDelay: `${delay}s` }}>{children}</g>
}
