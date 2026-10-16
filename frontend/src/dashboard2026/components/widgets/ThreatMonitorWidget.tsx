import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BgpGlyph, RadarGlyph } from "../../CyberGlyphs";
import { PanelBody, PanelToggle } from "../CollapsiblePanel";
import { DashboardEmptyState } from "../DashboardEmptyState";
import { WidgetFrame } from "../WidgetFrame";
import { bgpAlerts, counted, remoteTitle, stateText } from "../../mappers/dashboardViewModel";
import type { Collapsible } from "../../hooks/useCollapsible";
import type { BgpAlertsPayload, IocPayload, Remote } from "../../model/dashboard.types";
import type { WidgetPlacement } from "../../widgetRegistry";

type Props = {
  placement: WidgetPlacement;
  panel: Collapsible;
  bgp: Remote<BgpAlertsPayload>;
  ioc: Remote<IocPayload>;
  onRetry: () => void;
};

/* THREAT MONITOR: recorded BGP alerts (two at most) and the local IOC count; no continuous watch. */
export function ThreatMonitorWidget({ placement, panel, bgp, ioc, onRetry }: Props) {
  const navigate = useNavigate();
  const alerts = bgpAlerts(bgp);
  return <WidgetFrame placement={placement} className={`dashboard-panel threat-panel widget${panel.open ? "" : " is-collapsed"}`} labelledBy="threat-monitor-title">
    <header className="panel-heading threat-heading">
      <div className="threat-title"><span className="threat-beacon" aria-hidden="true"><RadarGlyph size={19} /><i /></span><span><h2 id="threat-monitor-title">THREAT MONITOR</h2><p className={panel.expanded ? "" : "panel-summary is-alert"}>{stateText(bgp, (data) => counted(data.total, "alerte BGP", "alertes BGP"))}</p></span></div>
      <div className="panel-tools"><button type="button" className="text-action" onClick={() => navigate("/bgp/historian")}>Voir tout <ChevronRight size={14} /></button><PanelToggle collapsible={panel} label="Threat Monitor" /></div>
    </header>
    <PanelBody collapsible={panel}>
      <div className="threat-status"><span className="threat-status-led" aria-hidden="true" /><span><small>HISTORIQUE BGP</small><strong>{stateText(bgp, (data) => data.total ? counted(data.total, "alerte enregistrée", "alertes enregistrées") : "Aucune alerte enregistrée")}</strong></span></div>
      {alerts.length > 0
        ? <ul className="threat-list">{alerts.map((alert) => <li key={alert.id}><button type="button" onClick={() => navigate("/bgp/historian")}><span className="threat-icon is-red"><BgpGlyph size={17} /></span><span className="threat-copy"><strong>AS{alert.asn} · {alert.type}</strong><small>{alert.dateLabel} · {alert.status}</small></span><ChevronRight size={15} aria-hidden="true" /></button></li>)}</ul>
        : <DashboardEmptyState
          icon={<BgpGlyph size={17} />}
          retry={bgp.status === "error" ? onRetry : undefined}
          title={remoteTitle(bgp, { loading: "Chargement des alertes BGP…", error: "Alertes BGP indisponibles", ready: "Aucune alerte BGP à afficher" })}
          action={bgp.status === "ready" ? { label: "BGP Historian", onClick: () => navigate("/bgp/historian") } : undefined}
        >{bgp.status === "ready" ? "Les alertes détectées par BGP Historian apparaîtront ici." : undefined}</DashboardEmptyState>}
      <div className="threat-foot"><span>{stateText(ioc, (data) => `${data.total} IOC enregistrés`)}</span><span>Aucune surveillance continue</span></div>
    </PanelBody>
  </WidgetFrame>;
}
