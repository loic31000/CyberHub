import { polyline } from "./geometry";
import { BAR, BEAT, JOURNEY_TONES, SPEED, START_BEATS } from "./timing";
import type { Box, Journey, Link, Part, Point, Rect, Route } from "./types";

/* Routing over the drawn copper: what a panel hides, the bus graph, tours and LED journeys. */

/* Share of a route that is not hidden behind a panel. */
export function visibleShare(route: Route, obstacles: Rect[]) {
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

export const isHidden = (p: Point, obstacles: Rect[]) => obstacles.some((o) => p.x > o.x && p.x < o.x + o.w && p.y > o.y && p.y < o.y + o.h);

export function reversed(route: Route): Route {
  return polyline([...route.points].reverse());
}

/*
 * Journeys only use traces that can be followed from end to end: 90% of the
 * run and both pins visible, away from the globe. Each journey starts far from
 * the hub and hops chip to chip towards it (up to three hops), never reusing a
 * trace another journey already uses.
 */
export function planJourneys(links: Link[], parts: Part[], obstacles: Rect[], compact: boolean, hub: Point): Journey[] {
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

/* Buses as a graph: each link in both directions. */
export function busGraph(links: Link[]) {
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
export function tour(adjacency: Map<number, { to: number; route: Route }[]>, parts: Part[], start: number, visited: Set<number>, maxHops: number) {
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

export type TourHop = { route: Route; to: Part | null; connector?: Box };

export const TOUR_HOPS = 14; // legs of one tour, at most: longer tours are split
