import { SourcesGlyph } from "../../CyberGlyphs";
import { WidgetFrame } from "../WidgetFrame";
import { stateText } from "../../mappers/dashboardViewModel";
import type { IocPayload, Remote, ToolsPayload } from "../../model/dashboard.types";
import type { WidgetPlacement } from "../../widgetRegistry";

type Props = { placement: WidgetPlacement; tools: Remote<ToolsPayload>; ioc: Remote<IocPayload> };

/* DONNÉES LOCALES: what the Console holds; no simulated synchronisation. */
export function LocalDataWidget({ placement, tools, ioc }: Props) {
  return <WidgetFrame placement={placement} className="sync-panel widget" labelledBy="sync-title">
    <span className="sync-icon"><SourcesGlyph size={19} /></span><div className="sync-copy"><div><strong id="sync-title">DONNÉES LOCALES</strong><span>Contenu enregistré dans la Console · aucune synchronisation simulée</span><b>{stateText(tools, (data) => `${data.count} outils`)} · {stateText(ioc, (data) => `${data.total} IOC`)}</b></div></div>
  </WidgetFrame>;
}
