# Licences et attributions - état du dépôt au 12 octobre 2026

Ce document est un inventaire documentaire, pas un avis juridique ni un audit exhaustif de chaque dépendance. Il distingue le code CyberHub des données, fichiers, polices et services tiers.

## Licence du code CyberHub : décision requise

À la date de cette revue, la branche `main` ne contient **aucun fichier `LICENSE` à la racine**. Un dépôt GitHub public ne signifie pas que son code est librement réutilisable, redistribuable ou modifiable sous une licence open source. Les crédits de tiers et les licences des dépendances n'accordent pas, à eux seuls, une licence générale au code CyberHub.

**Décision à prendre par le titulaire des droits :** choisir la licence du code original (ou confirmer un autre régime de diffusion) après avoir vérifié les droits et contributions, puis ajouter son texte officiel en `LICENSE`. Ne pas choisir une licence rétroactivement ou affirmer « MIT », « GPL » ou « Apache » sans décision expresse. Ne pas confondre la licence du code CyberHub avec celles des jeux de données incorporés.

## Sources intégrées ou citées

| Ressource | Emplacement / usage | Information officielle identifiée | Action avant diffusion |
| --- | --- | --- | --- |
| [CLOAK (Mick Deben)](https://github.com/Mickinthemiddle/CLOAK) | `frontend/public/data/cloak.json` | GNU GPL v2 déclaré par le projet. | Vérifier la version et l'origine du JSON embarqué ; conserver copyright, licence, source et notices exigées ; examiner les obligations de redistribution avec le mode d'intégration. |
| [LOLBAS](https://github.com/LOLBAS-Project/LOLBAS/blob/master/NOTICE.md) | `backend/internal/lolbins/lolbas.json` | **GPL-3.0**, selon le NOTICE officiel (et non CC BY-SA). | Vérifier les droits associés aux données copiées, leur version, et fournir les avis/licences nécessaires. |
| [GTFOBins](https://github.com/GTFOBins/GTFOBins.github.io) | `backend/internal/lolbins/gtfobins.json` | **GPL-3.0**, selon le dépôt officiel (et non CC BY-SA). | Vérifier la provenance, les licences applicables et les avis de redistribution. |
| [MITRE ATT&CK](https://attack.mitre.org/resources/terms-of-use/) | Données ATT&CK dans la Console | **Conditions d'utilisation propres à MITRE**, avec obligation de reproduire la désignation de copyright et la licence applicable dans les copies ; ne pas indiquer « Apache 2.0 » pour le contenu ATT&CK sans preuve spécifique. | Vérifier la reproduction de la notice actuelle et la présentation de la marque [MITRE ATT&CK](https://attack.mitre.org/resources/legal-and-branding/). |
| [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) | `backend/internal/cisa/kev.json` | Source gouvernementale américaine, conditions à vérifier pour l'artefact redistribué. | Documenter la source, la date de copie et les éventuelles notices attachées. |
| [WhatsMyName](https://github.com/WebBreacher/WhatsMyName) | `backend/internal/osint/wmn-data.json` | Licence du jeu de données exact et sa version non vérifiées ici. | Remonter à la source/version exacte ; conserver les crédits et conditions correspondants. |
| [Feodo Tracker](https://feodotracker.abuse.ch/about/) et [URLhaus](https://urlhaus.abuse.ch/about/) | Flux et API référencés par la Console | Conditions de service et usages autorisés par le fournisseur ; **CC0 non confirmé** dans cette revue. | Vérifier les ToS et règles d'usage avant redistribution des flux ou intégration commerciale. |
| [EPSS (FIRST)](https://www.first.org/epss/) et [BGPView](https://bgpview.io/) | Services/API utilisés | Conditions propres aux fournisseurs non auditées ici. | Vérifier licences, ToS, attribution et limites de requêtes. |

Un simple lien dans le README ne suffit pas nécessairement à respecter les obligations liées à des fichiers redistribués.

## Polices, visuels et dépendances

- Le prototype Dashboard conserve les licences locales de Manrope, DM Sans et DM Mono dans `frontend/prototypes/dashboard-2026/public/fonts/` sur sa branche dédiée. Vérifier que leurs textes accompagnent les polices lors d'une future intégration ou distribution.
- Les illustrations, screenshots, fichiers SVG et données géographiques (dont Natural Earth sur la branche Dashboard) ont des sources et conditions qui doivent être inventoriées dans chaque artefact de livraison. La présence de fichiers `README` ou `LICENSE` locaux ne couvre pas nécessairement tous les actifs.
- Les dépendances npm et Go disposent de leurs propres licences ; maintenir un inventaire à jour et produire les avis de tiers adaptés aux binaires/archives effectivement distribués.

## Vérifications à effectuer avant publication ou fusion des prototypes

1. Choisir explicitement la licence du code original de CyberHub et ajouter un `LICENSE` adéquat après validation du titulaire des droits.
2. Vérifier les versions exactes des jeux de données embarqués, avec source, provenance, date, modifications et texte de licence/NOTICE applicable.
3. Analyser particulièrement la compatibilité des obligations GPL-2.0/GPL-3.0 des sources incorporées avec la forme de redistribution choisie. Ne pas conclure à une compatibilité juridique sans revue.
4. Relever les conditions d'utilisation des APIs et jeux de données actualisables (abuse.ch, NVD, CISA, EPSS, BGPView, WhatsMyName).
5. Tenir à jour les crédits des polices, données Natural Earth et images avant déploiement du Showcase ou intégration du Dashboard.
6. Confirmer le périmètre des travaux effectivement fusionnés dans `main` ; une branche expérimentale ne représente pas une fonctionnalité livrée.

**Statut : points de conformité encore ouverts.** Cette page ne prétend pas qu'une redistribution publique de tous les éléments est déjà autorisée ou conforme.
