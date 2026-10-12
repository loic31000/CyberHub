# Dashboard CyberHub 2026 — Référence Terminal Overview

Depuis `frontend/` :

```powershell
npm run prototype:dashboard
```

Ouvrir **http://127.0.0.1:5175/**. Pour vérifier TypeScript et le build ciblé : `npm run prototype:dashboard:build`.

Ce laboratoire a sa propre entrée Vite, sans proxy, client API, authentification ni route de la Console de production. Tous les nombres, événements et chemins BGP affichés sont fictifs.

V3 utilise une navigation hybride : topbar avec recherche, rail compact sur ordinateur et menu complet à la demande. La palette locale s'ouvre avec `Ctrl+K` ou `Cmd+K`, filtre les vrais noms de modules et quelques exemples explicitement fictifs, puis indique les destinations qui ne sont pas encore prototypées.

Le contenu principal reproduit la composition de référence : bandeau Terminal Overview, cinq états d’environnement, aperçu réseau, opérations, veille, accès rapides et synchronisation. Toutes les données sont fictives et la visualisation réseau est explicitement présentée comme une démonstration. La page n'appelle aucune API, ne lance aucun job et ne simule aucune surveillance continue.

La sidebar compacte du prototype, ses entrées, ses groupes dans le tiroir complet et son comportement sont conservés sans redesign.

Les autres pages seront prototypées après validation visuelle de ce cockpit.

La direction artistique est consignée dans [docs/design/cyberhub-2026.md](../../../docs/design/cyberhub-2026.md). Les polices locales reprennent Manrope, DM Sans et DM Mono du Showcase ; leurs licences sont dans `public/fonts/`.
