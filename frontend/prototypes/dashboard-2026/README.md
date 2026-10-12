# Dashboard CyberHub 2026 - prototype Terminal Overview

> **Statut au 12 octobre 2026 :** prototype frontend validé visuellement sur `feat/console-2026-dashboard-prototype` ; il n'est pas intégré à la Console de `main` et ne constitue pas une interface de surveillance réseau réelle.

Depuis `frontend/` (sur cette branche, avec les dépendances installées) :

```powershell
npm ci
npm run prototype:dashboard
```

Ouvrir **http://127.0.0.1:5175/**. Pour vérifier TypeScript et le build ciblé : `npm run prototype:dashboard:build`.

Ce laboratoire a sa propre entrée Vite, sans proxy, client API, authentification ni route de la Console de production. Les nombres, événements, opérations, alertes et connexions réseau affichés sont fictifs.

## État des itérations validées

- Phase 1 : palette graphite, lisibilité, largeur de mise en page et sidebar compacte.
- Phase 2A : globe géographique fondé sur Natural Earth, continents, arcs animés et ressources locales.
- Phase 2B : Terminal Overview avec flux SVG cyan/bleu/ambre, particules et mouvement réduit.
- Phase 2C : harmonisation du tiroir « Tous les modules » et finitions de contraste, lumière et statuts.
- Phases 2B et 2C sauvegardées au commit `3e92491`, après le checkpoint 1 + 2A `4e15cd0`. Ces SHA décrivent des états historiques du prototype.

Le prototype conserve la navigation compacte et son explorateur de modules. La recherche `Ctrl+K` / `Cmd+K` fonctionne dans le laboratoire et distingue les destinations réellement prototypées. Le dashboard contient des états d'environnement, un aperçu réseau, les opérations, la veille, les accès rapides et la synchronisation fictive.

Les animations respectent `prefers-reduced-motion`. Les validations de code/navigateur rapportées pour les phases ne remplacent pas une validation de sécurité, d'accessibilité ou une intégration de la Console réelle.

## Suite envisagée

L'intégration future dans `main` exige une revue fonctionnelle du shell de Console, des routes, des données et de l'authentification, des tests de non-régression et la vérification des licences/attributions des éléments embarqués. **Aucune fusion ni mise en production n'est impliquée par le seul prototype.**

La direction artistique est consignée dans [docs/design/cyberhub-2026.md](../../../docs/design/cyberhub-2026.md). Les polices locales Manrope, DM Sans et DM Mono possèdent leurs notices dans `public/fonts/`. Les ressources géographiques sont décrites dans [src/geography/README.md](src/geography/README.md).
