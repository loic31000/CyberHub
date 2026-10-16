import { useCallback, useRef, useState } from "react";

/* A dialog opened from a button: whether it is open, and the button focus returns to. */
export function useDialogTrigger() {
  const [open, setOpen] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const show = useCallback((trigger: HTMLElement) => {
    returnFocus.current = trigger;
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  return { open, returnFocus, show, close };
}
