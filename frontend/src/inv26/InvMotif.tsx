import { Body, Pins, Smd, Trace, Via } from '@/hero/ModuleHero'

/*
 * Investigations hero motif: three evidence files wired into a case processor
 * whose core links a few entities, then a timeline rail where the findings
 * land in time order. Static: no pulse, no filter. Decorative only
 * (aria-hidden by the hero).
 */

const FILES = [24, 52, 80]
const LINKS: [number, number, number, number][] = [[268, 48, 290, 40], [290, 40, 300, 62], [268, 48, 278, 70], [278, 70, 300, 62]]
const NODES: [number, number, string][] = [[268, 48, 'is-entity'], [290, 40, 'is-entity'], [300, 62, 'is-focus'], [278, 70, 'is-entity']]
const EVENTS: [number, string][] = [[412, 'is-info'], [436, 'is-low'], [458, 'is-info'], [478, 'is-medium'], [494, 'is-high'], [508, 'is-critical']]

export default function InvMotif() {
  return (
    <svg viewBox="0 0 600 116" preserveAspectRatio="xMidYMid meet" focusable="false" className="iv26-motif">
      <defs>
        <radialGradient id="iv26-core-glow"><stop stopColor="#00d4ff" stopOpacity=".13" /><stop offset="1" stopColor="#00d4ff" stopOpacity="0" /></radialGradient>
        <linearGradient id="iv26-core-fill" x2="0" y2="1"><stop stopColor="#152c42" /><stop offset="1" stopColor="#091521" /></linearGradient>
      </defs>

      {/* Evidence: three case files with their lines of text. */}
      {FILES.map((y, i) => (
        <g key={y}>
          <Body x={60 + i * 6} y={y - 11} w={64} h={22} r={3} />
          <path className="iv26-m-tab" d={`M${66 + i * 6} ${y - 11}v-3h14l3 3`} />
          <path className="iv26-m-text" d={`M${68 + i * 6} ${y - 3}h34M${68 + i * 6} ${y + 3}h${22 + i * 6}`} />
        </g>
      ))}
      <Trace pts={[[124, 24], [176, 24], [190, 40], [228, 40]]} />
      <Trace pts={[[130, 52], [228, 52]]} bus />
      <Trace pts={[[136, 80], [176, 80], [190, 66], [228, 66]]} />

      {/* Case processor: a few linked entities, one in focus. */}
      <ellipse cx="284" cy="56" rx="86" ry="50" fill="url(#iv26-core-glow)" />
      <rect className="chh-chip-aura" x="217" y="8" width="134" height="96" rx="15" />
      <Pins side="l" at={[40, 52, 66]} from={230} len={6} />
      <Pins side="r" at={[40, 56, 72]} from={338} len={6} />
      <Pins side="t" at={[252, 268, 284, 300, 316]} from={18} len={5} />
      <Pins side="b" at={[252, 268, 284, 300, 316]} from={94} len={5} />
      <Body x={230} y={18} w={108} h={76} r={8} />
      <rect x="234" y="22" width="100" height="68" rx="6" fill="url(#iv26-core-fill)" stroke="#4f95ae" strokeWidth="1" />
      <rect x="230" y="18" width="108" height="76" rx="8" className="iv26-m-shell" />
      <rect className="chh-core-window" x="254" y="29" width="60" height="54" rx="6" />
      {LINKS.map(([x1, y1, x2, y2]) => <path key={`${x1}${y1}${x2}${y2}`} className="iv26-m-link" d={`M${x1} ${y1}L${x2} ${y2}`} />)}
      {NODES.map(([x, y, tone]) => <circle key={`${x}${y}`} className={`iv26-m-node ${tone}`} cx={x} cy={y} r={tone === 'is-focus' ? 4.2 : 3} />)}
      <Trace pts={[[284, 99], [284, 104]]} /><Smd x={284} y={108} vertical />

      {/* Timeline: events in time order on a rail, severity by colour. */}
      <Trace pts={[[344, 40], [372, 40], [382, 50], [396, 50]]} />
      <Trace pts={[[344, 56], [396, 56]]} bus />
      <Trace pts={[[344, 72], [372, 72], [382, 62], [396, 62]]} />
      <Body x={396} y={30} w={128} h={52} r={5} />
      <path className="iv26-m-rail" d="M404 56H516" />
      {EVENTS.map(([x, tone], i) => (
        <g key={x}>
          <path className="iv26-m-tick" d={`M${x} 56V${i % 2 ? 66 : 46}`} />
          <circle className={`iv26-m-event ${tone}`} cx={x} cy={i % 2 ? 68 : 44} r={3.2} />
        </g>
      ))}
      <Trace pts={[[524, 40], [552, 40]]} /><Via x={554.5} y={40} r={2} />
      <Trace pts={[[524, 56], [560, 56]]} bus /><Via x={562.5} y={56} r={2} />
      <Trace pts={[[524, 72], [552, 72]]} /><Via x={554.5} y={72} r={2} />
    </svg>
  )
}
