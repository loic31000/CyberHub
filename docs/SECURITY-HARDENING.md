# Durcissement GitHub du dépôt

État préparé le 24 octobre 2026 pour `loic31000/CyberHub`.

Ce document sépare les protections **définies dans le dépôt** des interrupteurs **administratifs GitHub** qui doivent être activés dans l'interface du dépôt.

## Automatisations versionnées

- `SECURITY.md` : canal et règles de signalement.
- `.github/dependabot.yml` : mises à jour npm, Go et GitHub Actions chaque semaine.
- `.github/workflows/codeql.yml` : analyse CodeQL JavaScript/TypeScript et Go sur PR, `main` et chaque semaine.
- `.github/workflows/dependency-review.yml` : bloque une PR qui introduit une dépendance avec vulnérabilité **high** ou **critical**.
- `.github/workflows/backend-ci.yml` : build frontend requis par `go:embed`, tests Go, `go vet` et `gofmt`.
- `.github/workflows/frontend-ci.yml` : TypeScript, Vitest et build Vite avec permissions minimales.

## Réglages GitHub à activer dans Settings → Security / Code security

Activer, si GitHub les propose pour ce dépôt public :

1. **Dependency graph**.
2. **Dependabot alerts**.
3. **Dependabot security updates**.
4. **Grouped security updates** si disponible.
5. **Code scanning** : le workflow CodeQL de ce dépôt doit apparaître après son premier run.
6. **Secret scanning**.
7. **Push protection** pour les secrets.
8. **Private vulnerability reporting** afin que `SECURITY.md` puisse pointer vers un vrai canal privé GitHub.

Ne désactivez pas un contrôle uniquement pour faire passer une PR : traiter l'alerte ou documenter explicitement l'exception.

## Protection de `main`

Configurer un ruleset ou une protection de branche ciblant `main` :

- interdire les force-push ;
- interdire la suppression de `main` ;
- exiger le passage par une pull request si le mode solo du dépôt permet `0` approbation ;
- exiger les contrôles de statut pertinents après leur premier passage :
  - `TypeScript, tests, build` ;
  - `Go tests and vet` ;
  - `Dependency review` ;
  - `Analyze (javascript-typescript)` ;
  - `Analyze (go)` ;
- conserver une possibilité d'administration d'urgence ; ne pas activer une règle d'approbation qui empêcherait l'unique mainteneur de fusionner ses propres PR.

## Politique initiale sur les dépendances

Le build du 24 octobre 2026 signalait trois vulnérabilités npm **modérées**. Pour ne pas bloquer immédiatement toutes les PR sur une dette préexistante, Dependency Review commence à `high`. Les alertes modérées doivent néanmoins être examinées et corrigées dans un chantier séparé.

Quand cette dette est réduite, relever progressivement la porte de contrôle si nécessaire.

## Limite du connecteur

Les fichiers ci-dessus sont versionnés et audités par PR. Les interrupteurs administratifs (Secret scanning, Push protection, Dependabot alerts, Private Vulnerability Reporting et protection de branche) ne sont pas modifiables par l'intégration GitHub utilisée pour cette mise à jour ; leur activation doit être confirmée dans les paramètres du dépôt.