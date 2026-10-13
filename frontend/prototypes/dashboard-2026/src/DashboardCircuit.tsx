import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { createPortal } from "react-dom";

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
 *
 * On desktop the hero joins the board: its CH processor sits on a small board
 * drawn with the same primitives and feeds a link connector astride the
 * hero's lower edge. The connector sits on board traces that already run up
 * under the hero, and the board's journeys start from CH through it.
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

type Rect = { x: number; y: number; w: number; h: number; globe?: boolean; role?: "hero" | "env" | "widget" | "foot" };
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
  glows: (Box & { start: number; end: number; over?: boolean })[];
};

/* The main processor beats on the strong beats of the bar, like a kick drum. */
export type Heartbeat = Box & { period: number; beats: number[] };

export type BoardLayer =
  | "backbone" | "trace" | "bus" | "shadow" | "body" | "die" | "heat" | "slot" | "pin"
  | "pad" | "cap" | "ball" | "via" | "hole" | "mark";

const LAYERS: BoardLayer[] = [
  "backbone", "trace", "bus", "shadow", "body", "die", "heat", "slot", "pin", "pad", "cap", "ball", "via", "hole", "mark",
];

type Variant = "a" | "b";

/* The hero card, its processor band, where its copy ends and its index starts, and the board's origin in the workspace. */
type HeroAnchor = { hero: Box; band: Box; copyRight: number; indexLeft: number; board: Point; variant: Variant };

/* The link connector: its body, its signal pins (x), unwired pins, and the tips of its upper and lower pins. */
export type HeroLink = Box & { variant: Variant; pins: number[]; dummies: number[]; top: number; bottom: number };

/* The hero's own small board, in board coordinates. */
export type HeroBoard = Box & { layers: Record<BoardLayer, string>; chip: Box; link: HeroLink | null; board: Point };

