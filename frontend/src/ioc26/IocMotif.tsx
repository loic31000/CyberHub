import { Arrival, Body, Pins, Pulse, Smd, Trace, Via } from '@/hero/ModuleHero'

/** An IOC entering a processor, passing through two validation registers. */
export default function IocMotif() {
  return <svg viewBox="0 0 600 116" preserveAspectRatio="xMidYMid meet" focusable="false">
    <defs>
      <radialGradient id="ioc26-chip-glow"><stop stopColor="#00d4ff" stopOpacity=".16"/><stop offset="1" stopColor="#00d4ff" stopOpacity="0"/></radialGradient>
      <linearGradient id="ioc26-chip-fill" x2="0" y2="1"><stop stopColor="#152c42"/><stop offset="1" stopColor="#091521"/></linearGradient>
    </defs>
    {/* Three incoming indicator lanes end on genuine processor pins. */}
    {[34, 53, 72].map((y, i) => <g key={y}>
      <Via x={46} y={y} r={2.3}/><Trace pts={[[48.5,y],[174,y]]} bus={i===1}/>
      <rect x={74+i*8} y={y-4} width={28} height={8} rx={2} fill="#102337" stroke="#2a516b" strokeWidth="1"/>
      <path d={`M${79+i*8} ${y}h18`} stroke="#5babc6" strokeOpacity=".55" strokeWidth="1"/>
    </g>)}
    <Pins side="l" at={[34,53,72]} from={180} len={6}/>
    <Pins side="r" at={[34,53,72]} from={292} len={6}/>
    <Pins side="t" at={[200,214,228,242,256,270]} from={19} len={5}/>
    <Pins side="b" at={[200,214,228,242,256,270]} from={87} len={5}/>
    <ellipse cx="236" cy="53" rx="83" ry="50" fill="url(#ioc26-chip-glow)"/>
    <rect className="chh-chip-aura" x="169" y="10" width="134" height="86" rx="15"/>
    <Body x={180} y={19} w={112} h={68} r={8}/>
    <rect x="184" y="22" width="104" height="62" rx="6" fill="url(#ioc26-chip-fill)" stroke="#4f95ae" strokeWidth="1"/>
    <rect className="chh-chip-shell" x="180" y="19" width="112" height="68" rx="8"/>
    <rect x="202" y="31" width="68" height="44" rx="6" fill="#091927" stroke="#477f9a" strokeWidth="1"/>
    <path d="M215 61V43h11v18m0-9h10m0-9v18h12V43m0 18h10V43" fill="none" stroke="#a3e9f5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="236" cy="68" r="1.7" fill="#00d4ff"/>
    {/* Output pins meet two register packages and a small terminal strip. */}
    <Trace pts={[[298,34],[340,34]]} bus/><Trace pts={[[298,53],[340,53]]} bus/><Trace pts={[[298,72],[340,72]]}/>
    <Body x={340} y={25} w={68} h={56} r={4}/>
    {[34,53,72].map(y=><g key={y}><rect x="349" y={y-4} width="16" height="8" rx="2" fill="#10283a" stroke="#386b85"/><rect x="377" y={y-4} width="20" height="8" rx="2" fill="#10283a" stroke="#386b85"/></g>)}
    <Pins side="l" at={[34,53,72]} from={340} len={5}/><Pins side="r" at={[34,53,72]} from={408} len={5}/>
    {[34,53,72].map(y=><Trace key={y} pts={[[413,y],[472,y]]} bus={y===53}/>)}
    <Body x={472} y={20} w={13} h={68} r={2}/>
    {[34,53,72].map(y=><g key={y}><circle className="chh-pad" cx="478.5" cy={y} r="2"/><Trace pts={[[485,y],[522,y]]}/><Via x={524} y={y} r={2}/></g>)}
    <Trace pts={[[228,92],[228,100]]}/><Smd x={228} y={104} vertical/>
    <Pulse path="M298 53H340" period={9} delay={-2} tone="cyan"/>
    <Arrival period={9} delay={-2}><rect x="340" y="25" width="68" height="56" rx="4" fill="none" stroke="#8fd3ff" strokeOpacity=".32" strokeWidth="2"/></Arrival>
  </svg>
}
