import type { CSSProperties } from 'react'
import { Arrival, Body, Pins, Pulse, Smd, Trace, Via } from '@/hero/ModuleHero'

/*
 * OSINT Runner hero motif: open sources received by a compact dish on its
 * socket, fed into a receiver module, carried on three collection channels into the analysis
 * processor (its core: a small link graph), then out to a results register
 * and its terminal strip. Every trace ends on a pin, a pad or a via. Three
 * slow pulses: two collected signals entering the processor, one result
 * leaving it. Decorative only (aria-hidden by the hero).
 */
const PERIOD = 9
const COLLECT = [62, 71, 80] // receiver outputs (y)
const IN = [38, 53, 68] // processor left pins (y)
// Radio waves from the dish's feed, facing the sky (up and to the left).
const FEED = { x: 56.1, y: 24.2 }
const WAVES = [8, 13, 18, 23].map((r) => {
  const a1 = (-158 * Math.PI) / 180, a2 = (-92 * Math.PI) / 180
  const p = (a: number) => `${(FEED.x + r * Math.cos(a)).toFixed(1)} ${(FEED.y + r * Math.sin(a)).toFixed(1)}`
  return `M${p(a1)}A${r} ${r} 0 0 1 ${p(a2)}`
})
const channel = (k: number) => `M138 ${COLLECT[k]}H${158 + k * 8}L${172 + k * 8} ${IN[k]}H214`

