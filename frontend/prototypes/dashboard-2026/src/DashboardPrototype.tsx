import { useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Binary,
  BookOpen,
  BookMarked,
  ChevronRight,
  Clock3,
  Code2,
  FileText,
  GitBranch,
  History,
  Layers3,
  LayoutDashboard,
  Menu,
  Network,
  Search,
  Shield,
  ShieldAlert,
  StickyNote,
  Terminal,
  Wrench,
  X,
  EyeOff,
  Compass,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ViewState = "sample" | "loading" | "empty" | "error";
type Module = { label: string; icon: LucideIcon };

const groups: { label: string; items: Module[] }[] = [
  {
    label: "ESPACE DE TRAVAIL",
    items: [
      { label: "Dashboard", icon: LayoutDashboard },
      { label: "Outils", icon: Wrench },
      { label: "Writeups", icon: FileText },
    ],
  },
  {
    label: "RENSEIGNEMENT",
    items: [
      { label: "CVE & KEV", icon: ShieldAlert },
      { label: "Playbooks", icon: BookOpen },
      { label: "MITRE ATT&CK", icon: Compass },
      { label: "Layers ATT&CK", icon: Layers3 },
      { label: "LOLBins", icon: Terminal },
    ],
  },
  {
    label: "OPÉRATIONS",
    items: [
      { label: "CLOAK OpSec", icon: EyeOff },
      { label: "IOC Manager", icon: Shield },
      { label: "Corrélation", icon: GitBranch },
      { label: "OSINT Runner", icon: Search },
      { label: "Investigations", icon: Activity },
    ],
  },
  {
    label: "RESSOURCES & RÉSEAU",
    items: [
      { label: "Notes", icon: StickyNote },
      { label: "Cheatsheets", icon: BookMarked },
      { label: "Encoder/Decoder", icon: Binary },
      { label: "RevShell Gen", icon: Code2 },
      { label: "BGP Lookup", icon: Network },
      { label: "BGP Historian", icon: History },
    ],
  },
];

const metrics: (Module & { value: string; detail: string })[] = [
  {
    label: "Outils",
    icon: Wrench,
    value: "124",
    detail: "fiches de l’exemple",
  },
  {
    label: "Writeups",
    icon: FileText,
    value: "18",
    detail: "analyses fictives",
  },
  {
    label: "CVE & KEV",
    icon: ShieldAlert,
    value: "06",
    detail: "entrées simulées",
  },
  {
    label: "Playbooks",
    icon: BookOpen,
    value: "09",
    detail: "procédures fictives",
  },
];

const activities = [
  {
    time: "09:14",
    kind: "INDICATEUR",
    title: "198.51.100.42",
    detail: "Valeur de documentation · provenance conservée",
    icon: Shield,
  },
  {
    time: "08:42",
    kind: "RECHERCHE",
    title: "Triage d’un cas fictif",
    detail: "Trois notes liées à une investigation d’exemple",
    icon: Search,
  },
  {
    time: "HIER",
    kind: "MÉTHODE",
    title: "Playbook · première qualification",
    detail: "Étapes de vérification prêtes à consulter",
    icon: BookOpen,
  },
];

const domains = [
  {
    number: "01",
    name: "Connaissance",
    detail: "Outils, Writeups et références pratiques",
  },
  { number: "02", name: "Renseignement", detail: "CVE, KEV, MITRE et LOLBins" },
  {
    number: "03",
    name: "Investigation",
    detail: "IOC, corrélation, OSINT et dossiers",
  },
  {
    number: "04",
    name: "Réseau",
    detail: "BGP Lookup et historique de routage",
  },
];

function Brand() {
  return (
    <span className="brand">
      <img src="/mark.svg" alt="" width="35" height="35" />
      <span>
        CYBER<span>HUB</span>
      </span>
    </span>
  );
}

function SectionHeading({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
}) {
  return (
    <div className="section-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {detail && <p>{detail}</p>}
    </div>
  );
}

function StateContent({
  state,
  subject,
  onReset,
}: {
  state: ViewState;
  subject: string;
  onReset: () => void;
}) {
  if (state === "loading") {
    return (
      <div className="data-state" role="status">
        <span className="state-loader" aria-hidden="true" />
        <strong>Chargement simulé</strong>
        <p>Emplacement prévu pour {subject}. Aucun appel réseau n’est lancé.</p>
      </div>
    );
  }
  if (state === "empty") {
    return (
      <div className="data-state">
        <span className="state-glyph" aria-hidden="true">
          ∅
        </span>
        <strong>Aucune donnée à afficher</strong>
        <p>
          La vue reste utile même si {subject} ne contient encore aucun élément.
        </p>
      </div>
    );
  }
  return (
    <div className="data-state" role="alert">
      <span className="state-glyph" aria-hidden="true">
        !
      </span>
      <strong>Affichage indisponible</strong>
      <p>État d’erreur fictif. Aucune synchronisation réelle n’a été tentée.</p>
      <button className="text-action" onClick={onReset}>
        Revenir à l’aperçu <ArrowRight size={14} />
      </button>
    </div>
  );
}

export default function DashboardPrototype() {
  const [state, setState] = useState<ViewState>("sample");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function selectModule(label: string) {
    setMenuOpen(false);
    setNotice(
      `${label} : aperçu de navigation uniquement. Cette page n’est pas encore prototypée.`,
    );
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>
      <header className="topbar">
        <button
          className="icon-button mobile-menu"
          type="button"
          aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={menuOpen}
          aria-controls="prototype-nav"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <Brand />
        <div className="topbar-path">
          <span>LAB / CONSOLE 2026</span>
          <ChevronRight size={14} />
          <strong>DASHBOARD</strong>
        </div>
        <span className="topbar-badge">
          <span aria-hidden="true" /> PROTOTYPE LOCAL
        </span>
      </header>

      {menuOpen && (
        <button
          className="menu-scrim"
          type="button"
          aria-label="Fermer le menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}
        id="prototype-nav"
        aria-label="Modules CyberHub"
      >
        <div className="sidebar-intro">
          <span className="eyebrow">CYBERHUB / 2026</span>
          <strong>
            Un environnement.
            <br />
            Plusieurs disciplines.
          </strong>
        </div>
        <nav aria-label="Navigation des modules">
          {groups.map((group) => (
            <div className="nav-group" key={group.label}>
              <h2>{group.label}</h2>
              {group.items.map(({ label, icon: Icon }) =>
                label === "Dashboard" ? (
                  <a
                    href="#vue-ensemble"
                    className="nav-item nav-active"
                    aria-current="page"
                    key={label}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                    <span className="nav-active-mark" />
                  </a>
                ) : (
                  <button
                    className="nav-item"
                    type="button"
                    key={label}
                    onClick={() => selectModule(label)}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                  </button>
                ),
              )}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="eyebrow">LABORATOIRE VISUEL</span>
          <p>Aucune donnée privée ni session de la Console n’est utilisée.</p>
        </div>
      </aside>

      <main id="contenu" className="main-content">
        <div className="content-width">
          <div className="dashboard-topline">
            <span className="eyebrow">01 / POSTE DE TRAVAIL</span>
            <span className="page-index">
              DASHBOARD V1 <span>·</span> DONNÉES FICTIVES
            </span>
          </div>
          <section
            className="intro"
            id="vue-ensemble"
            aria-labelledby="dashboard-title"
          >
            <div>
              <h1 id="dashboard-title">
                Tout voir.
                <br />
                <em>Mieux relier.</em>
              </h1>
              <p>
                Un espace pour retrouver vos références, suivre un travail en
                cours et rejoindre les modules CyberHub sans perdre le contexte.
              </p>
            </div>
            <div className="intro-aside">
              <span className="intro-rule" />
              <strong>Votre point de départ</strong>
              <p>
                La vue réunit connaissance, renseignement, investigation et
                réseau. Les chiffres ci-dessous sont des exemples de
                présentation.
              </p>
            </div>
          </section>

          <div className="scenario-bar">
            <div>
              <span className="scenario-dot" aria-hidden="true" />
              <strong>Aperçu fictif</strong>
              <span>
                Les données affichées ne proviennent pas de la Console.
              </span>
            </div>
            <label>
              État de démonstration
              <select
                value={state}
                onChange={(event) => setState(event.target.value as ViewState)}
              >
                <option value="sample">Avec exemples</option>
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
            className="metrics-section"
            aria-label="Indicateurs de démonstration"
          >
            <div className="metrics-heading">
              <span className="eyebrow">REPÈRES</span>
              <span>Quatre portes d’entrée</span>
            </div>
            <div className="metric-grid">
              {metrics.map(({ label, icon: Icon, value, detail }) => (
                <button
                  className="metric"
                  type="button"
                  key={label}
                  onClick={() => selectModule(label)}
                >
                  <span className="metric-top">
                    <Icon size={17} strokeWidth={1.8} />
                    <span>{label}</span>
                    <ArrowUpRight size={15} />
                  </span>
                  <span className="metric-number">
                    {state === "sample" ? value : "—"}
                  </span>
                  <span className="metric-detail">
                    {state === "sample" ? detail : "aucune mesure réelle"}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <div className="work-grid">
            <section
              className="activity-panel"
              aria-labelledby="activity-title"
            >
              <SectionHeading
                eyebrow="02 / CONTINUITÉ"
                title="Reprendre le fil"
                detail="Des points de reprise clairs, avec une provenance visible."
              />
              <div className="panel-toolbar">
                <span>ACTIVITÉ RÉCENTE · EXEMPLE</span>
                <Clock3 size={16} aria-hidden="true" />
              </div>
              {state === "sample" ? (
                <ol className="activity-list">
                  {activities.map(
                    ({ time, kind, title, detail, icon: Icon }) => (
                      <li key={title}>
                        <span className="activity-time">{time}</span>
                        <span className="activity-icon">
                          <Icon size={17} />
                        </span>
                        <div>
                          <span className="eyebrow">{kind}</span>
                          <strong>{title}</strong>
                          <p>{detail}</p>
                        </div>
                        <ChevronRight className="activity-chevron" size={17} />
                      </li>
                    ),
                  )}
                </ol>
              ) : (
                <StateContent
                  state={state}
                  subject="l’activité récente"
                  onReset={() => setState("sample")}
                />
              )}
              <div className="panel-foot">
                <span>Exemples locaux · aucune action enregistrée</span>
                <button
                  className="text-action"
                  type="button"
                  onClick={() => selectModule("Investigations")}
                >
                  Ouvrir Investigations <ArrowRight size={15} />
                </button>
              </div>
            </section>

            <aside className="watch-panel" aria-labelledby="watch-title">
              <div className="watch-top">
                <span className="eyebrow">03 / VEILLE RÉSEAU</span>
                <Network size={19} aria-hidden="true" />
              </div>
              <h2 id="watch-title">
                Observer
                <br />
                <em>sans conclure.</em>
              </h2>
              <p>
                Un espace pour comparer des instantanés BGP et garder les
                alertes à qualifier.
              </p>
              {state === "sample" ? (
                <div className="route-preview">
                  <div className="route-label">
                    <span>EXEMPLE DE ROUTAGE</span>
                    <span className="demo-pill">SIMULATION</span>
                  </div>
                  <strong>
                    AS64512 <span aria-hidden="true">→</span> AS64513
                  </strong>
                  <div className="route-track" aria-hidden="true">
                    <i />
                    <span />
                    <i />
                  </div>
                  <div className="route-meta">
                    <span>Préfixe de documentation</span>
                    <span>t0 / t1</span>
                  </div>
                </div>
              ) : (
                <StateContent
                  state={state}
                  subject="la veille BGP"
                  onReset={() => setState("sample")}
                />
              )}
              <div className="watch-foot">
                <span className="watch-indicator" aria-hidden="true" />
                <span>Aucune alerte réelle interrogée</span>
              </div>
              <button
                className="watch-link"
                type="button"
                onClick={() => selectModule("BGP Historian")}
              >
                Explorer BGP Historian <ArrowUpRight size={16} />
              </button>
            </aside>
          </div>

          <section className="quick-section" aria-labelledby="quick-title">
            <SectionHeading
              eyebrow="04 / RACCOURCIS"
              title="Aller à l’essentiel"
            />
            <div className="quick-row">
              {[
                {
                  label: "IOC Manager",
                  detail: "Qualifier une valeur",
                  icon: Shield,
                },
                {
                  label: "MITRE ATT&CK",
                  detail: "Consulter les techniques",
                  icon: Compass,
                },
                {
                  label: "Playbooks",
                  detail: "Suivre une méthode",
                  icon: BookOpen,
                },
              ].map(({ label, detail, icon: Icon }) => (
                <button
                  type="button"
                  className="quick-link"
                  key={label}
                  onClick={() => selectModule(label)}
                >
                  <Icon size={20} />
                  <span>
                    <strong>{label}</strong>
                    <small>{detail}</small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </div>
          </section>

          <section className="domains-section" aria-labelledby="domains-title">
            <div className="domains-intro">
              <span className="eyebrow">05 / ÉCOSYSTÈME</span>
              <h2 id="domains-title">
                Des disciplines distinctes.
                <br />
                <em>Un même contexte.</em>
              </h2>
            </div>
            <ol className="domain-list">
              {domains.map((domain) => (
                <li key={domain.number}>
                  <span>{domain.number}</span>
                  <strong>{domain.name}</strong>
                  <p>{domain.detail}</p>
                </li>
              ))}
            </ol>
          </section>
          <footer className="page-foot">
            <span>CYBERHUB / CONSOLE 2026 · PROTOTYPE DASHBOARD V1</span>
            <span>Données fictives · aucune API privée</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
