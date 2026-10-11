# CyberHub 2026 — laboratoire local

Ce laboratoire Vite est autonome : aucune connexion à la Console privée, à SQLite ou aux API du backend. Les données affichées sont synthétiques. La nouvelle vitrine narrative **« De la commande à la compréhension »** est en préparation ; les trois prototypes A restent comme archives de comparaison.

## Ouvrir le laboratoire

```powershell
cd C:\Users\sion\CyberHub\showcase
npm ci
npm run dev
```

Vite écoute uniquement sur `127.0.0.1:5174` et refuse de changer de port silencieusement.

| Vue | URL locale |
| --- | --- |
| Accueil et archives | http://127.0.0.1:5174/ |
| A V1 | http://127.0.0.1:5174/a.html |
| A V2 | http://127.0.0.1:5174/a-v2.html |
| A V3 | http://127.0.0.1:5174/a-v3.html |

Les audits [A V2](a-v2-audit.md), [A V3](a-v3-audit.md) et [direction V3](direction-audit.md), les captures des trois versions et les six références visuelles de A V3 restent disponibles. Les anciennes explorations B, Atelier et Topologie ont été retirées du laboratoire actif.

## Vérifier

```powershell
npm test
npm run test:browser
npm run test:v2
npm run test:v3
npm run test:visual
npm run format:check
npm audit --audit-level=low
```

`npm test` construit le site puis vérifie les archives et l'isolement des routes privées. Les scripts navigateur utilisent Chromium installé localement, ou `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` si nécessaire. `test:visual` compare A V3 à ses références existantes ; `visual:update` ne doit être utilisé qu'après une revue explicite des changements visuels.

La vitrine sera une simulation illustrative : aucune commande saisie dans le terminal ne sera exécutée et aucune observation réseau réelle ne sera produite. Le lecteur pourra vérifier le code source du projet dans son [dépôt GitHub](https://github.com/loic31000/CyberHub).
