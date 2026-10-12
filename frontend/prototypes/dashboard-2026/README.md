# Dashboard CyberHub 2026 — prototype V1

Depuis `frontend/` :

```powershell
npm run prototype:dashboard
```

Ouvrir **http://127.0.0.1:5175/**. Pour vérifier TypeScript et le build ciblé : `npm run prototype:dashboard:build`.

Ce laboratoire a sa propre entrée Vite, sans proxy, client API, authentification ni route de la Console de production. Tous les nombres, événements et chemins BGP affichés sont fictifs. Le sélecteur « État de démonstration » montre les états avec exemples, chargement, vide et erreur. Les autres modules du menu ouvrent un message de prototype ; leurs pages viendront après validation visuelle du Dashboard.

La direction artistique est consignée dans [docs/design/cyberhub-2026.md](../../../docs/design/cyberhub-2026.md). Les polices locales reprennent Manrope, DM Sans et DM Mono du Showcase ; leurs licences sont dans `public/fonts/`.
