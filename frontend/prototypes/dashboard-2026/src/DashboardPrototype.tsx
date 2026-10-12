import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Binary,
  BookMarked,
  BookOpen,
  ChevronRight,
  Clock3,
  Code2,
  Compass,
  FileText,
  GitBranch,
  HelpCircle,
  History,
  Layers3,
  LayoutDashboard,
  Menu,
  Network,
  PanelLeftOpen,
  Search,
  Shield,
  ShieldAlert,
  StickyNote,
  Terminal,
  Wrench,
  X,
  EyeOff,
  type LucideIcon,
} from "lucide-react";

type ViewState = "sample" | "loading" | "empty" | "error";
type DomainId =
  "knowledge" | "intelligence" | "investigation" | "network" | "operations";
type Module = { label: string; icon: LucideIcon; group: string };
type SearchEntry = {
  id: string;
  title: string;
  detail: string;
  category: "Modules" | "Exemples fictifs";
  icon: LucideIcon;
};
type Domain = {
  id: DomainId;
  index: string;
  name: string;
  role: string;
  note: string;
  modules: string[];
  icon: LucideIcon;
};

const navigationGroups: { label: string; items: Module[] }[] = [
  {
    label: "ESPACE DE TRAVAIL",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, group: "Espace de travail" },
      { label: "Outils", icon: Wrench, group: "Espace de travail" },
      { label: "Writeups", icon: FileText, group: "Espace de travail" },
    ],
  },
  {
    label: "RENSEIGNEMENT",
    items: [
      { label: "CVE & KEV", icon: ShieldAlert, group: "Renseignement" },
      { label: "Playbooks", icon: BookOpen, group: "Renseignement" },
      { label: "MITRE ATT&CK", icon: Compass, group: "Renseignement" },
      { label: "Layers ATT&CK", icon: Layers3, group: "Renseignement" },
      { label: "LOLBins", icon: Terminal, group: "Renseignement" },
    ],
  },
  {
    label: "OPÉRATIONS",
    items: [
      { label: "CLOAK OpSec", icon: EyeOff, group: "Opérations" },
      { label: "IOC Manager", icon: Shield, group: "Opérations" },
      { label: "Corrélation", icon: GitBranch, group: "Opérations" },
      { label: "OSINT Runner", icon: Search, group: "Opérations" },
      { label: "Investigations", icon: Activity, group: "Opérations" },
    ],
  },
  {
    label: "RESSOURCES & RÉSEAU",
    items: [
      { label: "Notes", icon: StickyNote, group: "Ressources & réseau" },
      { label: "Cheatsheets", icon: BookMarked, group: "Ressources & réseau" },
      { label: "Encoder/Decoder", icon: Binary, group: "Ressources & réseau" },
      { label: "RevShell Gen", icon: Code2, group: "Ressources & réseau" },
      { label: "BGP Lookup", icon: Network, group: "Ressources & réseau" },
      { label: "BGP Historian", icon: History, group: "Ressources & réseau" },
    ],
  },
];

const modules = navigationGroups.flatMap((group) => group.items);

const domains: Domain[] = [
  {
    id: "knowledge",
    index: "01",
    name: "Connaissance",
    role: "Capitaliser ce qui mérite d’être retrouvé.",
    note: "Fiches, analyses et références de travail.",
    modules: ["Outils", "Writeups", "Notes", "Cheatsheets"],
    icon: BookMarked,
  },
  {
    id: "intelligence",
    index: "02",
    name: "Renseignement",
    role: "Consulter les sources et cadres de référence.",
    note: "Les indicateurs affichés sont des exemples de rendu.",
    modules: ["CVE & KEV", "MITRE ATT&CK", "Layers ATT&CK", "LOLBins"],
    icon: ShieldAlert,
  },
  {
    id: "investigation",
    index: "03",
    name: "Investigation",
    role: "Garder la provenance, les faits et les inconnues.",
    note: "Aucune corrélation ou conclusion n’est inventée.",
    modules: ["IOC Manager", "Corrélation", "OSINT Runner", "Investigations"],
    icon: Activity,
  },
  {
    id: "network",
    index: "04",
    name: "Réseau",
    role: "Comparer des observations de routage dans le temps.",
    note: "Aucun flux BGP réel n’est interrogé.",
    modules: ["BGP Lookup", "BGP Historian"],
    icon: Network,
  },
  {
    id: "operations",
    index: "05",
    name: "Opérations",
    role: "Accéder aux méthodes et utilitaires du quotidien.",
    note: "État non renseigné dans ce prototype.",
    modules: ["Playbooks", "CLOAK OpSec", "Encoder/Decoder", "RevShell Gen"],
    icon: Terminal,
  },
];

