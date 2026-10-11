# CyberHub 2026 — ordre de réalisation et portes de validation

Plan fondé sur les descriptions et critères d'acceptation des [issues #3 à #10](https://github.com/loic31000/CyberHub/issues/3) et [#19 à #22](https://github.com/loic31000/CyberHub/issues/19), lus sur GitHub pendant cette phase. Les issues restent ouvertes. Le présent lot est **documentaire** et ne constitue ni une vitrine livrée, ni une conformité sécurité/accessibilité démontrée.

## Séquence recommandée

| Phase | Issues / dépendances | Livrable et premier geste | Porte de validation |
| --- | --- | --- | --- |
| 0. Fondations documentées | [#3](https://github.com/loic31000/CyberHub/issues/3), [#4](https://github.com/loic31000/CyberHub/issues/4), [#5](https://github.com/loic31000/CyberHub/issues/5), [#6](https://github.com/loic31000/CyberHub/issues/6), préparation [#7](https://github.com/loic31000/CyberHub/issues/7) | Audit, deux récits, storyboard, ADR, brief et scénarios UX. | Auteur confirme promesse, direction et frontière de publication. |
| 1. Prototypes et preuve d'isolement | #4 + #5 + #6 + #7 | Maquettes desktop/mobile de hero, acte II, acte III et dashboard; squelette Showcase statique autonome, fixture fictive, tests de bundle public. | Revue utilisateur, mobile/clavier, aucune route API privée dans preview/bundle; aucune donnée réelle. |
| 2. Système visuel et mouvement | [#8](https://github.com/loic31000/CyberHub/issues/8) après #7; [#9](https://github.com/loic31000/CyberHub/issues/9) après #4/#7 | Tokens et primitives d'abord (boutons, liens, navigation, états, panneau de preuve); prototype de transitions ensuite. Conserver Tailwind 3 tant qu'une migration distincte n'est pas approuvée. | Contrastes, reflow, clavier, mouvement réduit, performance mesurée sur matériel modeste. |
| 3. Showcase et démo | [#10](https://github.com/loic31000/CyberHub/issues/10) après #4/#5/#7/#8/#9 | Landing en quatre actes, pages indexables, démo fictive sans backend et liens code/installation. | SEO, accessibilité, bundle sans API/secret, preview sans Go, parcours desktop/mobile; revue des captures et textes. |
| 4. Console progressive | #6 puis #8 et sous-tâches à créer/relier sous #3 | Navigation mobile, sémantique des interactions, états erreur/vide, métriques sourcées, dashboard hiérarchisé; ne supprimer aucun module. | Tests Go/React, parcours login→dashboard→investigation, persistance SQLite, comparaison fonctionnelle avant/après. |
| 5. Réseau optionnel | [#19](https://github.com/loic31000/CyberHub/issues/19) → [#20](https://github.com/loic31000/CyberHub/issues/20) et [#22](https://github.com/loic31000/CyberHub/issues/22) → [#21](https://github.com/loic31000/CyberHub/issues/21) | Vérifier l'interface NetAlertX réelle, connecteur privé opt-in en lecture seule, provenance/horodatage/incertitude, puis étudier séparément le scan actif. | Revue sécurité et autorisation explicite du périmètre avant toute fonction active; aucun service domestique exposé. |

La phase 4 peut avancer par petits lots pendant la phase 3 si les interfaces partagées et les tests sont prêts; elle ne doit pas retarder la correction des défauts UX P0 de la console. Le chantier NetAlertX ne bloque ni le récit ni le Showcase et ne commence pas dans cette phase.

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
| Fuite de l'API, d'un JWT, de captures ou de données privées | Origines/builds séparés, tests négatifs du bundle et des requêtes, revue des fixtures/metadata, publication statique sans Go. |
| Accessibilité et performance sacrifiées au mouvement | Prototype avec et sans mouvement, clavier/mobile, mesure des contrastes/reflow et temps de chargement sur appareil modeste. |
| Régression de la console lors du partage visuel | Composants de présentation isolés, tests login, routes et modules, sauvegarde/persistance SQLite vérifiées. |
| Dépendance à un fournisseur ou à NetAlertX supposé | Vérifier versions et interfaces, afficher source/fraîcheur/incertitude, conserver les fonctions actuelles si les sources manquent. |

## Tests à prévoir au fil des phases

- **Vitrine :** build et preview sans Go ni SQLite; crawl de pages pré-rendues, métadonnées SEO, liens, test négatif `/api`/secret/token/adresses privées dans artefacts et réseau navigateur.
- **Démo :** fixtures synthétiques identifiées, flux complet hors connexion au backend, remise à zéro, sélection clavier/tactile, absence d'assertion réseau trompeuse.
- **Console :** tests frontend existants et nouveaux tests de composants, contrôle TypeScript, build React, `go test ./...`, `go vet ./...`, puis parcours automatisés/manuels login→dashboard→investigation et persistance après redémarrage Compose lorsque du code est touché.
- **Design :** mesures de contraste, focus, zoom/reflow, lecteur d'écran, largeur 320/768/1440 px, `prefers-reduced-motion`; revue humaine WCAG 2.2 AA avant toute revendication.
- **Sécurité :** vérifier accès anonyme/setup aux deux origines; conserver la console locale tant qu'aucune revue d'accès distant n'est achevée. Aucune analyse du réseau privé par la vitrine ou les tests de cette phase.

## Décisions qui exigent l'auteur

1. Approuver ou corriger la promesse « Rendre visible l'invisible », la voix et les CTA; fournir toute preuve biographique qu'il souhaite publier.
2. Choisir la direction visuelle après comparaison des maquettes 01/03 et de l'option Atlas; approuver licences et captures.
3. Choisir l'hébergement public du Showcase et confirmer si la Console restera locale ou nécessitera plus tard un accès distant, sujet à revue de sécurité distincte.
4. Valider ce que la démo fictive peut simuler et quels modules doivent figurer dans le premier parcours.
5. Autoriser séparément, plus tard, toute intégration NetAlertX et surtout toute capacité de scan actif avec périmètre explicite.

## État réel des critères de cette phase

| Critère demandé | État dans cette livraison | Ce qui reste |
| --- | --- | --- |
| Audit frontend et parcours desktop/mobile | **Documenté** dans `frontend-audit.md` à partir du code. | Vérification sur navigateurs, appareils et technologies d'assistance. |
| Deux récits comparés et storyboard en quatre actes | **Documentés** dans `brand-story.md`. | Validation éditoriale, tests auprès de lecteurs et prototypes. |
| Architecture Showcase/Console sécurisée | **Recommandée** dans `architecture.md`. | Implémenter, tester l'isolement et valider l'hébergement. |
| Brief artistique exploitable | **Documenté** dans `art-direction-brief.md`. | Maquettes haute fidélité, contrastes et mesures; issue #7 non terminée. |
| Plan relié aux issues | **Documenté** ici. | Planifier sous-tâches et faire valider les portes de phase. |
| Fonctionnalités/données existantes préservées | **Oui pour ce lot documentaire : aucun code ni donnée modifiés.** | Régression à vérifier à chaque futur lot de code. |
| Secret/réseau privé non exposé | **Revue documentaire et pas de publication dans ce lot.** | Vérification automatisée des futurs bundles/captures et de l'hébergement. |

Les DoD complètes des issues #3–#10 nécessitent une implémentation et/ou une validation humaine. Certaines descriptions d'issues antérieures à la fusion demandent une branche issue de `chore/security-ci-pilot` ou des chemins `docs/brand/story.md` et `docs/design/visual-direction.md`. La demande actuelle impose `feat/cyberhub-2026-foundations` depuis le `main` fusionné et les cinq fichiers sous `docs/cyberhub-2026/`; cette livraison suit ces instructions récentes. Les chemins historiques pourront être mis à jour dans les issues après revue, sans créer des copies divergentes maintenant.
