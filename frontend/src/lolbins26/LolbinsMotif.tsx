import { Body, Pins, Smd, Trace, Via } from '@/hero/ModuleHero'

/*
 * LOLBins hero motif: a native system binary feeds an analysis processor whose
 * core holds an ATT&CK target; its bus drives a capability matrix (a grid of
 * technique cells) ending on a terminal command line. Static: no pulse, no
 * filter. Decorative only (aria-hidden by the hero).
 */

const MATRIX_COLS = [402, 418, 434, 450, 466]
const MATRIX_ROWS = [34, 50, 66, 82]
const LIT = new Set(['402-50', '434-34', '450-66', '418-82', '466-50'])

export default function LolbinsMotif() {
  return (
    <svg viewBox="0 0 600 116" preserveAspectRatio="xMidYMid meet" focusable="false" className="lb26-motif">
      <defs>
        <radialGradient id="lb26-core-glow"><stop stopColor="#00d4ff" stopOpacity=".12" /><stop offset="1" stopColor="#00d4ff" stopOpacity="0" /></radialGradient>
        <linearGradient id="lb26-core-fill" x2="0" y2="1"><stop stopColor="#152c42" /><stop offset="1" stopColor="#091521" /></linearGradient>
      </defs>

      {/* Native binary: a package with a prompt glyph, trusted by the system. */}
      <Body x={44} y={30} w={72} h={56} r={6} />
      <rect x="48" y="34" width="64" height="48" rx="4" fill="#0c1c2b" stroke="#39647e" strokeWidth="1" />
      <path className="lb26-m-binprompt" d="M58 50l8 8-8 8" />
      <path className="lb26-m-binline" d="M74 66h22" />
      <text className="lb26-m-ext" x={80} y={44}>.exe</text>
      <Pins side="r" at={[42, 58, 74]} from={116} len={6} />
      <Trace pts={[[122, 42], [160, 42], [176, 44], [214, 44]]} />
      <Trace pts={[[122, 58], [214, 58]]} bus />
      <Trace pts={[[122, 74], [160, 74], [176, 72], [214, 72]]} />
      <Via x={160} y={42} r={2} /><Via x={160} y={74} r={2} />

      {/* Analysis processor: an ATT&CK target in its core. */}
      <ellipse cx="274" cy="58" rx="84" ry="50" fill="url(#lb26-core-glow)" />
      <rect className="chh-chip-aura" x="207" y="10" width="134" height="96" rx="15" />
      <Pins side="l" at={[44, 58, 72]} from={220} len={6} />
      <Pins side="r" at={[44, 58, 72]} from={328} len={6} />
      <Pins side="t" at={[242, 258, 274, 290, 306]} from={20} len={5} />
      <Pins side="b" at={[242, 258, 274, 290, 306]} from={96} len={5} />
      <Body x={220} y={20} w={108} h={76} r={8} />
      <rect x="224" y="24" width="100" height="68" rx="6" fill="url(#lb26-core-fill)" stroke="#4f95ae" strokeWidth="1" />
      <rect className="chh-core-window" x="244" y="31" width="60" height="54" rx="6" />
      <circle className="lb26-m-ring" cx="274" cy="58" r="18" />
      <circle className="lb26-m-ring is-in" cx="274" cy="58" r="10" />
      <circle className="lb26-m-dot" cx="274" cy="58" r="3" />
      <path className="lb26-m-cross" d="M274 34V44M274 72V82M250 58H260M288 58H298" />
      <Trace pts={[[274, 101], [274, 106]]} /><Smd x={274} y={110} vertical />

      {/* Capability matrix: a grid of ATT&CK cells, a few lit. */}
      <Trace pts={[[334, 44], [360, 44], [372, 36], [388, 36]]} />
      <Trace pts={[[334, 58], [388, 58]]} bus />
      <Trace pts={[[334, 72], [360, 72], [372, 80], [388, 80]]} />
      <Body x={388} y={18} w={96} h={80} r={5} />
      {MATRIX_ROWS.map(y => MATRIX_COLS.map(x => (
        <rect key={`${x}-${y}`} className={`lb26-m-cell${LIT.has(`${x}-${y}`) ? ' is-lit' : ''}`} x={x} y={y - 5} width={11} height={10} rx={1.5} />
      )))}

      {/* Terminal: the resulting command line. */}
      <Trace pts={[[484, 44], [506, 44], [512, 40], [520, 40]]} />
      <Trace pts={[[484, 58], [520, 58]]} bus />
      <Trace pts={[[484, 72], [506, 72], [512, 78], [520, 78]]} />
      <Body x={520} y={28} w={62} h={60} r={5} />
      <path className="lb26-m-binprompt" d="M528 48l6 6-6 6" />
      <path className="lb26-m-cmd" d="M538 54h36" />
      <path className="lb26-m-cmd is-dim" d="M528 68h46" />
      <rect className="lb26-m-caret" x={560} y={50} width={5} height={8} rx={1} />
    </svg>
  )
}
