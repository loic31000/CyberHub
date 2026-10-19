# Contribuer à CyberHub

Merci de vouloir améliorer CyberHub. Signaler un bug, proposer une idée, corriger une fiche ou du code : toute aide est bienvenue.

## Signaler un bug ou proposer une idée

Ouvrez une [issue](https://github.com/loic31000/CyberHub/issues/new/choose) avec le modèle qui convient. N'y mettez jamais de clé API (VirusTotal, NVD...), de jeton ni d'indicateur issu d'une investigation réelle et confidentielle.

## Proposer une modification

1. Forkez le dépôt et créez une branche à partir de `main`.
2. Gardez la modification ciblée : un correctif ou une fonctionnalité par pull request.
3. Lancez les vérifications (voir [DEVELOPMENT.md](DEVELOPMENT.md)) :

```bash
# Dans frontend/
npx tsc --noEmit
npm test

# Dans backend/, après un build frontend
go test ./...
```

4. Ouvrez une pull request qui explique ce que vous changez et pourquoi.

## Règles du projet

- **Local d'abord** : CyberHub est une application personnelle locale, sans service SaaS ni déploiement Internet de la Console.
- **Usage défensif** : les fonctions offensives (cheatsheets, générateur de reverse shell...) servent à l'apprentissage et aux tests autorisés uniquement.
- **Sources tierces** : respectez la licence des données intégrées (CLOAK sous GPL v2, LOLBAS, GTFOBins, abuse.ch). Voir [docs/LICENSING.md](docs/LICENSING.md).

## Code de conduite

Ce projet suit le [code de conduite Contributor Covenant](CODE_OF_CONDUCT.md).
