import type { Box, FeedRoom, HeroAnchor, Rect } from "./types";

/* Measurement of the page (DOM): panels, hero anchor and the room for CH's feeds. */

const OBSTACLE_SELECTOR =
  ".dashboard-board .overview-hero, .dashboard-board .dashboard-panel, .dashboard-board .sync-panel, .dashboard-board .widget-empty, .dashboard-board .page-foot";

export function measure(host: HTMLElement) {
  const box = host.getBoundingClientRect();
  const elements = [...(host.parentElement?.querySelectorAll<HTMLElement>(OBSTACLE_SELECTOR) ?? [])];
  const widgetGrid = host.parentElement?.querySelector<HTMLElement>(".dashboard-board .widget-grid");
  const toRect = (rect: DOMRect, globe: boolean): Rect => ({
    x: Math.round(rect.left - box.left),
    y: Math.round(rect.top - box.top),
    w: Math.round(rect.width),
    h: Math.round(rect.height),
    ...(globe ? { globe: true } : {}),
  });
  const shown = elements.filter((element) => element.getBoundingClientRect().height > 0);
  const roleOf = (element: Element): Rect["role"] =>
    element.classList.contains("overview-hero")
      ? "hero"
      : element.classList.contains("environment-panel")
        ? "env"
        : element.classList.contains("page-foot")
          ? "foot"
          : "widget";
  // A collapsed panel shows only its header card.
  const obstacles = shown.map((element) => {
    const visible = element.classList.contains("is-collapsed") ? element.querySelector(".panel-heading") ?? element : element;
    return { ...toRect(visible.getBoundingClientRect(), element.classList.contains("network-panel")), role: roleOf(element) };
  });
  const slots = shown.map((element) => toRect(element.getBoundingClientRect(), element.classList.contains("network-panel")));
  const widgetTop = widgetGrid ? Math.round(widgetGrid.getBoundingClientRect().top - box.top) : Math.round(box.height);
  return { elements, width: Math.round(box.width), height: Math.round(box.height), obstacles, slots, anchor: heroAnchor(host, box), widgetTop };
}

/*
 * CH's feeds need a gap above the environment card for the connector's pins,
 * and an open band below it for the second connector and the relay chip. The
 * band's label and button stay clear.
 */
function feedRoom(panel: HTMLElement, hero: DOMRect, rect: (r: DOMRect) => Box): FeedRoom | null {
  const p = panel.getBoundingClientRect();
  const grid = panel.parentElement?.querySelector(".widget-grid")?.getBoundingClientRect();
  if (p.top - hero.bottom < 24 || !grid || grid.top - p.bottom < 64) return null;
  const keepout = [...(panel.parentElement?.querySelectorAll<HTMLElement>(".widget-toolbar p > span, .widget-toolbar button") ?? [])]
    .map((element) => element.getBoundingClientRect())
    .filter((r) => r.width > 0)
    .map(rect);
  return { keepout };
}

/* The desktop hero lends its processor band (the 2N circuit's box) to the board. */
function heroAnchor(host: HTMLElement, box: DOMRect): HeroAnchor | null {
  const hero = host.parentElement?.querySelector<HTMLElement>(".dashboard-board .overview-hero");
  const band = hero?.querySelector(".hero-circuit")?.getBoundingClientRect();
  const index = hero?.querySelector(".hero-index")?.getBoundingClientRect();
  const workspace = hero?.parentElement?.getBoundingClientRect();
  if (!hero || !band || !index || !workspace || band.width === 0 || !window.matchMedia("(min-width: 1200px)").matches) return null;
  // The copy ends where its text ends, not where its box does.
  const copyRight = Math.max(
    ...[...hero.querySelectorAll(".hero-copy h1, .hero-copy p, .hero-breadcrumb")].map((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getBoundingClientRect().right;
    }),
  );
  const rect = (r: DOMRect) => ({ x: Math.round(r.left - box.left), y: Math.round(r.top - box.top), w: Math.round(r.width), h: Math.round(r.height) });
  const panel = hero.parentElement?.querySelector<HTMLElement>(".environment-panel");
  return {
    feeds: panel ? feedRoom(panel, hero.getBoundingClientRect(), rect) : null,
    hero: rect(hero.getBoundingClientRect()),
    band: rect(band),
    copyRight: Math.round(copyRight - box.left),
    indexLeft: Math.round(index.left - box.left),
    board: { x: Math.round(workspace.left - box.left), y: Math.round(workspace.top - box.top) },
    variant: document.documentElement.dataset.link === "b" ? "b" : "a",
  };
}
