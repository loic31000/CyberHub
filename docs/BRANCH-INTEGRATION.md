# Branches CyberHub et intégration - état au 24 octobre 2026

> **Mise à jour du 24 octobre 2026 (`main` `58fcd0d57bb04985061a6ff27b12702db4e537df`) :** PR #26 et #27 restent les bases documentaires et de la Console. BGP Lookup / Historian 2.0 (#39), CVE & KEV 2026 (#41), Investigations 2026 (#43) et les correctifs Dashboard (#42 et restauration du circuit animé #44) sont fusionnés. La performance avec les animations actives reste à améliorer. Playbooks 2026 reste en développement. La Landing / Showcase reste séparée : [PR #25](https://github.com/loic31000/CyberHub/pull/25) est en brouillon, sa tête `1f2a494b` se fonde sur `0db993d6` (avant `main`). Sa démo utilise exclusivement des données fictives. Conserver les analyses de conflits comme risques de portage ; ne pas fusionner directement cette ancienne PR.

Ce document fournit une **photographie de GitHub**, pas de l'état non commité des postes de développement. Il ne déclenche aucune fusion ni suppression de branche.

## But du projet

CyberHub est un outil personnel de cybersécurité, utilisable localement, dont le code original est destiné à être partagé sous licence MIT. Le Dashboard 2026 est déjà dans le frontend React existant; la Landing pourra le rejoindre après adaptation et revue. Go et SQLite demeurent locaux et protégés. L'objectif n'est pas de déployer un SaaS ou d'imposer deux applications frontend. Voir [l'architecture](cyberhub-2026/architecture.md).

Les laboratoires et leurs branches permettent de concevoir et tester les interfaces sans risquer la Console existante. **Un merge Git du laboratoire n'est pas équivalent à l'intégration du prototype dans les routes, composants et données de l'application.**

## Branches connues

| Branche | Rôle au moment de cette vérification | Action conseillée |
| --- | --- | --- |
| `main` | Console locale au SHA `58fcd0d57bb04985061a6ff27b12702db4e537df`; comprend Dashboard, BGP Lookup / Historian, CVE & KEV 2026 et Investigations 2026. | Base des nouveaux chantiers. |
| `docs/2026-readme-licensing-audit` | Documentation et décision MIT, **fusionnée** via la [PR #26](https://github.com/loic31000/CyberHub/pull/26) (squash). | Archive ; aucune action. |
| `feat/integrate-dashboard-2026` | Branche d'intégration de la Console 2026, **fusionnée** via la [PR #27](https://github.com/loic31000/CyberHub/pull/27). | Archive ; aucune action. |
| `fix/dashboard-animation-performance` | Dashboard Performance, **fusionné** via la [PR #42](https://github.com/loic31000/CyberHub/pull/42). | Référence historique de la phase de performance. |
| `fix/dashboard-circuit-motion-recovery` | Correctif C fusionné via la [PR #44](https://github.com/loic31000/CyberHub/pull/44). | Branche historique ; circuit animé rétabli sur `main`, coût des animations actives non résolu. |
| `feat/bgp-historian-contracts` | BGP Historian 2.0, **fusionné** via la [PR #39](https://github.com/loic31000/CyberHub/pull/39); BGP Lookup est également présent sur `main`. | Archive de référence. |
| `feat/frontend-2026-cve` | CVE & KEV 2026, **fusionné** via la [PR #41](https://github.com/loic31000/CyberHub/pull/41). | Archive de référence. |
| `feat/investigations-2026` | Investigations 2026, **fusionné** via la [PR #43](https://github.com/loic31000/CyberHub/pull/43). | Archive de référence. |
| `feat/playbooks-2026` | Chantier Playbooks 2026 en développement; non intégré à `main`. | Laisser le worktree de travail à son responsable; ne pas inclure dans ce lot. |
| `feat/cyberhub-2026-design` | Laboratoire landing / Showcase, [PR #25](https://github.com/loic31000/CyberHub/pull/25) ouverte en brouillon sur une base antérieure à `main`. | Préserver le récit et les archives; porter et adapter dans une branche neuve, pas de merge direct. |
| `feat/console-2026-dashboard-prototype` | Laboratoire Dashboard 2026, globe et flux de démonstration ; son contenu a été repris dans le frontend principal par la PR #27. | Conserver comme référence historique ; **ne pas fusionner**. |
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

État au 24 octobre 2026 indiqué entre crochets.


1. **[Fait]** **Figer et sauvegarder les travaux en cours.** Attendre la fin de Codex, vérifier branche et `git status`, valider les changements, commit/push explicites par leur responsable. Éviter les manipulations de branches pendant son travail.
2. **[Fait - PR #26 fusionnée le 12/10/2026]** **Traiter la PR documentaire #26 séparément.** Elle concerne MIT, README, architecture et documentation commune, et n'intègre aucun prototype. Re-vérifier son état GitHub juste avant approbation.
3. **[Fait pour la Console : `feat/integrate-dashboard-2026`]** **Préparer des branches d'intégration issues du `main` à jour**, dans des worktrees distincts si plusieurs tâches avancent simultanément. Conserver les branches de laboratoires comme références immuables pendant ce travail.
4. **[À réaliser]** **Intégrer la Landing** selon le [plan dédié](cyberhub-2026/landing-integration-plan.md). PR #25 n'est pas prête à merger : sa base précède `main`, ses scènes impératives doivent être portées vers React et la frontière démo/API doit être testée.
5. **[Fait, PR #27, #39–#44]** **Dashboard et modules indiqués ci-dessus intégrés.** La PR #44 restaure les animations lumineuses du circuit ; l'optimisation de leur coût reste un travail distinct.
6. **[À décider pendant l'intégration]** **Établir une direction artistique canonique** à partir des références existantes; ne pas écraser ou importer sans revue le fichier de design de la branche Landing.
7. **[En continu]** **Tester avant chaque fusion** : builds, TypeScript, tests React/Go pertinents, routes protégées, persistance SQLite, clavier, mobile, mouvement réduit, licences et absence d'accès privé depuis la démo.
8. **[En vigueur]** **Fusionner seulement après validation explicite de chaque PR d'intégration.** Conserver les branches de laboratoire; ne pas réécrire leur historique.

## Limites de cette vérification

Cette photographie vérifie les PR #25, #39, #41, #42, #43 et #44 via GitHub et le `main` au SHA `58fcd0d57bb04985061a6ff27b12702db4e537df` au 24 octobre 2026. Elle ne décrit pas les modifications non commitées des worktrees et n'est pas une comparaison exhaustive de tous les fichiers des branches. Revalider les têtes distantes, les conflits et l'état de chaque chantier avant toute future intégration.
