import { Body, Pins, Smd, Trace, Via } from '@/hero/ModuleHero'

/*
 * CVE & KEV hero motif: an exposure surface (service ports, one of them
 * exposed) wired into a processor whose core holds three nested protection
 * layers, the inner one breached; its outputs feed a ten-step severity
 * scale. Static: no pulse, no filter. Decorative only (aria-hidden by the hero).
 */

const shield = (x: number, y: number, w: number, h: number) =>
  `M${x} ${y - h}L${x + w} ${y - h * 0.68}V${y + h * 0.05}Q${x + w} ${y + h * 0.72} ${x} ${y + h}Q${x - w} ${y + h * 0.72} ${x - w} ${y + h * 0.05}V${y - h * 0.68}Z`

const PORT_ROWS = [30, 44, 58, 72, 86]
const PORT_COLS = [62, 78, 94, 110]
const EXPOSED = { row: 2, col: 3 }
const SCALE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
const scaleTone = (i: number) => (i >= 9 ? 'critical' : i >= 7 ? 'high' : i >= 4 ? 'medium' : 'low')

export default function CveMotif() {
  return (
    <svg viewBox="0 0 600 116" preserveAspectRatio="xMidYMid meet" focusable="false" className="cv26-motif">
      <defs>
        <radialGradient id="cv26-core-glow"><stop stopColor="#00d4ff" stopOpacity=".13" /><stop offset="1" stopColor="#00d4ff" stopOpacity="0" /></radialGradient>
        <linearGradient id="cv26-core-fill" x2="0" y2="1"><stop stopColor="#152c42" /><stop offset="1" stopColor="#091521" /></linearGradient>
      </defs>

      {/* Exposure surface: a port panel, one service exposed. */}
      <Body x={50} y={18} w={76} h={80} r={5} />
      {PORT_ROWS.map((y, r) => PORT_COLS.map((x, c) => {
        const exposed = r === EXPOSED.row && c === EXPOSED.col
        return <rect key={`${r}-${c}`} x={x - 5} y={y - 4} width={10} height={8} rx={1.5} className={exposed ? 'cv26-m-exposed' : 'cv26-m-port'} />
      }))}
      <Pins side="r" at={[36, 58, 80]} from={126} len={5} />
      <Trace pts={[[131, 36], [176, 36], [190, 44], [222, 44]]} />
      <Trace pts={[[131, 58], [222, 58]]} bus />
      <Trace pts={[[131, 80], [176, 80], [190, 72], [222, 72]]} />
      <path className="cv26-m-path" d="M116 58H131" />

      {/* Protection processor: three nested layers, the inner one breached. */}
      <ellipse cx="282" cy="58" rx="86" ry="50" fill="url(#cv26-core-glow)" />
      <rect className="chh-chip-aura" x="215" y="10" width="134" height="96" rx="15" />
      <Pins side="l" at={[44, 58, 72]} from={228} len={6} />
      <Pins side="r" at={[44, 58, 72]} from={336} len={6} />
      <Pins side="t" at={[250, 266, 282, 298, 314]} from={20} len={5} />
      <Pins side="b" at={[250, 266, 282, 298, 314]} from={96} len={5} />
      <Body x={228} y={20} w={108} h={76} r={8} />
      <rect x="232" y="24" width="100" height="68" rx="6" fill="url(#cv26-core-fill)" stroke="#4f95ae" strokeWidth="1" />
      <rect x="228" y="20" width="108" height="76" rx="8" className="cv26-m-shell" />
      <rect className="chh-core-window" x="252" y="31" width="60" height="54" rx="6" />
      <path className="cv26-m-layer is-outer" d={shield(282, 58, 19, 22)} />
      <path className="cv26-m-layer is-mid" d={shield(282, 58, 13, 15.5)} />
      <path className="cv26-m-layer is-inner" d={shield(282, 58, 7.5, 9)} />
      <path className="cv26-m-breach" d="M285.5 49.5l-4.5 7h4l-4 7" />
      <Trace pts={[[282, 101], [282, 106]]} /><Smd x={282} y={110} vertical />

      {/* Severity scale: ten steps, low to critical. */}
      <Trace pts={[[342, 44], [372, 44], [380, 36], [394, 36]]} />
      <Trace pts={[[342, 58], [394, 58]]} bus />
      <Trace pts={[[342, 72], [372, 72], [380, 80], [394, 80]]} />
      <Body x={394} y={20} w={128} h={76} r={5} />
      {SCALE.map(i => {
        const h = 10 + i * 5.2
        return <rect key={i} x={404 + i * 11.2} y={88 - h} width={7} height={h} rx={1.5} className={`cv26-m-step is-${scaleTone(i)}`} />
      })}
      <path className="cv26-m-baseline" d="M402 90.5H514" />
      <Trace pts={[[522, 36], [552, 36]]} /><Via x={554.5} y={36} r={2} />
      <Trace pts={[[522, 58], [560, 58]]} bus /><Via x={562.5} y={58} r={2} />
      <Trace pts={[[522, 80], [552, 80]]} /><Via x={554.5} y={80} r={2} />
    </svg>
  )
}
