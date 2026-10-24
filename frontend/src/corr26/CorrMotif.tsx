import { Body, Pins, Smd, Trace, Via } from '@/hero/ModuleHero'

/*
 * Correlation hero motif: one indicator on the left fans out into a
 * correlator chip whose window links it to a few nodes, then lands on a small
 * ATT&CK matrix where the matching techniques light up. Static: no pulse, no
 * filter. Decorative only (aria-hidden by the hero).
 */

const LINKS: [number, number][] = [[288, 38], [302, 56], [288, 74], [270, 64]]
const COLS = [410, 428, 446, 464, 482, 500]
const ROWS = [38, 52, 66]
const LIT = new Set(['428-38', '446-52', '482-52', '464-66', '410-66'])

export default function CorrMotif() {
  return (
    <svg viewBox="0 0 600 116" preserveAspectRatio="xMidYMid meet" focusable="false" className="cr26-motif">
      <defs>
        <radialGradient id="cr26-core-glow"><stop stopColor="#00d4ff" stopOpacity=".12" /><stop offset="1" stopColor="#00d4ff" stopOpacity="0" /></radialGradient>
        <linearGradient id="cr26-core-fill" x2="0" y2="1"><stop stopColor="#152c42" /><stop offset="1" stopColor="#091521" /></linearGradient>
      </defs>

      {/* The indicator under analysis. */}
      <Body x={70} y={40} w={66} h={32} r={5} />
      <path className="cr26-m-diamond" d="M90 56l7-7 7 7-7 7z" />
      <path className="cr26-m-text" d="M110 52h18M110 60h12" />
      <Trace pts={[[136, 50], [168, 50], [184, 36], [228, 36]]} />
      <Trace pts={[[136, 56], [228, 56]]} bus />
      <Trace pts={[[136, 62], [168, 62], [184, 76], [228, 76]]} />

      {/* Correlator: the indicator linked to what it touches. */}
      <ellipse cx="284" cy="56" rx="86" ry="50" fill="url(#cr26-core-glow)" />
      <rect className="chh-chip-aura" x="217" y="8" width="134" height="96" rx="15" />
      <Pins side="l" at={[36, 56, 76]} from={230} len={6} />
      <Pins side="r" at={[40, 56, 72]} from={338} len={6} />
      <Pins side="t" at={[252, 268, 284, 300, 316]} from={18} len={5} />
      <Pins side="b" at={[252, 268, 284, 300, 316]} from={94} len={5} />
      <Body x={230} y={18} w={108} h={76} r={8} />
      <rect x="234" y="22" width="100" height="68" rx="6" fill="url(#cr26-core-fill)" stroke="#4f95ae" strokeWidth="1" />
      <rect x="230" y="18" width="108" height="76" rx="8" className="cr26-m-shell" />
      <rect className="chh-core-window" x="252" y="28" width="64" height="56" rx="6" />
      {LINKS.map(([x, y]) => <path key={`${x}${y}`} className="cr26-m-link" d={`M262 56L${x} ${y}`} />)}
      <circle className="cr26-m-node is-source" cx="262" cy="56" r="4.4" />
      {LINKS.map(([x, y]) => <circle key={`n${x}${y}`} className="cr26-m-node" cx={x} cy={y} r="2.8" />)}
      <Trace pts={[[284, 99], [284, 104]]} /><Smd x={284} y={108} vertical />

      {/* ATT&CK matrix: the matching techniques light up. */}
      <Trace pts={[[344, 40], [372, 40], [382, 48], [396, 48]]} />
      <Trace pts={[[344, 56], [396, 56]]} bus />
      <Trace pts={[[344, 72], [372, 72], [382, 64], [396, 64]]} />
      <Body x={396} y={28} w={124} h={56} r={5} />
      {ROWS.map(y => COLS.map(x => (
        <rect key={`${x}-${y}`} className={`cr26-m-cell${LIT.has(`${x}-${y}`) ? ' is-on' : ''}`} x={x} y={y - 5} width={14} height={10} rx={1.6} />
      )))}
      <Trace pts={[[520, 44], [548, 44]]} /><Via x={550.5} y={44} r={2} />
      <Trace pts={[[520, 56], [556, 56]]} bus /><Via x={558.5} y={56} r={2} />
      <Trace pts={[[520, 68], [548, 68]]} /><Via x={550.5} y={68} r={2} />
    </svg>
  )
}
