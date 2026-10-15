import { NetworkGlyph, PulseGlyph, RadarGlyph, SourcesGlyph, WatchGlyph, type IconComponent } from "./CyberGlyphs";
import type { ModuleCategory } from "./environmentRegistry";

/*
 * Large dashboard widgets: the panels below the environment cards.
 *
 * A layout is an ordered list of placements (id, visible, size). The widget
 * grid has 12 columns on desktop and places widgets in that order with CSS
 * grid auto-placement (`dense`), so a hidden widget frees its space and a
 * moved or resized widget can never overlap another. Each size maps to a
 * column and row span; the tablet grid (6 columns) and the phone column are
 * derived from it, never stored.
 */

export type WidgetId = "network" | "operations" | "threat" | "watch" | "sync";
export type WidgetSize = "compact" | "standard" | "large";

export const WIDGET_SIZE_LABELS: Record<WidgetSize, string> = {
  compact: "Compact",
  standard: "Standard",
  large: "Large",
};

type Span = { cols: number; rows: number };

export type WidgetDefinition = {
  id: WidgetId;
  title: string;
  description: string;
  category: ModuleCategory; // same sections as the module registry
  icon: IconComponent;
  keywords: string[];
  sizes: Partial<Record<WidgetSize, Span>>; // the sizes that make sense for it
  defaultSize: WidgetSize;
};

export const WIDGETS: WidgetDefinition[] = [
  {
    id: "network",
    title: "Activité réseau",
    description: "Globe, arcs et légende de démonstration",
    category: "ops",
    icon: NetworkGlyph,
    keywords: ["globe", "carte", "réseau", "network", "requêtes", "arcs", "monde"],
    // No compact size: below six columns the globe stops being legible.
    sizes: { standard: { cols: 6, rows: 2 }, large: { cols: 9, rows: 2 } },
    defaultSize: "standard",
  },
  {
    id: "operations",
    title: "Dernières opérations",
    description: "Historique non fourni par l’API du Dashboard",
    category: "ops",
    icon: PulseGlyph,
    keywords: ["opérations", "activité", "historique", "journal", "récent"],
    sizes: { compact: { cols: 3, rows: 2 }, standard: { cols: 4, rows: 2 }, large: { cols: 6, rows: 2 } },
    defaultSize: "compact",
  },
  {
    id: "threat",
    title: "Threat Monitor",
    description: "Alertes BGP enregistrées et indicateurs locaux",
    category: "intel",
    icon: RadarGlyph,
    keywords: ["menaces", "threat", "alertes", "ioc", "signaux", "monitor"],
    sizes: { compact: { cols: 3, rows: 1 }, standard: { cols: 4, rows: 1 }, large: { cols: 6, rows: 1 } },
    defaultSize: "compact",
  },
  {
    id: "watch",
    title: "Veille CVE & sources",
    description: "CVE enregistrées dans la Console",
    category: "intel",
    icon: WatchGlyph,
    keywords: ["cve", "kev", "veille", "bulletins", "vulnérabilités", "sources"],
    sizes: { compact: { cols: 3, rows: 1 }, standard: { cols: 4, rows: 1 }, large: { cols: 6, rows: 1 } },
    defaultSize: "compact",
  },
  {
    id: "sync",
    title: "Données locales",
    description: "Outils et IOC enregistrés",
    category: "core",
    icon: SourcesGlyph,
    keywords: ["synchronisation", "sync", "données", "progression", "mise à jour"],
    sizes: { standard: { cols: 6, rows: 1 }, large: { cols: 12, rows: 1 } },
    defaultSize: "large",
  },
];

export type WidgetPlacement = { id: WidgetId; visible: boolean; size: WidgetSize };

const byId = new Map(WIDGETS.map((widget) => [widget.id, widget]));

export const getWidget = (id: string) => byId.get(id as WidgetId);

export const widgetSizes = (id: WidgetId) => Object.keys(getWidget(id)?.sizes ?? {}) as WidgetSize[];

export const DEFAULT_WIDGETS: WidgetPlacement[] = WIDGETS.map((widget) => ({
  id: widget.id,
  visible: true,
  size: widget.defaultSize,
}));

/* Desktop and tablet spans of a placement. */
export function spanOf({ id, size }: WidgetPlacement) {
  const widget = getWidget(id);
  const span = widget?.sizes[size] ?? widget?.sizes[widget.defaultSize] ?? { cols: 12, rows: 1 };
  return { cols: span.cols, rows: span.rows, colsTablet: span.cols >= 6 ? 6 : 3 };
}

/*
 * Stored placements, cleaned: unknown or duplicated ids dropped, invalid sizes
 * and visibility replaced by the defaults, widgets missing from the stored list
 * (a new widget, an older layout) appended visible in their default size.
 */
export function parseWidgets(raw: unknown): WidgetPlacement[] {
  if (!Array.isArray(raw) || !raw.length) return DEFAULT_WIDGETS.map((w) => ({ ...w }));
  const seen = new Set<WidgetId>();
  const placements: WidgetPlacement[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const { id, visible, size } = entry as Partial<WidgetPlacement>;
    const widget = typeof id === "string" ? getWidget(id) : undefined;
    if (!widget || seen.has(widget.id)) continue;
    seen.add(widget.id);
    placements.push({
      id: widget.id,
      visible: typeof visible === "boolean" ? visible : true,
      size: typeof size === "string" && size in widget.sizes ? (size as WidgetSize) : widget.defaultSize,
    });
  }
  for (const widget of WIDGETS) {
    if (!seen.has(widget.id)) placements.push({ id: widget.id, visible: true, size: widget.defaultSize });
  }
  return placements;
}
