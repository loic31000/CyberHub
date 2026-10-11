# Audit du frontend existant — CyberHub 2026

État observé sur `10bd7a87` (audit statique du code, sans test navigateur). Cette note prépare [#6](https://github.com/loic31000/CyberHub/issues/6) et l'[epic #3](https://github.com/loic31000/CyberHub/issues/3). Les comportements responsive et d'assistance doivent encore être vérifiés sur appareils réels.

## Ce qui existe et mérite d'être préservé

- `frontend/src/App.tsx` fournit une console React Router à chargement différé : `/login` et des routes protégées pour dashboard, outils, CTF, CVE, playbooks, MITRE/layers, LOLBins, CLOAK, IOC, corrélation, OSINT, investigations, notes, cheatsheets, encodeur, reverse shell, BGP/historique et paramètres. Les parcours création, détail et édition existent pour plusieurs modules.
- `frontend/src/components/Layout.tsx` et `Sidebar.tsx` forment un shell cohérent avec recherche globale, navigation groupée et sidebar repliable. `SearchModal.tsx` gère déjà flèches, Entrée et Échap; les fiches, filtres et états de chargement de plusieurs pages sont à réutiliser.
- Les capacités concrètes du backend incluent stockage SQLite, authentification, outils/CTF, veille CVE, playbooks, données MITRE, LOLBins/GTFOBins, IOC/corrélation, investigations, OSINT et BGP. Certaines données sont importées ou obtenues auprès de services externes; leur fraîcheur et disponibilité ne doivent pas être promises sans preuve.
- L'API `/api` est protégée côté Go pour les ressources de la console. Le serveur Go embarque actuellement le build React et sert `index.html` en repli SPA. Docker Compose publie `127.0.0.1:7743:7743` et persiste `/data` dans un volume. Cette limite locale est à conserver pour la console.
- `frontend/src/index.css` et `tailwind.config.js` fournissent une base visuelle sombre et Tailwind 3. Préserver les comportements métier et les données, puis faire évoluer les styles par tokens sémantiques dans [#8](https://github.com/loic31000/CyberHub/issues/8).

## Carte actuelle de la console

| Zone | Routes visibles dans `App.tsx` | Travail principal |
| --- | --- | --- |
| Accès | `/login` | Initialisation du compte ou connexion |
| Vue d'ensemble | `/` | Statistiques, accès aux modules, alertes BGP |
| Connaissance | `/tools`, `/ctf`, `/cve`, `/playbooks` et routes `new`, `:id`, `:id/edit` | Consulter, créer, modifier |
| Référentiels | `/mitre`, `/mitre/layers`, `/lolbins` | Explorer techniques, couches et binaires |
| Analyse | `/cloak`, `/ioc`, `/correlation`, `/osint`, `/investigations`, `/investigations/:id` | Examiner indicateurs et enquêtes |
| Utilitaires | `/notes`, `/cheatsheets`, `/encoder`, `/revshell`, `/bgp`, `/bgp/historian`, `/settings` | Produire, convertir, consulter, configurer |

La sidebar regroupe CORE, INTEL, OPS et MISC. Son vocabulaire ne suffit pas à rendre les parcours évidents pour un nouvel utilisateur; la route de recherche ne couvre que outils, CTF, CVE et playbooks (`SearchModal.tsx`). Une route du code n'implique ni données présentes ni service externe disponible.

## Parcours observés et parcours cibles

| Parcours | Aujourd'hui | Cible à prototyper et vérifier |
| --- | --- | --- |
| Visiteur desktop | Pas de vitrine : la racine est la console, puis redirection vers `/login` sans session. | Showcase public → preuve d'une fonction réelle → démo fictive → code / installation / accès privé. |
| Visiteur mobile | Même app et même sidebar que desktop; pas de navigation publique. | Quatre actes lisibles sans animation; CTA visibles; démo fictive tactile et explicite. |
| Opérateur desktop | Login → dashboard dense → groupe de la sidebar → module → fiche/enquête. | Login → état fiable → vue d'ensemble hiérarchisée → investigation avec retour et contexte conservés. |
| Opérateur mobile | Shell `h-screen overflow-hidden` avec sidebar `w-64` ou `w-20`; risque de largeur et de contenu masqué. | Navigation compacte accessible au clavier/tactile → liste → détail, sans défilement horizontal imprévu. |
| Échec réseau | Plusieurs requêtes sont avalées par `.catch(() => {})` dans Layout/Dashboard/recherche. | Message d'erreur et nouvelle tentative; distinguer « aucun résultat » de « indisponible ». |

### Arborescence et esquisses fonctionnelles proposées

Showcase : Accueil (quatre actes) → Fonctionnalités réelles → Démo fictive → Architecture/sécurité → Projet/code → Installation. Un lien « Ouvrir ma console » doit être distinct de « Explorer la démo »; il ne suppose pas que la console privée soit accessible depuis Internet.

Console : Vue d'ensemble → Explorer (outils/CTF/CVE/playbooks/MITRE/LOLBins) → Analyser (IOC/corrélation/investigations/OSINT/BGP/CLOAK) → Produire (notes/cheatsheets/encodeur/reverse shell) → Paramètres. Ce regroupement est une hypothèse de navigation à tester; aucune route ou fonction existante ne disparaît.

```text
Desktop, vitrine : [logo] [fonctionnalités] [démo] [code] [installer]
                    SIGNAL → COMPRENDRE → CARTOGRAPHIER → AGIR
                    [preuve contextualisée] [CTA démo fictive]
Mobile, vitrine  : [logo] [menu]
                    titre → preuve → interaction simple → CTA
                    actes en flux vertical sans scroll imposé
Console desktop : [navigation] [recherche / état réel] [contenu]
                    [liste → filtre → détail → action]
Console mobile  : [barre compacte] [menu ouvrable]
                    [titre + état] [liste] [détail] [actions accessibles]
```

## Problèmes confirmés par le code

| Priorité | Constat / trace | Effet possible | Critère de correction |
| --- | --- | --- | --- |
| P0 | `Layout.tsx` garde une sidebar de largeur fixe et `h-screen overflow-hidden`; `Sidebar.tsx` n'a pas de tiroir mobile. | Utilisation étroite difficile, contenu comprimé. | À 320, 768 et 1440 px : navigation utilisable, contenu sans débordement horizontal; test manuel et automatisé. |
| P0 | Le bouton de repli est un `<div onClick>` dans `Layout.tsx`; plusieurs cartes du dashboard sont des `<div onClick>`. | Parcours clavier incomplet. | Vrais boutons/liens, focus visible, activation Entrée/Espace, nom accessible. |
| P0 | `Dashboard.tsx` affiche des libellés et comptes en dur (`ALL SYSTEMS NOMINAL`, `Database Sync Status NOMINAL (100%)`, « 9 moteurs actifs », « Live », et des nombres fixes de référentiels). | Confusion entre statut mesuré, contenu de démonstration et donnée réelle. | Source, horodatage et état indisponible pour chaque métrique; aucune valeur fictive sous un libellé « live ». |
| P1 | Les `.catch(() => {})` de `Dashboard.tsx`, `Layout.tsx` et `SearchModal.tsx` effacent des erreurs. | Panne présentée comme absence de données; diagnostic impossible. | État erreur visible, tentative de reprise; test d'échec API. |
| P1 | `Login.tsx` transforme un échec de `getStatus` en état « setup ». | Panne de backend prise pour un premier lancement. | Trois états distincts : setup confirmé, connexion, statut indisponible. |
| P1 | `Layout.tsx` déduit certains breadcrumbs d'une table incomplète; d'autres routes retombent sur Dashboard. | Perte de contexte lors d'une investigation. | Breadcrumbs exacts sur chaque route, avec retour liste/détail. |
| P1 | Navigation réduite à icônes sans noms visibles dans certains états; modal de recherche sans rôle/nom explicites apparents. | Repérage et assistance variables. | Noms accessibles, dialogue/focus gérés, libellés explicites en mobile. |
| P1 | `index.css` et composants comportent des animations `animate-pulse`/`animate-ping`, sans règle réduisant globalement le mouvement observée. | Inconfort possible. | `prefers-reduced-motion` respecté et information accessible sans mouvement. |
| P2 | Palette et tailles parfois codées directement dans les pages malgré Tailwind. | Incohérence et maintenance coûteuse. | Inventaire de tokens en #8, contraste mesuré, migration incrémentale sans Tailwind 4. |
| P2 | `README.md`, `build.ps1` et `package.json` racine ne reflètent pas entièrement `frontend/package.json`/Vite actuel; `build.ps1` vise aussi `frontend/dist` alors que Vite écrit `backend/web`. | Onboarding et build local confus. | Documentation et script alignés lors du chantier de qualité; un seul chemin de build vérifié par cible. |

Le JWT côté navigateur est stocké dans `localStorage` (`store/auth.ts`) et ajouté par l'intercepteur Axios (`api/client.ts`). C'est une dette à examiner avant toute exposition plus large de la console, avec une analyse XSS/session. Cette phase ne change pas l'authentification. Le CORS actuel n'est pas une barrière de publication; les routes publiques `/api/auth/status`, `/api/auth/setup` et `/api/auth/login` du serveur privé imposent une séparation d'hébergement pour la vitrine.

## Scénarios de validation pour #6 et la suite

1. À 320/768/1440 px, ouvrir chaque groupe et atteindre un détail puis revenir à la liste sans perte de contexte ni débordement.
2. Au clavier seul, se connecter, ouvrir/fermer la navigation et la recherche, lancer un résultat, puis atteindre les actions d'une carte dashboard.
3. Simuler indisponibilité de `/api/auth/status`, puis des stats et de la recherche : afficher des erreurs distinctes des états vides, permettre une reprise.
4. Charger une console avec listes réellement vides puis avec données : titres, filtres, création et retour restent compréhensibles.
5. Couper/expirer la session pendant une fiche : la redirection et la reconnexion ne laissent pas croire que les données ont été enregistrées.
6. Activer `prefers-reduced-motion` et parcourir les quatre actes, le dashboard et les modales sans perte de contenu ni scroll forcé.
7. Vérifier lecteur d'écran, contrastes, focus et agrandissement à 200 % sur login, sidebar, recherche, dashboard et formulaire.

Ces scénarios sont un plan, pas des tests effectués. La validation WCAG 2.2 AA nécessite mesures et revue humaine ([référence W3C](https://www.w3.org/TR/WCAG22/)). Les captures sous `.github/screenshots/` sont des références visuelles historiques, pas une preuve d'état actuel sur appareils.
