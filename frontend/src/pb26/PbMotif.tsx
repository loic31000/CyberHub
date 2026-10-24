import { Body, Pins, Smd, Trace, Via } from '@/hero/ModuleHero'

/*
 * Playbooks hero motif: three alert sensors wired into a runbook processor
 * whose window shows a checklist (two rows ticked, one current), then a gauge
 * of pads where the progress lands. Static: no pulse, no filter. Decorative
 * only (aria-hidden by the hero).
 */

const SENSORS: [number, string][] = [[24, 'is-alert'], [52, 'is-warn'], [80, 'is-info']]
const ROWS: [number, 'done' | 'current' | 'todo'][] = [[36, 'done'], [48, 'done'], [60, 'current'], [72, 'todo']]
const PADS = [0, 1, 2, 3, 4, 5, 6, 7]
const LIT = 5

export default function PbMotif() {
  return (
    <svg viewBox="0 0 600 116" preserveAspectRatio="xMidYMid meet" focusable="false" className="pb26-motif">
      <defs>
        <radialGradient id="pb26-core-glow"><stop stopColor="#00d4ff" stopOpacity=".13" /><stop offset="1" stopColor="#00d4ff" stopOpacity="0" /></radialGradient>
        <linearGradient id="pb26-core-fill" x2="0" y2="1"><stop stopColor="#152c42" /><stop offset="1" stopColor="#091521" /></linearGradient>
      </defs>

      {/* Triggers: three alert sensors, severity by colour. */}
      {SENSORS.map(([y, tone], i) => (
        <g key={y}>
          <Body x={72 + i * 6} y={y - 10} w={52} h={20} r={3} />
          <circle className={`pb26-m-led ${tone}`} cx={84 + i * 6} cy={y} r={3.4} />
          <path className="pb26-m-text" d={`M${94 + i * 6} ${y - 2}h${22 - i * 4}M${94 + i * 6} ${y + 3}h${14 + i * 2}`} />
        </g>
      ))}
      <Trace pts={[[124, 24], [176, 24], [190, 40], [228, 40]]} />
      <Trace pts={[[130, 52], [228, 52]]} bus />
      <Trace pts={[[136, 80], [176, 80], [190, 66], [228, 66]]} />

      {/* Runbook processor: a checklist, two rows done, one current. */}
      <ellipse cx="284" cy="56" rx="86" ry="50" fill="url(#pb26-core-glow)" />
      <rect className="chh-chip-aura" x="217" y="8" width="134" height="96" rx="15" />
      <Pins side="l" at={[40, 52, 66]} from={230} len={6} />
      <Pins side="r" at={[40, 56, 72]} from={338} len={6} />
      <Pins side="t" at={[252, 268, 284, 300, 316]} from={18} len={5} />
      <Pins side="b" at={[252, 268, 284, 300, 316]} from={94} len={5} />
      <Body x={230} y={18} w={108} h={76} r={8} />
      <rect x="234" y="22" width="100" height="68" rx="6" fill="url(#pb26-core-fill)" stroke="#4f95ae" strokeWidth="1" />
      <rect x="230" y="18" width="108" height="76" rx="8" className="pb26-m-shell" />
      <rect className="chh-core-window" x="250" y="28" width="68" height="56" rx="6" />
      {ROWS.map(([y, state]) => (
        <g key={y} className={`pb26-m-row is-${state}`}>
          <rect x="257" y={y - 3.5} width="7" height="7" rx="1.5" />
          {state === 'done' && <path className="pb26-m-tick" d={`M258.6 ${y}l1.8 1.8 3-3.4`} />}
          <path className="pb26-m-line" d={`M269 ${y}h${state === 'current' ? 40 : 34}`} />
        </g>
      ))}
      <Trace pts={[[284, 99], [284, 104]]} /><Smd x={284} y={108} vertical />

      {/* Progress: a gauge of pads, lit as steps are checked. */}
      <Trace pts={[[344, 40], [372, 40], [382, 50], [396, 50]]} />
      <Trace pts={[[344, 56], [396, 56]]} bus />
      <Trace pts={[[344, 72], [372, 72], [382, 62], [396, 62]]} />
      <Body x={396} y={36} w={128} h={40} r={5} />
      {PADS.map(i => <rect key={i} className={`pb26-m-pad${i < LIT ? ' is-on' : ''}`} x={406 + i * 14} y={49} width={10} height={14} rx={2} />)}
      <Trace pts={[[524, 44], [552, 44]]} /><Via x={554.5} y={44} r={2} />
      <Trace pts={[[524, 56], [560, 56]]} bus /><Via x={562.5} y={56} r={2} />
      <Trace pts={[[524, 68], [552, 68]]} /><Via x={554.5} y={68} r={2} />
    </svg>
  )
}
