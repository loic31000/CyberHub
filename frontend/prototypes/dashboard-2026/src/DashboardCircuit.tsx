import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";

/*
 * Phase 3A.2 (lot A): the dashboard sits on a motherboard.
 *
 * The board is generated on a fixed grid of zones that does not depend on the
 * panels: every zone holds a component (QFP, BGA, SOIC, connectors, a memory
 * slot, passives, via fields) and buses wire real pins of neighbouring
 * components together. Panels only matter twice: the zone under the globe
 * stays calm, and LED journeys only use traces that are visible end to end.
 * An LED travels chip to chip towards the main processor; the receiving chip
 * glows while the LED is inside, then the LED leaves through another pin.
 * A future widget layout therefore only has to call
 * `requestCircuitRecompute()` after moving or hiding a panel.
 *
 * Each layer is a single <path>, so the static board is a few dozen elements.
 */

export const CIRCUIT_LAYOUT_EVENT = "cyberhub:layout-change";

export function requestCircuitRecompute() {
  window.dispatchEvent(new Event(CIRCUIT_LAYOUT_EVENT));
}

const OBSTACLE_SELECTOR =
  ".dashboard-board .overview-hero, .dashboard-board .dashboard-panel, .dashboard-board .sync-panel, .dashboard-board .page-foot";

type Tone = "cyan" | "blue" | "white" | "amber";
// One LED per journey, so at most five travel at once; amber is occasional.
const JOURNEY_TONES: Tone[] = ["cyan", "blue", "cyan", "white", "amber"];
// The board plays in time: one beat, a 12-beat bar shared by every journey.
const BEAT = 0.9; // seconds
const BAR = 12; // beats
const SPEED = 80; // px per second, before snapping to the beat
const START_BEATS = [0, 2, 5, 8, 10]; // each journey enters on its own beat

type Rect = { x: number; y: number; w: number; h: number; globe?: boolean };
type Point = { x: number; y: number };
type Side = "l" | "r" | "t" | "b";
type Part = { id?: number; x: number; y: number; w: number; h: number; ports: Record<Side, Point[]>; used: Record<Side, number> };
type Route = { d: string; length: number; points: Point[] };
type Link = { route: Route; a: number; b: number };
type Box = { x: number; y: number; w: number; h: number };

/*
 * A journey: one LED leaves a chip, follows a visible trace, enters the next
 * chip (which glows), waits there, leaves through another pin, and so on,
 * moving towards the main processor. Times are in seconds within `period`.
 */
export type Journey = {
  tone: Tone;
  rare: boolean;
  period: number;
  delay: number;
  hops: (Route & { start: number; end: number })[];
  glows: (Box & { start: number; end: number })[];
};

/* The main processor beats on the strong beats of the bar, like a kick drum. */
export type Heartbeat = Box & { period: number; beats: number[] };

export type BoardLayer =
  | "backbone" | "trace" | "bus" | "shadow" | "body" | "die" | "heat" | "slot" | "pin"
  | "pad" | "cap" | "ball" | "via" | "hole" | "mark";

const LAYERS: BoardLayer[] = [
  "backbone", "trace", "bus", "shadow", "body", "die", "heat", "slot", "pin", "pad", "cap", "ball", "via", "hole", "mark",
];

export type CircuitGeometry = {
  width: number;
  height: number;
  obstacles: Rect[];
  layers: Record<BoardLayer, string>;
  journeys: Journey[];
  heartbeat: Heartbeat | null;
  boardKey: string; // changes only when the static drawing changes
  revision?: number;
};

/* ---------- small helpers ---------- */

