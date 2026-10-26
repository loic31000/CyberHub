import { formatShortDay } from '@/bgp/format'
import type { ConnectorSnapshot } from '@/types/connector'
import { STATUS_LABEL, STATUS_TONE, freshnessOf, type DomainState, type Workspace } from './model'

/* One connector, with only what it reports about itself. */
function ConnectorRow({ connector }: { connector: ConnectorSnapshot }) {
  const freshness = freshnessOf(connector)
  return (
    <li className="nw26-source">
      <div className="nw26-source-head">
        <strong>{connector.name}</strong>
        <span className={`nw26-badge is-${STATUS_TONE[connector.status]}`}>{STATUS_LABEL[connector.status]}</span>
        {freshness === 'stale' && <span className="nw26-badge is-warn">Données anciennes</span>}
      </div>
      <p className="nw26-source-meta">
        {freshness === 'never'
          ? 'Aucune donnée synchronisée.'
          : `Dernière synchronisation réussie : ${formatShortDay(connector.last_success ?? '')}`}
      </p>
      {connector.last_error && (
        <p className="nw26-source-meta">Dernière erreur : {connector.last_error.message}</p>
      )}
    </li>
  )
}

/* A wire cut short: the domain waits for its source. */
function BrokenWire() {
  return (
    <svg className="nw26-cut" viewBox="0 0 132 12" aria-hidden="true" focusable="false">
      <path className="nw26-cut-wire" d="M0 6H52" />
      <path className="nw26-cut-mark" d="M60 11l5-10M68 11l5-10" />
      <path className="nw26-cut-ghost" d="M81 6H132" />
    </svg>
  )
}

/* The state of a connector-fed domain: never invents a source or a status. */
export default function SourceState({ state, ws }: { state: DomainState; ws: Workspace }) {
  switch (state.kind) {
    case 'loading':
      return <p className="nw26-empty" role="status">Vérification des sources…</p>
    case 'unknown':
      return (
        <div className="nw26-empty is-unknown" role="alert">
          <strong>État des sources inconnu</strong>
          <BrokenWire />
          <span>La liste des connecteurs n’a pas pu être lue. Aucune donnée n’est affichée.</span>
        </div>
      )
    case 'none':
      return (
        <div className="nw26-empty">
          <strong>Source non configurée</strong>
          <BrokenWire />
          <span>Aucune donnée disponible. Intégration prévue : {ws.planned}.</span>
        </div>
      )
    case 'sources':
      return <ul className="nw26-sources">{state.connectors.map((c) => <ConnectorRow key={c.id} connector={c} />)}</ul>
  }
}
