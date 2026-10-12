# CyberHub

**Version de la Console documentée sur `main` : v1.1.**

> Hub de ressources cybersécurité local ; certains imports et flux demandent Internet.

![Go](https://img.shields.io/badge/Go-1.27.2+-00ADD8?logo=go&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![SQLite](https://img.shields.io/badge/SQLite-DB-003B57?logo=sqlite&logoColor=white)
![CLOAK](https://img.shields.io/badge/CLOAK-OpSec_TTPs--GPL_v2-6B21A8)

Application de bureau pour centraliser outils, writeups CTF, veille CVE, playbooks de réponse à incident, gestion d'IOC, analyse BGP/AS, OSINT et investigation. Inclut **[CLOAK OpSec](https://github.com/mickdeben/concealment)** (Mick Deben, Leiden University - GPL v2), les bases [LOLBAS](https://lolbas-project.github.io/) et [GTFOBins](https://gtfobins.github.io/), ainsi que les flux [Feodo Tracker](https://feodotracker.abuse.ch/) et [URLhaus](https://urlhaus.abuse.ch/) (abuse.ch).

---

## État du projet au 12 octobre 2026

La branche `main` contient la Console existante (React, Go, SQLite) et son frontend de production. Deux chantiers graphiques 2026 sont actuellement **en branches séparées**, et ne sont **pas intégrés à la Console de `main`** :

| Chantier | Branche | Statut |
| --- | --- | --- |
| Landing page / Showcase 2026 | [`feat/cyberhub-2026-design`](https://github.com/loic31000/CyberHub/tree/feat/cyberhub-2026-design) | Prototype autonome de présentation, avec scènes et données fictives. |
| Dashboard / Terminal Overview 2026 | [`feat/console-2026-dashboard-prototype`](https://github.com/loic31000/CyberHub/tree/feat/console-2026-dashboard-prototype) | Prototype frontend indépendant, avec globe et animations de démonstration. |

**Intention d'intégration future :** ces deux branches servent de base à de futurs travaux vers `main`, **après revue, tests et décision de fusion**. Leur existence et leurs commits n'impliquent ni fusion automatique, ni mise en production, ni surveillance réseau réelle. La landing publique et la Console privée devront conserver une séparation explicite des données, des API et de l'authentification (voir [architecture](docs/cyberhub-2026/architecture.md)).

Documents de suivi : [feuille de route](docs/cyberhub-2026/implementation-roadmap.md), [développement local](DEVELOPMENT.md), [crédits/licences](docs/LICENSING.md).

---

## Modules

- **Dashboard** - KPIs visuels, graphiques (writeups, CVE par sévérité, top outils, IOCs récents, corrélations)
- **Outils** - 59 fiches techniques (offensif, défensif, OSINT, forensics, cloud, reverse engineering)
- **CTF Writeups** - Gestion par plateforme (TryHackMe, HackTheBox) · 8 writeups inclus
- **Veille CVE** - Base locale + import NVD JSON/API paginé · badge CISA KEV 🔥 · score EPSS (FIRST.org)
- **Playbooks** - 19 procédures de réponse à incident interactives (checklist step-by-step)
- **MITRE ATT&CK** - 823 techniques · 14 tactiques · format STIX 2.0 · 100% offline · **ATT&CK Layers** : création et visualisation de couches d'annotation par technique
- **CLOAK OpSec** - 720 sous-techniques · 13 tactiques · anonymat, dissimulation, OpSec · 100% offline
- **IOC Manager** - IP/domaine/hash/URL/email/CIDR · TLP · sélection groupée · import CSV/TXT en masse
- **Hash Analyzer** - VirusTotal · MalwareBazaar · ThreatFox · URLhaus · 4 sources parallèles · cache SQLite
- **BGP / AS Lookup** - Proxy BGPView · cache SQLite TTL 1h · fallback RIPE Stat · export IOC CIDR
- **BGP Historian** - Snapshots AS périodiques · diff visuel · alertes automatiques sur changements de routage
- **OSINT Runner** - Exécution locale WhatsMyName · extraction IOC · import direct
- **Notes** - Éditeur opérationnel · liens IOC/MITRE/CVE · recherche fulltext · import/export JSON/MD/TXT/HTML
- **Investigations** - Timeline d'investigation avec événements horodatés
- **Corrélation IOC** - Moteur 9 goroutines · matching CVE, playbooks, MITRE, LOLBins, BGP, threat feeds
- **LOLBins & GTFOBins** - 232 binaires Windows (LOLBAS) + 15+ Linux · filtres MITRE + catégorie · copie en un clic
- **Cheatsheets** - 35+ outils · commandes paramétrables · variables dynamiques · copie en un clic
- **Encoder / Decoder** - Base64 ↔ URL ↔ Hex ↔ ROT13 ↔ HTML entities · preview temps réel · 100% offline
- **Reverse Shell Generator** - Payloads pour 16 langages · encodage none/base64/url · listener netcat auto
- **Paramètres** - Backup SQLite · export/import JSON · clés API VirusTotal/NVD · sync CISA KEV + threat feeds

---

## Prérequis

- **Go** ≥ 1.27.2 - [golang.org/dl](https://golang.org/dl/)
- **Node.js** 24 + npm pour le build frontend local - [nodejs.org](https://nodejs.org/)

---

## Installation & Build

```bash
git clone https://github.com/loic31000/CyberHub.git
cd CyberHub
```

**Build Windows en une commande :**

```powershell
# Windows
.\build.ps1
```

> Le build React écrit directement dans `backend/web/`, puis `build.ps1` compile Go avec `CGO_ENABLED=0`.

**Build manuel :**

```bash
# 1. Frontend
cd frontend && npm ci && npm run build && cd ..

# 2. Backend
cd backend
CGO_ENABLED=0 go build -ldflags="-s -w" -o ../cyber-hub.exe .   # Windows
# CGO_ENABLED=0 go build -ldflags="-s -w" -o ../cyber-hub .     # Linux/macOS
```

> `CGO_ENABLED=0` est requis - le driver SQLite (`glebarez/sqlite`) est pur Go, sans dépendance C.

---

## Lancement

```bash
./cyber-hub.exe   # Windows
./cyber-hub       # Linux/macOS
```

L'application démarre sur **http://localhost:7743** et ouvre le navigateur automatiquement.

**Premier démarrage :** créer un compte local via le backend. Les données de référence se chargent au démarrage; MITRE ATT&CK peut nécessiter une connexion réseau. CLOAK est embarqué dans l'application.

---

## Développement

Pour utiliser le backend Docker existant et le hot reload Vite, suivre [le guide Windows Docker + Vite](DEVELOPMENT.md). Le frontend de développement est sur `http://localhost:5173`; le build embarqué est sur `http://localhost:7743`. Exécuter les commandes npm dans `frontend/` après installation des dépendances (`npm ci`). Depuis la racine, `npm run dev` ne correspond pas au serveur du frontend principal.

Les commandes propres aux prototypes 2026 sont décrites dans les README de leurs branches respectives, pas dans la version applicative de `main`.

```bash
# Vérification TypeScript
cd frontend && npx tsc --noEmit

# Formatage Go
cd backend && gofmt -w ./internal/...

# Lancer les tests backend (SQLite in-memory, pas de serveur requis)
cd backend && go test ./internal/api/handlers/...

# Réinitialiser le mot de passe (accès perdu)
cd backend && go run cmd/reset-auth/main.go
```

---

## Aperçu

### Dashboard
![Dashboard](./.github/screenshots/dashboard.png)

### IOC Manager
![IOC Manager](./.github/screenshots/iocmanager.png)

### CVE Watch + CISA KEV
![CVE](./.github/screenshots/cve.png)

### MITRE ATT&CK
![MITRE ATT&CK](./.github/screenshots/mitre.png)

---

## Crédits & sources open-source

| Source | Usage dans Cyber-Hub | Licence |
|--------|----------------------|---------|
| [CLOAK - Mick Deben, Leiden University](https://github.com/Mickinthemiddle/CLOAK) | Base CLOAK OpSec (720 sous-techniques · 13 tactiques) | GPL v2 |
| [LOLBAS Project](https://github.com/LOLBAS-Project/LOLBAS/blob/master/NOTICE.md) | Données LOLBins Windows (source intégrée) | **GPL-3.0** : provenance/version et notices à vérifier |
| [GTFOBins](https://github.com/GTFOBins/GTFOBins.github.io) | Données LOLBins Linux (source intégrée) | **GPL-3.0** : provenance/version et notices à vérifier |
| [MITRE ATT&CK](https://attack.mitre.org/resources/terms-of-use/) | Framework ATT&CK Enterprise | **Licence et termes MITRE spécifiques**, avec mention de copyright obligatoire pour les copies |
| [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) | Known Exploited Vulnerabilities (catalogue officiel) | Domaine public |
| [EPSS - FIRST.org](https://www.first.org/epss/) | Exploit Prediction Scoring System (API) | Conditions du fournisseur à vérifier |
| [Feodo Tracker - abuse.ch](https://feodotracker.abuse.ch/about/) | Flux d'indicateurs | Conditions de service à vérifier (CC0 non confirmé) |
| [URLhaus - abuse.ch](https://urlhaus.abuse.ch/about/) | Flux d'URLs | Conditions de service à vérifier (CC0 non confirmé) |
| [NVD - NIST](https://nvd.nist.gov/) | Base CVE (API v2 paginée) | Domaine public |
| [BGPView](https://bgpview.io/) | API BGP / ASN lookup | Conditions du fournisseur à vérifier |

---

## Sécurité

Bind sur `127.0.0.1` uniquement - aucun accès réseau externe. JWT HS256 · bcrypt · rate limit login 8 req/min · `X-Frame-Options: DENY` · `X-Content-Type-Options: nosniff` · aucun secret en dur (JWT secret et clés API stockés en DB).

---

## Changelog

→ [CHANGELOG.md](CHANGELOG.md)

---

## Licence & Avertissement

Cyber-Hub est destiné **exclusivement à un usage légal et éthique** : tests sur vos propres systèmes, environnements de lab, CTF, formation. L'utilisation sur des systèmes sans autorisation explicite est illégale.

**Aucune licence générale du code CyberHub n'est actuellement publiée à la racine de `main`.** Le caractère public du dépôt ne constitue pas une permission de réutilisation ou de redistribution de son code. Le choix d'une licence propre au projet nécessite la décision explicite du titulaire des droits.

Des données tierces sont incorporées, notamment CLOAK (GPL v2), LOLBAS et GTFOBins (GPL-3.0) ; leurs obligations de licence et d'attribution doivent être étudiées avant redistribution. Les conditions MITRE ATT&CK sont spécifiques. Voir l'[inventaire de licences et travaux de conformité restant à réaliser](docs/LICENSING.md).

---

*Documentation revue le 12/10/2026. Version applicative de `main` : v1.1 ; prototypes 2026 encore en branches distinctes.*