function random(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const rectPath = (x: number, y: number, w: number, h: number) => `M${r1(x)} ${r1(y)}h${r1(w)}v${r1(h)}h${r1(-w)}Z`;
function roundRectPath(x: number, y: number, w: number, h: number, r: number) {
  return `M${r1(x + r)} ${r1(y)}H${r1(x + w - r)}Q${r1(x + w)} ${r1(y)} ${r1(x + w)} ${r1(y + r)}V${r1(y + h - r)}Q${r1(x + w)} ${r1(y + h)} ${r1(x + w - r)} ${r1(y + h)}H${r1(x + r)}Q${r1(x)} ${r1(y + h)} ${r1(x)} ${r1(y + h - r)}V${r1(y + r)}Q${r1(x)} ${r1(y)} ${r1(x + r)} ${r1(y)}Z`;
}
const circlePath = (x: number, y: number, r: number) =>
  `M${r1(x - r)} ${r1(y)}a${r1(r)} ${r1(r)} 0 1 0 ${r1(2 * r)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(-2 * r)} 0`;

function polyline(points: Point[]): Route {
  let length = 0;
  for (let i = 1; i < points.length; i += 1) length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  const d = points.map((p, i) => `${i ? "L" : "M"}${r1(p.x)} ${r1(p.y)}`).join("");
  return { d, length, points };
}

/* Orthogonal run with one 45° jog between two ports facing each other. */
function jogRoute(a: Point, b: Point, axis: "h" | "v"): Route | null {
  const along = axis === "h" ? b.x - a.x : b.y - a.y;
  const across = axis === "h" ? b.y - a.y : b.x - a.x;
  if (along < 12 || Math.abs(across) > along - 12) return null;
  const start = (along - Math.abs(across)) / 2;
  const pts =
    axis === "h"
      ? [a, { x: a.x + start, y: a.y }, { x: a.x + start + Math.abs(across), y: b.y }, b]
      : [a, { x: a.x, y: a.y + start }, { x: b.x, y: a.y + start + Math.abs(across) }, b];
  return polyline(pts);
}

/* Right-then-down cable with a 45° elbow, for chips sitting diagonally. */
function elbowRoute(a: Point, b: Point): Route | null {
  const c = 14;
  if (b.x - a.x < c + 12 || b.y - a.y < c + 12) return null;
  return polyline([a, { x: b.x - c, y: a.y }, { x: b.x, y: a.y + c }, b]);
}

/* ---------- board generator ---------- */

type Builder = { layers: Record<BoardLayer, string[]>; add: (layer: BoardLayer, d: string) => void };

function builder(): Builder {
  const layers = Object.fromEntries(LAYERS.map((l) => [l, [] as string[]])) as Record<BoardLayer, string[]>;
  return { layers, add: (layer, d) => layers[layer].push(d) };
}

function emptyPart(x: number, y: number, w: number, h: number): Part {
  return { x, y, w, h, ports: { l: [], r: [], t: [], b: [] }, used: { l: 0, r: 0, t: 0, b: 0 } };
}

function via(b: Builder, x: number, y: number, r = 2.6) {
  b.add("via", circlePath(x, y, r));
  b.add("hole", circlePath(x, y, r * 0.42));
}

/* Quad flat package: body, die, pins on four sides, pin-one mark. */
function qfp(b: Builder, cx: number, cy: number, size: number, pins: number, core = false) {
  const x = cx - size / 2;
  const y = cy - size / 2;
  const part = emptyPart(x, y, size, size);
  const pitch = Math.min(6, (size - 12) / (pins - 1));
  const pinLen = core ? 8 : 6;
  b.add("shadow", roundRectPath(x + 3, y + 4, size, size, 4));
  b.add("body", roundRectPath(x, y, size, size, core ? 7 : 4));
  const inset = size * (core ? 0.16 : 0.24);
  b.add("die", roundRectPath(x + inset, y + inset, size - 2 * inset, size - 2 * inset, core ? 5 : 2));
  if (core) {
    for (let i = 1; i <= 3; i += 1) {
      const s = inset + i * (size * 0.07);
      b.add("heat", roundRectPath(x + s, y + s, size - 2 * s, size - 2 * s, 3));
    }
  }
  b.add("mark", circlePath(x + 6, y + 6, 1.6));
  for (let i = 0; i < pins; i += 1) {
    const o = (i - (pins - 1) / 2) * pitch;
    b.add("pin", rectPath(x - pinLen, cy + o - 1, pinLen, 2));
    b.add("pin", rectPath(x + size, cy + o - 1, pinLen, 2));
    b.add("pin", rectPath(cx + o - 1, y - pinLen, 2, pinLen));
    b.add("pin", rectPath(cx + o - 1, y + size, 2, pinLen));
    part.ports.l.push({ x: x - pinLen, y: cy + o });
    part.ports.r.push({ x: x + size + pinLen, y: cy + o });
    part.ports.t.push({ x: cx + o, y: y - pinLen });
    part.ports.b.push({ x: cx + o, y: y + size + pinLen });
  }
  return part;
}

/* Ball grid array: escape routing leaves from the body edges. */
function bga(b: Builder, cx: number, cy: number, size: number, n: number) {
  const x = cx - size / 2;
  const y = cy - size / 2;
  const part = emptyPart(x, y, size, size);
  b.add("shadow", roundRectPath(x + 3, y + 4, size, size, 3));
  b.add("body", roundRectPath(x, y, size, size, 3));
  const step = (size - 10) / (n - 1);
  for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) b.add("ball", circlePath(x + 5 + i * step, y + 5 + j * step, 1.5));
  for (let i = 1; i < n - 1; i += 1) {
    const o = 5 + i * step;
    part.ports.l.push({ x, y: y + o });
    part.ports.r.push({ x: x + size, y: y + o });
    part.ports.t.push({ x: x + o, y });
    part.ports.b.push({ x: x + o, y: y + size });
  }
  return part;
}

