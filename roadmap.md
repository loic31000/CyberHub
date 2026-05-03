Tu as accès à mon terminal. Tu vas implémenter les nouvelles features CyberHub v1.0.
Lis d'abord TOUS les fichiers existants avant de toucher quoi que ce soit.

## ÉTAPE 1 — Lecture obligatoire avant tout

Lis ces fichiers :
- backend/internal/api/router.go
- backend/internal/models/ (tous)
- backend/internal/api/handlers/ (tous)
- backend/internal/mitre/ (seed MITRE)
- backend/internal/cloak/ (seed CLOAK)
- backend/main.go
- frontend/src/api/client.ts
- frontend/src/App.tsx
- frontend/src/components/ (Sidebar, Layout)
- frontend/src/pages/IOCManager.tsx
- frontend/src/pages/Parametres.tsx
- frontend/src/types/ (tous)

---

## FEATURE 1 — CISA KEV + EPSS sur les CVE

### 1.1 — Télécharger les fichiers de référence

```bash
# CISA Known Exploited Vulnerabilities
curl -L "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json" \
  -o backend/internal/cisa/kev.json

# Si curl échoue, créer un kev.json minimal avec 3 entrées réelles :
# CVE-2021-44228 (Log4Shell), CVE-2017-0144 (EternalBlue), CVE-2021-34527 (PrintNightmare)
```

### 1.2 — Modèles GORM (backend/internal/models/threat_intel.go)

```go
type CISAKEVEntry struct {
    gorm.Model
    CveID             string `gorm:"uniqueIndex"`
    VendorProject     string
    Product           string
    VulnerabilityName string
    DateAdded         string
    ShortDescription  string
    RequiredAction    string
    DueDate           string
    Notes             string
}

type EPSSScore struct {
    gorm.Model
    CveID      string  `gorm:"uniqueIndex"`
    Score      float64 // 0.0 à 1.0
    Percentile float64
    Date       string
    FetchedAt  time.Time
    ExpiresAt  time.Time // TTL 24h
}
```

Ajoute CISAKEVEntry et EPSSScore dans AutoMigrate.

### 1.3 — Seed CISA KEV (backend/internal/cisa/seed.go)

Embarque kev.json via go:embed :
```go
//go:embed kev.json
var kevDataRaw []byte
```

Fonction SeedKEV(db *gorm.DB) :
1. Si la table CISAKEVEntry contient déjà des données → skip (déjà seeded)
2. Parser kevDataRaw
3. Structure JSON CISA KEV : { "vulnerabilities": [ { "cveID", "vendorProject", "product", "vulnerabilityName", "dateAdded", "shortDescription", "requiredAction", "dueDate", "notes" } ] }
4. Insérer en batch (100 par batch)

Appelle SeedKEV dans main.go après les autres seeds.

### 1.4 — Handler CISA KEV (backend/internal/api/handlers/cisa.go)

CISAHandler struct avec db *gorm.DB.

Routes :
GET /api/cisa/kev/check/:cve_id
→ cherche dans CISAKEVEntry WHERE cve_id = :cve_id (insensible à la casse)
→ retourne { exploited: bool, entry: CISAKEVEntry | null }

GET /api/cisa/kev/stats
→ retourne { total_entries, last_updated }

POST /api/cisa/kev/update
→ re-télécharge https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json
→ timeout 30s
→ upsert toutes les entrées (INSERT OR REPLACE)
→ retourne { success, count, updated_at }

GET /api/epss/:cve_id
→ vérifie cache EPSSScore (ExpiresAt > now)
→ si miss : appelle https://api.first.org/data/v1/epss?cve={cve_id}
  réponse : { "data": [{ "cve": "CVE-...", "epss": "0.97", "percentile": "0.99" }] }
→ stocke en cache TTL 24h
→ retourne { cve_id, score, percentile, date }

### 1.5 — Modifier les handlers CVE existants

Dans le handler GET /api/cve/:id (ou équivalent, cherche dans handlers/) :
Avant de retourner la CVE, enrichir avec :
1. Lookup CISAKEVEntry WHERE cve_id = cve.cve_id → ajouter champ "kev_exploited": bool
2. Lookup EPSSScore cache → si présent, ajouter "epss_score": float64

Dans le handler GET /api/cve (liste) :
Ajouter champ "kev_exploited" sur chaque CVE (JOIN ou sous-requête SQLite)

### 1.6 — Frontend : enrichissement de la veille CVE

