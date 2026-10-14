import { Arrival, Body, Pins, Pulse, Smd, Trace, Via } from '@/hero/ModuleHero'

/*
 * MITRE ATT&CK hero motif, drawn with the Dashboard hero board's parts.
 *
 * One processor built like the CH processor (aura, halo, lit shell, die with
 * heat rings, a single core window) carrying the ATT&CK glyph. Its left pins
 * feed a SOIC and a BGA with their passives; its right pins drive a mini
 * ATT&CK matrix (tactic headers in their colours, technique cells linked row
 * by row) and a small driver below it; three bottom pins run to a connector
 * astride the hero's lower edge, as the CH processor's do. Every trace ends on
 * a pin, a pad or a via. Four slow pulses, one after the other, each lighting
 * the part it reaches.
 *
 * Drawn on a 640 x 116 board (the hero's height at 1440 px) and shown from
 * x 40, 600 wide, to leave room for the cartouche. Decorative only.
 */

// Processor: 120 x 64 at (186, 12), as the CH processor at the hero's scale.
const CHIP = { x: 186, y: 12, w: 120, h: 64 }
const CX = CHIP.x + CHIP.w / 2
const CY = CHIP.y + CHIP.h / 2
const SIDE = [22, 33, 44, 55, 66] // left and right pins
const EDGE = Array.from({ length: 10 }, (_, i) => +(CHIP.x + 13 + i * ((CHIP.w - 26) / 9)).toFixed(1)) // top and bottom pins

// Matrix: rows fed by the right pins (one 45° jog down), tactic columns.
const ROWS = [26, 37, 48, 59]
const COL_X = (c: number) => 372 + c * 36
const CELL_W = 28
const COLUMNS = [
  { rows: 4, tone: '#ff7a7a' },
  { rows: 3, tone: '#ff9b55' },
  { rows: 4, tone: '#f2c14e' },
  { rows: 2, tone: '#9ad65a' },
  { rows: 4, tone: '#3fd3a0' },
  { rows: 3, tone: '#22c3e6' },
  { rows: 4, tone: '#7f9fff' },
]
const COVERED = new Set(['1:0', '2:2', '4:1', '6:0'])

// Bottom pins wired to the edge connector.
const LINK = [EDGE[4], EDGE[5], EDGE[6]]

// Slow pulses: each travels 2 s of a 10 s cycle, one after the other.
const PERIOD = 10
const feed = (row: number, col: number) => {
  const y = SIDE[row]
  return `M312 ${y}H318L322 ${ROWS[row]}H${COL_X(col) + CELL_W / 2}`
}
const PULSES = [
  { path: feed(1, 3), row: 1, col: 3, delay: 0, tone: 'cyan' as const },
  { path: feed(3, 4), row: 3, col: 4, delay: 5, tone: 'ice' as const },
]
// The driver below the matrix, fed by the fifth right pin.
const TO_DRIVER = "M312 66H318L331 79H368"
// The third pulse comes in from the BGA and lights the processor.
const INTO_CHIP = `M87 70H162L166 66H180`

