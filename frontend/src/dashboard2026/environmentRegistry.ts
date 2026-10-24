import {
  BgpGlyph,
  CheatsheetGlyph,
  CloakGlyph,
  ConsoleGlyph,
  CorrelationGlyph,
  CveGlyph,
  EncoderGlyph,
  HistorianGlyph,
  InvestigationGlyph,
  OverviewGlyph,
  IocGlyph,
  LayersGlyph,
  LolbinGlyph,
  MitreGlyph,
  NotesGlyph,
  OsintGlyph,
  PlaybookGlyph,
  RevshellGlyph,
  ToolsGlyph,
  WriteupGlyph,
  type IconComponent,
} from "./CyberGlyphs";

/*
 * Phase 3A.1: registry of the cards that can appear in "État de l'environnement".
 *
 * - The Console card summarises the local data; its live value is supplied
 *   by the authenticated Dashboard.
 * - Module cards give access to the 18 Console modules, one card each. IOC
 *   Manager and BGP Historian also show their live state.
 *
 * Ids are stable and independent from the displayed titles.
 */

/* ---------- shared module registry ---------- */

/*
 * The four sections of the real Console sidebar (frontend/src/components/Sidebar.tsx).
 * The drawer, the global search and both catalogues group modules this way.
 */
export type ModuleCategory = "core" | "intel" | "ops" | "misc";

export const MODULE_CATEGORIES: { id: ModuleCategory; code: string; label: string }[] = [
  { id: "core", code: "CORE", label: "Espace de travail" },
  { id: "intel", code: "INTEL", label: "Renseignement" },
  { id: "ops", code: "OPS", label: "Opérations" },
  { id: "misc", code: "MISC", label: "Ressources & réseau" },
];

export const categoryOf = (id: ModuleCategory) => MODULE_CATEGORIES.find((c) => c.id === id) ?? MODULE_CATEGORIES[0];

export type ModuleDefinition = {
  id: string; // stable, independent from the displayed title
  title: string; // official name, as in the Console sidebar
  category: ModuleCategory;
  description: string;
  route: string; // real route in the Console (frontend/src/App.tsx)
  icon: IconComponent;
  keywords: string[]; // aliases and synonyms for the searches
  card: "access"; // these cards navigate; they do not report a module status
};

/* The Dashboard itself: listed in the drawer, never offered as a card. */
export const DASHBOARD_MODULE: ModuleDefinition = {
  id: "dashboard",
  title: "Dashboard",
  category: "core",
  description: "Vue d’ensemble Terminal Overview",
  route: "/dashboard",
  icon: OverviewGlyph,
  keywords: ["accueil", "home", "vue d’ensemble", "overview", "tableau de bord", "terminal overview"],
  card: "access",
};

