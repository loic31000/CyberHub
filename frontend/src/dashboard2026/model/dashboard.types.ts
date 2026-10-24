import type { bgpApi, cveApi, iocApi, statsApi, toolsApi } from "@/api/client";
import type { CardSignal } from "../environmentRegistry";

/*
 * Types of the Dashboard: what the API returns (taken from the client, never
 * redefined), a remote value's three states, and the view models the widgets
 * display. A view model only reshapes real API data; nothing decorative here.
 */

type Payload<F extends (...args: never[]) => Promise<unknown>> = Awaited<ReturnType<F>>;

export type StatsPayload = Payload<typeof statsApi.get>;
export type ToolsPayload = Payload<typeof toolsApi.list>;
export type BgpAlertsPayload = Payload<typeof bgpApi.getAlerts>;
export type IocPayload = Payload<typeof iocApi.list>;
export type CvesPayload = Payload<typeof cveApi.list>;

/* A value loaded from the API: still loading, received, or failed. */
export type Remote<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error" };

export type DashboardData = {
  stats: Remote<StatsPayload>;
  tools: Remote<ToolsPayload>;
  bgp: Remote<BgpAlertsPayload>;
  ioc: Remote<IocPayload>;
  cves: Remote<CvesPayload>;
  retry: () => void;
};

/* What an environment card shows: its status line, secondary line and signal tone. */
export type CardStatus = Pick<CardSignal, "status" | "secondary" | "tone">;
export type EnvironmentStatuses = Record<string, CardStatus>;

/* One row of the CVE preview: the API's own id, severity and date. */
export type CvePreviewItem = {
  id: number;
  cveId: string;
  description: string;
  severity: string;
  severityLabel: string;
  iconTone: "" | "is-red" | "is-amber";
  date: string; // ISO, for <time dateTime>
  dateLabel: string;
};

/* One row of Threat Monitor: a recorded BGP alert (parts kept apart, rendered as in the original markup). */
export type BgpAlertItem = {
  id: number;
  asn: number;
  type: string; // alert_type, readable
  dateLabel: string;
  status: "Acquittée" | "Non acquittée";
};
