import { useEffect, useMemo, useRef, useState } from 'react'
import {
  buildBoard, JourneyLayer, journeyKeyframes, LAYERS, LinkLayer,
  type Box, type CircuitGeometry, type HeroBoard, type HeroLink, type ModuleFeed, type Rect,
} from '@/dashboard2026/DashboardCircuit'
import './circuit.css'

/*
 * The Dashboard's motherboard for module pages. The board, its parts, buses,
 * journeys, glows and keyframes all come from the Dashboard's engine
 * (`buildBoard`); this component only measures the page and tells the engine
 * where the module's processor is:
 *
 * - the processor and its three lower feeds are read from the module hero's
 *   motif (`[data-feed]`), so a pulse leaves the very pins drawn in the hero;
 * - a connector astride the hero's lower edge, a relay chip in the header
 *   band, then branches into the page's board, down to its lowest chips;
 * - the feeds leave right after the hero's own pulse reaches the processor
 *   (one shared clock), one at a time.
 *
 * Layers: the board sits behind the page (z-index -1 in the isolated page
 * root), readable text on transparent ground is cut out of it; the hero part
 * of a journey and the connector are drawn above the hero. Nothing takes
 * pointer events. Recomputed on resize and when the page's content changes
 * size, never per frame.
 */

export type ModuleCircuitConfig = {
  /* Opaque surfaces: they hide the board (used to keep journeys visible). */
  surfaces: string
  /* Text and controls on transparent ground: cut out of the board. */
  readable: string
  /* Small panels the feed's input wires may pass behind, as the Dashboard's pass behind the environment card. */
  passBehind?: string
  /* The module header band: no part above its lower edge. */
  band: string
  /* The module hero card and its motif carrying `[data-feed]` marks. */
  hero: string
  /* Elements whose resizing calls for a new board (lists that load). */
  watch: string
  /* Optional free strip between the header band and the content (a results bar): the relay sits there, its branches spread along it. */
  relayZone?: string
  /* Hero pulse that reaches the processor: feeds leave right after it (s), and its cycle. */
  schedule: { start: number; cycle: number; trip: number }
}

type Measure = {
  width: number
  height: number
  obstacles: Rect[]
  holes: Box[]
  bandBottom: number
  boardTop: number
  hero: Box | null
  feed: ModuleFeed | null
  link: HeroLink | null
}

const round = (r: Box): Box => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) })
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