export type CircuitGeometry = {
  width: number;
  height: number;
  obstacles: Rect[];
  layers: Record<BoardLayer, string>;
  journeys: Journey[];
  heartbeat: Heartbeat | null;
  hero: HeroBoard | null;
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
export function buildBoard(
  width: number,
  height: number,
  obstacles: Rect[],
  slots: Rect[] = obstacles,
  anchor: HeroAnchor | null = null,
): Omit<CircuitGeometry, "revision"> {
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

  // The desktop hero drives the board through its link connector; otherwise
  // the board keeps its own journeys towards its main processor.
  const hero = anchor && !compact ? heroCircuit(anchor, b, parts, links, obstacles) : null;
  const journeys = hero?.journeys ?? planJourneys(links, parts, obstacles, compact, hub);
  const layers = Object.fromEntries(LAYERS.map((l) => [l, b.layers[l].join("")])) as Record<BoardLayer, string>;
  // FNV-1a over the drawing: journeys may change (a panel collapses) without redrawing the board.
  let hash = 0x811c9dc5;
  for (const layer of LAYERS) {
    const d = layers[layer];
    for (let i = 0; i < d.length; i += 1) hash = Math.imul(hash ^ d.charCodeAt(i), 0x01000193);
  }
  const heartbeat =
    !hero?.journeys && hubBox && !isHidden({ x: hubBox.x + hubBox.w / 2, y: hubBox.y + hubBox.h / 2 }, obstacles)
      ? { ...hubBox, period: BAR * BEAT, beats: [0, 6] }
      : null;
  return {
    width,
    height,
    obstacles,
    layers,
    journeys,
    heartbeat,
    hero: hero?.board ?? null,
    boardKey: `${width}x${height}-${(hash >>> 0).toString(36)}`,
  };
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

/* ---------- hero processor and its link connector ---------- */

const HERO_SPEED = 110; // px per second, before snapping to the beat
const TOUR_HOPS = 14; // legs of one tour, at most: longer tours are split

type TourHop = { route: Route; to: Part | null };

/* Buses as a graph: each link in both directions. */
function busGraph(links: Link[]) {
  const adjacency = new Map<number, { to: number; route: Route }[]>();
  const add = (from: number, to: number, route: Route) => {
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from)?.push({ to, route });
  };
  for (const { a, b, route } of links) {
    add(a, b, route);
    add(b, a, reversed(route));
  }
  return adjacency;
}

/*
 * A tour from `start`: each leg follows the buses to the nearest chip not
 * visited yet (shortest path, so it may pass through visited chips, which
 * glow again), until the network is covered or the tour is long enough.
 */
function tour(adjacency: Map<number, { to: number; route: Route }[]>, parts: Part[], start: number, visited: Set<number>, maxHops: number) {
  const hops: TourHop[] = [];
  let current = start;
  visited.add(start);
  while (hops.length < maxHops) {
    const dist = new Map<number, number>([[current, 0]]);
    const prev = new Map<number, { from: number; route: Route }>();
    const done = new Set<number>();
    const queue = [current];
    let target = -1;
    while (queue.length) {
      queue.sort((x, y) => (dist.get(x) ?? 0) - (dist.get(y) ?? 0));
      const node = queue.shift() as number;
      if (done.has(node)) continue;
      done.add(node);
      if (!visited.has(node)) {
        target = node;
        break;
      }
      for (const edge of adjacency.get(node) ?? []) {
        const d = (dist.get(node) ?? 0) + edge.route.length;
        if (d < (dist.get(edge.to) ?? Infinity)) {
          dist.set(edge.to, d);
          prev.set(edge.to, { from: node, route: edge.route });
          queue.push(edge.to);
        }
      }
    }
    if (target < 0) break;
    const path: TourHop[] = [];
    for (let node = target; node !== current; node = (prev.get(node) as { from: number }).from) {
      path.unshift({ route: (prev.get(node) as { route: Route }).route, to: parts[node] });
    }
    if (hops.length && hops.length + path.length > maxHops) break;
    for (const hop of path) {
      hops.push(hop);
      if (hop.to?.id !== undefined) visited.add(hop.to.id);
    }
    current = target;
  }
  return hops;
}

type Segment = [Point, Point];

/* Distance from a point to a segment. */
function distance(p: Point, a: Point, z: Point) {
  const dx = z.x - a.x;
  const dy = z.y - a.y;
  const t = dx || dy ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

/* Points of a path drawn by this file (M, L, H, V and l commands only). */
function pointsOf(d: string): Point[] {
  const points: Point[] = [];
  let cur: Point = { x: 0, y: 0 };
  for (const [, cmd, args] of d.matchAll(/([MLHVl])([^MLHVlZz]*)/g)) {
    const n = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (cmd === "M" || cmd === "L") cur = { x: n[0], y: n[1] };
    else if (cmd === "l") cur = { x: cur.x + n[0], y: cur.y + n[1] };
    else if (cmd === "H") cur = { x: n[0], y: cur.y };
    else cur = { x: cur.x, y: n[0] };
    points.push(cur);
  }
  return points;
}

/* Where a polyline running downwards crosses the height y, and the rest of it from there. */
function from(points: Point[], y: number): Point[] | null {
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const z = points[i];
    if (a.y <= y && z.y > y) {
      const t = (y - a.y) / (z.y - a.y);
      return [{ x: a.x + t * (z.x - a.x), y }, ...points.slice(i)];
    }
  }
  return null;
}

type BoardLine = { rest: Point[]; part: Part; port: Point; fresh: boolean };

/*
 * The hero redrawn with the board's own primitives. The CH processor feeds a
 * small link connector astride the hero's lower edge; the connector sits on
 * board traces that already run up under the hero, so a signal leaves CH,
 * enters the connector, and continues on the board's own copper.
 */
function heroCircuit(anchor: HeroAnchor, board: Builder, parts: Part[], links: Link[], obstacles: Rect[]) {
  const { hero, band, variant } = anchor;
  const bottom = hero.y + hero.h;
  const zone = { l: anchor.copyRight + 40, r: anchor.indexLeft - 16 };
  const P = (x: number, y: number) => ({ x, y });

  // The connector: compact and astride the edge (A), or set into the board (B).
  const spec =
    variant === "b"
      ? { inside: 9, outside: 9, pin: 4, margin: 22 }
      : { inside: 7, outside: 7, pin: 4, margin: 12 };
  const tip = bottom + spec.outside + spec.pin; // tips of its lower pins

  // Board traces that run up under the hero and end on a chip below it.
  const occupied = (p: Point) =>
    LAYERS.some((layer) =>
      board.layers[layer].some((d) => {
        const pts = pointsOf(d);
        const ends = [pts[0], pts[pts.length - 1]];
        return ends.some((q) => q && Math.abs(q.x - p.x) < 0.6 && Math.abs(q.y - p.y) < 0.6);
      }),
    );
  const lines: BoardLine[] = [];
  for (const layer of ["trace", "bus"] as const) {
    for (const d of board.layers[layer]) {
      const pts = pointsOf(d);
      const end = pts[pts.length - 1];
      if (pts.length < 2 || pts[0].y >= bottom || end.y <= tip + 12) continue;
      const rest = from(pts, tip);
      const part = parts.find((p) => p.ports.t.some((q) => Math.abs(q.x - end.x) < 0.6 && Math.abs(q.y - end.y) < 0.6));
      if (!rest || !part || rest[0].x < zone.l || rest[0].x > zone.r) continue;
      lines.push({ rest, part, port: end, fresh: false });
    }
  }

  // Bundles: lines ending on the same chip, side by side. Keep the one nearest
  // the processor, preferring three lines.
  const chipCentre = band.x + 0.739 * band.w;
  const bundles = new Map<Part, BoardLine[]>();
  lines.forEach((l) => bundles.set(l.part, [...(bundles.get(l.part) ?? []), l]));
  const ranked = [...bundles.values()]
    .map((ls) => ls.sort((a, z) => a.rest[0].x - z.rest[0].x))
    .sort((a, z) => {
      const score = (ls: BoardLine[]) => Math.abs((ls[0].rest[0].x + ls[ls.length - 1].rest[0].x) / 2 - chipCentre) + (ls.length < 3 ? 60 : 0);
      return score(a) - score(z);
    });
  // Without a bundle in the free band (the narrowest desktops), the hero keeps
  // its small board but no connector, and the board its own journeys.
  const bundle = ranked[0]?.slice(0, 3) ?? [];

  // A straight drop from the connector's lower pins to a free top pin of `part`
  // is clear when it touches no other copper and crosses no other component.
  const wires: Segment[] = (["trace", "bus"] as const)
    .flatMap((layer) => board.layers[layer])
    .flatMap((d) => {
      const pts = pointsOf(d);
      return pts.slice(1).map((p, i) => [pts[i], p] as Segment);
    });
  const clearDrop = (port: Point, part: Part) =>
    port.x > zone.l &&
    port.x < zone.r &&
    !occupied(port) &&
    !wires.some(([a, z]) => {
      if (distance(port, a, z) < 0.6) return false;
      for (let y = tip; y < port.y - 2; y += 2) if (distance(P(port.x, y), a, z) < 2.5) return true;
      return false;
    }) &&
    !parts.some((p) => p !== part && port.x > p.x - 4 && port.x < p.x + p.w + 4 && p.y < port.y && p.y + p.h > tip);

  // When no board trace runs up into the free band (the board is laid out on
  // its own grid, so this depends on the page height), the connector gets
  // three short straight drops to free top pins of the nearest chip below.
  if (!bundle.length) {
    let best: { part: Part; ports: Point[]; score: number } | null = null;
    for (const part of parts) {
      if (part.y < tip + 4 || part.y > tip + 170) continue;
      // Free pins may alternate with decoupling ones: take up to three within 40 px.
      const free = part.ports.t.filter((q) => q.y > tip + 2 && clearDrop(q, part));
      for (let i = 0; i < free.length; i += 1) {
        const ports = free.slice(i, i + 3).filter((q) => q.x - free[i].x <= 40);
        if (ports.length < 2) continue;
        const middle = (ports[0].x + ports[ports.length - 1].x) / 2;
        const score = Math.abs(middle - chipCentre) + 0.6 * (part.y - tip) + (ports.length < 3 ? 80 : 0);
        if (!best || score < best.score) best = { part, ports, score };
      }
    }
    if (best) {
      best.ports.forEach((port, i) => {
        const top = P(port.x, tip);
        board.add(i === 1 && best!.ports.length === 3 ? "bus" : "trace", polyline([top, port]).d);
        bundle.push({ rest: [top, port], part: best!.part, port, fresh: true });
      });
    }
  }

  // A two-line bundle gets its third line: a short straight trace from the
  // connector down to the next free top pin of the same chip.
  if (bundle.length === 2) {
    const part = bundle[0].part;
    const ports = part.ports.t;
    const used = bundle.map((l) => ports.findIndex((q) => q === l.port || (Math.abs(q.x - l.port.x) < 0.6 && Math.abs(q.y - l.port.y) < 0.6)));
    for (const index of [Math.max(...used) + 1, Math.min(...used) - 1]) {
      const port = ports[index];
      if (!port || !clearDrop(port, part)) continue;
      const top = P(port.x, tip);
      board.add("trace", polyline([top, port]).d);
      bundle.push({ rest: [top, port], part, port, fresh: true });
      bundle.sort((a, z) => a.rest[0].x - z.rest[0].x);
      break;
    }
  }

  const xs = bundle.map((l) => l.rest[0].x);
  const linkW = xs.length ? xs[xs.length - 1] - xs[0] + 2 * spec.margin : 0;
  const link: HeroLink | null = !xs.length ? null : {
    x: xs[0] - spec.margin,
    y: bottom - spec.inside,
    w: linkW,
    h: spec.inside + spec.outside,
    variant,
    pins: xs,
    dummies: [],
    top: bottom - spec.inside - spec.pin,
    bottom: tip,
  };
  if (link && variant === "b") {
    // Unwired pins along the whole body, at the bundle's pitch.
    const pitch = xs.length > 1 ? Math.min(7, (xs[xs.length - 1] - xs[0]) / (xs.length - 1)) : 6;
    for (let x = link.x + 12; x < link.x + link.w - 11; x += pitch) {
      if (!xs.some((p) => Math.abs(p - x) < pitch * 0.6)) link.dummies.push(x);
    }
  }

  // The processor: a little larger than the 2N chip, raised so that its
  // lower pins have room to reach the connector.
  const b = builder();
  const trace = (layer: BoardLayer, pts: Point[]) => b.add(layer, polyline(pts).d);
  const w = 0.142 * band.w * 1.18;
  const h = 64;
  const chip = { x: chipCentre - w / 2, y: hero.y + 12, w, h };
  const { x, y } = chip;
  const fits = (left: number) => left > zone.l;

  b.add("shadow", roundRectPath(x + 3, y + 4, w, h, 8));
  b.add("body", roundRectPath(x, y, w, h, 8));
  b.add("die", roundRectPath(x + 11, y + 9, w - 22, h - 18, 5));
  for (let i = 1; i <= 3; i += 1) b.add("heat", roundRectPath(x + 11 + i * 4, y + 9 + i * 4, w - 22 - i * 8, h - 18 - i * 8, 3));
  const pins: Record<Side, Point[]> = { l: [], r: [], t: [], b: [] };
  for (let i = 0; i < 5; i += 1) {
    const py = y + 10 + i * ((h - 20) / 4);
    b.add("pin", rectPath(x - 6, py - 1, 6, 2));
    b.add("pin", rectPath(x + w, py - 1, 6, 2));
    pins.l.push(P(x - 6, py));
    pins.r.push(P(x + w + 6, py));
  }
  for (let i = 0; i < 10; i += 1) {
    const px = x + 13 + i * ((w - 26) / 9);
    b.add("pin", rectPath(px - 1, y - 6, 2, 6));
    b.add("pin", rectPath(px - 1, y + h, 2, 6));
    pins.t.push(P(px, y - 6));
    pins.b.push(P(px, y + h + 6));
  }

  // Processor to connector: the bottom pins nearest the connector, a short bus
  // whose horizontal runs are stacked so the three lines never cross.
  const linkCentre = xs.length ? (xs[0] + xs[xs.length - 1]) / 2 : chipCentre + 1;
  const first = Math.max(
    0,
    Math.min(
      pins.b.length - xs.length,
      pins.b.reduce((best, p, i) => (Math.abs(p.x - linkCentre) < Math.abs(pins.b[best].x - linkCentre) ? i : best), 0) - Math.floor(xs.length / 2),
    ),
  );
  const feeds = xs.map((cx, i) => ({ pin: pins.b[first + i], cx }));
  const room = (link?.top ?? 0) - (y + h + 6);
  const step = Math.min(4, (room - 8) / Math.max(1, xs.length));
  const lefts = feeds.filter((f) => f.cx < f.pin.x - 1);
  const rights = feeds.filter((f) => f.cx > f.pin.x + 1).reverse();
  const level = new Map<(typeof feeds)[number], number>();
  [lefts, rights].forEach((group) => group.forEach((f, i) => level.set(f, y + h + 6 + 4 + i * step)));
  const heroPaths = feeds.map((f, i) => {
    const end = P(f.cx, link?.top ?? 0);
    const run = level.get(f);
    const pts =
      run === undefined
        ? [f.pin, end]
        : (() => {
            const s = Math.sign(f.cx - f.pin.x);
            const c = Math.min(3, Math.abs(f.cx - f.pin.x) / 2);
            return [f.pin, P(f.pin.x, run - c), P(f.pin.x + s * c, run), P(f.cx - s * c, run), P(f.cx, run + c), end];
          })();
    trace(i === Math.floor(xs.length / 2) ? "bus" : "trace", pts);
    return pts;
  });
  // The other side of the connector's row: escape stubs on two free bottom pins.
  pins.b
    .filter((_, i) => i < first - 1 || i > first + xs.length)
    .filter((_, i) => i % 3 === 1)
    .slice(0, 2)
    .forEach((p) => {
      trace("trace", [p, P(p.x, p.y + 5)]);
      via(b, p.x, p.y + 7, 2);
    });

  // Left: a SOIC and a small BGA wired to the processor.
  const left = soic(b, x - 80, pins.l[0].y, 40, 5);
  const leftBga = bga(b, x - 116, y + 44, 26, 4);
  trace("bus", [pins.l[0], left.ports.r[0]]);
  const [bgaPort] = leftBga.ports.r.slice(-1);
  trace("trace", [pins.l[4], P(pins.l[4].x - 14, pins.l[4].y), P(pins.l[4].x - 14 - (pins.l[4].y - bgaPort.y), bgaPort.y), bgaPort]);
  for (const [i, len] of [[1, 14], [2, 22]]) {
    trace("trace", [pins.l[i], P(pins.l[i].x - len, pins.l[i].y)]);
    via(b, pins.l[i].x - len, pins.l[i].y, 2);
  }
  // Right: a SOIC, a small BGA, escape stubs and passives.
  const right = soic(b, x + w + 64, pins.r[0].y, 36, 4);
  const rightBga = bga(b, x + w + 70, y + 46, 24, 4);
  trace("bus", [pins.r[0], right.ports.l[0]]);
  const [rightBgaPort] = rightBga.ports.l;
  trace("trace", [pins.r[3], P(rightBgaPort.x - 18 - (rightBgaPort.y - pins.r[3].y), pins.r[3].y), P(rightBgaPort.x - 18, rightBgaPort.y), rightBgaPort]);
  for (const [i, len] of [[1, 14], [2, 22], [4, 14]]) {
    trace("trace", [pins.r[i], P(pins.r[i].x + len, pins.r[i].y)]);
    via(b, pins.r[i].x + len, pins.r[i].y, 2);
  }
  trace("trace", [right.ports.r[0], P(right.ports.r[0].x + 22, right.ports.r[0].y), P(right.ports.r[0].x + 32, right.ports.r[0].y + 10)]);
  via(b, right.ports.r[0].x + 32, right.ports.r[0].y + 10);
  trace("trace", [rightBga.ports.r[1], P(rightBga.ports.r[1].x + 24, rightBga.ports.r[1].y)]);
  via(b, rightBga.ports.r[1].x + 24, rightBga.ports.r[1].y, 2.2);
  for (let i = 0; i < 2; i += 1) smd(b, x + w + 128, y + 30 + i * 12, false);
  // A crystal on the side away from the connector's bus.
  const crystalX = linkCentre < chipCentre ? x + w + 96 : x - 70;
  crystal(b, crystalX, y + h + 18);
  // Decoupling under each BGA, wired to its lower balls.
  for (const part of [leftBga, rightBga]) {
    part.ports.b.slice(0, 1).forEach((p) => {
      const capY = y + h + 16;
      b.add("trace", `M${r1(p.x)} ${r1(p.y)}V${r1(capY - 4.5)}`);
      smd(b, p.x, capY, true);
    });
  }
  // A small via field on the right, away from the crystal.
  const fieldX = linkCentre < chipCentre ? x + w + 124 : x + w + 100;
  for (let i = 0; i < 3; i += 1) for (let j = 0; j < 2; j += 1) via(b, fieldX + i * 9, y + h + 12 + j * 9, 2);

  // Towards the copy: the board continues into the free band, with fewer parts.
  const farLeft = leftBga.ports.l[0];
  if (fits(farLeft.x - 120)) {
    // A small QFP fed by the BGA and the SOIC, with its own passives.
    const qx = Math.max(zone.l + 40, farLeft.x - 90);
    const q = qfp(b, qx, y + 36, 30, 4);
    trace("bus", [farLeft, P(q.ports.r[2].x + 12, farLeft.y), P(q.ports.r[2].x + 12 - (farLeft.y - q.ports.r[2].y), q.ports.r[2].y), q.ports.r[2]]);
    const sp = left.ports.l[0];
    trace("trace", [sp, P(sp.x - 18, sp.y), P(sp.x - 18 - (q.ports.r[0].y - sp.y), q.ports.r[0].y), q.ports.r[0]]);
    for (const port of [q.ports.t[1], q.ports.t[3]]) {
      b.add("trace", `M${r1(port.x)} ${r1(port.y)}V${r1(port.y - 4)}`);
      smd(b, port.x, port.y - 8.5, true, 8);
    }
    trace("trace", [q.ports.b[1], P(q.ports.b[1].x, q.ports.b[1].y + 8)]);
    via(b, q.ports.b[1].x, q.ports.b[1].y + 10, 2);
    trace("trace", [q.ports.l[1], P(q.ports.l[1].x - 16, q.ports.l[1].y)]);
    via(b, q.ports.l[1].x - 16, q.ports.l[1].y, 2);
    // Further on, only when the band is wide: a SOIC and a row of passives.
    const far = q.ports.l[3];
    if (fits(far.x - 110)) {
      const s = soic(b, far.x - 62, far.y, 34, 4);
      trace("bus", [far, s.ports.r[0]]);
      for (let i = 0; i < 3; i += 1) smd(b, s.x - 14 - i * 11, s.y + 9, true);
      trace("trace", [s.ports.l[0], P(s.ports.l[0].x - 40, s.ports.l[0].y), P(s.ports.l[0].x - 52, s.ports.l[0].y - 12)]);
      via(b, s.ports.l[0].x - 52, s.ports.l[0].y - 12);
    } else {
      via(b, far.x - 14, far.y, 2);
      trace("trace", [far, P(far.x - 12, far.y)]);
    }
  } else if (fits(farLeft.x - 32)) {
    trace("trace", [farLeft, P(farLeft.x - 26, farLeft.y)]);
    via(b, farLeft.x - 28, farLeft.y, 2.2);
  }
  if (fits(left.ports.l[0].x - 40) && !fits(farLeft.x - 120)) {
    const sp = left.ports.l[0];
    trace("trace", [sp, P(sp.x - 24, sp.y), P(sp.x - 34, sp.y + 10)]);
    via(b, sp.x - 34, sp.y + 10);
  }

  // Journeys: CH glows, a signal runs to the connector and fades into it; the
  // connector glows, a signal leaves on one of the board traces, reaches the
  // chip below and travels on along the board's own buses.
  // Signals: from CH through the connector, then on a tour of the board.
  const adjacency = busGraph(links);
  const visited = new Set<number>();
  const chipGlow = (p: Box) => ({ x: p.x - 4, y: p.y - 4, w: p.w + 8, h: p.h + 8 });
  const plans: { hops: TourHop[]; seed: Box; fromCh: boolean }[] = [];
  if (link) {
    bundle.forEach((line, k) => {
      const hops: TourHop[] = [
        { route: polyline(heroPaths[k]), to: null },
        { route: polyline(line.rest), to: line.part },
      ];
      if (line.part.id !== undefined) hops.push(...tour(adjacency, parts, line.part.id, visited, TOUR_HOPS));
      plans.push({ hops, seed: chipGlow(chip), fromCh: true });
    });
  }
  // Chips the buses do not connect to CH's network get their own local tour.
  for (;;) {
    // Start where the signal is seen: a chip outside the panels first.
    const hidden = (p: Part) => (isHidden({ x: p.x + p.w / 2, y: p.y + p.h / 2 }, obstacles) ? 1 : 0);
    const seed = parts
      .filter((p) => p.id !== undefined && adjacency.has(p.id) && !visited.has(p.id))
      .sort((x, y) => hidden(x) - hidden(y))[0];
    if (!seed || seed.id === undefined) break;
    const hops = tour(adjacency, parts, seed.id, visited, TOUR_HOPS);
    if (!hops.length) continue;
    plans.push({ hops, seed: chipGlow(seed), fromCh: false });
  }

  // Beats: the source glows, the signal travels, each chip glows during a one-beat
  // stop (a beat and a half inside the connector, where the signal disappears).
  const scheduled = plans.map(({ hops, seed }) => {
    let beat = 1;
    const out: Journey["hops"] = [];
    const glows: Journey["glows"] = [{ ...seed, start: 0, end: BEAT }];
    hops.forEach(({ route, to }, i) => {
      const travel = Math.max(1, Math.round(route.length / HERO_SPEED / BEAT));
      out.push({ ...route, start: beat * BEAT, end: (beat + travel) * BEAT });
      beat += travel;
      const box = to || !link ? chipGlow(to ?? chip) : { x: link.x - 3, y: link.y - 3, w: link.w + 6, h: link.h + 6, over: true };
      const rest = to ? 1 : 1.5;
      glows.push({ ...box, start: beat * BEAT, end: (beat + rest) * BEAT });
      if (i < hops.length - 1) beat += rest;
    });
    return { hops: out, glows, beats: beat + 1 };
  });

  // Three lanes: tours follow each other, so three signals travel at once at
  // most and every connected chip is visited once per period (about a minute).
  const lanes = [0, 0, 0];
  const starts = scheduled.map((s) => {
    const lane = lanes.indexOf(Math.min(...lanes));
    const start = lanes[lane];
    lanes[lane] += s.beats + 1;
    return start;
  });
  const beats = Math.max(...lanes, 1);
  const period = beats * BEAT;
  const tones: Tone[] = ["cyan", "blue", "white"];
  const journeys: Journey[] = scheduled.map((s, k) => ({
    tone: plans[k].fromCh ? tones[k % 3] : (["cyan", "blue", "white", "amber"] as Tone[])[k % 4],
    rare: false,
    period,
    delay: starts[k] * BEAT - period,
    hops: s.hops,
    glows: s.glows,
  }));

  const layers = Object.fromEntries(LAYERS.map((l) => [l, b.layers[l].join("")])) as Record<BoardLayer, string>;
  return { board: { ...hero, layers, chip, link, board: anchor.board } as HeroBoard, journeys: journeys.length ? journeys : null };
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
  const roleOf = (element: Element): Rect["role"] =>
    element.classList.contains("overview-hero")
      ? "hero"
      : element.classList.contains("environment-panel")
        ? "env"
        : element.classList.contains("page-foot")
          ? "foot"
          : "widget";
  // A collapsed panel shows only its header card.
  const obstacles = shown.map((element) => {
    const visible = element.classList.contains("is-collapsed") ? element.querySelector(".panel-heading") ?? element : element;
    return { ...toRect(visible.getBoundingClientRect(), element.classList.contains("network-panel")), role: roleOf(element) };
  });
  const slots = shown.map((element) => toRect(element.getBoundingClientRect(), element.classList.contains("network-panel")));
  return { elements, width: Math.round(box.width), height: Math.round(box.height), obstacles, slots, anchor: heroAnchor(host, box) };
}

/* The desktop hero lends its processor band (the 2N circuit's box) to the board. */
function heroAnchor(host: HTMLElement, box: DOMRect): HeroAnchor | null {
  const hero = host.parentElement?.querySelector<HTMLElement>(".dashboard-board .overview-hero");
  const band = hero?.querySelector(".hero-circuit")?.getBoundingClientRect();
  const index = hero?.querySelector(".hero-index")?.getBoundingClientRect();
  const workspace = hero?.parentElement?.getBoundingClientRect();
  if (!hero || !band || !index || !workspace || band.width === 0 || !window.matchMedia("(min-width: 1200px)").matches) return null;
  // The copy ends where its text ends, not where its box does.
  const copyRight = Math.max(
    ...[...hero.querySelectorAll(".hero-copy h1, .hero-copy p, .hero-breadcrumb")].map((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getBoundingClientRect().right;
    }),
  );
  const rect = (r: DOMRect) => ({ x: Math.round(r.left - box.left), y: Math.round(r.top - box.top), w: Math.round(r.width), h: Math.round(r.height) });
  return {
    hero: rect(hero.getBoundingClientRect()),
    band: rect(band),
    copyRight: Math.round(copyRight - box.left),
    indexLeft: Math.round(index.left - box.left),
    board: { x: Math.round(workspace.left - box.left), y: Math.round(workspace.top - box.top) },
    variant: document.documentElement.dataset.link === "b" ? "b" : "a",
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
  const drawings = useRef(0);
  const lastBoard = useRef("");

  const recompute = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const host = hostRef.current;
      if (!host) return;
      const { elements, width, height, obstacles, slots, anchor } = measure(host);

      const sameElements =
        elements.length === observed.current.length &&
        elements.every((element, index) => element === observed.current[index]);
      if (!sameElements && observer.current) {
        observer.current.disconnect();
        observer.current.observe(host);
        elements.forEach((element) => observer.current?.observe(element));
        observed.current = elements;
      }

      const next = JSON.stringify([width, height, obstacles, slots, anchor]);
      if (next === signature.current || width === 0 || height === 0) return;
      signature.current = next;
      const board = buildBoard(width, height, obstacles, slots, anchor);
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

/*
 * Calm ramp: one smooth vertical fade instead of bands with visible edges. The
 * board is quiet above the hero and between the hero, the environment cards
 * and the widgets, then comes back to full strength progressively behind the
 * widgets. Under the hero, the bundle feeding the link connector stays bright,
 * its column fading out sideways.
 */
function calmRamp(g: CircuitGeometry) {
  const hero = g.obstacles.find((o) => o.role === "hero");
  const env = g.obstacles.find((o) => o.role === "env");
  const widgets = g.obstacles.filter((o) => o.role === "widget");
  if (!hero || !env) return null;
  const top = widgets.length ? Math.min(...widgets.map((w) => w.y)) : env.y + env.h + 40;
  const stops = [
    { y: 0, level: 0.34 },
    { y: hero.y + hero.h, level: 0.34 },
    { y: env.y + env.h, level: 0.4 },
    { y: top + 40, level: 0.5 },
    { y: top + 360, level: 1 },
  ].map(({ y, level }) => ({ offset: Math.min(1, Math.max(0, y / g.height)), level }));
  const link = g.hero?.link;
  const keep = link ? { x: link.x - 24, w: link.w + 48, y: hero.y + hero.h - 2, h: env.y - hero.y - hero.h + 4 } : null;
  return { stops, keep };
}

/*
 * The LEDs, tails and chip glows of every journey, in board coordinates.
 * "under" draws them below the panels and in the hero; "over" draws only the
 * glows that sit on the link connector, above its body.
 */
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const boundsOf = (points: Point[]) => {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { x: Math.min(...xs) - 4, y: Math.min(...ys) - 4, w: Math.max(...xs) - Math.min(...xs) + 8, h: Math.max(...ys) - Math.min(...ys) + 8 };
};

/* `clip` keeps only the hops and glows that cross a box (the hero layer draws its own part only). */
function JourneyLayer({ journeys, mode, clip }: { journeys: Journey[]; mode: "under" | "over"; clip?: Box }) {
  return (
    <>
      {journeys.map((j, ji) => (
        <g key={ji} className={`b-journey is-${j.tone}`}>
          {j.glows.map((g, gi) =>
            !!g.over === (mode === "over") && (!clip || overlaps(g, clip)) ? (
              <g key={`g${gi}`} className="b-glow" style={{ animation: animation(`cbg${ji}-${gi}`, j) }}>
                <rect className="b-glow-halo" x={g.x - 5} y={g.y - 5} width={g.w + 10} height={g.h + 10} rx="9" />
                <rect className="b-glow-edge" x={g.x} y={g.y} width={g.w} height={g.h} rx="6" />
              </g>
            ) : null,
          )}
          {mode === "under" &&
            j.hops.map((h, hi) => (clip && !overlaps(boundsOf(h.points), clip) ? null : (
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
            )))}
        </g>
      ))}
    </>
  );
}

/*
 * The hero's own small board, portalled into the hero card under its copy. Its
 * viewBox is the hero's box on the board, so it shares the board's journeys and
 * keyframes: a signal crosses the hero's edge at the same place and instant.
 */
/*
 * The CH core symbol, engraved into the processor's die rather than floating
 * on it. Three studies, chosen with `?core=1|2|3` in the prototype:
 * 1 the CyberHub prompt etched in a die window, with fiducials and bond pads;
 * 2 a hexagonal core around the prompt, its spokes ending on signal nodes;
 * 3 a grid of compute cores whose centre one carries the prompt.
 */
function CoreSymbol({ chip }: { chip: Box }) {
  const cx = chip.x + chip.w / 2;
  const cy = chip.y + chip.h / 2;
  const variant = document.documentElement.dataset.core ?? "1";
  const prompt = (k: number, ox = 0) =>
    `M${r1(cx + ox - 8.5 * k)} ${r1(cy - 6 * k)}L${r1(cx + ox - 2 * k)} ${r1(cy)}L${r1(cx + ox - 8.5 * k)} ${r1(cy + 6 * k)}M${r1(cx + ox + 1 * k)} ${r1(cy + 6 * k)}H${r1(cx + ox + 10 * k)}`;
  // Bond pads on both sides of the window, where the die is wide.
  const pads = [-2, -1, 0, 1, 2].flatMap((i) => [
    <rect key={`l${i}`} className="core-pad" x={cx - 28.5} y={cy + i * 7 - 1.2} width="2.6" height="2.4" rx="0.4" />,
    <rect key={`r${i}`} className="core-pad" x={cx + 25.9} y={cy + i * 7 - 1.2} width="2.6" height="2.4" rx="0.4" />,
  ]);
  if (variant === "2") {
    const hex = (r: number) =>
      [0, 1, 2, 3, 4, 5].map((i) => {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        return `${i ? "L" : "M"}${r1(cx + r * Math.cos(a))} ${r1(cy + r * Math.sin(a))}`;
      }).join("") + "Z";
    return (
      <g className="core is-hex">
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a = (Math.PI / 3) * i - Math.PI / 2;
          const x1 = cx + 22 * Math.cos(a);
          const y1 = cy + 22 * Math.sin(a);
          const x2 = cx + 28 * Math.cos(a);
          const y2 = cy + 28 * Math.sin(a);
          return (
            <g key={i}>
              <path className="core-spoke" d={`M${r1(x1)} ${r1(y1)}L${r1(x2)} ${r1(y2)}`} />
              <circle className="core-node" cx={x2} cy={y2} r="1.3" />
            </g>
          );
        })}
        <path className="core-window" d={hex(22)} />
        <path className="core-ring" d={hex(16.5)} />
        <path className="core-prompt" d={prompt(1, 0.5)} />
      </g>
    );
  }
  if (variant === "3") {
    const cell = 12.4;
    const gap = 2.2;
    const start = -(cell * 1.5 + gap);
    return (
      <g className="core is-grid">
        <rect className="core-window" x={cx - 22} y={cy - 22} width="44" height="44" rx="6" />
        {[0, 1, 2].flatMap((i) =>
          [0, 1, 2].map((j) => {
            const x = cx + start + i * (cell + gap);
            const y = cy + start + j * (cell + gap);
            const centre = i === 1 && j === 1;
            return <rect key={`${i}${j}`} className={centre ? "core-cell is-lit" : "core-cell"} x={x} y={y} width={cell} height={cell} rx="1.6" />;
          }),
        )}
        <path className="core-prompt is-small" d={`M${r1(cx - 4)} ${r1(cy - 3.2)}L${r1(cx - 0.6)} ${r1(cy)}L${r1(cx - 4)} ${r1(cy + 3.2)}M${r1(cx + 0.6)} ${r1(cy + 3.4)}H${r1(cx + 4.4)}`} />
        {pads}
      </g>
    );
  }
  const f = 4; // fiducial arm
  const w = 22;
  const fid = [[-1, -1], [1, -1], [-1, 1], [1, 1]]
    .map(([sx, sy]) => `M${r1(cx + sx * (w - 3))} ${r1(cy + sy * (w - 3 - f))}V${r1(cy + sy * (w - 3))}H${r1(cx + sx * (w - 3 - f))}`)
    .join("");
  return (
    <g className="core is-die">
      <rect className="core-window" x={cx - w} y={cy - w} width={2 * w} height={2 * w} rx="7" />
      <path className="core-bevel" d={`M${r1(cx - w + 6)} ${r1(cy - w + 0.9)}H${r1(cx + w - 6)}`} />
      <path className="core-fiducial" d={fid} />
      <path className="core-prompt" d={prompt(1.25, 0.5)} />
      <circle className="core-node" cx={cx + 14} cy={cy - 14} r="1.6" />
      {pads}
    </g>
  );
}

