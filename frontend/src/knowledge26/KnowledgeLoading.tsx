import { SOURCE_LABEL, type Source } from './model'
import type { Collections } from './useKnowledge'

/*
 * Initial-load scene. The Carousel / Registry are mounted only once every
 * source the view needs has settled, so the collection is composed once
 * instead of re-sorting (and replaying card arrivals) as each source answers.
 * Meanwhile this scene keeps the Atlas frame with ghost cards — no data, no
 * invented counts — and states the real status of each source.
 */

const state = (collections: Collections, source: Source) =>
  !collections[source] ? 'pending' : collections[source]!.error ? 'error' : 'ready'
const LABEL = { pending: 'chargement…', ready: 'prêt', error: 'indisponible' } as const

export default function KnowledgeLoading({ sources, collections }: { sources: readonly Source[]; collections: Collections }) {
  return <section className="ka-carousel ka-loading" role="status" aria-busy="true" aria-label="Chargement de l’index Atlas">
    <div className="ka-focus-label"><span>INDEX EN PRÉPARATION</span><span>{sources.length > 1 ? 'TOUTES LES SOURCES' : SOURCE_LABEL[sources[0]]}</span></div>
    <div className="ka-loading-stage" aria-hidden="true">
      <span className="ka-ghost is-side" /><span className="ka-ghost is-center" /><span className="ka-ghost is-side" />
    </div>
    <ul className="ka-loading-sources">{sources.map(source => {
      const value = state(collections, source)
      return <li key={source} data-state={value} data-source={source}><i aria-hidden="true" />{SOURCE_LABEL[source]} · {LABEL[value]}</li>
    })}</ul>
  </section>
}
