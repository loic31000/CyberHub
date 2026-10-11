# CyberHub 2026 — laboratoire local

Ce laboratoire Vite est autonome : aucune connexion à la Console privée, à SQLite ou aux API du backend. Les données affichées sont synthétiques. La vitrine **« De la commande à la compréhension »** raconte le passage d'une ligne de terminal fictive à une investigation documentée. Les trois prototypes A restent comme archives de comparaison.

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
| Nouvelle vitrine terminal | http://127.0.0.1:5174/terminal-story.html |
| A V1 | http://127.0.0.1:5174/a.html |
| A V2 | http://127.0.0.1:5174/a-v2.html |
| A V3 | http://127.0.0.1:5174/a-v3.html |

Les audits [A V2](a-v2-audit.md), [A V3](a-v3-audit.md) et [direction V3](direction-audit.md), les captures des trois versions et les six références visuelles de A V3 restent disponibles. Les anciennes explorations B, Atelier et Topologie ont été retirées du laboratoire actif.

## Lire la nouvelle expérience

Le terminal écrit une commande illustrative, révèle deux lignes synthétiques, puis transfère l'adresse de documentation vers une fiche IOC. Une timeline GSAP pilote cette seule séquence, à rythme propre dès son entrée dans le viewport. Les autres scènes continuent vers la corrélation, MITRE, les investigations et la vue finale.

Le pilote [pilot-gsap.js](src/pilot-gsap.js) possède dix étapes nommées. Il anime la saisie, le curseur, la sélection, le transfert avec Flip et la validation fictive. « Voir le résultat complet » termine la scène immédiatement et « Rejouer » relance la timeline ; une sortie rapide ou une préférence de mouvement réduit révèle le résultat final. Le moteur [story-engine.js](src/story-engine.js) et les démonstrations existantes restent utilisés pour les autres scènes.

[Voir la courte capture du mouvement](captures/terminal-story/gsap-pilot.webm).

La consultation MITRE révèle la tactique d'une technique. Les commandes CVE ouvrent une fiche illustrative, sa provenance et les indicateurs que CyberHub sait afficher. Les commandes OSINT comparent trois provenances fictives ; celles de BGP comparent deux instantanés fictifs. La Console existante propose effectivement des fiches CVE avec NVD/KEV/EPSS, la consultation des techniques et tactiques MITRE, des tâches WhatsMyName et un Historian BGP avec comparaison de snapshots. Aucun de ces contrôles publics ne lance une requête.

« Arrêter les animations » supprime les mouvements et conserve tous les résultats visibles. Le parcours suit le défilement natif. La page contient une transcription statique, des descriptions des vues, des contrôles clavier et une version lisible sans JavaScript. Le bandeau narratif animé est décoratif pour les technologies d'assistance ; les informations correspondantes restent dans les titres et textes statiques. Sur mobile, le terminal et la fiche restent dans le flux de lecture ; le repère devient une puce compacte.

La commande n'est jamais exécutée. L'adresse `198.51.100.42`, le fichier, les lignes, les noms OSINT et les chemins BGP sont fictifs. Les données CVE et MITRE illustrent des capacités du projet et ne sont pas dérivées du terminal.

## Vérifier

```powershell
npm test
npm run test:browser
npm run test:v2
npm run test:v3
npm run test:visual
npm run test:terminal
npm run format:check
npm audit --audit-level=low
```

`npm test` construit le site puis vérifie les archives et l'isolement des routes privées. Les scripts navigateur utilisent Chromium installé localement, ou `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` si nécessaire. `test:visual` compare A V3 à ses références existantes ; `visual:update` ne doit être utilisé qu'après une revue explicite des changements visuels.

`test:terminal` parcourt six largeurs (320 à 1920 px), suit les huit états et les transferts entre scènes, vérifie la continuité aux limites, le retour arrière, les sauts rapides, le redimensionnement, les micro-démonstrations, le clavier, le mouvement réduit, l'arrêt des effets, le texte à 200 % et l'absence de JavaScript. Il lance axe-core sur quatre largeurs et plusieurs états interactifs, surveille les erreurs JavaScript et les requêtes externes ou privées. Il produit [un rapport JSON](captures/terminal-story/report.json), des [captures desktop](captures/terminal-story/1440-full.png) et [mobile](captures/terminal-story/390-full.png), [des états synchronisés](captures/terminal-story/state-correlation.png), [un état mobile animé](captures/terminal-story/390-motion-relation.png), [le texte agrandi](captures/terminal-story/320-text200.png) et une [vidéo WebM du parcours](captures/terminal-story/journey.webm). Les captures ont été inspectées visuellement ; axe ne remplace pas un audit humain WCAG ou un test avec lecteur d'écran.

Le lecteur peut vérifier le code source du projet dans son [dépôt GitHub](https://github.com/loic31000/CyberHub).
