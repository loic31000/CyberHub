# CHANGELOG — Cyber-Hub

---

## v1.1 — Code splitting · Tests backend · Dashboard v3

- **Code splitting React** — tous les 28 composants page migrés de `import` statiques vers `React.lazy()` + `<Suspense fallback={<Loader />}>` dans `App.tsx`. Nouveau composant `Loader.tsx`. Réduit significativement le bundle initial : chaque page est chargée à la demande, les chunks sont isolés par Vite.
- **Suite de tests backend** — nouveau fichier `backend/internal/api/handlers/ioc_notes_test.go` : 13 cas table-driven (Go testing + Gin test mode) couvrant `CreateIOC` (validation type, TLP, statut, JSON malformé) et `NotesHandler` (création avec titre, contenu, tags, IOCs liés). Base SQLite in-memory initialisée via `TestMain` + `store.InitDB(":memory:")`.
- **Dashboard v3** — refonte structurelle du tableau de bord : 12 modules tactiques (ajout Investigations, BGP Historian, Notes Ops, Cheatsheets, Encoder/Decoder, RevShell Generator), layout 3 colonnes (`lg:grid-cols-3`), bloc Threat Monitor avec alertes BGP en temps réel.

---

## v1.0 — CISA KEV · EPSS · LOLBins/GTFOBins · Import IOC · Threat Feeds

