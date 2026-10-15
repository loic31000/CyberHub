# Licences et attributions - état du dépôt au 15 octobre 2026

Ce document est un inventaire documentaire, pas un avis juridique ni un audit exhaustif de chaque dépendance. Il distingue le code CyberHub des données, fichiers, polices et services tiers.

## Licence du code original CyberHub : MIT confirmée

Le titulaire a expressément confirmé le choix de la **licence MIT pour le code original de CyberHub dont il détient les droits**, avec la mention `Copyright (c) 2026 loic31000`. Le texte standard figure dans le fichier [`LICENSE`](../LICENSE) à la racine du projet. Il a été ajouté sur `main` par la [PR #26](https://github.com/loic31000/CyberHub/pull/26), fusionnée le 12 octobre 2026.

Pour les copies ou parties substantielles du code original sous MIT, reproduire la notice de copyright et la permission MIT. Cette décision ne s'applique pas automatiquement à du code, des données, des polices, des images ou des fichiers provenant de tiers, ni à des contributions sur lesquelles le titulaire ne détient pas les droits requis. **Les obligations des éléments GPL et des autres ressources incorporées restent à vérifier pour toute redistribution d'une œuvre combinée ou d'un paquet logiciel.**

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
| [EPSS (FIRST)](https://www.first.org/epss/), [RIPE Stat](https://stat.ripe.net/) et Cloudflare DNS-over-HTTPS | Services/API utilisés (EPSS pour les CVE, RIPE Stat et DoH pour le module BGP) | Conditions propres aux fournisseurs non auditées ici. | Vérifier licences, ToS, attribution et limites de requêtes. |

Un simple lien dans le README ne suffit pas nécessairement à respecter les obligations liées à des fichiers redistribués.

## Polices, visuels et dépendances

- La Console 2026 embarque Manrope, DM Sans et DM Mono (sous-ensembles latins `woff2`) avec leurs textes de licence **SIL Open Font License 1.1** dans [`frontend/public/dashboard-2026/fonts/`](../frontend/public/dashboard-2026/fonts/). Vérifier que ces textes accompagnent les polices dans toute distribution (ils sont copiés dans le build Vite).
- Le globe du Dashboard utilise les contours Natural Earth 1:110m (domaine public selon ses conditions d'utilisation) ; source, date de téléchargement et empreinte SHA-256 sont consignées dans [`frontend/src/dashboard2026/geography/README.md`](../frontend/src/dashboard2026/geography/README.md). Les autres illustrations, screenshots et fichiers SVG ont des sources et conditions qui doivent être inventoriées dans chaque artefact de livraison. La présence de fichiers `README` ou `LICENSE` locaux ne couvre pas nécessairement tous les actifs.
- Les dépendances npm et Go disposent de leurs propres licences ; maintenir un inventaire à jour et produire les avis de tiers adaptés aux binaires/archives effectivement distribués.

## Vérifications à effectuer avant publication ou fusion des prototypes

1. **Licence du code original : décision MIT confirmée et fichier `LICENSE` présent sur `main`.** Vérifier le périmètre des droits, les éventuelles contributions tierces et l'inclusion correcte de la notice dans les distributions.
2. Vérifier les versions exactes des jeux de données embarqués, avec source, provenance, date, modifications et texte de licence/NOTICE applicable.
3. Analyser particulièrement la compatibilité des obligations GPL-2.0/GPL-3.0 des sources incorporées avec la forme de redistribution choisie. Ne pas conclure à une compatibilité juridique sans revue.
4. Relever les conditions d'utilisation des APIs et jeux de données actualisables (abuse.ch, NVD, CISA, EPSS, RIPE Stat, WhatsMyName, sources des mises à jour CLOAK et MITRE ATT&CK).
5. Tenir à jour les crédits des polices, données Natural Earth, visuels et autres actifs, notamment avant l'intégration de la landing au frontend principal et avant tout partage de distribution.
6. Confirmer le périmètre des travaux effectivement fusionnés dans `main` (Console 2026 via la PR #27 ; landing non intégrée) ; une branche expérimentale ne représente pas une fonctionnalité livrée.

**Statut : licence MIT du code original confirmée ; conformité des éléments tiers encore à vérifier.** Cette page ne prétend pas qu'une redistribution publique de tous les éléments est déjà autorisée ou conforme.
