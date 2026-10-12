# Branches CyberHub et intégration future - état au 12 octobre 2026

Ce document fournit une **photographie de GitHub**, pas de l'état non commité des postes de développement. Il ne déclenche aucune fusion ni suppression de branche.

## But du projet

CyberHub est un outil personnel de cybersécurité, utilisable localement, dont le code original est destiné à être partagé sous licence MIT. Sa landing et son Dashboard 2026 doivent **à terme rejoindre le frontend React existant dans `frontend/`**, tandis que Go et SQLite demeurent locaux et protégés. L'objectif n'est pas de déployer un SaaS ou d'imposer deux applications frontend. Voir [l'architecture](cyberhub-2026/architecture.md).

Les laboratoires et leurs branches permettent de concevoir et tester les interfaces sans risquer la Console existante. **Un merge Git du laboratoire n'est pas équivalent à l'intégration du prototype dans les routes, composants et données de l'application.**

## Branches connues

| Branche | Rôle au moment de cette vérification | Action conseillée |
| --- | --- | --- |
| `main` | Console locale de référence et documentation commune en attente de la PR #26. | Préserver comme base stable tant que les intégrations ne sont pas validées. |
| `docs/2026-readme-licensing-audit` | Documentation actualisée, décision MIT, [PR #26](https://github.com/loic31000/CyberHub/pull/26) vers `main`. | Revoir et fusionner séparément des prototypes, uniquement après accord. |
| `feat/cyberhub-2026-design` | Laboratoire landing / Showcase, [PR #25](https://github.com/loic31000/CyberHub/pull/25) actuellement en brouillon. | Conserver la branche et ses archives. Ne pas fusionner la PR #25 telle quelle comme « intégration terminée ». |
| `feat/console-2026-dashboard-prototype` | Laboratoire Dashboard 2026, globe et flux de démonstration. | Conserver le travail validé et attendre que Codex termine son travail local avant toute opération Git sur cette branche. |
| `feat/cyberhub-2026-foundations` | Ancienne branche documentaire, actuellement derrière `main` et sans commit inédit par rapport à `main`. | Ne pas la refusionner comme un nouveau chantier ; conserver en archive tant qu'aucune suppression n'est décidée. |

## Risques de fusion identifiés

### 1. PR #26 et prototypes : fichiers actuellement distincts

Dans les commits **présents sur GitHub** au moment de ce contrôle, la PR #26 ne modifie que `LICENSE` et des fichiers Markdown communs ; les branches Design et Dashboard ajoutent principalement leurs propres dossiers et **n'ont pas de chemins de fichiers modifiés communs avec la PR #26**. La PR #26 était annoncée fusionnable par GitHub au moment de la revue.

Ceci réduit le risque de conflit textuel avec la PR #26 **à cet instant**, mais ne garantit ni les futurs états du dépôt, ni la compatibilité fonctionnelle des prototypes.

### 2. Landing et Dashboard : collision réelle sur un fichier

Les branches `feat/cyberhub-2026-design` et `feat/console-2026-dashboard-prototype` **ajoutent toutes deux** `docs/design/cyberhub-2026.md`, absent de `main`. Leurs versions **sont différentes** : la branche Landing comporte une note d'état supplémentaire. Deux merges directs et successifs peuvent donc produire un **conflit add/add** sur ce chemin. Même si Git accepte une résolution automatique future, le contenu doit être revu, notamment les mentions anciennes de landing publique / Console privée.

Il faudra conserver **une seule version canonique** de cette direction artistique lors de l'intégration. Ne pas écraser silencieusement l'un des travaux. Résoudre ce fichier explicitement dans une branche d'intégration après avoir synchronisé et sauvegardé les travaux du prototype.

### 3. Travaux locaux de Codex invisibles sur GitHub

Un `git status` local, des fichiers non suivis et des commits non poussés sur le poste de Codex ne sont pas visibles via l'API GitHub. L'audit ne peut **pas** garantir l'absence de futurs conflits pour ces changements. Pendant un travail Codex en cours, ne pas faire `git pull`, `git merge`, `git rebase`, `git reset` ou `git cherry-pick` dans son worktree sans examiner l'état et coordonner son intervention.

### 4. Fusion de code ne signifie pas intégration métier

- Le Showcase sur sa branche est un laboratoire Vite autonome, avec démos fictives. Il doit être adapté au frontend React de la Console, sans importer une nouvelle politique d'hébergement ou de déploiement Internet.
- Le Dashboard prototype affiche des données fictives, une navigation expérimentale et des scènes décoratives. Une vraie intégration nécessite de conserver les modules, l'authentification, les routes, les données et les erreurs de la Console.
- Une fusion brute des branches risquerait d'ajouter des prototypes côte à côte, **sans** livrer la landing et le Dashboard intégrés au frontend principal.
- Les images, vidéos et captures historiques peuvent alourdir les PR d'intégration. Les conserver comme archives si utiles, mais ne pas les intégrer automatiquement aux bundles finaux.
- Les droits et notices des bibliothèques, polices, fichiers géographiques et données tierces doivent être vérifiés (voir [licences](LICENSING.md)).

## Séquence recommandée, sans fusion automatique

1. **Figer et sauvegarder les travaux en cours.** Attendre la fin de Codex, vérifier branche et `git status`, valider les changements, commit/push explicites par leur responsable. Éviter les manipulations de branches pendant son travail.
2. **Traiter la PR documentaire #26 séparément.** Elle concerne MIT, README, architecture et documentation commune, et n'intègre aucun prototype. Re-vérifier son état GitHub juste avant approbation.
3. **Préparer des branches d'intégration issues du `main` à jour**, dans des worktrees distincts si plusieurs tâches avancent simultanément. Conserver les branches de laboratoires comme références immuables pendant ce travail.
4. **Intégrer la landing** dans les routes et composants de `frontend/` en préservant la distinction entre la présentation fictive et les données réelles. Ne pas considérer la PR #25 actuelle comme une intégration prête.
5. **Intégrer progressivement le Dashboard 2026** dans la Console existante en reliant ses informations aux données/permissions correctes, sans casser les autres modules.
6. **Résoudre explicitement `docs/design/cyberhub-2026.md`** à partir des deux références ; adopter une version canonique compatible avec l'architecture finale.
7. **Tester avant fusion vers `main`** : builds, TypeScript, tests React/Go pertinents, parcours authentifiés, persistance SQLite, clavier, mobile, mouvement réduit, crédits/licences, absence de données privées dans les démonstrations.
8. **Fusionner seulement après validation explicite de chaque PR d'intégration.** Aucune fusion, suppression ou réécriture de branche prototype ne fait partie de l'audit documentaire.

## Limites de cette vérification

Ce contrôle porte sur **l'état GitHub publié au 12 octobre 2026**, les chemins présents dans les branches et l'état des PR au moment de la consultation. Il ne constitue ni un dry-run local exhaustif de Git sur tous les futurs commits, ni un audit du code non poussé de Codex. Les états de PR, les branches et les possibilités de merge peuvent évoluer dès qu'un nouveau commit arrive.
