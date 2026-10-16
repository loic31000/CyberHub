import type { CSSProperties, ReactNode } from "react";
import { spanOf, type WidgetPlacement } from "../widgetRegistry";

type Props = {
  placement: WidgetPlacement;
  className: string;
  labelledBy: string;
  children: ReactNode;
};

/*
 * The grid cell of a widget: its id and size as data attributes, its desktop
 * and tablet spans as CSS variables (read by dashboard.css and the masonry).
 */
export function WidgetFrame({ placement, className, labelledBy, children }: Props) {
  const span = spanOf(placement);
  return <section
    className={className}
    aria-labelledby={labelledBy}
    data-widget={placement.id}
    data-size={placement.size}
    style={{ "--w-cols": span.cols, "--w-rows": span.rows, "--w-cols-tablet": span.colsTablet } as CSSProperties}
  >
    {children}
  </section>;
}