/* Small outline IC: pins on the long sides only. */
function soic(b: Builder, cx: number, cy: number, w: number, pins: number) {
  const h = 18;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const part = emptyPart(x, y, w, h);
  b.add("shadow", roundRectPath(x + 2, y + 3, w, h, 2));
  b.add("body", roundRectPath(x, y, w, h, 2));
  b.add("mark", circlePath(x + 4, y + 4, 1.2));
  const pitch = (w - 8) / (pins - 1);
  for (let i = 0; i < pins; i += 1) {
    const px = x + 4 + i * pitch;
    b.add("pin", rectPath(px - 1, y - 5, 2, 5));
    b.add("pin", rectPath(px - 1, y + h, 2, 5));
    part.ports.t.push({ x: px, y: y - 5 });
    part.ports.b.push({ x: px, y: y + h + 5 });
  }
  part.ports.l.push({ x, y: cy });
  part.ports.r.push({ x: x + w, y: cy });
  return part;
}

/* Pin header: a row of square pads on a body strip. */
function header(b: Builder, cx: number, cy: number, count: number, vertical: boolean) {
  const len = count * 7 + 4;
  const w = vertical ? 12 : len;
  const h = vertical ? len : 12;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const part = emptyPart(x, y, w, h);
  b.add("body", roundRectPath(x, y, w, h, 2));
  for (let i = 0; i < count; i += 1) {
    const p = 5.5 + i * 7;
    if (vertical) {
      b.add("pad", rectPath(x + 4, y + p - 2, 4, 4));
      part.ports.l.push({ x, y: y + p });
      part.ports.r.push({ x: x + w, y: y + p });
    } else {
      b.add("pad", rectPath(x + p - 2, y + 4, 4, 4));
      part.ports.t.push({ x: x + p, y });
      part.ports.b.push({ x: x + p, y: y + h });
    }
  }
  return part;
}

/* Memory-like slot: long socket, contact fingers and a key notch. */
function slot(b: Builder, cx: number, cy: number, w: number) {
  const h = 11;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const part = emptyPart(x, y, w, h);
  b.add("slot", roundRectPath(x, y, w, h, 2));
  const notch = x + w * 0.38;
  for (let px = x + 6; px < x + w - 6; px += 4) {
    if (Math.abs(px - notch) < 4) continue;
    b.add("pin", rectPath(px, y + 3, 1.4, h - 6));
  }
  b.add("mark", rectPath(notch - 1.5, y - 1, 3, h + 2));
  for (let px = x + 12; px < x + w - 10; px += 14) part.ports.b.push({ x: px, y: y + h });
  part.ports.l.push({ x, y: cy });
  part.ports.r.push({ x: x + w, y: cy });
  return part;
}

/* Surface-mount passive (capacitor or resistor) with two copper pads. */
function smd(b: Builder, cx: number, cy: number, vertical: boolean, long = 9) {
  const w = vertical ? 5 : long;
  const h = vertical ? long : 5;
  b.add("cap", rectPath(cx - w / 2, cy - h / 2, w, h));
  if (vertical) {
    b.add("pad", rectPath(cx - w / 2, cy - h / 2, w, 2.4));
    b.add("pad", rectPath(cx - w / 2, cy + h / 2 - 2.4, w, 2.4));
  } else {
    b.add("pad", rectPath(cx - w / 2, cy - h / 2, 2.4, h));
    b.add("pad", rectPath(cx + w / 2 - 2.4, cy - h / 2, 2.4, h));
  }
}

function electrolytic(b: Builder, cx: number, cy: number, r: number) {
  b.add("shadow", circlePath(cx + 2, cy + 3, r));
  b.add("body", circlePath(cx, cy, r));
  b.add("die", circlePath(cx, cy, r * 0.62));
  b.add("mark", `M${r1(cx - r * 0.72)} ${r1(cy - r * 0.55)}A${r1(r * 0.9)} ${r1(r * 0.9)} 0 0 1 ${r1(cx + r * 0.72)} ${r1(cy - r * 0.55)}`);
}

function crystal(b: Builder, cx: number, cy: number) {
  b.add("body", roundRectPath(cx - 11, cy - 4.5, 22, 9, 4.5));
  b.add("pad", rectPath(cx - 14, cy - 2, 3, 4));
  b.add("pad", rectPath(cx + 11, cy - 2, 3, 4));
}

/* Decoupling passives above a component, wired to its last top pins. */
function satellites(b: Builder, part: Part, rnd: () => number) {
  const ports = part.ports.t;
  if (ports.length < 3) return;
  const count = Math.min(Math.floor(ports.length / 2), 2 + Math.floor(rnd() * 3));
  for (let i = 0; i < count; i += 1) {
    const port = ports[ports.length - 1 - i * 2];
    if (!port) break;
    const capY = port.y - 15;
    b.add("trace", `M${r1(port.x)} ${r1(port.y)}V${r1(capY + 4.5)}`);
    smd(b, port.x, capY, true);
    via(b, port.x, capY - 9, 2);
  }
}

