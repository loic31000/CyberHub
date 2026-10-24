import { useCallback, useState } from "react";
import { DEFAULT_ENVIRONMENT_CARDS, normalizeEnvCards } from "../environmentRegistry";
import { DEFAULT_WIDGETS, parseWidgets, type WidgetPlacement } from "../widgetRegistry";

/*
 * Versioned dashboard layout stored in localStorage.
 *
 * - `envCards`: the environment cards (Phase 3A.1), in order.
 * - `widgets`: every large widget in order, with its visibility and size.
 *
 * The format keeps `version: 1`: a layout saved by Phase 3A.1 (widgets: [])
 * reads as its own cards plus the default widgets. Each part has its own
 * reset and never touches the other. Nothing is written until the user
 * changes something; when both parts are back to their defaults the key is
 * removed.
 */

export const LAYOUT_STORAGE_KEY = "cyberhub.console.dashboard.layout.v1";

export type DashboardLayout = {
  version: 1;
  envCards: string[];
  widgets: WidgetPlacement[];
};

const defaultLayout = (): DashboardLayout => ({
  version: 1,
  envCards: [...DEFAULT_ENVIRONMENT_CARDS],
  widgets: DEFAULT_WIDGETS.map((w) => ({ ...w })),
});

/*
 * Unknown ids and duplicates are dropped, and cards of earlier versions that
 * duplicated a module are read as that module's card, in their position.
 * Anything malformed falls back to the default. The stored value is only
 * rewritten at the user's next change.
 */
export function parseLayout(raw: string | null): DashboardLayout {
  if (!raw) return defaultLayout();
  try {
    const data = JSON.parse(raw) as Partial<DashboardLayout> | null;
    if (!data || data.version !== 1 || !Array.isArray(data.envCards)) return defaultLayout();
    return { version: 1, envCards: normalizeEnvCards(data.envCards), widgets: parseWidgets(data.widgets) };
  } catch {
    return defaultLayout();
  }
}

function readStoredLayout() {
  try {
    return parseLayout(window.localStorage.getItem(LAYOUT_STORAGE_KEY));
  } catch {
    return defaultLayout(); // storage blocked (private mode, policy)
  }
}

const isDefault = (layout: DashboardLayout) =>
  JSON.stringify(layout.envCards) === JSON.stringify(DEFAULT_ENVIRONMENT_CARDS) &&
  JSON.stringify(layout.widgets) === JSON.stringify(DEFAULT_WIDGETS);

function writeStoredLayout(layout: DashboardLayout) {
  try {
    if (isDefault(layout)) window.localStorage.removeItem(LAYOUT_STORAGE_KEY);
    else window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    return true;
  } catch {
    return false;
  }
}

export function useDashboardLayout() {
  const [layout, setLayout] = useState(readStoredLayout);
  const [persisted, setPersisted] = useState(true);

  const commit = useCallback((next: DashboardLayout) => {
    setLayout(next);
    setPersisted(writeStoredLayout(next));
  }, []);

  const update = useCallback(
    (envCards: string[]) => commit({ ...layout, envCards: normalizeEnvCards(envCards) }),
    [layout, commit],
  );

  // Resets the environment cards only.
  const reset = useCallback(() => commit({ ...layout, envCards: [...DEFAULT_ENVIRONMENT_CARDS] }), [layout, commit]);

  const updateWidgets = useCallback(
    (widgets: WidgetPlacement[]) => commit({ ...layout, widgets: parseWidgets(widgets) }),
    [layout, commit],
  );

  // Resets the large widgets only.
  const resetWidgets = useCallback(
    () => commit({ ...layout, widgets: DEFAULT_WIDGETS.map((w) => ({ ...w })) }),
    [layout, commit],
  );

  return { layout, envCards: layout.envCards, widgets: layout.widgets, update, reset, updateWidgets, resetWidgets, persisted };
}