function Processor() {
  const { x, y, w, h } = CHIP
  const fid = [[-1, -1], [1, -1], [-1, 1], [1, 1]]
    .map(([sx, sy]) => `M${CX + sx * 19} ${CY + sy * 15}V${CY + sy * 19}H${CX + sx * 15}`)
    .join('')
  return (
    <g>
      {/* Depth: a soft cyan glow under the package, then the CH processor's aura and halo. */}
      <ellipse cx={CX} cy={CY} rx={w * 0.78} ry={h * 0.86} fill="url(#mx-chip-glow)" />
      <rect className="chh-chip-aura" x={x - 16} y={y - 10} width={w + 32} height={h + 20} rx={16} />
      <rect className="chh-chip-halo chh-breathe" x={x - 8} y={y - 5} width={w + 16} height={h + 10} rx={12} />
      <Pins side="l" at={SIDE} from={x} len={6} />
      <Pins side="r" at={SIDE} from={x + w} len={6} />
      <Pins side="t" at={EDGE} from={y} len={6} />
      <Pins side="b" at={EDGE} from={y + h} len={6} />
      <rect className="chh-shadow" x={x + 3} y={y + 5} width={w} height={h} rx={8} />
      <rect data-feed="chip" x={x} y={y} width={w} height={h} rx={8} fill="url(#mx-chip-body)" stroke="#2a4c66" strokeWidth={1} />
      <rect x={x + 11} y={y + 9} width={w - 22} height={h - 18} rx={5} fill="url(#mx-chip-die)" stroke="#1f3a52" strokeWidth={0.8} />
      {[1, 2, 3].map((i) => (
        <rect key={i} className="chh-heat" x={x + 11 + i * 4} y={y + 9 + i * 4} width={w - 22 - i * 8} height={h - 18 - i * 8} rx={3} />
      ))}
      <rect className="chh-chip-shell" x={x} y={y} width={w} height={h} rx={8} />
      {/* Relief: a cyan glint along the top edge, a darker lower edge. */}
      <path d={`M${x + 9} ${y + 1.4}H${x + w - 9}`} stroke="url(#mx-chip-glint)" strokeWidth={1.2} strokeLinecap="round" />
      <path d={`M${x + 10} ${y + h - 1.2}H${x + w - 10}`} stroke="#02060c" strokeOpacity={0.7} strokeWidth={1.2} strokeLinecap="round" />
      {/* The single core: a lit ring, its window, bevel, fiducials, bond pads and the ATT&CK glyph. */}
      <rect x={CX - 25} y={CY - 25} width={50} height={50} rx={9} fill="none" stroke="#00d4ff" strokeOpacity={0.28} strokeWidth={1} />
      <rect className="chh-core-window" x={CX - 22} y={CY - 22} width={44} height={44} rx={7} />
      <path className="chh-core-bevel" d={`M${CX - 16} ${CY - 21.1}H${CX + 16}`} />
      <path className="chh-core-fiducial" d={fid} />
      {[-2, -1, 0, 1, 2].map((i) => (
        <g key={i}>
          <rect className="chh-core-pad" x={CX - 28.5} y={CY + i * 7 - 1.2} width={2.6} height={2.4} rx={0.4} />
          <rect className="chh-core-pad" x={CX + 25.9} y={CY + i * 7 - 1.2} width={2.6} height={2.4} rx={0.4} />
        </g>
      ))}
      <g className="chh-core-glyph">
        <rect x={CX - 12.5} y={CY - 12} width={6.5} height={21} rx={1.5} />
        <rect x={CX - 3.25} y={CY - 12} width={6.5} height={13} rx={1.5} />
        <rect x={CX + 6} y={CY - 12} width={6.5} height={17} rx={1.5} />
      </g>
      <circle className="chh-core-node" cx={CX} cy={CY + 13.5} r={1.6} />
    </g>
  )
}

