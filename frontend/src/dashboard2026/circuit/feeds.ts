import { jogRoute, overlaps, polyline } from "./geometry";
import { relayChip, via, type Builder } from "./parts";
import { busGraph, isHidden, reversed, visibleShare } from "./routing";
import type { Tone } from "./timing";
import { LAYERS, type Box, type EnvironmentLink, type FeedRoom, type HeroLink, type Journey, type Link, type ModuleFeed, type Part, type Point, type Rect, type Route } from "./types";

/* CH's feeds down the board (and a module processor's feeds on module pages). */

const STOP = 0.45; // s: a chip glows, then the signal leaves by another pin

const TRIP = 12; // s: one feed, from CH to a chip at the bottom of the board

/*
 * CH's three feeds leave the hero by its link connector, run straight down
 * behind the environment card, come out through a second connector astride its
 * lower edge and land on a relay chip in the open band. The relay splits them:
 * left (cyan) by its left pin, centre (ice blue) by a bottom pin, right (cold
 * white, amber now and then) by its right pin. Each then runs behind the
 * widgets to a chip on its own side and follows the board's buses down to a
 * chip at the bottom, preferring copper that is not hidden by a panel.
 */
/*
 * Module pages call it without an environment card: the feeds run from the
 * connector straight to the relay at `relayTop`; `routeKeepout` replaces the
 * keep-out for routes (they may pass behind opaque controls) and `schedule`
 * aligns the feeds with the module hero's pulses.
 */
type FeedOptions = {
  relayTop?: number;
  routeKeepout?: Box[];
  schedule?: ModuleFeed["schedule"];
  /* How much a hidden stretch costs over a visible one (module pages, mostly covered by cards). */
  hiddenCost?: number;
  /* End each feed on a chip that shows, rather than on the lowest row. */
  visibleGoal?: boolean;
  /* Where the relay may sit (offset from the connector, top), best first. */
  spots?: { dx: number; top: number }[];
};

