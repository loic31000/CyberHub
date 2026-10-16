import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PulseGlyph } from "../../CyberGlyphs";
import { PanelBody, PanelToggle } from "../CollapsiblePanel";
import { DashboardEmptyState } from "../DashboardEmptyState";
import { WidgetFrame } from "../WidgetFrame";
import type { Collapsible } from "../../hooks/useCollapsible";
import type { WidgetPlacement } from "../../widgetRegistry";

/* DERNIÈRES OPÉRATIONS: the Dashboard API has no recent operations yet, and says so. */
export function OperationsWidget({ placement, panel }: { placement: WidgetPlacement; panel: Collapsible }) {
  const navigate = useNavigate();
  return <WidgetFrame placement={placement} className={`dashboard-panel feed-panel widget${panel.open ? "" : " is-collapsed"}`} labelledBy="operations-title">
    <header className="panel-heading">
      <span className="panel-glyph is-ops" aria-hidden="true"><PulseGlyph size={18} /></span>
      <div><h2 id="operations-title">DERNIÈRES OPÉRATIONS</h2>{!panel.expanded && <p className="panel-summary">Historique indisponible</p>}</div>
      <div className="panel-tools"><button type="button" className="panel-action" aria-label="Voir les investigations" onClick={() => navigate("/investigations")}>Voir tout <ChevronRight size={14} /></button><PanelToggle collapsible={panel} label="Dernières opérations" /></div>
    </header>
    <PanelBody collapsible={panel}>
      <DashboardEmptyState icon={<PulseGlyph size={17} />} title="Historique non disponible" action={{ label: "Investigations", onClick: () => navigate("/investigations") }}>L’API du Dashboard ne fournit pas encore les opérations récentes.</DashboardEmptyState>
    </PanelBody>
  </WidgetFrame>;
}
