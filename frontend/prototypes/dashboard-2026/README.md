# Dashboard CyberHub 2026 - prototype Terminal Overview

> **Statut au 13 octobre 2026 (Phase 3A.1) :** prototype frontend isolé, validé visuellement sur la branche `feat/console-2026-dashboard-prototype`. Il n'est **pas** intégré à la Console de `main` et ne constitue pas une interface de surveillance réelle.

Depuis `frontend/` (sur cette branche, avec les dépendances installées) :

```powershell
npm ci
npm run prototype:dashboard
```

Ouvrir **http://127.0.0.1:5175/**. Pour vérifier TypeScript et le build ciblé : `npm run prototype:dashboard:build`.

Ce laboratoire a sa propre entrée Vite (`vite.config.ts`, port 5175), sans proxy, client API, authentification ni route de la Console de production.

## Données de démonstration

Toutes les valeurs affichées sont **fictives et figées dans le code** (`src/DashboardPrototype.tsx`) : états d'environnement, opérations, alertes du Threat Monitor, bulletins CVE, compteurs et arcs du globe. La page n'appelle aucune API, n'ouvre aucun WebSocket, ne lance aucun job et ne simule aucune surveillance continue. Les actions (« Voir tout », cartes, alertes, notifications, profil) ouvrent une fenêtre de détail locale qui indique la destination qu'elles auraient dans la Console.

## Ce que contient le Dashboard

- **Bandeau Terminal Overview** : le titre `TERMINAL OVERVIEW` s'écrit une fois, caractère par caractère, avec un curseur cyan temporaire (animation CSS, un seul changement d'état React). Le titre reste lu d'un bloc par les lecteurs d'écran et ne se rejoue pas lors des interactions. À droite, le circuit du processeur CyberHub relie chaque piste à une broche réelle de la puce ; l'index `SYS / 2026` se termine par l'indication « Démo locale ».
- **Circuit imprimé de fond** (`src/DashboardCircuit.tsx`) : texture à échelle fixe, plus des pistes, vias et pastilles calculées à partir de la position réelle des panneaux, dans les gouttières. Sept trajectoires lumineuses au plus (cyan, bleu glacé, blanc froid, ambre), dont deux occasionnelles, avec des périodes de calme ; quatre sur mobile. Le circuit reste confiné à la zone de contenu (jamais sous la topbar ni la sidebar), est décoratif (`aria-hidden`, aucun pointeur) et se recalcule sur redimensionnement, chargement des polices ou appel explicite de `requestCircuitRecompute()`.
- **État de l'environnement** : par défaut, cinq cartes de démonstration (Console, MITRE, Sources, OSINT, BGP), **personnalisables** depuis le bouton « Personnaliser » (voir ci-dessous).
- **Activité réseau** : globe géographique de la Phase 2A (Natural Earth, projection orthographique précalculée), arcs animés et légende fictive.
- **Threat Monitor** : deux signaux fictifs (IOC, BGP) à identité rouge ; chacun ouvre sa fenêtre de détail accessible.
- **Dernières opérations**, **Threat Monitor** et **Veille CVE & sources** sont **dépliables indépendamment** : bouton dédié dans l'en-tête (`aria-expanded`, `aria-controls`, Entrée/Espace), résumé visible une fois replié, « Voir tout » reste une action distincte. Sur ordinateur, un panneau replié garde son emplacement (contour discret) afin que le reste de la page et le circuit ne bougent pas. L'état n'est pas mémorisé.
- **Synchronisation des données** : barre de progression fictive.
- **Navigation** : rail compact, tiroir « Tous les modules » (18 modules réels de la Console), recherche locale `Ctrl+K` / `Cmd+K` qui filtre les noms de modules et quelques exemples fictifs.
- Les anciens **Accès rapides aux modules** ont été retirés : ils faisaient doublon avec le tiroir et la recherche.

## Personnaliser les cartes d'environnement (Phase 3A.1)

Le bouton **Personnaliser**, dans l'en-tête d'État de l'environnement, ouvre un dialogue qui permet :

