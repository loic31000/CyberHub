import { Body, Pins, Pulse, Trace, Via } from '@/hero/ModuleHero'

/*
 * Knowledge Atlas hero motif — the carousel in miniature. Four knowledge
 * feeds (CVE / ATT&CK / CLOAK / LOLBINS) run into a stack of thin record
 * cards with index tabs; one card is extracted toward the viewer and its
 * lines reveal, then the stack feeds the ATLAS index. Not a CPU, not a
 * target. Motion is slow and small (feed pulses, a 2px shift of the stack,
 * the reveal) and disappears under prefers-reduced-motion. Decorative.
 */

const SOURCES = [
  { y: 20, label: 'CVE', tone: 'cve' },
  { y: 45, label: 'ATT&CK', tone: 'mitre' },
  { y: 70, label: 'CLOAK', tone: 'cloak' },
  { y: 95, label: 'LOLBINS', tone: 'lolbins' },
] as const
const FEEDS = ['M124 20H158L180 44H236', 'M124 45H168L176 52H236', 'M124 70H168L178 60H236', 'M124 95H158L182 68H236']
const BEHIND = [2, 1, 0]
const LINES = [62, 70, 78]

export default function KnowledgeMotif() {
  return (
    <svg viewBox="0 0 600 116" preserveAspectRatio="xMidYMid meet" focusable="false" aria-hidden="true" className="ka-motif">
      <defs>
        <radialGradient id="ka-m-glow"><stop stopColor="#38d9ec" stopOpacity=".16" /><stop offset="1" stopColor="#38d9ec" stopOpacity="0" /></radialGradient>
        <linearGradient id="ka-m-card" x2="0" y2="1"><stop stopColor="#173444" /><stop offset="1" stopColor="#0b1925" /></linearGradient>
      </defs>

      {SOURCES.map(({ y, label, tone }) => (
        <g key={label} className="ka-m-source" data-tone={tone}>
          <Body x={36} y={y - 9} w={84} h={18} r={4} />
          <rect className="ka-m-tab" x={40} y={y - 5.5} width={3.5} height={11} rx={1.5} />
          <text className="ka-m-label" x={50} y={y + 3}>{label}</text>
          <Via x={128} y={y} r={1.8} />
        </g>
      ))}
      {FEEDS.map((d, i) => <path key={i} className="ka-m-feed" d={d} />)}

      <ellipse className="ka-m-aura" cx="306" cy="62" rx="92" ry="44" fill="url(#ka-m-glow)" />
      <ellipse className="ka-m-floor" cx="300" cy="106" rx="70" ry="4" />

      {/* the stack: thin record cards with an index tab, like the carousel */}
      <g className="ka-m-stack">
        {BEHIND.map(i => (
          <g key={i} className="ka-m-behind" style={{ opacity: 0.85 - i * 0.22, animationDelay: `${-i * 0.9}s` }}>
            <rect className="ka-m-card-tab" x={270 + i * 10} y={27 - i * 6} width={22} height={5} rx={1.5} />
            <rect x={262 + i * 10} y={31 - i * 6} width={100} height={60} rx={4} fill="url(#ka-m-card)" className="ka-m-card" />
          </g>
        ))}
        {/* source index tabs on the stack edge */}
        {SOURCES.map(({ tone }, i) => <rect key={tone} className="ka-m-index" data-tone={tone} x={384} y={22 + i * 15} width={5} height={10} rx={1.5} />)}
      </g>

      {/* the extracted record */}
      <g className="ka-m-active">
        <rect className="ka-m-active-shadow" x={246} y={46} width={104} height={62} rx={5} />
        <rect className="ka-m-card-tab is-active" x={252} y={36} width={24} height={5} rx={1.5} />
        <rect className="ka-m-active-card" x={242} y={40} width={104} height={62} rx={5} fill="url(#ka-m-card)" />
        <rect className="ka-m-active-accent" x={242} y={40} width={104} height={2.4} rx={1.2} />
        <rect className="ka-m-active-badge" x={252} y={48} width={20} height={7} rx={2} />
        <path className="ka-m-active-id" d="M318 51.5h20" />
        {LINES.map((y, i) => <path key={y} className="ka-m-active-line" style={{ animationDelay: `${i * 0.35}s` }} d={`M252 ${y}h${i === 2 ? 52 : 84}`} />)}
        <path className="ka-m-active-foot" d="M252 92h28M318 92h20" />
      </g>

      <Pins side="r" at={[50, 62, 74]} from={392} len={5} />
      <Trace pts={[[397, 50], [414, 50], [424, 56], [446, 56]]} />
      <Trace pts={[[397, 62], [446, 62]]} bus />
      <Trace pts={[[397, 74], [414, 74], [424, 68], [446, 68]]} />
      <Body x={446} y={46} w={96} h={32} r={5} />
      <circle className="ka-m-outdot" cx="458" cy="62" r="2.4" />
      <text className="ka-m-outlabel" x="470" y="65">ATLAS INDEX</text>
      <Via x={552} y={62} r={2.2} />

      {FEEDS.map((d, i) => <Pulse key={d} path={d} period={14} delay={-i * 3.4} tone={i % 2 ? 'ice' : 'cyan'} />)}
      <Pulse path="M397 62H446" period={11} delay={-2} tone="ice" />
    </svg>
  )
}
