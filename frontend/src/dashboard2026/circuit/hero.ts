import { feedJourneys } from "./feeds";
import { distance, from, jogRoute, pointsOf, polyline, r1, rectPath, roundRectPath, type Segment } from "./geometry";
import { bga, builder, crystal, qfp, relayChip, smd, soic, takePorts, via, type Builder } from "./parts";
import { busGraph, isHidden, tour, TOUR_HOPS, type TourHop } from "./routing";
import { BEAT, type Tone } from "./timing";
import { LAYERS, type BoardLayer, type Box, type EnvironmentLink, type HeroAnchor, type HeroBoard, type HeroLink, type Journey, type Link, type Part, type Point, type Rect, type Route, type Side } from "./types";

/* The hero processor, its small board and the link connector astride the hero's lower edge. */

const HERO_SPEED = 110; // px per second, before snapping to the beat

type BoardLine = { rest: Point[]; part: Part; port: Point; fresh: boolean };

/*
 * The hero redrawn with the board's own primitives. The CH processor feeds a
 * small link connector astride the hero's lower edge; the connector sits on
 * board traces that already run up under the hero, so a signal leaves CH,
 * enters the connector, and continues on the board's own copper.
 */
export function heroCircuit(anchor: HeroAnchor, board: Builder, parts: Part[], links: Link[], obstacles: Rect[], areaTop: number) {
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
  if (!bundle.length && !anchor.feeds) {
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

  // With its own feeds the connector is CH's: three pins under the processor.
  const xs = anchor.feeds ? [-7, 0, 7].map((d) => chipCentre + d) : bundle.map((l) => l.rest[0].x);
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

  // Three real traces carry the bundle behind the environment card. A second
  // raised connector marks their exit below that card before the signal enters
  // the lower motherboard. Each CH journey takes one of these exact routes.
  const env = obstacles.find((obstacle) => obstacle.role === "env");
  if (anchor.feeds && link && env) {
    const drawn = LAYERS.map((layer) => board.layers[layer].length);
    const usedPins = parts.map((part) => ({ ...part.used }));
    const routed = feedJourneys(board, parts, links, obstacles, link, heroPaths, chip, env, anchor.feeds, areaTop);
    if (!routed) {
      LAYERS.forEach((layer, i) => (board.layers[layer].length = drawn[i]));
      parts.forEach((part, i) => (part.used = usedPins[i]));
    }
    if (routed) {
      const layers = Object.fromEntries(LAYERS.map((l) => [l, b.layers[l].join("")])) as Record<BoardLayer, string>;
      return {
        board: { ...hero, layers, chip, link, envLink: routed.envLink, board: anchor.board } as HeroBoard,
        journeys: routed.journeys,
      };
    }
  }
  const source = bundle[0]?.part;
  const target = env && source ? parts
    .filter((part) => part !== source && part.y > env.y + env.h + 55 && part.ports.t.length >= bundle.length)
    .sort((a, z) =>
      Math.abs(a.x + a.w / 2 - (source.x + source.w / 2)) + (a.y - env.y - env.h) * 0.4 -
      (Math.abs(z.x + z.w / 2 - (source.x + source.w / 2)) + (z.y - env.y - env.h) * 0.4))[0] : null;
  const nearest = (ports: Point[], x: number, count: number) =>
    [...ports].sort((a, z) => Math.abs(a.x - x) - Math.abs(z.x - x)).slice(0, count).sort((a, z) => a.x - z.x);
  const sourcePins = source ? nearest(source.ports.b, source.x + source.w / 2, bundle.length) : [];
  const targetPins = target ? nearest(target.ports.t, target.x + target.w / 2, bundle.length) : [];
  const adjacency = busGraph(links);
  const envLink: EnvironmentLink | null = env && source && target && link && bundle.length >= 2 &&
    sourcePins.length === bundle.length && targetPins.length === bundle.length
    ? {
        x: (sourcePins[0].x + sourcePins[sourcePins.length - 1].x) / 2 - 26,
        y: env.y + env.h - 7,
        w: 52,
        h: 15,
        pins: sourcePins.map((pin) => pin.x),
        top: env.y + env.h - 13,
        bottom: env.y + env.h + 14,
      }
    : null;
  // In the open band between the environment card and the widgets, the three
  // feeds land on a visible relay chip that splits them: a short trunk straight
  // down and two 45° branches towards the chips on either side.
  const widgetTop = Math.min(...obstacles.filter((o) => o.role === "widget").map((o) => o.y));
  const relay = envLink && target && Number.isFinite(widgetTop) && widgetTop - envLink.bottom >= 44
    ? relayChip(board, envLink, Math.min(envLink.bottom + 22, widgetTop - 20))
    : null;
  const midIndex = Math.floor(bundle.length / 2);
  const bridge = envLink ? bundle.map((_, index) => {
    const pinX = envLink.pins[index];
    const upper = polyline([sourcePins[index], P(pinX, envLink.top)]);
    const lower = relay
      ? polyline([P(pinX, envLink.bottom), relay.ports.t[index]])
      : jogRoute(P(pinX, envLink.bottom), targetPins[index], "v") ??
        polyline([P(pinX, envLink.bottom), P(pinX, targetPins[index].y - 12), P(targetPins[index].x, targetPins[index].y - 12), targetPins[index]]);
    board.add(index === midIndex ? "bus" : "trace", upper.d);
    board.add(index === midIndex ? "bus" : "trace", lower.d);
    return { upper, lower };
  }) : [];
  // Relay outputs: [left branch, trunk, right branch]; a missing side falls back to the trunk.
  const outputs: { route: Route; to: Part }[] = [];
  if (relay && target) {
    const trunkPins = nearest(target.ports.t, relay.x + relay.w / 2, 2);
    const trunk = relay.ports.b.map((pin, i) => {
      const end = trunkPins[i] ?? trunkPins[0];
      const route = jogRoute(pin, end, "v") ?? polyline([pin, P(pin.x, end.y - 14), P(end.x, end.y - 14), end]);
      board.add(i === 0 ? "bus" : "trace", route.d);
      return route;
    });
    const side = (dir: -1 | 1) => {
      const a = dir < 0 ? relay.ports.l[0] : relay.ports.r[0];
      // Leave the pin, then dive at 45° under the widget row's top edge.
      const out = P(a.x + dir * 10, a.y);
      const dive = widgetTop + 18 - a.y;
      const low = P(out.x + dir * dive, a.y + dive);
      const candidate = parts
        .filter((part) => part !== target && part.id !== undefined && adjacency.has(part.id) &&
          part.y > low.y + 30 && part.ports.t.length / 2 > part.used.t &&
          dir * (part.x + part.w / 2 - low.x) > 40 && dir * (part.x + part.w / 2 - low.x) < 3 * 172)
        .sort((x, z) => x.y - z.y + 0.5 * (Math.abs(x.x - low.x) - Math.abs(z.x - low.x)))[0];
      if (!candidate) return null;
      const [pin] = takePorts(candidate, "t", 1);
      if (!pin || dir * (pin.x - low.x) < 14 || pin.y - low.y < 30) return null;
      const route = polyline([a, out, low, P(pin.x - dir * 12, low.y), P(pin.x, low.y + 12), pin]);
      board.add("bus", route.d);
      via(board, out.x, out.y, 2);
      return { route, to: candidate };
    };
    const left = side(-1);
    const right = side(1);
    const down = { route: trunk[0], to: target };
    outputs.push(left ?? down, down, right ?? down);
  }

  // Signals run from CH through both connectors and then visit the lower board.
  const visited = new Set<number>();
  const chipGlow = (p: Box) => ({ x: p.x - 4, y: p.y - 4, w: p.w + 8, h: p.h + 8 });
  const plans: { hops: TourHop[]; seed: Box; fromCh: boolean }[] = [];
  if (link) {
    bundle.forEach((line, k) => {
      const hops: TourHop[] = [
        { route: polyline(heroPaths[k]), to: null },
        { route: polyline(line.rest), to: line.part },
      ];
      if (envLink && target && bridge[k]) {
        hops.push({ route: bridge[k].upper, to: null, connector: envLink });
        // Through the relay chip: in by a top pin, out by a side or bottom pin.
        const out = relay ? outputs[bundle.length === 3 ? k : k * 2] : null;
        hops.push({ route: bridge[k].lower, to: relay ?? target });
        if (out) hops.push(out);
        const next = out?.to ?? target;
        if (next.id !== undefined) {
          // Each feed carries on down the board. When the other feeds already
          // covered its neighbourhood, it revisits chips rather than stopping short.
          let rest = tour(adjacency, parts, next.id, visited, TOUR_HOPS);
          if (rest.length < 6) rest = tour(adjacency, parts, next.id, new Set(), TOUR_HOPS);
          for (const hop of rest) if (hop.to?.id !== undefined) visited.add(hop.to.id);
          hops.push(...rest);
        }
      } else if (line.part.id !== undefined) {
        hops.push(...tour(adjacency, parts, line.part.id, visited, TOUR_HOPS));
      }
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
    hops.forEach(({ route, to, connector }, i) => {
      const travel = Math.max(1, Math.round(route.length / HERO_SPEED / BEAT));
      out.push({ ...route, start: beat * BEAT, end: (beat + travel) * BEAT });
      beat += travel;
      const box = to ? chipGlow(to) : connector ? chipGlow(connector) : link
        ? { x: link.x - 3, y: link.y - 3, w: link.w + 6, h: link.h + 6, over: true }
        : chipGlow(chip);
      const rest = to || connector ? 1 : 1.5;
      glows.push({ ...box, start: beat * BEAT, end: (beat + rest) * BEAT });
      if (i < hops.length - 1) beat += rest;
    });
    return { hops: out, glows, beats: beat + 1 };
  });

  // Three lanes: tours follow each other, so three signals travel at once at
  // most and every connected chip is visited once per period (about a minute).
  // CH's feeds leave a few beats apart, so they read as one signal after another.
  const lanes = link ? [0, 3, 6] : [0, 0, 0];
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
  return { board: { ...hero, layers, chip, link, envLink, board: anchor.board } as HeroBoard, journeys: journeys.length ? journeys : null };
}
