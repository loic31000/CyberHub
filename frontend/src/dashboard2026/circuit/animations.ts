import { BEAT } from "./timing";
import type { CircuitGeometry, Heartbeat, Journey } from "./types";

/* CSS keyframes of the journeys and the heartbeat, and the calm ramp under the globe. */

export const TAILS = [
  { px: 14, cls: "is-near" },
  { px: 30, cls: "is-far" },
];

const pct = (t: number, period: number) => Math.min(100, Math.max(0, (t / period) * 100));

export const fx = (v: number) => v.toFixed(3);

/*
 * One set of keyframes per journey, generated once per geometry: the LED is
 * only visible while it travels a hop, the tails follow it along the trace
 * (corners included), and the receiving chip glows while the LED is inside.
 */
export function journeyKeyframes(journeys: Journey[]) {
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
export function heartbeatKeyframes(h: Heartbeat | null) {
  if (!h) return "";
  const steps = h.beats
    .map((beat) => {
      const a = pct(beat * BEAT, h.period);
      return `${fx(a)}%{opacity:0.9}${fx(Math.min(100, a + pct(0.55, h.period)))}%{opacity:0}`;
    })
    .join("");
  return `@keyframes cbhub{0%{opacity:0}${steps}100%{opacity:0}}`;
}

export const animation = (name: string, j: Journey) => `${name} ${j.period.toFixed(2)}s linear ${j.delay.toFixed(2)}s infinite`;

/*
 * Calm ramp: one smooth vertical fade instead of bands with visible edges. The
 * board is quiet above the hero and between the hero, the environment cards
 * and the widgets, then comes back to full strength progressively behind the
 * widgets. Under the hero, the bundle feeding the link connector stays bright,
 * its column fading out sideways.
 */
export function calmRamp(g: CircuitGeometry) {
  const hero = g.obstacles.find((o) => o.role === "hero");
  const env = g.obstacles.find((o) => o.role === "env");
  if (!hero || !env) return null;
  const top = g.widgetTop;
  // Calm above the hero; the gutters keep the network readable (the connector's
  // column stays at full strength) so the path CH -> environment -> widgets reads
  // as one board; full strength behind the widgets.
  const stops = [
    { y: 0, level: 0.45 },
    { y: hero.y + hero.h, level: 0.7 },
    { y: env.y + env.h, level: 0.85 },
    { y: top + 40, level: 0.92 },
    { y: top + 220, level: 1 },
  ].map(({ y, level }) => ({ offset: Math.min(1, Math.max(0, y / g.height)), level }));
  const link = g.hero?.link;
  const keep = link ? { x: link.x - 24, w: link.w + 48, y: hero.y + hero.h - 2, h: env.y - hero.y - hero.h + 4 } : null;
  return { stops, keep };
}
