# CyberHub 2026 — laboratoire local

Ce laboratoire Vite est autonome : aucune connexion à la Console privée, à SQLite ou aux API du backend. Les données affichées sont synthétiques. La vitrine **« De la commande à la compréhension »** raconte le passage d'une ligne de terminal fictive à une investigation documentée. Les trois prototypes A restent comme archives de comparaison.

## Ouvrir le laboratoire

```powershell
cd C:\Users\sion\CyberHub\showcase
npm ci
npm run dev
```

Vite écoute uniquement sur `127.0.0.1:5174` et refuse de changer de port silencieusement.

| Vue                       | URL locale                                |
| ------------------------- | ----------------------------------------- |
| Accueil et archives       | http://127.0.0.1:5174/                    |
| Nouvelle vitrine terminal | http://127.0.0.1:5174/terminal-story.html |
| A V1                      | http://127.0.0.1:5174/a.html              |
| A V2                      | http://127.0.0.1:5174/a-v2.html           |
| A V3                      | http://127.0.0.1:5174/a-v3.html           |

Les audits [A V2](a-v2-audit.md), [A V3](a-v3-audit.md) et [direction V3](direction-audit.md), les captures des trois versions et les six références visuelles de A V3 restent disponibles. Les anciennes explorations B, Atelier et Topologie ont été retirées du laboratoire actif.

## Lire la nouvelle expérience

Le terminal écrit une commande illustrative, révèle deux lignes synthétiques, puis transfère l'adresse de documentation vers une fiche IOC. Une timeline GSAP pilote ce transfert, à rythme propre dès son entrée dans le viewport. L'adresse reste ensuite dans les interfaces où elle a un sens ; aucun élément ne flotte entre les sections.

Le pilote [pilot-gsap.js](src/pilot-gsap.js) possède dix étapes nommées. Il anime la saisie, le curseur, la sélection, le transfert avec Flip et la validation fictive. [product-demos.js](src/product-demos.js) anime maintenant Corrélation et MITRE avec des timelines GSAP distinctes : saisie et inspection de deux mentions issues du même fichier fictif, puis recherche PowerShell, filtrage et ouverture de la sous-technique [T1059.001](https://attack.mitre.org/techniques/T1059/001/). Cette référence appartient à Exécution sur Windows ; elle n'est pas attribuée à l'adresse du récit. « Voir le résultat complet » termine chaque scène immédiatement et « Rejouer » relance sa timeline. Une sortie rapide ou une préférence de mouvement réduit révèle le résultat final.

[Voir la courte capture du mouvement](captures/terminal-story/gsap-pilot.webm).

[Voir Corrélation et MITRE en mouvement](captures/terminal-story/product-demos.webm).

La seconde moitié s'appuie sur [secondary-demos.js](src/secondary-demos.js). La veille CVE reprend les contrôles de CVE Watch : recherche, sévérité, index et fiche avec provenance. Ses références `CH-VEILLE-*` sont synthétiques ; aucun score NVD, KEV ou EPSS n'est inventé. OSINT Runner montre une recherche locale de pseudonyme et l'inspection de pistes non attribuées. BGP Lookup/Historian compare deux instantanés fictifs d'ASN privés sur un préfixe de documentation. Investigations et Playbooks montrent l'ajout d'une source, des événements et la prochaine question dans une timeline GSAP. Le final présente des vues représentatives du produit dans un mouvement de recul. Ces scènes ne lancent aucune requête ou collecte.

[Voir les scènes secondaires et le final en mouvement](captures/terminal-story/secondary-scenes.webm).

« Arrêter les animations » supprime les mouvements et conserve tous les résultats visibles. Le parcours suit le défilement natif. La page contient une transcription statique, des descriptions des vues, des contrôles clavier et une version lisible sans JavaScript. Le bandeau narratif animé est décoratif pour les technologies d'assistance ; les informations correspondantes restent dans les titres et textes statiques. Sur mobile, chaque interface reste dans le flux de lecture.

La commande n'est jamais exécutée. L'adresse `198.51.100.42`, le fichier, les lignes, les noms OSINT et les chemins BGP sont fictifs. Les données CVE et MITRE illustrent des capacités du projet et ne sont pas dérivées du terminal.

## Vérifier

```powershell
npm test
npm run test:browser
npm run test:v2
npm run test:v3
npm run test:visual
npm run test:terminal
npm run test:secondary
npm run format:check
npm audit --audit-level=low
```

`npm test` construit le site puis vérifie les archives et l'isolement des routes privées. Les scripts navigateur utilisent Chromium installé localement, ou `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` si nécessaire. `test:visual` compare A V3 à ses références existantes ; `visual:update` ne doit être utilisé qu'après une revue explicite des changements visuels.

`test:terminal` et ses [captures précédentes](captures/terminal-story/report.json) décrivent encore l'ancien déplacement global de l'IP et des sélecteurs supprimés. Cette suite longue devra être adaptée avant la validation finale ; elle n'a pas été exécutée pour cette itération. `test:secondary` reprend les assertions pertinentes pour les nouvelles scènes : contrôles, résultat statique, mouvement réduit, clavier, JavaScript, requêtes privées et débordement à 390/1440 px. Il ne remplace pas un audit humain WCAG ou un test avec lecteur d'écran.

Le lecteur peut vérifier le code source du projet dans son [dépôt GitHub](https://github.com/loic31000/CyberHub).
