import { Search } from "lucide-react";
import { MODULE_CATEGORIES, type ModuleCategory } from "../../environmentRegistry";

/* Catalogue search field and category filters, shared by both customisation dialogs. */
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