function measure(host: HTMLElement, config: ModuleCircuitConfig): Measure {
  const hb = host.getBoundingClientRect()
  const rel = (r: DOMRect): Box => ({ x: r.left - hb.left, y: r.top - hb.top, w: r.width, h: r.height })
  const shown = (sel: string) => [...host.querySelectorAll<HTMLElement>(sel)]
    .map((e) => e.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0)
    .map(rel)
  const obstacles: Rect[] = shown(config.surfaces).map((r) => ({ ...round(r), role: 'widget' as const }))
  const holes = shown(config.readable).map((r) => round({ x: r.x - 6, y: r.y - 5, w: r.w + 12, h: r.h + 10 }))
  // What the feed itself must route around: text and controls, not the small panels it may pass behind.
  const blockers = [...host.querySelectorAll<HTMLElement>(config.readable)]
    .filter((e) => !(config.passBehind && e.matches(config.passBehind)))
    .map((e) => e.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0)
    .map((r) => round({ x: r.x - hb.left - 6, y: r.y - hb.top - 5, w: r.width + 12, h: r.height + 10 }))
  const bandEl = host.querySelector(config.band)
  const bandBottom = bandEl ? Math.round(rel(bandEl.getBoundingClientRect()).y + bandEl.getBoundingClientRect().height) : 0
  const heroEl = host.querySelector<HTMLElement>(config.hero)
  const hero = heroEl ? round(rel(heroEl.getBoundingClientRect())) : null

  // The hero processor, its three lower feeds and their connector, from the motif.
  let feed: ModuleFeed | null = null
  let link: HeroLink | null = null
  let boardTop = bandBottom
  const chipEl = heroEl?.querySelector('[data-feed="chip"]')
  const pinEls = [...(heroEl?.querySelectorAll('[data-feed="pin"]') ?? [])]
  const connEl = heroEl?.querySelector('[data-feed="connector"]')
  if (hero && chipEl && connEl && pinEls.length === 3) {
    const chip = round(rel(chipEl.getBoundingClientRect()))
    const traces = pinEls.map((e) => rel(e.getBoundingClientRect())).sort((a, z) => a.x - z.x)
    const pins = traces.map((t) => Math.round((t.x + t.w / 2) * 2) / 2)
    const traceTop = Math.round(Math.min(...traces.map((t) => t.y)))
    const traceEnd = Math.round(Math.max(...traces.map((t) => t.y + t.h)))
    const conn = rel(connEl.getBoundingClientRect())
    const heroBottom = hero.y + hero.h
    const connTop = Math.round(Math.max(traceEnd + 2, conn.y))
    link = {
      x: pins[0] - 12, y: connTop, w: pins[2] - pins[0] + 24, h: heroBottom + 8 - connTop,
      variant: 'a', pins, dummies: [], top: traceEnd, bottom: heroBottom + 12,
    }
    // The relay: in the free strip above the content when there is one (its
    // branches then spread in plain sight), else right below the connector.
    const zoneEl = config.relayZone ? host.querySelector(config.relayZone) : null
    const zone = zoneEl ? rel(zoneEl.getBoundingClientRect()) : null
    const from = zone ? zone.y + 6 : link.bottom + 16
    const to = zone ? zone.y + zone.h - 26 : bandBottom - 40
    let relayTop: number | null = null
    for (let y = from; y <= to; y += 2) {
      // The engine's own relay box (DashboardCircuit feedJourneys): 64 x 40 from 8 px above the relay.
      const box = { x: pins[1] - 32, y: y - 8, w: 64, h: 40 }
      if (!holes.some((h) => overlaps(box, h)) && box.x > 0 && box.x + box.w < hb.width) { relayTop = Math.round(y); break }
    }
    // Below the relay the board is free to place parts (away from text and controls).
    if (relayTop !== null) boardTop = zone ? Math.round(zone.y + zone.h + 4) : relayTop + 44
    // Relay spots in the header band's free space, nearest to the connector first:
    // the relay box and its input bus stay off text and controls.
    const spots: { dx: number; top: number }[] = []
    if (!zone) {
      const span = pins[2] - pins[0]
      for (let step = 0; step <= 18; step += 1) {
        for (const dx of step === 0 ? [0] : [step * 24, -step * 24]) {
          for (let y = link.bottom + 30; y + 40 <= bandBottom; y += 6) {
            const box = { x: pins[1] + dx - 32, y: y - 8, w: 64, h: 40 }
            const lane = { x: Math.min(pins[0], pins[0] + dx) - 6, y: link.bottom, w: Math.abs(dx) + span + 12, h: 26 }
            const fall = { x: pins[0] + dx - 6, y: link.bottom, w: span + 12, h: y - link.bottom }
            if (box.x < 0 || box.x + box.w > hb.width) continue
            // The relay itself sits in the open; its input wires may pass behind a small panel.
            if (holes.some((h) => overlaps(box, h)) || [lane, fall].some((b) => blockers.some((h) => overlaps(b, h)))) continue
            spots.push({ dx, top: Math.round(y) })
            break
          }
        }
      }
    }
    if (spots.length && relayTop === null) relayTop = spots[0].top
    if (relayTop !== null) {
      // The feed's own corridor: connector, bus and relay stay clear of other parts.
      const corridor = { x: pins[0] - 46, y: hero.y + hero.h - 10, w: pins[2] - pins[0] + 92, h: 40 }
      feed = {
        spots: spots.length ? spots : undefined,
        avoid: [...holes, corridor],
        clearAbove: zone ? boardTop : hero.y + hero.h,
        link,
        heroPaths: pins.map((x) => [{ x, y: traceTop }, { x, y: traceEnd }]),
        chip,
        relayTop,
        keepout: blockers,
        schedule: config.schedule,
      }
    }
  }
  return { width: Math.round(hb.width), height: Math.round(hb.height), obstacles, holes, bandBottom, boardTop, hero, feed, link }
}

