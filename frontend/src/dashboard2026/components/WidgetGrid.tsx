import { useRef } from "react";
import type { ReactElement } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useWidgetMasonry } from "../hooks/useWidgetMasonry";
import type { WidgetPlacement } from "../widgetRegistry";

/* "WIDGETS · n affichés · m masqués" and the entry to the widgets dialog. */
export function WidgetToolbar({ shown, hidden, onCustomize }: { shown: number; hidden: number; onCustomize: (trigger: HTMLElement) => void }) {
  return <div className="widget-toolbar">
    <p><span className="widget-toolbar-code">WIDGETS</span><span aria-hidden="true"> · </span><span>{shown} affiché{shown > 1 ? "s" : ""}{hidden ? ` · ${hidden} masqué${hidden > 1 ? "s" : ""}` : ""}</span></p>
    <button type="button" className="panel-action widget-customize" aria-haspopup="dialog" onClick={(event) => onCustomize(event.currentTarget)}><SlidersHorizontal size={14} aria-hidden="true" />Personnaliser le Dashboard</button>
  </div>;
}

type Props = {
  widgets: WidgetPlacement[]; // shown widgets, in order
  layoutKey: string; // changes with any order, size or visibility change
  renderWidget: (placement: WidgetPlacement) => ReactElement;
  onShowWidgets: (trigger: HTMLElement) => void;
};

/* The widget grid, packed by the masonry hook; a way back when every widget is hidden. */
export function WidgetGrid({ widgets, layoutKey, renderWidget, onShowWidgets }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  useWidgetMasonry(gridRef, layoutKey);
  return <div className="widget-grid" ref={gridRef}>
    {widgets.length ? widgets.map(renderWidget)
      : <div className="widget-empty"><p>Tous les widgets sont masqués.</p><button type="button" className="panel-action" onClick={(event) => onShowWidgets(event.currentTarget)}>Afficher des widgets</button></div>}
  </div>;
}
