import { Body, Pins, Smd, Trace, Via } from '@/hero/ModuleHero'

/*
 * Encoder/Decoder hero motif: two raw input streams feed a central transform
 * processor (an fx core), whose bus drives one structured output stream into a
 * terminal. Static: no pulse, no filter. Decorative only (aria-hidden by the
 * hero).
 */

const OUT_LINES = [{ y: 46, w: 40 }, { y: 58, w: 58 }, { y: 70, w: 32 }]

export default function EncoderMotif() {
  return (
    <svg viewBox="0 0 600 116" preserveAspectRatio="xMidYMid meet" focusable="false" className="en26-motif">
      <defs>
        <radialGradient id="en26-core-glow"><stop stopColor="#00d4ff" stopOpacity=".12" /><stop offset="1" stopColor="#00d4ff" stopOpacity="0" /></radialGradient>
        <linearGradient id="en26-core-fill" x2="0" y2="1"><stop stopColor="#152c42" /><stop offset="1" stopColor="#091521" /></linearGradient>
      </defs>

      {/* Two raw input streams: a card of bits each. */}
      <Body x={40} y={16} w={70} h={34} r={5} />
      <Body x={40} y={62} w={70} h={34} r={5} />
      {[22, 68].map(oy => [0, 1, 2].map(r => (
        <g key={`${oy}-${r}`}>
          <rect className="en26-m-bit" x={50} y={oy + r * 8} width={7} height={5} rx={1} />
          <rect className="en26-m-bit is-alt" x={61} y={oy + r * 8} width={7} height={5} rx={1} />
          <rect className="en26-m-bit" x={72} y={oy + r * 8} width={7} height={5} rx={1} />
          <rect className="en26-m-bit is-alt" x={83} y={oy + r * 8} width={7} height={5} rx={1} />
          <rect className="en26-m-bit" x={94} y={oy + r * 8} width={7} height={5} rx={1} />
        </g>
      )))}
      <Pins side="r" at={[33, 79]} from={110} len={6} />
      <Trace pts={[[116, 33], [150, 33], [168, 48], [214, 48]]} />
      <Trace pts={[[116, 79], [150, 79], [168, 68], [214, 68]]} />
      <Trace pts={[[132, 58], [214, 58]]} bus />
      <Via x={150} y={33} r={2} /><Via x={150} y={79} r={2} />

      {/* Transform processor: an fx core. */}
      <ellipse cx="274" cy="58" rx="84" ry="50" fill="url(#en26-core-glow)" />
      <rect className="chh-chip-aura" x="207" y="10" width="134" height="96" rx="15" />
      <Pins side="l" at={[44, 58, 72]} from={220} len={6} />
      <Pins side="r" at={[44, 58, 72]} from={328} len={6} />
      <Pins side="t" at={[242, 258, 274, 290, 306]} from={20} len={5} />
      <Pins side="b" at={[242, 258, 274, 290, 306]} from={96} len={5} />
      <Body x={220} y={20} w={108} h={76} r={8} />
      <rect x="224" y="24" width="100" height="68" rx="6" fill="url(#en26-core-fill)" stroke="#4f95ae" strokeWidth="1" />
      <rect className="chh-core-window" x="244" y="31" width="60" height="54" rx="6" />
      <path className="en26-m-swap" d="M258 50h24l-6-5m6 5-6 5" />
      <path className="en26-m-swap" d="M290 66h-24l6-5m-6 5 6 5" />
      <Trace pts={[[274, 101], [274, 106]]} /><Smd x={274} y={110} vertical />

      {/* Structured output stream into a terminal. */}
      <Trace pts={[[334, 44], [360, 44], [372, 40], [388, 40]]} />
      <Trace pts={[[334, 58], [388, 58]]} bus />
      <Trace pts={[[334, 72], [360, 72], [372, 76], [388, 76]]} />
      <Body x={388} y={22} w={150} h={72} r={5} />
      <path className="en26-m-bar" d="M388 33H538" />
      <circle className="en26-m-led" cx={397} cy={27.5} r={1.6} />
      <circle className="en26-m-led" cx={403} cy={27.5} r={1.6} />
      {OUT_LINES.map(({ y, w }) => (
        <g key={y}>
          <path className="en26-m-sign" d={`M398 ${y}h5`} />
          <path className="en26-m-outline" d={`M407 ${y}h${w}`} />
        </g>
      ))}
      <rect className="en26-m-caret" x={452} y={54} width={5} height={8} rx={1} />
      <Trace pts={[[538, 40], [566, 40]]} /><Via x={568.5} y={40} r={2} />
      <Trace pts={[[538, 58], [572, 58]]} bus /><Via x={574.5} y={58} r={2} />
      <Trace pts={[[538, 76], [566, 76]]} /><Via x={568.5} y={76} r={2} />
    </svg>
  )
}