export default function ModuleCircuit({ config }: { config: ModuleCircuitConfig }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<{ m: Measure; g: Omit<CircuitGeometry, 'revision'> } | null>(null)
  const signature = useRef('')

  useEffect(() => {
    const page = hostRef.current?.parentElement
    if (!page) return
    let frame = 0
    const recompute = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const m = measure(page, config)
        const key = JSON.stringify([m.width, m.height, m.obstacles, m.holes, m.bandBottom, m.hero, m.link, m.feed?.relayTop])
        if (key === signature.current || m.width === 0 || m.height === 0) return
        signature.current = key
        const g = buildBoard(m.width, m.height, m.obstacles, m.obstacles, null, m.boardTop || undefined, m.feed)
        setState({ m, g })
      })
    }
    const observer = new ResizeObserver(recompute)
    const observeAll = () => {
      observer.disconnect()
      observer.observe(page)
      page.querySelectorAll(`${config.band}, ${config.hero}, ${config.watch}`).forEach((e) => observer.observe(e))
    }
    observeAll()
    // Lists that load or change re-measure (new elements to observe as well).
    const mutations = new MutationObserver(() => { observeAll(); recompute() })
    mutations.observe(page, { childList: true, subtree: true })
    window.addEventListener('resize', recompute)
    document.fonts?.ready.then(recompute)
    recompute()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      mutations.disconnect()
      window.removeEventListener('resize', recompute)
    }
  }, [config])

  const keyframes = useMemo(() => (state ? journeyKeyframes(state.g.journeys) : ''), [state])

  // One clock with the hero: board journeys start when the hero's pulses did.
  useEffect(() => {
    if (!state) return
    const frame = requestAnimationFrame(() => {
      const all = document.getAnimations().filter((a): a is CSSAnimation => a instanceof CSSAnimation)
      const board = all.filter((a) => /^cb[dtg]/.test(a.animationName))
      const hero = all.filter((a) => /^chh-(run|arrive|breathe)/.test(a.animationName))
      const starts = (hero.length ? hero : board).map((a) => Number(a.startTime)).filter((t) => Number.isFinite(t))
      if (!starts.length) return
      const origin = Math.min(...starts)
      for (const a of [...board, ...hero]) if (a.startTime !== origin) a.startTime = origin
    })
    return () => cancelAnimationFrame(frame)
  }, [state])

  const g = state?.g
  const m = state?.m
  // The connector and the in-hero journeys only when the feed really drives the board.
  const heroClip = g?.fed && m?.hero && m.link ? m.hero : null
  return (
    <>
      <div className="chc" ref={hostRef} aria-hidden="true">
        {g && m && (
          <svg className="chc-board board-layer" width={g.width} height={g.height} viewBox={`0 0 ${g.width} ${g.height}`} focusable="false">
            <style>{keyframes}</style>
            <defs>
              <mask id="chc-readable" maskUnits="userSpaceOnUse" x="0" y="0" width={g.width} height={g.height}>
                <rect width={g.width} height={g.height} fill="#fff" />
                {m.holes.map((h, i) => <rect key={i} x={h.x} y={h.y} width={h.w} height={h.h} rx={8} fill="#000" />)}
              </mask>
            </defs>
            <g mask="url(#chc-readable)">
              <g className="chc-static">
                {LAYERS.map((layer) => (g.layers[layer] ? <path key={layer} className={`b-${layer}`} d={g.layers[layer]} /> : null))}
              </g>
              <g className="b-journeys">
                <JourneyLayer journeys={g.journeys} mode="under" />
              </g>
            </g>
          </svg>
        )}
      </div>
      {/* Above the hero: the in-hero part of each journey, and the connector on the hero's edge. */}
      <div className="chc-top" ref={topRef} aria-hidden="true">
        {g && heroClip && (
          <svg className="chc-over" width={g.width} height={g.height} viewBox={`0 0 ${g.width} ${g.height}`} focusable="false">
            <defs>
              <clipPath id="chc-hero-clip">
                <rect x={heroClip.x} y={heroClip.y} width={heroClip.w} height={heroClip.h} />
              </clipPath>
            </defs>
            <g className="b-journeys" clipPath="url(#chc-hero-clip)">
              <JourneyLayer journeys={g.journeys} mode="under" clip={heroClip} />
            </g>
          </svg>
        )}
        {g?.fed && m?.link && topRef.current && (
          <LinkLayer hero={{ board: { x: 0, y: 0 } } as HeroBoard} link={m.link} journeys={g.journeys} target={topRef.current} />
        )}
      </div>
    </>
  )
}
