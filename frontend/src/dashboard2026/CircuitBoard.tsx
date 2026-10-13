import type { CSSProperties } from "react";

/*
 * Phase 2N: hero processor wiring. Every active trace is drawn from its outer
 * end to a real pin tip of the chip (left/right pins at x 654 and 824, top and
 * bottom pins at y 26 and 114), fanning out over the full decorative height
 * with 45° bends so parallel runs never cross.
 */

const ghostTraces = [
  "M150 22 H250 L266 38 H320",
  "M190 66 H330 L344 80 H392",
  "M170 104 H236 L252 120 H300",
  "M954 46 V64 L970 80 H1000",
];

type Tone = "cyan" | "blue" | "white" | "amber";

// Outer end first, pin last: the pulses travel towards the processor.
const signalTraces: { d: string; tone?: Tone }[] = [
  // Left fan: six pins, upper three rise, lower three fall.
  { d: "M300 10 H582 L616 44 H654" },
  { d: "M360 28 H578 L604 54 H654", tone: "blue" },
  { d: "M430 50 H578 L592 64 H654" },
  { d: "M410 90 H576 L592 74 H654", tone: "white" },
  { d: "M340 112 H576 L604 84 H654", tone: "blue" },
  { d: "M280 132 H578 L616 94 H654", tone: "amber" },
  // Right fan: the edge of the band feeds the right-hand pins.
  { d: "M1000 12 H878 L846 44 H824" },
  { d: "M1000 30 H882 L858 54 H824", tone: "blue" },
  { d: "M930 64 H824", tone: "white" },
  { d: "M1000 90 H916 L900 74 H824" },
  { d: "M1000 110 H892 L866 84 H824", tone: "blue" },
  { d: "M1000 128 H890 L856 94 H824" },
  // Top and bottom pins.
  { d: "M610 6 H694 L706 18 V26" },
  { d: "M870 6 H784 L772 18 V26", tone: "white" },
  { d: "M610 134 H694 L706 122 V114", tone: "blue" },
  { d: "M870 134 H784 L772 122 V114" },
  // Short branches ending on vias, between the two fans.
  { d: "M500 50 L516 66 H540" },
  { d: "M450 90 L466 74 H486" },
  { d: "M440 28 L452 40 H470" },
];

// [trace index, secondary]: secondary pulses run back out from the chip.
// Only the first six are shown on desktop (four inbound, two outbound).
const pulses: [number, boolean][] = [
  [0, false], [10, false], [4, false], [12, false], [11, true], [15, true],
  [7, false], [2, false],
];

const nodes = [
  [300, 10, "cyan"], [360, 28, "white"], [430, 50, "cyan"],
  [410, 90, "cyan"], [340, 112, "white"], [280, 132, "amber"],
  [930, 64, "cyan"], [610, 6, "cyan"], [870, 6, "white"],
  [610, 134, "cyan"], [870, 134, "amber"], [540, 66, "cyan"],
  [486, 74, "white"], [470, 40, "cyan"], [500, 50, "cyan"],
  [450, 90, "white"], [440, 28, "cyan"],
] as const;

// Small surface-mount parts sitting on the traces.
const components = [
  [452, 6, 30, 8], [506, 108, 30, 8], [930, 26, 26, 8],
  [944, 106, 26, 8], [630, 130, 24, 8], [890, 60, 22, 8],
] as const;

const sidePins = Array.from({ length: 6 }, (_, index) => 44 + index * 10);
const edgePins = [706, 772];

export default function CircuitBoard() {
  return (
    <svg className="hero-circuit" viewBox="0 0 1000 140" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="circuit-ghost" x1="0" x2="1">
          <stop offset="0" stopColor="#163047" stopOpacity="0.08" />
          <stop offset="0.55" stopColor="#31536d" stopOpacity="0.42" />
          <stop offset="1" stopColor="#172d42" stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id="circuit-steel" x1="0" x2="1">
          <stop offset="0" stopColor="#274a65" stopOpacity="0.18" />
          <stop offset="0.52" stopColor="#5c8da7" stopOpacity="0.82" />
          <stop offset="1" stopColor="#2a4f69" stopOpacity="0.24" />
        </linearGradient>
        <linearGradient id="circuit-live" x1="0" x2="1">
          <stop offset="0" stopColor="#26cceb" stopOpacity="0" />
          <stop offset="0.42" stopColor="#78ecff" />
          <stop offset="0.66" stopColor="#e5fbff" />
          <stop offset="1" stopColor="#00c8ed" stopOpacity="0.08" />
        </linearGradient>
        <radialGradient id="core-surface" cx="50%" cy="35%" r="80%">
          <stop offset="0" stopColor="#172d40" />
          <stop offset="0.5" stopColor="#0a1624" />
          <stop offset="1" stopColor="#070d16" />
        </radialGradient>
        <filter id="circuit-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2.8" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="node-glow" x="-300%" y="-300%" width="700%" height="700%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <g className="circuit-ghosts">
        {ghostTraces.map((path, index) => <path key={index} d={path} />)}
      </g>

      <g className="circuit-components">
        {components.map(([x, y, width, height], index) => (
          <g key={index}>
            <rect x={x} y={y} width={width} height={height} rx="3" />
            <line x1={x + 8} x2={x + width - 8} y1={y + height / 2} y2={y + height / 2} />
          </g>
        ))}
      </g>

      <g className="circuit-traces">
        {signalTraces.map(({ d }, index) => <path key={index} d={d} pathLength="1" />)}
      </g>

      <g className="circuit-pulses" filter="url(#circuit-glow)">
        {pulses.map(([traceIndex, secondary], index) => (
          <path
            key={traceIndex}
            className={`is-${signalTraces[traceIndex].tone ?? "cyan"}${secondary ? " is-secondary" : ""}`}
            d={signalTraces[traceIndex].d}
            pathLength="1"
            style={{ "--pulse-order": index, "--pulse-duration": `${13.2 + (index % 3) * 0.9}s` } as CSSProperties}
          />
        ))}
      </g>

      <g className="circuit-nodes" filter="url(#node-glow)">
        {nodes.map(([cx, cy, tone], index) => (
          <g key={`${cx}-${cy}`} className={`is-${tone}`} style={{ "--node-order": index } as CSSProperties}>
            <circle className="node-ring" cx={cx} cy={cy} r="4.2" />
            <circle className="node-core" cx={cx} cy={cy} r="1.7" />
          </g>
        ))}
      </g>

      <g className="circuit-chip">
        <rect className="chip-aura" x="646" y="20" width="186" height="100" rx="18" />
        <rect className="chip-halo" x="658" y="28" width="162" height="84" rx="13" />
        <rect className="chip-shell" x="668" y="34" width="142" height="72" rx="9" />
        <rect className="chip-inner" x="677" y="42" width="124" height="56" rx="6" />
        {sidePins.map((y) => (
          <g key={y}>
            <line x1="654" x2="668" y1={y} y2={y} />
            <line x1="810" x2="824" y1={y} y2={y} />
          </g>
        ))}
        {edgePins.map((x) => (
          <g key={x}>
            <line x1={x} x2={x} y1="26" y2="34" />
            <line x1={x} x2={x} y1="106" y2="114" />
          </g>
        ))}
        <path className="chip-scan" d="M684 88 H794" />
          <image href="/dashboard-2026/mark.svg" x="713" y="43" width="52" height="52" />
      </g>
    </svg>
  );
}
