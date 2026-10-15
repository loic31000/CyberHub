import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { animation, fx, TAILS } from "./animations";
import { hopIn, overlaps, r1 } from "./geometry";
import type { MergedJourney } from "./merged";
import { LAYERS, type Box, type HeroBoard, type HeroLink, type Journey } from "./types";

/* SVG layers of the journeys, the hero processor and the link connector. */

/* `clip` keeps only the hops and glows that cross a box (the hero layer draws its own part only). */
export function JourneyLayer({ journeys, mode, clip }: { journeys: Journey[]; mode: "under" | "over"; clip?: Box }) {
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
            j.hops.map((h, hi) => (clip && !hopIn(h, clip) ? null : (
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
 * The board's journeys with one LED and two tails per journey (variant B, see
 * merged.ts): same classes, glows and timing as JourneyLayer in "under" mode.
 */
export function MergedJourneyLayer({ journeys, merged }: { journeys: Journey[]; merged: MergedJourney[] }) {
  return (
    <>
      {journeys.map((j, ji) => (
        <g key={ji} className={`b-journey is-${j.tone}`}>
          {j.glows.map((g, gi) =>
            !g.over ? (
              <g key={`g${gi}`} className="b-glow" style={{ animation: animation(`cbg${ji}-${gi}`, j) }}>
                <rect className="b-glow-halo" x={g.x - 5} y={g.y - 5} width={g.w + 10} height={g.h + 10} rx="9" />
                <rect className="b-glow-edge" x={g.x} y={g.y} width={g.w} height={g.h} rx="6" />
              </g>
            ) : null,
          )}
          {j.hops.length > 0 && (
            <>
              {TAILS.map(({ cls }, ti) => (
                <path key={cls} className={`b-tail ${cls}`} d={j.hops[0].d} style={{ animation: animation(`cbtm${ji}-${ti}`, j) }} />
              ))}
              <g className="b-led" style={{ offsetPath: `path("${merged[ji].d}")`, animation: animation(`cbdm${ji}`, j) } as CSSProperties}>
                <circle className="b-led-soft" r="3" />
                <circle className="b-led-core" r="1.7" />
              </g>
            </>
          )}
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

export function HeroLayer({ hero, journeys, target }: { hero: HeroBoard; journeys: Journey[]; target: Element }) {
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
export function LinkLayer({ hero, link, journeys, target }: { hero: HeroBoard; link: HeroLink; journeys: Journey[]; target: Element }) {
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