function HeroLayer({ hero, journeys, target }: { hero: HeroBoard; journeys: Journey[]; target: Element }) {
  const { chip } = hero;
  return createPortal(
    <svg
      className="hero-board board-layer"
      width={hero.w}
      height={hero.h}
      viewBox={`${hero.x} ${hero.y} ${hero.w} ${hero.h}`}
      aria-hidden="true"
      focusable="false"
    >
      {LAYERS.map((layer) => (hero.layers[layer] ? <path key={layer} className={`b-${layer}`} d={hero.layers[layer]} /> : null))}
      <rect className="hero-chip-aura" x={chip.x - 16} y={chip.y - 10} width={chip.w + 32} height={chip.h + 20} rx="16" />
      <rect className="hero-chip-halo" x={chip.x - 8} y={chip.y - 5} width={chip.w + 16} height={chip.h + 10} rx="12" />
      <rect className="hero-chip-shell" x={chip.x} y={chip.y} width={chip.w} height={chip.h} rx="8" />
      <CoreSymbol chip={chip} />
      <g className="b-journeys">
        <JourneyLayer journeys={journeys} mode="under" clip={hero} />
      </g>
    </svg>,
    target,
  );
}

/*
 * The link connector, astride the hero's lower edge and above it: an offset
 * shadow, a side face for its thickness, a lit top face, a bevel line and
 * real pins. It hides the hero's border locally; its glow sits on top.
 */
