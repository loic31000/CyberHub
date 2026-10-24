import { Body, Pins, Smd, Trace, Via } from '@/hero/ModuleHero'

/*
 * Cheatsheets hero motif: a stack of reference cards (command sheets) feeds a
 * substitution processor whose core holds a {var} token, and its bus drives a
 * terminal emitting the final command line. Static: no pulse, no filter.
 * Decorative only (aria-hidden by the hero).
 */

const CARDS = [0, 1, 2]
const ROWS = [34, 46, 58, 70, 82]
const LINE_W = [40, 58, 30, 50]

export default function CheatsheetsMotif() {
  return (
    <svg viewBox="0 0 600 116" preserveAspectRatio="xMidYMid meet" focusable="false" className="cs26-motif">
      <defs>
        <radialGradient id="cs26-core-glow"><stop stopColor="#00d4ff" stopOpacity=".12" /><stop offset="1" stopColor="#00d4ff" stopOpacity="0" /></radialGradient>
        <linearGradient id="cs26-core-fill" x2="0" y2="1"><stop stopColor="#152c42" /><stop offset="1" stopColor="#091521" /></linearGradient>
      </defs>

      {/* Stack of reference cards, each with a few command rows. */}
      {CARDS.map(i => (
        <g key={i} transform={`translate(${i * 7} ${i * 5})`}>
          <rect className="cs26-m-card" x={40} y={16} width={74} height={62} rx={5} />
        </g>
      ))}
      {ROWS.map((y, r) => (
        <g key={y}>
          <rect className="cs26-m-row-sign" x={62} y={y - 2} width={5} height={4} rx={1} />
          <rect className="cs26-m-row" x={71} y={y - 1.5} width={LINE_W[r % LINE_W.length]} height={3} rx={1.5} />
        </g>
      ))}
      <Pins side="r" at={[40, 58, 76]} from={128} len={6} />
      <Trace pts={[[134, 40], [168, 40], [182, 44], [214, 44]]} />
      <Trace pts={[[134, 58], [214, 58]]} bus />
      <Trace pts={[[134, 76], [168, 76], [182, 72], [214, 72]]} />
      <Via x={168} y={40} r={2} /><Via x={168} y={76} r={2} />

      {/* Substitution processor: a {var} token sits in its core. */}
      <ellipse cx="274" cy="58" rx="84" ry="50" fill="url(#cs26-core-glow)" />
      <rect className="chh-chip-aura" x="207" y="10" width="134" height="96" rx="15" />
      <Pins side="l" at={[44, 58, 72]} from={220} len={6} />
      <Pins side="r" at={[44, 58, 72]} from={328} len={6} />
      <Pins side="t" at={[242, 258, 274, 290, 306]} from={20} len={5} />
      <Pins side="b" at={[242, 258, 274, 290, 306]} from={96} len={5} />
      <Body x={220} y={20} w={108} h={76} r={8} />
      <rect x="224" y="24" width="100" height="68" rx="6" fill="url(#cs26-core-fill)" stroke="#4f95ae" strokeWidth="1" />
      <rect className="chh-core-window" x="244" y="31" width="60" height="54" rx="6" />
      <text className="cs26-m-token" x={274} y={63}>{'{var}'}</text>
      <Trace pts={[[274, 101], [274, 106]]} /><Smd x={274} y={110} vertical />

      {/* Terminal: the final command line. */}
      <Trace pts={[[334, 44], [360, 44], [368, 36], [386, 36]]} />
      <Trace pts={[[334, 58], [386, 58]]} bus />
      <Trace pts={[[334, 72], [360, 72], [368, 80], [386, 80]]} />
      <Body x={386} y={20} w={128} h={76} r={5} />
      <path className="cs26-m-bar" d="M386 31H514" />
      <circle className="cs26-m-led" cx={395} cy={25.5} r={1.6} />
      <circle className="cs26-m-led" cx={401} cy={25.5} r={1.6} />
      <path className="cs26-m-prompt2" d="M396 46l7 6-7 6" />
      <path className="cs26-m-cmd" d="M408 52h92" />
      <path className="cs26-m-cmd is-dim" d="M396 66h104" />
      <path className="cs26-m-cmd is-dim" d="M396 78h70" />
      <rect className="cs26-m-caret" x={470} y={62} width={6} height={9} rx={1} />
      <Trace pts={[[514, 36], [548, 36]]} /><Via x={550.5} y={36} r={2} />
      <Trace pts={[[514, 58], [556, 58]]} bus /><Via x={558.5} y={58} r={2} />
      <Trace pts={[[514, 80], [548, 80]]} /><Via x={550.5} y={80} r={2} />
    </svg>
  )
}
