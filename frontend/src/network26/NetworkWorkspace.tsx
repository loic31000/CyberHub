import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { bgpApi, connectorsApi } from '@/api/client'
import { ModuleHero, type HeroIndex } from '@/hero/ModuleHero'
import NetworkFabric, { type BranchInfo, type DomainId } from './NetworkFabric'
import NetworkMotif from './NetworkMotif'
import { readVisits } from '@/bgp/visits'
import SourceState from './SourceState'
import {
  WORKSPACES, domainState, signalsOf, workspace,
  type AlertsResult, type ConnectorsResult, type Workspace,
} from './model'
import './network.css'

const DOMAINS = WORKSPACES.filter((w) => w.id !== 'overview') as (Workspace & { id: DomainId })[]

/* The real number of BGP alerts BGP Historian recorded in the local base. */
function AlertsFigure({ alerts }: { alerts: AlertsResult }) {
  if (alerts.state === 'loading') return <><strong className="nw26-figure is-muted">…</strong><span role="status">Lecture des alertes locales…</span></>
  if (alerts.state === 'error') return <><strong className="nw26-figure is-muted">—</strong><span>Alertes BGP locales illisibles.</span></>
  const n = alerts.total
  return (
    <>
      <strong className="nw26-figure">{n}</strong>
      <span>{n === 0 ? 'Aucune alerte BGP enregistrée.' : `alerte${n > 1 ? 's' : ''} BGP enregistrée${n > 1 ? 's' : ''}.`}</span>
    </>
  )
}

/* The Routing reading, set right next to its branch on the Overview. */
function RoutingDetail({ alerts }: { alerts: AlertsResult }) {
  return (
    <div className="nw26-detail">
      <p className="nw26-figure-line"><AlertsFigure alerts={alerts} /></p>
      <p className="nw26-provenance">BGP Historian · base locale CyberHub</p>
      <Link to="/network/routing" className="nw26-cta">Ouvrir Routing <ArrowRight size={14} aria-hidden="true" /></Link>
    </div>
  )
}

/* The hero's status line: only the local BGP alerts are known for sure. */
function heroStatus(alerts: AlertsResult): HeroIndex['status'] {
  if (alerts.state === 'loading') return { text: 'Lecture locale', tone: 'busy' }
  if (alerts.state === 'error') return { text: 'Alertes illisibles', tone: 'warn' }
  return { text: `${alerts.total} alerte${alerts.total > 1 ? 's' : ''} BGP`, mark: 'LOCAL', tone: 'ok' }
}

/* Observed / inferred, in the background. */
function Legend() {
  return (
    <section className="nw26-legend" aria-label="Lecture des données">
      <span className="nw26-legend-item"><span className="nw26-mark is-observed" aria-hidden="true" /><b>Observé</b> fait provenant d’une source</span>
      <span className="nw26-legend-item"><span className="nw26-mark is-inferred" aria-hidden="true" /><b>Déduit</b> interprétation CyberHub</span>
      <span className="nw26-legend-rule">Sans provenance, aucune donnée n’est présentée.</span>
    </section>
  )
}

function SourceWorkspace({ ws, connectors }: { ws: Workspace; connectors: ConnectorsResult }) {
  return (
    <section className="nw26-view" aria-labelledby={`nw26-${ws.id}`}>
      <h2 id={`nw26-${ws.id}`} className="nw26-title">{ws.title}</h2>
      <p className="nw26-note">{ws.summary}</p>
      <SourceState state={domainState(connectors, ws.connectorType!)} ws={ws} />
    </section>
  )
}

/* The two specialised BGP instruments Routing leads to; they keep their own pages. */
const INSTRUMENTS = [
  { to: '/bgp', name: 'BGP Lookup', cta: 'Ouvrir BGP Lookup', uses: ['ASN et adresses IP', 'Préfixes IPv4 / IPv6', 'Peers et transit', 'Snapshot · export IOC'] },
  { to: '/bgp/historian', name: 'BGP Historian', cta: 'Ouvrir BGP Historian', uses: ['Alertes de routage', 'Snapshots', 'Comparaison avant / après', 'Historique d’un ASN'] },
]

