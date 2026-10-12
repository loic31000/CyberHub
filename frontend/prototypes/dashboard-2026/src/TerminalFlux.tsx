import type { CSSProperties } from "react";
import "./terminal-flux.css";

const paths = {
  cyan: "M-40 112 C92 13 201 163 334 71 S559 25 690 103 S884 157 1040 35",
  blue: "M-35 135 C107 43 220 146 350 101 S561 35 695 77 S872 136 1040 64",
  amber: "M-30 62 C112 145 224 12 350 89 S558 143 690 54 S872 21 1045 97",
  upper: "M-20 82 C105 28 212 120 339 59 S553 57 685 111 S871 76 1030 24",
  lower: "M-20 149 C126 76 241 149 365 112 S573 61 711 98 S889 139 1040 83",
};

const nodes = [
  [82, 80, 2.3, "cyan"],
  [177, 60, 3.3, "cyan major"],
  [278, 93, 1.7, "blue"],
  [377, 67, 2.4, "cyan"],
  [468, 49, 1.8, "cyan"],
  [553, 88, 3.4, "amber major"],
  [637, 72, 2.2, "cyan"],
  [721, 61, 3.4, "cyan major"],
  [811, 96, 2.1, "blue"],
  [887, 66, 3.1, "amber major"],
  [966, 48, 1.8, "cyan"],
] as const;

const travelers = [
  [paths.cyan, "cyan", "9.2s", "-1.1s"],
  [paths.blue, "blue", "11.4s", "-5.8s"],
  [paths.amber, "amber", "13.6s", "-3.4s"],
  [paths.upper, "cyan small", "14.8s", "-9.2s"],
] as const;

export default function TerminalFlux() {
  return (
    <svg
      className="hero-flux"
      viewBox="0 0 1000 180"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="flux-cyan" x1="0" x2="1">
          <stop offset="0" stopColor="#43d4dc" stopOpacity="0" />
          <stop offset=".08" stopColor="#54d7df" stopOpacity=".36" />
          <stop offset=".24" stopColor="#6ee7ec" stopOpacity=".88" />
          <stop offset=".52" stopColor="#c8ffff" />
          <stop offset=".82" stopColor="#54d5dc" stopOpacity=".82" />
          <stop offset="1" stopColor="#43d4dc" stopOpacity=".12" />
        </linearGradient>
        <linearGradient id="flux-blue" x1="0" x2="1">
          <stop offset="0" stopColor="#5d91c4" stopOpacity="0" />
          <stop offset=".15" stopColor="#69a5d4" stopOpacity=".45" />
          <stop offset=".45" stopColor="#9fd7f1" stopOpacity=".88" />
          <stop offset=".78" stopColor="#5ed5de" stopOpacity=".67" />
          <stop offset="1" stopColor="#5d91c4" stopOpacity=".1" />
        </linearGradient>
        <linearGradient id="flux-amber" x1="0" x2="1">
          <stop offset="0" stopColor="#c9944e" stopOpacity="0" />
          <stop offset=".14" stopColor="#d0a05a" stopOpacity=".38" />
          <stop offset=".36" stopColor="#e6b668" stopOpacity=".82" />
          <stop offset=".64" stopColor="#ffe0a1" stopOpacity=".95" />
          <stop offset="1" stopColor="#c9944e" stopOpacity=".1" />
        </linearGradient>
        <radialGradient id="flux-field" cx="52%" cy="50%" r="55%">
          <stop offset="0" stopColor="#71e4e8" stopOpacity=".13" />
          <stop offset=".48" stopColor="#2d9eaa" stopOpacity=".05" />
          <stop offset="1" stopColor="#11151a" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect className="flux-field" width="1000" height="180" />
      <g className="flux-grid">
        {Array.from({ length: 18 }, (_, index) => (
          <line key={index} x1={index * 60} x2={index * 60} y1="0" y2="180" />
        ))}
        {[38, 90, 142].map((y) => (
          <line key={y} x1="0" x2="1000" y1={y} y2={y} />
        ))}
      </g>

      <g className="flux-aura">
        <path className="cyan" d={paths.cyan} />
        <path className="blue" d={paths.blue} />
        <path className="amber" d={paths.amber} />
      </g>

      <g className="flux-ribbons">
        <path className="flux-line cyan core" d={paths.cyan} />
        <path className="flux-line blue core" d={paths.blue} />
        <path className="flux-line amber core" d={paths.amber} />
        <path className="flux-line cyan fine" d={paths.upper} />
        <path className="flux-line blue fine" d={paths.lower} />
        <path
          className="flux-line cyan hairline"
          d="M-20 101 C116 69 226 118 347 80 S566 45 692 90 S867 112 1030 58"
        />
        <path
          className="flux-line amber hairline"
          d="M-20 126 C118 113 213 42 354 115 S563 98 710 43 S887 70 1030 121"
        />
        <path
          className="flux-line blue hairline"
          d="M-10 48 C121 87 244 40 370 74 S584 125 722 74 S901 38 1030 89"
        />
      </g>

      <g className="flux-light-runs">
        <path className="cyan" d={paths.cyan} />
        <path className="blue reverse" d={paths.blue} />
        <path className="amber slow" d={paths.amber} />
        <path className="cyan fine-run" d={paths.upper} />
        <path className="blue fine-run reverse" d={paths.lower} />
      </g>

      <g className="flux-dust">
        {Array.from({ length: 42 }, (_, index) => (
          <circle
            key={index}
            cx={22 + ((index * 83) % 950)}
            cy={14 + ((index * 47) % 148)}
            r={index % 7 === 0 ? 1 : 0.55}
          />
        ))}
      </g>

      <g className="flux-nodes">
        {nodes.map(([cx, cy, radius, tone], index) => (
          <circle key={index} className={tone} cx={cx} cy={cy} r={radius} />
        ))}
      </g>

      <g className="flux-travelers">
        {travelers.map(([path, tone, duration, delay], index) => (
          <circle
            key={index}
            className={tone}
            r={tone.includes("small") ? 1.2 : 1.8}
            style={
              {
                offsetPath: `path('${path}')`,
                "--flux-duration": duration,
                "--flux-delay": delay,
              } as CSSProperties
            }
          />
        ))}
      </g>
    </svg>
  );
}
