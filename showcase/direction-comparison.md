# Deux directions CyberHub 2026 — dossier de décision

Ces propositions remplacent la métaphore du sismographe pour l’étape de **choix d’un langage graphique**. Elles sont des échantillons navigables, pas une V4 ni une refonte des pages privées. Toutes les données et les interfaces de Console montrées sont fictives.

| Critère | Atelier des traces | Topologie d’indices |
| --- | --- | --- |
| Idée directrice | Une ligne trouvée dans une source devient une pièce, puis un dossier dont chaque affirmation garde sa provenance. | Deux sources occupent des positions distinctes, convergent vers une adresse et ouvrent une branche de vérification. |
| Signature visuelle | Encre presque noire, orange d’extraction, cyan de provenance, numéros de ligne, scellés et reliure ; typographie massive avec métadonnées mono. | Bleu nuit violet, citron actif, lavande des sources, chemins orientés, intersection découpée et branche en pointillé ; composition spatiale. |
| Pertinence cyber | Forte pour la forensique, la traçabilité et la documentation d’incident ; aucune fausse détection. | Forte pour la corrélation et l’exploration ; les chemins représentent des liens documentés, jamais du trafic réel. |
| Originalité et lisibilité | Le contraste entre code extrait et explication humaine raconte immédiatement pourquoi une source compte. Les grands titres sont francs ; le nombre de codes visuels reste contenu. | Impact visuel plus immédiat et identité très mémorable. La lecture du graphe demande un peu plus d’attention ; la liste textuelle et le détail de sélection expliquent les liens. |
| Composants et croissance | Onglets, source, registre, chronologie et dossier ont une fonction claire. La grammaire s’étend naturellement aux nombreuses pages de travail de la Console. | Les nœuds, chemins et zones de contexte conviennent aux cartes, enquêtes et tableaux de relations ; leur application à des formulaires et longues tables demandera davantage d’adaptations. |
| Mouvement | Une pièce d’extraction entre et le recoupement se pose ; l’information reste lisible sans animation. | Les chemins du hero se construisent vers le point commun ; la sélection change simultanément le nœud et son explication. |
| Accessibilité | Ordre HTML, détails écrits, focus cyan, contrôle du mouvement, rendu sans JavaScript. | Ordre HTML, liste de carte équivalente, focus citron, contrôle du mouvement, rendu sans JavaScript. |

**Recommandation pour une future Console : Atelier des traces.** Son langage part du fait vérifiable plutôt que de l’effet de réseau et s’adapte plus facilement à 30+ pages de dossiers, sources, formulaires et chronologies. Topologie d’indices constitue la proposition la plus spectaculaire pour une entrée publique et un module de cartographie ; elle demanderait une discipline stricte pour ne pas transformer chaque écran de travail en graphe. Le choix final appartient à la revue humaine, après inspection des parcours et vidéos.

## Voir les deux systèmes

- Atelier : [parcours desktop](captures/directions/atelier-journey-1440.png), [mobile](captures/directions/atelier-journey-390.png), [planche de composants](captures/directions/atelier-kit-1440.png), [vidéo des interactions](captures/directions/atelier-interactions.webm).
- Topologie : [parcours desktop](captures/directions/topologie-journey-1440.png), [mobile](captures/directions/topologie-journey-390.png), [planche de composants](captures/directions/topologie-kit-1440.png), [vidéo des interactions](captures/directions/topologie-interactions.webm).
- Les captures par scène, les états de mouvement et le [rapport des contrôles](captures/directions/check-report.json) se trouvent dans [`captures/directions/`](captures/directions/).

## Portée des vérifications

Le script `npm run test:directions` a visité les quatre pages à **320, 390, 768, 1024, 1440 et 1920 px** : **24 combinaisons sans débordement ni erreur JavaScript**, sans requête externe. Clavier, tactile, menu mobile, sélection, méthode dépliable, retour de chapitre, pause du mouvement et rendu sans JavaScript ont passé les assertions. Axe-core a relevé **zéro violation détectée** sur 12 états : parcours et UI kits à 390/1440 px, interaction et menu mobile ouvert pour chaque direction. Le texte agrandi à **200 % dans 640 px CSS** a passé sur les quatre pages après correction d’un débordement de titre. Les captures ont été inspectées pour les titres et les scènes, au-delà du contrôle d’overflow.

`npm test` (build Vite et six tests Node), `npm run test:browser` (A V1/B), `npm run test:visual` (six références A V3), `npm run format:check` et `npm audit --audit-level=low` ont passé lors de la dernière validation ; l’audit npm indique **0 avis**. Le preview local a servi l’index, les quatre nouvelles pages et A V1/V2/V3/B en HTTP 200 ; `/api/auth/status` a répondu 404.

**Limites :** aucun résultat automatique ne démontre à lui seul la conformité WCAG 2.2 AA. NVDA, les appareils physiques et le zoom natif à 200 % restent **NON EXÉCUTÉS**. La perception artistique du mouvement et le choix final réclament une revue humaine ; aucune publication ni refonte de la Console ne découle de ces maquettes.
