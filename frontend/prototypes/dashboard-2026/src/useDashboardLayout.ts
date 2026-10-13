import { useCallback, useState } from "react";
import { DEFAULT_ENVIRONMENT_CARDS, getEnvironmentCard } from "./environmentRegistry";

/*
 * Phase 3A.1: versioned dashboard layout stored in localStorage.
 *
 * Only the environment cards are customisable for now. `widgets` is kept in
 * the stored shape for the large widgets of Phase 3A.2 and is preserved as is.
 * Nothing is written until the user changes something.
 */

export const LAYOUT_STORAGE_KEY = "cyberhub.dashboard.layout.v1";

export type DashboardLayout = {
  version: 1;
  envCards: string[];
  widgets: unknown[];
};

const defaultLayout = (): DashboardLayout => ({
  version: 1,
  envCards: [...DEFAULT_ENVIRONMENT_CARDS],
  widgets: [],
});

/* Unknown ids and duplicates are dropped; anything malformed falls back to the default. */
export function parseLayout(raw: string | null): DashboardLayout {
  if (!raw) return defaultLayout();
  try {
    const data = JSON.parse(raw) as Partial<DashboardLayout> | null;
    if (!data || data.version !== 1 || !Array.isArray(data.envCards)) return defaultLayout();
    const envCards = [...new Set(data.envCards.filter((id): id is string => typeof id === "string" && !!getEnvironmentCard(id)))];
    return { version: 1, envCards, widgets: Array.isArray(data.widgets) ? data.widgets : [] };
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

function writeStoredLayout(layout: DashboardLayout) {
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    return true;
  } catch {
    return false;
  }
}

export function useDashboardLayout() {
  const [layout, setLayout] = useState(readStoredLayout);
  const [persisted, setPersisted] = useState(true);

  const update = useCallback(
    (envCards: string[]) => {
      const next = { ...layout, envCards: [...new Set(envCards)] };
      setLayout(next);
      setPersisted(writeStoredLayout(next));
    },
    [layout],
  );

  const reset = useCallback(() => {
    const next = defaultLayout();
    setLayout(next);
    try {
      window.localStorage.removeItem(LAYOUT_STORAGE_KEY);
      setPersisted(true);
    } catch {
      setPersisted(false);
    }
  }, []);

  return { layout, envCards: layout.envCards, update, reset, persisted };
}