Dans frontend/src/types/ (fichier CVE existant) :
Ajoute à l'interface CVE :
```typescript
kev_exploited?: boolean
kev_entry?: {
  vendor_project: string
  product: string
  vulnerability_name: string
  date_added: string
  required_action: string
  due_date: string
}
epss_score?: number
epss_percentile?: number
```

Dans la page CVE existante (cherche dans src/pages/) :

Sur chaque CVE dans la liste :
- Si kev_exploited: true → badge rouge animé "🔥 CISA KEV" avec tooltip "Exploitée activement dans la nature"
- Afficher le score EPSS si présent : badge coloré selon le score
  ≥ 0.7 → bg-red-900 text-red-300 "EPSS: 0.97"
  0.3-0.7 → bg-orange-900 text-orange-300
  < 0.3 → bg-gray-700 text-gray-400

Dans le détail d'une CVE :
- Section "🔥 Exploitation active (CISA KEV)" si kev_exploited:
  Afficher : date_added, required_action, due_date, product
- Section "📊 EPSS Score" avec jauge visuelle et explication :
  "Cette CVE a X% de probabilité d'être exploitée dans les 30 prochains jours"

Dans la page Paramètres, section "Bases de données" :
Ajoute une card "CISA KEV" avec nb d'entrées, date, bouton "🔄 Mettre à jour"

---

## FEATURE 2 — LOLBAS + GTFOBins

### 2.1 — Télécharger les données

```bash
# LOLBAS (Windows)
curl -L "https://raw.githubusercontent.com/LOLBAS-Project/LOLBAS/master/bin/lolbas.json" \
  -o backend/internal/lolbins/lolbas.json

# GTFOBins (Linux) — le repo est en YAML, utilise le JSON converti
curl -L "https://gtfobins.github.io/gtfobins.json" \
  -o backend/internal/lolbins/gtfobins.json
```

Si curl échoue pour l'un ou l'autre, crée un fichier minimal avec 5 entrées réelles :
- LOLBAS minimal : certutil, mshta, regsvr32, wscript, rundll32
- GTFOBins minimal : bash, python3, find, vim, nmap

Format LOLBAS :
```json
[{
  "Name": "Certutil.exe",
  "Description": "...",
  "Commands": [{"Command": "...", "Description": "...", "Usecase": "...", "Category": "Download", "Privileges": "User", "MitreID": "T1105", "Tags": []}],
  "Full_Path": [{"Path": "C:\\Windows\\System32\\certutil.exe"}],
  "Code_Sample": [],
  "Detection": [{"IOC": "..."}],
  "Resources": [],
  "Acknowledgement": []
}]
```

Format GTFOBins :
```json
{
  "bash": {
    "functions": [
      {"type": "shell", "description": "...", "commands": "bash -p"}
    ]
  }
}
```

### 2.2 — Modèles GORM (backend/internal/models/lolbins.go)

```go
type LOLBin struct {
    gorm.Model
    Name        string `gorm:"index"`
    OS          string `gorm:"index"` // "windows" | "linux"
    Description string
    FullPath    string
    Commands    string // JSON sérialisé
    MitreTech   string // JSON array de technique IDs ["T1105", "T1059"]
    Tags        string // JSON array
    Category    string `gorm:"index"` // "Download" | "Execute" | "Bypass" | "Persistence" | ...
}
```

Ajoute LOLBin dans AutoMigrate.

Seed (backend/internal/lolbins/seed.go) :
- Embarque lolbas.json et gtfobins.json via go:embed
- Parse et seed la table LOLBin
- LOLBAS → OS = "windows"
- GTFOBins → OS = "linux", category = premier type de function

### 2.3 — Handler (backend/internal/api/handlers/lolbins.go)

Routes :
GET /api/lolbins
→ query params : ?os=windows|linux&category=&search=&mitre=T1105
→ retourne liste paginée (50 par page)

GET /api/lolbins/:name
→ détail complet d'un binaire avec toutes ses commandes

GET /api/lolbins/categories
→ liste des catégories distinctes par OS

GET /api/lolbins/mitre/:technique_id
→ tous les LOLBins liés à cette technique MITRE

### 2.4 — Enrichissement de la corrélation

Dans backend/internal/correlation/engine.go :
Ajoute une source "lolbins" à la corrélation IOC :
Si l'IOC est de type "hash" ou "domain" et que sa valeur correspond au nom d'un LOLBin
→ retourner les LOLBins associés dans les résultats de corrélation

### 2.5 — Page frontend (frontend/src/pages/LOLBinsPage.tsx)

Layout :

