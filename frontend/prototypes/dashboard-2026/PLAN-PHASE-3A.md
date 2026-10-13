# Plan Phase 3A - Dashboard personnalisable (étude, non implémentée)

> Document d'étude soumis à approbation. Rien de ce qui suit n'est implémenté dans la Phase 2N.

## Objectif

Permettre de choisir les informations et les modules visibles sur le Dashboard :

- **Niveau 1, cartes d'environnement** : retirer BGP, ajouter IOC Manager, remplacer OSINT par Investigations, afficher CVE & KEV, réordonner, choisir parmi tous les modules réels.
- **Niveau 2, grands widgets** : ajouter, masquer, déplacer et redimensionner (Activité réseau, Threat Monitor, Opérations, Veille CVE, Synchronisation…).

Règle absolue : **aucun faux statut**. Une carte sans métrique réelle devient une carte d'accès au module (nom, description, raccourci), jamais un chiffre inventé.

## 1. Inventaire des modules réels

Les 18 modules ci-dessous sont les entrées du tiroir du prototype, hors Dashboard, chacune associée à sa route réelle dans la Console. Sources : routes de `frontend/src/App.tsx`, client `frontend/src/api/client.ts` et routeur `backend/internal/api/router.go` (préfixe `/api`, routes protégées par JWT).

