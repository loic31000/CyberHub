import { Body, Pins, Smd, Trace, Via } from '@/hero/ModuleHero'

/*
 * Outils hero motif: a rack of three tool cartridges (offensive, defensive,
 * OSINT), each wired into one processor whose core holds a command prompt;
 * its bus feeds a terminal module with a few command lines. Static: no
 * pulse, no filter. Decorative only (aria-hidden by the hero).
 */

const SLOTS = [
  { y: 24, code: 'OFF', tone: 'off' },
  { y: 52, code: 'DEF', tone: 'def' },
  { y: 80, code: 'INT', tone: 'int' },
] as const
const FINGERS = [0, 1, 2, 3, 4]
const LINES = [{ y: 40, w: 62 }, { y: 52, w: 84 }, { y: 64, w: 48 }, { y: 76, w: 72 }]

export default function ToolsMotif() {
  return (
    <svg viewBox="0 0 600 116" preserveAspectRatio="xMidYMid meet" focusable="false" className="tl26-motif">
      <defs>
        <radialGradient id="tl26-core-glow"><stop stopColor="#00d4ff" stopOpacity=".12" /><stop offset="1" stopColor="#00d4ff" stopOpacity="0" /></radialGradient>
        <linearGradient id="tl26-core-fill" x2="0" y2="1"><stop stopColor="#152c42" /><stop offset="1" stopColor="#091521" /></linearGradient>
      </defs>

      {/* Rack: a frame holding three cartridges, one per tool family. */}
      <rect className="tl26-m-rack" x="40" y="14" width="112" height="90" rx="6" />
      {SLOTS.map(({ y, code, tone }) => (
        <g key={code}>
          <Body x={52} y={y - 9} w={80} h={18} r={3} />
          <rect className={`tl26-m-tab is-${tone}`} x={52} y={y - 9} width={5} height={18} rx={1.5} />
          <text className="tl26-m-code" x={64} y={y + 3.5}>{code}</text>
          {FINGERS.map(f => <rect key={f} className="tl26-m-finger" x={104 + f * 5} y={y - 4} width={3} height={8} rx={.6} />)}
        </g>
      ))}
      <Pins side="r" at={[24, 52, 80]} from={132} len={6} />
      <Trace pts={[[138, 24], [176, 24], [196, 44], [222, 44]]} />
      <Trace pts={[[138, 52], [176, 52], [184, 58], [222, 58]]} />
      <Trace pts={[[138, 80], [176, 80], [196, 72], [222, 72]]} />
      <Via x={176} y={24} r={2} /><Via x={176} y={80} r={2} />

      {/* Processor: the arsenal index, a prompt in its core. */}
      <ellipse cx="282" cy="58" rx="86" ry="50" fill="url(#tl26-core-glow)" />
      <rect className="chh-chip-aura" x="215" y="10" width="134" height="96" rx="15" />
      <Pins side="l" at={[44, 58, 72]} from={228} len={6} />
      <Pins side="r" at={[44, 58, 72]} from={336} len={6} />
      <Pins side="t" at={[250, 266, 282, 298, 314]} from={20} len={5} />
      <Pins side="b" at={[250, 266, 282, 298, 314]} from={96} len={5} />
      <Body x={228} y={20} w={108} h={76} r={8} />
      <rect x="232" y="24" width="100" height="68" rx="6" fill="url(#tl26-core-fill)" stroke="#4f95ae" strokeWidth="1" />
      <rect className="chh-core-window" x="252" y="31" width="60" height="54" rx="6" />
      <path className="tl26-m-prompt" d="M266 50l9 8-9 8" />
      <path className="tl26-m-cursor" d="M281 66H298" />
      <Trace pts={[[282, 101], [282, 106]]} /><Smd x={282} y={110} vertical />

      {/* Terminal module: the command lines the sheets provide. */}
      <Trace pts={[[342, 44], [372, 44], [380, 36], [394, 36]]} />
      <Trace pts={[[342, 58], [394, 58]]} bus />
      <Trace pts={[[342, 72], [372, 72], [380, 80], [394, 80]]} />
      <Body x={394} y={20} w={128} h={76} r={5} />
      <path className="tl26-m-bar" d="M394 31H522" />
      <circle className="tl26-m-led" cx={403} cy={25.5} r={1.6} />
      <circle className="tl26-m-led" cx={409} cy={25.5} r={1.6} />
      {LINES.map(({ y, w }, i) => (
        <g key={y}>
          <path className={i === 0 ? 'tl26-m-comment' : 'tl26-m-sign'} d={`M404 ${y}h5`} />
          <path className={i === 0 ? 'tl26-m-comment' : 'tl26-m-line'} d={`M413 ${y}h${w}`} />
        </g>
      ))}
      <Trace pts={[[522, 36], [552, 36]]} /><Via x={554.5} y={36} r={2} />
      <Trace pts={[[522, 58], [560, 58]]} bus /><Via x={562.5} y={58} r={2} />
      <Trace pts={[[522, 80], [552, 80]]} /><Via x={554.5} y={80} r={2} />
    </svg>
  )
}