export function feedJourneys(
  board: Builder, parts: Part[], links: Link[], obstacles: Rect[], link: HeroLink, heroPaths: Point[][],
  chip: Box, env: Rect | null, room: FeedRoom, widgetTop: number, options: FeedOptions = {},
): { journeys: Journey[]; envLink: EnvironmentLink | null } | null {
  const P = (x: number, y: number) => ({ x, y });
  const { keepout } = room;
  const routeKeepout = options.routeKeepout ?? keepout;
  const pins = link.pins;
  if (pins.length !== 3) return null;
  const tip = link.bottom;
  const bottomEdge = Math.max(...obstacles.map((o) => o.y + o.h), widgetTop);

  // The second connector, astride the card's lower edge, right below the first.
  const envLink: EnvironmentLink | null = env ? {
    x: (pins[0] + pins[2]) / 2 - 26,
    y: env.y + env.h - 7,
    w: 52,
    h: 15,
    pins,
    top: env.y + env.h - 13,
    bottom: env.y + env.h + 14,
  } : null;
  const relayTop = envLink ? envLink.bottom + 10 : options.relayTop ?? tip + 18;
  const relays: Box[] = [];
  // The relay, `dx` beside the connector. Off to the side, its three inputs
  // come down as one nested bus with 45° corners: the wire on the relay's
  // side turns first, so no wire crosses another.
  const placeRelay = (dx: number, top: number) => {
    const placed = relayChip(board, { pins: pins.map((x) => x + dx) }, top, options.visibleGoal ? 3 : 1);
    const area = { x: placed.x - 6, y: placed.y - 6, w: placed.w + 12, h: placed.h + 12 };
    const start = envLink ? envLink.bottom : tip;
    const side = Math.sign(dx);
    const wires = pins.map((x, k) => {
      if (Math.abs(dx) < 1) return polyline([P(x, start), placed.ports.t[k]]);
      const rank = side > 0 ? pins.length - 1 - k : k;
      const y = start + 8 + rank * 5;
      return polyline([P(x, start), P(x, y - 4), P(x + side * 4, y), P(x + dx - side * 4, y), P(x + dx, y + 4), placed.ports.t[k]]);
    });
    return { relay: placed, relayArea: area, into: wires };
  };
  let relay = null as unknown as Part;
  let relayArea: Box = { x: 0, y: 0, w: 0, h: 0 };
  let into: Route[] = [];
  const down = envLink ? pins.map((x) => polyline([P(x, tip), P(x, envLink.top)])) : [];
  if (!options.spots) {
    const relayBox = { x: pins[1] - 32, y: relayTop - 8, w: 64, h: 40 };
    if (relayTop + 26 + 12 > widgetTop || keepout.some((k) => overlaps(relayBox, k))) return null;
    ({ relay, relayArea, into } = placeRelay(0, relayTop));
    pins.forEach((_, k) => {
      if (down[k]) board.add(k === 1 ? "bus" : "trace", down[k].d);
      board.add(k === 1 ? "bus" : "trace", into[k].d);
    });
    relays.push(relayArea);
  }

  const inside = (p: Point, box: Box, pad: number) => p.x > box.x - pad && p.x < box.x + box.w + pad && p.y > box.y - pad && p.y < box.y + box.h + pad;
  const samples = (route: Route) => {
    const out: Point[] = [];
    route.points.slice(1).forEach((z, i) => {
      const a = route.points[i];
      const n = Math.max(1, Math.round(Math.hypot(z.x - a.x, z.y - a.y) / 4));
      for (let t = 1; t < n; t += 1) out.push(P(a.x + ((z.x - a.x) * t) / n, a.y + ((z.y - a.y) * t) / n));
    });
    return out;
  };
  // Only what is seen must stay clear: behind a widget a route may pass under a part.
  const clear = (route: Route, target: Part, own: Box | null, loose: boolean) =>
    !samples(route).some((p) =>
      (!loose && !isHidden(p, obstacles) && parts.some((part) => part !== target && inside(p, part, 3))) ||
      routeKeepout.some((k) => inside(p, k, 6)) ||
      relays.some((r) => r !== own && inside(p, r, 2)));

  // From a pin, a short stub then a 45° run down to a free top pin of a connected chip.
  const adjacency = busGraph(links);
  const taken = new Set<Part>();
  // Square runs, no diagonals: along, a small 4 px corner, then down to the pin.
  const square = (lead: Point[], q: Point, sideways: boolean) => {
    const from = lead[lead.length - 1];
    const dx = q.x - from.x;
    const s = Math.sign(dx);
    const c = Math.min(4, Math.abs(dx) / 2);
    if (Math.abs(dx) < 0.5) return [...lead, q];
    if (sideways) return [...lead, P(q.x - s * c, from.y), P(q.x, from.y + c), q];
    const y = from.y + 4;
    return [...lead, P(from.x, y), P(from.x + s * c, y + c), P(q.x - s * c, y + c), P(q.x, y + 2 * c), q];
  };
  // A second, looser pass may cross a visible part rather than leave a feed unwired.
  const drop = (lead: Point[], want: -1 | 0 | 1, own: Box | null, span: [number, number]) =>
    pick(lead, want, own, span, false) ?? pick(lead, want, own, span, true);

  // A chip shows when at least 40 % of its body is out from under panels.
  const shows = (p: Part) => {
    let seen = 0;
    for (let i = 0; i < 5; i += 1) for (let j = 0; j < 5; j += 1) {
      const x = p.x + ((i + 0.5) * p.w) / 5;
      const y = p.y + ((j + 0.5) * p.h) / 5;
      // A point between two panels only counts with some room around it.
      if (!obstacles.some((o) => x > o.x - 6 && x < o.x + o.w + 6 && y > o.y - 6 && y < o.y + o.h + 6)) seen += 1;
    }
    return seen >= 10;
  };

  // Module pages: the three feeds reach the board through one short bus, as
  // between two neighbouring chips: three side pins of the relay to three top
  // pins of the nearest chip, each wire with one 45° turn, nested so none
  // crosses another. The board's own buses then carry them further.
  const firstBus = (relay: Part) => {
    let best: { part: Part; index: number; wires: Route[]; length: number } | null = null;
    for (const part of parts) {
      if (part.id === undefined || !adjacency.has(part.id) || taken.has(part) || part.y + part.h / 2 < widgetTop) continue;
      const limit = Math.floor(part.ports.t.length / 2);
      for (let index = part.used.t; index + 3 <= limit; index += 1) {
        const tops = part.ports.t.slice(index, index + 3);
        for (const side of ["r", "l"] as const) {
          const outs = relay.ports[side];
          if (outs.length < 3) continue;
          const dir = side === "r" ? 1 : -1;
          if (dir * ((dir > 0 ? tops[0].x : tops[2].x) - outs[0].x) < 24 || tops[0].y - outs[2].y < 20) continue;
          // The upper pin turns down last (farthest pin), the lower one first.
          const order = dir > 0 ? [2, 1, 0] : [0, 1, 2];
          const wires = outs.map((o, w) => {
            const q = tops[order[w]];
            const turn = Math.min(8, (q.y - o.y) / 2);
            return polyline([o, P(q.x - dir * turn, o.y), P(q.x, o.y + turn), q]);
          });
          const length = Math.max(...wires.map((w) => w.length));
          if (length > 340 || (best && length >= best.length)) continue;
          if (wires.some((w) => !clear(w, part, relayArea, false))) continue;
          best = { part, index, wires, length };
        }
      }
    }
    // Or side by side, as the board's own buses between neighbours: three side
    // pins of the relay to three facing side pins of a chip, one 45° jog each.
    let side: { part: Part; key: "l" | "r"; index: number; wires: Route[]; length: number } | null = null;
    for (const part of parts) {
      if (part.id === undefined || !adjacency.has(part.id) || taken.has(part) || part.y + part.h / 2 < widgetTop - 60) continue;
      for (const out of ["r", "l"] as const) {
        const outs = relay.ports[out];
        const key = out === "r" ? "l" : "r";
        const ins = part.ports[key];
        if (outs.length < 3) continue;
        for (let index = part.used[key]; index + 3 <= ins.length; index += 1) {
          const wires = outs.map((o, w) => jogRoute(out === "r" ? o : ins[index + w], out === "r" ? ins[index + w] : o, "h"));
          if (wires.some((w) => !w)) continue;
          const routes = (out === "r" ? wires : wires.map((w) => reversed(w as Route))) as Route[];
          const length = Math.max(...routes.map((w) => w.length));
          if (length > 340 || (best && length >= best.length) || (side && length >= side.length)) continue;
          if (routes.some((w) => !clear(w, part, relayArea, false))) continue;
          side = { part, key, index, wires: routes, length };
        }
      }
    }
    if (side) {
      side.part.used[side.key] = side.index + 3;
      taken.add(side.part);
      side.wires.forEach((w, i) => board.add(i === 1 ? "bus" : "trace", w.d));
      return { wires: side.wires, to: side.part };
    }
    if (!best) return null;
    best.part.used.t = best.index + 3;
    taken.add(best.part);
    best.wires.forEach((w, i) => board.add(i === 1 ? "bus" : "trace", w.d));
    return { wires: best.wires, to: best.part };
  };

  const pick = (lead: Point[], want: -1 | 0 | 1, own: Box | null, span: [number, number], loose: boolean) => {
    const from = lead[lead.length - 1];
    let best: { part: Part; index: number; route: Route; score: number } | null = null;
    for (const part of parts) {
      if (part.id === undefined || !adjacency.has(part.id) || taken.has(part) || part.y + part.h / 2 < widgetTop) continue;
      const limit = Math.floor(part.ports.t.length / 2);
      for (let index = part.used.t; index < limit; index += 1) {
        const q = part.ports.t[index];
        const dx = q.x - from.x;
        // Side pins run outwards only; nothing doubles back under the relay.
        if (q.y - from.y < 24 || want * dx < 0 || q.x <= span[0] || q.x >= span[1]) continue;
        // The side feeds spread out about 220 px before they go down; the centre one stays close.
        const score = q.y - from.y + (want === 0 ? Math.abs(dx) * 1.6 : Math.abs(Math.abs(dx) - 220) * 0.8) +
          (options.hiddenCost ? (1 - visibleShare(polyline([from, q]), obstacles)) * Math.hypot(dx, q.y - from.y) * options.hiddenCost : 0);
        if (best && score >= best.score) continue;
        const route = polyline(square(lead, q, want !== 0));
        if (!clear(route, part, own, loose)) continue;
        best = { part, index, route, score };
      }
    }
    if (!best) return null;
    best.part.used.t = best.index + 1;
    taken.add(best.part);
    board.add("bus", best.route.d);
    return { route: best.route, to: best.part };
  };

  // Down the buses to a chip at the bottom, in the feed's own zone.
  const rows = parts.filter((p) => p.id !== undefined && adjacency.has(p.id) && p.y + p.h / 2 < bottomEdge + 120);
  const lowest = Math.max(...rows.map((p) => p.y + p.h / 2));
  const bottomRow = rows.filter((p) => p.y + p.h / 2 > lowest - 110);
  const shares = new Map<Route, number>();
  const used = new Set<string>();
  const key = (a: number, z: number) => (a < z ? `${a}-${z}` : `${z}-${a}`);
  const descend = (start: Part, zoneX: number) => {
    const hops: { route: Route; to: Part }[] = [];
    if (start.id === undefined) return hops;
    const dist = new Map<number, number>([[start.id, 0]]);
    const prev = new Map<number, { from: number; route: Route }>();
    const done = new Set<number>();
    const queue = [start.id];
    while (queue.length) {
      queue.sort((x, y) => (dist.get(x) ?? 0) - (dist.get(y) ?? 0));
      const node = queue.shift() as number;
      if (done.has(node)) continue;
      done.add(node);
      for (const edge of adjacency.get(node) ?? []) {
        if (!shares.has(edge.route)) shares.set(edge.route, visibleShare(edge.route, obstacles));
        const hidden = 1 - (shares.get(edge.route) ?? 0);
        const cost = edge.route.length * (options.hiddenCost ? 1 + options.hiddenCost * hidden : 1.6 - 0.6 * (1 - hidden)) + (used.has(key(node, edge.to)) ? 500 : 0);
        const d = (dist.get(node) ?? 0) + cost;
        if (d < (dist.get(edge.to) ?? Infinity)) {
          dist.set(edge.to, d);
          prev.set(edge.to, { from: node, route: edge.route });
          queue.push(edge.to);
        }
      }
    }
    const score = (p: Part) => (dist.get(p.id as number) ?? 0) + 1.5 * Math.abs(p.x + p.w / 2 - zoneX);
    // Module pages: the feed ends on a chip in sight, a few hops away, towards its side.
    const seen = options.visibleGoal
      ? rows.filter((p) => p !== start && p.id !== undefined && dist.has(p.id) && shows(p) && !used.has(`goal-${p.id}`))
        .sort((a, z) => score(a) - 0.9 * (a.y - start.y) - (score(z) - 0.9 * (z.y - start.y)))[0]
      : undefined;
    if (seen?.id !== undefined) used.add(`goal-${seen.id}`);
    if (options.visibleGoal && !seen && shows(start)) return hops;
    const goal = seen ?? bottomRow.filter((p) => p.id !== undefined && dist.has(p.id)).sort((a, z) => score(a) - score(z))[0];
    if (!goal || goal.id === undefined) return hops;
    for (let node = goal.id; node !== start.id; node = (prev.get(node) as { from: number }).from) {
      const step = prev.get(node) as { from: number; route: Route };
      used.add(key(step.from, node));
      hops.unshift({ route: step.route, to: parts[node] });
    }
    return hops;
  };

  const chipGlow = (p: Box) => ({ x: p.x - 4, y: p.y - 4, w: p.w + 8, h: p.h + 8 });
  const linkGlow = { x: link.x - 3, y: link.y - 3, w: link.w + 6, h: link.h + 6, over: true };
  const width = Math.max(...obstacles.map((o) => o.x + o.w));
  const zones = [width * 0.15, pins[1], width * 0.85];
  const envGlow = envLink ? { x: envLink.x - 3, y: envLink.y - 3, w: envLink.w + 6, h: envLink.h + 6 } : null;
  type Leg = { route: Route; glow: Box & { over?: boolean }; rest: number };
  const branches: Leg[][] = [];
  // Sides first; the centre feed then lands between them.
  const span: [number, number] = [-Infinity, Infinity];
  let bus: ReturnType<typeof firstBus> = null;
  if (options.spots) {
    // The input bus must keep clear of text, controls and visible parts.
    const intoClear = (w: Route) => {
      const [a, z] = [w.points[0], w.points[w.points.length - 1]];
      return !samples(w).some((p) => Math.hypot(p.x - a.x, p.y - a.y) > 6 && Math.hypot(p.x - z.x, p.y - z.y) > 6 &&
        (routeKeepout.some((k) => inside(p, k, 4)) || (!isHidden(p, obstacles) && parts.some((part) => inside(p, part, 3)))));
    };
    for (const spot of options.spots) {
      const mark = LAYERS.map((l) => board.layers[l].length);
      const usedPins = parts.map((part) => ({ ...part.used }));
      ({ relay, relayArea, into } = placeRelay(spot.dx, spot.top));
      relays.length = 0;
      relays.push(relayArea);
      const onPart = parts.some((part) => overlaps(relayArea, { x: part.x - 6, y: part.y - 6, w: part.w + 12, h: part.h + 12 }));
      if (!onPart && into.every(intoClear)) bus = firstBus(relay);
      if (bus) {
        into.forEach((w, k) => board.add(k === 1 ? "bus" : "trace", w.d));
        break;
      }
      LAYERS.forEach((l, i) => (board.layers[l].length = mark[i]));
      parts.forEach((part, i) => (part.used = usedPins[i]));
      taken.clear();
      relays.length = 0;
    }
    if (!bus) return null;
  }
  for (const k of [0, 2, 1]) {
    const legs: Leg[] = [{ route: polyline(heroPaths[k]), glow: linkGlow, rest: 0.3 }];
    if (down[k] && envGlow) legs.push({ route: down[k], glow: envGlow, rest: 0.3 });
    legs.push({ route: into[k], glow: chipGlow(relay), rest: STOP });
    // Left by the relay's left pin, centre by a bottom pin, right by its right pin.
    const lead = k === 0
      ? [relay.ports.l[0], P(relay.ports.l[0].x - 8, relay.ports.l[0].y)]
      : k === 1
        ? [relay.ports.b[0], P(relay.ports.b[0].x, relay.ports.b[0].y + 6)]
        : [relay.ports.r[0], P(relay.ports.r[0].x + 8, relay.ports.r[0].y)];
    const out = bus ? { route: bus.wires[k], to: bus.to } :
      drop(lead, k === 0 ? -1 : k === 1 ? 0 : 1, relayArea, k === 1 ? [span[0] + 10, span[1] - 10] : [-Infinity, Infinity]);
    if (!out) return null;
    const landed = out.route.points[out.route.points.length - 1].x;
    if (k === 0) span[0] = landed;
    if (k === 2) span[1] = landed;
    if (!bus) via(board, lead[1].x, lead[1].y, 1.8);
    legs.push({ route: out.route, glow: chipGlow(out.to), rest: STOP });
    const reached = out.to;
    for (const hop of descend(reached, zones[k])) legs.push({ route: hop.route, glow: chipGlow(hop.to), rest: STOP });
    branches[k] = legs;
  }

  // One speed for the three feeds, so a trip lasts about TRIP seconds; the
  // feeds leave a third of a cycle apart, so two or three travel at once.
  const speed = Math.min(360, Math.max(150, ...branches.map((legs) => {
    const length = legs.reduce((sum, leg) => sum + leg.route.length, 0);
    const rests = legs.reduce((sum, leg) => sum + leg.rest, 0);
    return length / Math.max(4, (options.schedule?.trip ?? TRIP) - rests - STOP);
  })));
  const runs = branches.map((legs) => {
    let t = STOP;
    const hops: Journey["hops"] = [];
    const glows: Journey["glows"] = [{ ...chipGlow(chip), start: 0, end: STOP }];
    for (const leg of legs) {
      const end = t + leg.route.length / speed;
      hops.push({ ...leg.route, start: t, end });
      glows.push({ ...leg.glow, start: end, end: end + leg.rest });
      t = end + leg.rest;
    }
    return { hops, glows, length: t };
  });
  // A module page imposes its cycle, so the feeds leave right after its hero's pulses.
  const cycle = options.schedule?.cycle ?? Math.max(...runs.map((r) => r.length)) + 1;
  const start = options.schedule?.start ?? 0;
  // Three cycles per period: the right feed turns amber on the third one only.
  const period = 3 * cycle;
  const tones: Tone[] = ["cyan", "blue", "white"];
  const journeys: Journey[] = [];
  for (let c = 0; c < 3; c += 1) {
    runs.forEach((run, k) => {
      journeys.push({
        tone: k === 2 && c === 2 ? "amber" : tones[k],
        rare: false,
        period,
        delay: start + c * cycle + (k * cycle) / 3 - period,
        hops: run.hops,
        glows: run.glows,
      });
    });
  }
  return { journeys, envLink };
}

/* A module page's feed: no environment card, relay right below the connector. */
export function moduleFeed(module: ModuleFeed, board: Builder, parts: Part[], links: Link[], obstacles: Rect[], widgetTop: number) {
  const drawn = LAYERS.map((layer) => board.layers[layer].length);
  const usedPins = parts.map((part) => ({ ...part.used }));
  const routed = feedJourneys(board, parts, links, obstacles, module.link, module.heroPaths, module.chip, null,
    { keepout: module.keepout }, widgetTop, { relayTop: module.relayTop, routeKeepout: module.keepout, schedule: module.schedule, hiddenCost: 3, visibleGoal: true, spots: module.spots });
  if (routed) return routed.journeys;
  LAYERS.forEach((layer, i) => (board.layers[layer].length = drawn[i]));
  parts.forEach((part, i) => (part.used = usedPins[i]));
  return null;
}
