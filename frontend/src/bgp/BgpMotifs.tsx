import { Body, Pins, Smd, Trace, Via } from '@/hero/ModuleHero'

/*
 * Hero motifs of the two BGP modules, drawn with the shared board primitives
 * so they belong to the Dashboard / OSINT / IOC family. Both are static: no
 * pulse, no breathing halo, no SVG filter, so an idle page costs nothing to
 * repaint. Decorative and conceptual (aria-hidden by the hero): they do not
 * depict any ASN, relation or event.
 */

const ROUTER_PORTS = [0, 1, 2, 3]

/** A small router package: four ports and a link light per port. */
function Router({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <Body x={x} y={y} w={56} h={30} r={4} />
      {ROUTER_PORTS.map((i) => (
        <g key={i}>
          <rect x={x + 7 + i * 11.5} y={y + 13} width={8} height={9} rx={1.2} fill="#10283a" stroke="#386b85" strokeWidth=".8" />
          <circle cx={x + 11 + i * 11.5} cy={y + 7} r={1.2} className="bgp-m-led" />
        </g>
      ))}
    </g>
  )
}

/**
 * Network Atlas: transit fibres reach two edge routers, which feed the
 * autonomous-system processor; a backbone rail runs above it, and its
 * outputs branch through an exchange bank towards interconnection points.
 */
export function AtlasMotif() {
  const out = [36, 50, 64, 78]
  return (
    <svg viewBox="0 0 600 116" preserveAspectRatio="xMidYMid meet" focusable="false" className="bgp-motif">
      <defs>
        <radialGradient id="bgp-atlas-glow"><stop stopColor="#00d4ff" stopOpacity=".14" /><stop offset="1" stopColor="#00d4ff" stopOpacity="0" /></radialGradient>
        <linearGradient id="bgp-atlas-fill" x2="0" y2="1"><stop stopColor="#152c42" /><stop offset="1" stopColor="#091521" /></linearGradient>
      </defs>

      {/* Transit: two fibres with their optical modules, into the edge routers. */}
      {[39, 79].map((y) => (
        <g key={y}>
          <Via x={22} y={y} r={2.3} />
          <Trace pts={[[24.5, y], [114, y]]} bus />
          <rect x={52} y={y - 4} width={30} height={8} rx={2} fill="#102337" stroke="#2a516b" strokeWidth="1" />
          <path d={`M57 ${y}h20`} stroke="#5babc6" strokeOpacity=".55" strokeWidth="1" />
        </g>
      ))}
      <Pins side="l" at={[39]} from={120} len={5} />
      <Pins side="l" at={[79]} from={120} len={5} />
      <Router x={120} y={24} />
      <Router x={120} y={64} />
      <Pins side="r" at={[33, 45]} from={176} len={5} />
      <Pins side="r" at={[73, 85]} from={176} len={5} />
      <Trace pts={[[181, 33], [196, 33], [204, 36], [222, 36]]} />
      <Trace pts={[[181, 45], [200, 45], [205, 50], [222, 50]]} bus />
      <Trace pts={[[181, 73], [200, 73], [209, 64], [222, 64]]} bus />
      <Trace pts={[[181, 85], [196, 85], [203, 78], [222, 78]]} />

      {/* Backbone rail above the processor, tapped by two of its top pins. */}
      <Trace pts={[[150, 7], [410, 7]]} bus />
      <Via x={147.5} y={7} r={2} /><Via x={412.5} y={7} r={2} />
      <Trace pts={[[264, 15], [264, 7]]} /><Trace pts={[[312, 15], [312, 7]]} />

      {/* The autonomous system: processor with an AS core. */}
      <ellipse cx="286" cy="56" rx="88" ry="50" fill="url(#bgp-atlas-glow)" />
      <rect className="chh-chip-aura" x="217" y="11" width="138" height="90" rx="15" />
      <Pins side="l" at={out} from={228} len={6} />
      <Pins side="r" at={out} from={344} len={6} />
      <Pins side="t" at={[248, 264, 280, 296, 312, 328]} from={20} len={5} />
      <Pins side="b" at={[248, 264, 280, 296, 312, 328]} from={92} len={5} />
      <Body x={228} y={20} w={116} h={72} r={8} />
      <rect x="232" y="24" width="108" height="64" rx="6" fill="url(#bgp-atlas-fill)" stroke="#4f95ae" strokeWidth="1" />
      <rect x="228" y="20" width="116" height="72" rx="8" className="bgp-m-shell" />
      <rect className="chh-core-window" x="254" y="33" width="64" height="44" rx="6" />
      <path className="chh-core-bevel" d="M259 37h54" />
      <path className="chh-core-glyph" d="M266 64l6.5-18 6.5 18M268.6 58h7.8M300 48.6c-1.3-1.8-3.3-2.6-5.6-2.6-3.3 0-5.4 1.8-5.4 4.4 0 6.2 11.4 3.6 11.4 9.8 0 2.7-2.3 4.4-5.8 4.4-2.6 0-4.8-1-6.2-2.9" />
      <circle className="chh-core-node" cx="286" cy="71" r="1.7" />
      <Trace pts={[[280, 97], [280, 103]]} /><Smd x={280} y={107} vertical />

      {/* Routing outputs branch into an exchange bank... */}
      <Trace pts={[[350, 36], [370, 36], [382, 24], [420, 24]]} />
      <Trace pts={[[350, 50], [420, 50]]} bus />
      <Trace pts={[[350, 64], [420, 64]]} bus />
      <Trace pts={[[350, 78], [370, 78], [382, 90], [420, 90]]} />
      <Body x={420} y={16} w={22} h={84} r={3} />
      {[24, 37, 50, 64, 77, 90].map((y) => <circle key={y} className="chh-pad" cx="431" cy={y} r="2" />)}

      {/* ...then out to interconnection points: a peer router and edge vias. */}
      <Trace pts={[[442, 24], [480, 24], [490, 14], [546, 14]]} /><Via x={548.5} y={14} r={2} />
      <Trace pts={[[442, 37], [468, 37]]} /><Smd x={474} y={37} />
      <Trace pts={[[442, 50], [508, 50]]} bus />
      <Body x={508} y={40} w={34} h={20} r={3} />
      <rect x="513" y="45" width="10" height="10" rx="1.5" fill="#10283a" stroke="#386b85" strokeWidth=".8" />
      <rect x="527" y="45" width="10" height="10" rx="1.5" fill="#10283a" stroke="#386b85" strokeWidth=".8" />
      <Trace pts={[[542, 50], [566, 50]]} /><Via x={568.5} y={50} r={2} />
      <Trace pts={[[442, 64], [500, 64], [510, 74], [548, 74]]} /><Via x={550.5} y={74} r={2} />
      <Trace pts={[[442, 77], [470, 77], [480, 87], [530, 87]]} /><Via x={532.5} y={87} r={2} />
      <Trace pts={[[442, 90], [462, 90], [472, 100], [506, 100]]} /><Via x={508.5} y={100} r={2} />
    </svg>
  )
}

