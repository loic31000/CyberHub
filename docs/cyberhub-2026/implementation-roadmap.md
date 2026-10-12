# CyberHub 2026 - ordre de réalisation et portes de validation

> **Point d'étape au 12 octobre 2026 :** des prototypes de landing / Showcase (`feat/cyberhub-2026-design`) et de dashboard (`feat/console-2026-dashboard-prototype`) sont présents sur GitHub. Ils ne sont pas intégrés dans `main` et ne prouvent ni la publication publique, ni la conformité finale. Les critères et étapes ci-dessous restent en partie la feuille de route historique, pas un rapport d'achèvement. **Décision d'architecture actualisée : une application React unifiée pour un outil personnel local ; la landing et le Dashboard rejoindront à terme `frontend/`, sans projet de SaaS ou d'hébergement public de la Console.** Avant intégration, revoir la qualité, les frontières API/données, les licences tierces et la [licence du projet](../LICENSING.md).

Plan fondé sur les descriptions et critères d'acceptation des [issues #3 à #10](https://github.com/loic31000/CyberHub/issues/3) et [#19 à #22](https://github.com/loic31000/CyberHub/issues/19), lus sur GitHub pendant cette phase. Les issues restent ouvertes. Le présent lot est **documentaire** et ne constitue ni une vitrine livrée, ni une conformité sécurité/accessibilité démontrée.

## Séquence recommandée

