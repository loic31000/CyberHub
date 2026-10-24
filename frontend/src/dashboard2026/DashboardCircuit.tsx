import { useEffect, useMemo, useRef } from "react";
import { calmRamp, heartbeatKeyframes, journeyKeyframes } from "./circuit/animations";
import { hopIn, r1 } from "./circuit/geometry";
import { HeroLayer, JourneyLayer, LinkLayer, MergedJourneyLayer } from "./circuit/layers";
import { mergedKeyframes, mergeJourneys, supportsPathAnimation } from "./circuit/merged";
import { LAYERS } from "./circuit/types";
import { useCircuitGeometry } from "./circuit/useCircuitGeometry";

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

/*
 * Historical entry point of the engine, kept for its consumers (the Dashboard,
 * the module pages' ModuleCircuit and MITRE): the engine itself lives in
 * ./circuit, one responsibility per file.
 */
export { CIRCUIT_LAYOUT_EVENT, requestCircuitRecompute } from "./circuit/events";
export { LAYERS } from "./circuit/types";
export type { BoardLayer, Box, CircuitGeometry, Heartbeat, HeroBoard, HeroLink, Journey, ModuleFeed, Point, Rect } from "./circuit/types";
export { buildBoard } from "./circuit/builder";
export { useCircuitGeometry } from "./circuit/useCircuitGeometry";
export { journeyKeyframes } from "./circuit/animations";
export { JourneyLayer, LinkLayer } from "./circuit/layers";

export default function DashboardCircuit({ motion = true }: { motion?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const { geometry } = useCircuitGeometry(hostRef);
  // The board's own layer: one LED and two tails per journey where the browser can
  // animate a path's shape (Chromium, Firefox); per hop otherwise (WebKit). With
  // the merged board, per-hop keyframes are kept only for the hops the hero draws.
  const merged = useMemo(() => (geometry && supportsPathAnimation() ? mergeJourneys(geometry.journeys) : null), [geometry]);
  const keyframes = useMemo(
    () => (geometry && motion ? journeyKeyframes(geometry.journeys, merged ? (ji, hi) => !!geometry.hero && hopIn(geometry.journeys[ji].hops[hi], geometry.hero) : undefined) + heartbeatKeyframes(geometry.heartbeat) + (merged ? mergedKeyframes(geometry.journeys, merged) : "") : ""),
    [geometry, merged, motion],
  );
  const heroElement = geometry?.hero ? hostRef.current?.parentElement?.querySelector(".dashboard-board .overview-hero") : null;

  // The board, hero and connector layers mount their journeys separately: give
  // every journey animation the same start time, so a signal crossing from one
  // layer to the next is at the same place at the same instant.
  useEffect(() => {
    if (!geometry || !motion) return;
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
  }, [geometry, motion]);
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
            {geometry.hero?.envLink && (() => {
              const e = geometry.hero.envLink;
              return (
                <g className="environment-link">
                  <rect className="el-shadow" x={e.x + 2} y={e.y + 4} width={e.w} height={e.h} rx="3" />
                  {e.pins.map((x) => (
                    <g key={x} className="el-pin">
                      <rect x={x - 1} y={e.top} width="2" height={e.y - e.top + 1} />
                      <rect x={x - 1} y={e.y + e.h - 1} width="2" height={e.bottom - e.y - e.h + 1} />
                    </g>
                  ))}
                  <rect className="el-side" x={e.x} y={e.y + 3} width={e.w} height={e.h} rx="3" />
                  <rect className="el-face" x={e.x} y={e.y} width={e.w} height={e.h - 1} rx="3" />
                  <path className="el-bevel" d={`M${r1(e.x + 4)} ${r1(e.y + 1)}H${r1(e.x + e.w - 4)}`} />
                  <path className="el-groove" d={`M${r1(e.x + 8)} ${r1(e.y + e.h / 2)}H${r1(e.x + e.w - 8)}`} />
                </g>
              );
            })()}
          </svg>

          {motion && <svg
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
              {merged ? <MergedJourneyLayer journeys={geometry.journeys} merged={merged} /> : <JourneyLayer journeys={geometry.journeys} mode="under" />}
            </g>
          </svg>}
          {geometry.hero && heroElement && <HeroLayer hero={geometry.hero} journeys={motion ? geometry.journeys : []} target={heroElement} />}
          {geometry.hero?.link && boardElement && <LinkLayer hero={geometry.hero} link={geometry.hero.link} journeys={motion ? geometry.journeys : []} target={boardElement} />}
        </>
      )}
    </div>
  );
}
