# CyberHub 2026 — laboratoire de direction artistique

Deux prototypes de l’[issue #7](https://github.com/loic31000/CyberHub/issues/7). Le concept A est retenu pour exploration ; sa direction artistique reste à valider après la V3. Ce dossier est un site Vite autonome. Il ne lit ni `frontend/`, ni `backend/`, ni SQLite ; il ne définit aucun proxy `/api`. Toutes les fiches et relations sont des exemples **synthétiques**, visibles comme tels dans l’interface. La Console privée reste sur ses ports et son volume actuels.

## Ouvrir les prototypes

**A V3 est une proposition à examiner, sans validation artistique acquise.** A V1, A V2 et B restent disponibles. Lire la [revue critique V2 et les preuves V3](a-v3-audit.md) ainsi que l’[audit A V1 → V2](a-v2-audit.md).

| Vue supplémentaire | URL locale | Intention |
| --- | --- | --- |
| A V2 — Sismographe éditorial | http://127.0.0.1:5174/a-v2.html | Une même adresse fictive traverse les quatre actes, du signal à la méthode de vérification. |
| A V3 — Instrument de lecture | http://127.0.0.1:5174/a-v3.html | Le signal devient une adresse, deux notes, une relation, puis un dossier fictif ; le tracé suit la lecture et son retour. |

Dans PowerShell :

```powershell
cd C:\Users\sion\CyberHub\showcase
npm ci
npm run dev
```

| Vue | URL locale | Intention |
| --- | --- | --- |
| Comparaison | http://127.0.0.1:5174/ | Choisir A ou B et changer de piste à tout moment. |
| A — Sismographe éditorial | http://127.0.0.1:5174/a.html | Le signal prend forme, puis devient une relation et une interface. |
| B — Atlas d’indices | http://127.0.0.1:5174/b.html | Une enquête se construit par fiches, annotations et sources. |

Le port **5174** est fixe : Vite refuse de démarrer s’il est occupé, au lieu de choisir silencieusement un autre port. Les modifications HTML/CSS/JS arrivent via HMR, sans reconstruire Docker. Le serveur est lié à `127.0.0.1`. Arrêter Vite avec `Ctrl+C` dans son terminal. Pour une prévisualisation du build, arrêter le serveur de développement puis lancer `npm run build; npm run preview`.

## Comparer ce qui compte

Dans **A**, observer l’apparition initiale du tracé, puis cliquer sur *Observer / Relier / Décider* dans « Comprendre ». Dans « Cartographier », choisir un nœud ou la liste alternative et vérifier que provenance, niveau de certitude et relation changent ensemble. La Console illustrée reprend la forme du tracé dans une hiérarchie de travail sombre.

Dans **B**, ouvrir successivement les fiches de l’index, puis sélectionner une fiche dans l’atlas. La carte reste accompagnée de relations écrites ; l’interface de Console reprend le langage du dossier et rend la prochaine vérification explicite. A privilégie une progression par actes ; B invite à revenir sur une source et à changer d’hypothèse.

Les deux pages comprennent un bouton **Réduire les effets**. La préférence système `prefers-reduced-motion` l’emporte et affiche directement les états stables. Le scroll reste natif. Les animations principales sont : tracé initial A (2,2 s, une seule fois), révélation des sections (0,8 s à l’entrée), lignes de relation A (1,3 s au passage), ouverture d’une fiche B (0,33 s sur sélection). Les survols et états de focus restent visibles sans mouvement. Aucune donnée ne dépend de l’animation pour être comprise.

## Captures et vérifications

Les captures générées par le test navigateur sont dans [`captures/`](captures/) : `comparison-desktop.png`, `a-desktop.png`, `a-mobile.png`, `b-desktop.png`, `b-mobile.png`. Les vues A/B montrent une sélection faite pendant le test, pour rendre les états interactifs visibles.

```powershell
npm run build
npm test
npm run test:browser
npm run test:v2
npm run test:v3
npm run test:visual
npm run format:check
npm audit
```

`npm test` reconstruit puis contrôle les pages, les fixtures, le contraste des principales paires de texte et l’absence de routes, tokens ou clients privés dans le build. `test:browser` lance Vite si nécessaire, emploie Chromium installé localement, teste 1440/768/390/320 px, les interactions souris/clavier/tactile, le mouvement réduit, l’absence de débordement, de requête externe ou d’accès `/api`, puis vérifie HMR en restaurant exactement le CSS d’origine. S’il ne trouve pas Chromium, définir `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` vers un exécutable compatible.

`test:v3` parcourt A V3 à 320/390/768/1024/1440/1920 px, vérifie les états interactifs, la progression et le retour du tracé, le mouvement réduit ou arrêté, le rendu sans JavaScript, axe-core sur plusieurs états, et enregistre captures et vidéo dans [`captures/a-v3/`](captures/a-v3/). `test:visual` compare six scènes avec des [références contrôlées](captures/a-v3/reference/) ; `visual:update` ne doit servir qu’après examen d’un changement visuel voulu. Le [rapport V3](a-v3-audit.md) présente les résultats et les limites de ces contrôles.

Les contrastes mesurés des paires structurantes sont : ivoire/encre A **15,39:1**, cuivre/encre A **8,49:1**, encre/papier B **11,22:1**, rouge/papier B **5,17:1**, ardoise/papier B **5,12:1**. Ces mesures ciblées et les essais automatisés ne constituent pas une certification WCAG 2.2 AA ; une revue avec lecteur d’écran et appareils physiques reste nécessaire avant publication.

## Assets et limites

Le signal, les diagrammes, les marques et le favicon sont réalisés dans ce dépôt en HTML/CSS/SVG. Les polices Manrope, DM Sans et DM Mono sont fournies localement par Fontsource, sous licence **SIL Open Font License 1.1** ; Georgia, Segoe UI et Consolas servent de repli système. Aucun chargement de police ou d’image externe n’est nécessaire à l’exécution. Le navigateur ne reçoit aucune adresse du réseau privé, donnée de la base, valeur JWT ou état opérationnel réel. Les chiffres et dossiers visibles sont des exemples fictifs ; le futur inventaire réseau et NetAlertX ne sont pas représentés comme des fonctions livrées.

Ces maquettes explorent la forme. Le récit final, la direction choisie, les textes publics et une éventuelle publication restent à valider avant l’implémentation des issues #8–#10.
