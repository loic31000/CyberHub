import type { ReactNode } from 'react'
import type { DomainSignal, WorkspaceId } from './model'

/*
 * The Network fabric: one scene where the four domains are branches of the
 * same system, converging on a central node. Line grammar, from real data only:
 * - no source: dark wire, cut near its port;
 * - real data: solid cyan wire and a lit port.
 * (A dotted wire is reserved for inferred links, as in the reading legend.)
 */

export type DomainId = Exclude<WorkspaceId, 'overview'>
type Side = 'top' | 'left' | 'right' | 'bottom'
const SIDE: Record<DomainId, Side> = { devices: 'top', traffic: 'left', routing: 'right', detections: 'bottom' }
const LIVE = new Set(['live', 'warn', 'bad'])

/* Wire from the port towards the centre: cut near the port when no source feeds it. */
function Wire({ tone, towardsPort }: { tone: string; towardsPort: boolean }) {
  const parts = [<i key="near" className="nw26-w-near" />, <i key="gap" className="nw26-w-gap" />, <i key="far" className="nw26-w-far" />]
  return <span className={`nw26-wire is-${tone}`} aria-hidden="true">{towardsPort ? parts.reverse() : parts}</span>
}

export type BranchInfo = { id: DomainId; label: string; signal: DomainSignal; note?: string; detail?: ReactNode }

function Branch({ info, focus }: { info: BranchInfo; focus: DomainId | null }) {
  const side = SIDE[info.id]
  const tone = info.signal.tone
  // The wire runs port → centre; on the right and bottom the centre comes first.
  const centreFirst = side === 'right' || side === 'bottom'
  const label = (
    <div className="nw26-branch-text">
      <span className="nw26-branch-name">{info.label}</span>
      <span className="nw26-branch-state">{info.signal.label}</span>
      {info.note && <span className="nw26-branch-note">{info.note}</span>}
      {info.detail}
    </div>
  )
  const port = <span className="nw26-port" aria-hidden="true" />
  const wire = <Wire tone={tone} towardsPort={centreFirst} />
  const dim = focus && focus !== info.id ? ' is-dim' : ''
  const on = focus === info.id ? ' is-focus' : ''
  return (
    <li className={`nw26-branch is-${side} is-${tone}${LIVE.has(tone) ? ' is-lit' : ''}${dim}${on}`}>
      {centreFirst ? <>{wire}{port}{label}</> : <>{label}{port}{wire}</>}
    </li>
  )
}

export default function NetworkFabric({ branches, focus }: { branches: BranchInfo[]; focus: DomainId | null }) {
  const lit = new Set(branches.filter((b) => LIVE.has(b.signal.tone)).map((b) => SIDE[b.id]))
  return (
    <section className={`nw26-fabric${focus ? ' has-focus' : ''}`} aria-label="État des domaines">
      <ul className="nw26-fabric-grid">
        {branches.map((b) => <Branch key={b.id} info={b} focus={focus} />)}
        <li className="nw26-hub" aria-hidden="true">
          <svg viewBox="0 0 200 200" focusable="false">
            <circle cx="100" cy="100" r="82" className="nw26-hub-ring" />
            {Array.from({ length: 36 }, (_, i) => {
              const a = (i * Math.PI) / 18
              const r2 = i % 9 === 0 ? 0 : i % 3 === 0 ? 72 : 76
              return r2 ? <path key={i} className={`nw26-hub-tick${i % 3 === 0 ? ' is-major' : ''}`} d={`M${100 + 82 * Math.cos(a)} ${100 + 82 * Math.sin(a)}L${100 + r2 * Math.cos(a)} ${100 + r2 * Math.sin(a)}`} /> : null
            })}
            <circle cx="100" cy="100" r="60" className="nw26-hub-ring is-inner" />
            <circle cx="100" cy="100" r="46" className="nw26-hub-core" />
            {(['top', 'right', 'bottom', 'left'] as Side[]).map((s) => {
              const [x1, y1, x2, y2] = { top: [100, 0, 100, 18], right: [200, 100, 182, 100], bottom: [100, 200, 100, 182], left: [0, 100, 18, 100] }[s]
              return (
                <g key={s} className={`nw26-hub-link${lit.has(s) ? ' is-lit' : ''}`}>
                  <path d={`M${x1} ${y1}L${x2} ${y2}`} />
                  <rect x={x2 - 4.5} y={y2 - 4.5} width="9" height="9" rx="1.6" />
                </g>
              )
            })}
            <text x="100" y="98" className="nw26-hub-name">NETWORK</text>
            <text x="100" y="113" className="nw26-hub-sub">FABRIC</text>
          </svg>
        </li>
      </ul>
    </section>
  )
}