function takePorts(part: Part, side: Side, count: number) {
  const ports = part.ports[side];
  const start = part.used[side];
  // Bus ports come from the first half of the top side; satellites use its end.
  const limit = side === "t" ? Math.floor(ports.length / 2) : ports.length;
  const picked = ports.slice(start, Math.min(start + count, limit));
  part.used[side] = start + picked.length;
  return picked;
}

type Zone = { part: Part | null };

function wireBus(b: Builder, links: Link[], from: Point[], to: Point[], axis: "h" | "v", a: Part, z: Part) {
  const middle = Math.floor((from.length - 1) / 2);
  from.forEach((port, i) => {
    const target = to[i];
    if (!target) return;
    const route = jogRoute(port, target, axis);
    if (!route) return;
    b.add(i === middle ? "bus" : "trace", route.d);
    if (i === middle && a.id !== undefined && z.id !== undefined) links.push({ route, a: a.id, b: z.id });
  });
}

/*
 * `obstacles` is what actually hides the board (a collapsed panel only through
 * its header); `slots` are the full panel footprints, used for the lower layer.
 */
export function buildBoard(width: number, height: number, obstacles: Rect[], slots: Rect[] = obstacles): Omit<CircuitGeometry, "revision"> {
  const compact = width < 760;
  const S = compact ? 150 : 172;
  const k = S / 196;
  const cols = Math.max(1, Math.ceil(width / S));
  const rows = Math.max(1, Math.ceil(height / S));
  const ox = (width - cols * S) / 2;
  const oy = (height - rows * S) / 2;
  const b = builder();
  const globe = obstacles.find((o) => o.globe);
  const coreCell = compact ? null : { c: Math.round(0.82 * (cols - 1)), r: Math.round(0.5 * (rows - 1)) };
  const links: Link[] = [];
  const parts: Part[] = [];
  // Data flows towards the main processor (or the board centre on mobile).
  let hub: Point = { x: width / 2, y: height / 2 };
  let hubBox: Box | null = null;

  // Power buses on a lower layer, along zone boundaries (never through a part),
  // cut into segments that start and end on pads instead of one endless rail.
  for (const fraction of compact ? [0.5] : [0.34, 0.72]) {
    const y = oy + Math.round(fraction * rows) * S;
    const seed = random(Math.round(fraction * 1000) + cols);
    let c = Math.floor(seed() * 2);
    while (c < cols) {
      const span = 2 + Math.floor(seed() * 2);
      const x1 = ox + c * S + 22;
      const x2 = ox + Math.min(cols, c + span) * S - 22;
      const run = polyline([{ x: x1, y }, { x: x2, y }]);
      // A lower layer: shown where panels can reveal it, never as a rail along a gutter.
      if (x2 - x1 > S && visibleShare(run, slots) < 0.5) {
        for (const offset of [-3, 3]) b.add("backbone", `M${r1(x1)} ${r1(y + offset)}H${r1(x2)}`);
        b.add("pad", rectPath(x1 - 8, y - 6, 8, 12));
        b.add("pad", rectPath(x2, y - 6, 8, 12));
      }
      c += span + 1;
    }
  }

  const zones: Zone[][] = [];
  for (let r = 0; r < rows; r += 1) {
    zones.push([]);
    for (let c = 0; c < cols; c += 1) {
      const rnd = random(((c + 1) * 73856093) ^ ((r + 1) * 19349663) ^ (compact ? 7 : 3));
      const x0 = ox + c * S;
      const y0 = oy + r * S;
      const cx = x0 + S / 2 + (rnd() - 0.5) * 24 * k;
      const cy = y0 + S / 2 + (rnd() - 0.5) * 24 * k;
      const underGlobe = !!globe && cx > globe.x && cx < globe.x + globe.w && cy > globe.y && cy < globe.y + globe.h;
      let part: Part | null = null;
      const pick = rnd();
      if (coreCell && c === coreCell.c && r === coreCell.r && !underGlobe) {
        // The board's main processor, with its decoupling and a row of resistors.
        part = qfp(b, x0 + S / 2, y0 + S / 2, 104, 12, true);
        hub = { x: x0 + S / 2, y: y0 + S / 2 };
        hubBox = { x: part.x - 4, y: part.y - 4, w: part.w + 8, h: part.h + 8 };
        satellites(b, part, rnd);
        for (let i = 0; i < 4; i += 1) smd(b, part.x + part.w + 22, part.y + 14 + i * 22, false);
      } else if (underGlobe) {
        // Calm zone under the globe: a few quiet traces and vias.
        b.add("trace", `M${r1(x0 + 20)} ${r1(cy)}H${r1(x0 + S * 0.55)}L${r1(x0 + S * 0.55 + 14)} ${r1(cy + 14)}H${r1(x0 + S - 20)}`);
        via(b, x0 + 20, cy);
        via(b, x0 + S - 20, cy + 14);
      } else if (pick < 0.24) {
        part = qfp(b, cx, cy, (50 + rnd() * 16) * k, 7 + Math.floor(rnd() * 3));
        satellites(b, part, rnd);
      } else if (pick < 0.38) {
        part = bga(b, cx, cy, (40 + rnd() * 10) * k, 6);
        satellites(b, part, rnd);
      } else if (pick < 0.55) {
        part = soic(b, cx, cy - 12 * k, 44 * k, 6);
        satellites(b, part, rnd);
        soic(b, cx, cy + 22 * k, 34 * k, 4);
        crystal(b, cx + 46 * k, cy + 22 * k);
      } else if (pick < 0.65) {
        part = header(b, cx, cy, compact ? 6 : 8, rnd() < 0.5);
      } else if (pick < 0.71 && !compact) {
        part = slot(b, cx, cy, 150);
        for (let i = 0; i < 5; i += 1) smd(b, cx - 56 + i * 28, cy - 24, false);
      } else if (pick < 0.86) {
        // Passive cluster: decoupling row, an electrolytic capacitor and a crystal.
        for (let i = 0; i < 4; i += 1) smd(b, cx - 30 + i * 12, cy - 10, true);
        electrolytic(b, cx + 30, cy + 14, 11 * k + 3);
        part = emptyPart(cx - 34, cy - 18, 80, 44);
        part.ports.l.push({ x: cx - 34, y: cy + 8 });
        part.ports.r.push({ x: cx + 46, y: cy + 8 });
        b.add("trace", `M${r1(cx - 34)} ${r1(cy + 8)}H${r1(cx + 18)}`);
        crystal(b, cx - 12, cy + 22);
      } else if (pick < 0.93) {
        for (let i = 0; i < 4; i += 1) for (let j = 0; j < 3; j += 1) via(b, cx - 18 + i * 12, cy - 12 + j * 12, 2.2);
      } else {
        b.add("trace", `M${r1(x0 + 24)} ${r1(cy)}H${r1(x0 + S - 24)}`);
        via(b, x0 + 24, cy);
        via(b, x0 + S - 24, cy);
      }
      if (part) {
        part.id = parts.length;
        parts.push(part);
      }
      zones[r].push({ part });
    }
  }

  // Buses between neighbouring components: right neighbour, then the one below.
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const zone = zones[r][c];
      if (!zone.part) continue;
      const rnd = random(((c + 11) * 2654435761) ^ ((r + 5) * 40503));
      // Right neighbour, or the next chip along the row when a zone holds no chip.
      const right = zones[r][c + 1]?.part ?? (zones[r][c + 1] && zones[r][c + 2]?.part) ?? null;
      if (right && rnd() < 0.95) {
        const from = takePorts(zone.part, "r", 2 + Math.floor(rnd() * 3));
        wireBus(b, links, from, takePorts(right, "l", from.length), "h", zone.part, right);
      }
      const below = zones[r + 1]?.[c]?.part ?? (zones[r + 1]?.[c] && zones[r + 2]?.[c]?.part) ?? null;
      if (below && rnd() < 0.85) {
        const from = takePorts(zone.part, "b", 2 + Math.floor(rnd() * 3));
        wireBus(b, links, from, takePorts(below, "t", from.length), "v", zone.part, below);
      }
      // Diagonal neighbour: an elbow cable from a right pin down to a top pin.
      const diagonal = zones[r + 1]?.[c + 1]?.part;
      if (diagonal && rnd() < 0.45) {
        const [a] = takePorts(zone.part, "r", 1);
        const [z] = takePorts(diagonal, "t", 1);
        const route = a && z ? elbowRoute(a, z) : null;
        if (route) {
          b.add("bus", route.d);
          if (zone.part.id !== undefined && diagonal.id !== undefined) links.push({ route, a: zone.part.id, b: diagonal.id });
        }
      }
      // A few unwired pins get a short escape stub ending on a via.
      for (const side of ["l", "r", "b"] as Side[]) {
        zone.part.ports[side]
          .slice(zone.part.used[side])
          .filter((_, i) => i % 3 === 1)
          .slice(0, 2)
          .forEach((p) => {
            const dx = side === "l" ? -12 : side === "r" ? 12 : 0;
            const dy = side === "b" ? 12 : 0;
            b.add("trace", `M${r1(p.x)} ${r1(p.y)}l${dx} ${dy}`);
            via(b, p.x + dx, p.y + dy, 2);
          });
      }
    }
  }

  const journeys = planJourneys(links, parts, obstacles, compact, hub);
  const layers = Object.fromEntries(LAYERS.map((l) => [l, b.layers[l].join("")])) as Record<BoardLayer, string>;
  // FNV-1a over the drawing: journeys may change (a panel collapses) without redrawing the board.
  let hash = 0x811c9dc5;
  for (const layer of LAYERS) {
    const d = layers[layer];
    for (let i = 0; i < d.length; i += 1) hash = Math.imul(hash ^ d.charCodeAt(i), 0x01000193);
  }
  const heartbeat =
    hubBox && !isHidden({ x: hubBox.x + hubBox.w / 2, y: hubBox.y + hubBox.h / 2 }, obstacles)
      ? { ...hubBox, period: BAR * BEAT, beats: [0, 6] }
      : null;
  return { width, height, obstacles, layers, journeys, heartbeat, boardKey: `${width}x${height}-${(hash >>> 0).toString(36)}` };
}

