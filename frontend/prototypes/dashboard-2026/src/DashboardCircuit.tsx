import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";

/*
 * Phase 2L: background circuit routed through the real gutters of the board.
 * The geometry is measured from the rendered panels, so a future widget layout
 * only has to call `requestCircuitRecompute()` after moving a panel.
 */

export const CIRCUIT_LAYOUT_EVENT = "cyberhub:layout-change";

export function requestCircuitRecompute() {
  window.dispatchEvent(new Event(CIRCUIT_LAYOUT_EVENT));
}

const OBSTACLE_SELECTOR =
  ".dashboard-board .overview-hero, .dashboard-board .dashboard-panel, .dashboard-board .sync-panel, .dashboard-board .page-foot";

const CLEARANCE = 6;
const LANE_SPACING = 7;
const MIN_LANE = 44;
const CHAMFER = 10;

type Tone = "cyan" | "blue" | "white" | "amber";
const TONES: Tone[] = ["cyan", "blue", "white", "amber"];
// Phase 2M: a calm board. At most five travelling points, amber only now and then.
const PULSE_TONES: Tone[] = ["cyan", "blue", "cyan", "white", "amber"];
const NODE_TONES: Tone[] = ["cyan", "white", "blue"];
const PULSE_SPEED = 72; // px per second
const TRAVEL_SHARE = 0.6; // the rest of each cycle is a quiet pause
const RARE_TRAVEL_SHARE = 0.34;

type Rect = { x: number; y: number; w: number; h: number };
type Point = { x: number; y: number };
type Lane = {
  axis: "h" | "v";
  at: number;
  from: number;
  to: number;
  center: boolean;
};
type Route = { d: string; length: number; center: Point };
type Pulse = Route & { tone: Tone; duration: number; delay: number; rare: boolean };

export type CircuitGeometry = {
  width: number;
  height: number;
  obstacles: Rect[];
  lanes: Lane[];
  vias: (Point & { tone: Tone })[];
  pads: Point[];
  pulses: Pulse[];
  revision?: number;
};

function rangesOverlap(a1: number, a2: number, b1: number, b2: number) {
  return Math.min(a2, b2) - Math.max(a1, b1) > 1;
}

/* Free intervals of [start, end] once the blocked intervals are removed. */
function freeIntervals(start: number, end: number, blocked: [number, number][]) {
  const result: [number, number][] = [];
  let cursor = start;
  for (const [from, to] of [...blocked].sort((a, b) => a[0] - b[0])) {
    if (from > cursor) result.push([cursor, Math.min(from, end)]);
    cursor = Math.max(cursor, to);
    if (cursor >= end) break;
  }
  if (cursor < end) result.push([cursor, end]);
  return result.filter(([from, to]) => to - from >= MIN_LANE);
}

/* Gutters on one axis: the space after each obstacle up to its nearest neighbour. */
function gutters(obstacles: Rect[], axis: "h" | "v", limit: number) {
  const start = (r: Rect) => (axis === "h" ? r.y : r.x);
  const end = (r: Rect) => (axis === "h" ? r.y + r.h : r.x + r.w);
  const across = (r: Rect): [number, number] =>
    axis === "h" ? [r.x, r.x + r.w] : [r.y, r.y + r.h];

  const found = new Map<string, [number, number]>();
  const add = (from: number, to: number) => {
    if (to - from < 10) return;
    // Wide free areas (margins) keep a compact bus close to the panel edge.
    const capped: [number, number] =
      to - from > 64 ? [from, from + 44] : [from, to];
    found.set(`${Math.round(capped[0])}:${Math.round(capped[1])}`, capped);
  };

  if (obstacles.length) add(0, Math.min(...obstacles.map(start)));
  for (const a of obstacles) {
    const [a1, a2] = across(a);
    const next = obstacles
      .filter((b) => b !== a && start(b) >= end(a) - 1 && rangesOverlap(a1, a2, ...across(b)))
      .map(start);
    add(end(a), next.length ? Math.min(...next) : limit);
  }
  return [...found.values()];
}