function LinkLayer({ hero, link, journeys, target }: { hero: HeroBoard; link: HeroLink; journeys: Journey[]; target: Element }) {
  const pad = 14;
  const box = { x: link.x - pad, y: link.top - pad, w: link.w + 2 * pad, h: link.bottom - link.top + 2 * pad };
  const pinTop = link.y - link.top;
  const pinBottom = link.bottom - (link.y + link.h);
  const b = link.variant === "b";
  const r = b ? 3 : 2.5;
  return createPortal(
    <svg
      className={`hero-link is-${link.variant}`}
      width={box.w}
      height={box.h}
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      // Inline as well: out of the layout even before the stylesheet applies.
      style={{ position: "absolute", left: box.x - hero.board.x, top: box.y - hero.board.y }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`hero-link-face-${link.variant}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={b ? "#1d3a52" : "#183247"} />
          <stop offset="0.55" stopColor="#0f2133" />
          <stop offset="1" stopColor="#0a1622" />
        </linearGradient>
      </defs>
      {b && <rect className="hl-notch" x={link.x - 7} y={link.y - 3} width={link.w + 14} height={link.h + 7} rx="4" />}
      <rect className="hl-shadow" x={link.x + 2} y={link.y + 4} width={link.w} height={link.h} rx={r} />
      {[...link.pins, ...link.dummies].map((px) => (
        <g key={px} className={link.pins.includes(px) ? "hl-pin" : "hl-pin is-dummy"}>
          <rect x={px - 1} y={link.top} width="2" height={pinTop + 1} />
          <rect x={px - 1} y={link.y + link.h - 1} width="2" height={pinBottom + 1} />
        </g>
      ))}
      <rect className="hl-side" x={link.x} y={link.y + 2} width={link.w} height={link.h} rx={r} />
      <rect className="hl-face" x={link.x} y={link.y} width={link.w} height={link.h - 1} rx={r} fill={`url(#hero-link-face-${link.variant})`} />
      <path className="hl-bevel" d={`M${r1(link.x + r)} ${r1(link.y + 0.7)}H${r1(link.x + link.w - r)}`} />
      {b && <path className="hl-bevel is-soft" d={`M${r1(link.x + 0.7)} ${r1(link.y + r)}V${r1(link.y + link.h - r - 1)}`} />}
      <path className="hl-groove" d={`M${r1(link.x + (b ? 14 : 6))} ${r1(link.y + link.h / 2)}H${r1(link.x + link.w - (b ? 14 : 6))}`} />
      <circle className="hl-mark" cx={link.x + (b ? 14 : 4.5)} cy={link.y + 3.6} r="1.1" />
      {b &&
        [link.x + 6.5, link.x + link.w - 6.5].map((cx) => (
          <g key={cx}>
            <circle className="hl-pad" cx={cx} cy={link.y + link.h / 2} r="3.4" />
            <circle className="hl-hole" cx={cx} cy={link.y + link.h / 2} r="1.4" />
          </g>
        ))}
      <g className="b-journeys">
        <JourneyLayer journeys={journeys} mode="over" clip={link} />
      </g>
    </svg>,
    target,
  );
}

export default function DashboardCircuit() {
  const hostRef = useRef<HTMLDivElement>(null);
  const { geometry } = useCircuitGeometry(hostRef);
  const keyframes = useMemo(
    () => (geometry ? journeyKeyframes(geometry.journeys) + heartbeatKeyframes(geometry.heartbeat) : ""),
    [geometry],
  );
  const heroElement = geometry?.hero ? hostRef.current?.parentElement?.querySelector(".dashboard-board .overview-hero") : null;

  // The board, hero and connector layers mount their journeys separately: give
  // every journey animation the same start time, so a signal crossing from one
  // layer to the next is at the same place at the same instant.
  useEffect(() => {
    if (!geometry) return;
    const frame = requestAnimationFrame(() => {
      const animations = document
        .getAnimations()
        .filter((a): a is CSSAnimation => a instanceof CSSAnimation && /^cb[dtg]/.test(a.animationName));
      const starts = animations.map((a) => Number(a.startTime)).filter((t) => Number.isFinite(t));
      if (!starts.length) return;
      const origin = Math.min(...starts);
      animations.forEach((a) => {
        if (a.startTime !== origin) a.startTime = origin;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [geometry]);
  const boardElement = heroElement?.parentElement ?? null;

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
            <defs>
              {(() => {
                const ramp = calmRamp(geometry);
                const grey = (level: number) => {
                  const v = Math.round(level * 255);
                  return `rgb(${v} ${v} ${v})`;
                };
                return (
                  <>
                    <linearGradient id="board-calm-ramp" x1="0" x2="0" y1="0" y2="1">
                      {ramp ? (
                        ramp.stops.map((stop, i) => <stop key={i} offset={stop.offset} stopColor={grey(stop.level)} />)
                      ) : (
                        <stop offset="0" stopColor="#fff" />
                      )}
                    </linearGradient>
                    {ramp?.keep && (
                      <linearGradient id="board-calm-keep" gradientUnits="userSpaceOnUse" x1={ramp.keep.x} x2={ramp.keep.x + ramp.keep.w} y1="0" y2="0">
                        <stop offset="0" stopColor="#fff" stopOpacity="0" />
                        <stop offset="0.3" stopColor="#fff" stopOpacity="1" />
                        <stop offset="0.7" stopColor="#fff" stopOpacity="1" />
                        <stop offset="1" stopColor="#fff" stopOpacity="0" />
                      </linearGradient>
                    )}
                    <mask id="board-calm" maskUnits="userSpaceOnUse" x="0" y="0" width={geometry.width} height={geometry.height}>
                      <rect width={geometry.width} height={geometry.height} fill="url(#board-calm-ramp)" />
                      {ramp?.keep && (
                        <rect x={ramp.keep.x} y={ramp.keep.y} width={ramp.keep.w} height={ramp.keep.h} fill="url(#board-calm-keep)" />
                      )}
                    </mask>
                  </>
                );
              })()}
            </defs>
            <g key={geometry.revision} mask="url(#board-calm)" className={geometry.revision && geometry.revision > 1 ? "l-redraw" : undefined}>
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
              <JourneyLayer journeys={geometry.journeys} mode="under" />
            </g>
          </svg>
          {geometry.hero && heroElement && <HeroLayer hero={geometry.hero} journeys={geometry.journeys} target={heroElement} />}
          {geometry.hero?.link && boardElement && <LinkLayer hero={geometry.hero} link={geometry.hero.link} journeys={geometry.journeys} target={boardElement} />}
        </>
      )}
    </div>
  );
}
