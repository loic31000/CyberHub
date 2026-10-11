# Brief de direction artistique — CyberHub 2026

Document de préparation pour [#7](https://github.com/loic31000/CyberHub/issues/7), en lien avec le récit de [#4](https://github.com/loic31000/CyberHub/issues/4), les tokens de [#8](https://github.com/loic31000/CyberHub/issues/8) et le mouvement de [#9](https://github.com/loic31000/CyberHub/issues/9). Il définit des hypothèses de design à prototyper, pas des maquettes haute fidélité déjà validées.

## Trois directions à tester

| | 01 — Sismographe éditorial | 02 — Atlas d'indices | 03 — Carnet de laboratoire |
| --- | --- | --- | --- |
| Intention | Faire émerger un signal d'un grand silence visuel. | Organiser les relations comme une carte annotée. | Montrer le raisonnement par dossiers et annotations. |
| Composition | Titres très grands, marges asymétriques, lignes de mesure fines, ruptures nettes de rythme. | Vues en couches, grilles topologiques sobres, légendes et tableaux précis. | Colonnes éditoriales, repères de pages, notes de marge, preuves empilées. |
| Couleur/matière | Fond encre chaude, texte ivoire, un accent cuivre ou bleu froid réservé aux états porteurs de sens. | Fond ardoise et surfaces claires ponctuelles, accent bleu minéral, statut distinct du décor. | Papier sombre mat, gris bleutés, accent ambre limité aux repères. |
| Typographie | Display expressive pour les titres; sans lisible pour le corps; mono seulement pour sources/identifiants. | Sans géométrique pour la structure, serif ou display expressive pour les moments narratifs; mono pour les données. | Serif éditoriale dominante, sans fonctionnelle dans la console, mono pour les traces. |
| Icons/illustrations | Icônes fonctionnelles fines, tracés de signal fabriqués à partir de données fictives. | Symboles de relations avec légende; aucune icône sans texte en contexte critique. | Pictogrammes de dossier et marqueurs de provenance, peu d'ornement. |
| Mouvement | Une révélation courte par acte, transition vers composants réels. | Changement d'échelle volontaire, sélection/focus de relation. | Ouverture/fermeture de notes et déplacement de fragments. |
| Risque | Aspect trop abstrait si la preuve tarde à apparaître. | « Graphe décoratif » qui suggère une fonction non livrée. | Identité de produit moins visible et densité importante sur mobile. |

**Direction conseillée :** 01 pour Showcase, enrichie des légendes/provenances de 02. La Console peut reprendre la hiérarchie, les couleurs sémantiques et les composants de 02 sans reproduire les effets du Showcase. La 03 sert de contre-prototype pour vérifier si la méthode d'enquête est plus claire que le récit du signal. Les palettes ci-dessus sont des intentions, pas des couleurs finales : mesurer les contrastes avant de figer les tokens. Écarter pluie de caractères, néon généralisé, fausse télémétrie, textures qui diminuent la lisibilité et écran d'intro bloquant.

## Structures visuelles à prototyper

### Showcase

| Écran / acte | Desktop | Tablette et mobile | Sens / preuve |
| --- | --- | --- | --- |
| Hero / SIGNAL | Titre sur deux lignes à gauche, champ de signal sobre à droite; preuve et CTA visibles sans attendre la fin d'une animation. | Titre, fragment de signal et CTA empilés; navigation compacte; aucun élément important seulement hors écran. | Un signal a une source; renvoi explicite aux modules existants. |
| COMPRENDRE | Trois fragments alignés selon une relation expliquée, panneau « pourquoi ces éléments ? ». | Fragments en pile numérotée, liens en texte, détail ouvrable. | IOC, corrélation, investigations comme fonctions réelles. |
| CARTOGRAPHIER | Carte de relations fictives + liste synchronisée + provenance/horodatage. | Liste d'abord; détail sous la sélection; carte facultative. | Démo fictive claire; aucun appareil domestique ni NetAlertX « disponible ». |
| AGIR | Capture/prototype de console à taille lisible, 3 gestes clairs, bande CTA code/démo/installation. | Capture recadrée avec légende, un geste à la fois, CTA distincts. | Montrer des modules réellement présents, avec dépendances externes signalées. |

### Console

Dashboard cible : en haut, titre, contexte et état de chargement **vérifié**; ensuite une action prioritaire et les derniers éléments documentés; plus bas, accès aux modules regroupés par tâche, recherche et activité. Les chiffres affichés ont source/horodatage et état « indisponible » si nécessaire. Distinguer données, raccourcis et alertes; aucune valeur en dur sous un label « live ». Sur tablette, navigation rétractable et deux colonnes au plus; sur mobile, navigation ouvrable, une colonne, actions et filtres dans l'ordre du travail. Le design system de #8 doit respecter les routes et fonctions existantes.

## Typographie, composants et contenu

- Sélectionner deux familles maximum pour l'expression et la lecture, plus une mono pour les traces si nécessaire. Tester accents français, chiffres tabulaires, petits écrans et chargement des fontes; prévoir des polices de repli métriquement proches et `font-display` approprié.
- Fixer une échelle lisible pour corps, titres et données; aucun texte essentiel dans une image. Les repères de source/date/confiance utilisent une syntaxe constante, pas seulement une couleur.
- Les primitives prioritaires de #8 : lien/bouton/CTA, navigation, badge d'état, panneau de preuve, liste/détail, champ, tableau, dialogue, état vide/erreur/chargement. Concevoir focus, survol, actif, désactivé et erreur avec la variante mobile.
- Prévoir des captures de console exclusivement avec fixtures revues. Les sources iconographiques, fontes, photographies ou textures devront avoir licence et attribution documentées; privilégier créations originales en CSS/SVG pour les signaux. Fallback sans image/fonte/WebGL obligatoire.

## Mouvement comme aide à la lecture

Le scroll reste natif : pas de scroll jacking, aucune vidéo ou piste sonore en lecture automatique, pas d'étape qui oblige à attendre. Une scène ne bouge que si cela aide à comprendre apparition, relation, échelle ou changement de contexte. La parallaxe se limite à un plan décoratif discret et peut être retirée si elle gêne le texte. Les micro-interactions confirment une action sans animation continue. La 3D/WebGL n'est justifiée que si un prototype démontre un gain narratif mesurable par rapport à HTML/SVG; elle ne doit pas devenir une dépendance de lecture ou de navigation.

Pour `prefers-reduced-motion: reduce`, présenter directement l'état final, supprimer parallaxe et animation de révélation, conserver focus, liens et logique de lecture. Prévoir aussi un contrôle explicite « Réduire les effets » si le prototype en a besoin. Sur appareil modeste, différer les éléments décoratifs, éviter les calculs lourds pendant le scroll et comparer les mesures avant/après; les budgets de poids et de vitesse seront fixés après un prototype mesuré, pas annoncés comme atteints. Référence comportementale : [MDN `prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion).

## Accessibilité et livrables attendus pour #7

Viser [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/) : ordre DOM/focus cohérent, contrastes mesurés pour texte et composants, zoom/reflow, cibles tactiles adaptées, alternatives aux visualisations, interactions clavier et retour d'état annoncé. C'est un objectif à tester, pas une conformité acquise. Les animations ne portent jamais seules une information.

Produire avant validation :

1. Deux prototypes visuellement contrastés du hero + section suivante et d'un dashboard, chacun desktop **et** mobile; la troisième direction reste exploratoire si le temps est contraint.
2. Palette et échelle typo avec valeurs de contraste mesurées, spécification des états interactifs, focus et version sans mouvement.
3. Une interaction de l'acte II et une de l'acte III testées sur clavier, tactile et appareil peu puissant, avec chemin de repli sans effet.
4. Inventaire des assets, licences, poids, fallback et indication de ce qui est fictif.
5. Revue humaine du récit et de la direction retenue avant implémentation de la landing [#10](https://github.com/loic31000/CyberHub/issues/10).