function buildLanes(obstacles: Rect[], width: number, height: number, axis: "h" | "v") {
  const limit = axis === "h" ? height : width;
  const span = axis === "h" ? width : height;
  const lanes: Lane[] = [];
  const seen = new Set<string>();

  for (const [from, to] of gutters(obstacles, axis, limit)) {
    const size = to - from;
    const count = size >= 30 ? 3 : size >= 20 ? 2 : 1;
    const middle = from + size / 2;
    for (let index = 0; index < count; index += 1) {
      const at = Math.round(middle + (index - (count - 1) / 2) * LANE_SPACING);
      const blocked = obstacles
        .filter((r) =>
          axis === "h"
            ? at > r.y - CLEARANCE && at < r.y + r.h + CLEARANCE
            : at > r.x - CLEARANCE && at < r.x + r.w + CLEARANCE,
        )
        .map((r): [number, number] =>
          axis === "h"
            ? [r.x - CLEARANCE, r.x + r.w + CLEARANCE]
            : [r.y - CLEARANCE, r.y + r.h + CLEARANCE],
        );
      for (const [laneFrom, laneTo] of freeIntervals(4, span - 4, blocked)) {
        const key = `${axis}:${at}:${Math.round(laneFrom)}:${Math.round(laneTo)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        lanes.push({
          axis,
          at,
          from: Math.round(laneFrom),
          to: Math.round(laneTo),
          center: index === (count - 1) / 2 || (count === 2 && index === 0),
        });
      }
    }
  }
  return lanes;
}

function lanePath(lane: Lane, reverse = false) {
  const [a, b] = reverse ? [lane.to, lane.from] : [lane.from, lane.to];
  return lane.axis === "h"
    ? `M${a} ${lane.at} H${b}`
    : `M${lane.at} ${a} V${b}`;
}

/* L-shaped route: down a vertical lane, 45° chamfer, then along a horizontal lane. */
function cornerRoute(v: Lane, h: Lane): Route | null {
  const x = v.at;
  const y = h.at;
  const goRight = h.to - x >= x - h.from;
  const horizontalEnd = goRight ? h.to : h.from;
  const comesFromTop = y - v.from >= v.to - y;
  const verticalStart = comesFromTop ? v.from : v.to;
  const vertical = Math.abs(y - verticalStart) - CHAMFER;
  const horizontal = Math.abs(horizontalEnd - x) - CHAMFER;
  if (vertical < 24 || horizontal < 24) return null;
  const dy = comesFromTop ? -CHAMFER : CHAMFER;
  const dx = goRight ? CHAMFER : -CHAMFER;
  return {
    d: `M${x} ${verticalStart} V${y + dy} L${x + dx} ${y} H${horizontalEnd}`,
    length: vertical + horizontal + CHAMFER * Math.SQRT2,
    center: { x: (x + horizontalEnd) / 2, y: (y + verticalStart) / 2 },
  };
}

export function buildCircuit(width: number, height: number, obstacles: Rect[]): CircuitGeometry {
  const compact = width < 760;
  const horizontal = buildLanes(obstacles, width, height, "h");
  const vertical = buildLanes(obstacles, width, height, "v");
  const lanes = [...horizontal, ...vertical];

  const vias: CircuitGeometry["vias"] = [];
  const corners: Route[] = [];
  for (const v of vertical.filter((lane) => lane.center)) {
    for (const h of horizontal.filter((lane) => lane.center)) {
      if (v.at < h.from || v.at > h.to || h.at < v.from || h.at > v.to) continue;
      vias.push({ x: v.at, y: h.at, tone: NODE_TONES[vias.length % NODE_TONES.length] });
      const route = cornerRoute(v, h);
      if (route) corners.push(route);
    }
  }

  const pads: Point[] = [];
  for (const lane of lanes) {
    for (const end of [lane.from, lane.to]) {
      if (end <= 6 || end >= (lane.axis === "h" ? width : height) - 6) continue;
      pads.push(lane.axis === "h" ? { x: end, y: lane.at } : { x: lane.at, y: end });
    }
  }

  const straight = lanes
    .filter((lane) => lane.center && lane.to - lane.from >= 160)
    .map((lane, index): Route => {
      const middle = (lane.from + lane.to) / 2;
      return {
        d: lanePath(lane, index % 2 === 1),
        length: lane.to - lane.from,
        center: lane.axis === "h" ? { x: middle, y: lane.at } : { x: lane.at, y: middle },
      };
    });
  const candidates = [...corners, ...straight].filter((route) => route.length >= 160);

  // Spread the few routes apart: each pick is the farthest from those already chosen.
  const chosen: Route[] = [];
  const maxPulses = compact ? 3 : PULSE_TONES.length;
  const longest = [...candidates].sort((a, b) => b.length - a.length)[0];
  if (longest) chosen.push(longest);
  while (chosen.length < Math.min(maxPulses, candidates.length)) {
    let best: Route | null = null;
    let bestDistance = -1;
    for (const route of candidates) {
      if (chosen.includes(route)) continue;
      const distance = Math.min(
        ...chosen.map((other) => Math.hypot(route.center.x - other.center.x, route.center.y - other.center.y)),
      );
      if (distance > bestDistance) {
        bestDistance = distance;
        best = route;
      }
    }
    if (!best) break;
    chosen.push(best);
  }

  const pulses: Pulse[] = chosen.map((route, index) => {
    const tone = PULSE_TONES[index];
    const rare = tone === "amber";
    const travel = route.length / (PULSE_SPEED + (index % 3) * 8);
    const duration = Math.min(30, Math.max(7, travel / (rare ? RARE_TRAVEL_SHARE : TRAVEL_SHARE)));
    // Staggered phases so the points never start together.
    const delay = -((index / chosen.length) * duration + index * 0.9);
    return { ...route, tone, duration, delay, rare };
  });

  return { width, height, obstacles, lanes, vias, pads, pulses };
}

function measure(host: HTMLElement) {
  const box = host.getBoundingClientRect();
  const elements = [
    ...(host.parentElement?.querySelectorAll<HTMLElement>(OBSTACLE_SELECTOR) ?? []),
  ];
  const obstacles = elements
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect) => ({
      x: Math.round(rect.left - box.left),
      y: Math.round(rect.top - box.top),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
    }));
  return {
    elements,
    width: Math.round(box.width),
    height: Math.round(box.height),
    obstacles,
  };
}

/*
 * Measures the board only when something can have moved: element resize,
 * window resize, font loading, or an explicit layout-change event. Updates are
 * coalesced in one animation frame and skipped when the rounded geometry is
 * unchanged, so the observer cannot feed itself.
 */
export function useCircuitGeometry(hostRef: RefObject<HTMLElement | null>) {
  const [geometry, setGeometry] = useState<CircuitGeometry | null>(null);
  const signature = useRef("");
  const frame = useRef(0);
  const observer = useRef<ResizeObserver | null>(null);
  const observed = useRef<Element[]>([]);
  const revision = useRef(0);

  const recompute = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const host = hostRef.current;
      if (!host) return;
      const { elements, width, height, obstacles } = measure(host);

      const sameElements =
        elements.length === observed.current.length &&
        elements.every((element, index) => element === observed.current[index]);
      if (!sameElements && observer.current) {
        observer.current.disconnect();
        observer.current.observe(host);
        elements.forEach((element) => observer.current?.observe(element));
        observed.current = elements;
      }

      const next = JSON.stringify([width, height, obstacles]);
      if (next === signature.current || width === 0 || height === 0) return;
      signature.current = next;
      revision.current += 1;
      setGeometry({ ...buildCircuit(width, height, obstacles), revision: revision.current });
    });
  }, [hostRef]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    observer.current = new ResizeObserver(recompute);
    observer.current.observe(host);
    window.addEventListener("resize", recompute);
    window.addEventListener(CIRCUIT_LAYOUT_EVENT, recompute);
    document.fonts?.ready.then(recompute);
    recompute();
    return () => {
      cancelAnimationFrame(frame.current);
      observer.current?.disconnect();
      observer.current = null;
      observed.current = [];
      window.removeEventListener("resize", recompute);
      window.removeEventListener(CIRCUIT_LAYOUT_EVENT, recompute);
    };
  }, [hostRef, recompute]);

  return { geometry, recompute };
}

/* Ambient PCB texture, drawn at a fixed scale so it never stretches. */
function TexturePattern() {
  return (
    <pattern id="l-pcb-texture" width="216" height="216" patternUnits="userSpaceOnUse">
      <g className="l-texture-traces">
        <path d="M0 18 H52 L70 36 H128 L146 18 H216" />
        <path d="M0 92 H34 L52 110 H104" />
        <path d="M216 74 H170 L152 92 H124 L106 74" />
        <path d="M24 216 V178 L42 160 H88 L106 142 V122" />
        <path d="M150 216 V196 L168 178 H216" />
        <path d="M188 0 V40 L170 58 H144" />
        <path d="M66 0 V8" />
        <path d="M0 148 H18 L36 130" />
        <path d="M120 136 H160 L178 154 V170" />
      </g>
      <g className="l-texture-pads">
        <rect x="76" y="44" width="22" height="9" rx="2" />
        <rect x="160" y="120" width="9" height="22" rx="2" />
        <rect x="30" y="56" width="14" height="6" rx="1.5" />
        <rect x="30" y="66" width="14" height="6" rx="1.5" />
        <rect x="118" y="182" width="26" height="14" rx="2.5" />
      </g>
      <g className="l-texture-vias">
        <circle cx="52" cy="18" r="2.6" />
        <circle cx="146" cy="18" r="2.6" />
        <circle cx="104" cy="110" r="2.6" />
        <circle cx="106" cy="74" r="2.6" />
        <circle cx="106" cy="122" r="2.6" />
        <circle cx="144" cy="58" r="2.6" />
        <circle cx="36" cy="130" r="2.6" />
        <circle cx="178" cy="170" r="2.6" />
        <circle cx="66" cy="8" r="2.6" />
      </g>
    </pattern>
  );
}

export default function DashboardCircuit() {
  const hostRef = useRef<HTMLDivElement>(null);
  const { geometry } = useCircuitGeometry(hostRef);

  return (
    <div className="dashboard-circuit-bg" ref={hostRef} aria-hidden="true">
      {geometry && (
        <>
          <svg
            className="dashboard-circuit-static"
            width={geometry.width}
            height={geometry.height}
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            focusable="false"
          >
            <defs>
              <TexturePattern />
            </defs>
            <rect className="l-texture" width={geometry.width} height={geometry.height} fill="url(#l-pcb-texture)" />
            <g key={geometry.revision} className={geometry.revision && geometry.revision > 1 ? "l-redraw" : undefined}>
            <g className="l-lanes">
              {geometry.lanes.map((lane, index) => (
                <path
                  key={`${index}-${lane.axis}-${lane.at}`}
                  className={lane.center ? "is-center" : undefined}
                  d={lanePath(lane)}
                />
              ))}
            </g>
            <g className="l-pads">
              {geometry.pads.map(({ x, y }, index) => (
                <circle key={`${index}-${x}-${y}`} cx={x} cy={y} r="2.4" />
              ))}
            </g>
            <g className="l-vias">
              {geometry.vias.map(({ x, y }, index) => (
                <g key={`${index}-${x}-${y}`}>
                  <circle className="l-via-ring" cx={x} cy={y} r="4.2" />
                  <circle className="l-via-hole" cx={x} cy={y} r="1.4" />
                </g>
              ))}
            </g>
            </g>
          </svg>

          <svg
            className="dashboard-circuit-motion"
            width={geometry.width}
            height={geometry.height}
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            focusable="false"
          >
            <defs>
              {TONES.map((tone) => (
                <g key={tone}>
                  <linearGradient id={`l-tail-${tone}`} x1="0" x2="1">
                    <stop offset="0" className={`l-stop-${tone}`} stopOpacity="0" />
                    <stop offset="1" className={`l-stop-${tone}`} stopOpacity="0.55" />
                  </linearGradient>
                  <radialGradient id={`l-halo-${tone}`}>
                    <stop offset="0" className={`l-stop-${tone}`} stopOpacity="0.42" />
                    <stop offset="0.45" className={`l-stop-${tone}`} stopOpacity="0.12" />
                    <stop offset="1" className={`l-stop-${tone}`} stopOpacity="0" />
                  </radialGradient>
                </g>
              ))}
            </defs>

            <g className="l-nodes">
              {geometry.vias.filter((_, index) => index % 3 === 1).map(({ x, y, tone }, index) => (
                <circle
                  key={`${index}-${x}-${y}`}
                  className={`is-${tone}`}
                  cx={x}
                  cy={y}
                  r="7"
                  fill={`url(#l-halo-${tone})`}
                  style={{ "--l-node-order": index } as CSSProperties}
                />
              ))}
            </g>

            <g className="l-pulses">
              {geometry.pulses.map((pulse, index) => (
                <g
                  key={`${index}-${pulse.d}`}
                  className={`l-pulse is-${pulse.tone}${pulse.rare ? " is-rare" : ""}`}
                  style={{
                    offsetPath: `path("${pulse.d}")`,
                    animationDuration: `${pulse.duration.toFixed(2)}s`,
                    animationDelay: `${pulse.delay.toFixed(2)}s`,
                  }}
                >
                  <rect x="-24" y="-1" width="24" height="2" rx="1" fill={`url(#l-tail-${pulse.tone})`} />
                  <circle r="5.5" fill={`url(#l-halo-${pulse.tone})`} />
                  <circle className="l-pulse-core" r="1.9" />
                </g>
              ))}
            </g>
          </svg>
        </>
      )}
    </div>
  );
}
