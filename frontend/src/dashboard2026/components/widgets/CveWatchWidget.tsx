import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CveGlyph, WatchGlyph } from "../../CyberGlyphs";
import { PanelBody, PanelToggle } from "../CollapsiblePanel";
import { DashboardEmptyState } from "../DashboardEmptyState";
import { WidgetFrame } from "../WidgetFrame";
import { counted, recentCves, remoteTitle, stateText } from "../../mappers/dashboardViewModel";
import type { Collapsible } from "../../hooks/useCollapsible";
import type { CvesPayload, Remote } from "../../model/dashboard.types";
import type { WidgetPlacement } from "../../widgetRegistry";

type Props = {
  placement: WidgetPlacement;
  panel: Collapsible;
  cves: Remote<CvesPayload>;
  onRetry: () => void;
};

/* VEILLE CVE & SOURCES: the CVE count and the three most recent entries of the Console. */
export function CveWatchWidget({ placement, panel, cves, onRetry }: Props) {
  const navigate = useNavigate();
  const recent = recentCves(cves);
  return <WidgetFrame placement={placement} className={`dashboard-panel feed-panel alert-panel widget${panel.open ? "" : " is-collapsed"}`} labelledBy="alerts-title">
    <header className="panel-heading">
      <span className="panel-glyph is-watch" aria-hidden="true"><WatchGlyph size={18} /></span>
      <div><h2 id="alerts-title">VEILLE CVE & SOURCES</h2><p className={panel.expanded ? "" : "panel-summary"}>{stateText(cves, (response) => counted(response.count, "CVE enregistrée", "CVE enregistrées"))}</p></div>
      <div className="panel-tools"><button type="button" className="panel-action" onClick={() => navigate("/cve")}>Voir tout <ChevronRight size={14} /></button><PanelToggle collapsible={panel} label="Veille CVE et sources" /></div>
    </header>
    <PanelBody collapsible={panel}>
      {/* Preview of the three most recent CVE: id, real severity and date; the
          description is clamped to two lines on screen only, the full record
          opens on its CVE page. */}
      {recent.length
        ? <ul className="activity-list alert-list cve-preview">{recent.map((cve) => <li key={cve.id}><button type="button" className="cve-row" onClick={() => navigate(`/cve/${cve.id}`)}><span className={`feed-icon ${cve.iconTone}`}><CveGlyph size={17} /></span><span className="feed-copy"><strong>{cve.cveId}</strong><small className="cve-summary">{cve.description}</small></span><span className="cve-meta"><span className={`cve-severity is-${cve.severity}`}>{cve.severityLabel}</span><time dateTime={cve.date}>{cve.dateLabel}</time></span></button></li>)}</ul>
        : <DashboardEmptyState
          icon={<CveGlyph size={17} />}
          retry={cves.status === "error" ? onRetry : undefined}
          title={remoteTitle(cves, { loading: "Chargement des CVE…", error: "Veille CVE indisponible", ready: "Aucune CVE enregistrée" })}
          action={cves.status === "ready" ? { label: "CVE & KEV", onClick: () => navigate("/cve") } : undefined}
        >{cves.status === "ready" ? "Ajoutez ou importez des CVE depuis le module CVE & KEV." : undefined}</DashboardEmptyState>}
    </PanelBody>
  </WidgetFrame>;
}
