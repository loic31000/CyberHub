import type { Box, Point, Route } from "./types";

/* Pure geometric primitives: seeded random, path strings, polylines and simple routes, boxes. */

export function random(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export const r1 = (v: number) => Math.round(v * 10) / 10;

export const rectPath = (x: number, y: number, w: number, h: number) => `M${r1(x)} ${r1(y)}h${r1(w)}v${r1(h)}h${r1(-w)}Z`;

export function roundRectPath(x: number, y: number, w: number, h: number, r: number) {
  return `M${r1(x + r)} ${r1(y)}H${r1(x + w - r)}Q${r1(x + w)} ${r1(y)} ${r1(x + w)} ${r1(y + r)}V${r1(y + h - r)}Q${r1(x + w)} ${r1(y + h)} ${r1(x + w - r)} ${r1(y + h)}H${r1(x + r)}Q${r1(x)} ${r1(y + h)} ${r1(x)} ${r1(y + h - r)}V${r1(y + r)}Q${r1(x)} ${r1(y)} ${r1(x + r)} ${r1(y)}Z`;
}

export const circlePath = (x: number, y: number, r: number) =>
  `M${r1(x - r)} ${r1(y)}a${r1(r)} ${r1(r)} 0 1 0 ${r1(2 * r)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(-2 * r)} 0`;

export function polyline(points: Point[]): Route {
  let length = 0;
  for (let i = 1; i < points.length; i += 1) length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  const d = points.map((p, i) => `${i ? "L" : "M"}${r1(p.x)} ${r1(p.y)}`).join("");
  return { d, length, points };
}

/* Orthogonal run with one 45° jog between two ports facing each other. */
export function jogRoute(a: Point, b: Point, axis: "h" | "v"): Route | null {
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
export function elbowRoute(a: Point, b: Point): Route | null {
  const c = 14;
  if (b.x - a.x < c + 12 || b.y - a.y < c + 12) return null;
  return polyline([a, { x: b.x - c, y: a.y }, { x: b.x, y: a.y + c }, b]);
}

export type Segment = [Point, Point];

/* Distance from a point to a segment. */
export function distance(p: Point, a: Point, z: Point) {
  const dx = z.x - a.x;
  const dy = z.y - a.y;
  const t = dx || dy ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

/* Points of a path drawn by this file (M, L, H, V and l commands only). */
export function pointsOf(d: string): Point[] {
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
export function from(points: Point[], y: number): Point[] | null {
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

/*
 * The LEDs, tails and chip glows of every journey, in board coordinates.
 * "under" draws them below the panels and in the hero; "over" draws only the
 * glows that sit on the link connector, above its body.
 */
export const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const boundsOf = (points: Point[]) => {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { x: Math.min(...xs) - 4, y: Math.min(...ys) - 4, w: Math.max(...xs) - Math.min(...xs) + 8, h: Math.max(...ys) - Math.min(...ys) + 8 };
};

/* Does a clipped layer (hero) draw this hop? The layer and its keyframes share this test. */
export const hopIn = (hop: { points: Point[] }, clip: Box) => overlaps(boundsOf(hop.points), clip);