/** A state register on the timeline: three cells, its tap on the rail. */
function Register({ x }: { x: number }) {
  return (
    <g>
      <Body x={x} y={16} w={44} h={22} r={3} />
      {[0, 1, 2].map((i) => <rect key={i} x={x + 5 + i * 12.5} y={21.5} width={9} height={11} rx={1.5} fill="#10283a" stroke="#386b85" strokeWidth=".8" />)}
      <Trace pts={[[x + 22, 38], [x + 22, 55]]} />
      <circle cx={x + 22} cy={58} r={3} className="bgp-m-mark" />
    </g>
  )
}

const RAIL_Y = 58
const MINOR = Array.from({ length: 28 }, (_, i) => 30 + i * 20).filter((x) => x < 250 || x > 350)
const MAJOR = [50, 150, 450, 550]

/**
 * Routing Timeline: a graduated time rail carrying four state registers; a
 * comparator in the middle takes an earlier and a later state (− / +), and a
 * stepped trace below changes level where the states change.
 */
export function TimelineMotif() {
  return (
    <svg viewBox="0 0 600 116" preserveAspectRatio="xMidYMid meet" focusable="false" className="bgp-motif is-timeline">
      <defs>
        <radialGradient id="bgp-time-glow"><stop stopColor="#f2b866" stopOpacity=".12" /><stop offset="1" stopColor="#f2b866" stopOpacity="0" /></radialGradient>
        <linearGradient id="bgp-time-fill" x2="0" y2="1"><stop stopColor="#1a2a3a" /><stop offset="1" stopColor="#0a1520" /></linearGradient>
      </defs>

      {/* Graduated rail, interrupted by the comparator. */}
      <Trace pts={[[18, RAIL_Y], [256, RAIL_Y]]} bus />
      <Trace pts={[[344, RAIL_Y], [574, RAIL_Y]]} bus />
      <path className="bgp-m-tick" d={MINOR.map((x) => `M${x} ${RAIL_Y - 3}v6`).join('')} />
      <path className="bgp-m-tick is-major" d={MAJOR.map((x) => `M${x} ${RAIL_Y - 7}v14`).join('')} />
      <path className="bgp-m-now" d={`M570 ${RAIL_Y - 6}l9 6-9 6`} />

      {/* Four observed states along time. */}
      <Register x={48} />
      <Register x={158} />
      <Register x={398} />
      <Register x={508} />

      {/* Earlier and later states wired to the comparator. */}
      <Pins side="r" at={[27]} from={202} len={4} />
      <Trace pts={[[206, 27], [232, 27], [246, 46], [256, 46]]} />
      <Pins side="l" at={[27]} from={398} len={4} />
      <Trace pts={[[394, 27], [368, 27], [354, 46], [344, 46]]} />

      <ellipse cx="300" cy="58" rx="70" ry="48" fill="url(#bgp-time-glow)" />
      <rect className="bgp-m-aura" x="250" y="17" width="100" height="82" rx="14" />
      <Pins side="l" at={[46, 58, 70]} from={262} len={6} />
      <Pins side="r" at={[46, 58, 70]} from={338} len={6} />
      <Body x={262} y={26} w={76} h={64} r={7} />
      <rect x="265" y="29" width="70" height="58" rx="5" fill="url(#bgp-time-fill)" stroke="#6b5a40" strokeWidth="1" />
      <rect x="262" y="26" width="76" height="64" rx="7" className="bgp-m-shell is-amber" />
      <rect className="chh-core-window" x="274" y="38" width="52" height="40" rx="5" />
      <path d="M300 43v30" stroke="#3a5970" strokeWidth="1" />
      <path className="bgp-m-minus" d="M281 58h12" />
      <path className="bgp-m-plus" d="M307 58h12M313 52v12" />
      <Trace pts={[[244, 70], [256, 70]]} /><Via x={241.5} y={70} r={2} />
      <Trace pts={[[344, 70], [356, 70]]} /><Via x={358.5} y={70} r={2} />

      {/* State trace: changes level at each register. */}
      <path className="bgp-m-wave" d="M18 104H70V96H180V104H262M338 104H420V96H530V104H574" />
      <path className="bgp-m-wave is-faint" d="M262 104H338" />
    </svg>
  )
}