/* Share of a route that is not hidden behind a panel. */
function visibleShare(route: Route, obstacles: Rect[]) {
  let visible = 0;
  let total = 0;
  for (let i = 1; i < route.points.length; i += 1) {
    const a = route.points[i - 1];
    const p = route.points[i];
    const steps = Math.max(1, Math.round(Math.hypot(p.x - a.x, p.y - a.y) / 8));
    for (let s = 0; s < steps; s += 1) {
      const x = a.x + ((p.x - a.x) * (s + 0.5)) / steps;
      const y = a.y + ((p.y - a.y) * (s + 0.5)) / steps;
      total += 1;
      if (!obstacles.some((o) => x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h)) visible += 1;
    }
  }
  return total ? visible / total : 0;
}

const isHidden = (p: Point, obstacles: Rect[]) => obstacles.some((o) => p.x > o.x && p.x < o.x + o.w && p.y > o.y && p.y < o.y + o.h);

function reversed(route: Route): Route {
  return polyline([...route.points].reverse());
}

/*
 * Journeys only use traces that can be followed from end to end: 90% of the
 * run and both pins visible, away from the globe. Each journey starts far from
 * the hub and hops chip to chip towards it (up to three hops), never reusing a
 * trace another journey already uses.
 */
function planJourneys(links: Link[], parts: Part[], obstacles: Rect[], compact: boolean, hub: Point): Journey[] {
  const globe = obstacles.find((o) => o.globe);
  const nearGlobe = (r: Route) => {
    if (!globe) return false;
    const p = r.points[Math.floor(r.points.length / 2)];
    return p.x > globe.x - 60 && p.x < globe.x + globe.w + 60 && p.y > globe.y - 60 && p.y < globe.y + globe.h + 60;
  };
  const usable = links.filter(
    ({ route }) =>
      route.length >= 40 &&
      !nearGlobe(route) &&
      !isHidden(route.points[0], obstacles) &&
      !isHidden(route.points[route.points.length - 1], obstacles) &&
      visibleShare(route, obstacles) >= 0.9,
  );
  const adjacency = new Map<number, { to: number; route: Route }[]>();
  const connect = (from: number, to: number, route: Route) => {
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from)?.push({ to, route });
  };
  for (const { route, a, b } of usable) {
    connect(a, b, route);
    connect(b, a, reversed(route));
  }
  const centreOf = (id: number) => ({ x: parts[id].x + parts[id].w / 2, y: parts[id].y + parts[id].h / 2 });
  const toHub = (id: number) => Math.hypot(centreOf(id).x - hub.x, centreOf(id).y - hub.y);
  const used = new Set<string>();
  const edge = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const starts: Point[] = [];
  const journeys: Journey[] = [];
  const max = compact ? 3 : JOURNEY_TONES.length;

  for (const start of [...adjacency.keys()].sort((a, b) => toHub(b) - toHub(a))) {
    if (journeys.length >= max) break;
    const origin = centreOf(start);
    if (starts.some((p) => Math.hypot(p.x - origin.x, p.y - origin.y) < 150)) continue;
    const visited = new Set([start]);
    const path: { to: number; route: Route }[] = [];
    let current = start;
    while (path.length < 4) {
      const here = current;
      const next = (adjacency.get(here) ?? [])
        .filter((e) => !visited.has(e.to) && !used.has(edge(here, e.to)))
        .sort((a, b) => toHub(a.to) - toHub(b.to))[0];
      if (!next) break;
      path.push(next);
      used.add(edge(here, next.to));
      visited.add(next.to);
      current = next.to;
    }
    if (!path.length) continue;

    const index = journeys.length;
    const tone = JOURNEY_TONES[index];
    const rare = tone === "amber";
    // Every move snaps to the beat: travel, a one-beat stop inside each chip,
    // and a one-beat glow at the end, all within the shared 12-beat bar.
    let beat = 0;
    const hops: Journey["hops"] = [];
    const glows: Journey["glows"] = [];
    for (const [i, { to, route }] of path.entries()) {
      const travel = Math.max(1, Math.round(route.length / SPEED / BEAT));
      if (beat + travel + 1 > BAR - 1) break;
      hops.push({ ...route, start: beat * BEAT, end: (beat + travel) * BEAT });
      beat += travel;
      const chip = parts[to];
      const last = i === path.length - 1;
      glows.push({ x: chip.x - 4, y: chip.y - 4, w: chip.w + 8, h: chip.h + 8, start: beat * BEAT, end: (beat + 1) * BEAT });
      if (!last) beat += 1;
    }
    if (!hops.length) continue;
    starts.push(origin);
    // Times start at 0; a negative delay puts each journey on its entry beat.
    const period = BAR * BEAT * (rare ? 2 : 1); // amber plays every other bar
    journeys.push({ tone, rare, period, delay: START_BEATS[index] * BEAT - period, hops, glows });
  }
  return journeys;
}

