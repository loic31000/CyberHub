import type { KeyboardEvent } from "react";

/* Focus helpers shared by the customisation dialogs. */

const FOCUSABLE = 'button:not([disabled]), input, [href], [tabindex]:not([tabindex="-1"])';

/* Tab and Shift+Tab cycle inside the dialog. */
export function trapTab(event: KeyboardEvent, root: HTMLElement | null) {
  if (event.key !== "Tab" || !root) return;
  const focusable = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/* After a list re-renders: the action that was used in a row, else the row's first available one. */
export function rowAction(root: HTMLElement, rowSelector: string, action: string) {
  const row = root.querySelector(rowSelector);
  return (
    row?.querySelector<HTMLElement>(`[data-action="${action}"]:not([aria-disabled="true"])`) ??
    row?.querySelector<HTMLElement>("[data-action]:not([aria-disabled='true'])") ??
    null
  );
}
