import type { CorrelationResult } from '@/types/correlation'
import { confidenceOf, groupsOf, typeLabel } from './parts'

const ROW = 44
const WIDTH = 120

/*
 * The result's centrepiece: the indicator on the left, wired to every category
 * the engine checks. A category with matches is lit and links to its chapter;
 * one without stays dark, so the map shows what was searched, not only what
 * was found. Nothing here is invented: counts come straight from the result.
 */
export default function CorrelationMap({ result }: { result: CorrelationResult }) {
  const groups = groupsOf(result)
  const c = confidenceOf(result.confidence)
  const height = groups.length * ROW
  const mid = height / 2
  const missing = groups.filter(g => g.count === 0)

  return (
    <section className="cr26-map" aria-labelledby="cr26-result-title">
      <div className="cr26-map-source">
        <span className="cr26-kicker">Indicateur · {typeLabel(result.ioc_type)}</span>
        <h2 id="cr26-result-title" className="cr26-ioc">{result.ioc_value}</h2>
        <div className="cr26-confidence" data-level={c.level}>
          <p className="cr26-confidence-read"><b>{c.pct}<small>%</small></b><span>{c.label}</span></p>
          <div className="cr26-scale" role="img" aria-label={`${c.label}, ${c.pct} %`}>
            <span className="cr26-scale-bands" aria-hidden="true"><i>Faible</i><i>Modérée</i><i>Forte</i></span>
            <span className="cr26-scale-mark" style={{ left: `${c.pct}%` }} aria-hidden="true" />
          </div>
          <p className="cr26-confidence-note">Pondération des liens trouvés dans les données locales — pas un niveau de menace.</p>
        </div>
      </div>

      <svg className="cr26-map-wires" viewBox={`0 0 ${WIDTH} ${height}`} preserveAspectRatio="none" style={{ height }} aria-hidden="true" focusable="false">
        {groups.map((g, i) => {
          const y = i * ROW + ROW / 2
          const bend = WIDTH * 0.45
          return <path key={g.id} className={g.count ? 'is-on' : undefined} d={`M0 ${mid}H${bend * 0.6}C${bend} ${mid} ${bend} ${y} ${bend * 1.4} ${y}H${WIDTH}`} />
        })}
      </svg>

      <nav className="cr26-map-targets" aria-label="Correspondances">
        <ul style={{ gridTemplateRows: `repeat(${groups.length}, ${ROW}px)` }}>
          {groups.map(g => (
            <li key={g.id} data-on={g.count > 0 || undefined}>
              {g.count > 0
                ? <a href={`#cr26-${g.id}`}><i aria-hidden="true" /><span>{g.label}</span><b>{g.count}</b></a>
                : <span className="cr26-map-off"><i aria-hidden="true" /><span>{g.label}</span><b aria-label="aucune">0</b></span>}
            </li>
          ))}
        </ul>
      </nav>
      {missing.length > 0 && missing.length < groups.length && (
        <p className="cr26-sr">Sans correspondance : {missing.map(g => g.label).join(', ')}.</p>
      )}
    </section>
  )
}
