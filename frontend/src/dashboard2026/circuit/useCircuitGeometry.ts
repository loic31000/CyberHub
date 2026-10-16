import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { buildBoard } from "./builder";
import { CIRCUIT_LAYOUT_EVENT } from "./events";
import { measure } from "./measure";
import type { CircuitGeometry } from "./types";

/* The geometry of the board, recomputed only when the measured layout changes. */

/*
 * Measures the board only when something can have moved: element resize,
 * window resize, font loading, or an explicit layout-change event. Updates are
 * coalesced in one animation frame and skipped when the rounded geometry is
 * unchanged, so the observer cannot feed itself.
 */
export function useCircuitGeometry(hostRef: RefObject<HTMLElement | null>) {
  const [geometry, setGeometry] = useState<CircuitGeometry | null>(null);
  const signature = useRef("");
  const frame = useRef(0);
  const observer = useRef<ResizeObserver | null>(null);
  const observed = useRef<Element[]>([]);
  const revision = useRef(0);
  const drawings = useRef(0);
  const lastBoard = useRef("");

  const recompute = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const host = hostRef.current;
      if (!host) return;
      const { elements, width, height, obstacles, slots, anchor, widgetTop } = measure(host);

      const sameElements =
        elements.length === observed.current.length &&
        elements.every((element, index) => element === observed.current[index]);
      if (!sameElements && observer.current) {
        observer.current.disconnect();
        observer.current.observe(host);
        elements.forEach((element) => observer.current?.observe(element));
        observed.current = elements;
      }

      const next = JSON.stringify([width, height, obstacles, slots, anchor, widgetTop]);
      if (next === signature.current || width === 0 || height === 0) return;
      signature.current = next;
      const board = buildBoard(width, height, obstacles, slots, anchor, widgetTop);
      if (board.boardKey !== lastBoard.current) {
        lastBoard.current = board.boardKey;
        drawings.current += 1;
      }
      revision.current = drawings.current;
      setGeometry({ ...board, revision: revision.current });
    });
  }, [hostRef]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    observer.current = new ResizeObserver(recompute);
    observer.current.observe(host);
    window.addEventListener("resize", recompute);
    window.addEventListener(CIRCUIT_LAYOUT_EVENT, recompute);
    document.fonts?.ready.then(recompute);
    recompute();
    return () => {
      cancelAnimationFrame(frame.current);
      observer.current?.disconnect();
      observer.current = null;
      observed.current = [];
      window.removeEventListener("resize", recompute);
      window.removeEventListener(CIRCUIT_LAYOUT_EVENT, recompute);
    };
  }, [hostRef, recompute]);

  return { geometry, recompute };
}