- d'**ajouter** n'importe lequel des 18 modules de la Console, ou de remettre une carte de démonstration retirée ;
- de **retirer** une carte (le module reste accessible depuis le tiroir et `Ctrl+K`) ;
- de **remplacer** une carte par une autre en une seule opération ;
- de **réordonner** avec les boutons Monter / Descendre (aucun glisser-déposer n'est nécessaire) ;
- de **réinitialiser**, après confirmation dans le dialogue, les cinq cartes d'origine.

Chaque module ne peut apparaître qu'une fois. Si toutes les cartes sont retirées, la section affiche un état vide avec « Ajouter un module ». Le dialogue s'utilise entièrement au clavier : focus maintenu dans le dialogue, Échap pour annuler un remplacement puis fermer, focus rendu au bouton « Personnaliser », annonces des ajouts, retraits et déplacements pour les lecteurs d'écran. Sur ordinateur, la grille adapte son nombre de colonnes (six au plus par ligne) ; sur mobile, une colonne.

**Deux types de cartes**, définis dans `src/environmentRegistry.ts` avec des identifiants stables :

- les **cartes de démonstration** (`system.console`, `system.mitre`, `system.sources`, `system.osint`, `system.bgp`) : valeurs fictives de la Phase 2N, présentées comme telles ;
- les **cartes de module** (`module.tools`, `module.ioc`, …) : accès aux 18 modules (Outils, Writeups, CVE & KEV, Playbooks, MITRE ATT&CK, Layers ATT&CK, LOLBins, CLOAK OpSec, IOC Manager, Corrélation, OSINT Runner, Investigations, Notes, Cheatsheets, Encoder/Decoder, RevShell Gen, BGP Lookup, BGP Historian), avec leur route réelle dans la Console. Le prototype n'appelle aucune API : ces cartes n'affichent **aucune valeur ni aucun statut**, seulement le nom, une description et « Accès au module ».

**Stockage local** : la disposition est enregistrée dans `localStorage` sous la clé `cyberhub.dashboard.layout.v1`, au format `{ "version": 1, "envCards": [...], "widgets": [] }`, après chaque modification seulement (rien n'est écrit tant que rien n'est changé). Au chargement, les identifiants inconnus et les doublons sont ignorés ; une configuration illisible ou d'une autre version revient à la disposition par défaut. Si `localStorage` est indisponible, le Dashboard fonctionne avec la disposition par défaut et le dialogue indique que les choix ne seront pas conservés. La réinitialisation supprime la clé. Le champ `widgets` est réservé à la Phase 3A.2.

## Paramètres d'URL du laboratoire

- `?panels=opaque` (par défaut) ou `?panels=glass` : surfaces secondaires légèrement translucides ; les panneaux contenant du texte restent quasi opaques.
- `?palette=petrol` (par défaut) ou `?palette=lagoon` : variantes de fond historiques de la Phase 2E.

## Historique des phases

- **Phase 1** : palette graphite, lisibilité, largeur de mise en page, sidebar compacte.
- **2A** : globe géographique Natural Earth, continents, arcs animés, ressources locales.
- **2B** : flux SVG Terminal Flux dans le bandeau.
- **2C** : harmonisation du tiroir des modules, contraste et statuts.
- **2D** : refonte des panneaux.
- **2E** : palettes petrol et lagoon.
- **2F** : palette historique CyberHub (navy/cyan), cockpit compact, Threat Monitor.
- **2G – 2H** : bandeau éditorial, simplification du cockpit, fenêtres de détail accessibles.
- **2I – 2J** : circuit animé et puce CyberHub dans le bandeau, Threat Monitor lumineux.
- **2K** : premier circuit d'arrière-plan.
- **2L** : circuit mesuré sur les panneaux, espacements aérés, variantes `?panels`.
- **2M** : circuit apaisé, titre tapé, panneaux dépliables, contraste des badges CRITIQUE / NOUVEAU.
- **2N** : pistes du processeur réparties sur ses broches, circuit de fond un peu plus coloré, documentation.
- **3A.1** : cartes d'environnement personnalisables (ajout, retrait, remplacement, ordre, stockage local, réinitialisation).

Les phases 2D à 2M ont été sauvegardées au commit `52423ff`, fusionné avec la documentation distante en `800192e` ; la Phase 2N au commit `7b74eca`.

## Contrôles effectués et limites

Contrôles automatisés en Chromium (Playwright) à 320, 390, 1440 × 900 et 1920 × 1080 : TypeScript, build Vite, axe-core (états initial et replié), contraste mesuré sur le rendu réel, absence de débordement horizontal, de chevauchement et de contenu tronqué, clavier (dépliage, dialogues, Échap, restitution du focus, Ctrl+K, tiroir), `prefers-reduced-motion`, absence d'erreur JavaScript et de requête privée.

**Non couverts** : Firefox, Safari, lecteurs d'écran réels (NVDA, VoiceOver), GPU matériel, largeurs tablette intermédiaires. Ces contrôles ne remplacent ni un audit d'accessibilité manuel, ni une revue de sécurité, ni des tests d'intégration dans la Console.

## Grands widgets personnalisables : prévus pour la Phase 3A.2

Seules les **cartes d'environnement** sont personnalisables à ce stade. Ajouter, masquer, déplacer ou redimensionner les grands widgets (Activité réseau, Threat Monitor, Dernières opérations, Veille CVE, Synchronisation) **n'est pas encore implémenté** ; aucun glisser-déposer n'existe. Le plan détaillé est dans [PLAN-PHASE-3A.md](PLAN-PHASE-3A.md).

## Suite envisagée

L'intégration future dans `main` exige une revue fonctionnelle du shell de Console, des routes, des données et de l'authentification, des tests de non-régression et la vérification des licences/attributions des éléments embarqués. **Aucune fusion ni mise en production n'est impliquée par le seul prototype.**

La direction artistique est consignée dans [docs/design/cyberhub-2026.md](../../../docs/design/cyberhub-2026.md). Les polices locales Manrope, DM Sans et DM Mono possèdent leurs notices dans `public/fonts/`. Les ressources géographiques sont décrites dans [src/geography/README.md](src/geography/README.md).
