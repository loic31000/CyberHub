import { Body, Pins, Smd, Trace, Via } from '@/hero/ModuleHero'

/*
 * Reverse Shell hero motif: a session endpoint (LHOST:LPORT) feeds a language
 * processor whose core holds a prompt; its bus splits into two outputs — a
 * payload stream and a listener line. Static: no pulse, no filter. Decorative
 * only (aria-hidden by the hero).
 */

const PAYLOAD_LINES = [{ y: 40, w: 60 }, { y: 50, w: 44 }, { y: 60, w: 54 }]

export default function RevShellMotif() {
  return (
    <svg viewBox="0 0 600 116" preserveAspectRatio="xMidYMid meet" focusable="false" className="rs26-motif">
      <defs>
        <radialGradient id="rs26-core-glow"><stop stopColor="#00d4ff" stopOpacity=".12" /><stop offset="1" stopColor="#00d4ff" stopOpacity="0" /></radialGradient>
        <linearGradient id="rs26-core-fill" x2="0" y2="1"><stop stopColor="#152c42" /><stop offset="1" stopColor="#091521" /></linearGradient>
      </defs>

      {/* Session endpoint: LHOST : LPORT on a small module. */}
      <Body x={42} y={34} w={76} h={48} r={5} />
      <rect x="46" y="38" width="68" height="40" rx="4" fill="#0c1c2b" stroke="#39647e" strokeWidth="1" />
      <text className="rs26-m-host" x={80} y={55}>LHOST</text>
      <text className="rs26-m-port" x={80} y={70}>:LPORT</text>
      <Pins side="r" at={[46, 70]} from={118} len={6} />
      <Trace pts={[[124, 46], [158, 46], [172, 48], [214, 48]]} />
      <Trace pts={[[124, 70], [158, 70], [172, 68], [214, 68]]} />
      <Trace pts={[[134, 58], [214, 58]]} bus />
      <Via x={158} y={46} r={2} /><Via x={158} y={70} r={2} />

      {/* Language processor: a prompt in its core. */}
      <ellipse cx="274" cy="58" rx="84" ry="50" fill="url(#rs26-core-glow)" />
      <rect className="chh-chip-aura" x="207" y="10" width="134" height="96" rx="15" />
      <Pins side="l" at={[44, 58, 72]} from={220} len={6} />
      <Pins side="r" at={[44, 58, 72]} from={328} len={6} />
      <Pins side="t" at={[242, 258, 274, 290, 306]} from={20} len={5} />
      <Pins side="b" at={[242, 258, 274, 290, 306]} from={96} len={5} />
      <Body x={220} y={20} w={108} h={76} r={8} />
      <rect x="224" y="24" width="100" height="68" rx="6" fill="url(#rs26-core-fill)" stroke="#4f95ae" strokeWidth="1" />
      <rect className="chh-core-window" x="244" y="31" width="60" height="54" rx="6" />
      <path className="rs26-m-prompt" d="M258 50l9 8-9 8" />
      <path className="rs26-m-cursor" d="M274 66h16" />
      <Trace pts={[[274, 101], [274, 106]]} /><Smd x={274} y={110} vertical />

      {/* Payload stream (green) and listener line (amber). */}
      <Trace pts={[[334, 50], [360, 50], [372, 42], [390, 42]]} />
      <Trace pts={[[334, 66], [360, 66], [372, 78], [390, 78]]} />
      <Trace pts={[[334, 58], [390, 58]]} bus />
      <Body x={390} y={24} w={128} h={44} r={5} />
      <path className="rs26-m-plabel" d="M400 35h5" />
      {PAYLOAD_LINES.map(({ y, w }) => <path key={y} className="rs26-m-payload" d={`M400 ${y - 4}h${w}`} />)}
      <Body x={390} y={74} w={128} h={26} r={5} />
      <path className="rs26-m-lprompt" d="M400 83l5 4-5 4" />
      <path className="rs26-m-listener" d="M410 87h86" />
      <Trace pts={[[518, 42], [548, 42]]} /><Via x={550.5} y={42} r={2} />
      <Trace pts={[[518, 58], [556, 58]]} bus /><Via x={558.5} y={58} r={2} />
      <Trace pts={[[518, 87], [548, 87]]} /><Via x={550.5} y={87} r={2} />
    </svg>
  )
}