// The 18 functional modules of the Console, in sidebar order.
export const MODULES: ModuleDefinition[] = [
  { id: "tools", title: "Outils", category: "core", description: "Fiches techniques et commandes", route: "/tools", icon: ToolsGlyph, keywords: ["tools", "toolkit", "fiches", "commandes", "scripts", "offensif", "défensif"], card: "access" },
  { id: "ctf", title: "Writeups", category: "core", description: "Base de writeups CTF", route: "/ctf", icon: WriteupGlyph, keywords: ["ctf", "write-up", "challenges", "flags", "solutions", "capture the flag"], card: "access" },
  { id: "cve", title: "CVE & KEV", category: "intel", description: "Veille CVE, catalogue KEV et EPSS", route: "/cve", icon: CveGlyph, keywords: ["cve", "kev", "epss", "cisa", "nvd", "vulnérabilités", "vulnerabilities", "veille", "patch", "exploit"], card: "access" },
  { id: "playbooks", title: "Playbooks", category: "intel", description: "Procédures de réponse à incident", route: "/playbooks", icon: PlaybookGlyph, keywords: ["playbook", "réponse à incident", "incident response", "ir", "procédures", "runbook"], card: "access" },
  { id: "mitre", title: "MITRE ATT&CK", category: "intel", description: "Tactiques et techniques ATT&CK", route: "/mitre", icon: MitreGlyph, keywords: ["mitre", "att&ck", "attack", "ttp", "tactiques", "techniques", "matrice"], card: "access" },
  { id: "mitre-layers", title: "Layers ATT&CK", category: "intel", description: "Calques ATT&CK personnalisés", route: "/mitre/layers", icon: LayersGlyph, keywords: ["layers", "calques", "navigator", "att&ck", "couverture", "heatmap"], card: "access" },
  { id: "lolbins", title: "LOLBins", category: "intel", description: "Binaires détournables Windows et Linux", route: "/lolbins", icon: LolbinGlyph, keywords: ["lolbins", "lolbas", "gtfobins", "gtfo", "binaires", "living off the land"], card: "access" },
  { id: "cloak", title: "CLOAK OpSec", category: "ops", description: "Référentiel OpSec et discrétion", route: "/cloak", icon: CloakGlyph, keywords: ["cloak", "opsec", "discrétion", "anonymat", "empreinte", "stealth"], card: "access" },
  { id: "ioc", title: "IOC Manager", category: "ops", description: "Gestion et recherche d’indicateurs", route: "/ioc", icon: IocGlyph, keywords: ["ioc", "indicateurs", "indicators", "compromission", "ip", "domaine", "hash", "sha256", "url"], card: "access" },
  { id: "correlation", title: "Corrélation", category: "ops", description: "Corrélation d’IOC entre sources", route: "/correlation", icon: CorrelationGlyph, keywords: ["correlation", "recoupement", "liens", "graphe", "pivot"], card: "access" },
  { id: "osint", title: "OSINT Runner", category: "ops", description: "Recherche en sources ouvertes", route: "/osint", icon: OsintGlyph, keywords: ["osint", "sources ouvertes", "reconnaissance", "recon", "whois", "dns", "recherche"], card: "access" },
  { id: "investigations", title: "Investigations", category: "ops", description: "Dossiers, chronologie et preuves", route: "/investigations", icon: InvestigationGlyph, keywords: ["investigation", "enquête", "dossier", "case", "preuves", "chronologie", "timeline"], card: "access" },
  { id: "notes", title: "Notes", category: "misc", description: "Notes opérationnelles locales", route: "/notes", icon: NotesGlyph, keywords: ["notes", "mémo", "journal", "carnet", "notes opérationnelles"], card: "access" },
  { id: "cheatsheets", title: "Cheatsheets", category: "misc", description: "Commandes clés par outil", route: "/cheatsheets", icon: CheatsheetGlyph, keywords: ["cheatsheet", "aide-mémoire", "mémento", "commandes", "référence"], card: "access" },
  { id: "encoder", title: "Encoder/Decoder", category: "misc", description: "Base64, URL, hexadécimal, ROT", route: "/encoder", icon: EncoderGlyph, keywords: ["encodeur", "décodeur", "base64", "hex", "rot13", "url encode", "encodage", "décodage", "cyberchef"], card: "access" },
  { id: "revshell", title: "RevShell Gen", category: "misc", description: "Générateur de reverse shells", route: "/revshell", icon: RevshellGlyph, keywords: ["reverse shell", "revshell", "shell inversé", "payload", "netcat", "nc"], card: "access" },
  { id: "bgp", title: "BGP Lookup", category: "misc", description: "ASN, préfixes et adresses IP", route: "/bgp", icon: BgpGlyph, keywords: ["bgp", "asn", "as", "préfixe", "prefix", "routage", "ip", "lookup"], card: "access" },
  { id: "bgp-historian", title: "BGP Historian", category: "misc", description: "Historique et alertes BGP", route: "/bgp/historian", icon: HistorianGlyph, keywords: ["historique bgp", "hijack", "détournement", "alertes bgp", "snapshots", "route leak"], card: "access" },
];

export const NAVIGATION_MODULES = [DASHBOARD_MODULE, ...MODULES];

/* ---------- environment cards (Phase 3A.1) ---------- */

