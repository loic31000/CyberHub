import { useEffect, useRef, useState } from "react";
import { requestCircuitRecompute } from "../DashboardCircuit";

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
