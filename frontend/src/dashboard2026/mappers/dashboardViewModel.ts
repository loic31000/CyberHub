import { DASHBOARD_MODULE, MODULES } from "../environmentRegistry";
import type { WidgetPlacement } from "../widgetRegistry";
import type {
  BgpAlertItem,
  BgpAlertsPayload,
  CvePreviewItem,
  CvesPayload,
  DashboardData,
  EnvironmentStatuses,
  Remote,
} from "../model/dashboard.types";

/*
 * Pure transformations from the API's data to what the Dashboard displays.
 * Every text comes from a real value or names its absence; none is invented.
 */

/* A remote value as one line of text: loading, unavailable (offline or not), or its data. */
export function stateText<T>(remote: Remote<T>, ready: (data: T) => string, online = typeof navigator === "undefined" || navigator.onLine): string {
  if (remote.status === "loading") return "Chargement…";
  if (remote.status === "error") return online ? "Données indisponibles" : "Hors connexion";
  return ready(remote.data);
}

/* The title an empty or failed list shows, by state. */
export function remoteTitle(remote: Remote<unknown>, titles: { loading: string; error: string; ready: string }) {
  return remote.status === "loading" ? titles.loading : remote.status === "error" ? titles.error : titles.ready;
}

export const counted = (count: number, singular: string, plural: string) => `${count} ${count === 1 ? singular : plural}`;

/* Labels of the API's own severity values (CVESeverity): nothing invented. */
export const CVE_SEVERITY: Record<string, string> = {
  critical: "CRITIQUE",
  high: "ÉLEVÉE",
  medium: "MOYENNE",
  low: "FAIBLE",
  none: "NON NOTÉE",
};

const frenchDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR");

/* Status of the system cards; the module cards only give access, without a value. */
export function environmentStatuses(data: Pick<DashboardData, "stats" | "ioc" | "bgp">): EnvironmentStatuses {
  const bgpCount = data.bgp.status === "ready" ? data.bgp.data.total : 0;
  return {
    "system.console": {
      status: stateText(data.stats, (stats) => `${stats.tools_total} outils · ${stats.ctf_total} writeups`),
      secondary: "Données de la Console", tone: data.stats.status === "ready" ? "ready" : "quiet",
    },
    "system.mitre": { status: "Accès au module", secondary: "Consulter ATT&CK", tone: "quiet" },
    "system.sources": {
      status: stateText(data.ioc, (ioc) => `${ioc.total} IOC enregistrés`),
      secondary: "Indicateurs locaux", tone: data.ioc.status === "ready" ? "ready" : "quiet",
    },
    "system.osint": { status: "Accès au module", secondary: "Lancer une recherche", tone: "quiet" },
    "system.bgp": {
      status: stateText(data.bgp, (bgp) => bgp.total ? `${counted(bgp.total, "alerte BGP enregistrée", "alertes BGP enregistrées")}` : "Aucune alerte BGP"),
      secondary: "Historique BGP", tone: bgpCount ? "attention" : data.bgp.status === "ready" ? "ready" : "quiet",
    },
  };
}

/* The most recent CVE (publication date, else creation date), with the API's severity. */
export function recentCves(cves: Remote<CvesPayload>, limit = 3): CvePreviewItem[] {
  if (cves.status !== "ready") return [];
  return [...cves.data.cves]
    .sort((a, b) => (b.published_at || b.created_at).localeCompare(a.published_at || a.created_at))
    .slice(0, limit)
    .map((cve) => {
      const date = cve.published_at || cve.created_at;
      return {
        id: cve.id,
        cveId: cve.cve_id,
        description: cve.description,
        severity: cve.severity,
        severityLabel: CVE_SEVERITY[cve.severity] ?? cve.severity,
        iconTone: cve.severity === "critical" ? "is-red" : cve.severity === "high" ? "is-amber" : "",
        date,
        dateLabel: frenchDate(date),
      };
    });
}

/* The first recorded BGP alerts: AS, type, detection date and acknowledgement. */
export function bgpAlerts(bgp: Remote<BgpAlertsPayload>, limit = 2): BgpAlertItem[] {
  if (bgp.status !== "ready") return [];
  return bgp.data.items.slice(0, limit).map((alert) => ({
    id: alert.id,
    asn: alert.asn,
    type: alert.alert_type.replace(/_/g, " "),
    dateLabel: frenchDate(alert.detected_at),
    status: alert.acknowledged ? "Acquittée" : "Non acquittée",
  }));
}

export function hasDataError(data: Pick<DashboardData, "stats" | "tools" | "bgp" | "ioc" | "cves">) {
  return [data.stats, data.tools, data.bgp, data.ioc, data.cves].some((value) => value.status === "error");
}

/* Shown widgets in order, and how many are hidden. */
export function widgetCounts(widgets: WidgetPlacement[]) {
  const shown = widgets.filter((placement) => placement.visible);
  return { shown, hidden: widgets.length - shown.length };
}

/* Route of a module from its card title (the environment cards open by title). */
export function destinationRoute(title: string) {
  return [DASHBOARD_MODULE, ...MODULES].find((item) => item.title === title)?.route ?? null;
}
