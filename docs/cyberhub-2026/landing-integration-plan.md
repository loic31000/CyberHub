# Plan d'intégration de la Landing 2026

**État au 24 octobre 2026.** Document préparatoire seulement : aucun fichier du Showcase n'est importé ou exécuté par la Console.

## Source examinée

- Dépôt source : branche `feat/cyberhub-2026-design`, tête `1f2a494ba4684213cf3ef8b4468eec2715e70f87`.
- La [PR #25](https://github.com/loic31000/CyberHub/pull/25) est ouverte en brouillon. Sa base est `0db993d6ed2d6c44b4748b1e606392da38cb3047`, antérieure au `main` actuel `882c1b68e3f01de5512548e5e558e562810c5bb1`. Ne pas fusionner directement cette PR.
- Entrée principale : `showcase/terminal-story.html`; les prototypes A et leurs archives sont des références de conception, pas des routes à intégrer telles quelles.
- Les scènes utilisent exclusivement des données fictives. Les scripts examinés ne contiennent pas d'appel `fetch`/XHR, de client API, de chemin `/api/` ou de lecture de stockage navigateur. La page comprend un contenu statique de repli lorsque JavaScript est désactivé.

## Éléments à conserver et à adapter

| Source existante | Rôle | Adaptation React envisagée |
| --- | --- | --- |
| `showcase/terminal-story.html` | Vrai balisage de la Landing : navigation, jalons, Terminal→IOC, scènes, guide narratif, six détails statiques et contenu `<noscript>`. Charge explicitement `src/terminal-story.css`, `src/terminal-story.js` et `public/terminal-mark.svg`. | Reprendre le contenu sémantique en composants; conserver le skip link, les ancres, le texte final et l'alternative sans JavaScript. |
| `src/terminal-story.js` | Orchestrateur impératif : mesure des jalons, synchronisation du chapitre, commandes et scènes. | Porter le suivi de progression dans hooks/observateurs et l'état React; ne pas manipuler les nœuds React avec `append`, `innerHTML` ou des sélecteurs globaux. |
| `src/story-engine.js` | Dix états narratifs et résolution du chapitre depuis les jalons de défilement. | Porter les états et règles sans dépendance au DOM dans un module TypeScript testé. |
| `src/fixtures.js` | Exemples déterministes, provenance et incertitudes fictives. | Garder des fixtures locales typées; interdire imports de `api/`, store d'authentification et modèles SQLite. |
| `src/pilot-gsap.js` | Dix étapes Terminal→IOC : saisie fictive, deux lignes sourcées, transfert Flip et fiche finale. | Une timeline par scène; utiliser `Flip.getState` / `Flip.from` autour d'un changement d'état React et nettoyer les timelines. |
| `src/product-demos.js`, `src/secondary-demos.js` | Guides et interactions Corrélation, MITRE, CVE, OSINT, BGP/Historian et Investigation/Playbooks. | Transformer recherche, filtres et sélections en état React; conserver Rejouer / Voir le résultat complet et étiqueter chaque scène comme fictive. |
| `src/motion.js` | Progression, `prefers-reduced-motion` et arrêt global. | Relier préférence système et bouton Arrêter; annuler les animations et préserver leur état final au démontage. |
| `src/terminal-story.css` | Feuille réellement chargée par la page; styles des scènes, mouvement et responsive. Importe Manrope, DM Sans et DM Mono depuis Fontsource. | Extraire et scoper les règles utiles; réutiliser les polices locales et tokens Console, sans les installer deux fois. |
| `public/terminal-mark.svg` | Marque référencée par la page. Les dessins sont principalement inline SVG/CSS. | Reprendre après revue visuelle, provenance et licence. `public/favicon.svg` n'est pas référencé par `terminal-story.html`. |
| `src/styles.css`, `index.html`, `a*.html`, captures et scripts de comparaison | Styles/archives d'autres prototypes. `terminal-story.html` ne charge pas `src/styles.css`. | Références seulement; ne pas les ajouter au bundle de production. Garder les captures hors du build applicatif. |

Le Showcase est du HTML/CSS/JavaScript impératif, pas un ensemble de composants React. Les scripts manipulent directement les nœuds et l'ordre DOM. Ils ne doivent pas être chargés tels quels à l'intérieur d'un arbre React. `showcase/package.json` déclare GSAP 3.15 et les plugins Flip, ScrollTrigger et TextPlugin; le frontend principal ne déclare pas GSAP.

## Réutilisation côté Console

- `frontend/src/App.tsx` a actuellement `/login` comme route publique; les pages Console, dont `/dashboard`, vivent sous `ProtectedRoute` et `Layout`. `/` redirige vers le Dashboard protégé.
- Réutiliser les polices, couleurs, styles de focus et micro-interactions déjà embarqués dans `frontend/src/`, après comparaison visuelle avec Terminal Story. Ne pas importer globalement les feuilles CSS du Showcase.
- `Layout` et la navigation Console sont liés à la session et ne doivent pas envelopper la route de présentation publique. Garder les URLs Console existantes pendant la première intégration.
- `frontend/package.json` ne déclare pas GSAP, tandis que `showcase/package.json` utilise GSAP 3.15 et ses plugins Flip, ScrollTrigger et TextPlugin. Décider si le frontend unique ajoute ces dépendances après revue de licence, poids, code splitting et nettoyage React; ne pas recopier le lockfile du Showcase.

## Architecture proposée

1. Ajouter une route publique comme sœur de `ProtectedRoute`, hors de `Layout`. Commencer par `/welcome` pour préserver `/dashboard`, `/login` et les deep links; décider séparément si `/` doit devenir la Landing.
2. Composer `LandingPage`, navigation, progression, scènes, contrôles de mouvement et démos. Pour chaque timeline, utiliser `useLayoutEffect` et `gsap.context(ref)`, puis `context.revert()` au démontage; scoper les sélecteurs et nettoyer ScrollTrigger/Flip.
3. Porter les dix `STORY_STATES` en TypeScript. Garder un sous-arbre de démo aux fixtures seulement : aucun token, store d'authentification, client API, `fetch` ou import backend. Une route masquée n'est pas une frontière de sécurité.
4. Préserver le scroll natif et le parcours narratif. Rejouer remet l'état au début; Arrêter tue les timelines et affiche le résultat complet; `prefers-reduced-motion` rejoint le même état statique. Écouter les changements de préférence et nettoyer les abonnements à la sortie.
5. Pour le sans-JavaScript, ajouter `welcome/index.html` comme deuxième entrée HTML du même projet/build Vite : texte de récit dans `<noscript>`, même entrypoint React lorsque JavaScript fonctionne. Ce n'est pas un deuxième projet ni serveur. Vérifier que le serveur Go intégré sert `/welcome/` correctement.
6. Garder provenance et incertitudes dans du texte, sans information portée par l'animation seule. Ne présenter Playbooks 2026 comme livré qu'après son intégration séparée; sa scène reste explicitement fictive.

## Portes de validation avant intégration

- Vérifier la tête de `main` et de la branche Showcase, puis porter les éléments choisis sur une branche neuve issue de `main`; pas de merge direct de la PR #25.
- Tester la route sans session et confirmer qu'elle ne redirige pas vers `/login`, tandis que les routes Console restent protégées.
- Intercepter les requêtes navigateur et échouer tout appel vers `/api`, toute URL privée ou toute tentative d'écriture; inspecter aussi les imports et le bundle pour les clients auth/API.
- Tester le récit, l'entrée/sortie des scènes, le rejeu, l'affichage immédiat du résultat, l'arrêt, `prefers-reduced-motion`, clavier, focus, lecteur d'écran, texte à 200 %, pas de JavaScript et erreurs de chargement.
- Vérifier les largeurs mobiles et desktop à partir des références existantes, les débordements, les performances et la cohérence avec la Console. Revoir les licences, attributions, polices et dépendances avant de retenir des assets.
- Garder la démo publique synthétique et la Console locale authentifiée nettement distinctes. Toute décision de publication Internet du Showcase est séparée de l'intégration et ne rend pas la Console publique.

La validation visuelle de la proposition C du Dashboard ne vaut pas validation de cette Landing ni de son accessibilité. Ce plan ne certifie pas WCAG 2.2 AA et ne constitue pas une demande de fusion ou de déploiement.
