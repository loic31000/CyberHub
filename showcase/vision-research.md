# CyberHub 2026 — recherche visuelle : l'atlas déployable

Cette étude précède les deux écrans de preuve. [Planche d'identité](research/vision-board.svg) · [Storyboard et esquisses](research/vision-storyboard.svg).

## Point de départ produit

L'application livre aujourd'hui un gestionnaire IOC et sa corrélation, une veille CVE, MITRE ATT&CK et ses layers, un OSINT Runner, BGP Lookup et Historian, des investigations chronologiques, des playbooks, des outils et des notes. Vérifié dans `frontend/src/App.tsx`, les pages correspondantes, `frontend/src/types/attackLayer.ts`, `frontend/src/types/correlation.ts` et le README racine. La démo intérieure choisit **MITRE Layers**, car le vrai module permet de chercher des techniques, de les sélectionner, les commenter, sauvegarder et exporter. Notre preuve visuelle reste entièrement locale et fictive : elle n'écrit pas dans cette application et ne prétend pas être une version livrée de son interface.

La direction produit future — une vue transversale des disciplines sur le site public et un langage d'interface commun — est une proposition de design, non une fonctionnalité existante.

## Concept

**L'atlas déployable.** CyberHub est un instrument pour ouvrir une discipline, la regarder à la bonne échelle et revenir à l'ensemble. Le pli est sa forme de marque : il possède un recto public (la promesse) et un verso opératoire (le travail). Sur le hero, six feuillets font apparaître des structures différentes — matrice CVE, cellules MITRE, anneaux IOC, horizons BGP, bandes OSINT, séquences de playbook — dans une seule grande pièce de papier numérique. Dans l'écran intérieur, les mêmes plis deviennent une matrice de techniques annotables. Le pli n'est ni un graphe de surveillance ni un simple coin décoratif : il signifie **ouvrir un domaine et garder le contexte**.

Phrase directrice : **« Le monde numérique se lit à plusieurs échelles. »** La promesse « Rendre visible l'invisible » reste dans la signature. L'accueil doit expliquer que l'on rassemble des savoirs et des outils cyber ; le module intérieur montre comment l'on travaille réellement avec eux.

## Trois références de composition

1. [Pentagram, *Knotty Objects*](https://www.pentagram.com/work/knotty-objects) : la typographie se construit sur une grille et agit comme structure spatiale. Je retiens le principe d'une forme identitaire qui se prolonge dans la navigation ; je ne reprends ni le lettrage ni la grille 7 × 7.
2. [Observable, *Focus + Context*](https://observablehq.com/@d3/focus-context) : vue d'ensemble et détail restent simultanément compréhensibles. Je retiens ce changement d'échelle pour la matrice MITRE ; aucune forme de graphique ni code n'est copié.
3. [earth.nullschool.net](https://earth.nullschool.net/) : des domaines différents partagent un même espace de lecture et des contrôles explicites. Je retiens l'idée des modes et d'une couche active, sans globe, données météo ni simulation de flux.

## Grammaire dessinée

La [planche d'identité](research/vision-board.svg) contient le monogramme CH formé d'une feuille ouverte, la signature mixte serif/sans/mono, les couleurs et leurs rôles, les six textures disciplinaires et des états de commandes. La [planche de séquence](research/vision-storyboard.svg) montre trois instants du mouvement, puis les deux esquisses de composition à 1440 et 390 px. Ce sont des dessins vectoriels originaux en SVG, pas des descriptions à la place d'une recherche visuelle.

- **Typographie :** Georgia italique et romaine pour l'idée et les grandes questions, Manrope pour les commandes, DM Mono pour les identifiants et sources. Casse phrase, contrastes de taille, très peu de capitales.
- **Palette :** ivoire minéral `#ecece4` pour l'espace public ; encre `#0b1420` pour la lecture ; bleu profond `#2644d8` pour l'activation ; vert sauge `#719579` pour les sources ; vermillon `#b83e31` seulement pour l'attention. Le bleu n'est pas une alerte, le rouge n'est pas une décoration.
- **Silhouette :** une grande bande pliée irrégulière traverse le premier écran ; une réserve éditoriale porte le récit. L'intérieur est une table d'annotation compacte, pas une rangée de KPI.
- **Commandes :** onglets de feuillets, curseur de détail, inspection de cellule ; états repos, actif, focus et désactivé avec mots visibles en plus des couleurs.
- **Mouvement :** ouverture des plis, sélection d'un domaine, translation vers un détail ; toutes les transformations sont réversibles et ont une présentation statique. Aucun scroll capturé, aucun flux fictif.

## Différence fondamentale avec les cinq propositions rejetées

Il n'y a plus de hero sombre à titre monumental en capitales, plus de récit fondé sur deux notes et une IP, plus de graphique central qui simule une activité, plus de suite de cartes identiques, plus de dossier fictif comme argument principal. La marque repose sur une **forme d'ouverture** réutilisable à différentes échelles, et chaque discipline possède un tracé propre. L'écran intérieur démontre la même grammaire dans une tâche précise : sélectionner, annoter et revoir des techniques MITRE.

## Critères à vérifier dans la preuve

Le logo peut disparaître : le feuillet, le vocabulaire de l'échelle, la typographie et les modes doivent encore évoquer cet atlas CyberHub. Le contenu doit nommer explicitement les domaines réels. Un lecteur non technicien doit comprendre le rôle du module MITRE sans connaître ATT&CK. L'animation doit orienter l'attention, sans cacher un état ni contraindre la navigation. Une personne utilisant le clavier ou une vue sans mouvement doit obtenir les mêmes noms, statuts, descriptions et actions.