/* `active` while a search runs: the dish emits twice as often. */
export default function OsintMotif({ active = false }: { active?: boolean }) {
  const wave = active ? 2.25 : 4.5
  return (
    <svg viewBox="0 0 600 116" preserveAspectRatio="xMidYMid meet" focusable="false"
      className={`os26-motif${active ? ' is-active' : ''}`} style={{ '--wave': `${wave}s` } as CSSProperties}>
      <defs>
        <radialGradient id="os26-chip-glow"><stop stopColor="#00d4ff" stopOpacity=".15" /><stop offset="1" stopColor="#00d4ff" stopOpacity="0" /></radialGradient>
        <linearGradient id="os26-chip-fill" x2="0" y2="1"><stop stopColor="#152c42" /><stop offset="1" stopColor="#091521" /></linearGradient>
      </defs>

      {/* Reception: a compact dish on its swivel mount, set in an electronic
          socket (pins, vias); its feed line runs down the mount, out of the
          socket and into the receiver's input pin. */}
      <defs>
        <linearGradient id="os26-dish" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#1a3c55" /><stop offset="1" stopColor="#0a1824" />
        </linearGradient>
      </defs>
      <path d="M46 46Q79.2 56.9 80 22Z" fill="url(#os26-dish)" stroke="#5aa9c1" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M50.5 45.2Q76.5 52.5 77.4 26" fill="none" stroke="#2f5870" strokeWidth=".8" />
      <path d="M46 46L80 22" stroke="#8fd9ea" strokeOpacity=".75" strokeWidth="1" strokeLinecap="round" />
      <path d="M46 46L56.1 24.2L80 22" fill="none" stroke="#3d7590" strokeWidth=".9" strokeLinejoin="round" />
      <rect x="53.1" y="21.2" width="6" height="6" rx="1.2" transform="rotate(-35 56.1 24.2)" fill="#0c1f2e" stroke="#9eeefa" strokeWidth="1" />
      {/* Four waves leave the feed one after the other (0, 220, 440, 660 ms), grow and fade. */}
      {WAVES.map((d, i) => <path key={d} className="os26-wave" d={d} style={{ animationDelay: `${i * 0.22}s` }} />)}
      <path d="M71 45.5L68 62" stroke="#3d7590" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="68" cy="62" r="3.2" fill="#0c1f2e" stroke="#6fbfd3" strokeWidth="1.1" />
      <rect x="65.5" y="65" width="5" height="17" rx="1" fill="#0d2132" stroke="#386b85" strokeWidth=".9" />
      <Body x={48} y={82} w={34} h={13} r={2.5} />
      <rect x="53" y="85" width="12" height="7" rx="1.2" fill="#10283a" stroke="#386b85" strokeWidth=".8" />
      <circle className="chh-pad" cx="74" cy="88.5" r="2" />
      <Pins side="b" at={[54, 60, 66, 72]} from={95} len={3} />
      <Pins side="r" at={[88.5]} from={82} len={3} />
      <Trace pts={[[54, 98], [54, 103]]} /><Via x={54} y={105.5} r={2} />
      <Trace pts={[[72, 98], [72, 103]]} /><Via x={72} y={105.5} r={2} />
      <Trace pts={[[85, 88.5], [86, 88.5], [86, 71], [88, 71]]} bus />

      {/* Receiver module: shield can, two filter cells, its passive. */}
      <Pins side="l" at={[71]} from={92} len={4} />
      <Pins side="r" at={COLLECT} from={134} len={4} />
      <Body x={92} y={54} w={42} h={34} r={4} />
      <rect x="97" y="59" width="15" height="24" rx="2" fill="#0d2132" stroke="#386b85" strokeWidth=".9" />
      <rect x="116" y="59" width="13" height="11" rx="2" fill="#0d2132" stroke="#386b85" strokeWidth=".9" />
      <rect x="116" y="72" width="13" height="11" rx="2" fill="#0d2132" stroke="#386b85" strokeWidth=".9" />
      <path d="M100 64h9M100 71h9M100 78h9" stroke="#5babc6" strokeOpacity=".45" strokeWidth=".9" />
      <Trace pts={[[113, 88], [113, 96]]} /><Smd x={113} y={100.5} vertical />

      {/* Three collection channels, one 45° jog each, into the processor's pins. */}
      {COLLECT.map((_, k) => <path key={k} className={k === 1 ? 'chh-bus' : 'chh-trace'} d={channel(k)} />)}

      {/* Analysis processor. */}
      <ellipse cx="270" cy="54" rx="86" ry="50" fill="url(#os26-chip-glow)" />
      <rect className="chh-chip-aura" x="203" y="9" width="134" height="90" rx="15" />
      <Pins side="l" at={IN} from={220} len={6} />
      <Pins side="r" at={[38, 53, 68]} from={332} len={6} />
      <Pins side="t" at={[236, 250, 264, 278, 292, 306]} from={18} len={5} />
      <Pins side="b" at={[236, 250, 264, 278, 292, 306]} from={90} len={5} />
      <Body x={220} y={18} w={112} h={72} r={8} />
      <rect x="224" y="21" width="104" height="66" rx="6" fill="url(#os26-chip-fill)" stroke="#4f95ae" strokeWidth="1" />
      <rect className="chh-chip-shell" x="220" y="18" width="112" height="72" rx="8" />
      <rect x="244" y="30" width="64" height="48" rx="6" fill="#091927" stroke="#477f9a" strokeWidth="1" />
      {/* Core: a pseudonym node linked to the profiles found for it. */}
      <path d="M276 54L259 41M276 54L294 42M276 54L261 68M276 54L292 67" stroke="#6fc9dc" strokeOpacity=".75" strokeWidth="1.2" strokeLinecap="round" />
      {[[259, 41], [294, 42], [261, 68], [292, 67]].map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r="2.6" fill="#0c2232" stroke="#8fe6f3" strokeWidth="1.1" />
      ))}
      <circle cx="276" cy="54" r="4.4" fill="#0f3245" stroke="#a3f0fa" strokeWidth="1.4" />
      <circle cx="276" cy="54" r="1.6" fill="#00d4ff" />

      {/* Results register: report cells, then a terminal strip with its vias. */}
      <Trace pts={[[338, 38], [372, 38]]} /><Trace pts={[[338, 53], [372, 53]]} bus /><Trace pts={[[338, 68], [372, 68]]} />
      <Pins side="l" at={[38, 53, 68]} from={372} len={4} />
      <Pins side="r" at={[38, 53, 68]} from={432} len={4} />
      <Body x={372} y={28} w={60} h={50} r={4} />
      {[38, 53, 68].map((y) => (
        <g key={y}>
          <rect x="380" y={y - 4} width="20" height="8" rx="2" fill="#10283a" stroke="#386b85" />
          <rect x="404" y={y - 4} width="20" height="8" rx="2" fill="#10283a" stroke="#386b85" />
        </g>
      ))}
      {[38, 53, 68].map((y) => <Trace key={y} pts={[[436, y], [478, y]]} bus={y === 53} />)}
      <Body x={478} y={26} w={12} h={54} r={2} />
      {[38, 53, 68].map((y) => (
        <g key={y}><circle className="chh-pad" cx="484" cy={y} r="2" /><Trace pts={[[490, y], [520, y]]} /><Via x={522.5} y={y} r={2} /></g>
      ))}
      <Trace pts={[[264, 95], [264, 102]]} /><Smd x={264} y={106} vertical />

      {/* Pulses: two collected signals reach the processor, one result leaves it. */}
      {/* The feed's pulse leaves as the waves are emitted, the receiver hands it to the processor. */}
      <Pulse path="M56.1 24.2L71 45.5L68 62V88.5H86V71H92" period={wave} delay={0.7} tone="ice" />
      <Pulse path={channel(0)} period={PERIOD} delay={1.7} tone="cyan" />
      <Pulse path={channel(2)} period={PERIOD} delay={6.2} tone="white" />
      <Arrival period={PERIOD} delay={1.7}>
        <rect x="217" y="15" width="118" height="78" rx="10" fill="rgb(0 212 255 / 0.04)" stroke="#00d4ff" strokeOpacity=".5" strokeWidth="1.3" />
      </Arrival>
      <Pulse path="M338 53H372" period={PERIOD} delay={3.6} tone="cyan" />
      <Arrival period={PERIOD} delay={3.6}>
        <rect x="369" y="25" width="66" height="56" rx="5" fill="none" stroke="#8fd3ff" strokeOpacity=".32" strokeWidth="2" />
      </Arrival>
    </svg>
  )
}
