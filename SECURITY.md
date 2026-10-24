# Politique de sécurité

CyberHub est une application locale destinée à un usage personnel, de laboratoire et de formation. La Console n'est pas conçue pour être exposée directement sur Internet.

## Versions prises en charge

La branche `main` est la seule branche prise en charge pour les correctifs de sécurité. Les branches de prototype, d'archive et de développement ne reçoivent pas de correctifs de sécurité garantis.

## Signaler une vulnérabilité

Le canal préféré est **GitHub Private Vulnerability Reporting** dans l'onglet **Security** du dépôt.

- N'ouvrez pas d'issue publique contenant un exploit, un secret, un jeton, des données personnelles ou des instructions permettant d'exploiter immédiatement la vulnérabilité.
- Si le bouton privé « Report a vulnerability » n'est pas encore disponible, ouvrez au maximum une issue publique très succincte indiquant qu'un canal privé est nécessaire, sans détail exploitable.
- Indiquez dans le signalement privé : version ou SHA concerné, composant, prérequis, impact, étapes de reproduction minimales et proposition de correction si disponible.
- N'incluez jamais de vrais mots de passe, clés API, JWT, bases SQLite ou autres données privées dans un rapport.

Le projet est maintenu à titre personnel : aucun délai contractuel de réponse ou de correction n'est garanti. Les signalements reproductibles et suffisamment documentés seront priorisés selon leur impact.

## Périmètre prioritaire

Sont notamment considérés comme sensibles :

- authentification, sessions et autorisations ;
- exposition réseau involontaire du backend local ;
- CORS, en-têtes HTTP et routes protégées ;
- stockage et affichage des clés API et secrets locaux ;
- imports de fichiers et traitements de données non fiables ;
- injections, traversal, SSRF, XSS et exécution de commandes ;
- dépendances frontend, Go et GitHub Actions ;
- fuites de données SQLite, captures, fixtures ou journaux.

## Mesures du dépôt

Le dépôt utilise des contrôles automatisés (CI frontend/backend, CodeQL, Dependency Review et Dependabot). Ces contrôles réduisent le risque mais ne constituent pas un audit de sécurité ni une garantie d'absence de vulnérabilité.

Pour l'exploitation locale et les précautions SQLite/Docker, voir [DEVELOPMENT.md](DEVELOPMENT.md).