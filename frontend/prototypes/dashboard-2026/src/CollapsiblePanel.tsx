import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { requestCircuitRecompute } from "./DashboardCircuit";

/*
 * Phase 2M: independent collapsible panels. The state lives in each panel so a
 * future widget can reuse the hook as-is; nothing is persisted yet.
 */

const CLOSE_DURATION = 160;

export function useCollapsible(id: string, initiallyOpen = true) {
  const [open, setOpen] = useState(initiallyOpen);
  const [closing, setClosing] = useState(false);
  const [reopened, setReopened] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const timer = useRef(0);
  const expanded = open && !closing;

  function toggle() {
    window.clearTimeout(timer.current);
    if (!expanded) {
      setClosing(false);
      setReopened(true);
      setOpen(true);
      return;
    }
    // Focus inside the content would be lost once it is hidden.
    if (bodyRef.current?.contains(document.activeElement)) {
      toggleRef.current?.focus();
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOpen(false);
      return;
    }
    setClosing(true);
    timer.current = window.setTimeout(() => {
      setClosing(false);
      setOpen(false);
    }, CLOSE_DURATION);
  }

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // React 18 has no `inert` prop: keep the fading content out of the tab order.
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.inert = closing;
  }, [closing]);

  useEffect(() => {
    requestCircuitRecompute();
  }, [open]);

  return {
    expanded,
    toggle,
    toggleRef,
    bodyRef,
    bodyId: `${id}-content`,
    open,
    closing,
    reopened,
  };
}

export type Collapsible = ReturnType<typeof useCollapsible>;

export function PanelToggle({
  collapsible,
  label,
}: {
  collapsible: Collapsible;
  label: string;
}) {
  const { expanded, toggle, toggleRef, bodyId } = collapsible;
  const action = expanded ? "Replier" : "Déplier";
  return (
    <button
      ref={toggleRef}
      type="button"
      className="panel-toggle"
      aria-expanded={expanded}
      aria-controls={bodyId}
      aria-label={`${action} ${label}`}
      title={`${action} ${label}`}
      onClick={toggle}
    >
      <ChevronDown size={16} aria-hidden="true" />
    </button>
  );
}

export function PanelBody({
  collapsible,
  children,
}: {
  collapsible: Collapsible;
  children: ReactNode;
}) {
  const { bodyRef, bodyId, open, closing, reopened } = collapsible;
  return (
    <div
      ref={bodyRef}
      id={bodyId}
      className="collapsible-body"
      data-state={closing ? "closing" : reopened ? "opening" : "open"}
      hidden={!open}
    >
      {children}
    </div>
  );
}
