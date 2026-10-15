import { fx, pct, TAILS } from "./animations";
import type { Journey } from "./types";

/*
 * One LED and one pair of tails per journey instead of per hop (variant B).
 *
 * Today each hop has its own LED and tails, all running for the journey's whole
 * period while at most one of them shows: the browser updates ~190 animated
 * elements per frame to draw about fifteen. Here:
 * - the LED rides one path concatenating the journey's hops, each preceded by
 *   an off-screen spacer; offset-distance counts every subpath, so a pixel
 *   distance on the merged path is a point of one hop;
 * - a dash pattern restarts at each subpath, so the tails cannot share that
 *   path: each tail switches its own path (CSS `d`, a discrete property) to the
 *   active hop when the hop starts, and dashes it in that hop's pixels.
 * Windows, fades and linear travel are the per-hop keyframes' own; lengths are
 * measured by the browser, so LED and tails sit where the per-hop ones did.
 * Without CSS `d` animation (WebKit), the board keeps the per-hop rendering.
 */

const SPACER = 120; // px, longer than any tail
const SPACER_D = `M-4000 -4000h${SPACER}`;

export type MergedJourney = { d: string; hops: { from: number; length: number; a: number; z: number }[] };

const SVG = "http://www.w3.org/2000/svg";

/* Exact path lengths as the browser computes them (the same ones offset-distance and dashes use). */
export function domPathLengths(ds: string[]): number[] {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden");
  const path = document.createElementNS(SVG, "path");
  svg.append(path);
  document.body.append(svg);
  try {
    return ds.map((d) => { path.setAttribute("d", d); return path.getTotalLength() });
  } finally {
    svg.remove();
  }
}

export function mergeJourneys(journeys: Journey[], lengthsOf: (ds: string[]) => number[] = domPathLengths): MergedJourney[] {
  const lengths = lengthsOf(journeys.flatMap((j) => j.hops.map((h) => h.d)));
  let k = 0;
  return journeys.map((j) => {
    let d = "";
    let at = 0;
    const hops = j.hops.map((h) => {
      d += SPACER_D;
      at += SPACER;
      const length = lengths[k++];
      const hop = { from: at, length, a: pct(h.start, j.period), z: pct(h.end, j.period) };
      d += h.d;
      at += length;
      return hop;
    });
    return { d, hops };
  });
}

/* Per hop, the window, fades and linear travel of the per-hop keyframes (journeyKeyframes). */
export function mergedKeyframes(journeys: Journey[], merged: MergedJourney[]) {
  let css = "";
  merged.forEach((m, ji) => {
    const j = journeys[ji];
    if (!m.hops.length) return;
    const led: string[] = [];
    const tails = TAILS.map(() => [] as string[]);
    let prevEnd = m.hops[0].from;
    m.hops.forEach((h, hi) => {
      const e = Math.min(0.8, (h.z - h.a) / 5);
      const start = h.from, end = h.from + h.length;
      // Hold the previous position, then jump (invisible) to this hop's start.
      led.push(`${fx(Math.max(0, h.a - 0.001))}%{offset-distance:${fx(hi ? prevEnd : start)}px;opacity:0}`);
      led.push(`${fx(h.a)}%{offset-distance:${fx(start)}px;opacity:0}`, `${fx(h.a + e)}%{opacity:1}`, `${fx(h.z - e)}%{opacity:1}`, `${fx(h.z)}%{offset-distance:${fx(end)}px;opacity:0}`);
      TAILS.forEach(({ px }, ti) => {
        const len = Math.min(0.5, px / j.hops[hi].length) * h.length; // the per-hop tail, in px
        const shape = `d:path("${j.hops[hi].d}");stroke-dasharray:${fx(len)} 1000000`;
        // The path switches to this hop just before it starts (a discrete property flips
        // mid-interval: the two keyframes are 0.001 % apart). Leading edge on the LED.
        tails[ti].push(`${fx(Math.max(0, h.a - 0.001))}%{${shape};stroke-dashoffset:${fx(len)};opacity:0}`);
        tails[ti].push(`${fx(h.a)}%{${shape};stroke-dashoffset:${fx(len)};opacity:0}`, `${fx(h.a + e)}%{opacity:1}`, `${fx(h.z - e)}%{opacity:1}`, `${fx(h.z)}%{${shape};stroke-dashoffset:${fx(len - h.length)};opacity:0}`);
      });
      prevEnd = end;
    });
    // Names start with cbd / cbt: the engine's start-time alignment (/^cb[dtg]/) covers them.
    css += `@keyframes cbdm${ji}{0%{offset-distance:${fx(m.hops[0].from)}px;opacity:0}${led.join("")}100%{offset-distance:${fx(prevEnd)}px;opacity:0}}`;
    TAILS.forEach(({ px }, ti) => {
      const len0 = Math.min(0.5, px / j.hops[0].length) * m.hops[0].length;
      css += `@keyframes cbtm${ji}-${ti}{0%{d:path("${j.hops[0].d}");stroke-dasharray:${fx(len0)} 1000000;stroke-dashoffset:${fx(len0)};opacity:0}${tails[ti].join("")}100%{opacity:0}}`;
    });
  });
  return css;
}

/*
 * Can this browser animate an SVG path's `d` from CSS? Measured, not detected:
 * a hidden path is animated between two shapes, frozen near the end, and its
 * actual length read back. Chromium and Firefox: yes; WebKit: no (the property
 * is ignored). Computed once.
 */
let pathAnimation: boolean | undefined;
export function supportsPathAnimation(): boolean {
  if (pathAnimation !== undefined) return pathAnimation;
  pathAnimation = false;
  try {
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden");
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", "M0 0h10");
    svg.append(path);
    document.body.append(svg);
    try {
      const a = path.animate([{ d: 'path("M0 0h10")' }, { d: 'path("M0 0h30")' }], { duration: 1000, fill: "both" });
      a.pause();
      a.currentTime = 900;
      // Two shapes with the same commands interpolate (28 px at 90 %): any animated length counts.
      // Unsupported, the path keeps its attribute (10 px).
      const length = path.getTotalLength();
      pathAnimation = length > 20 && length <= 30;
      a.cancel();
    } finally {
      svg.remove();
    }
  } catch {
    pathAnimation = false; // no Web Animations or no SVG geometry (tests): per-hop rendering
  }
  return pathAnimation;
}
