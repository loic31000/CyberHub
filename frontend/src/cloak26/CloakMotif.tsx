import { Body, Pins, Smd, Trace, Via } from '@/hero/ModuleHero'

/*
 * CLOAK hero motif: three exposure sources (identity / network / behavior)
 * pass through a concealment processor applying successive layers, and the
 * output is a reduced, dimmed footprint. Static: no pulse, no filter.
 * Decorative only (aria-hidden by the hero).
 */

const SOURCES = [
  { y: 34, code: 'ID' },
  { y: 58, code: 'NET' },
  { y: 82, code: 'BHV' },
]
const LAYERS = [20, 14.5, 9]

export default function CloakMotif() {
  return (
    <svg viewBox="0 0 600 116" preserveAspectRatio="xMidYMid meet" focusable="false" className="ck26-motif">
      <defs>
        <radialGradient id="ck26-core-glow"><stop stopColor="#00d4ff" stopOpacity=".12" /><stop offset="1" stopColor="#00d4ff" stopOpacity="0" /></radialGradient>
        <linearGradient id="ck26-core-fill" x2="0" y2="1"><stop stopColor="#152c42" /><stop offset="1" stopColor="#091521" /></linearGradient>
      </defs>

      {/* Three exposure sources. */}
      {SOURCES.map(({ y, code }) => (
        <g key={code}>
          <Body x={44} y={y - 10} w={74} h={20} r={4} />
          <circle className="ck26-m-src" cx={56} cy={y} r={3} />
          <text className="ck26-m-srclabel" x={66} y={y + 3.5}>{code}</text>
        </g>
      ))}
      <Pins side="r" at={[34, 58, 82]} from={118} len={6} />
      <Trace pts={[[124, 34], [160, 34], [176, 44], [214, 44]]} />
      <Trace pts={[[124, 58], [214, 58]]} bus />
      <Trace pts={[[124, 82], [160, 82], [176, 72], [214, 72]]} />
      <Via x={160} y={34} r={2} /><Via x={160} y={82} r={2} />

      {/* Concealment processor: nested layers around a hidden core. */}
      <ellipse cx="274" cy="58" rx="84" ry="50" fill="url(#ck26-core-glow)" />
      <rect className="chh-chip-aura" x="207" y="10" width="134" height="96" rx="15" />
      <Pins side="l" at={[44, 58, 72]} from={220} len={6} />
      <Pins side="r" at={[44, 58, 72]} from={328} len={6} />
      <Pins side="t" at={[250, 266, 282, 298, 314]} from={20} len={5} />
      <Pins side="b" at={[250, 266, 282, 298, 314]} from={96} len={5} />
      <Body x={220} y={20} w={108} h={76} r={8} />
      <rect x="224" y="24" width="100" height="68" rx="6" fill="url(#ck26-core-fill)" stroke="#4f95ae" strokeWidth="1" />
      <rect className="chh-core-window" x="244" y="31" width="60" height="54" rx="6" />
      {LAYERS.map((r, i) => <circle key={r} className="ck26-m-layer" style={{ opacity: 0.4 + i * 0.22 }} cx={274} cy={58} r={r} />)}
      <path className="ck26-m-eye" d="M266 58q8-7 16 0q-8 7-16 0" />
      <circle className="ck26-m-pupil" cx={274} cy={58} r={2} />
      <path className="ck26-m-slash" d="M264 50l20 16" />
      <Trace pts={[[274, 101], [274, 106]]} /><Smd x={274} y={110} vertical />

      {/* Reduced footprint: a fading trace into a small, dimmed node. */}
      <Trace pts={[[334, 58], [400, 58]]} bus />
      <path className="ck26-m-fade" d="M400 58h70" />
      <Body x={474} y={46} w={48} h={24} r={5} />
      <circle className="ck26-m-reduced" cx={498} cy={58} r={4} />
      <Via x={540} y={58} r={2} />
    </svg>
  )
}
