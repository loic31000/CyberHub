import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, RefObject } from "react";
import { ArrowDown, ArrowUp, ChevronRight, Plus, Repeat2, RotateCcw, Search, Trash2, X } from "lucide-react";
import {
  ENVIRONMENT_CARDS,
  MODULE_CATEGORIES,
  categoryOf,
  getEnvironmentCard,
  type EnvironmentCardDefinition,
  type ModuleCategory,
  type SystemCard,
} from "./environmentRegistry";
import { normalize, searchItems } from "./moduleSearch";

/* Phase 3A.1: environment cards and their customisation dialog. */

export function MiniBars({ bars }: { bars: number[] }) {
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

type PendingFocus = { id: string; action: "up" | "down" | "replace" | "remove" } | "catalog" | "selected" | "reset" | null;

/* Catalogue search: the same metadata and matching as the global search. */
const searchableCard = (card: EnvironmentCardDefinition) => ({
  ...card,
  description: card.kind === "system" ? `Carte système ${card.status} ${card.secondary}` : card.description,
});

export function CatalogSearch({
  query,
  onQuery,
  category,
  onCategory,
  label,
  count,
}: {
  query: string;
  onQuery: (value: string) => void;
  category: ModuleCategory | "all";
  onCategory: (value: ModuleCategory | "all") => void;
  label: string;
  count: number;
}) {
  return (
    <div className="catalog-search">
      <label className="catalog-field">
        <Search size={15} aria-hidden="true" />
        <span className="sr-only">{label}</span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Nom, alias ou catégorie…"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <div className="catalog-filters" role="group" aria-label="Filtrer par catégorie">
        {[{ id: "all" as const, code: "Tous", label: "Toutes les catégories" }, ...MODULE_CATEGORIES].map((c) => (
          <button
            key={c.id}
            type="button"
            className="catalog-filter"
            aria-pressed={category === c.id}
            title={c.label}
            onClick={() => onCategory(c.id)}
          >
            {c.code}
          </button>
        ))}
      </div>
      <p className="catalog-count" aria-live="polite">
        {count} résultat{count > 1 ? "s" : ""}
      </p>
    </div>
  );
}

export function CustomizeEnvironmentDialog({
  open,
  envCards,
  onChange,
  onReset,
  onClose,
  returnFocus,
  persisted,
}: {
  open: boolean;
  envCards: string[];
  onChange: (next: string[]) => void;
  onReset: () => void;
  onClose: () => void;
  returnFocus: RefObject<HTMLElement | null>;
  persisted: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [message, setMessage] = useState("");
  const [replacing, setReplacing] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingFocus, setPendingFocus] = useState<PendingFocus>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ModuleCategory | "all">("all");

  useEffect(() => {
    if (!open) return;
    setMessage("");
    setReplacing(null);
    setConfirmReset(false);
    setQuery("");
    setCategory("all");
    requestAnimationFrame(() => closeRef.current?.focus());
  }, [open]);

  // Restore focus after a change re-renders the lists.
  useEffect(() => {
    if (!pendingFocus || !dialogRef.current) return;
    const root = dialogRef.current;
    let target: HTMLElement | null = null;
    if (pendingFocus === "catalog") target = root.querySelector("#customize-catalog-title");
    else if (pendingFocus === "selected") target = root.querySelector("#customize-selected-title");
    else if (pendingFocus === "reset") target = root.querySelector("[data-reset-confirm]") ?? root.querySelector("[data-reset]");
    else {
      const row = root.querySelector(`[data-card-row="${pendingFocus.id}"]`);
      target =
        row?.querySelector<HTMLElement>(`[data-action="${pendingFocus.action}"]:not([aria-disabled="true"])`) ??
        row?.querySelector<HTMLElement>("[data-action]:not([aria-disabled='true'])") ??
        null;
    }
    target?.focus();
    setPendingFocus(null);
  }, [pendingFocus, envCards, replacing, confirmReset]);

  if (!open) return null;

  const title = (id: string) => getEnvironmentCard(id)?.title ?? id;
  const announce = (text: string) => setMessage(text);

  function close() {
    onClose();
    requestAnimationFrame(() => returnFocus.current?.focus());
  }

  function move(id: string, delta: -1 | 1) {
    const index = envCards.indexOf(id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= envCards.length) return;
    const next = [...envCards];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
    announce(`${title(id)} déplacé en position ${target + 1} sur ${next.length}.`);
    setPendingFocus({ id, action: delta < 0 ? "up" : "down" });
  }

  function remove(id: string) {
    const index = envCards.indexOf(id);
    const next = envCards.filter((card) => card !== id);
    onChange(next);
    announce(`${title(id)} retiré du Dashboard. ${next.length} carte${next.length > 1 ? "s" : ""} affichée${next.length > 1 ? "s" : ""}. Le module reste accessible depuis la navigation.`);
    const neighbour = next[Math.min(index, next.length - 1)];
    setPendingFocus(neighbour ? { id: neighbour, action: "remove" } : "catalog");
  }

  function choose(id: string) {
    if (replacing) {
      if (envCards.includes(id)) {
        announce(`${title(id)} est déjà affiché.`);
        return;
      }
      const next = envCards.map((card) => (card === replacing ? id : card));
      onChange(next);
      announce(`${title(replacing)} remplacé par ${title(id)}.`);
      setReplacing(null);
      setPendingFocus({ id, action: "replace" });
      return;
    }
    if (envCards.includes(id)) {
      announce(`${title(id)} est déjà affiché.`);
      return;
    }
    const next = [...envCards, id];
    onChange(next);
    announce(`${title(id)} ajouté en position ${next.length}.`);
  }

  function startReplace(id: string) {
    setReplacing(id);
    setConfirmReset(false);
    announce(`Choisissez le module qui remplacera ${title(id)}.`);
    setPendingFocus("catalog");
  }

  function cancelReplace() {
    const id = replacing;
    setReplacing(null);
    announce("Remplacement annulé.");
    if (id) setPendingFocus({ id, action: "replace" });
  }

  function confirmTheReset() {
    onReset();
    setConfirmReset(false);
    setReplacing(null);
    announce("Disposition d'origine rétablie : cinq cartes.");
    setPendingFocus("reset");
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (replacing) cancelReplace();
      else if (confirmReset) {
        setConfirmReset(false);
        setPendingFocus("reset");
      } else close();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = [
      ...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, [href], [tabindex]:not([tabindex="-1"])'),
    ];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // Matching cards, those not on the dashboard first; the match order is kept within each part.
  const matching = searchItems(query, ENVIRONMENT_CARDS.map(searchableCard)).filter(
    (card) => category === "all" || card.category === category,
  );
  const results = [...matching.filter((card) => !envCards.includes(card.id)), ...matching.filter((card) => envCards.includes(card.id))];

  const catalogItem = (card: EnvironmentCardDefinition) => {
    const Icon = card.icon;
    const shown = envCards.includes(card.id);
    const isTarget = card.id === replacing;
    const label = isTarget ? "Carte actuelle" : shown ? "Déjà affiché" : replacing ? "Choisir" : "Ajouter";
    const unavailable = shown || isTarget;
    return (
      <li key={card.id}>
        <span className="customize-icon" aria-hidden="true">
          <Icon size={17} />
        </span>
        <span className="customize-copy">
          <strong>
            {card.title}
            <span className="catalog-tag">{categoryOf(card.category).code}</span>
            {shown && !isTarget && <span className="catalog-tag is-shown">Affiché</span>}
          </strong>
          <small>{card.kind === "system" ? "Carte système · données de la Console" : `${card.description} · ${card.route}`}</small>
        </span>
        <button
          type="button"
          className={`customize-choose${unavailable ? " is-unavailable" : ""}`}
          aria-disabled={unavailable || undefined}
          aria-label={
            unavailable
              ? `${card.title} : ${label.toLowerCase()}`
              : replacing
                ? `Remplacer ${title(replacing)} par ${card.title}`
                : `Ajouter ${card.title}`
          }
          onClick={() =>
            unavailable
              ? announce(isTarget ? `${card.title} est la carte en cours de remplacement.` : `${card.title} est déjà affiché.`)
              : choose(card.id)
          }
        >
          {!unavailable && (replacing ? <Repeat2 size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />)}
          {label}
        </button>
      </li>
    );
  };

  return (
    <div className="detail-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div
        className="detail-dialog customize-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customize-title"
        aria-describedby="customize-description"
        ref={dialogRef}
        onKeyDown={handleKeyDown}
      >
        {/* div, not header/footer: inside a dialog they would read as duplicate page landmarks. */}
        <div className="customize-head">
          <div>
            <span className="detail-kicker">ÉTAT DE L’ENVIRONNEMENT</span>
            <h2 id="customize-title">Personnaliser les cartes</h2>
          </div>
          <button ref={closeRef} type="button" className="close-button" aria-label="Fermer la personnalisation" onClick={close}>
            <X size={19} />
          </button>
        </div>

        <div className="customize-body">
          <p id="customize-description" className="customize-intro">
            Choisissez les modules affichés et leur ordre. Les cartes de module donnent accès au module ; elles
            n’affichent aucune donnée dans cette vue.
          </p>

          <section aria-labelledby="customize-selected-title">
            <h3 id="customize-selected-title" tabIndex={-1}>
              Cartes affichées <span className="customize-count">{envCards.length}</span>
            </h3>
            {envCards.length ? (
              <ol className="customize-selected">
                {envCards.map((id, index) => {
                  const card = getEnvironmentCard(id);
                  if (!card) return null;
                  const Icon = card.icon;
                  const first = index === 0;
                  const last = index === envCards.length - 1;
                  return (
                    <li key={id} data-card-row={id} className={id === replacing ? "is-replacing" : undefined}>
                      <span className="customize-position" aria-hidden="true">{index + 1}</span>
                      <span className="customize-icon" aria-hidden="true">
                        <Icon size={17} />
                      </span>
                      <span className="customize-copy">
                        <strong>{card.title}</strong>
                        <small>{card.kind === "system" ? "Démonstration" : "Accès au module"}</small>
                      </span>
                      <span className="customize-actions">
                        <button type="button" data-action="up" aria-label={`Monter ${card.title}`} title="Monter" aria-disabled={first || undefined} onClick={() => !first && move(id, -1)}>
                          <ArrowUp size={15} aria-hidden="true" />
                        </button>
                        <button type="button" data-action="down" aria-label={`Descendre ${card.title}`} title="Descendre" aria-disabled={last || undefined} onClick={() => !last && move(id, 1)}>
                          <ArrowDown size={15} aria-hidden="true" />
                        </button>
                        <button type="button" data-action="replace" aria-label={`Remplacer ${card.title}`} title="Remplacer" aria-pressed={id === replacing} onClick={() => (id === replacing ? cancelReplace() : startReplace(id))}>
                          <Repeat2 size={15} aria-hidden="true" />
                        </button>
                        <button type="button" data-action="remove" aria-label={`Retirer ${card.title}`} title="Retirer" onClick={() => remove(id)}>
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="customize-empty">Aucune carte : ajoutez un module ci-dessous.</p>
            )}
          </section>

          <section aria-labelledby="customize-catalog-title">
            <div className="customize-catalog-head">
              <h3 id="customize-catalog-title" tabIndex={-1}>
                {replacing ? `Remplacer ${title(replacing)} par…` : "Ajouter un module"}
              </h3>
              {replacing && (
                <button type="button" className="text-action" onClick={cancelReplace}>
                  Annuler le remplacement
                </button>
              )}
            </div>
            <CatalogSearch
              query={query}
              onQuery={setQuery}
              category={category}
              onCategory={setCategory}
              label="Rechercher un module à ajouter"
              count={results.length}
            />
            {results.length ? (
              <ul className="customize-catalog">{results.map(catalogItem)}</ul>
            ) : (
              <div className="catalog-empty">
                <p>
                  Aucun module ne correspond{normalize(query) ? ` à « ${query.trim()} »` : ""}
                  {category !== "all" ? ` dans ${categoryOf(category).code}` : ""}.
                </p>
                <button
                  type="button"
                  className="text-action"
                  onClick={() => {
                    setQuery("");
                    setCategory("all");
                  }}
                >
                  Effacer la recherche
                </button>
              </div>
            )}
          </section>
        </div>

        <div className="customize-foot">
          {confirmReset ? (
            <div className="customize-confirm" role="group" aria-label="Confirmer la réinitialisation">
              <span>Rétablir les cinq cartes d’origine ?</span>
              <button type="button" className="panel-action" data-reset-confirm onClick={confirmTheReset}>
                Confirmer
              </button>
              <button
                type="button"
                className="text-action"
                onClick={() => {
                  setConfirmReset(false);
                  setPendingFocus("reset");
                }}
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="text-action"
              data-reset
              onClick={() => {
                setConfirmReset(true);
                setReplacing(null);
                setPendingFocus("reset");
              }}
            >
              <RotateCcw size={14} aria-hidden="true" /> Réinitialiser
            </button>
          )}
          <span className="customize-storage">{persisted ? "Enregistré sur cet appareil" : "Stockage local indisponible : choix non conservés"}</span>
          <button type="button" className="panel-action" onClick={close}>
            Terminer
          </button>
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {message}
        </p>
      </div>
    </div>
  );
}