/* ---------- measurement ---------- */

function measure(host: HTMLElement) {
  const box = host.getBoundingClientRect();
  const elements = [...(host.parentElement?.querySelectorAll<HTMLElement>(OBSTACLE_SELECTOR) ?? [])];
  const toRect = (rect: DOMRect, globe: boolean): Rect => ({
    x: Math.round(rect.left - box.left),
    y: Math.round(rect.top - box.top),
    w: Math.round(rect.width),
    h: Math.round(rect.height),
    ...(globe ? { globe: true } : {}),
  });
  const shown = elements.filter((element) => element.getBoundingClientRect().height > 0);
  // A collapsed panel keeps its slot but only its header card hides the board.
  const obstacles = shown.map((element) => {
    const visible = element.classList.contains("is-collapsed") ? element.querySelector(".panel-heading") ?? element : element;
    return toRect(visible.getBoundingClientRect(), element.classList.contains("network-panel"));
  });
  const slots = shown.map((element) => toRect(element.getBoundingClientRect(), element.classList.contains("network-panel")));
  return { elements, width: Math.round(box.width), height: Math.round(box.height), obstacles, slots };
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
  const drawings = useRef(0);
  const lastBoard = useRef("");

  const recompute = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const host = hostRef.current;
      if (!host) return;
      const { elements, width, height, obstacles, slots } = measure(host);

      const sameElements =
        elements.length === observed.current.length &&
        elements.every((element, index) => element === observed.current[index]);
      if (!sameElements && observer.current) {
        observer.current.disconnect();
        observer.current.observe(host);
        elements.forEach((element) => observer.current?.observe(element));
        observed.current = elements;
      }

      const next = JSON.stringify([width, height, obstacles, slots]);
      if (next === signature.current || width === 0 || height === 0) return;
      signature.current = next;
      const board = buildBoard(width, height, obstacles, slots);
      if (board.boardKey !== lastBoard.current) {
        lastBoard.current = board.boardKey;
        drawings.current += 1;
      }
      revision.current = drawings.current;
      setGeometry({ ...board, revision: revision.current });
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

/* ---------- rendering ---------- */

const TAILS = [
  { px: 14, cls: "is-near" },
  { px: 30, cls: "is-far" },
];

const pct = (t: number, period: number) => Math.min(100, Math.max(0, (t / period) * 100));
const fx = (v: number) => v.toFixed(3);

/*
 * One set of keyframes per journey, generated once per geometry: the LED is
 * only visible while it travels a hop, the tails follow it along the trace
 * (corners included), and the receiving chip glows while the LED is inside.
 */
function journeyKeyframes(journeys: Journey[]) {
  let css = "";
  journeys.forEach((j, ji) => {
    j.hops.forEach((h, hi) => {
      const a = pct(h.start, j.period);
      const z = pct(h.end, j.period);
      const e = Math.min(0.8, (z - a) / 5);
      css += `@keyframes cbd${ji}-${hi}{0%,${fx(a)}%{offset-distance:0%;opacity:0}${fx(a + e)}%{opacity:1}${fx(z - e)}%{opacity:1}${fx(z)}%,100%{offset-distance:100%;opacity:0}}`;
      TAILS.forEach(({ px }, ti) => {
        const f = Math.min(0.5, px / h.length);
        css += `@keyframes cbt${ji}-${hi}-${ti}{0%,${fx(a)}%{stroke-dashoffset:${fx(f)};opacity:0}${fx(a + e)}%{opacity:1}${fx(z - e)}%{opacity:1}${fx(z)}%,100%{stroke-dashoffset:${fx(f - 1)};opacity:0}}`;
      });
    });
    j.glows.forEach((g, gi) => {
      const a = pct(g.start, j.period);
      const z = pct(g.end, j.period);
      const rise = Math.min(100, a + pct(0.22, j.period));
      const fall = Math.min(100, Math.max(rise, z) + pct(0.7, j.period));
      css += `@keyframes cbg${ji}-${gi}{0%,${fx(Math.max(0, a - 0.01))}%{opacity:0}${fx(rise)}%{opacity:1}${fx(Math.max(rise, Math.min(100, z)))}%{opacity:1}${fx(fall)}%,100%{opacity:0}}`;
    });
  });
  return css;
}

/* Short glow on the strong beats of the bar. */
function heartbeatKeyframes(h: Heartbeat | null) {
  if (!h) return "";
  const steps = h.beats
    .map((beat) => {
      const a = pct(beat * BEAT, h.period);
      return `${fx(a)}%{opacity:0.9}${fx(Math.min(100, a + pct(0.55, h.period)))}%{opacity:0}`;
    })
    .join("");
  return `@keyframes cbhub{0%{opacity:0}${steps}100%{opacity:0}}`;
}

const animation = (name: string, j: Journey) => `${name} ${j.period.toFixed(2)}s linear ${j.delay.toFixed(2)}s infinite`;

export default function DashboardCircuit() {
  const hostRef = useRef<HTMLDivElement>(null);
  const { geometry } = useCircuitGeometry(hostRef);
  const keyframes = useMemo(
    () => (geometry ? journeyKeyframes(geometry.journeys) + heartbeatKeyframes(geometry.heartbeat) : ""),
    [geometry],
  );

  return (
    <div className="dashboard-circuit-bg" ref={hostRef} aria-hidden="true">
      {geometry && (
        <>
          <svg
            className="dashboard-circuit-static board-layer"
            width={geometry.width}
            height={geometry.height}
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            focusable="false"
          >
            <g key={geometry.revision} className={geometry.revision && geometry.revision > 1 ? "l-redraw" : undefined}>
              {LAYERS.map((layer) =>
                geometry.layers[layer] ? <path key={layer} className={`b-${layer}`} d={geometry.layers[layer]} /> : null,
              )}
            </g>
          </svg>

          <svg
            className="dashboard-circuit-motion"
            width={geometry.width}
            height={geometry.height}
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            focusable="false"
          >
            <style>{keyframes}</style>
            <g className="b-journeys">
              {geometry.heartbeat && (
                <g className="b-journey is-cyan">
                  <g className="b-glow is-heart" style={{ animation: `cbhub ${geometry.heartbeat.period.toFixed(2)}s linear infinite` }}>
                    <rect className="b-glow-halo" x={geometry.heartbeat.x - 5} y={geometry.heartbeat.y - 5} width={geometry.heartbeat.w + 10} height={geometry.heartbeat.h + 10} rx="12" />
                    <rect className="b-glow-edge" x={geometry.heartbeat.x} y={geometry.heartbeat.y} width={geometry.heartbeat.w} height={geometry.heartbeat.h} rx="9" />
                  </g>
                </g>
              )}
              {geometry.journeys.map((j, ji) => (
                <g key={ji} className={`b-journey is-${j.tone}`}>
                  {j.glows.map((g, gi) => (
                    <g key={`g${gi}`} className="b-glow" style={{ animation: animation(`cbg${ji}-${gi}`, j) }}>
                      <rect className="b-glow-halo" x={g.x - 5} y={g.y - 5} width={g.w + 10} height={g.h + 10} rx="9" />
                      <rect className="b-glow-edge" x={g.x} y={g.y} width={g.w} height={g.h} rx="6" />
                    </g>
                  ))}
                  {j.hops.map((h, hi) => (
                    <g key={`h${hi}`}>
                      {TAILS.map(({ px, cls }, ti) => (
                        <path
                          key={cls}
                          className={`b-tail ${cls}`}
                          d={h.d}
                          pathLength={1}
                          style={{
                            strokeDasharray: `${fx(Math.min(0.5, px / h.length))} 2`,
                            animation: animation(`cbt${ji}-${hi}-${ti}`, j),
                          }}
                        />
                      ))}
                      <g className="b-led" style={{ offsetPath: `path("${h.d}")`, animation: animation(`cbd${ji}-${hi}`, j) } as CSSProperties}>
                        <circle className="b-led-soft" r="3" />
                        <circle className="b-led-core" r="1.7" />
                      </g>
                    </g>
                  ))}
                </g>
              ))}
            </g>
          </svg>
        </>
      )}
    </div>
  );
}
