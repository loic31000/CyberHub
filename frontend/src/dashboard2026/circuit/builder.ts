import { moduleFeed } from "./feeds";
import { elbowRoute, overlaps, polyline, r1, random, rectPath } from "./geometry";
import { heroCircuit } from "./hero";
import { bga, builder, crystal, electrolytic, emptyPart, header, qfp, satellites, slot, smd, soic, takePorts, via, wireBus, type Zone } from "./parts";
import { isHidden, planJourneys, visibleShare } from "./routing";
import { BAR, BEAT } from "./timing";
import { LAYERS, type BoardLayer, type Box, type CircuitGeometry, type HeroAnchor, type Link, type ModuleFeed, type Part, type Point, type Rect, type Route, type Side } from "./types";

/* buildBoard: the whole board for a page size and its obstacles. Pure: no DOM, no clock. */

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
  widgetTop = Math.min(...obstacles.filter((o) => o.role === "widget").map((o) => o.y), height),
  module: ModuleFeed | null = null,
): Omit<CircuitGeometry, "revision"> {
  const compact = width < 760;
  const S = compact ? 150 : 172;
  const k = S / 196;
  const cols = Math.max(1, Math.ceil(width / S));
  const ox = (width - cols * S) / 2;
  // Keep the hero's first chip row fixed when widget visibility changes the
  // document height. Otherwise the processor's connector loses its source.
  const oy = anchor ? anchor.hero.y + anchor.hero.h + 44 - 1.5 * S : (height - Math.ceil(height / S) * S) / 2;
  const rows = Math.max(1, Math.ceil((height - oy) / S));
  const b = builder();
  const globe = obstacles.find((o) => o.globe);
  const firstWidget = widgetTop;
  const connectorX = anchor ? anchor.band.x + 0.739 * anchor.band.w : null;
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
    // These isolated power strips have no signal route. Leave the hero's
    // approach clear instead of drawing an ornamental rail below it.
    if ((anchor && y < firstWidget) || module) continue;
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
      // The open bands stay clear. One package directly below the hero remains
      // as the source for the three routed feeds through the environment panel.
      const connectorRow = anchor && !anchor.feeds &&
        cy >= anchor.hero.y + anchor.hero.h &&
        cy < anchor.hero.y + anchor.hero.h + S * 0.36 &&
        connectorX !== null && Math.abs(cx - connectorX) <= S * 0.65;
      // Nor does a part sit on the widget bar's label or button (its pins reach about 60 px).
      const onToolbar = !!anchor?.feeds?.keepout.some((k) => overlaps({ x: cx - 60, y: cy - 60, w: 120, h: 120 }, k));
      const onModuleText = !!module?.avoid?.some((k) => overlaps({ x: cx - 52, y: cy - 52, w: 104, h: 104 }, k));
      if ((anchor && cy < firstWidget && !connectorRow) || onToolbar || (module && cy < module.clearAbove) || onModuleText) {
        zones[r].push({ part: null });
        continue;
      }
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

  // Module pages: no bus passes across readable text or a control.
  const acrossText = module?.avoid ? (route: Route) => route.points.slice(1).some((z, i) => {
    const a = route.points[i];
    const n = Math.max(1, Math.round(Math.hypot(z.x - a.x, z.y - a.y) / 6));
    for (let t = 0; t <= n; t += 1) {
      const x = a.x + ((z.x - a.x) * t) / n;
      const y = a.y + ((z.y - a.y) * t) / n;
      if (module.avoid?.some((k) => x > k.x && x < k.x + k.w && y > k.y && y < k.y + k.h)) return true;
    }
    return false;
  }) : undefined;

  // Buses between neighbouring components: right neighbour, then the one below.
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const zone = zones[r][c];
      if (!zone.part) continue;
      const rnd = random(((c + 11) * 2654435761) ^ ((r + 5) * 40503));
      // Right neighbour, or the next chip along the row when a zone holds no chip.
      // Module pages link direct neighbours only: a bus over an empty zone reads as a rail.
      const right = zones[r][c + 1]?.part ?? (!module && zones[r][c + 1] && zones[r][c + 2]?.part) ?? null;
      if (right && rnd() < 0.95) {
        const from = takePorts(zone.part, "r", 2 + Math.floor(rnd() * 3));
        wireBus(b, links, from, takePorts(right, "l", from.length), "h", zone.part, right, acrossText);
      }
      const below = zones[r + 1]?.[c]?.part ?? (!module && zones[r + 1]?.[c] && zones[r + 2]?.[c]?.part) ?? null;
      if (below && rnd() < 0.85) {
        const from = takePorts(zone.part, "b", 2 + Math.floor(rnd() * 3));
        wireBus(b, links, from, takePorts(below, "t", from.length), "v", zone.part, below, acrossText);
      }
      // Diagonal neighbour: an elbow cable from a right pin down to a top pin.
      const diagonal = zones[r + 1]?.[c + 1]?.part;
      if (diagonal && rnd() < 0.45) {
        const [a] = takePorts(zone.part, "r", 1);
        const [z] = takePorts(diagonal, "t", 1);
        const route = a && z ? elbowRoute(a, z) : null;
        if (route && !acrossText?.(route)) {
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
  const hero = anchor && !compact ? heroCircuit(anchor, b, parts, links, obstacles, firstWidget) : null;
  // A module page's processor drives the board the same way, through its own connector.
  const fed = !hero && module && !compact ? moduleFeed(module, b, parts, links, obstacles, firstWidget) : null;
  const journeys = hero?.journeys ?? fed ?? planJourneys(links, parts, obstacles, compact, hub);
  const layers = Object.fromEntries(LAYERS.map((l) => [l, b.layers[l].join("")])) as Record<BoardLayer, string>;
  // FNV-1a over the drawing: journeys may change (a panel collapses) without redrawing the board.
  let hash = 0x811c9dc5;
  for (const layer of LAYERS) {
    const d = layers[layer];
    for (let i = 0; i < d.length; i += 1) hash = Math.imul(hash ^ d.charCodeAt(i), 0x01000193);
  }
  const heartbeat =
    !hero?.journeys && !fed && hubBox && !isHidden({ x: hubBox.x + hubBox.w / 2, y: hubBox.y + hubBox.h / 2 }, obstacles)
      ? { ...hubBox, period: BAR * BEAT, beats: [0, 6] }
      : null;
  return {
    width,
    height,
    widgetTop,
    obstacles,
    layers,
    journeys,
    heartbeat,
    hero: hero?.board ?? null,
    boardKey: `${width}x${height}-${(hash >>> 0).toString(36)}`,
    fed: !!fed,
  };
}
