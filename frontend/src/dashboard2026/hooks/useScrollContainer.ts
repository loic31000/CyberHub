import { useEffect } from "react";
import type { RefObject } from "react";

/*
 * Layout owns the scrolling element (the Dashboard root's parent). Reserve its
 * scrollbar gutter while the Dashboard is shown, and lock only that element
 * while `locked` (a dialog is visible). Both are restored on cleanup.
 */
export function useScrollContainer(rootRef: RefObject<HTMLElement | null>, locked: boolean) {
  useEffect(() => {
    const scroll = rootRef.current?.parentElement;
    if (!scroll) return;
    const previous = scroll.style.scrollbarGutter;
    scroll.style.scrollbarGutter = "stable";
    return () => { scroll.style.scrollbarGutter = previous; };
  }, [rootRef]);

  useEffect(() => {
    const scroll = rootRef.current?.parentElement;
    if (!scroll || !locked) return;
    const previous = scroll.style.overflow;
    scroll.style.overflow = "hidden";
    return () => { scroll.style.overflow = previous; };
  }, [rootRef, locked]);
}