export default function MitreMotif() {
  return (
    <svg viewBox="40 0 600 116" preserveAspectRatio="xMidYMid meet" focusable="false">
      <defs>
        <radialGradient id="mx-chip-glow">
          <stop offset="0" stopColor="#00d4ff" stopOpacity="0.16" />
          <stop offset="0.6" stopColor="#00d4ff" stopOpacity="0.05" />
          <stop offset="1" stopColor="#00d4ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mx-chip-body" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#15293d" />
          <stop offset="0.55" stopColor="#0d1a28" />
          <stop offset="1" stopColor="#09131e" />
        </linearGradient>
        <linearGradient id="mx-chip-die" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#122539" />
          <stop offset="1" stopColor="#0b1724" />
        </linearGradient>
        <linearGradient id="mx-chip-glint" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#9feffd" stopOpacity="0" />
          <stop offset="0.5" stopColor="#9feffd" stopOpacity="0.75" />
          <stop offset="1" stopColor="#9feffd" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Left: a SOIC with its passives, a BGA with its decoupling, vias. */}
      <Trace pts={[[180, 22], [130, 22]]} bus />
      <Pins side="r" at={[22]} from={126} len={4} />
      <Pins side="l" at={[22]} from={86} len={4} />
      <Body x={86} y={16} w={40} h={12} />
      <Pins side="t" at={[92, 99, 106, 113, 120]} from={16} len={4} />
      <Pins side="b" at={[92, 99, 106, 113, 120]} from={28} len={4} />
      <rect className="chh-mark" x={88.5} y={18.5} width={2} height={2} rx={1} />
      <Trace pts={[[82, 22], [60, 22], [50, 12]]} />
      <Via x={48.6} y={10.6} r={2} />
      <Trace pts={[[106, 32], [106, 40]]} />
      <Smd x={106} y={44.5} vertical />
      <Trace pts={[[106, 49], [106, 54]]} />
      <Via x={106} y={56.5} r={2} />

      <Trace pts={[[180, 66], [166, 66], [162, 70], [87, 70]]} />
      <Pins side="r" at={[70]} from={83} len={4} />
      <Body x={57} y={53} w={26} h={26} />
      {[0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => <circle key={`${i}${j}`} className="chh-ball" cx={61.5 + i * 6} cy={57.5 + j * 6} r={1.4} />))}
      <Trace pts={[[64, 79], [64, 86]]} />
      <Smd x={64} y={90.5} vertical />
      <Trace pts={[[180, 33], [166, 33]]} />
      <Via x={164} y={33} r={2} />
      <Trace pts={[[180, 44], [158, 44]]} />
      <Via x={156} y={44} r={2} />
      <Trace pts={[[180, 55], [172, 55]]} />
      <Via x={170} y={55} r={2} />
      {[0, 1, 2].map((i) => [0, 1].map((j) => <Via key={`${i}${j}`} x={118 + i * 9} y={88 + j * 9} r={2} />))}

      {/* Bottom: three pins to a connector astride the hero's lower edge. */}
      {/* Marked for the page's motherboard: its feeds leave from these pins and this connector. */}
      {LINK.map((x) => <path key={x} data-feed="pin" className={x === LINK[1] ? 'chh-bus' : 'chh-trace'} d={`M${x} 82L${x} 100`} />)}
      <Pins side="t" at={LINK} from={104} len={4} />
      <g data-feed="connector"><Body x={LINK[0] - 12} y={104} w={LINK[2] - LINK[0] + 24} h={16} r={3} /></g>

      <Processor />

      {/* Right: the processor drives the matrix rows, one 45° jog each. */}
      {ROWS.map((ry, r) => (
        <Trace key={r} pts={[[312, SIDE[r]], [318, SIDE[r]], [322, ry], [COL_X(0), ry]]} bus={r === 1 || r === 2} />
      ))}
      {COLUMNS.map((col, c) => (
        <g key={c}>
          <rect x={COL_X(c)} y={12} width={CELL_W} height={3} rx={1.5} fill={col.tone} opacity={0.75} />
          {ROWS.slice(0, col.rows).map((ry, r) => {
            const covered = COVERED.has(`${c}:${r}`)
            const next = COLUMNS[c + 1]
            return (
              <g key={r}>
                {next && r < next.rows && <Trace pts={[[COL_X(c) + CELL_W, ry], [COL_X(c + 1), ry]]} />}
                {covered
                  ? <rect x={COL_X(c)} y={ry - 4} width={CELL_W} height={8} rx={1.5} fill={col.tone} fillOpacity={0.18} stroke={col.tone} strokeOpacity={0.55} strokeWidth={0.9} />
                  : <rect className="chh-cell" x={COL_X(c)} y={ry - 4} width={CELL_W} height={8} rx={1.5} />}
              </g>
            )
          })}
        </g>
      ))}

      {/* The fifth right pin: a small driver below the matrix, its passive and via. */}
      <Trace pts={[[312, 66], [318, 66], [331, 79], [368, 79]]} />
      <Pins side="l" at={[79]} from={372} len={4} />
      <Pins side="r" at={[79]} from={404} len={4} />
      <Body x={372} y={74} w={32} h={10} />
      <Pins side="b" at={[380, 388, 396]} from={84} len={4} />
      <Trace pts={[[388, 88], [388, 98]]} />
      <Via x={388} y={100.5} r={2} />
      <Trace pts={[[408, 79], [441, 79]]} />
      <Smd x={446} y={79} />
      <Trace pts={[[450.5, 79], [470, 79]]} />
      <Via x={472.5} y={79} r={2} />

      {/* Pulses: two into the matrix (the cell lights in its tactic colour), one into the processor. */}
      {PULSES.map((p) => (
        <g key={p.delay}>
          <Arrival period={PERIOD} delay={p.delay}>
            <rect x={COL_X(p.col) - 2} y={ROWS[p.row] - 6} width={CELL_W + 4} height={12} rx={3} fill="none" stroke={COLUMNS[p.col].tone} strokeOpacity={0.3} strokeWidth={3} />
            <rect x={COL_X(p.col)} y={ROWS[p.row] - 4} width={CELL_W} height={8} rx={1.5} fill={COLUMNS[p.col].tone} fillOpacity={0.55} stroke={COLUMNS[p.col].tone} strokeWidth={1} />
          </Arrival>
          <Pulse path={p.path} period={PERIOD} delay={p.delay} tone={p.tone} />
        </g>
      ))}
      <Arrival period={PERIOD} delay={2.5}>
        <rect x={CHIP.x - 3} y={CHIP.y - 3} width={CHIP.w + 6} height={CHIP.h + 6} rx={10} fill="rgb(0 212 255 / 0.05)" stroke="#00d4ff" strokeOpacity={0.6} strokeWidth={1.4} />
      </Arrival>
      <Pulse path={INTO_CHIP} period={PERIOD} delay={2.5} tone="white" />
      <Arrival period={PERIOD} delay={7.5}>
        <rect x={369} y={71} width={38} height={16} rx={4} fill="rgb(0 212 255 / 0.08)" stroke="#00d4ff" strokeOpacity={0.6} strokeWidth={1.2} />
      </Arrival>
      <Pulse path={TO_DRIVER} period={PERIOD} delay={7.5} tone="cyan" />
    </svg>
  )
}
