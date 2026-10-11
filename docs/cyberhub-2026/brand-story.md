# CyberHub 2026 — récit et positionnement

Proposition pour [#4](https://github.com/loic31000/CyberHub/issues/4) et l'[epic #3](https://github.com/loic31000/CyberHub/issues/3). Le récit s'adresse aux recruteurs, pairs techniques, contributeurs et personnes qui souhaitent installer la console. La vitrine raconte des capacités vérifiables du dépôt; la démo publique est explicitement fictive. Aucune expérience professionnelle, certification, métrique d'usage ou intégration future n'est attribuée à l'auteur sans preuve fournie.

## Promesse et voix

**Mission proposée :** aider à passer de données de sécurité dispersées à une lecture organisée et à une action documentée. CyberHub rassemble des outils de veille, de référence et d'investigation dans une console personnelle. Il montre aussi comment le produit est construit, avec ses limites.

**Signature proposée :** « Rendre visible l'invisible ». Sous-titre : « Des signaux aux décisions, sans perdre la trace. » Le verbe « rendre » impose une preuve : chaque image spectaculaire doit pouvoir être reliée à un écran, une interaction ou une structure de données réellement présente.

**Ton :** précis, calme, curieux; phrases courtes; verbes concrets; vocabulaire technique expliqué en contexte. Éviter « tout voir », « temps réel », « sécurisé à 100 % », « IA », « détection automatique » et les chiffres non datés. Différencier trois étiquettes visibles : **fonctionnalité disponible**, **démonstration fictive**, **piste de recherche**. Préparer une traduction anglaise à partir des mêmes preuves, sans produire un anglais approximatif dans l'interface française.

**Manifeste court proposé :**

> Un signal seul raconte peu. Relié à sa source, replacé dans le temps et comparé à d'autres indices, il devient une piste. CyberHub donne une forme à ce travail : chercher, relier, documenter, revenir sur ses décisions. L'interface montre ce qu'elle sait, et dit aussi ce qu'elle ignore.

## Deux directions narratives distinctes

| | A — Rendre visible l'invisible | B — Carnet de laboratoire / Atlas d'indices |
| --- | --- | --- |
| Métaphore | Le signal brut acquiert une structure puis devient une interface utilisable. | On ouvre un carnet : hypothèse, source, note, recoupement, décision. |
| Structure | Quatre actes progressifs : SIGNAL → COMPRENDRE → CARTOGRAPHIER → AGIR. | Une enquête non linéaire : choisir une question, suivre des preuves, revenir à la table des matières. |
| Émotion | Curiosité → révélation → orientation → maîtrise. | Intimité → doute raisonné → découverte → confiance dans la méthode. |
| Langage graphique | Champ typographique, tracés sobres, relations qui émergent et se stabilisent. | Papier numérique, index, marginalia, vues de documents, changements d'échelle. |
| Interaction | Scroll natif accompagné de petites interactions volontaires. | Exploration par dossiers et pistes, plus libre mais plus exigeante à orienter. |
| Risque | Spectacle visuel qui efface la preuve; mouvement excessif. | Esthétique de carnet qui sous-vend la console et alourdit l'accès direct aux fonctions. |
| Force | Cohérence immédiate avec l'[epic #3](https://github.com/loic31000/CyberHub/issues/3) et récit simple en quatre actes. | Met en valeur la provenance, l'incertitude et le geste d'investigation. |

**Recommandation proposée :** prendre A pour la structure publique et emprunter à B sa discipline de preuve : chaque visualisation s'accompagne d'une source, d'un état et d'une limite. B doit être prototypée comme une expérience complète et distincte en [#7](https://github.com/loic31000/CyberHub/issues/7), avec son hero, sa transition, sa cartographie et son dashboard. Ce choix reste à valider humainement après comparaison de prototypes desktop/mobile. Les textes et la signature définitifs exigent également l'accord de l'auteur.

## Storyboard de la direction A

### Acte I — SIGNAL

- **Message / texte affiché :** « Tout commence par un signal. » Puis « Encore faut-il savoir ce qu'il raconte. » Un renvoi discret explique que les données présentées sont illustratives.
- **Émotion :** curiosité, tension légère, désir d'examiner.
- **Composition :** grand titre éditorial sur une surface sombre, espace libre généreux; un seul point/tracé semble répondre à l'entrée du visiteur. La source du signal reste indiquée, sans faux indicateur « live ».
- **Mouvement / transition :** le signal apparaît une fois, les caractères se clarifient, puis le tracé conduit visuellement à l'acte suivant. Durée courte, animation non bloquante, aucune lecture liée à la vitesse du scroll.
- **Interaction :** bouton « Suivre le signal » ou défilement natif; option « Voir sans animation » accessible dès le départ.
- **Preuve fonctionnelle :** sources d'information consultables dans les modules BGP, CVE, IOC ou OSINT de la console; la vitrine n'interroge aucune de ces API.
- **CTA :** « Découvrir les données que CyberHub sait organiser » vers la section fonctionnalités.
- **Mobile :** titre et signal empilés; une seule trajectoire; CTA avant la ligne de flottaison autant que possible.
- **Sans animation :** signal déjà visible, relation avec l'acte II donnée par un titre et une courte phrase, aucun contenu caché.

### Acte II — COMPRENDRE

- **Message / texte affiché :** « Un indice prend du sens quand on peut le relier. » Sous-texte : « Sources, contexte et chronologie, au même endroit. »
- **Émotion :** découverte et clarté.
- **Composition :** trois fragments de données typographiés comme des pièces d'un dossier; les liens montrent une relation explicable, avec légende de provenance. Ne pas représenter une corrélation automatique que le produit ne fait pas.
- **Mouvement / transition :** apparition séquentielle des relations au passage de la section; aucune transformation qui masque les textes pendant la lecture.
- **Interaction :** choisir une piste illustrative et ouvrir son explication; navigation par bouton également.
- **Preuve fonctionnelle :** gestion d'IOC, page de corrélation et fiches d'investigation existantes. Montrer un extrait anonymisé ou une fixture fictive identifiée, jamais une base réelle.
- **CTA :** « Voir le parcours d'une investigation » vers la démo fictive.
- **Mobile :** fragments en colonne, relations décrites par libellés; pas de graphe minuscule à pincer.
- **Sans animation :** les trois fragments et leurs relations sont lisibles immédiatement, dans l'ordre DOM logique.

### Acte III — CARTOGRAPHIER

- **Message / texte affiché :** « Une carte ne vaut que par ce qu'elle peut expliquer. » Sous-texte : « Relations, incertitudes et provenance restent visibles. »
- **Émotion :** orientation et capacité à explorer sans croire à une certitude totale.
- **Composition :** carte de relations entre objets d'une enquête fictive; panneau latéral « source / date / confiance » et légende. Les équipements réseau et une éventuelle intégration NetAlertX sont des **pistes futures**, clairement séparées des modules disponibles.
- **Mouvement / transition :** changement d'échelle discret qui révèle la structure; aucun mouvement permanent ni parallaxe indispensable.
- **Interaction :** sélectionner un nœud, filtrer, retrouver la source; des alternatives en liste sont disponibles.
- **Preuve fonctionnelle :** investigations, références MITRE/layers et données BGP existent. L'inventaire domestique, les scans et les alertes NetAlertX ne sont pas livrés ([#19–#22](https://github.com/loic31000/CyberHub/issues/19)).
- **CTA :** « Explorer la carte fictive » vers une démo locale sans connexion à la console privée.
- **Mobile :** liste relationnelle et détails par panneau; la carte devient secondaire, jamais nécessaire à la compréhension.
- **Sans animation :** carte et liste déjà composées; descriptions textuelles de chaque relation.

### Acte IV — AGIR

- **Message / texte affiché :** « Comprendre, puis décider quoi faire. » Sous-texte : « Explorez les modules, essayez un scénario fictif, consultez le code. »
- **Émotion :** maîtrise mesurée, confiance dans une méthode vérifiable.
- **Composition :** capture ou prototype représentatif de la console, trois entrées fonctionnelles illustrées, puis une bande claire de CTA. Toute capture utilise des données de démonstration préparées et contrôlées.
- **Mouvement / transition :** les lignes abstraites cèdent la place à des composants d'interface stables; aucune animation n'est nécessaire pour utiliser les CTA.
- **Interaction :** choisir un module, ouvrir la démo fictive, lire le dépôt ou les instructions d'installation. « Ouvrir ma console » n'apparaît que dans un contexte privé clairement identifié.
- **Preuve fonctionnelle :** routes et modules du dépôt, avec lien vers code/documentation; état de disponibilité explicite pour données dépendant d'un service externe.
- **CTA :** « Essayer la démo fictive », « Voir le code », « Installer CyberHub ».
- **Mobile :** un CTA principal puis deux liens secondaires, capture recadrée sans fausse interaction.
- **Sans animation :** passage par une coupure typographique; même ordre et mêmes liens.

## Trois preuves fonctionnelles à transformer en bénéfices

1. **IOC + corrélation** (`IOCPage.tsx`, `CorrelationPage.tsx`) : rapprocher des indicateurs et examiner des liens dans la console. Bénéfice éditorial : « retrouver pourquoi deux indices paraissent liés ». Ne pas prétendre à une détection autonome ou à une qualité de résultat mesurée.
2. **Investigations** (`InvestigationList.tsx`, `InvestigationDetail.tsx`) : regrouper des éléments dans une enquête et les retrouver. Bénéfice : « garder le fil d'une analyse ». Vérifier le parcours et le vocabulaire sur prototype avant publication.
3. **BGP + historique** (`BGPLookup.tsx`, `BGPHistorian.tsx`) : consulter des informations et un historique liés à BGP. Bénéfice : « replacer un signal réseau dans son contexte ». La fraîcheur dépend des sources; elle doit être affichée, jamais suggérée par une animation.

## Règles éditoriales et validation

- Chaque témoignage, métrique, capture et exemple doit avoir une provenance vérifiée; les fixtures publiques portent visiblement « données fictives ».
- Les CTA ne mélangent pas démo publique et console privée. Les textes publics ne contiennent ni token, ni détail d'un réseau domestique, ni donnée SQLite personnelle.
- Tester le récit auprès d'au moins un pair technique et un lecteur non spécialiste : peuvent-ils nommer une fonction réelle, une limite et la différence entre démo et console ?
- La signature, les textes finaux, les scènes visuelles et les captures demandent validation de l'auteur avant publication. Aucun élément de cette note ne clôt l'issue #4.
