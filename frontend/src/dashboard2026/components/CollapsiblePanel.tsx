import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { Collapsible } from "../hooks/useCollapsible";

/* The toggle and the body of a collapsible panel (state: hooks/useCollapsible). */

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
