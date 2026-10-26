import type { ConnectorSnapshot, ConnectorStatus, ConnectorType } from '@/types/connector'

/*
 * Network workspace (#81): one stable URL per workspace, /network being
 * Overview. Devices, Traffic and Detections are fed by internal connectors
 * (#94) of a given type; Routing gathers the existing BGP tools.
 */

export type WorkspaceId = 'overview' | 'devices' | 'traffic' | 'detections' | 'routing'

export type Workspace = {
  id: WorkspaceId
  label: string
  path: string
  title: string
  summary: string
  /* Connector type feeding this workspace; absent for Overview and Routing. */
  connectorType?: ConnectorType
  /* Source planned by the roadmap, named as such, never as available. */
  planned?: string
}

export const WORKSPACES: Workspace[] = [
  { id: 'overview', label: 'Overview', path: '/network', title: 'Vue d’ensemble', summary: 'État des quatre domaines du réseau.' },
  { id: 'devices', label: 'Devices', path: '/network/devices', title: 'Appareils', summary: 'Inventaire des appareils vus sur le réseau local.', connectorType: 'network_inventory', planned: 'NetAlertX' },
  { id: 'traffic', label: 'Traffic', path: '/network/traffic', title: 'Trafic', summary: 'Connexions et protocoles observés.', connectorType: 'network_traffic', planned: 'Zeek' },
  { id: 'detections', label: 'Detections', path: '/network/detections', title: 'Détections', summary: 'Alertes des sondes de détection d’intrusion.', connectorType: 'network_detection', planned: 'Suricata' },
  { id: 'routing', label: 'Routing', path: '/network/routing', title: 'Routage', summary: 'Systèmes autonomes, préfixes et historique BGP.' },
]

export const workspace = (id: WorkspaceId) => WORKSPACES.find((w) => w.id === id) as Workspace

export const STATUS_LABEL: Record<ConnectorStatus, string> = {
  disabled: 'Désactivé',
  ready: 'Disponible',
  unavailable: 'Indisponible',
  degraded: 'Dégradé',
  syncing: 'Synchronisation',
  error: 'Erreur',
}

export const STATUS_TONE: Record<ConnectorStatus, 'ok' | 'quiet' | 'warn' | 'bad'> = {
  disabled: 'quiet',
  ready: 'ok',
  unavailable: 'quiet',
  degraded: 'warn',
  syncing: 'quiet',
  error: 'bad',
}

/* What the connectors endpoint returned, as the workspace sees it. */
export type ConnectorsResult =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'ready'; items: ConnectorSnapshot[] }

/* The honest state of one connector-fed domain. */
export type DomainState =
  | { kind: 'loading' }
  | { kind: 'unknown' } // the connectors endpoint failed: nothing can be said
  | { kind: 'none' } // no connector of this type exists yet
  | { kind: 'sources'; connectors: ConnectorSnapshot[] }

export function domainState(result: ConnectorsResult, type: ConnectorType): DomainState {
  if (result.state === 'loading') return { kind: 'loading' }
  if (result.state === 'error') return { kind: 'unknown' }
  const connectors = result.items.filter((c) => c.type === type)
  return connectors.length ? { kind: 'sources', connectors } : { kind: 'none' }
}

/* Freshness, only when a real source reports it. */
export function freshnessOf(c: ConnectorSnapshot): 'never' | 'stale' | 'fresh' {
  if (c.never_synced) return 'never'
  return c.stale ? 'stale' : 'fresh'
}

/* The BGP alerts recorded locally by BGP Historian. */
export type AlertsResult = { state: 'loading' } | { state: 'error' } | { state: 'ready'; total: number }

/*
 * One short signal per domain for the status rail and the hero topology,
 * derived only from what the workspace actually received.
 */
export type SignalTone = 'live' | 'idle' | 'warn' | 'bad' | 'unknown' | 'busy'
export type DomainSignal = { label: string; tone: SignalTone }

export function connectorSignal(state: DomainState): DomainSignal {
  switch (state.kind) {
    case 'loading': return { label: 'Vérification', tone: 'busy' }
    case 'unknown': return { label: 'État inconnu', tone: 'unknown' }
    case 'none': return { label: 'Source non configurée', tone: 'idle' }
    case 'sources': {
      const list = state.connectors
      const tone: SignalTone = list.some((c) => c.status === 'error') ? 'bad'
        : list.some((c) => c.status === 'degraded' || (c.stale && !c.never_synced)) ? 'warn'
          : list.some((c) => c.status === 'ready') ? 'live' : 'idle'
      return { label: list.length === 1 ? STATUS_LABEL[list[0].status] : `${list.length} sources`, tone }
    }
  }
}

export function routingSignal(alerts: AlertsResult): DomainSignal {
  if (alerts.state === 'loading') return { label: 'Lecture locale', tone: 'busy' }
  if (alerts.state === 'error') return { label: 'Alertes illisibles', tone: 'unknown' }
  if (alerts.total === 0) return { label: 'Aucune alerte locale', tone: 'live' }
  return { label: `${alerts.total} alerte${alerts.total > 1 ? 's' : ''} locale${alerts.total > 1 ? 's' : ''}`, tone: 'live' }
}

export function signalsOf(connectors: ConnectorsResult, alerts: AlertsResult): Record<Exclude<WorkspaceId, 'overview'>, DomainSignal> {
  return {
    devices: connectorSignal(domainState(connectors, 'network_inventory')),
    traffic: connectorSignal(domainState(connectors, 'network_traffic')),
    detections: connectorSignal(domainState(connectors, 'network_detection')),
    routing: routingSignal(alerts),
  }
}