- **CISA KEV** — synchronisation du catalogue officiel des vulnérabilités exploitées activement : badge 🔥 animé dans la liste CVE, section dédiée dans `CVEDetail` (vendor, produit, date d'ajout, action requise, date limite de remédiation) · mise à jour depuis les Paramètres
- **EPSS** (FIRST.org) — score de probabilité d'exploitation à 30 jours avec jauge colorée et percentile dans `CVEDetail` · requête API v3 par CVE ID
- **LOLBins & GTFOBins** — base locale de 232 binaires Windows (LOLBAS) + 15+ Linux (GTFOBins) · seed SQLite avec `lolbas.json` et `gtfobins.json` · idempotence par OS · handler `LOLBinsHandler` (List, GetByName, GetCategories, GetByMitre) · DTO explicite `LOLBinDTO` avec `json:"id"` (fix bug gorm.Model serialisation)
- **Drawer LOLBins** — bug de clic corrigé (`item.id` était `undefined` car `gorm.Model.ID` sérialisé `"ID"`) · `parseCommandCount` utilisé dans l'API response
- **Import IOC en masse** — modal drag & drop CSV/TXT · détection automatique du type (IP, domaine, hash MD5/SHA256, URL, email, CIDR) · aperçu 5 lignes · déduplication · TLP/statut configurables avant import
- **Threat Feeds** — synchronisation Feodo Tracker (IPs C2 Cobalt Strike/Emotet/QakBot/Pikabot) et URLhaus (URLs malveillantes) depuis les Paramètres · TLP automatique (Red / Amber) · déduplication avant insertion
- **Corrélation — LOLBins** — 6e goroutine dans le moteur de corrélation : matching IOC hash/domaine contre la table `lol_bins` · section LOLBins dans `CorrelationPanel`
- **Corrélation — moteur enrichi** — 9 goroutines · validation stricte IOC (IPv4, CIDR, domaine, hash, URL, email) · signal gating CVE/playbooks · confiance + rationale + actions · Investigations, ATT&CK Layers, Notes · IOC Manager UX v1.0 : table 7 cols + panneau 3 cartes (2026-05-10)
- **Backend** — nouveaux modèles : `LOLBin`, mise à jour `CorrelationResult` avec `LOLBins []CorrelationLOLBin` · routes `/api/lolbins/...`
- **Frontend** — `LOLBinsPage.tsx` · `types/lolbins.ts` · `types/threat_intel.ts` · `CorrelationPanel` section LOLBins
- **Notes** — import/export local JSON / Markdown / TXT / HTML · confirmation avant import multiple · boutons IMPORT / EXPORT dans le header
- **Cheatsheets** — enrichissement : 35+ outils (bash, wget, jq, curl, nuclei, git, docker, powershell, cmd, hashcat, openssl, msfvenom, responder, impacket, amass, shodan-cli, netcat, tcpdump) · 6 nouvelles catégories (Linux, Windows, Web, DevOps, Pentest, Hash / Encodage) · ~230 commandes

---

## v0.9 — Hash Analysis 4 sources · IOC Manager bulk · VirusTotal

- **Analyse Hash multi-sources** — 4 goroutines parallèles : VirusTotal, MalwareBazaar (form-encoded), ThreatFox, URLhaus · cache 6h/1h
- **VirusTotal** — clé API stockée dans `app_settings` (SQLite) · masquage `VT-XXXX****YYYY` · section dédiée dans Paramètres (`/settings?section=virustotal`) · routes `GET/POST/DELETE /api/settings/virustotal`
- **HashAnalysisPanel** — composant React intégré dans l'onglet "Analyse Hash" de l'IOC Manager : score de détection, barre de progression, tableau des moteurs paginé (20/page), tags, cartes MB/TF/URLhaus, bouton "Forcer MAJ" (DELETE cache + refresh)
- **IOC Manager — sélection groupée** — cases à cocher par ligne · select-all avec état indéterminé · barre d'actions rouge · suppression groupée asynchrone avec toast de résultat
- **OSINT Runner** — correction du bug de timeout : `context.Background()` passé aux goroutines au lieu de `c.Request.Context()` (annulé à la fin de la requête HTTP) · remplacement d'EventSource par polling axios toutes les secondes (fix auth SSE/JWT)
- **Backend** — nouveau modèle `AppSetting` (clé/valeur, index unique) · route `DELETE /api/hash/cache/:hash` · invalidation automatique du cache stale (format ancien sans champ `Sources`)
- **Frontend** — `types/hash.ts` entièrement réécrit (`HashAnalysisResponse`, `HashSourceResult`, `VTStats`, `VTEngineResult`, `VirusTotalData`, `MalwareBazaarData`, `ThreatFoxData`, `URLhausData`, `VTConfig`) · `hashApi` étendu (`deleteCache`, `vtGetConfig`, `vtSaveKey`, `vtDeleteKey`)

---

## v0.8 — OSINT Runner · Notes · Cheatsheets · Corrélation

- **Nouveau module OSINT Runner** — exécution locale avec wmn-data.json, stream de progression, extraction d'IOCs, import direct IOC Manager
- **Notes d'investigation** — éditeur opérationnel avec liens vers IOCs, MITRE, CVE, recherche fulltext
- **Cheatsheets interactives** — 16+ outils, commandes paramétrables, variables dynamiques, copie en un clic
- **Corrélation IOC** — moteur de corrélation inter-IOCs, historique, cache
- **Dashboard v2** — widgets BGP Alerts, IOCs récents, corrélations récentes, notes récentes

---

## v0.7 — BGP / AS Lookup + Historian

- **Nouveau module BGP Lookup** — proxy BGPView, 3 modes (ASN / IP / recherche), onglets lazy-loaded, pagination, export IOC
- **Nouveau module BGP Historian** — snapshots parallèles (5 goroutines, `sync.WaitGroup`), diff visuel (préfixes/peers ajoutés ou supprimés), alertes automatiques sur changements de routage, badge sidebar
- **IOC Manager** — ajout du type `cidr` pour les préfixes réseau
- **Backend** — 3 nouveaux modèles SQLite (`BGPCache`, `BGPSnapshot`, `BGPAlert`), 13 routes `/api/bgp/...`
- **Frontend** — `BGPLookup.tsx`, `BGPHistorian.tsx`, `types/bgp.ts`, `types/threat.ts`, `store/useToastStore.ts`
- **client.ts** — ajout de `bgpApi`, `cloakAnnotationsApi`, `threatApi`

---

## v0.6

- IOC Manager (IP, domaine, hash, URL, email · TLP · export CSV)
- CLOAK OpSec (720 sous-techniques · 13 tactiques · annotations utilisateur)
- MITRE ATT&CK Enterprise (823 techniques · 14 tactiques · offline)
- Playbooks interactifs (19 procédures de réponse à incident)
- Veille CVE + import NVD JSON 2.0 + import NVD en ligne paginé (clé API NVD optionnelle)
- Dashboard avec KPIs et graphiques (writeups par plateforme, CVE par sévérité, top outils)
