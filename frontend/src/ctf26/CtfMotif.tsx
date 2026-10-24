import { Body, Pins, Smd, Trace, Via } from '@/hero/ModuleHero'

/*
 * CTF hero motif: a target (challenge) wired into a processor running a
 * terminal, whose bus drives a progression ladder that ends on a captured
 * flag. Static: no pulse, no filter. Decorative only (aria-hidden by the hero).
 */

const RINGS = [26, 18, 10]
const STEPS = [0, 1, 2, 3]

export default function CtfMotif() {
  return (
    <svg viewBox="0 0 600 116" preserveAspectRatio="xMidYMid meet" focusable="false" className="ct26-motif">
      <defs>
        <radialGradient id="ct26-core-glow"><stop stopColor="#00d4ff" stopOpacity=".12" /><stop offset="1" stopColor="#00d4ff" stopOpacity="0" /></radialGradient>
        <linearGradient id="ct26-core-fill" x2="0" y2="1"><stop stopColor="#152c42" /><stop offset="1" stopColor="#091521" /></linearGradient>
      </defs>

      {/* Target: the challenge, concentric rings with a locked centre. */}
      <ellipse cx="88" cy="58" rx="52" ry="48" fill="url(#ct26-core-glow)" />
      <Body x={52} y={22} w={72} h={72} r={10} />
      {RINGS.map((r, i) => <circle key={r} className={`ct26-m-ring${i === RINGS.length - 1 ? ' is-bull' : ''}`} cx={88} cy={58} r={r} />)}
      <circle className="ct26-m-dot" cx={88} cy={58} r={3.4} />
      <path className="ct26-m-cross" d="M88 20V32M88 84V96M50 58H62M114 58H126" />
      <Pins side="r" at={[40, 58, 76]} from={124} len={6} />
      <Trace pts={[[130, 40], [168, 40], [182, 44], [214, 44]]} />
      <Trace pts={[[130, 58], [214, 58]]} bus />
      <Trace pts={[[130, 76], [168, 76], [182, 72], [214, 72]]} />
      <Via x={168} y={40} r={2} /><Via x={168} y={76} r={2} />

      {/* Processor: the terminal where the challenge is solved. */}
      <ellipse cx="274" cy="58" rx="84" ry="50" fill="url(#ct26-core-glow)" />
      <rect className="chh-chip-aura" x="207" y="10" width="134" height="96" rx="15" />
      <Pins side="l" at={[44, 58, 72]} from={220} len={6} />
      <Pins side="r" at={[44, 58, 72]} from={328} len={6} />
      <Pins side="t" at={[242, 258, 274, 290, 306]} from={20} len={5} />
      <Pins side="b" at={[242, 258, 274, 290, 306]} from={96} len={5} />
      <Body x={220} y={20} w={108} h={76} r={8} />
      <rect x="224" y="24" width="100" height="68" rx="6" fill="url(#ct26-core-fill)" stroke="#4f95ae" strokeWidth="1" />
      <rect className="chh-core-window" x="244" y="31" width="60" height="54" rx="6" />
      <path className="ct26-m-prompt" d="M258 50l9 8-9 8" />
      <path className="ct26-m-cursor" d="M273 66H290" />
      <Trace pts={[[274, 101], [274, 106]]} /><Smd x={274} y={110} vertical />

      {/* Progression ladder: four steps rising toward the flag. */}
      <Trace pts={[[334, 44], [360, 44], [368, 36], [386, 36]]} />
      <Trace pts={[[334, 58], [386, 58]]} bus />
      <Trace pts={[[334, 72], [360, 72], [368, 80], [386, 80]]} />
      <Body x={386} y={20} w={118} h={76} r={5} />
      <path className="ct26-m-ladder" d="M396 86h98" />
      {STEPS.map(i => {
        const h = 12 + i * 12
        return <rect key={i} className="ct26-m-step" data-last={i === STEPS.length - 1} x={400 + i * 24} y={84 - h} width={16} height={h} rx={2} />
      })}

      {/* Captured flag on its pole. */}
      <Trace pts={[[504, 58], [540, 58]]} bus />
      <path className="ct26-m-pole" d="M548 26V92" />
      <path className="ct26-m-flag" d="M548 30h34l-8 10 8 10h-34z" />
      <Via x={548} y={94} r={2.6} />
    </svg>
  )
}
