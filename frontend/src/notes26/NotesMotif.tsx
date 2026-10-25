import { Body, Pins, Smd, Trace, Via } from '@/hero/ModuleHero'

/*
 * Notes hero motif: an operational note (a card of text lines) feeds an index
 * processor whose bus fans out to three reference nodes — IOC, ATT&CK, CVE.
 * Static: no pulse, no filter. Decorative only (aria-hidden by the hero).
 */

const NOTE_LINES = [{ y: 34, w: 54 }, { y: 46, w: 70 }, { y: 58, w: 44 }, { y: 70, w: 64 }, { y: 82, w: 38 }]
const REFS = [
  { y: 36, label: 'IOC' },
  { y: 58, label: 'ATT&CK' },
  { y: 80, label: 'CVE' },
]

export default function NotesMotif() {
  return (
    <svg viewBox="0 0 600 116" preserveAspectRatio="xMidYMid meet" focusable="false" className="nt26-motif">
      <defs>
        <radialGradient id="nt26-core-glow"><stop stopColor="#00d4ff" stopOpacity=".12" /><stop offset="1" stopColor="#00d4ff" stopOpacity="0" /></radialGradient>
        <linearGradient id="nt26-core-fill" x2="0" y2="1"><stop stopColor="#152c42" /><stop offset="1" stopColor="#091521" /></linearGradient>
      </defs>

      {/* Operational note: a document with a folded corner and text lines. */}
      <Body x={42} y={20} w={78} h={76} r={5} />
      <path className="nt26-m-fold" d="M104 24h12v12z" />
      <path className="nt26-m-title" d="M54 28h40" />
      {NOTE_LINES.map(({ y, w }) => <path key={y} className="nt26-m-line" d={`M54 ${y}h${w}`} />)}
      <Pins side="r" at={[36, 58, 80]} from={120} len={6} />
      <Trace pts={[[126, 36], [160, 36], [176, 44], [214, 44]]} />
      <Trace pts={[[126, 58], [214, 58]]} bus />
      <Trace pts={[[126, 80], [160, 80], [176, 72], [214, 72]]} />
      <Via x={160} y={36} r={2} /><Via x={160} y={80} r={2} />

      {/* Index processor: links the note to the ecosystem. */}
      <ellipse cx="274" cy="58" rx="84" ry="50" fill="url(#nt26-core-glow)" />
      <rect className="chh-chip-aura" x="207" y="10" width="134" height="96" rx="15" />
      <Pins side="l" at={[44, 58, 72]} from={220} len={6} />
      <Pins side="r" at={[44, 58, 72]} from={328} len={6} />
      <Pins side="t" at={[242, 258, 274, 290, 306]} from={20} len={5} />
      <Pins side="b" at={[242, 258, 274, 290, 306]} from={96} len={5} />
      <Body x={220} y={20} w={108} h={76} r={8} />
      <rect x="224" y="24" width="100" height="68" rx="6" fill="url(#nt26-core-fill)" stroke="#4f95ae" strokeWidth="1" />
      <rect className="chh-core-window" x="244" y="31" width="60" height="54" rx="6" />
      <path className="nt26-m-link" d="M262 54a6 6 0 0 1 8 0l4 4m8-2a6 6 0 0 1 8 0" />
      <path className="nt26-m-link" d="M286 62a6 6 0 0 1-8 0l-4-4" />
      <Trace pts={[[274, 101], [274, 106]]} /><Smd x={274} y={110} vertical />

      {/* Reference graph: three labelled nodes. */}
      <Trace pts={[[334, 44], [360, 44], [372, 36], [392, 36]]} />
      <Trace pts={[[334, 58], [392, 58]]} bus />
      <Trace pts={[[334, 72], [360, 72], [372, 80], [392, 80]]} />
      {REFS.map(({ y, label }) => (
        <g key={label}>
          <rect className="nt26-m-ref" x={392} y={y - 10} width={120} height={20} rx={5} />
          <circle className="nt26-m-refdot" cx={404} cy={y} r={3} />
          <text className="nt26-m-reflabel" x={416} y={y + 3.5}>{label}</text>
          <Via x={522} y={y} r={2} />
        </g>
      ))}
    </svg>
  )
}
