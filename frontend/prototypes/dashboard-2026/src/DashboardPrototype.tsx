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
type SignalId = "console" | "mitre" | "sources" | "osint" | "bgp";
type Module = { label: string; icon: LucideIcon; group: string };
type SearchEntry = {
  id: string;
  title: string;
  detail: string;
  category: "Modules" | "Exemples fictifs";
  icon: LucideIcon;
};
type SignalItem = {
  id: SignalId;
  code: string;
  label: string;
  status: string;
  timestamp: string;
  description: string;
  evidence: string;
  action: string;
  tone: "ready" | "quiet" | "attention";
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

const signalItems: SignalItem[] = [
  {
    id: "console",
    code: "SYS-01",
    label: "Console",
    status: "Disponible · exemple",
    timestamp: "Relevé fictif 09:42",
    description: "L’accès local est présenté comme prêt dans cet instantané.",
    evidence: "Un point d’état d’authentification existe dans la Console.",
    action: "Dashboard",
    tone: "ready",
    icon: Terminal,
  },
  {
    id: "mitre",
    code: "IDX-02",
    label: "Index MITRE",
    status: "Prêt · exemple",
    timestamp: "Relevé fictif 09:41",
    description: "L’index de démonstration est disponible pour l’exploration.",
    evidence:
      "La Console distingue index prêt, indexation et nombre de techniques.",
    action: "MITRE ATT&CK",
    tone: "ready",
    icon: Compass,
  },
  {
    id: "sources",
    code: "SRC-03",
    label: "Sources",
    status: "Synchronisées · exemple",
    timestamp: "Dernière synchro fictive 09:35",
    description: "Feodo et URLhaus sont présentées avec un relevé synthétique.",
    evidence:
      "La Console conserve la date et le volume de chaque synchronisation.",
    action: "IOC Manager",
    tone: "ready",
    icon: Shield,
  },
  {
    id: "osint",
    code: "JOB-04",
    label: "Jobs OSINT",
    status: "Au repos · exemple",
    timestamp: "Aucun job lancé",
    description: "Aucune recherche OSINT n’est exécutée dans ce laboratoire.",
    evidence: "Les jobs réels exposent un statut et un suivi SSE dédié.",
    action: "OSINT Runner",
    tone: "quiet",
    icon: Search,
  },
  {
    id: "bgp",
    code: "NET-05",
    label: "Alertes BGP",
    status: "2 à examiner · exemple",
    timestamp: "Relevé fictif 09:40",
    description:
      "Deux alertes synthétiques attendent une revue dans cet exemple.",
    evidence: "La Console permet de consulter et d’acquitter les alertes BGP.",
    action: "BGP Historian",
    tone: "attention",
    icon: History,
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
      title: "Aucun instantané disponible",
      copy: "La navigation et la recherche restent accessibles.",
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
  const [activeSignal, setActiveSignal] = useState<SignalId>("console");
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [focusDetailsOpen, setFocusDetailsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const mobileSearchTrigger = useRef<HTMLButtonElement>(null);
  const searchReturnFocus = useRef<HTMLElement | null>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const menuClose = useRef<HTMLButtonElement>(null);
  const menuReturnFocus = useRef<HTMLElement | null>(null);
  const selectedSignal = signalItems.find(
    (signal) => signal.id === activeSignal,
  )!;
  const SelectedSignalIcon = selectedSignal.icon;

  function selectDestination(label: string) {
    setMenuOpen(false);
    setNotice(
      label +
        " : destination disponible dans la Console, page non prototypée dans ce laboratoire.",
    );
  }

  function closeMenu(restoreFocus = true) {
    setMenuOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => menuReturnFocus.current?.focus());
    }
  }

  function openMenu(returnTarget?: HTMLElement | null) {
    menuReturnFocus.current = returnTarget ?? menuTrigger.current;
    setMenuOpen(true);
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
    if (menuOpen) requestAnimationFrame(() => menuClose.current?.focus());
  }, [menuOpen]);

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
          onClick={(event) => openMenu(event.currentTarget)}
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
          onClick={(event) => openMenu(event.currentTarget)}
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
                ref={menuClose}
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
          <div className="page-heading terminal-heading">
            <div>
              <span className="eyebrow">LOCAL CONSOLE / DASHBOARD</span>
              <h1>Terminal Overview</h1>
              <p>
                État synthétique et reprise rapide de votre espace de travail.
              </p>
            </div>
            <div className="page-heading-actions">
              <button
                type="button"
                className="module-access"
                onClick={(event) => openMenu(event.currentTarget)}
              >
                <PanelLeftOpen size={15} /> 18 modules
              </button>
              <label className="lab-state">
                <span>État du laboratoire</span>
                <select
                  value={state}
                  onChange={(event) =>
                    setState(event.target.value as ViewState)
                  }
                >
                  <option value="sample">Exemples</option>
                  <option value="loading">Chargement</option>
                  <option value="empty">Vide</option>
                  <option value="error">Erreur</option>
                </select>
              </label>
            </div>
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

          {state === "sample" ? (
            <>
              <section
                className="terminal-overview"
                aria-labelledby="environment-title"
              >
                <div className="instrument-head">
                  <div>
                    <span className="instrument-path">CH://ENVIRONMENT</span>
                    <h2 id="environment-title">État de l’environnement</h2>
                  </div>
                  <div className="snapshot-meta">
                    <span className="snapshot-led" aria-hidden="true" />
                    <span>SYNTHÉTIQUE</span>
                    <time dateTime="2026-10-12T09:42:00+02:00">
                      12 OCT. 2026 · 09:42
                    </time>
                  </div>
                </div>

                <div
                  className="instrument-rack"
                  role="group"
                  aria-label="Indicateurs synthétiques de l’environnement"
                >
                  {signalItems.map((signal) => {
                    const Icon = signal.icon;
                    const selected = signal.id === activeSignal;
                    return (
                      <button
                        type="button"
                        className={
                          "instrument signal-" +
                          signal.tone +
                          (selected ? " is-selected" : "")
                        }
                        aria-pressed={selected}
                        aria-controls="instrument-readout"
                        key={signal.id}
                        onClick={() => setActiveSignal(signal.id)}
                      >
                        <span className="instrument-code">{signal.code}</span>
                        <span className="instrument-line">
                          <span className="signal-led" aria-hidden="true" />
                          <Icon size={15} aria-hidden="true" />
                          <strong>{signal.label}</strong>
                        </span>
                        <span className="instrument-status">
                          {signal.status}
                        </span>
                        <small>{signal.timestamp}</small>
                      </button>
                    );
                  })}
                </div>

                <div className="overview-lower">
                  <article
                    className="instrument-readout"
                    id="instrument-readout"
                    key={selectedSignal.id}
                    aria-live="polite"
                  >
                    <span className="readout-icon">
                      <SelectedSignalIcon size={17} aria-hidden="true" />
                    </span>
                    <div>
                      <span className="instrument-path">
                        SÉLECTION / {selectedSignal.code}
                      </span>
                      <strong>{selectedSignal.label}</strong>
                      <p>{selectedSignal.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => selectDestination(selectedSignal.action)}
                    >
                      {selectedSignal.action} <ArrowUpRight size={14} />
                    </button>
                  </article>

                  <article className="work-focus">
                    <div className="focus-mark" aria-hidden="true">
                      <Activity size={18} />
                    </div>
                    <div className="focus-copy">
                      <span className="instrument-path">
                        REPRENDRE / DERNIER ÉLÉMENT
                      </span>
                      <h2>Triage initial</h2>
                      <p>Investigation d’exemple · trois notes disponibles</p>
                      {focusDetailsOpen && (
                        <div className="focus-detail" id="focus-detail">
                          <span>DERNIÈRE ÉTAPE</span>
                          <strong>Collecter et qualifier la source</strong>
                          <button
                            type="button"
                            onClick={() => selectDestination("Investigations")}
                          >
                            Ouvrir Investigations <ArrowRight size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="focus-toggle"
                      aria-expanded={focusDetailsOpen}
                      aria-controls="focus-detail"
                      onClick={() => setFocusDetailsOpen((open) => !open)}
                    >
                      {focusDetailsOpen ? "Masquer" : "Voir le détail"}
                      <ChevronRight size={15} aria-hidden="true" />
                    </button>
                  </article>
                </div>

                <p className="signal-disclaimer">
                  Instantané de démonstration · aucun appel API · aucune
                  surveillance continue
                </p>
              </section>

              <div className="secondary-grid">
                <section
                  className="resume-section"
                  aria-labelledby="resume-title"
                >
                  <div className="section-head">
                    <div>
                      <span className="eyebrow">REPRENDRE MON TRAVAIL</span>
                      <h2 id="resume-title">Votre fil récent</h2>
                    </div>
                    <Clock3 size={18} aria-hidden="true" />
                  </div>
                  <ul className="resume-list">
                    {recentItems.map(
                      ({ eyebrow, title, detail, icon: Icon }) => (
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
                      ),
                    )}
                  </ul>
                </section>

                <section
                  className="watch-section"
                  aria-labelledby="watch-title"
                >
                  <div className="section-head">
                    <div>
                      <span className="eyebrow">À SURVEILLER</span>
                      <h2 id="watch-title">Deux points à revoir</h2>
                    </div>
                    <ShieldAlert size={18} aria-hidden="true" />
                  </div>
                  <div className="watch-lines">
                    <button
                      type="button"
                      onClick={() => selectDestination("IOC Manager")}
                    >
                      <span className="watch-type">SOURCES · EXEMPLE</span>
                      <strong>Feodo et URLhaus synchronisées</strong>
                      <span>Dernier relevé fictif à 09:35</span>
                      <ArrowUpRight size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => selectDestination("BGP Historian")}
                    >
                      <span className="watch-type">BGP · EXEMPLE</span>
                      <strong>2 alertes synthétiques à examiner</strong>
                      <span>Instantané fictif, sans suivi continu</span>
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                </section>
              </div>
            </>
          ) : (
            <section className="lab-surface" aria-label="État simulé">
              <DataState state={state} onReset={() => setState("sample")} />
            </section>
          )}
          <footer className="page-foot">
            <span>CYBERHUB / SIGNAL DESK V3</span>
            <span>Données fictives · aucune API privée</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
