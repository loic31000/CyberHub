import type { CSSProperties } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { getEnvironmentCard, type EnvironmentCardDefinition, type SystemCard } from "../environmentRegistry";

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
  onOpen: (destination: string) => void;
  status?: Pick<SystemCard, "status" | "secondary" | "tone">;
}) {
  const Icon = card.icon;
  if (card.kind === "system") {
    const current = status ?? card;
    // Same markup as Phase 2N: the default dashboard stays visually identical.
    return (
      <button type="button" className={`environment-card signal-${current.tone}`} onClick={() => onOpen(card.action)}>
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
        <MiniBars bars={card.bars} />
      </button>
    );
  }
  // Module card: access only, no value or status the prototype could not know.
  return (
    <button type="button" className="environment-card is-module" onClick={() => onOpen(card.title)}>
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
  onOpen: (destination: string) => void;
  onAdd: (trigger: HTMLElement) => void;
  statuses?: Record<string, Pick<SystemCard, "status" | "secondary" | "tone">>;
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
