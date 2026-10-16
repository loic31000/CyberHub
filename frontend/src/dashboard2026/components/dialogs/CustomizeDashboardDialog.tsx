import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, RefObject } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, RotateCcw, X } from "lucide-react";
import { CatalogSearch } from "./CatalogSearch";
import { rowAction, trapTab } from "./dialogFocus";
import { categoryOf, type ModuleCategory } from "../../environmentRegistry";
import { searchItems } from "../../moduleSearch";
import {
  WIDGET_SIZE_LABELS,
  getWidget,
  spanOf,
  widgetSizes,
  type WidgetId,
  type WidgetPlacement,
  type WidgetSize,
} from "../../widgetRegistry";

/*
 * Large widgets customisation, built like the environment cards dialog:
 * an ordered layout (Monter / Descendre, size, Masquer), a searchable catalogue
 * to show hidden widgets again, a schematic preview of the grid, and a reset
 * confirmed inside the dialog. Every action works with the keyboard and is
 * announced; changes apply to the dashboard at once and are saved locally.
 */

type PendingFocus = { id: WidgetId; action: "up" | "down" | "size" | "hide" | "show" } | "layout" | "catalog" | "reset" | null;

export function CustomizeDashboardDialog({
  open,
  widgets,
  onChange,
  onReset,
  onClose,
  returnFocus,
  persisted,
}: {
  open: boolean;
  widgets: WidgetPlacement[];
  onChange: (next: WidgetPlacement[]) => void;
  onReset: () => void;
  onClose: () => void;
  returnFocus: RefObject<HTMLElement | null>;
  persisted: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [message, setMessage] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingFocus, setPendingFocus] = useState<PendingFocus>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ModuleCategory | "all">("all");

  useEffect(() => {
    if (!open) return;
    setMessage("");
    setConfirmReset(false);
    setQuery("");
    setCategory("all");
    requestAnimationFrame(() => closeRef.current?.focus());
  }, [open]);

  // Keep the focus on the control that was used once the lists re-render.
  useEffect(() => {
    if (!pendingFocus || !dialogRef.current) return;
    const root = dialogRef.current;
    let target: HTMLElement | null = null;
    if (pendingFocus === "layout") target = root.querySelector("#widgets-layout-title");
    else if (pendingFocus === "catalog") target = root.querySelector("#widgets-catalog-title");
    else if (pendingFocus === "reset") target = root.querySelector("[data-reset-confirm]") ?? root.querySelector("[data-reset]");
    else {
      target = rowAction(root, `[data-widget-row="${pendingFocus.id}"]`, pendingFocus.action);
    }
    target?.focus();
    setPendingFocus(null);
  }, [pendingFocus, widgets, confirmReset]);

  if (!open) return null;

  const title = (id: WidgetId) => getWidget(id)?.title ?? id;
  const shown = widgets.filter((w) => w.visible);
  const announce = (text: string) => setMessage(text);

  function close() {
    onClose();
    requestAnimationFrame(() => returnFocus.current?.focus());
  }

  // Up and down move among the shown widgets; hidden ones keep their place.
  function move(id: WidgetId, delta: -1 | 1) {
    const position = shown.findIndex((w) => w.id === id);
    const neighbour = shown[position + delta];
    if (!neighbour) return;
    const next = [...widgets];
    const a = next.findIndex((w) => w.id === id);
    const b = next.findIndex((w) => w.id === neighbour.id);
    [next[a], next[b]] = [next[b], next[a]];
    onChange(next);
    announce(`${title(id)} déplacé en position ${position + delta + 1} sur ${shown.length}.`);
    setPendingFocus({ id, action: delta < 0 ? "up" : "down" });
  }

  function resize(id: WidgetId, size: WidgetSize) {
    onChange(widgets.map((w) => (w.id === id ? { ...w, size } : w)));
    announce(`${title(id)} : taille ${WIDGET_SIZE_LABELS[size].toLowerCase()}.`);
  }

  function setVisible(id: WidgetId, visible: boolean, from: "layout" | "catalog") {
    const position = shown.findIndex((w) => w.id === id);
    const next = widgets.map((w) => (w.id === id ? { ...w, visible } : w));
    onChange(next);
    const count = next.filter((w) => w.visible).length;
    if (visible) {
      const at = next.filter((w) => w.visible).findIndex((w) => w.id === id) + 1;
      announce(`${title(id)} affiché en position ${at} sur ${count}.`);
      setPendingFocus(from === "catalog" ? { id, action: "hide" } : "layout");
    } else {
      announce(`${title(id)} masqué. Il reste disponible dans le catalogue. ${count} widget${count > 1 ? "s" : ""} affiché${count > 1 ? "s" : ""}.`);
      if (from === "catalog") setPendingFocus({ id, action: "show" });
      else {
        const remaining = next.filter((w) => w.visible);
        const neighbour = remaining[Math.min(position, remaining.length - 1)];
        setPendingFocus(neighbour ? { id: neighbour.id, action: "hide" } : "catalog");
      }
    }
  }

  function confirmTheReset() {
    onReset();
    setConfirmReset(false);
    announce("Disposition d’origine des widgets rétablie.");
    setPendingFocus("reset");
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (confirmReset) {
        setConfirmReset(false);
        setPendingFocus("reset");
      } else close();
      return;
    }
    trapTab(event, dialogRef.current);
  }

  // Catalogue: every widget, hidden ones first, filtered like the module catalogue.
  const catalog = searchItems(
    query,
    widgets.map((w) => ({ ...w, ...getWidget(w.id)! })),
  ).filter((w) => category === "all" || w.category === category);
  const catalogSorted = [...catalog.filter((w) => !w.visible), ...catalog.filter((w) => w.visible)];

  return (
    <div className="detail-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div
        className="detail-dialog customize-dialog widgets-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="widgets-title"
        aria-describedby="widgets-description"
        ref={dialogRef}
        onKeyDown={handleKeyDown}
      >
        <div className="customize-head">
          <div>
            <span className="detail-kicker">DASHBOARD</span>
            <h2 id="widgets-title">Personnaliser le Dashboard</h2>
          </div>
          <button ref={closeRef} type="button" className="close-button" aria-label="Fermer la personnalisation du Dashboard" onClick={close}>
            <X size={19} />
          </button>
        </div>

        <div className="customize-body">
          <p id="widgets-description" className="customize-intro">
            Choisissez les grands widgets affichés, leur ordre et leur taille. Le bandeau et l’état de l’environnement
            restent en tête. Les tailles s’appliquent sur ordinateur ; sur tablette et mobile, l’ordre est conservé.
          </p>

          {/* Schematic preview of the desktop grid, same spans as the dashboard. */}
          <div className="widget-preview" aria-hidden="true">
            {shown.map((placement) => {
              const span = spanOf(placement);
              return (
                <span key={placement.id} style={{ "--w-cols": span.cols, "--w-rows": span.rows } as CSSProperties}>
                  {title(placement.id)}
                </span>
              );
            })}
            {!shown.length && <em>Aucun widget affiché</em>}
          </div>

          <section aria-labelledby="widgets-layout-title">
            <h3 id="widgets-layout-title" tabIndex={-1}>
              Disposition <span className="customize-count">{shown.length}</span>
            </h3>
            {shown.length ? (
              <ol className="customize-selected widget-rows">
                {shown.map((placement, index) => {
                  const widget = getWidget(placement.id);
                  if (!widget) return null;
                  const Icon = widget.icon;
                  const first = index === 0;
                  const last = index === shown.length - 1;
                  return (
                    <li key={placement.id} data-widget-row={placement.id}>
                      <span className="customize-position" aria-hidden="true">{index + 1}</span>
                      <span className="customize-icon" aria-hidden="true">
                        <Icon size={17} />
                      </span>
                      <span className="customize-copy">
                        <strong>{widget.title}</strong>
                        <small>{WIDGET_SIZE_LABELS[placement.size]}</small>
                      </span>
                      <span className="widget-sizes" role="group" aria-label={`Taille de ${widget.title}`}>
                        {widgetSizes(placement.id).map((size) => (
                          <button
                            key={size}
                            type="button"
                            data-action="size"
                            aria-pressed={placement.size === size}
                            onClick={() => resize(placement.id, size)}
                          >
                            {WIDGET_SIZE_LABELS[size]}
                          </button>
                        ))}
                      </span>
                      <span className="customize-actions">
                        <button type="button" data-action="up" aria-label={`Monter ${widget.title}`} title="Monter" aria-disabled={first || undefined} onClick={() => !first && move(placement.id, -1)}>
                          <ArrowUp size={15} aria-hidden="true" />
                        </button>
                        <button type="button" data-action="down" aria-label={`Descendre ${widget.title}`} title="Descendre" aria-disabled={last || undefined} onClick={() => !last && move(placement.id, 1)}>
                          <ArrowDown size={15} aria-hidden="true" />
                        </button>
                        <button type="button" data-action="hide" aria-label={`Masquer ${widget.title}`} title="Masquer" onClick={() => setVisible(placement.id, false, "layout")}>
                          <EyeOff size={15} aria-hidden="true" />
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="customize-empty">Aucun widget affiché : affichez-en un depuis le catalogue.</p>
            )}
          </section>

          <section aria-labelledby="widgets-catalog-title">
            <div className="customize-catalog-head">
              <h3 id="widgets-catalog-title" tabIndex={-1}>
                Catalogue des widgets
              </h3>
            </div>
            <CatalogSearch
              query={query}
              onQuery={setQuery}
              category={category}
              onCategory={setCategory}
              label="Rechercher un widget"
              count={catalogSorted.length}
            />
            {catalogSorted.length ? (
              <ul className="customize-catalog">
                {catalogSorted.map((widget) => {
                  const Icon = widget.icon;
                  return (
                    <li key={widget.id} data-widget-row={widget.id}>
                      <span className="customize-icon" aria-hidden="true">
                        <Icon size={17} />
                      </span>
                      <span className="customize-copy">
                        <strong>
                          {widget.title}
                          <span className="catalog-tag">{categoryOf(widget.category).code}</span>
                          <span className={`catalog-tag ${widget.visible ? "is-shown" : "is-hidden"}`}>{widget.visible ? "Affiché" : "Masqué"}</span>
                        </strong>
                        <small>{widget.description}</small>
                      </span>
                      {widget.visible ? (
                        <button
                          type="button"
                          className="customize-choose"
                          data-action="hide"
                          aria-label={`Masquer ${widget.title}`}
                          onClick={() => setVisible(widget.id, false, "catalog")}
                        >
                          <EyeOff size={14} aria-hidden="true" />
                          Masquer
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="customize-choose is-restore"
                          data-action="show"
                          aria-label={`Afficher ${widget.title}`}
                          onClick={() => setVisible(widget.id, true, "catalog")}
                        >
                          <Eye size={14} aria-hidden="true" />
                          Afficher
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="catalog-empty">
                <p>Aucun widget ne correspond à cette recherche.</p>
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
              <span>Rétablir la disposition d’origine des widgets ?</span>
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
