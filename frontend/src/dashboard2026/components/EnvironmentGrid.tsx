import type { CSSProperties } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { getEnvironmentCard, signalOf, type EnvironmentCardDefinition } from "../environmentRegistry";
import type { CardStatus } from "../model/dashboard.types";

/* Phase 3A.1: the environment cards of the Dashboard, in the order chosen by the user. */

function MiniBars({ bars }: { bars: number[] }) {
  return (
    <span className="mini-bars" aria-hidden="true">
      {bars.map((height, index) => (
        <i key={index} style={{ "--bar-height": `${height}%` } as CSSProperties} />
      ))}
    </span>
  );
}

function EnvironmentCard({
  card,
  onOpen,
  status,
}: {
  card: EnvironmentCardDefinition;
  onOpen: (route: string) => void;
  status?: CardStatus;
}) {
  const Icon = card.icon;
  const signal = signalOf(card);
  if (signal) {
    const current = status ?? signal;
    // Same markup as Phase 2N: a card with a state keeps its LED and bars.
    return (
      <button type="button" className={`environment-card signal-${current.tone}`} onClick={() => onOpen(card.route)}>
        <span className="environment-icon">
          <Icon size={25} />
        </span>
        <span className="environment-copy">
          <strong>{card.title}</strong>
          <span>
            <i className="signal-led" aria-hidden="true" />
            {current.status}
          </span>
          <small>{current.secondary}</small>
        </span>
        <ChevronRight className="environment-arrow" size={16} aria-hidden="true" />
        <MiniBars bars={signal.bars} />
      </button>
    );
  }
  // Module card: access only, no value or status the Dashboard does not load.
  return (
    <button type="button" className="environment-card is-module" onClick={() => onOpen(card.route)}>
      <span className="environment-icon">
        <Icon size={25} />
      </span>
      <span className="environment-copy">
        <strong>{card.title}</strong>
        <span className="module-kind">Accès au module</span>
        <small>{card.description}</small>
      </span>
      <ChevronRight className="environment-arrow" size={16} aria-hidden="true" />
    </button>
  );
}

/* Columns follow the number of cards: at most six per row, rows kept balanced. */
function desktopColumns(count: number) {
  if (count <= 0) return 1;
  const rows = Math.ceil(count / 6);
  return Math.max(3, Math.ceil(count / rows));
}

export function EnvironmentGrid({
  envCards,
  onOpen,
  onAdd,
  statuses,
}: {
  envCards: string[];
  onOpen: (route: string) => void;
  onAdd: (trigger: HTMLElement) => void;
  statuses?: Record<string, CardStatus>;
}) {
  const cards = envCards.map(getEnvironmentCard).filter((card): card is EnvironmentCardDefinition => !!card);
  if (!cards.length) {
    return (
      <div className="environment-grid is-empty">
        <div className="environment-empty">
          <p>Aucune carte sélectionnée.</p>
          <button type="button" className="panel-action" onClick={(event) => onAdd(event.currentTarget)}>
            <Plus size={14} aria-hidden="true" /> Ajouter un module
          </button>
        </div>
      </div>
    );
  }
  return (
    <div
      className="environment-grid"
      style={{ "--env-cols": desktopColumns(cards.length) } as CSSProperties}
    >
      {cards.map((card) => (
        <EnvironmentCard key={card.id} card={card} onOpen={onOpen} status={statuses?.[card.id]} />
      ))}
    </div>
  );
}
