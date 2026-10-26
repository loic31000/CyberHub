import { Body, Pins, Smd, Trace, Via } from '@/hero/ModuleHero'

/*
 * Network hero motif: backbone → convergence → distribution, drawn as an
 * abstract board. Trunk lanes come in from the left, meet in a cross-connect
 * (a matrix of ports inside a double frame), and fan out to the right towards
 * the cartouche. Secondary traces and small parts give depth; cyan marks one
 * incoming lane, the cross-connect and the outgoing uplink. Decorative only:
 * no domain, no topology, no data. Static; aria-hidden by the hero.
 */

type P = [number, number]

/* A small grid of dots (port block, test points). */
function DotMatrix({ x, y, cols, rows, gap = 6 }: { x: number; y: number; cols: number; rows: number; gap?: number }) {
  return (
    <g className="nw26-x-dots">
      {Array.from({ length: cols * rows }, (_, i) => (
        <circle key={i} cx={x + (i % cols) * gap} cy={y + Math.floor(i / cols) * gap} r={1.1} />
      ))}
    </g>
  )
}

/* Cross-connect: port matrix; a few ports are lit. */
const MATRIX_X = [262, 276, 290, 304, 318, 332]
const MATRIX_Y = [42, 56, 70]
const LIT = new Set(['290-56', '318-42', '332-70'])

const IN_LANES: { pts: P[]; live?: boolean; bus?: boolean }[] = [
  { pts: [[0, 30], [84, 30], [100, 40], [168, 40], [182, 44], [242, 44]] },
  { pts: [[0, 57], [242, 57]], live: true },
  { pts: [[0, 84], [96, 84], [112, 74], [168, 74], [182, 70], [242, 70]], bus: true },
]

const OUT_LANES: { pts: P[]; live?: boolean }[] = [
  { pts: [[358, 44], [404, 44], [418, 26], [470, 26]] },
  { pts: [[358, 57], [600, 57]], live: true },
  { pts: [[358, 70], [404, 70], [418, 90], [470, 90]] },
]

export default function NetworkMotif() {
  return (
    <svg viewBox="0 0 600 116" preserveAspectRatio="xMidYMid meet" focusable="false" className="nw26-motif">
      <defs>
        <radialGradient id="nw26-x-glow"><stop stopColor="#00d4ff" stopOpacity=".16" /><stop offset="1" stopColor="#00d4ff" stopOpacity="0" /></radialGradient>
        <linearGradient id="nw26-x-fill" x2="0" y2="1"><stop stopColor="#122638" /><stop offset="1" stopColor="#081420" /></linearGradient>
      </defs>

      {/* Far layer: faint routing behind everything. */}
      <path className="nw26-x-far" d="M20 14H150l10 8H230M20 102H140l12-8H236M372 12H440l10 6H560M378 104H452l12-8H572" />
      <path className="nw26-x-far" d="M150 14v-8M236 94v14M440 12V4M452 104v8" />

      {/* Left: incoming trunks, a port block and a connector. */}
      {IN_LANES.map((l, i) => l.live
        ? <path key={i} className="nw26-x-live" d={l.pts.map(([x, y], j) => `${j ? 'L' : 'M'}${x} ${y}`).join('')} />
        : <Trace key={i} pts={l.pts} bus={l.bus} />)}
      <Body x={118} y={22} w={34} h={12} r={2} />
      <DotMatrix x={124} y={28} cols={5} rows={1} />
      <Body x={44} y={66} w={30} h={30} r={3} />
      <DotMatrix x={50} y={72} cols={4} rows={4} />
      <Via x={84} y={30} r={2.2} /><Via x={96} y={84} r={2.2} />
      <circle className="nw26-x-node is-live" cx="150" cy="57" r="3.2" />
      <Smd x={200} y={30} /><Smd x={200} y={84} />
      <Trace pts={[[200, 34], [200, 40]]} /><Trace pts={[[200, 80], [200, 74]]} />

      {/* Centre: the cross-connect, a port matrix in a double frame. */}
      <ellipse cx="300" cy="57" rx="104" ry="56" fill="url(#nw26-x-glow)" />
      <rect className="chh-chip-aura" x="232" y="14" width="136" height="86" rx="13" />
      <Pins side="l" at={[44, 57, 70]} from={244} len={6} />
      <Pins side="r" at={[44, 57, 70]} from={356} len={6} />
      <Pins side="t" at={[262, 280, 298, 316, 334]} from={24} len={5} />
      <Pins side="b" at={[262, 280, 298, 316, 334]} from={90} len={5} />
      <Body x={244} y={24} w={112} h={66} r={8} />
      <rect x="248" y="28" width="104" height="58" rx="6" fill="url(#nw26-x-fill)" className="nw26-x-frame" />
      <rect x="254" y="34" width="92" height="46" rx="4" className="nw26-x-window" />
      {MATRIX_Y.map((y) => MATRIX_X.map((x) => (
        <rect key={`${x}-${y}`} className={`nw26-x-port${LIT.has(`${x}-${y}`) ? ' is-on' : ''}`} x={x - 5} y={y - 4} width={10} height={8} rx={1.4} />
      )))}
      <Trace pts={[[298, 95], [298, 104]]} /><Smd x={298} y={109} vertical />

      {/* Right: distribution towards the cartouche. */}
      {OUT_LANES.map((l, i) => l.live
        ? <path key={i} className="nw26-x-live" d={l.pts.map(([x, y], j) => `${j ? 'L' : 'M'}${x} ${y}`).join('')} />
        : <Trace key={i} pts={l.pts} />)}
      <Body x={470} y={16} w={40} h={20} r={3} />
      <DotMatrix x={477} y={23} cols={5} rows={2} gap={6.5} />
      <Body x={470} y={80} w={40} h={20} r={3} />
      <DotMatrix x={477} y={87} cols={5} rows={2} gap={6.5} />
      <circle className="nw26-x-node is-live" cx="452" cy="57" r="3.2" />
      <Via x={404} y={44} r={2} /><Via x={404} y={70} r={2} />
      <Trace pts={[[510, 26], [540, 26], [550, 36]]} /><Via x={552} y={38} r={2} />
      <Trace pts={[[510, 90], [540, 90], [550, 80]]} /><Via x={552} y={78} r={2} />
      <DotMatrix x={560} y={20} cols={2} rows={3} />
      <DotMatrix x={560} y={84} cols={2} rows={3} />
    </svg>
  )
}
