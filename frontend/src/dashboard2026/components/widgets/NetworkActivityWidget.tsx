import NetworkGlobe from "../../NetworkGlobe";
import { NetworkGlyph } from "../../CyberGlyphs";
import { WidgetFrame } from "../WidgetFrame";
import type { WidgetPlacement } from "../../widgetRegistry";

/* ACTIVITÉ RÉSEAU (APERÇU): an illustrative globe, labelled as such; no traffic data. */
export function NetworkActivityWidget({ placement }: { placement: WidgetPlacement }) {
  return <WidgetFrame placement={placement} className="dashboard-panel network-panel widget" labelledBy="network-title">
    <header className="panel-heading">
      <span className="panel-glyph is-network" aria-hidden="true"><NetworkGlyph size={18} /></span>
      <div><h2 id="network-title">ACTIVITÉ RÉSEAU (APERÇU)</h2><p>Globe géographique illustratif · aucune donnée de trafic réel.</p></div>
      <span className="range-select dashboard-demo-label">ILLUSTRATION</span>
    </header>
    <NetworkGlobe />
  </WidgetFrame>;
}