const demoSearchEntries: SearchEntry[] = [
  ...modules
    .filter(({ label }) => label !== "Dashboard")
    .map(({ label, icon, group }) => ({
      id: "module-" + label,
      title: label,
      detail: group,
      category: "Modules" as const,
      icon,
    })),
  {
    id: "demo-ioc",
    title: "198.51.100.42",
    detail: "Indicateur de documentation · exemple fictif",
    category: "Exemples fictifs",
    icon: Shield,
  },
  {
    id: "demo-playbook",
    title: "Première qualification",
    detail: "Playbook de démonstration",
    category: "Exemples fictifs",
    icon: BookOpen,
  },
  {
    id: "demo-bgp",
    title: "AS64512 → AS64513",
    detail: "Instantané BGP de documentation",
    category: "Exemples fictifs",
    icon: Network,
  },
];

const recentItems = [
  {
    eyebrow: "INDICATEUR FICTIF",
    title: "198.51.100.42",
    detail: "Provenance conservée · contexte à vérifier",
    icon: Shield,
  },
  {
    eyebrow: "INVESTIGATION D’EXEMPLE",
    title: "Triage initial",
    detail: "Trois notes disponibles pour reprendre le fil",
    icon: Activity,
  },
  {
    eyebrow: "PLAYBOOK FICTIF",
    title: "Première qualification",
    detail: "Dernière étape consultée · Collecter la source",
    icon: BookOpen,
  },
];

function Brand() {
  return (
    <span className="brand">
      <img src="/mark.svg" alt="" width="34" height="34" />
      <span>
        CYBER<span>HUB</span>
      </span>
    </span>
  );
}