Header :
- Titre "LOLBins & GTFOBins" avec icône Terminal
- Tabs : "Windows (LOLBAS)" | "Linux (GTFOBins)"
- Compteur : "X binaires Windows · Y binaires Linux"

Barre de filtres :
- Input de recherche (nom ou description)
- Filtre catégorie (pills) : Download | Execute | Bypass | Persistence | Exfiltration | etc.
- Filtre MITRE : input technique ID (T1xxx)

Grille de cards (3 colonnes) :
Chaque card : nom du binaire en bold monospace, OS badge (bleu Windows / orange Linux),
catégorie en pill, nb de commandes, description courte

Clic sur une card → drawer latéral ou page dédiée :
- Nom + chemin complet (Windows) ou package
- Description
- Techniques MITRE liées (pills cliquables → navigate vers MITRE)
- Section "Commandes d'abus" :
  Chaque commande :
  - Description + use case
  - Bloc monospace bg-gray-900 text-green-400
  - Bouton "📋 Copier"
  - Badge privilège (User / Admin / root)
- Section "IOCs de détection" (si disponible dans LOLBAS)

Ajoute dans la Sidebar : "LOLBins" avec icône Terminal2, après Cheatsheets.
Ajoute dans App.tsx : route /lolbins → LOLBinsPage.

---

## FEATURE 3 — Import IOC en masse (CSV / TXT)

### 3.1 — Backend

Dans backend/internal/api/handlers/ioc.go (handler existant), ajoute :

POST /api/ioc/import
→ multipart/form-data avec champ "file" (CSV ou TXT)
→ body optionnel : { default_tlp: "white", default_status: "active", tags: [] }

Logique de parsing :

Format TXT (une valeur par ligne) :
- Détecter automatiquement le type via regex :
  IPv4 → ip
  IPv6 → ip
  CIDR /xx → cidr
  Hash MD5 (32 hex) → hash
  Hash SHA256 (64 hex) → hash
  Email → email
  URL (http/https) → url
  Domaine (reste) → domain

Format CSV (avec ou sans header) :
- Détecter si la première ligne est un header (contient "type", "value", "tlp", etc.)
- Si header : mapper les colonnes
- Si pas de header : colonne 1 = value (type auto-détecté), colonne 2 optionnelle = type, colonne 3 = description
- Colonnes reconnues : value/ioc/indicator, type, tlp, status, description, tags, source

Traitement :
- Déduplique par valeur (ignore les doublons en DB ET dans le fichier)
- Batch insert par 100
- Retourner { imported: int, skipped_duplicates: int, skipped_invalid: int, errors: []string }
- Limite : 10 000 IOCs max par import

### 3.2 — Frontend (IOCManager.tsx)

Ajoute un bouton "📂 Import CSV/TXT" dans la toolbar de l'IOC Manager.
Clic → ouvre un modal :

Modal ImportIOCModal.tsx :
- Zone de drop (drag & drop) + bouton "Parcourir" → accept=".csv,.txt"
- Aperçu après sélection du fichier :
  "X lignes détectées — aperçu des 5 premières :"
  Tableau : valeur | type détecté | statut
