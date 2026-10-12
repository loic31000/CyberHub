# Dashboard CyberHub 2026 — Terminal Overview V3.1

Depuis `frontend/` :

```powershell
npm run prototype:dashboard
```

Ouvrir **http://127.0.0.1:5175/**. Pour vérifier TypeScript et le build ciblé : `npm run prototype:dashboard:build`.

Ce laboratoire a sa propre entrée Vite, sans proxy, client API, authentification ni route de la Console de production. Tous les nombres, événements et chemins BGP affichés sont fictifs.

V3 utilise une navigation hybride : topbar avec recherche, rail compact sur ordinateur et menu complet à la demande. La palette locale s'ouvre avec `Ctrl+K` ou `Cmd+K`, filtre les vrais noms de modules et quelques exemples explicitement fictifs, puis indique les destinations qui ne sont pas encore prototypées.

Terminal Overview reprend l’ADN technique de CyberHub dans une zone supérieure plus dense : rack de cinq instruments, LED libellées, relevés synthétiques horodatés et accès direct au dernier travail. L’animation lumineuse indique uniquement la sélection dans le prototype. La page n'appelle aucune API, ne lance aucun job et ne simule aucune surveillance continue. Les sections « Reprendre mon travail » et « À surveiller » de V3 restent intactes. Le sélecteur « État du laboratoire » permet de vérifier les rendus exemples, chargement, vide et erreur.

Les autres pages seront prototypées après validation visuelle de ce cockpit.

La direction artistique est consignée dans [docs/design/cyberhub-2026.md](../../../docs/design/cyberhub-2026.md). Les polices locales reprennent Manrope, DM Sans et DM Mono du Showcase ; leurs licences sont dans `public/fonts/`.
