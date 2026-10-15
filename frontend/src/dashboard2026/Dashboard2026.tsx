import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, SlidersHorizontal } from 'lucide-react'
import NetworkGlobe from './NetworkGlobe'
import TerminalFlux from './TerminalFlux'
import CircuitBoard from './CircuitBoard'
import DashboardCircuit, { requestCircuitRecompute } from './DashboardCircuit'
import { CustomizeEnvironmentDialog, EnvironmentGrid } from './EnvironmentCards'
import { CustomizeDashboardDialog } from './CustomizeDashboardDialog'
import { PanelBody, PanelToggle, useCollapsible } from './CollapsiblePanel'
import { useDashboardLayout } from './useDashboardLayout'
import { useWidgetMasonry } from './useWidgetMasonry'
import { spanOf, type WidgetId, type WidgetPlacement } from './widgetRegistry'
import { DASHBOARD_MODULE, MODULES, type SystemCard } from './environmentRegistry'
import { useDashboardData, type Remote } from './useDashboardData'
import { BgpGlyph, CveGlyph, NetworkGlyph, PulseGlyph, RadarGlyph, SourcesGlyph, WatchGlyph } from './CyberGlyphs'
import './dashboard.css'

type CardStatus = Pick<SystemCard, 'status' | 'secondary' | 'tone'>

function stateText<T>(remote: Remote<T>, ready: (data: T) => string): string {
  if (remote.status === 'loading') return 'Chargement…'
  if (remote.status === 'error') return navigator.onLine ? 'Données indisponibles' : 'Hors connexion'
  return ready(remote.data)
}

const counted = (count: number, singular: string, plural: string) => `${count} ${count === 1 ? singular : plural}`

/* Compact empty state: what is missing, why, and where to act. Never a placeholder value. */
function EmptyState({ icon, title, children, retry, action }: { icon?: ReactNode; title: string; children?: ReactNode; retry?: () => void; action?: { label: string; onClick: () => void } }) {
  return <div className="dashboard-empty-state is-compact">
    {icon && <span className="empty-glyph" aria-hidden="true">{icon}</span>}
    <div className="empty-copy"><strong>{title}</strong>{children && <p>{children}</p>}</div>
    {retry ? <button type="button" className="panel-action" onClick={retry}>Réessayer</button>
      : action && <button type="button" className="text-action" onClick={action.onClick}>{action.label} <ChevronRight size={14} aria-hidden="true" /></button>}
  </div>
}

function TypedTitle() {
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => setTyping(true)) })
    return () => cancelAnimationFrame(frame)
  }, [])
  let step = 0
  const glyphs = (word: string) => [...word].map((char) => {
    const order = step++
    return <i key={order} className="typed-glyph" style={{ '--glyph': order } as CSSProperties}>{char}</i>
  })
  const first = glyphs('TERMINAL')
  step += 1
  const second = glyphs('OVERVIEW')
  return <h1 id="overview-title" className={`typed-title${typing ? ' is-typing' : ''}`}>
    <span className="sr-only">TERMINAL OVERVIEW</span>
    <i className="typed-word" aria-hidden="true">{first}</i>{' '}
    <span aria-hidden="true">{second}</span>
  </h1>
}

/* Labels of the API's own severity values (CVESeverity): nothing invented. */
const CVE_SEVERITY: Record<string, string> = {
  critical: 'CRITIQUE',
  high: 'ÉLEVÉE',
  medium: 'MOYENNE',
  low: 'FAIBLE',
  none: 'NON NOTÉE',
}

