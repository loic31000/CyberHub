import type { CorrelationResult } from '@/types/correlation'
import { groupsOf } from './parts'

const ROW = 34
const WIDTH = 120
// The categories, read from the same helper as a real result (all empty here).
const GROUPS = groupsOf({} as CorrelationResult)

/*
 * The idle state: what the engine will consult, drawn like the result map but
 * unlit. It explains the module by showing its shape, not by a paragraph.
 */
export default function EngineOverview() {
  const height = GROUPS.length * ROW
  const mid = height / 2
  return (
    <section className="cr26-idle" aria-labelledby="cr26-idle-title">
      <div className="cr26-idle-copy">
        <span className="cr26-kicker">Moteur de corrélation</span>
        <h2 id="cr26-idle-title">Analysez un indicateur</h2>
        <p>Une adresse, un domaine, une empreinte ou une URL : CyberHub le rapproche de ses propres données et montre ce qui s’y rattache.</p>
      </div>
      <div className="cr26-idle-map" aria-hidden="true">
        <span className="cr26-idle-node">IOC</span>
        <svg className="cr26-map-wires" viewBox={`0 0 ${WIDTH} ${height}`} preserveAspectRatio="none" style={{ height }} focusable="false">
          {GROUPS.map((g, i) => {
            const y = i * ROW + ROW / 2
            return <path key={g.id} d={`M0 ${mid}H32C54 ${mid} 54 ${y} 76 ${y}H${WIDTH}`} />
          })}
        </svg>
        <ul style={{ gridTemplateRows: `repeat(${GROUPS.length}, ${ROW}px)` }}>
          {GROUPS.map(g => <li key={g.id}><i />{g.label}</li>)}
        </ul>
      </div>
    </section>
  )
}
