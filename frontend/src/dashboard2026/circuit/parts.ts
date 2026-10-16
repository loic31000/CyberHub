import { circlePath, jogRoute, r1, rectPath, roundRectPath } from "./geometry";
import { LAYERS, type BoardLayer, type Link, type Part, type Point, type Route, type Side } from "./types";

/* The board generator's parts: a path builder, electronic components and the buses between pins. */

export type Builder = { layers: Record<BoardLayer, string[]>; add: (layer: BoardLayer, d: string) => void };

export function builder(): Builder {
  const layers = Object.fromEntries(LAYERS.map((l) => [l, [] as string[]])) as Record<BoardLayer, string[]>;
  return { layers, add: (layer, d) => layers[layer].push(d) };
}

export function emptyPart(x: number, y: number, w: number, h: number): Part {
  return { x, y, w, h, ports: { l: [], r: [], t: [], b: [] }, used: { l: 0, r: 0, t: 0, b: 0 } };
}

export function via(b: Builder, x: number, y: number, r = 2.6) {
  b.add("via", circlePath(x, y, r));
  b.add("hole", circlePath(x, y, r * 0.42));
}

/* Quad flat package: body, die, pins on four sides, pin-one mark. */
export function qfp(b: Builder, cx: number, cy: number, size: number, pins: number, core = false) {
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

/*
 * Relay chip below the environment card: its top pins sit exactly under the
 * connector's pins, two bottom pins feed the trunk, one pin on each side feeds
 * a branch. Not part of the bus graph: journeys cross it explicitly.
 */
export function relayChip(b: Builder, link: { pins: number[] }, top: number, sidePins = 1) {
  const pinLen = 5;
  const left = Math.min(...link.pins);
  const right = Math.max(...link.pins);
  const w = Math.max(40, right - left + 26);
  const h = 16;
  const cx = (left + right) / 2;
  const x = cx - w / 2;
  const y = top + pinLen;
  const part = emptyPart(x, y, w, h);
  b.add("shadow", roundRectPath(x + 3, y + 4, w, h, 3));
  b.add("body", roundRectPath(x, y, w, h, 3));
  b.add("die", roundRectPath(x + 6, y + 4, w - 12, h - 8, 2));
  b.add("mark", circlePath(x + 4.5, y + 4.5, 1.3));
  for (const px of link.pins) {
    b.add("pin", rectPath(px - 1, top, 2, pinLen));
    part.ports.t.push({ x: px, y: top });
  }
  for (const px of [cx - 4, cx + 4]) {
    b.add("pin", rectPath(px - 1, y + h, 2, pinLen));
    part.ports.b.push({ x: px, y: y + h + pinLen });
  }
  const sideY = sidePins === 3 ? [y + 3, y + h / 2, y + h - 3] : [y + h / 2];
  for (const py of sideY) {
    b.add("pin", rectPath(x - pinLen, py - 1, pinLen, 2));
    b.add("pin", rectPath(x + w, py - 1, pinLen, 2));
    part.ports.l.push({ x: x - pinLen, y: py });
    part.ports.r.push({ x: x + w + pinLen, y: py });
  }
  return part;
}

/* Ball grid array: escape routing leaves from the body edges. */
export function bga(b: Builder, cx: number, cy: number, size: number, n: number) {
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
export function soic(b: Builder, cx: number, cy: number, w: number, pins: number) {
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
export function header(b: Builder, cx: number, cy: number, count: number, vertical: boolean) {
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
export function slot(b: Builder, cx: number, cy: number, w: number) {
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
export function smd(b: Builder, cx: number, cy: number, vertical: boolean, long = 9) {
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

export function electrolytic(b: Builder, cx: number, cy: number, r: number) {
  b.add("shadow", circlePath(cx + 2, cy + 3, r));
  b.add("body", circlePath(cx, cy, r));
  b.add("die", circlePath(cx, cy, r * 0.62));
  b.add("mark", `M${r1(cx - r * 0.72)} ${r1(cy - r * 0.55)}A${r1(r * 0.9)} ${r1(r * 0.9)} 0 0 1 ${r1(cx + r * 0.72)} ${r1(cy - r * 0.55)}`);
}

export function crystal(b: Builder, cx: number, cy: number) {
  b.add("body", roundRectPath(cx - 11, cy - 4.5, 22, 9, 4.5));
  b.add("pad", rectPath(cx - 14, cy - 2, 3, 4));
  b.add("pad", rectPath(cx + 11, cy - 2, 3, 4));
}

/* Decoupling passives above a component, wired to its last top pins. */
export function satellites(b: Builder, part: Part, rnd: () => number) {
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

export function takePorts(part: Part, side: Side, count: number) {
  const ports = part.ports[side];
  const start = part.used[side];
  // Bus ports come from the first half of the top side; satellites use its end.
  const limit = side === "t" ? Math.floor(ports.length / 2) : ports.length;
  const picked = ports.slice(start, Math.min(start + count, limit));
  part.used[side] = start + picked.length;
  return picked;
}

export type Zone = { part: Part | null };

export function wireBus(b: Builder, links: Link[], from: Point[], to: Point[], axis: "h" | "v", a: Part, z: Part, reject?: (route: Route) => boolean) {
  const middle = Math.floor((from.length - 1) / 2);
  from.forEach((port, i) => {
    const target = to[i];
    if (!target) return;
    const route = jogRoute(port, target, axis);
    if (!route || reject?.(route)) return;
    b.add(i === middle ? "bus" : "trace", route.d);
    if (i === middle && a.id !== undefined && z.id !== undefined) links.push({ route, a: a.id, b: z.id });
  });
}