export default function Dashboard2026() {
  const navigate = useNavigate()
  const rootRef = useRef<HTMLDivElement>(null)
  const environmentLayout = useDashboardLayout()
  const data = useDashboardData()
  const operationsPanel = useCollapsible('operations-panel')
  const threatPanel = useCollapsible('threat-panel')
  const alertsPanel = useCollapsible('alerts-panel')
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [widgetsOpen, setWidgetsOpen] = useState(false)
  const customizeReturnFocus = useRef<HTMLElement | null>(null)
  const widgetsReturnFocus = useRef<HTMLElement | null>(null)
  const widgetGridRef = useRef<HTMLDivElement>(null)
  const widgetSignature = JSON.stringify(environmentLayout.widgets)
  useWidgetMasonry(widgetGridRef, widgetSignature)

  // Layout owns the scrolling element. Reserve its gutter and lock only it
  // while one of these dialogs is visible.
  useEffect(() => {
    const scroll = rootRef.current?.parentElement
    if (!scroll) return
    const previous = scroll.style.scrollbarGutter
    scroll.style.scrollbarGutter = 'stable'
    return () => { scroll.style.scrollbarGutter = previous }
  }, [])
  useEffect(() => {
    const scroll = rootRef.current?.parentElement
    if (!scroll || (!customizeOpen && !widgetsOpen)) return
    const previous = scroll.style.overflow
    scroll.style.overflow = 'hidden'
    return () => { scroll.style.overflow = previous }
  }, [customizeOpen, widgetsOpen])
  useEffect(() => { requestCircuitRecompute() }, [environmentLayout.envCards, widgetSignature, data.stats, data.bgp, data.cves])

  const openCustomize = (trigger: HTMLElement) => { customizeReturnFocus.current = trigger; setCustomizeOpen(true) }
  const openWidgets = (trigger: HTMLElement) => { widgetsReturnFocus.current = trigger; setWidgetsOpen(true) }
  const openDestination = (title: string) => {
    const module = [DASHBOARD_MODULE, ...MODULES].find((item) => item.title === title)
    if (module) navigate(module.route)
  }

  const bgpCount = data.bgp.status === 'ready' ? data.bgp.data.total : 0
  const statuses: Record<string, CardStatus> = {
    'system.console': {
      status: stateText(data.stats, (stats) => `${stats.tools_total} outils · ${stats.ctf_total} writeups`),
      secondary: 'Données de la Console', tone: data.stats.status === 'ready' ? 'ready' : 'quiet',
    },
    'system.mitre': { status: 'Accès au module', secondary: 'Consulter ATT&CK', tone: 'quiet' },
    'system.sources': {
      status: stateText(data.ioc, (ioc) => `${ioc.total} IOC enregistrés`),
      secondary: 'Indicateurs locaux', tone: data.ioc.status === 'ready' ? 'ready' : 'quiet',
    },
    'system.osint': { status: 'Accès au module', secondary: 'Lancer une recherche', tone: 'quiet' },
    'system.bgp': {
      status: stateText(data.bgp, (bgp) => bgp.total ? `${counted(bgp.total, 'alerte BGP enregistrée', 'alertes BGP enregistrées')}` : 'Aucune alerte BGP'),
      secondary: 'Historique BGP', tone: bgpCount ? 'attention' : data.bgp.status === 'ready' ? 'ready' : 'quiet',
    },
  }

  const widgetFrame = (placement: WidgetPlacement) => {
    const span = spanOf(placement)
    return {
      'data-widget': placement.id,
      'data-size': placement.size,
      style: { '--w-cols': span.cols, '--w-rows': span.rows, '--w-cols-tablet': span.colsTablet } as CSSProperties,
    }
  }
  const cves = data.cves.status === 'ready'
    ? [...data.cves.data.cves].sort((a, b) => (b.published_at || b.created_at).localeCompare(a.published_at || a.created_at)).slice(0, 3)
    : []

  const widgetViews: Record<WidgetId, (placement: WidgetPlacement) => ReactElement> = {
    network: (placement) => <section key="network" className="dashboard-panel network-panel widget" {...widgetFrame(placement)} aria-labelledby="network-title">
      <header className="panel-heading">
        <span className="panel-glyph is-network" aria-hidden="true"><NetworkGlyph size={18} /></span>
        <div><h2 id="network-title">ACTIVITÉ RÉSEAU (APERÇU)</h2><p>Globe géographique illustratif · aucune donnée de trafic réel.</p></div>
        <span className="range-select dashboard-demo-label">ILLUSTRATION</span>
      </header>
      <NetworkGlobe />
    </section>,
    operations: (placement) => <section key="operations" className={`dashboard-panel feed-panel widget${operationsPanel.open ? '' : ' is-collapsed'}`} {...widgetFrame(placement)} aria-labelledby="operations-title">
      <header className="panel-heading">
        <span className="panel-glyph is-ops" aria-hidden="true"><PulseGlyph size={18} /></span>
        <div><h2 id="operations-title">DERNIÈRES OPÉRATIONS</h2>{!operationsPanel.expanded && <p className="panel-summary">Historique indisponible</p>}</div>
        <div className="panel-tools"><button type="button" className="panel-action" aria-label="Voir les investigations" onClick={() => navigate('/investigations')}>Voir tout <ChevronRight size={14} /></button><PanelToggle collapsible={operationsPanel} label="Dernières opérations" /></div>
      </header>
      <PanelBody collapsible={operationsPanel}><EmptyState icon={<PulseGlyph size={17} />} title="Historique non disponible" action={{ label: 'Investigations', onClick: () => navigate('/investigations') }}>L’API du Dashboard ne fournit pas encore les opérations récentes.</EmptyState></PanelBody>
    </section>,
    threat: (placement) => <section key="threat" className={`dashboard-panel threat-panel widget${threatPanel.open ? '' : ' is-collapsed'}`} {...widgetFrame(placement)} aria-labelledby="threat-monitor-title">
      <header className="panel-heading threat-heading">
        <div className="threat-title"><span className="threat-beacon" aria-hidden="true"><RadarGlyph size={19} /><i /></span><span><h2 id="threat-monitor-title">THREAT MONITOR</h2><p className={threatPanel.expanded ? '' : 'panel-summary is-alert'}>{stateText(data.bgp, (bgp) => counted(bgp.total, 'alerte BGP', 'alertes BGP'))}</p></span></div>
        <div className="panel-tools"><button type="button" className="text-action" onClick={() => navigate('/bgp/historian')}>Voir tout <ChevronRight size={14} /></button><PanelToggle collapsible={threatPanel} label="Threat Monitor" /></div>
      </header>
      <PanelBody collapsible={threatPanel}>
        <div className="threat-status"><span className="threat-status-led" aria-hidden="true" /><span><small>HISTORIQUE BGP</small><strong>{stateText(data.bgp, (bgp) => bgp.total ? counted(bgp.total, 'alerte enregistrée', 'alertes enregistrées') : 'Aucune alerte enregistrée')}</strong></span></div>
        {data.bgp.status === 'ready' && data.bgp.data.items.length > 0 ? <ul className="threat-list">{data.bgp.data.items.slice(0, 2).map((alert) => <li key={alert.id}><button type="button" onClick={() => navigate('/bgp/historian')}><span className="threat-icon is-red"><BgpGlyph size={17} /></span><span className="threat-copy"><strong>AS{alert.asn} · {alert.alert_type.replace(/_/g, ' ')}</strong><small>{new Date(alert.detected_at).toLocaleDateString('fr-FR')} · {alert.acknowledged ? 'Acquittée' : 'Non acquittée'}</small></span><ChevronRight size={15} aria-hidden="true" /></button></li>)}</ul>
          : <EmptyState icon={<BgpGlyph size={17} />} retry={data.bgp.status === 'error' ? data.retry : undefined} title={data.bgp.status === 'loading' ? 'Chargement des alertes BGP…' : data.bgp.status === 'error' ? 'Alertes BGP indisponibles' : 'Aucune alerte BGP à afficher'} action={data.bgp.status === 'ready' ? { label: 'BGP Historian', onClick: () => navigate('/bgp/historian') } : undefined}>{data.bgp.status === 'ready' ? 'Les alertes détectées par BGP Historian apparaîtront ici.' : undefined}</EmptyState>}
        <div className="threat-foot"><span>{stateText(data.ioc, (ioc) => `${ioc.total} IOC enregistrés`)}</span><span>Aucune surveillance continue</span></div>
      </PanelBody>
    </section>,
    watch: (placement) => <section key="watch" className={`dashboard-panel feed-panel alert-panel widget${alertsPanel.open ? '' : ' is-collapsed'}`} {...widgetFrame(placement)} aria-labelledby="alerts-title">
      <header className="panel-heading">
        <span className="panel-glyph is-watch" aria-hidden="true"><WatchGlyph size={18} /></span>
        <div><h2 id="alerts-title">VEILLE CVE & SOURCES</h2><p className={alertsPanel.expanded ? '' : 'panel-summary'}>{stateText(data.cves, (response) => counted(response.count, 'CVE enregistrée', 'CVE enregistrées'))}</p></div>
        <div className="panel-tools"><button type="button" className="panel-action" onClick={() => navigate('/cve')}>Voir tout <ChevronRight size={14} /></button><PanelToggle collapsible={alertsPanel} label="Veille CVE et sources" /></div>
      </header>
      <PanelBody collapsible={alertsPanel}>
        {/* Preview of the three most recent CVE: id, real severity and date; the
            description is clamped to two lines on screen only, the full record
            opens on its CVE page. */}
        {cves.length ? <ul className="activity-list alert-list cve-preview">{cves.map((cve) => <li key={cve.id}><button type="button" className="cve-row" onClick={() => navigate(`/cve/${cve.id}`)}><span className={`feed-icon ${cve.severity === 'critical' ? 'is-red' : cve.severity === 'high' ? 'is-amber' : ''}`}><CveGlyph size={17} /></span><span className="feed-copy"><strong>{cve.cve_id}</strong><small className="cve-summary">{cve.description}</small></span><span className="cve-meta"><span className={`cve-severity is-${cve.severity}`}>{CVE_SEVERITY[cve.severity] ?? cve.severity}</span><time dateTime={cve.published_at || cve.created_at}>{new Date(cve.published_at || cve.created_at).toLocaleDateString('fr-FR')}</time></span></button></li>)}</ul>
          : <EmptyState icon={<CveGlyph size={17} />} retry={data.cves.status === 'error' ? data.retry : undefined} title={data.cves.status === 'loading' ? 'Chargement des CVE…' : data.cves.status === 'error' ? 'Veille CVE indisponible' : 'Aucune CVE enregistrée'} action={data.cves.status === 'ready' ? { label: 'CVE & KEV', onClick: () => navigate('/cve') } : undefined}>{data.cves.status === 'ready' ? 'Ajoutez ou importez des CVE depuis le module CVE & KEV.' : undefined}</EmptyState>}
      </PanelBody>
    </section>,
    sync: (placement) => <section key="sync" className="sync-panel widget" aria-labelledby="sync-title" {...widgetFrame(placement)}>
      <span className="sync-icon"><SourcesGlyph size={19} /></span><div className="sync-copy"><div><strong id="sync-title">DONNÉES LOCALES</strong><span>Contenu enregistré dans la Console · aucune synchronisation simulée</span><b>{stateText(data.tools, (tools) => `${tools.count} outils`)} · {stateText(data.ioc, (ioc) => `${ioc.total} IOC`)}</b></div></div>
    </section>,
  }

  const shownWidgets = environmentLayout.widgets.filter((placement) => placement.visible)
  const hiddenWidgets = environmentLayout.widgets.length - shownWidgets.length
  const hasError = [data.stats, data.tools, data.bgp, data.ioc, data.cves].some((value) => value.status === 'error')

  return <div className="cyber-dashboard-2026" ref={rootRef}>
    <CustomizeEnvironmentDialog open={customizeOpen} envCards={environmentLayout.envCards} onChange={environmentLayout.update} onReset={environmentLayout.reset} onClose={() => setCustomizeOpen(false)} returnFocus={customizeReturnFocus} persisted={environmentLayout.persisted} />
    <CustomizeDashboardDialog open={widgetsOpen} widgets={environmentLayout.widgets} onChange={environmentLayout.updateWidgets} onReset={environmentLayout.resetWidgets} onClose={() => setWidgetsOpen(false)} returnFocus={widgetsReturnFocus} persisted={environmentLayout.persisted} />
    <div className="main-content">
      <DashboardCircuit />
      <div className="workspace dashboard-board" id="dashboard-overview">
        <section className="overview-hero" aria-labelledby="overview-title"><TerminalFlux /><CircuitBoard /><div className="hero-copy"><span className="hero-breadcrumb">/ CORE / DASHBOARD</span><TypedTitle /><p>Votre espace de travail CyberHub, recherche, analyse et opérations depuis une interface unifiée.</p></div><div className="hero-index" aria-hidden="true"><span>CYBER INTELLIGENCE</span><span>OPEN SOURCE</span><span>DEFENSIVE OPERATIONS</span><span>THREAT ANALYSIS</span></div><p className="hero-session"><strong><i aria-hidden="true" />CONSOLE LOCALE</strong><span className="hero-session-mark">CH/TTY-01</span></p></section>
        <section className="dashboard-panel environment-panel" aria-labelledby="environment-title"><header className="panel-heading environment-heading"><div><h2 id="environment-title">ÉTAT DE L’ENVIRONNEMENT</h2><p>Modules et données disponibles dans la Console.</p></div><div className="environment-meta">{hasError && <button type="button" className="panel-action" onClick={data.retry}>Réessayer les données</button>}<button type="button" className="panel-action environment-customize" aria-haspopup="dialog" onClick={(event) => openCustomize(event.currentTarget)}><SlidersHorizontal size={14} aria-hidden="true" />Personnaliser</button><button type="button" className="panel-action" onClick={() => navigate('/tools')}>Voir les outils <ChevronRight size={14} /></button></div></header><EnvironmentGrid envCards={environmentLayout.envCards} statuses={statuses} onOpen={openDestination} onAdd={openCustomize} /></section>
        <div className="widget-toolbar"><p><span className="widget-toolbar-code">WIDGETS</span><span aria-hidden="true"> · </span><span>{shownWidgets.length} affiché{shownWidgets.length > 1 ? 's' : ''}{hiddenWidgets ? ` · ${hiddenWidgets} masqué${hiddenWidgets > 1 ? 's' : ''}` : ''}</span></p><button type="button" className="panel-action widget-customize" aria-haspopup="dialog" onClick={(event) => openWidgets(event.currentTarget)}><SlidersHorizontal size={14} aria-hidden="true" />Personnaliser le Dashboard</button></div>
        <div className="widget-grid" ref={widgetGridRef}>{shownWidgets.length ? shownWidgets.map((placement) => widgetViews[placement.id](placement)) : <div className="widget-empty"><p>Tous les widgets sont masqués.</p><button type="button" className="panel-action" onClick={(event) => openWidgets(event.currentTarget)}>Afficher des widgets</button></div>}</div>
        <footer className="page-foot"><span>CYBERHUB / TERMINAL OVERVIEW</span><span>Données de la Console · globe illustratif · circuit décoratif · aucune surveillance continue</span></footer>
      </div>
    </div>
  </div>
}
