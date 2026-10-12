# ADR - CyberHub personnel et frontend React unifié

**Décision exprimée par l'auteur le 12 octobre 2026 :** CyberHub est principalement un outil personnel de cybersécurité, développé pour un usage local, à partager en open source et à présenter dans une vitrine/portfolio. Ce projet ne vise pas actuellement une plateforme SaaS, un service commercial ni un déploiement Internet de production.

**Cible fonctionnelle : une seule application frontend React dans `frontend/`.** La landing de présentation, le futur Dashboard 2026 et les modules existants appartiendront à cette même expérience. Le backend Go et SQLite reste le service local de l'application. La mise à disposition éventuelle d'une vitrine statique indépendante sur Internet est une **possibilité future**, pas une exigence ni une décision de déploiement.

**Statut technique : intention d'intégration validée, pas encore implémentée dans `main`.** Cette ADR remplace l'ancienne proposition privilégiant deux applications frontend autonomes. Les branches expérimentales `feat/cyberhub-2026-design` (landing / Showcase) et `feat/console-2026-dashboard-prototype` (dashboard) sont conservées séparément jusqu'à une intégration revue et testée. Le prototype Showcase dispose aujourd'hui de son propre laboratoire Vite uniquement pour le développement ; ce n'est pas la cible produit.

## Objectif et périmètre

- **Usage :** CyberHub fonctionne principalement sur le poste de l'utilisateur, et reste installable, partageable et consultable sur GitHub sous licence MIT pour le code original (voir [licences](../LICENSING.md)).
- **Présentation :** une landing soignée raconte le projet, présente les modules et peut inclure une démonstration explicitement fictive. Le partage du projet ne nécessite pas d'exposer l'API Go ni la base SQLite.
- **Application :** le Dashboard 2026 devient à terme le tableau de bord de la Console React existante, avec les vrais modules, parcours et données autorisées. Il ne constitue pas une troisième application.
- **Limite :** aucun hébergement public de la Console ni architecture SaaS ne sont planifiés par cette décision.

## Organisation cible indicative

```text
CyberHub/
  frontend/                application React unifiée
    src/
      ...                  landing et présentation du projet (à intégrer)
      ...                  dashboard 2026 (à intégrer)
      ...                  modules existants, recherche et paramètres
  backend/                 API Go, authentification, SQLite, build React embarqué
  docs/                    architecture, roadmap, licences
  showcase/                laboratoire temporaire de la landing sur sa branche
  frontend/prototypes/     laboratoires temporaires sur leurs branches
```

Ces emplacements sont illustratifs : aucune migration de fichiers ou de routes n'est effectuée par la documentation.

## Intégration et navigation envisagées

La landing pourrait devenir une route d'accueil telle que `/`, avec la Console sous `/app` et une route de connexion protégée, **sous réserve d'inventorier les routes React actuelles** avant de choisir les chemins définitifs. Le backend existant sert actuellement la Console en local ; les redirections, liens et URLs de développement doivent être adaptés sans casser les routes existantes.

Les composants purement visuels (typographie, tokens, navigation, cartes) pourront être mutualisés. Les interfaces interactives du prototype ne deviennent pas automatiquement fonctionnelles : remplacer progressivement les valeurs fictives par des données applicatives vérifiées, préserver les modules, l'authentification, les erreurs et la persistance. Des tests de non-régression sont obligatoires avant chaque intégration.

Le laboratoire `showcase/` sur sa branche reste utilisable pour tester les scènes et animations indépendamment de Go, sans créer l'obligation de maintenir à terme deux applications React.

## Présentation, démonstration et données réelles

Trois notions doivent être clairement distinguées dans les écrans et la documentation :

1. **Présentation du projet** : description et illustrations de capacités réellement présentes.
2. **Démonstration fictive** : fixtures synthétiques explicitement étiquetées, animations non opérationnelles, aucun appel aux données privées et aucune surveillance réseau prétendument réelle.
3. **Console locale authentifiée** : fonctions applicatives effectives, backend et ressources locales protégées.

Si la démonstration est intégrée au frontend commun, ses composants ne doivent pas lire par inadvertance un état utilisateur, un token, l'API ou les données SQLite. Il faut vérifier les imports, les requêtes, les captures et les métadonnées. Le simple masquage d'une route React n'est **pas** une protection de données.

## Frontière de sécurité et diffusion

- La publication du **code source** sur GitHub n'implique pas la publication sur Internet de la **Console en cours d'exécution**.
- Le backend Go et SQLite reste local, accessible selon la configuration existante sur loopback, avec authentification et autorisations décidées **côté serveur**.
- Les secrets ne doivent jamais être placés dans du JavaScript distribué, des fixtures, captures, vidéos ou fichiers de documentation. Les données utilisateurs restent stockées localement.
- La séparation de droits se fait entre routes/actions publiques de présentation et fonctionnalités nécessitant une session, avec contrôles réels au backend.
- CORS ne suffit pas à protéger un backend exposé au réseau. Si une version hébergée est un jour envisagée, ce sera une décision distincte nécessitant revue de l'authentification, HTTPS, stockage des secrets, contrôle des accès, réseau et modèle de menace.
- Les licences et avis des données/actifs tiers incorporés doivent être respectés même pour un projet personnel partagé ; voir [l'inventaire](../LICENSING.md).

## Autres options considérées

| Option | Intérêt | Conclusion pour le besoin actuel |
| --- | --- | --- |
| Un frontend React, Go/SQLite local, landing et Console intégrés | Parcours unifié, design partagé, maintenance simple et cohérence avec le souhait de l'auteur. | **Cible retenue.** |
| Deux applications frontend autonomes, vitrine publique hébergée d'un côté et Console locale de l'autre | Intérêt pour un site indépendant, SEO ou des déploiements distincts. | **Non retenu comme obligation.** À reconsidérer uniquement si un besoin d'hébergement distinct apparaît. |
| Console/Go publiés sur une origine Internet commune avec la landing | Accès distant possible mais surface d'exposition et exigences de sécurité plus grandes. | **Hors périmètre.** |
| Dépôts séparés | Sépare certains cycles de vie mais complexifie le suivi. | Non nécessaire. Un dépôt GitHub suffit. |

## Étapes avant fusion des prototypes

1. Relever les routes, conventions d'authentification et composants de `frontend/` sur la base réelle de `main`.
2. Préparer un plan d'intégration de la landing dans le frontend principal sans supprimer son travail visuel validé.
3. Préparer l'intégration progressive du Dashboard 2026 avec les données et les modules effectifs, sans présenter ses compteurs fictifs comme des mesures.
4. Vérifier responsive, clavier, mouvement réduit, accessibilité, performances, navigation et absence de fuite de données.
5. Vérifier l'absence de régression des endpoints, login, paramètres et de la persistance Go/SQLite.
6. Revoir les licences et attributions de chaque ressource intégrée avant redistribution.
7. Faire valider explicitement les changements et leurs tests, puis seulement fusionner le travail concerné dans `main`.

**Cette ADR décrit la cible documentaire actuelle, pas une fonctionnalité livrée. Aucun code de landing, de Dashboard ou du backend n'est modifié ici.**