| Phase | Issues / dépendances | Livrable et premier geste | Porte de validation |
| --- | --- | --- | --- |
| 0. Fondations documentées | [#3](https://github.com/loic31000/CyberHub/issues/3), [#4](https://github.com/loic31000/CyberHub/issues/4), [#5](https://github.com/loic31000/CyberHub/issues/5), [#6](https://github.com/loic31000/CyberHub/issues/6), préparation [#7](https://github.com/loic31000/CyberHub/issues/7) | Audit, deux récits, storyboard, ADR, brief et scénarios UX. | Auteur confirme promesse, direction et frontière de publication. |
| 1. Prototypes et validation visuelle | #4 + #5 + #6 puis [#7](https://github.com/loic31000/CyberHub/issues/7) | Prototyper la landing et le Dashboard séparément le temps de leur conception, avec fixtures fictives et captures desktop/mobile. | Revue humaine, mobile/clavier/mouvement réduit, pas de requête aux données personnelles pendant les démonstrations. |
| 2. Système visuel et mouvement | [#8](https://github.com/loic31000/CyberHub/issues/8) après #7; [#9](https://github.com/loic31000/CyberHub/issues/9) après #4/#7 | Tokens et primitives d'abord (boutons, liens, navigation, états, panneau de preuve); prototype de transitions ensuite. Conserver Tailwind 3 tant qu'une migration distincte n'est pas approuvée. | Contrastes, reflow, clavier, mouvement réduit, performance mesurée sur matériel modeste. |
| 3. Landing et démo intégrées | [#10](https://github.com/loic31000/CyberHub/issues/10) après validation artistique | Préparer l'intégration de la landing dans le frontend React existant ; conserver des scènes fictives autonomes côté données. | Compatibilité avec les routes et l'authentification, navigation, accessibilité, absence d'accès aux données privées, captures desktop/mobile. |
| 4. Application et Dashboard 2026 | #6 puis #8 et sous-tâches à créer/relier sous #3 | Intégrer progressivement le Dashboard 2026 dans la Console React existante ; préserver tous les modules, navigation, états erreur/vide et métriques sourcées. | Tests Go/React, parcours login→dashboard→investigation, persistance SQLite, comparaison fonctionnelle avant/après. |
| 5. Réseau optionnel | [#19](https://github.com/loic31000/CyberHub/issues/19) → [#21](https://github.com/loic31000/CyberHub/issues/21) → [#22](https://github.com/loic31000/CyberHub/issues/22) → [#20](https://github.com/loic31000/CyberHub/issues/20) | Vérifier NetAlertX et son connecteur privé en lecture seule; définir sources/modes et limites; fiabiliser identités/provenance; seulement ensuite construire inventaire, timeline et alertes. | Chaque transition de données est testée sur fixtures; aucun scan actif sans accord distinct, aucun service domestique exposé. |

L'intégration du Dashboard peut avancer par petits lots pendant celle de la landing si les composants partagés et les tests sont prêts. Une seule expérience React est la cible, sans obligation de conserver deux builds frontend dans l'application finale. Le chantier NetAlertX ne bloque ni le récit ni le Showcase et ne commence pas dans cette phase.

**Prérequis réseau obligatoires et parallélisme :** #19 vérifie d'abord les interfaces réelles, la compatibilité et le mode lecture seule; #21 peut comparer sur papier les sources et contraintes pendant cette vérification, mais ne fige aucun mode d'import ou de découverte avant son résultat. #22 peut esquisser le modèle d'identité et ses tests de changements IP/MAC en parallèle de #21; sa normalisation effective dépend des champs/provenances établis par #19 et des modes retenus en #21. #20 peut prototyper une interface sur fixtures explicitement fictives en parallèle, mais ses écrans reliés à une source réelle, sa timeline et ses alertes attendent le modèle d'observation fiable de #22. La découverte active n'est ni un prérequis du MVP ni une fonction livrée : elle exigerait une décision distincte sur le périmètre autorisé et les garde-fous.

> **Note historique :** les comparaisons A/B et tickets décrits ci-après documentent la démarche de conception initiale. Les prototypes sont désormais présents sur leurs branches ; leurs validations et l'intégration prévue doivent être vérifiées séparément. Ces prescriptions anciennes ne rétablissent pas l'objectif de deux applications frontend.

## Cahier de passage à #7 - comparer des prototypes, pas des intentions

La présente PR fournit le récit et le [brief préparatoire](art-direction-brief.md). L'issue #7 doit produire **deux prototypes haute fidélité distincts**, chacun décliné en desktop et mobile, avant de choisir une direction finale :

| Livrable vérifiable, pour A **et** B | A - Sismographe éditorial | B - Carnet de laboratoire / Atlas d'indices |
| --- | --- | --- |
| Hero immersif | Signal isolé, typographie expressive et composition asymétrique; la preuve apparaît avec la forme. | Dossier ouvert sur une question et des indices annotés; sources et limites visibles dès l'entrée. |
| Transition SIGNAL → COMPRENDRE | Un tracé se transforme en relations légendées, sans masquer le texte. | Un indice mène à une note sourcée puis à un recoupement explicite. |
| Esquisse CARTOGRAPHIER | Relations fictives avec liste et panneau de provenance; aucun équipement présenté comme réel. | Atlas consultable par index, relation et fiche; incertitudes visibles. |
| Dashboard Console | Hiérarchie éditoriale déduite du récit, avec données et états vérifiables. | Atlas d'indices : listes, relations, sources/horodatages et actions de l'opérateur. |
| Système et interactions | Palette, typographies, composants clés, focus/hover/erreur/vide, durée et déclencheur de chaque révélation. | Mêmes éléments, plus règles d'annotation, sélection, ouverture de dossier et retour au contexte. |
| Mobile et sans mouvement | Composition refluée, navigation tactile/clavier; état final directement lisible avec `prefers-reduced-motion`. | Index et preuves en flux vertical; relations en liste; aucune information portée par une animation seule. |

Les deux propositions doivent montrer de **vrais écrans navigables ou séquences animées comparables**, pas seulement des planches de références. Fournir prototypes consultables, captures desktop/mobile, spécification des micro-interactions et de leurs alternatives, tokens provisoires, contrastes mesurés, inventaire/licences des assets et mesures de chargement sur appareil modeste. Tester au moins hero → acte II → acte III et accès au dashboard au clavier et au tactile. Objectif [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/) à mesurer; aucune conformité revendiquée sur la seule base des maquettes. La revue humaine compare compréhension du récit, distinction démo/réel, lisibilité, coût de production et performance. Elle décide de la direction finale **avant** #8/#9/#10. Aucun prototype n'est produit dans cette PR.

## Backlog UX priorisé pour la Console

1. **P0 :** navigation mobile, vrais boutons/liens et focus sur sidebar/dashboard; suppression des états « live/nominal » et des compteurs fixes lorsqu'ils ressemblent à des mesures.
2. **P1 :** séparer erreur, vide et chargement sur login, dashboard et recherche; breadcrumbs exacts; préserver filtre/contexte entre liste et détail.
3. **P1 :** dialogue de recherche accessible, noms pour navigation repliée, revue du flux clavier et lecteur d'écran.
4. **P2 :** harmoniser couleurs/typographie via tokens, clarifier groupes et microcopie, réaligner README/scripts de build.

Chaque lot doit comporter un scénario observable et un test de non-régression adapté. Les défauts et références de fichiers sont détaillés dans [l'audit](frontend-audit.md). Éviter une refonte générale avant d'avoir mesuré les parcours.

## Risques à traiter avant publication

| Risque | Mesure et preuve attendue |
| --- | --- |
| Confusion entre démo, produit et projet futur | Étiquettes visibles et revue éditoriale de chaque preuve; aucun chiffre ou statut non sourcé. |
| Fuite de l'API, d'un JWT, de captures ou de données privées | Backend accessible uniquement en local, autorisation côté Go, pas de secrets dans le frontend, démonstration isolée des données réelles, revue des fixtures/captures et des requêtes. |
| Accessibilité et performance sacrifiées au mouvement | Prototype avec et sans mouvement, clavier/mobile, mesure des contrastes/reflow et temps de chargement sur appareil modeste. |
| Régression de la console lors du partage visuel | Composants de présentation isolés, tests login, routes et modules, sauvegarde/persistance SQLite vérifiées. |
| Dépendance à un fournisseur ou à NetAlertX supposé | Vérifier versions et interfaces, afficher source/fraîcheur/incertitude, conserver les fonctions actuelles si les sources manquent. |

## Tests à prévoir au fil des phases

- **Landing intégrée :** valider les pages et liens dans l'application React principale, sans dépendance aux données privées ; inspecter les captures, scripts, requêtes et métadonnées. Une éventuelle vitrine statique hébergée exigerait une décision séparée.
- **Démo :** fixtures synthétiques identifiées, flux complet hors connexion au backend, remise à zéro, sélection clavier/tactile, absence d'assertion réseau trompeuse.
- **Console :** tests frontend existants et nouveaux tests de composants, contrôle TypeScript, build React, `go test ./...`, `go vet ./...`, puis parcours automatisés/manuels login→dashboard→investigation et persistance après redémarrage Compose lorsque du code est touché.
- **Design :** mesures de contraste, focus, zoom/reflow, lecteur d'écran, largeur 320/768/1440 px, `prefers-reduced-motion`; revue humaine WCAG 2.2 AA avant toute revendication.
- **Sécurité :** vérifier que la présentation et les scènes fictives ne lisent pas les données du compte ou les endpoints protégés, et que les contrôles d'accès reposent sur Go. Conserver le service local sur loopback ; aucun déploiement Internet ni analyse du réseau privé n'est prévu.

## Décisions qui exigent l'auteur

1. Approuver la signature, les textes et CTA définitifs de « Rendre visible l'invisible »; fournir toute preuve biographique destinée à être publiée.
2. Choisir l'identité visuelle après comparaison réelle des prototypes A/B, y compris direction Showcase et adaptation Atlas pour la Console; approuver licences et captures.
3. Valider le parcours d'intégration landing → Console dans le frontend React existant. Toute publication séparée d'une vitrine statique reste une option future, non requise pour ce projet personnel.
4. Valider le périmètre de la démo fictive, ses modules et son étiquetage.
5. Si un jour l'accès distant à CyberHub est souhaité, décider séparément de son périmètre après revue de sécurité. Il ne fait pas partie de l'objectif actuel.
6. Autoriser séparément toute découverte réseau active, avec périmètre explicite. L'intégration NetAlertX en lecture seule elle-même reste un chantier futur à cadrer.

## État réel des critères de cette phase

| Critère demandé | État dans cette livraison | Ce qui reste |
| --- | --- | --- |
| Audit frontend et parcours desktop/mobile | **Documenté** dans `frontend-audit.md` à partir du code. | Vérification sur navigateurs, appareils et technologies d'assistance. |
| Deux récits comparés et storyboard en quatre actes | **Documentés** dans `brand-story.md`. | Validation éditoriale, tests auprès de lecteurs et prototypes. |
| Architecture unifiée et sécurité | **Cible documentaire actualisée** dans `architecture.md` : une application React, Go/SQLite local. | Préparer l'intégration, préserver le contrôle d'accès et vérifier les frontières entre démonstration et données réelles. |
| Brief artistique exploitable | **Documenté** dans `art-direction-brief.md`. | Maquettes haute fidélité, contrastes et mesures; issue #7 non terminée. |
| Plan relié aux issues | **Documenté** ici. | Planifier sous-tâches et faire valider les portes de phase. |
| Fonctionnalités/données existantes préservées | **Oui pour ce lot documentaire : aucun code ni donnée modifiés.** | Régression à vérifier à chaque futur lot de code. |
| Secret/réseau privé non exposé | **Revue documentaire et pas de publication dans ce lot.** | Vérification automatisée des futurs bundles/captures et de l'hébergement. |

Les DoD complètes des issues #3–#10 nécessitent une implémentation et/ou une validation humaine. Les cinq documents de fondation ont pour emplacement canonique `docs/cyberhub-2026/` : [récit](brand-story.md), [ADR](architecture.md), [audit](frontend-audit.md), [brief préparatoire](art-direction-brief.md) et cette feuille de route. La direction graphique finale sera consignée après comparaison des prototypes #7, dans le brief mis à jour ou un document distinct sous ce même répertoire si nécessaire. La branche de cette PR vient du `main` déjà fusionné avec Security CI; les **nouveaux chantiers** devront partir de `main` après revue et fusion des fondations. Aucune issue n'est close par la seule publication de ces documents.