- Sélecteurs : TLP par défaut, statut par défaut
- Bouton "🚀 Importer" → POST /api/ioc/import
- Barre de progression (simulée — le backend retourne tout d'un coup)
- Résultat : "✅ X IOCs importés · X doublons ignorés · X invalides"
- Bouton "Fermer et rafraîchir"

Types TypeScript :
```typescript
interface ImportResult {
  imported: number
  skipped_duplicates: number
  skipped_invalid: number
  errors: string[]
}
```

Dans client.ts :
iocImport(file: File, defaultTlp: string, defaultStatus: string) → POST /api/ioc/import

---

## FEATURE 4 — Feodo Tracker + URLhaus sync auto

### 4.1 — Backend (backend/internal/api/handlers/threat_feeds.go)

Struct ThreatFeedSync GORM (models/threat_intel.go, même fichier que CISA KEV) :
```go
type ThreatFeedSync struct {
    gorm.Model
    FeedName    string `gorm:"uniqueIndex"` // "feodo" | "urlhaus"
    LastSync    time.Time
    ItemCount   int
    NewItems    int // lors de la dernière sync
}
```

Ajoute ThreatFeedSync dans AutoMigrate.

Routes :
GET /api/threat-feeds/status
→ retourne le statut des 2 feeds : { feodo: ThreatFeedSync, urlhaus: ThreatFeedSync }

POST /api/threat-feeds/sync/feodo
→ Télécharge https://feodotracker.abuse.ch/downloads/ipblocklist.json
  Structure : { "timestamp": "...", "blocklist": [{ "ip_address", "port", "status", "hostname", "as_number", "as_name", "country", "first_seen", "last_online", "malware" }] }
→ Timeout 30s
→ Pour chaque IP :
  - Vérifie si un IOC avec value = ip_address existe déjà → skip si oui
  - Crée un IOC : type=ip, value=ip_address, tlp=amber, status=active
    description = "C2 {malware} — AS{as_number} ({as_name}) · {country}"
    source = "Feodo Tracker"
    tags = ["C2", malware, "feodo-tracker"]
→ Met à jour ThreatFeedSync
→ Retourne { new_iocs, skipped_duplicates, total_in_feed }

POST /api/threat-feeds/sync/urlhaus
→ Télécharge https://urlhaus-api.abuse.ch/v1/urls/recent/
  Structure : { "urls": [{ "url", "url_status", "date_added", "threat", "tags", "urlhaus_reference" }] }
→ Timeout 30s
→ Filtre : uniquement url_status = "online"
→ Pour chaque URL :
  - Vérifie doublon par value
  - Crée IOC : type=url, value=url, tlp=red, status=active
    description = "{threat} — URLhaus"
    tags = tags de URLhaus + ["urlhaus", "malware-distribution"]
→ Met à jour ThreatFeedSync
→ Retourne { new_iocs, skipped_duplicates, total_online }

### 4.2 — Frontend (Parametres.tsx)

Dans la section "Bases de données", ajoute une nouvelle sous-section "📡 Threat Feeds" :

Card Feodo Tracker :
- Icône Wifi, titre "Feodo Tracker (IPs C2)"
- Description : "IPs de serveurs C2 actifs (Cobalt Strike, Emotet, QakBot…)"
- Dernière sync + nb d'IOCs ajoutés lors de la dernière sync
- Bouton "🔄 Synchroniser" → POST /api/threat-feeds/sync/feodo
- Spinner + résultat "✅ X nouveaux IOCs C2 importés"

Card URLhaus :
- Icône Globe, titre "URLhaus (URLs malveillantes)"
- Description : "URLs de distribution de malware actives"
- Même UI que Feodo
- Bouton → POST /api/threat-feeds/sync/urlhaus

---

## ÉTAPE 2 — Modifier router.go

Ajoute dans la section protégée par auth middleware :
- Groupe /api/cisa avec toutes ses routes
- GET /api/epss/:cve_id
- Groupe /api/lolbins avec toutes ses routes
- POST /api/ioc/import (dans le groupe /api/ioc existant)
- Groupe /api/threat-feeds avec toutes ses routes

Instancie les nouveaux handlers et passe la db.

---

## ÉTAPE 3 — Modifier App.tsx

Ajoute route :
- /lolbins → LOLBinsPage

---

## ÉTAPE 4 — Modifier Sidebar

Ajoute dans le bon ordre :
- "LOLBins" avec icône Terminal2, chemin /lolbins, après Cheatsheets

---

## ÉTAPE 5 — Modifier main.go

Après les seeds existants, ajoute :
- cisa.SeedKEV(db)
- lolbins.SeedLOLBins(db)

---

## ÉTAPE 6 — Vérification complète

Lance :
```bash
cd backend && go build ./...
cd ../frontend && npx tsc --noEmit
```

Corrige TOUTES les erreurs avant de t'arrêter :
- Import Go manquant → ajoute-le
- Nom de colonne GORM incorrect → relis le modèle
- Erreur TypeScript → corrige l'interface ou l'import
- Missing route → ajoute dans router.go

---

## ÉTAPE 7 — Rapport final

Affiche :
"✅ CyberHub v1.0 — CISA KEV · EPSS · LOLBins/GTFOBins · Import IOC · Feodo/URLhaus"
Puis liste exacte : chemin complet | créé / modifié

---

## Contraintes absolues
- Zéro nouvelle dépendance Go ni npm
- TypeScript strict : zéro any, interfaces explicitement typées
- Ne t'arrête JAMAIS pour demander confirmation
- Si fichier introuvable : find . -name "*.go" | head -50
- Adapte tous les noms de tables/colonnes aux modèles GORM réellement lus à l'étape 1
- Tous les seeds vérifient si les données existent déjà avant d'insérer (idempotent)
- Les imports IOC (Feodo, URLhaus, bulk CSV) déduplicent toujours avant insertion
- La seed CISA KEV et LOLBins suit exactement le même pattern que les seeds MITRE/CLOAK existants