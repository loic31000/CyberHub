import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bell,
  Binary,
  BookMarked,
  BookOpen,
  ChevronRight,
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
  Database,
  Globe2,
  Settings,
  type LucideIcon,
} from "lucide-react";

type Module = { label: string; icon: LucideIcon; group: string };
type SearchEntry = {
  id: string;
  title: string;
  detail: string;
  category: "Modules" | "Exemples fictifs";
  icon: LucideIcon;
};
type SignalItem = {
  label: string;
  status: string;
  secondary: string;
  action: string;
  tone: "ready" | "quiet" | "attention";
  icon: LucideIcon;
  bars: number[];
};

type FeedItem = {
  title: string;
  detail: string;
  time: string;
  icon: LucideIcon;
  tone?: "cyan" | "amber" | "red";
  badge?: "CRITIQUE" | "NOUVEAU" | "INFO";
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
    label: "Console",
    status: "Opérationnelle",
    secondary: "v2026.05.1 · fictif",
    action: "Dashboard",
    tone: "ready",
    icon: Terminal,
    bars: [18, 24, 34, 46, 62, 74, 58, 82],
  },
  {
    label: "MITRE",
    status: "Index prêt",
    secondary: "ATT&CK v14.1 · fictif",
    action: "MITRE ATT&CK",
    tone: "ready",
    icon: Layers3,
    bars: [12, 22, 28, 43, 57, 70, 51, 78],
  },
  {
    label: "Sources",
    status: "Synchronisation",
    secondary: "2/4 connectées · fictif",
    action: "IOC Manager",
    tone: "attention",
    icon: Globe2,
    bars: [10, 17, 25, 38, 48, 64, 78, 88],
  },
  {
    label: "OSINT",
    status: "Aucun job",
    secondary: "En attente · fictif",
    action: "OSINT Runner",
    tone: "quiet",
    icon: Search,
    bars: [16, 22, 31, 48, 44, 61, 72, 68],
  },
  {
    label: "BGP",
    status: "À surveiller",
    secondary: "12 réseaux · fictif",
    action: "BGP Historian",
    tone: "ready",
    icon: Network,
    bars: [15, 29, 37, 51, 59, 72, 83, 91],
  },
];

const operations: FeedItem[] = [
  {
    title: "Recherche OSINT",
    detail: "github.com",
    time: "13:10",
    icon: Search,
  },
  {
    title: "Analyse de domaine",
    detail: "example.com",
    time: "13:07",
    icon: Globe2,
  },
  {
    title: "Inspection IOC",
    detail: "185.199.110.153",
    time: "12:58",
    icon: Shield,
    tone: "amber",
  },
  {
    title: "Note ajoutée",
    detail: "Investigation · APT",
    time: "12:46",
    icon: FileText,
  },
  {
    title: "Consultation CVE",
    detail: "CVE-2024-3094",
    time: "12:41",
    icon: ShieldAlert,
  },
  {
    title: "Snapshot BGP",
    detail: "AS15169 · Google",
    time: "12:32",
    icon: History,
  },
];

const alerts: FeedItem[] = [
  {
    title: "CVE-2024-3094",
    detail: "Librairie affectée",
    time: "12:58",
    icon: ShieldAlert,
    tone: "red",
    badge: "CRITIQUE",
  },
  {
    title: "AS152194",
    detail: "Annonce BGP inhabituelle",
    time: "11:43",
    icon: Network,
    tone: "amber",
    badge: "NOUVEAU",
  },
  {
    title: "IOC partagé",
    detail: "185.199.110.153",
    time: "12:27",
    icon: Shield,
    badge: "INFO",
  },
  {
    title: "Mise à jour MITRE",
    detail: "Nouvelles entrées TTP",
    time: "09:12",
    icon: Compass,
    badge: "INFO",
  },
  {
    title: "Source OSINT",
    detail: "Synchronisation terminée",
    time: "08:51",
    icon: Database,
    badge: "INFO",
  },
];

