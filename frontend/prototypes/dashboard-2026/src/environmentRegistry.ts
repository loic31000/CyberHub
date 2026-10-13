import {
  Activity,
  Binary,
  BookMarked,
  BookOpen,
  Code2,
  Compass,
  EyeOff,
  FileText,
  GitBranch,
  Globe2,
  History,
  Layers3,
  Network,
  Search,
  Shield,
  ShieldAlert,
  StickyNote,
  Terminal,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/*
 * Phase 3A.1: registry of the cards that can appear in "État de l'environnement".
 *
 * - System cards are the five demonstration status cards of Phase 2N. Their
 *   values are fictitious and labelled as such.
 * - Module cards are access cards for the 18 real Console modules. The
 *   prototype has no data source, so they show no value at all: name,
 *   description and the Console route only.
 *
 * Ids are stable and independent from the displayed titles.
 */

type BaseCard = {
  id: string;
  title: string;
  icon: LucideIcon;
};

export type SystemCard = BaseCard & {
  kind: "system";
  status: string;
  secondary: string;
  action: string;
  tone: "ready" | "quiet" | "attention";
  bars: number[];
};

export type ModuleCard = BaseCard & {
  kind: "module";
  description: string;
  route: string; // route of the module in the real Console (frontend/src/App.tsx)
  group: "Espace de travail" | "Renseignement" | "Opérations" | "Ressources & réseau";
};

export type EnvironmentCardDefinition = SystemCard | ModuleCard;

export const SYSTEM_CARDS: SystemCard[] = [
  {
    id: "system.console",
    kind: "system",
    title: "Console",
    status: "Opérationnelle",
    secondary: "v2026.05.1",
    action: "Dashboard",
    tone: "ready",
    icon: Terminal,
    bars: [18, 24, 34, 46, 62, 74, 58, 82],
  },
  {
    id: "system.mitre",
    kind: "system",
    title: "MITRE",
    status: "Index prêt",
    secondary: "ATT&CK v14.1",
    action: "MITRE ATT&CK",
    tone: "ready",
    icon: Layers3,
    bars: [12, 22, 28, 43, 57, 70, 51, 78],
  },
  {
    id: "system.sources",
    kind: "system",
    title: "Sources",
    status: "Synchronisation",
    secondary: "2/4 connectées",
    action: "IOC Manager",
    tone: "attention",
    icon: Globe2,
    bars: [10, 17, 25, 38, 48, 64, 78, 88],
  },
  {
    id: "system.osint",
    kind: "system",
    title: "OSINT",
    status: "Aucun job",
    secondary: "En attente",
    action: "OSINT Runner",
    tone: "quiet",
    icon: Search,
    bars: [16, 22, 31, 48, 44, 61, 72, 68],
  },
  {
    id: "system.bgp",
    kind: "system",
    title: "BGP",
    status: "À surveiller",
    secondary: "12 réseaux suivis",
    action: "BGP Historian",
    tone: "ready",
    icon: Network,
    bars: [15, 29, 37, 51, 59, 72, 83, 91],
  },
];

// Titles match the module names of the navigation drawer exactly.
export const MODULE_CARDS: ModuleCard[] = [
  { id: "module.tools", kind: "module", title: "Outils", description: "Fiches techniques et commandes", route: "/tools", group: "Espace de travail", icon: Wrench },
  { id: "module.ctf", kind: "module", title: "Writeups", description: "Base de writeups CTF", route: "/ctf", group: "Espace de travail", icon: FileText },
  { id: "module.cve", kind: "module", title: "CVE & KEV", description: "Veille CVE, catalogue KEV et EPSS", route: "/cve", group: "Renseignement", icon: ShieldAlert },
  { id: "module.playbooks", kind: "module", title: "Playbooks", description: "Procédures de réponse à incident", route: "/playbooks", group: "Renseignement", icon: BookOpen },
  { id: "module.mitre", kind: "module", title: "MITRE ATT&CK", description: "Tactiques et techniques ATT&CK", route: "/mitre", group: "Renseignement", icon: Compass },
  { id: "module.mitre-layers", kind: "module", title: "Layers ATT&CK", description: "Calques ATT&CK personnalisés", route: "/mitre/layers", group: "Renseignement", icon: Layers3 },
  { id: "module.lolbins", kind: "module", title: "LOLBins", description: "Binaires détournables Windows et Linux", route: "/lolbins", group: "Renseignement", icon: Terminal },
  { id: "module.cloak", kind: "module", title: "CLOAK OpSec", description: "Référentiel OpSec et discrétion", route: "/cloak", group: "Opérations", icon: EyeOff },
  { id: "module.ioc", kind: "module", title: "IOC Manager", description: "Gestion et recherche d'indicateurs", route: "/ioc", group: "Opérations", icon: Shield },
  { id: "module.correlation", kind: "module", title: "Corrélation", description: "Corrélation d'IOC entre sources", route: "/correlation", group: "Opérations", icon: GitBranch },
  { id: "module.osint", kind: "module", title: "OSINT Runner", description: "Recherche en sources ouvertes", route: "/osint", group: "Opérations", icon: Search },
  { id: "module.investigations", kind: "module", title: "Investigations", description: "Dossiers, chronologie et preuves", route: "/investigations", group: "Opérations", icon: Activity },
  { id: "module.notes", kind: "module", title: "Notes", description: "Notes opérationnelles locales", route: "/notes", group: "Ressources & réseau", icon: StickyNote },
  { id: "module.cheatsheets", kind: "module", title: "Cheatsheets", description: "Commandes clés par outil", route: "/cheatsheets", group: "Ressources & réseau", icon: BookMarked },
  { id: "module.encoder", kind: "module", title: "Encoder/Decoder", description: "Base64, URL, hexadécimal, ROT", route: "/encoder", group: "Ressources & réseau", icon: Binary },
  { id: "module.revshell", kind: "module", title: "RevShell Gen", description: "Générateur de reverse shells", route: "/revshell", group: "Ressources & réseau", icon: Code2 },
  { id: "module.bgp", kind: "module", title: "BGP Lookup", description: "ASN, préfixes et adresses IP", route: "/bgp", group: "Ressources & réseau", icon: Network },
  { id: "module.bgp-historian", kind: "module", title: "BGP Historian", description: "Historique et alertes BGP", route: "/bgp/historian", group: "Ressources & réseau", icon: History },
];

export const ENVIRONMENT_CARDS: EnvironmentCardDefinition[] = [...SYSTEM_CARDS, ...MODULE_CARDS];

const byId = new Map(ENVIRONMENT_CARDS.map((card) => [card.id, card]));

export function getEnvironmentCard(id: string) {
  return byId.get(id);
}

export const DEFAULT_ENVIRONMENT_CARDS = SYSTEM_CARDS.map((card) => card.id);
