import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

type Props = {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  retry?: () => void;
  action?: { label: string; onClick: () => void };
};

/* Compact empty state: what is missing, why, and where to act. Never a placeholder value. */
export function DashboardEmptyState({ icon, title, children, retry, action }: Props) {
  return <div className="dashboard-empty-state is-compact">
    {icon && <span className="empty-glyph" aria-hidden="true">{icon}</span>}
    <div className="empty-copy"><strong>{title}</strong>{children && <p>{children}</p>}</div>
    {retry ? <button type="button" className="panel-action" onClick={retry}>Réessayer</button>
      : action && <button type="button" className="text-action" onClick={action.onClick}>{action.label} <ChevronRight size={14} aria-hidden="true" /></button>}
  </div>;
}