| id stable | Module | Route Console | Données réelles exposées par l'API | Carte possible |
|---|---|---|---|---|
| `tools` | Outils | `/tools` | `GET /stats` → `tools_total`, `offensive`, `defensive` ; `GET /tools` (liste) | métrique |
| `ctf` | Writeups | `/ctf` | `GET /stats` → `ctf_total`, `ctf_completed` | métrique |
| `cve` | CVE & KEV | `/cve` | `GET /stats` → `cve_total`, `cve_critical` ; `GET /cisa/kev/stats` ; `GET /epss/:cve_id` | métrique |
| `playbooks` | Playbooks | `/playbooks` | `GET /stats` → `playbooks_total` ; `GET /playbooks` | métrique |
| `mitre` | MITRE ATT&CK | `/mitre` | `GET /mitre/status` ; `GET /mitre/tactics`, `/mitre/techniques` | métrique (à confirmer) |
| `mitre-layers` | Layers ATT&CK | `/mitre/layers` | `GET /mitre/layers` (nombre de layers) | métrique |
| `lolbins` | LOLBins | `/lolbins` | `GET /lolbins`, `/lolbins/categories` | métrique (nombre d'entrées) |
| `cloak` | CLOAK OpSec | `/cloak` | `GET /cloak/overrides`, `/cloak/annotations` | accès (+ nombre d'annotations) |
| `ioc` | IOC Manager | `/ioc` | `GET /ioc/stats` ; `GET /ioc` (`total`) | métrique |
| `correlation` | Corrélation | `/correlation` | `GET /correlation/history` | métrique (analyses récentes) |
| `osint` | OSINT Runner | `/osint` | `GET /osint/jobs`, `/osint/meta` | métrique (jobs en cours / terminés) |
| `investigations` | Investigations | `/investigations` | `GET /investigations` | métrique (dossiers ouverts) |
| `notes` | Notes | `/notes` | `GET /notes` | accès (+ dernière note) |
| `cheatsheets` | Cheatsheets | `/cheatsheets` | `GET /cheatsheets` | accès |
| `encoder` | Encoder/Decoder | `/encoder` | aucune (outil client) | accès |
| `revshell` | RevShell Gen | `/revshell` | `GET /revshell` (modèles) | accès |
| `bgp` | BGP Lookup | `/bgp` | `GET /bgp/status` | métrique (état du service) |
| `bgp-historian` | BGP Historian | `/bgp/historian` | `GET /bgp/alerts` (+ `PATCH …/ack`), `GET /bgp/snapshots/:asn` | métrique (alertes non acquittées) |

Sources de données transverses, sans entrée de menu : `GET /threat-feeds/status`, `GET /threat/feeds`, `GET /threat/alerts` (Threat Monitor réel), `GET /settings/db-versions` (fraîcheur des bases, carte « Sources »), `GET /search` (recherche globale).

**À confirmer avant l'implémentation** : la forme exacte des réponses de `/ioc/stats`, `/mitre/status`, `/bgp/status`, `/threat-feeds/status` et `/cisa/kev/stats` (lecture des handlers Go). Le Dashboard actuel de `main` affiche aussi des valeurs codées en dur (`823`, `232`, `Ready`, `Live`…) : elles ne doivent pas être reprises comme métriques.

## 2. Registre de widgets extensible

Un fichier `widgets/registry.ts`, sans dépendance :

```ts
type WidgetSize = { cols: 1 | 2 | 3 | 4 | 6 | 8 | 12; rows: 1 | 2 | 3 };

type WidgetDefinition = {
  id: string;                      // stable, ex. "threat-monitor", "env:ioc"
  kind: "env-card" | "panel";      // carte d'environnement ou grand widget
  moduleId?: string;               // lien vers l'inventaire ci-dessus
  title: string;
  description: string;
  route?: string;                  // destination « Voir tout » dans la Console
  defaultSize: WidgetSize;
  minSize: WidgetSize;
  maxSize: WidgetSize;
  collapsible: boolean;            // réutilise useCollapsible (Phase 2M)
  data: "metric" | "access";       // "access" = aucune valeur affichée
  load?: () => Promise<WidgetData>; // prototype : données fictives ; Console : API réelle
  render: (props: WidgetProps) => JSX.Element;
};
```

Le prototype garde ses données fictives, déclarées comme telles. Dans la Console, `load` appellera les routes de l'inventaire ; en cas d'erreur, la carte affiche « indisponible » plutôt qu'une valeur.

## 3. Configuration de disposition à identifiants stables

```ts
type DashboardLayout = {
  version: 1;
  envCards: string[];               // ordre des cartes, ex. ["console", "ioc", "investigations", "cve"]
  widgets: {
    id: string;                     // id du registre
    col: number; row: number;       // position dans la grille de 12 colonnes
    cols: number; rows: number;     // taille, bornée par min/max
    hidden: boolean;
    collapsed: boolean;
  }[];
};
```

- Une disposition par défaut, identique au Dashboard actuel.
- Validation à la lecture : identifiants inconnus ignorés, tailles bornées, collisions résolues par décalage vers le bas ; une version inconnue revient à la disposition par défaut.
- Migration explicite si `version` évolue.

## 4. Sauvegarde locale et réinitialisation

- Prototype : `localStorage` (`cyberhub.dashboard.layout.v1`), chaque accès dans un `try/catch` ; navigation privée ou stockage bloqué = disposition par défaut, sans erreur.
- Bouton « Réinitialiser la disposition » avec confirmation intégrée à la page (pas de `confirm()`).
- Console réelle (plus tard) : préférence par utilisateur côté backend Go et SQLite, hors périmètre de la 3A.

## 5. Mode édition accessible, sans dépendre du glisser-déposer

- Bouton « Personnaliser » : il passe le Dashboard en mode édition et annonce le changement (`aria-live`).
- Chaque widget expose, en mode édition, une barre d'outils : Monter / Descendre / Gauche / Droite, Agrandir / Réduire, Masquer, et un ordre « Déplacer… » ouvrant une liste des positions.
- Clavier : flèches pour déplacer le widget sélectionné, Maj+flèches pour le redimensionner, Échap pour annuler, Entrée pour valider ; chaque déplacement est annoncé (« Threat Monitor, colonne 10, ligne 3 »).
- Le glisser-déposer souris et tactile s'ajoute ensuite par-dessus les mêmes actions (Pointer Events, sans bibliothèque si possible), jamais comme seule voie.
- Catalogue « Ajouter un widget » : dialogue listant le registre, filtré par la recherche existante.
- Cartes d'environnement : liste ordonnable (Monter/Descendre), ajout et retrait depuis l'inventaire, remplacement d'une carte par une autre.

## 6. Recalcul automatique du circuit

Le circuit mesure déjà les panneaux (`useCircuitGeometry`) et expose `requestCircuitRecompute()`. En 3A :

- Appeler `requestCircuitRecompute()` après chaque déplacement, masquage, redimensionnement, réinitialisation ou chargement d'une disposition (un déplacement à taille constante n'est pas vu par `ResizeObserver`).
- Pendant un glisser, ne pas recalculer à chaque image : recalcul au relâchement, rails en fondu (comportement 2M sur mobile).
- Sur ordinateur, un widget masqué libère son emplacement : les rails sont redessinés une fois, en fondu.

## 7. Responsive

- ≥ 1200 px : grille de 12 colonnes, positions de la disposition.
- 761 – 1199 px : 6 colonnes ; les tailles sont ramenées à 6 au plus, l'ordre suit la disposition (ligne puis colonne).
- ≤ 760 px : une colonne ; l'ordre de lecture reste celui de la disposition ; le mode édition ne propose que Monter/Descendre, Masquer et Replier.
- Une disposition reste unique : les variantes tablette et mobile en sont déduites, pas stockées séparément.

## 8. Étapes proposées pour la Phase 3A

1. Extraire chaque panneau de `DashboardPrototype.tsx` en composant autonome alimenté par props (sans changement visuel).
2. Créer le registre et la disposition par défaut ; rendre le Dashboard à partir de la disposition.
3. Cartes d'environnement personnalisables (niveau 1) : ajout, retrait, remplacement, ordre, persistance, réinitialisation.
4. Mode édition des grands widgets au clavier (niveau 2) : déplacer, redimensionner, masquer.
5. Glisser-déposer optionnel par-dessus les mêmes actions.
6. Tests : axe en mode édition, clavier complet, persistance et données corrompues, absence de collision, recalcul du circuit, responsive.

Critère de validation : aucune régression visuelle de la disposition par défaut par rapport à la Phase 2N.

## Phase 3B - Globe interactif (étude)

État actuel : `src/geography/earth.svg` est **précalculé hors ligne** par `generate.py` (projection orthographique fixe centrée sur 12° O, 24° N). Le globe ne tourne pas aujourd'hui ; seuls les arcs et les villes sont animés.

Pour une rotation interactive :

- **Projection au runtime** : reprendre en TypeScript la projection orthographique de `generate.py` (fonction `project` déjà présente dans `NetworkGlobe.tsx`) avec une longitude/latitude centrale variables ; dessiner côtes et points de terre sur un `<canvas>` (environ 10 000 points pour le jeu 1:110m), en masquant la face cachée (`z < 0`). Les villes et les arcs sont reprojetés à chaque rotation.
- **Souris et tactile** : Pointer Events sur le globe (`touch-action: none` uniquement sur le globe, pour ne pas bloquer le défilement de la page ailleurs), inertie courte au relâchement.
- **Rotation automatique** : lente, mise en pause pendant l'interaction puis reprise après quelques secondes d'inactivité ; désactivée avec `prefers-reduced-motion` (ni rotation automatique, ni inertie).
- **Clavier** : globe focusable avec un nom explicite ; flèches pour tourner par pas de 15°, Origine pour revenir à la vue initiale ; boutons visibles « Tourner à gauche / droite » pour les utilisateurs sans glisser.
- **Coût** : un rendu canvas à chaque image seulement pendant la rotation ; à l'arrêt, une image fixe. Le fichier de données (environ 135 Ko) est déjà local.

Le globe Phase 2A reste inchangé tant que la 3B n'est pas validée.
