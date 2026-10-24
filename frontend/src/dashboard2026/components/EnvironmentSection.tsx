import { ChevronRight, SlidersHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EnvironmentGrid } from "./EnvironmentGrid";
import type { EnvironmentStatuses } from "../model/dashboard.types";

type Props = {
  envCards: string[];
  statuses: EnvironmentStatuses;
  hasError: boolean;
  onRetry: () => void;
  onCustomize: (trigger: HTMLElement) => void;
  onOpen: (route: string) => void;
};

/* ÉTAT DE L’ENVIRONNEMENT: the chosen cards, a retry when data failed, the customisation entry. */
export function EnvironmentSection({ envCards, statuses, hasError, onRetry, onCustomize, onOpen }: Props) {
  const navigate = useNavigate();
  return <section className="dashboard-panel environment-panel" aria-labelledby="environment-title">
    <header className="panel-heading environment-heading">
      <div><h2 id="environment-title">ÉTAT DE L’ENVIRONNEMENT</h2><p>Modules et données disponibles dans la Console.</p></div>
      <div className="environment-meta">
        {hasError && <button type="button" className="panel-action" onClick={onRetry}>Réessayer les données</button>}
        <button type="button" className="panel-action environment-customize" aria-haspopup="dialog" onClick={(event) => onCustomize(event.currentTarget)}><SlidersHorizontal size={14} aria-hidden="true" />Personnaliser</button>
        <button type="button" className="panel-action" onClick={() => navigate("/tools")}>Voir les outils <ChevronRight size={14} /></button>
      </div>
    </header>
    <EnvironmentGrid envCards={envCards} statuses={statuses} onOpen={onOpen} onAdd={onCustomize} />
  </section>;
}