function Routing({ alerts }: { alerts: AlertsResult }) {
  const ws = workspace('routing')
  // Only an ASN really opened in BGP Lookup during this session is offered as a pivot.
  const [lastASN] = useState(() => readVisits()[0] ?? null)
  return (
    <section className="nw26-view" aria-labelledby="nw26-routing">
      <h2 id="nw26-routing" className="nw26-title">{ws.title}</h2>
      <p className="nw26-note">{ws.summary} Deux instruments spécialisés, chacun sur sa page.</p>
      <div className="nw26-routing-body">
        <div className="nw26-detail">
          <p className="nw26-figure-line"><AlertsFigure alerts={alerts} /></p>
          <p className="nw26-provenance">Source : BGP Historian · base locale CyberHub</p>
          {lastASN !== null && (
            <div className="nw26-pivot">
              <span className="nw26-provenance">Dernier ASN ouvert dans BGP Lookup (cette session)</span>
              <strong className="nw26-pivot-asn">AS{lastASN}</strong>
              <span className="nw26-pivot-links">
                <Link to={`/bgp?asn=${lastASN}`}>Lookup</Link>
                <Link to={`/bgp/historian?asn=${lastASN}`}>Historique</Link>
              </span>
            </div>
          )}
        </div>
        <ul className="nw26-links" aria-label="Instruments BGP">
          {INSTRUMENTS.map((tool) => (
            <li key={tool.to}>
              <Link to={tool.to} className="nw26-link" aria-label={tool.cta}>
                <strong>{tool.name}</strong>
                <span>{tool.uses.join(' · ')}</span>
                <span className="nw26-link-cta">{tool.cta}</span>
                <ArrowRight size={15} aria-hidden="true" className="nw26-go" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default function NetworkWorkspace() {
  const [connectors, setConnectors] = useState<ConnectorsResult>({ state: 'loading' })
  const [alerts, setAlerts] = useState<AlertsResult>({ state: 'loading' })
  const tabsRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()

  // On a narrow screen the tab strip scrolls: keep the active workspace visible.
  // Done again once the web fonts are in: they change the tabs' widths.
  useEffect(() => {
    let live = true
    const reveal = () => {
      if (live) tabsRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    }
    reveal()
    document.fonts?.ready.then(reveal).catch(() => {})
    return () => { live = false }
  }, [pathname])

  useEffect(() => {
    let live = true
    connectorsApi.list()
      .then((r) => { if (live) setConnectors({ state: 'ready', items: Array.isArray(r?.items) ? r.items : [] }) })
      .catch(() => { if (live) setConnectors({ state: 'error' }) })
    bgpApi.getAlerts(1, 0)
      .then((r) => { if (live) setAlerts({ state: 'ready', total: r.total }) })
      .catch(() => { if (live) setAlerts({ state: 'error' }) })
    return () => { live = false }
  }, [])

  const signals = signalsOf(connectors, alerts)
  // The workspace in view takes the focus of the fabric; Overview shows it whole.
  const focus = DOMAINS.find((d) => pathname === d.path)?.id ?? null
  const branches: BranchInfo[] = DOMAINS.map((d) => ({
    id: d.id,
    label: d.label,
    signal: signals[d.id],
    note: d.planned && domainState(connectors, d.connectorType!).kind === 'none' ? `${d.planned} prévu` : undefined,
    detail: d.id === 'routing' && !focus ? <RoutingDetail alerts={alerts} /> : undefined,
  }))

  return (
    <div className="nw26">
      <div className="nw26-frame">
        <ModuleHero
          breadcrumb="OPS / NETWORK" title="NETWORK" typeOnce="network"
          subtitle="Appareils, trafic, détections et routage, chacun relié à sa source."
          motif={<NetworkMotif />}
          index={{ label: 'NETWORK', lines: ['DEVICES · TRAFFIC', 'DETECTIONS', 'ROUTING'], status: heroStatus(alerts) }}
        />
        <div className="nw26-surface">
        <nav ref={tabsRef} className="nw26-tabs" aria-label="Espaces Network">
          <ul>
            {WORKSPACES.map((w, i) => (
              <li key={w.id}>
                <NavLink to={w.path} end={w.id === 'overview'} className={({ isActive }) => `nw26-tab${isActive ? ' is-active' : ''}`}>
                  <span className="nw26-tab-index" aria-hidden="true">{String(i).padStart(2, '0')}</span>
                  <span className="nw26-tab-label">{w.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <NetworkFabric branches={branches} focus={focus} />
        </div>
        <Routes>
          <Route index element={<h2 className="nw26-sr">Domaines</h2>} />
          {(['devices', 'traffic', 'detections'] as const).map((id) => (
            <Route key={id} path={id} element={<SourceWorkspace ws={workspace(id)} connectors={connectors} />} />
          ))}
          <Route path="routing" element={<Routing alerts={alerts} />} />
          <Route path="*" element={<Navigate to="/network" replace />} />
        </Routes>
        <Legend />
      </div>
    </div>
  )
}
