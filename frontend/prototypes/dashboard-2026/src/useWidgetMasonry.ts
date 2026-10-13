import { useLayoutEffect } from "react";
import type { RefObject } from "react";
import { requestCircuitRecompute } from "./DashboardCircuit";

/*
 * The widget grid has fine 4 px rows. Each widget spans as many rows as its
 * own height (plus the vertical gap) needs, measured with a ResizeObserver,
 * so the widgets of a column follow each other: collapsing Threat Monitor lets
 * Veille CVE move up at once. Placement stays CSS grid auto-placement, which
 * never overlaps two widgets. A widget's height never depends on its span
 * (they are aligned to the start), so measuring cannot feed itself.
 */

const ROW = 4; // px, the grid's `grid-auto-rows`

export function useWidgetMasonry(gridRef: RefObject<HTMLElement | null>, layoutKey: string) {
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    let frame = 0;

    const apply = () => {
      const gap = parseFloat(getComputedStyle(grid).getPropertyValue("--w-gap")) || 0;
      let changed = false;
      for (const widget of grid.querySelectorAll<HTMLElement>(":scope > .widget")) {
        const span = `span ${Math.max(1, Math.ceil((widget.getBoundingClientRect().height + gap) / ROW))}`;
        if (widget.style.gridRowEnd !== span) {
          widget.style.gridRowEnd = span;
          changed = true;
        }
      }
      // A widget moved at constant size: the circuit has to measure again.
      if (changed) requestCircuitRecompute();
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };

    const observer = new ResizeObserver(schedule);
    grid.querySelectorAll(":scope > .widget").forEach((widget) => observer.observe(widget));
    window.addEventListener("resize", schedule);
    apply();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [gridRef, layoutKey]);
}
