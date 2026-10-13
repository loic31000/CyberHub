import type { CSSProperties } from "react";

const ghostTraces = [
  "M0 12 H130 L158 40 H360 L390 70 H662",
  "M0 30 H92 L120 58 H284 L314 88 H662",
  "M24 132 H152 L180 104 H410 L438 76 H662",
  "M116 140 V118 L150 84 H330 L360 54 H662",
  "M252 0 V20 L282 50 H482 L512 80 H662",
  "M354 0 V16 L382 44 H554 L580 70 H662",
  "M1000 10 H934 L908 36 H838 L814 60",
  "M1000 34 H958 L930 62 H814",
  "M984 128 H920 L892 100 H842 L814 72",
  "M902 140 V116 L872 86 H814",
  "M526 140 V118 L554 90 H662",
  "M470 0 V18 L498 46 H662",
];

const signalTraces = [
  "M0 20 H176 L202 46 H414 L440 72 H662",
  "M0 44 H116 L144 72 H324 L350 46 H526 L552 72 H662",
  "M16 66 H198 L224 92 H448 L470 70 H662",
  "M0 94 H118 L146 66 H268 L300 98 H486 L514 70 H662",
  "M28 122 H190 L218 94 H382 L410 66 H662",
  "M86 140 V116 L112 90 H244 L270 64 H662",
  "M202 140 V120 L232 90 H356 L384 62 H662",
  "M304 140 V116 L332 88 H502 L522 68 H662",
  "M414 140 V118 L442 90 H560 L582 68 H662",
  "M174 0 V22 L204 52 H366 L394 78 H662",
  "M322 0 V18 L350 46 H500 L526 72 H662",
  "M452 0 V20 L480 48 H572 L596 72 H662",
  "M662 50 H604 L578 24 H520",
  "M662 90 H592 L566 116 H486",
  "M814 48 H858 L884 22 H1000",
  "M814 62 H904 L932 34 H1000",
  "M814 78 H876 L906 108 H1000",
  "M814 92 H850 L878 120 H1000",
  "M748 34 V12 H710 L688 34",
  "M730 106 V126 H688 L666 104",
  "M832 0 V18 L806 44",
  "M920 140 V118 L890 88 H814",
];

const pulseIndexes = [0, 1, 3, 4, 6, 8, 10, 14, 16, 17];

const nodes = [
  [176, 20, "cyan"], [144, 72, "white"], [198, 66, "cyan"],
  [190, 122, "amber"], [244, 90, "white"], [270, 64, "cyan"],
  [350, 46, "white"], [382, 94, "cyan"], [410, 66, "amber"],
  [480, 48, "cyan"], [526, 72, "white"], [582, 68, "cyan"],
  [884, 22, "amber"], [904, 62, "cyan"], [906, 108, "white"],
  [878, 120, "cyan"], [520, 24, "cyan"], [486, 116, "amber"],
] as const;

const components = [
  [70, 36, 54, 16], [286, 18, 42, 14], [370, 104, 58, 16],
  [494, 86, 48, 15], [842, 30, 42, 14], [922, 82, 52, 16],
] as const;

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
        {signalTraces.map((path, index) => <path key={index} d={path} pathLength="1" />)}
      </g>

      <g className="circuit-pulses" filter="url(#circuit-glow)">
        {pulseIndexes.map((traceIndex, index) => (
          <path
            key={traceIndex}
            className={index > 6 ? "is-secondary" : undefined}
            d={signalTraces[traceIndex]}
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
        {Array.from({ length: 6 }, (_, index) => (
          <g key={index}>
            <line x1="654" x2="668" y1={44 + index * 10} y2={44 + index * 10} />
            <line x1="810" x2="824" y1={44 + index * 10} y2={44 + index * 10} />
          </g>
        ))}
        <path className="chip-scan" d="M684 88 H794" />
        <image href="/mark.svg" x="713" y="43" width="52" height="52" />
      </g>
    </svg>
  );
}