function DataState({
  state,
  onReset,
}: {
  state: Exclude<ViewState, "sample">;
  onReset: () => void;
}) {
  const content = {
    loading: {
      title: "Chargement simulé",
      copy: "La structure reste stable pendant la récupération des données.",
    },
    empty: {
      title: "Aucune activité disponible",
      copy: "Les domaines restent accessibles même lorsque l’espace est vide.",
    },
    error: {
      title: "Vue momentanément indisponible",
      copy: "Erreur fictive : aucune connexion privée n’a été tentée.",
    },
  }[state];
  return (
    <div
      className={"data-state data-state-" + state}
      role={state === "error" ? "alert" : "status"}
    >
      {state === "loading" ? (
        <span className="state-loader" aria-hidden="true" />
      ) : (
        <span className="state-symbol" aria-hidden="true">
          {state === "empty" ? "∅" : "!"}
        </span>
      )}
      <div>
        <strong>{content.title}</strong>
        <p>{content.copy}</p>
      </div>
      {state === "error" && (
        <button type="button" className="inline-action" onClick={onReset}>
          Réessayer <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}

function SearchPalette({
  open,
  onClose,
  onSelect,
  returnFocus,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (title: string) => void;
  returnFocus: React.RefObject<HTMLElement | null>;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("fr");
    if (!term) return demoSearchEntries.slice(0, 8);
    return demoSearchEntries.filter((entry) =>
      (entry.title + " " + entry.detail).toLocaleLowerCase("fr").includes(term),
    );
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => setActiveIndex(0), [query]);

  function close() {
    onClose();
    requestAnimationFrame(() => returnFocus.current?.focus());
  }

  function select(entry: SearchEntry) {
    onSelect(entry.title);
    close();
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "ArrowDown" && results.length) {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
    }
    if (event.key === "ArrowUp" && results.length) {
      event.preventDefault();
      setActiveIndex(
        (current) => (current - 1 + results.length) % results.length,
      );
    }
    if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      select(results[activeIndex]);
    }
    if (event.key === "Tab" && dialogRef.current) {
      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
        ),
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
  }

  if (!open) return null;
  const categories = ["Modules", "Exemples fictifs"] as const;
  let resultIndex = 0;
  return (
    <div
      className="palette-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <div
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-labelledby="palette-title"
        ref={dialogRef}
        onKeyDown={handleKeyDown}
      >
        <h2 id="palette-title" className="sr-only">
          Rechercher dans le prototype CyberHub
        </h2>
        <div className="palette-input">
          <Search size={19} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            role="combobox"
            aria-expanded="true"
            aria-controls="search-results"
            aria-activedescendant={
              results[activeIndex]
                ? "result-" + results[activeIndex].id
                : undefined
            }
            placeholder="Rechercher un module ou un exemple fictif…"
          />
          <kbd>Échap</kbd>
        </div>
        <div className="palette-results" id="search-results" role="listbox">
          {results.length === 0 ? (
            <div className="search-empty">
              <Search size={24} aria-hidden="true" />
              <strong>Aucun résultat pour « {query} »</strong>
              <p>Essayez « IOC », « BGP » ou « Playbooks ».</p>
            </div>
          ) : (
            categories.map((category) => {
              const entries = results.filter(
                (entry) => entry.category === category,
              );
              if (!entries.length) return null;
              return (
                <section
                  className="result-group"
                  key={category}
                  role="group"
                  aria-label={category}
                >
                  <h3>{category}</h3>
                  {entries.map((entry) => {
                    const index = resultIndex++;
                    const Icon = entry.icon;
                    return (
                      <button
                        type="button"
                        role="option"
                        aria-selected={activeIndex === index}
                        id={"result-" + entry.id}
                        className="search-result"
                        key={entry.id}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => select(entry)}
                      >
                        <span className="result-icon">
                          <Icon size={17} />
                        </span>
                        <span>
                          <strong>{entry.title}</strong>
                          <small>{entry.detail}</small>
                        </span>
                        {activeIndex === index && (
                          <span className="enter-hint">↵ ouvrir</span>
                        )}
                      </button>
                    );
                  })}
                </section>
              );
            })
          )}
        </div>
        <div className="palette-footer">
          <span>
            <kbd>↑↓</kbd> naviguer
          </span>
          <span>
            <kbd>↵</kbd> sélectionner
          </span>
          <span>Recherche locale · données fictives</span>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPrototype() {
  const [state, setState] = useState<ViewState>("sample");
  const [activeDomain, setActiveDomain] = useState<DomainId>("investigation");
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [radarReady, setRadarReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const mobileSearchTrigger = useRef<HTMLButtonElement>(null);
  const searchReturnFocus = useRef<HTMLElement | null>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const selectedDomain = domains.find((domain) => domain.id === activeDomain)!;
  const SelectedDomainIcon = selectedDomain.icon;

  function selectDestination(label: string) {
    setMenuOpen(false);
    setNotice(
      label +
        " : destination disponible dans la Console, page non prototypée dans ce laboratoire.",
    );
  }

  function closeMenu(restoreFocus = true) {
    setMenuOpen(false);
    if (restoreFocus) requestAnimationFrame(() => menuTrigger.current?.focus());
  }

  function openSearch(returnTarget?: HTMLElement | null) {
    searchReturnFocus.current =
      returnTarget ??
      (window.matchMedia("(max-width: 760px)").matches
        ? mobileSearchTrigger.current
        : searchTrigger.current);
    setSearchOpen(true);
  }

  useEffect(() => {
    function shortcuts(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch(
          document.activeElement instanceof HTMLElement &&
            document.activeElement !== document.body
            ? document.activeElement
            : null,
        );
      }
      if (event.key === "Escape" && menuOpen) closeMenu();
    }
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  }, [menuOpen]);

  useEffect(() => {
    document.body.classList.toggle("overlay-open", menuOpen || searchOpen);
    return () => document.body.classList.remove("overlay-open");
  }, [menuOpen, searchOpen]);

  useEffect(() => {
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setRadarReady(true));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, []);

  return (
    <div className="cockpit">
      <a className="skip-link" href="#main-content">
        Aller au contenu
      </a>
      <header className="topbar">
        <button
          ref={menuTrigger}
          className="topbar-menu"
          type="button"
          aria-label="Ouvrir tous les modules"
          aria-expanded={menuOpen}
          aria-controls="module-drawer"
          onClick={() => setMenuOpen(true)}
        >
          <Menu size={19} />
        </button>
        <Brand />
        <button
          ref={searchTrigger}
          className="global-search"
          type="button"
          aria-haspopup="dialog"
          onClick={(event) => openSearch(event.currentTarget)}
        >
          <Search size={17} aria-hidden="true" />
          <span>Rechercher dans CyberHub</span>
          <kbd>Ctrl K</kbd>
        </button>
        <div className="topbar-actions">
          <button
            ref={mobileSearchTrigger}
            className="mobile-search"
            type="button"
            aria-label="Rechercher"
            onClick={(event) => openSearch(event.currentTarget)}
          >
            <Search size={19} />
          </button>
          <span className="local-status">
            <i aria-hidden="true" /> PROTOTYPE LOCAL
          </span>
          <button
            className="avatar"
            type="button"
            aria-label="Profil fictif du laboratoire"
            title="Profil fictif du laboratoire"
            onClick={() =>
              setNotice(
                "Profil de démonstration : aucune authentification n’est utilisée.",
              )
            }
          >
            CH
          </button>
        </div>
      </header>

      <aside className="nav-rail" aria-label="Accès principaux">
        <a
          className="rail-item is-active"
          href="#overview"
          aria-current="page"
          data-tooltip="Vue d’ensemble"
        >
          <LayoutDashboard size={19} />
          <span className="sr-only">Vue d’ensemble</span>
        </a>
        <button
          type="button"
          className="rail-item"
          data-tooltip="Rechercher"
          onClick={(event) => openSearch(event.currentTarget)}
        >
          <Search size={19} />
          <span className="sr-only">Rechercher</span>
        </button>
        <button
          type="button"
          className="rail-item"
          data-tooltip="Investigations"
          onClick={() => selectDestination("Investigations")}
        >
          <Activity size={19} />
          <span className="sr-only">Investigations</span>
        </button>
        <button
          type="button"
          className="rail-item"
          data-tooltip="CVE & KEV"
          onClick={() => selectDestination("CVE & KEV")}
        >
          <ShieldAlert size={19} />
          <span className="sr-only">CVE & KEV</span>
        </button>
        <button
          type="button"
          className="rail-item"
          data-tooltip="BGP Historian"
          onClick={() => selectDestination("BGP Historian")}
        >
          <Network size={19} />
          <span className="sr-only">BGP Historian</span>
        </button>
        <button
          type="button"
          className="rail-item rail-more"
          data-tooltip="Tous les modules"
          onClick={() => setMenuOpen(true)}
        >
          <PanelLeftOpen size={19} />
          <span className="sr-only">Tous les modules</span>
        </button>
      </aside>

      {menuOpen && (
        <div className="drawer-layer">
          <button
            className="drawer-scrim"
            type="button"
            aria-label="Fermer le menu"
            onClick={() => closeMenu()}
          />
          <aside
            className="module-drawer"
            id="module-drawer"
            aria-label="Tous les modules CyberHub"
          >
            <div className="drawer-head">
              <div>
                <span className="eyebrow">NAVIGATION</span>
                <h2>Tous les modules</h2>
              </div>
              <button
                type="button"
                className="close-button"
                aria-label="Fermer le menu"
                onClick={() => closeMenu()}
              >
                <X size={20} />
              </button>
            </div>
            <nav aria-label="Navigation complète">
              {navigationGroups.map((group) => (
                <section className="drawer-group" key={group.label}>
                  <h3>{group.label}</h3>
                  <div>
                    {group.items.map(({ label, icon: Icon }) => (
                      <button
                        type="button"
                        className={
                          label === "Dashboard"
                            ? "drawer-link is-current"
                            : "drawer-link"
                        }
                        key={label}
                        onClick={() =>
                          label === "Dashboard"
                            ? closeMenu()
                            : selectDestination(label)
                        }
                      >
                        <Icon size={17} />
                        <span>{label}</span>
                        {label === "Dashboard" ? (
                          <i>actuel</i>
                        ) : (
                          <ChevronRight size={14} />
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </nav>
            <p className="drawer-note">
              18 modules fonctionnels · navigation de prototype uniquement
            </p>
          </aside>
        </div>
      )}

      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={selectDestination}
        returnFocus={searchReturnFocus}
      />

      <main className="main-content" id="main-content">
        <div className="workspace" id="overview">
          <div className="page-heading">
            <div>
              <span className="eyebrow">DASHBOARD / COCKPIT</span>
              <h1>Vue d’ensemble</h1>
              <p>Reprenez votre travail là où vous l’avez laissé.</p>
            </div>
            <label className="lab-state">
              <span>État du laboratoire</span>
              <select
                value={state}
                onChange={(event) => setState(event.target.value as ViewState)}
              >
                <option value="sample">Exemples</option>
                <option value="loading">Chargement</option>
                <option value="empty">Vide</option>
                <option value="error">Erreur</option>
              </select>
            </label>
          </div>

          {notice && (
            <div className="notice" role="status">
              <span>{notice}</span>
              <button
                type="button"
                aria-label="Fermer le message"
                onClick={() => setNotice(null)}
              >
                <X size={16} />
              </button>
            </div>
          )}

          <section
            className="activity-overview"
            aria-labelledby="activity-map-title"
          >
            <div className="overview-head">
              <div>
                <span className="eyebrow">DÉCOUVRIR CYBERHUB</span>
                <h2 id="activity-map-title">
                  Choisissez votre point de départ
                </h2>
              </div>
              <p>Choisissez un domaine pour découvrir ses outils.</p>
            </div>
            {state === "sample" ? (
              <div className="domain-workbench">
                <div className="radar-column">
                  <div
                    className={
                      "radar-stage" + (radarReady ? " is-revealed" : "")
                    }
                  >
                    <div className="radar-grid" aria-hidden="true">
                      <span className="radar-ring radar-ring-outer" />
                      <span className="radar-ring radar-ring-inner" />
                      <span className="radar-cross" />
                    </div>
                    <div className="radar-sweep" aria-hidden="true" />
                    <div className="radar-core" aria-hidden="true">
                      <img src="/mark.svg" alt="" width="40" height="40" />
                      <strong>CYBERHUB</strong>
                      <span>EXPLORER</span>
                    </div>
                    <div
                      className="radar-domains"
                      role="group"
                      aria-label="Domaines fonctionnels CyberHub"
                    >
                      {domains.map((domain) => {
                        const Icon = domain.icon;
                        const selected = domain.id === activeDomain;
                        return (
                          <button
                            type="button"
                            className={
                              "radar-domain radar-domain-" +
                              domain.id +
                              (selected ? " is-selected" : "")
                            }
                            aria-pressed={selected}
                            key={domain.id}
                            onClick={() => setActiveDomain(domain.id)}
                          >
                            <span className="radar-point" aria-hidden="true" />
                            <Icon size={17} aria-hidden="true" />
                            <span>{domain.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div
                    className="mobile-domain-picker"
                    role="group"
                    aria-label="Choisir un domaine CyberHub"
                  >
                    {domains.map((domain) => {
                      const Icon = domain.icon;
                      const selected = domain.id === activeDomain;
                      return (
                        <button
                          type="button"
                          className={selected ? "is-selected" : ""}
                          aria-pressed={selected}
                          key={domain.id}
                          onClick={() => setActiveDomain(domain.id)}
                        >
                          <Icon size={17} aria-hidden="true" />
                          <span>{domain.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <article
                  className="domain-detail"
                  key={selectedDomain.id}
                  aria-live="polite"
                >
                  <div className="detail-heading">
                    <SelectedDomainIcon size={20} aria-hidden="true" />
                    <div>
                      <span className="eyebrow">VOUS POUVEZ ICI</span>
                      <h3>{selectedDomain.name}</h3>
                    </div>
                  </div>
                  <p className="detail-role">{selectedDomain.role}</p>
                  <ul
                    className="module-chips"
                    aria-label={"Modules du domaine " + selectedDomain.name}
                  >
                    {selectedDomain.modules.slice(0, 3).map((module) => (
                      <li key={module}>
                        <button
                          type="button"
                          onClick={() => selectDestination(module)}
                        >
                          {module} <ArrowUpRight size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="detail-note">{selectedDomain.note}</p>
                  <button
                    type="button"
                    className="domain-primary"
                    onClick={() => selectDestination(selectedDomain.modules[0])}
                  >
                    Ouvrir {selectedDomain.modules[0]} <ArrowRight size={15} />
                  </button>
                </article>
              </div>
            ) : (
              <DataState state={state} onReset={() => setState("sample")} />
            )}
            <button
              type="button"
              className="domain-help"
              onClick={() =>
                setNotice(
                  "Choisissez un domaine selon votre intention : documenter, consulter, enquêter, comparer le réseau ou agir.",
                )
              }
            >
              <HelpCircle size={14} /> Comment choisir ?
            </button>
          </section>

          <div className="secondary-grid">
            <section className="resume-section" aria-labelledby="resume-title">
              <div className="section-head">
                <div>
                  <span className="eyebrow">À REPRENDRE</span>
                  <h2 id="resume-title">Le fil de travail</h2>
                </div>
                <Clock3 size={18} aria-hidden="true" />
              </div>
              {state === "sample" ? (
                <ul className="resume-list">
                  {recentItems.map(({ eyebrow, title, detail, icon: Icon }) => (
                    <li key={title}>
                      <button
                        type="button"
                        onClick={() => selectDestination(title)}
                      >
                        <span className="resume-icon">
                          <Icon size={17} />
                        </span>
                        <span>
                          <small>{eyebrow}</small>
                          <strong>{title}</strong>
                          <span>{detail}</span>
                        </span>
                        <ChevronRight size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <DataState state={state} onReset={() => setState("sample")} />
              )}
            </section>

            <section className="watch-section" aria-labelledby="watch-title">
              <div className="section-head">
                <div>
                  <span className="eyebrow">À SURVEILLER</span>
                  <h2 id="watch-title">Veille disponible</h2>
                </div>
                <ShieldAlert size={18} aria-hidden="true" />
              </div>
              {state === "sample" ? (
                <div className="watch-lines">
                  <button
                    type="button"
                    onClick={() => selectDestination("CVE & KEV")}
                  >
                    <span className="watch-type">CVE & KEV</span>
                    <strong>06 entrées fictives à parcourir</strong>
                    <span>Aucun statut critique simulé</span>
                    <ArrowUpRight size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => selectDestination("BGP Historian")}
                  >
                    <span className="watch-type">BGP</span>
                    <strong>Comparaison de documentation disponible</strong>
                    <span>AS64512 → AS64513 · exemple</span>
                    <ArrowUpRight size={15} />
                  </button>
                </div>
              ) : (
                <DataState state={state} onReset={() => setState("sample")} />
              )}
            </section>
          </div>

          <footer className="page-foot">
            <span>CYBERHUB / DASHBOARD V2.2</span>
            <span>Données fictives · aucune API privée</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