/*
 * One card per module or function. A card opens a real Console route; the
 * cards whose data the Dashboard loads (Console, IOC Manager, BGP Historian)
 * also show that state. Defaults make no status claim.
 */

/* The state a card shows: replaced by the Dashboard's live values. */
export type CardSignal = {
  status: string;
  secondary: string;
  tone: "ready" | "quiet" | "attention";
  bars: number[];
};

type BaseCard = {
  id: string;
  title: string;
  icon: IconComponent;
  category: ModuleCategory;
  keywords: string[];
  route: string; // real route in the Console (frontend/src/App.tsx)
};

/* The Console summary: not a module of its own, it covers several. */
export type SystemCard = BaseCard & CardSignal & { kind: "system"; description: string };

export type ModuleCard = BaseCard & {
  kind: "module";
  moduleId: string;
  description: string;
  signal?: CardSignal; // only for modules whose state the Dashboard loads
};

export type EnvironmentCardDefinition = SystemCard | ModuleCard;

/* Shows a state: the Console summary, or a module card with a signal. */
export const signalOf = (card: EnvironmentCardDefinition): CardSignal | undefined =>
  card.kind === "system" ? card : card.signal;

export const CONSOLE_CARD: SystemCard = {
  id: "system.console",
  kind: "system",
  category: "core",
  keywords: ["console", "système", "version", "état", "outils", "writeups"],
  title: "Console",
  description: "Outils et writeups enregistrés",
  status: "Chargement…",
  secondary: "Données locales",
  tone: "quiet",
  icon: ConsoleGlyph,
  bars: [18, 24, 34, 46, 62, 74, 58, 82],
  // Its count starts with the tools; the Dashboard itself would reopen this page.
  route: "/tools",
};

/* Modules whose state the Dashboard loads; their card carries it. */
const MODULE_SIGNALS: Record<string, CardSignal> = {
  ioc: { status: "Chargement…", secondary: "Indicateurs locaux", tone: "quiet", bars: [10, 17, 25, 38, 48, 64, 78, 88] },
  "bgp-historian": { status: "Chargement…", secondary: "Alertes et snapshots", tone: "quiet", bars: [15, 29, 37, 51, 59, 72, 83, 91] },
};

// One card per module, derived from the shared registry.
export const MODULE_CARDS: ModuleCard[] = MODULES.map((module) => ({
  id: `module.${module.id}`,
  kind: "module",
  moduleId: module.id,
  title: module.title,
  description: module.description,
  route: module.route,
  category: module.category,
  keywords: module.keywords,
  icon: module.icon,
  ...(MODULE_SIGNALS[module.id] && { signal: MODULE_SIGNALS[module.id] }),
}));

export const ENVIRONMENT_CARDS: EnvironmentCardDefinition[] = [CONSOLE_CARD, ...MODULE_CARDS];

const byId = new Map(ENVIRONMENT_CARDS.map((card) => [card.id, card]));

export function getEnvironmentCard(id: string) {
  return byId.get(id);
}

/*
 * Cards of earlier versions that duplicated a module card, mapped to that
 * card: "MITRE" and "OSINT" only repeated the module access, "Sources" showed
 * the IOC count of IOC Manager and "BGP" the alerts of BGP Historian.
 */
export const LEGACY_CARD_IDS: Record<string, string> = {
  "system.mitre": "module.mitre",
  "system.osint": "module.osint",
  "system.sources": "module.ioc",
  "system.bgp": "module.bgp-historian",
};

/*
 * Stored or chosen cards, cleaned: legacy ids mapped to their module card in
 * place, unknown ids dropped, and one card per module (the first one kept).
 */
export function normalizeEnvCards(ids: readonly unknown[]): string[] {
  const cards = ids
    .filter((id): id is string => typeof id === "string")
    .map((id) => LEGACY_CARD_IDS[id] ?? id)
    .filter((id) => byId.has(id));
  return [...new Set(cards)];
}

// The five cards of the original layout, each now on its canonical card.
export const DEFAULT_ENVIRONMENT_CARDS = normalizeEnvCards([
  "system.console", "system.mitre", "system.sources", "system.osint", "system.bgp",
]);
