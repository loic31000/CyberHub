import { useEffect, useRef } from 'react'
import type { ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardCircuit, { requestCircuitRecompute } from './DashboardCircuit'
import { DashboardHero } from './components/DashboardHero'
import { EnvironmentSection } from './components/EnvironmentSection'
import { WidgetGrid, WidgetToolbar } from './components/WidgetGrid'
import { CustomizeEnvironmentDialog } from './components/dialogs/CustomizeEnvironmentDialog'
import { CustomizeDashboardDialog } from './components/dialogs/CustomizeDashboardDialog'
import { CveWatchWidget } from './components/widgets/CveWatchWidget'
import { LocalDataWidget } from './components/widgets/LocalDataWidget'
import { NetworkActivityWidget } from './components/widgets/NetworkActivityWidget'
import { OperationsWidget } from './components/widgets/OperationsWidget'
import { ThreatMonitorWidget } from './components/widgets/ThreatMonitorWidget'
import { useCollapsible } from './hooks/useCollapsible'
import { useDashboardData } from './hooks/useDashboardData'
import { useDashboardLayout } from './hooks/useDashboardLayout'
import { useDialogTrigger } from './hooks/useDialogTrigger'
import { useScrollContainer } from './hooks/useScrollContainer'
import { environmentStatuses, hasDataError, widgetCounts } from './mappers/dashboardViewModel'
import type { WidgetId, WidgetPlacement } from './widgetRegistry'
import './dashboard.css'

/*
 * Terminal Overview. This component only orchestrates: it loads the data once
 * for every widget, holds the layout (saved locally), the panels' open state
 * (kept while a widget is hidden) and the two customisation dialogs, and tells
 * the decorative circuit when the page's layout may have moved.
 */
export default function Dashboard2026() {
  const navigate = useNavigate()
  const rootRef = useRef<HTMLDivElement>(null)
  const layout = useDashboardLayout()
  const data = useDashboardData()
  const panels = {
    operations: useCollapsible('operations-panel'),
    threat: useCollapsible('threat-panel'),
    watch: useCollapsible('alerts-panel'),
  }
  const environmentDialog = useDialogTrigger()
  const widgetsDialog = useDialogTrigger()
  const layoutKey = JSON.stringify(layout.widgets)

  useScrollContainer(rootRef, environmentDialog.open || widgetsDialog.open)
  useEffect(() => { requestCircuitRecompute() }, [layout.envCards, layoutKey, data.stats, data.bgp, data.cves])
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const syncMotionState = () => {
      root.toggleAttribute('data-motion-paused', document.hidden)
    }
    syncMotionState()
    document.addEventListener('visibilitychange', syncMotionState)
    return () => document.removeEventListener('visibilitychange', syncMotionState)
  }, [])

  const { shown, hidden } = widgetCounts(layout.widgets)

  const widgets: Record<WidgetId, (placement: WidgetPlacement) => ReactElement> = {
    network: (placement) => <NetworkActivityWidget key="network" placement={placement} />,
    operations: (placement) => <OperationsWidget key="operations" placement={placement} panel={panels.operations} />,
    threat: (placement) => <ThreatMonitorWidget key="threat" placement={placement} panel={panels.threat} bgp={data.bgp} ioc={data.ioc} onRetry={data.retry} />,
    watch: (placement) => <CveWatchWidget key="watch" placement={placement} panel={panels.watch} cves={data.cves} onRetry={data.retry} />,
    sync: (placement) => <LocalDataWidget key="sync" placement={placement} tools={data.tools} ioc={data.ioc} />,
  }

  return <div className="cyber-dashboard-2026" ref={rootRef}>
    <CustomizeEnvironmentDialog open={environmentDialog.open} envCards={layout.envCards} onChange={layout.update} onReset={layout.reset} onClose={environmentDialog.close} returnFocus={environmentDialog.returnFocus} persisted={layout.persisted} />
    <CustomizeDashboardDialog open={widgetsDialog.open} widgets={layout.widgets} onChange={layout.updateWidgets} onReset={layout.resetWidgets} onClose={widgetsDialog.close} returnFocus={widgetsDialog.returnFocus} persisted={layout.persisted} />
    <div className="main-content">
      <DashboardCircuit />
      <div className="workspace dashboard-board" id="dashboard-overview">
        <DashboardHero />
        <EnvironmentSection envCards={layout.envCards} statuses={environmentStatuses(data)} hasError={hasDataError(data)} onRetry={data.retry} onCustomize={environmentDialog.show} onOpen={navigate} />
        <WidgetToolbar shown={shown.length} hidden={hidden} onCustomize={widgetsDialog.show} />
        <WidgetGrid widgets={shown} layoutKey={layoutKey} renderWidget={(placement) => widgets[placement.id](placement)} onShowWidgets={widgetsDialog.show} />
        <footer className="page-foot"><span>CYBERHUB / TERMINAL OVERVIEW</span><span>Données de la Console · globe illustratif · circuit décoratif · aucune surveillance continue</span></footer>
      </div>
    </div>
  </div>
}