const quickModules = [
  {
    title: "IOC Manager",
    detail: "Recherche et analyse d’indicateurs",
    icon: Shield,
  },
  { title: "MITRE ATT&CK", detail: "Matrice et techniques", icon: Layers3 },
  {
    title: "OSINT Runner",
    detail: "Recherche et vérification de sources",
    icon: Search,
  },
  {
    title: "BGP Historian",
    detail: "Historique et analyse BGP",
    icon: Network,
  },
  { title: "Investigations", detail: "Dossiers et preuves", icon: Activity },
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

function MiniBars({ bars }: { bars: number[] }) {
  return (
    <span className="mini-bars" aria-hidden="true">
      {bars.map((height, index) => (
        <i
          key={index}
          style={{ "--bar-height": `${height}%` } as React.CSSProperties}
        />
      ))}
    </span>
  );
}

function HeaderFlux() {
  return (
    <svg
      className="hero-flux"
      viewBox="0 0 760 150"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hero-cyan" x1="0" x2="1">
          <stop offset="0" stopColor="#06dbe8" stopOpacity="0" />
          <stop offset=".35" stopColor="#06dbe8" />
          <stop offset="1" stopColor="#7ff7ff" stopOpacity=".15" />
        </linearGradient>
        <linearGradient id="hero-amber" x1="0" x2="1">
          <stop offset="0" stopColor="#f6a83b" stopOpacity="0" />
          <stop offset=".55" stopColor="#f6a83b" />
          <stop offset="1" stopColor="#f6a83b" stopOpacity="0" />
        </linearGradient>
        <filter id="hero-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g className="hero-grid-lines">
        {Array.from({ length: 13 }, (_, index) => (
          <line key={index} x1={index * 64} x2={index * 64} y1="15" y2="145" />
        ))}
      </g>
      <g className="hero-wave" filter="url(#hero-glow)">
        <path d="M0 92 C95 15 160 138 255 72 S410 25 495 92 S650 138 760 47" />
        <path d="M0 112 C85 42 170 123 245 96 S382 38 485 73 S632 125 760 69" />
        <path
          className="amber"
          d="M0 76 C82 128 180 25 270 89 S420 125 520 55 S675 36 760 88"
        />
      </g>
      <g className="hero-points">
        <circle cx="185" cy="65" r="3" />
        <circle cx="370" cy="54" r="2.5" />
        <circle cx="526" cy="59" r="3" />
        <circle className="amber" cx="625" cy="67" r="3" />
      </g>
    </svg>
  );
}

function NetworkScene() {
  return (
    <div className="network-scene">
      <svg
        viewBox="0 0 800 430"
        role="img"
        aria-labelledby="network-scene-title"
      >
        <title id="network-scene-title">
          Aperçu cartographique synthétique de connexions réseau fictives
        </title>
        <defs>
          <radialGradient id="globe-fill">
            <stop offset="0" stopColor="#063746" stopOpacity=".8" />
            <stop offset=".72" stopColor="#03141d" stopOpacity=".75" />
            <stop offset="1" stopColor="#02080d" stopOpacity=".2" />
          </radialGradient>
          <filter id="node-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern
            id="map-grid"
            width="28"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M28 0H0V28"
              fill="none"
              stroke="#0d5b70"
              strokeOpacity=".22"
            />
          </pattern>
        </defs>
        <rect width="800" height="430" fill="url(#map-grid)" />
        <ellipse
          className="globe-shell"
          cx="400"
          cy="224"
          rx="340"
          ry="178"
          fill="url(#globe-fill)"
        />
        <g className="globe-grid">
          <ellipse cx="400" cy="224" rx="340" ry="178" />
          <ellipse cx="400" cy="224" rx="340" ry="112" />
          <ellipse cx="400" cy="224" rx="340" ry="48" />
          <path d="M400 46 C260 92 260 356 400 402 C540 356 540 92 400 46Z" />
          <path d="M400 46 C330 92 330 356 400 402 C470 356 470 92 400 46Z" />
        </g>
        <g className="continents">
          <path d="M116 150 157 102 220 85 269 111 251 145 215 155 194 191 154 184 127 207 99 185Z" />
          <path d="M239 208 282 231 294 278 274 333 242 373 228 319 201 271 213 232Z" />
          <path d="M365 122 407 103 458 113 477 137 447 153 415 145 396 171 361 158Z" />
          <path d="M397 169 451 174 474 219 455 289 421 335 388 287 374 224Z" />
          <path d="M472 112 541 88 628 106 692 151 664 192 599 183 564 154 520 177 478 151Z" />
          <path d="M608 274 658 260 696 289 672 325 621 317Z" />
        </g>
        <g className="network-routes">
          <path d="M153 169 Q330 5 476 191" />
          <path d="M164 178 Q375 82 637 148" />
          <path className="amber" d="M250 253 Q391 105 552 151" />
          <path d="M438 189 Q560 53 672 291" />
          <path className="red" d="M476 197 Q570 146 626 276" />
          <path className="amber" d="M271 273 Q425 347 649 290" />
          <path d="M188 144 Q344 243 452 205" />
        </g>
        <g className="network-nodes" filter="url(#node-glow)">
          {[
            [153, 169, "cyan"],
            [164, 178, "cyan"],
            [250, 253, "amber"],
            [271, 273, "cyan"],
            [438, 189, "cyan"],
            [476, 197, "cyan"],
            [552, 151, "amber"],
            [637, 148, "cyan"],
            [626, 276, "red"],
            [649, 290, "amber"],
            [452, 205, "cyan"],
            [188, 144, "cyan"],
          ].map(([cx, cy, tone], index) => (
            <circle
              key={index}
              className={String(tone)}
              cx={Number(cx)}
              cy={Number(cy)}
              r={index % 3 === 0 ? 5 : 3.5}
            />
          ))}
        </g>
      </svg>
      <div className="network-legend" aria-label="Légende des données fictives">
        <span>
          <i className="cyan" /> Requêtes outils <strong>148</strong>
        </span>
        <span>
          <i className="blue" /> Analyse IOC <strong>27</strong>
        </span>
        <span>
          <i className="amber" /> Renseignement <strong>14</strong>
        </span>
        <span>
          <i className="red" /> Autres opérations <strong>9</strong>
        </span>
      </div>
      <span className="demo-visual-label">VISUALISATION FICTIVE</span>
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const mobileSearchTrigger = useRef<HTMLButtonElement>(null);
  const searchReturnFocus = useRef<HTMLElement | null>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const menuClose = useRef<HTMLButtonElement>(null);
  const menuReturnFocus = useRef<HTMLElement | null>(null);

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
          <span>Rechercher un outil, une CVE, un IOC, un domaine…</span>
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
          <time className="topbar-time" dateTime="2026-10-12T13:11:00+02:00">
            12 OCT. 2026 <i /> 13:11 CET
          </time>
          <span
            className="local-status"
            title="Statut synthétique du prototype"
          >
            <i aria-hidden="true" /> EN LIGNE · DÉMO
          </span>
          <button
            className="topbar-icon"
            type="button"
            aria-label="Notifications fictives"
            onClick={() =>
              setNotice("Aucune notification réelle dans ce prototype.")
            }
          >
            <Bell size={18} />
          </button>
          <button
            className="topbar-icon"
            type="button"
            aria-label="Réglages du prototype"
            onClick={() => selectDestination("Paramètres")}
          >
            <Settings size={19} />
          </button>
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
        <div className="workspace dashboard-board" id="overview">
          <section className="overview-hero" aria-labelledby="overview-title">
            <HeaderFlux />
            <div className="hero-copy">
              <span className="hero-breadcrumb">/ CORE / DASHBOARD</span>
              <h1 id="overview-title">
                TERMINAL <span>OVERVIEW</span>
              </h1>
              <p>
                Votre espace de travail CyberHub, Recherche, analyse et
                opérations depuis une interface unifiée.
              </p>
            </div>
            <div className="hero-index" aria-hidden="true">
              <span>CYBER INTELLIGENCE</span>
              <span>OPEN SOURCE</span>
              <span>DEFENSIVE OPERATIONS</span>
              <span>THREAT ANALYSIS</span>
            </div>
          </section>

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
            className="dashboard-panel environment-panel"
            aria-labelledby="environment-title"
          >
            <header className="panel-heading environment-heading">
              <div>
                <h2 id="environment-title">ÉTAT DE L’ENVIRONNEMENT</h2>
                <p>Composants principaux et sources de données.</p>
              </div>
              <div className="environment-meta">
                <span>Dernière vérification :</span>
                <time dateTime="2026-10-12T13:11:22+02:00">
                  12/10/2026 · 13:11:22
                </time>
                <button
                  type="button"
                  className="panel-action"
                  onClick={(event) => openMenu(event.currentTarget)}
                >
                  Tout voir <ChevronRight size={14} />
                </button>
              </div>
            </header>
            <div className="environment-grid">
              {signalItems.map((signal) => {
                const Icon = signal.icon;
                return (
                  <button
                    type="button"
                    className={`environment-card signal-${signal.tone}`}
                    key={signal.label}
                    onClick={() => selectDestination(signal.action)}
                  >
                    <span className="environment-icon">
                      <Icon size={25} />
                    </span>
                    <span className="environment-copy">
                      <strong>{signal.label}</strong>
                      <span>
                        <i className="signal-led" aria-hidden="true" />
                        {signal.status}
                      </span>
                      <small>{signal.secondary}</small>
                    </span>
                    <ChevronRight
                      className="environment-arrow"
                      size={16}
                      aria-hidden="true"
                    />
                    <MiniBars bars={signal.bars} />
                  </button>
                );
              })}
            </div>
          </section>

          <div className="dashboard-grid">
            <section
              className="dashboard-panel network-panel"
              aria-labelledby="network-title"
            >
              <header className="panel-heading">
                <div>
                  <h2 id="network-title">ACTIVITÉ RÉSEAU (APERÇU)</h2>
                  <p>
                    Requêtes, analyses et opérations récentes · démonstration.
                  </p>
                </div>
                <label className="range-select">
                  <span className="sr-only">Période de démonstration</span>
                  <select defaultValue="10">
                    <option value="10">10 dernières minutes</option>
                    <option value="30">30 dernières minutes</option>
                  </select>
                </label>
              </header>
              <NetworkScene />
            </section>

            <section
              className="dashboard-panel feed-panel"
              aria-labelledby="operations-title"
            >
              <header className="panel-heading">
                <h2 id="operations-title">DERNIÈRES OPÉRATIONS</h2>
                <button
                  type="button"
                  className="panel-action"
                  onClick={() => selectDestination("Investigations")}
                >
                  Voir tout <ChevronRight size={14} />
                </button>
              </header>
              <ul className="activity-list">
                {operations.map(({ title, detail, time, icon: Icon, tone }) => (
                  <li key={title}>
                    <button
                      type="button"
                      onClick={() => selectDestination(title)}
                    >
                      <span className={`feed-icon ${tone ? `is-${tone}` : ""}`}>
                        <Icon size={17} />
                      </span>
                      <span className="feed-copy">
                        <strong>{title}</strong>
                        <small>{detail}</small>
                      </span>
                      <time>{time}</time>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section
              className="dashboard-panel feed-panel alert-panel"
              aria-labelledby="alerts-title"
            >
              <header className="panel-heading">
                <div>
                  <h2 id="alerts-title">VEILLE & ALERTES</h2>
                  <p>Flux récents et points d’attention.</p>
                </div>
                <button
                  type="button"
                  className="panel-action"
                  onClick={() => selectDestination("Paramètres")}
                >
                  Configurer <ChevronRight size={14} />
                </button>
              </header>
              <ul className="activity-list alert-list">
                {alerts.map(
                  ({ title, detail, time, icon: Icon, tone, badge }) => (
                    <li key={title}>
                      <button
                        type="button"
                        onClick={() => selectDestination(title)}
                      >
                        <span
                          className={`feed-icon ${tone ? `is-${tone}` : ""}`}
                        >
                          <Icon size={17} />
                        </span>
                        <span className="feed-copy">
                          <strong>{title}</strong>
                          <small>{detail}</small>
                        </span>
                        {badge && (
                          <span
                            className={`feed-badge badge-${badge.toLowerCase()}`}
                          >
                            {badge}
                          </span>
                        )}
                        <time>{time}</time>
                      </button>
                    </li>
                  ),
                )}
              </ul>
            </section>
          </div>

          <section
            className="dashboard-panel quick-panel"
            aria-labelledby="quick-title"
          >
            <header className="panel-heading">
              <div>
                <h2 id="quick-title">ACCÈS RAPIDES AUX MODULES</h2>
                <p>Exploration des 18 modules CyberHub.</p>
              </div>
              <button
                type="button"
                className="text-action"
                onClick={(event) => openMenu(event.currentTarget)}
              >
                Ouvrir l’explorateur complet <ChevronRight size={14} />
              </button>
            </header>
            <div className="quick-grid">
              {quickModules.map(({ title, detail, icon: Icon }) => (
                <button
                  type="button"
                  key={title}
                  onClick={() => selectDestination(title)}
                >
                  <span className="quick-icon">
                    <Icon size={22} />
                  </span>
                  <span>
                    <strong>{title}</strong>
                    <small>{detail}</small>
                  </span>
                  <ArrowRight size={15} />
                </button>
              ))}
            </div>
          </section>

          <section className="sync-panel" aria-labelledby="sync-title">
            <span className="sync-icon">
              <Database size={20} />
            </span>
            <div className="sync-copy">
              <div>
                <strong id="sync-title">SYNCHRONISATION DES DONNÉES</strong>
                <span>Sources locales et mises à jour · démonstration</span>
                <b>78%</b>
              </div>
              <span
                className="sync-track"
                aria-label="Progression fictive 78 %"
              >
                <i />
              </span>
            </div>
            <MiniBars
              bars={[
                36, 52, 68, 43, 72, 61, 78, 56, 69, 84, 64, 74, 88, 72, 81, 92,
              ]}
            />
          </section>

          <footer className="page-foot">
            <span>CYBERHUB / TERMINAL OVERVIEW</span>
            <span>
              Données entièrement fictives · aucune surveillance continue ·
              aucune API privée
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
