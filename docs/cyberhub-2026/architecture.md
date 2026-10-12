# ADR proposée - séparer Showcase, démo et Console

> **Suivi au 12 octobre 2026 :** le Showcase et le Dashboard existent désormais comme prototypes sur des branches distinctes, mais n'ont pas été fusionnés dans `main`. Les mentions d'absence de code dans cette ADR décrivent le contexte du commit audité, pas l'ensemble du dépôt actuel. La séparation entre vitrine publique et Console privée reste à valider avant une intégration.

**Statut :** proposition à valider avant implémentation de [#5](https://github.com/loic31000/CyberHub/issues/5). **Contexte vérifié :** commit `10bd7a87`; `frontend/` construit aujourd'hui dans `backend/web` via Vite, puis le binaire Go embarque ces fichiers (`backend/main.go`). Gin sert `/api` et un repli SPA depuis le même processus. `compose.yaml` publie seulement sur le loopback de l'hôte; le processus Docker écoute sur toutes les interfaces dans son réseau de conteneur pour être joignable par la publication de port. Aucune vitrine publique indépendante n'existe.

## Décision recommandée

Créer **deux applications frontend dans le même dépôt, avec builds et origines séparés** :

```text
showcase/                  futur site statique/pré-rendu, SEO et démo fictive
frontend/                 Console existante, routes et accès authentifiés
backend/                  API Go, SQLite et assets embarqués de la Console
compose.yaml               publication privée actuelle, loopback hôte
```

`showcase/` n'est ici qu'un emplacement proposé : aucun code n'est créé pendant cette phase. Le Showcase sera hébergé sur une origine publique statique. La Console gardera une origine privée et une API sous `/api`, servies ensemble par Go comme aujourd'hui tant que ce contrat fonctionne. Aucun reverse proxy public ne doit acheminer `/api` vers le Go privé. L'URL publique de la vitrine et l'URL de la console privée seront deux variables de déploiement distinctes, sans valeur réelle consignée ici.

Une **démo publique** sera un parcours client pré-calculé avec fixtures synthétiques versionnées et clairement marquées. Elle doit fonctionner sans backend, sans cookie/JWT et sans requête vers `/api`; elle ne lit jamais SQLite. Les interactions de démonstration modifient uniquement un état local temporaire et peuvent être réinitialisées. Les données ne doivent pas ressembler à des hôtes ou personnes réels; aucun secret ni élément du réseau privé ne doit être copié dans les fixtures, captures ou métadonnées.

## Alternatives étudiées

| Option | Avantages | Coûts / risques | Verdict |
| --- | --- | --- | --- |
| A. Une seule application Go + React sur une origine publique avec routes vitrine et console | Un seul artefact et des composants partagés directement. | Le repli SPA actuel, `/api/auth/status`, `/api/auth/setup`, `/api/auth/login` et les routes privées partageraient une surface Internet; séparation par route fragile, SEO contraint par le build SPA. | Écartée pour une vitrine publique. |
| B. Un dépôt, deux builds/frontends et deux origines | Frontière de publication explicite, site public pré-rendu, console et données conservées, évolution indépendante. | Deux pipelines de build et vérifications d'isolement; éventuelle duplication de composants. | **Recommandée.** |
| C. Dépôts et déploiements entièrement séparés | Permissions Git et cycles de version encore plus isolés. | Duplication de contrats/visuels, coordination et maintenance accrues dès maintenant. | À réexaminer seulement si l'organisation ou l'hébergement l'exige. |

## Contrats techniques proposés

### Routes et publication

- Showcase : `/`, `/fonctionnalites`, `/demo`, `/projet`, `/installer` (sitemap proposé, noms finaux à valider). HTML statique ou pré-rendu pour les pages indexables, titres et descriptions propres, canonical/sitemap/robots vérifiés. La démo peut être une île interactive chargée au besoin. Les pages de démo fictive ne doivent pas être indexées si leur contenu peut être pris pour une réalité opérationnelle.
- Console : conserver les routes React existantes et le repli SPA **uniquement sur l'origine privée**. La route `/login` et l'initialisation du compte restent privées; le Showcase ne propose aucun formulaire de connexion à la Console.
- Builds indépendants : une commande de build/preview du Showcase ne démarre pas Go et ne lit pas `backend/web`; le build de `frontend/` reste destiné à l'embed Go. Si des composants sont partagés, extraire un paquet *présentation seulement* (tokens, typographie, boutons), sans client API, authentification ni données métier. Ne pas importer `frontend/src/api` ou `store/auth` dans Showcase.
- Le `Dockerfile` actuel (Node 24 pour Vite, Go pour embed, runtime non root) et Compose décrivent la Console; ils ne deviennent pas le déploiement du Showcase. Les scripts racine et `README` demandent un réalignement séparé car ils divergent du chemin Vite actuel.

### Authentification et frontière de confiance

La Console utilise un JWT HS256 (issuer `cyber-hub`, durée exigée de 24 h) et un intercepteur Axios qui le lit depuis `localStorage`; les ressources sont protégées par middleware Go. La présence d'un token dans Zustand pilote l'accès React, mais **seul le backend décide** de l'autorisation. La page publique ne reçoit pas de token. Avant tout accès distant à la Console, revoir stockage de session, XSS, durée/rotation des secrets, HTTPS, initialisation du compte et protection de l'origine; ce n'est pas une autorisation de publier Go.

Le CORS limité aux origines de développement/locales ne constitue pas une barrière d'accès Internet. L'isolement repose sur l'hébergement, le routage réseau, les contrôles d'accès et les tests de publication. Garder le bind Compose sur loopback pour le poste local. Une future configuration distante exige une revue de sécurité explicite; aucun host, adresse privée ou exemple de token réel n'est nécessaire dans la documentation.

### Menaces et contrôles à vérifier en #5

| Menace | Mesure d'architecture | Assertion testable |
| --- | --- | --- |
| Bundle public contenant route/API privée, JWT ou secret | Dépendances et build séparés, fixtures revues, variables publiques sur liste blanche. | Inspecter HTML/JS/manifest/sourcemaps du build public : aucun `/api`, `Authorization`, token, secret, adresse ou donnée privée; test automatisé négatif. |
| Repli SPA Go exposé par erreur sous la vitrine | Hébergement statique distinct; aucun proxy vers Go. | Depuis l'origine publique, `/api/auth/status` et `/api/auth/setup` ne rejoignent jamais Go; test de publication avant mise en ligne. |
| Démo trompeuse ou fuite par capture | Fixtures synthétiques, badge « données fictives », revue des captures et métadonnées. | Démarrer preview sans backend et sans réseau privé; tous les parcours démo restent fonctionnels et transparents. |
| Dépendance aux données SQLite locales | Aucun accès à la base depuis Showcase, sauvegardes privées dans `/data`. | Construire/servir Showcase dans un environnement sans base; test d'absence d'accès à SQLite. |
| Import involontaire de code sensible partagé | Paquet de design sans client API ni état auth, règles d'import et analyse du bundle. | Contrôle CI de dépendances interdites et revue de la taille/contenu du bundle. |

### NetAlertX et visibilité réseau future

Les [#19](https://github.com/loic31000/CyberHub/issues/19) → [#21](https://github.com/loic31000/CyberHub/issues/21) → [#22](https://github.com/loic31000/CyberHub/issues/22) → [#20](https://github.com/loic31000/CyberHub/issues/20) décrivent une intégration future, pas une fonction livrée. Si elle est validée : connecteur **côté backend privé**, activé volontairement, accès en lecture seule d'abord, authentifiants conservés côté serveur, aucune publication du service réseau ni transfert au Showcase. Vérifier l'interface/version réelle de NetAlertX avant conception du connecteur. Les vues devraient indiquer source, horodatage, fraîcheur et incertitude de l'identité d'un équipement; éviter les affirmations d'OS/vulnérabilité non établies. Un scan actif ne peut intervenir qu'après un choix explicite de périmètre et une autorisation claire; aucune analyse réseau n'est prévue ici.

## Conditions de sortie de l'ADR

1. L'auteur valide la frontière de publication, le choix d'hébergement public et la nécessité éventuelle d'un accès distant à la Console.
2. Un prototype prouve que Showcase se construit, se prévisualise et se parcourt sans backend, avec métadonnées SEO vérifiables.
3. Des tests d'isolement inspectent le bundle public et refusent les appels `/api`, secrets et références privées; test anonyme/setup sur les deux origines.
4. La Console passe ses parcours login, dashboard et investigation après tout partage de composants, avec tests backend/frontend et persistance SQLite préservée.
5. La revue d'accessibilité et de performance est faite sur desktop, tablette et mobile avant publication.

Cette décision est une cible. Aucun déploiement ni changement de route n'a été fait pour la valider dans cette phase.
