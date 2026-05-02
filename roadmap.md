Tu as accès à mon terminal. Tu vas implémenter le module "OSINT Runner" basé sur WhatsMyName natif Go, ainsi que les boutons de mise à jour des bases MITRE ATT&CK et CLOAK dans CyberHub. Tu écris tous les fichiers directement sur le disque sans t'arrêter.

## Contexte du projet
- Backend : Go 1.26+, Gin, GORM, SQLite, JWT — dossier backend/
- Frontend : React 18, TypeScript strict, Vite, Tailwind CSS, Lucide React, Axios — dossier frontend/
- Backend port 7743 | Frontend dev port 5173
- Aucune nouvelle dépendance Go ni npm autorisée

## ÉTAPE 1 — Lire les fichiers existants

Lis ces fichiers avant de toucher quoi que ce soit :
- backend/internal/api/router.go
- backend/internal/models/ (tous les fichiers)
- backend/internal/api/handlers/ (tous les fichiers)
- backend/internal/mitre/ (seed MITRE — comprends comment les données sont chargées)
- backend/internal/cloak/ (seed CLOAK — comprends comment concealment-data.json est embarqué)
- backend/main.go
- frontend/src/api/client.ts
- frontend/src/App.tsx
- frontend/src/components/ (tous les fichiers — Sidebar, Layout)
- frontend/src/pages/Parametres.tsx (pour y ajouter les boutons de mise à jour)

---

## FEATURE 1 — OSINT Runner (WhatsMyName natif Go)

### 1.1 — Télécharger wmn-data.json

Télécharge le fichier officiel WhatsMyName et place-le dans le projet :
```bash
curl -L "https://raw.githubusercontent.com/WebBreacher/WhatsMyName/main/wmn-data.json" \
  -o backend/internal/osint/wmn-data.json
```

Si curl échoue, essaie wget. Si les deux échouent, crée un wmn-data.json minimal avec 10 sites réels (GitHub, Twitter, Instagram, Reddit, YouTube, TikTok, Twitch, LinkedIn, Pinterest, Flickr) en respectant exactement le format WhatsMyName :
```json
{
  "sites": [
    {
      "name": "GitHub",
      "uri_check": "https://github.com/{username}",
      "e_string": "{username}",
      "m_string": "Not Found",
      "uri_pretty": "https://github.com/{username}",
      "category": "coding",
      "valid": true
    }
  ]
}
```

### 1.2 — Modèles GORM

Crée backend/internal/models/osint.go :

OSINTJob struct :
- ID uint (primary key)
- CreatedAt, UpdatedAt time.Time
- Username string
- Status string (pending | running | done | error)
- TotalSites int
- CheckedSites int
- FoundCount int
- FilterCategory string (vide = tous)
- Results string (JSON — tableau de OSINTResult)
- Duration int64 (millisecondes)
- LaunchedBy string (username JWT)

OSINTResult struct (pas GORM — uniquement pour sérialisation JSON) :
- SiteName string
- Category string
- URL string
- Status string (found | not_found | error | timeout)
- ResponseTime int64 (ms)

WMNMeta struct GORM :
- ID uint
- LastUpdated time.Time
- Version string
- SiteCount int

Ajoute OSINTJob et WMNMeta dans AutoMigrate.

### 1.3 — Moteur WhatsMyName (backend/internal/osint/engine.go)

Embarque wmn-data.json via go:embed :
```go
//go:embed wmn-data.json
var wmnDataRaw []byte
```

Struct WMNSite (mapping exact du JSON WhatsMyName) :
```go
type WMNSite struct {
    Name      string `json:"name"`
    URICheck  string `json:"uri_check"`
    EString   string `json:"e_string"`
    MString   string `json:"m_string"`
    URIPretty string `json:"uri_pretty"`
    Category  string `json:"category"`
    Valid     bool   `json:"valid"`
}
```

Struct WMNData :
```go
type WMNData struct {
    Sites []WMNSite `json:"sites"`
}
```

Struct OSINTEngine :
- db *gorm.DB
- data WMNData (chargé depuis wmnDataRaw ou depuis un fichier local overridé)
- dataPath string (chemin vers un wmn-data.json local overridé — pour les mises à jour)

Fonction NewOSINTEngine(db *gorm.DB, dataPath string) *OSINTEngine :
1. Si dataPath existe sur le disque → lire ce fichier (version mise à jour)
2. Sinon → utiliser wmnDataRaw (version embarquée)
3. Parser le JSON dans WMNData
4. Filtrer : garder uniquement les sites où Valid = true

Fonction GetCategories() []string : retourne la liste des catégories uniques triées.

Fonction GetSiteCount(category string) int.

Fonction CheckUsername(ctx context.Context, jobID uint, username string, category string, progressChan chan<- OSINTResult) error :
1. Filtrer les sites par category (si vide → tous les sites valides)
2. Créer un semaphore (channel) de 50 goroutines max
3. Pour chaque site, lancer une goroutine :
   a. Acquérir le semaphore
   b. Remplacer {username} dans URICheck par le username
   c. Faire un GET HTTP avec timeout 8 secondes, User-Agent "Mozilla/5.0 (compatible; CyberHub OSINT)"
   d. Lire le body (max 500KB — io.LimitReader)
   e. Si EString trouvé dans body ET MString absent → Status = "found"
   f. Si MString trouvé OU status 404 → Status = "not_found"
   g. Sinon → Status = "error"
   h. Envoyer OSINTResult dans progressChan
   i. Libérer le semaphore
4. Attendre toutes les goroutines (sync.WaitGroup)
5. Fermer progressChan
6. Mettre à jour OSINTJob en DB (Status=done, Results=JSON, FoundCount, Duration)

Fonction UpdateDatabase(newDataPath string) error :
- Télécharge https://raw.githubusercontent.com/WebBreacher/WhatsMyName/main/wmn-data.json
- Timeout 30 secondes
- Valide que le JSON est parseable et contient au moins 100 sites
- Sauvegarde dans newDataPath
- Met à jour WMNMeta en DB (LastUpdated, SiteCount)
- Recharge engine.data

### 1.4 — Handler HTTP (backend/internal/api/handlers/osint.go)

OSINTHandler struct avec db *gorm.DB et engine *osint.OSINTEngine.

Routes :

GET /api/osint/meta
→ retourne WMNMeta (dernière mise à jour, nb de sites) + liste des catégories disponibles

POST /api/osint/update-db
→ appelle engine.UpdateDatabase(dataPath)
→ retourne { success, site_count, updated_at }
→ timeout de la requête HTTP : 35 secondes (plus long que le download)

POST /api/osint/run
→ body { username: string, category: string }
→ valide username : alphanumérique + tirets/underscores, 1-50 chars, pas vide
→ crée OSINTJob en DB (Status=pending)
→ lance CheckUsername en goroutine avec progressChan
→ dans la goroutine : update job Status=running, met à jour CheckedSites au fur et à mesure
→ retourne immédiatement { job_id } (ne pas attendre la fin)

GET /api/osint/jobs
→ liste tous les OSINTJob triés par CreatedAt DESC, sans le champ Results (trop lourd)
→ retourne : id, username, status, total_sites, checked_sites, found_count, filter_category, duration, launched_by, created_at

GET /api/osint/jobs/:id
→ détail complet du job incluant Results (JSON parsé en tableau)

GET /api/osint/jobs/:id/stream
→ Server-Sent Events (SSE) — pas de WebSocket, pas de dépendance externe
→ Implémentation SSE :
  ```go
  c.Header("Content-Type", "text/event-stream")
  c.Header("Cache-Control", "no-cache")
  c.Header("Connection", "keep-alive")
  c.Header("X-Accel-Buffering", "no")
  ```
→ Toutes les 500ms : lire le job en DB, envoyer { checked_sites, total_sites, found_count, status, latest_results: [5 derniers résultats "found"] }
→ Format SSE : "data: {JSON}\n\n"
→ Fermer quand status = done | error OU client déconnecté (ctx.Done())

DELETE /api/osint/jobs/:id
→ supprime le job

GET /api/osint/jobs/:id/export-ioc
→ lit les Results du job, filtre Status="found"
→ retourne la liste des URLs trouvées formatées pour import IOC (type=url, value=url, description="OSINT: {sitename}")

POST /api/osint/jobs/:id/import-ioc
→ même logique mais crée réellement les IOCs en DB (utilise le modèle IOC existant)
→ déduplique par valeur avant insertion

### 1.5 — Modifier router.go

Dans la section protégée par auth middleware, ajoute le groupe /api/osint :
- GET    /meta
- POST   /update-db
- POST   /run
- GET    /jobs
- GET    /jobs/:id
- GET    /jobs/:id/stream
- DELETE /jobs/:id
- GET    /jobs/:id/export-ioc
- POST   /jobs/:id/import-ioc

Instancie OSINTEngine une seule fois :
```go
// Chemin pour le fichier mis à jour (hors binaire)
wmnPath := filepath.Join(dataDir, "wmn-data.json")
osintEngine := osint.NewOSINTEngine(db, wmnPath)
```
où dataDir est le dossier où cyber-hub.db est déjà stocké (cherche ce chemin dans main.go).

---

## FEATURE 2 — Boutons de mise à jour MITRE, CLOAK et WMN dans Paramètres

### 2.1 — Backend : routes de mise à jour MITRE et CLOAK

Cherche dans backend/internal/mitre/ comment le seed MITRE fonctionne.
Cherche dans backend/internal/cloak/ comment le seed CLOAK fonctionne.

Dans backend/internal/api/handlers/settings.go (crée-le s'il n'existe pas, ou ajoute aux handlers Paramètres existants) :

POST /api/settings/update-mitre
→ Re-télécharge le fichier STIX 2.0 officiel MITRE ATT&CK Enterprise depuis :
  https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json
→ Timeout 60 secondes (fichier lourd ~50MB)
→ Parse et re-seed la table MITRE en DB (même logique que le seed initial — réutilise les fonctions existantes)
→ Retourne { success, technique_count, updated_at }

POST /api/settings/update-cloak
→ Re-télécharge concealment-data.json depuis :
  https://raw.githubusercontent.com/mickdeben/concealment/main/concealment-data.json
→ Timeout 30 secondes
→ Re-seed la table CLOAK en DB (même logique que le seed initial)
→ Retourne { success, technique_count, updated_at }

GET /api/settings/db-versions
→ Retourne les métadonnées des 3 bases :
  - MITRE : { technique_count, last_updated } (depuis la DB)
  - CLOAK : { technique_count, last_updated }
  - WMN : { site_count, last_updated } (depuis WMNMeta)

Ajoute ces routes dans router.go dans le groupe /api/settings (crée-le s'il n'existe pas).

### 2.2 — Frontend : page Paramètres enrichie

Dans frontend/src/pages/Parametres.tsx, ajoute une section "Bases de données" :

Section "🗄️ Bases de données" avec 3 cards côte à côte :

Card MITRE ATT&CK :
- Icône Shield, titre "MITRE ATT&CK Enterprise"
- Affiche : nb de techniques, dernière mise à jour (fetch GET /api/settings/db-versions)
- Bouton "🔄 Mettre à jour" → POST /api/settings/update-mitre
- Pendant la mise à jour : spinner + "Téléchargement en cours... (~50MB)"
- Succès : toast vert "MITRE mis à jour — X techniques"
- Erreur : toast rouge avec message

Card CLOAK OpSec :
- Icône EyeOff, titre "CLOAK OpSec"
- Affiche : nb de sous-techniques, dernière mise à jour
- Bouton "🔄 Mettre à jour" → POST /api/settings/update-cloak
- Même feedback spinner/toast

Card WhatsMyName :
- Icône Search, titre "WhatsMyName Database"
- Affiche : nb de sites, dernière mise à jour
- Bouton "🔄 Mettre à jour" → POST /api/osint/update-db
- Pendant la mise à jour : spinner + "Téléchargement wmn-data.json..."
- Succès : toast vert "Base mise à jour — X sites"
- Erreur : toast rouge

Toutes les cards : bg-gray-800 border border-gray-700 rounded-xl p-5, bouton désactivé pendant le chargement, design cohérent avec le reste de l'app.

---

## FEATURE 3 — Page OSINT Runner (frontend/src/pages/OSINTRunner.tsx)

### Types (frontend/src/types/osint.ts)

```typescript
interface WMNMeta {
  last_updated: string
  site_count: number
  categories: string[]
}

interface OSINTJobSummary {
  id: number
  username: string
  status: 'pending' | 'running' | 'done' | 'error'
  total_sites: number
  checked_sites: number
  found_count: number
  filter_category: string
  duration: number
  launched_by: string
  created_at: string
}

interface OSINTResult {
  site_name: string
  category: string
  url: string
  status: 'found' | 'not_found' | 'error' | 'timeout'
  response_time: number
}

interface OSINTJobDetail extends OSINTJobSummary {
  results: OSINTResult[]
}

interface SSEProgress {
  checked_sites: number
  total_sites: number
  found_count: number
  status: string
  latest_results: OSINTResult[]
}
```

### API client (dans client.ts)

Ajoute :
- osintGetMeta() → GET /api/osint/meta
- osintRun(username, category) → POST /api/osint/run
- osintGetJobs() → GET /api/osint/jobs
- osintGetJob(id) → GET /api/osint/jobs/:id
- osintDeleteJob(id) → DELETE /api/osint/jobs/:id
- osintImportIOC(id) → POST /api/osint/jobs/:id/import-ioc

### UI OSINTRunner.tsx

Section 1 — Configuration du scan :

Header :
- Titre "OSINT Runner" avec icône Search
- Sous-titre "Username lookup sur X sites via WhatsMyName"
- Badge "X sites · Mis à jour le [date]" (depuis osintGetMeta)

Formulaire :
- Input username : large, placeholder "Nom d'utilisateur à rechercher", validation regex (alphanumérique + tirets + underscores)
- Sélecteur de catégorie : "Tous les sites" + liste des catégories depuis meta.categories
  Style : pills sélectionnables (une seule à la fois), bg-gray-700 hover:bg-cyan-600, cyan si sélectionnée
- Bouton "🚀 Lancer le scan" : bg-cyan-600, pleine largeur, désactivé si username vide ou scan en cours

Section 2 — Progression en temps réel (visible uniquement si job actif) :

Barre de progression :
- Barre animée : X / Y sites vérifiés (pourcentage calculé)
- Compteur "X profils trouvés" en vert
- Badge de statut animé avec spinner si running
- Chronomètre en temps réel

Flux SSE :
- Connecte EventSource à /api/osint/jobs/:id/stream
- À chaque message SSE : met à jour la barre + les latest_results
- Liste des derniers hits "found" en temps réel :
  Chaque hit : icône ExternalLink cyan, nom du site, catégorie en badge, URL cliquable (target="_blank")
  Animation d'apparition (transition opacity 0→1) pour chaque nouveau hit

Section 3 — Résultats finaux (visible quand status = done) :

Stats résumées : X trouvés / Y vérifiés / Z erreurs / durée

Filtres : Tous | Trouvés | Erreurs (pills)

Tableau des résultats "found" :
- Colonnes : Site, Catégorie, URL, Temps de réponse
- URL cliquable avec icône ExternalLink
- Catégorie en badge coloré par type :
  coding → bg-blue-900, social → bg-purple-900, gaming → bg-green-900, dating → bg-red-900, autres → bg-gray-700

Actions :
- Bouton "📥 Importer tous les profils en IOC" → osintImportIOC(job.id) → toast succès/erreur
- Bouton "📋 Copier toutes les URLs" → clipboard

Section 4 — Historique :

Tableau des jobs passés :
- Username, catégorie, nb trouvés / total, durée, date
- Badge statut coloré
- Bouton "👁️ Revoir" → recharge les résultats dans la section 3
- Bouton "🗑️" → osintDeleteJob(id) avec confirmation

---

## ÉTAPE 2 — Modifier App.tsx

Ajoute la route :
- /osint → OSINTRunner

---

## ÉTAPE 3 — Modifier Sidebar

Ajoute "OSINT Runner" avec icône Search de lucide-react, chemin /osint, positionné après IOC Manager.

---

## ÉTAPE 4 — Vérification complète

Lance ces commandes et corrige TOUTES les erreurs :
```bash
cd backend && go build ./...
cd ../frontend && npx tsc --noEmit
```

Corrige chaque erreur une par une :
- Nom de colonne GORM incorrect → relis le modèle
- Import Go manquant → ajoute-le
- Erreur TypeScript → corrige l'interface ou l'import
Ne t'arrête pas tant que les deux commandes passent proprement.

---

## ÉTAPE 5 — Rapport final

Affiche uniquement :
"✅ CyberHub v0.9 — OSINT Runner + Mises à jour DB"
Puis la liste exacte fichier par fichier : chemin complet | créé ou modifié.

---

## Contraintes absolues
- Zéro nouvelle dépendance Go ni npm
- TypeScript strict : zéro any, toutes les interfaces explicitement typées
- SSE uniquement (pas WebSocket, pas gorilla) — http.Flusher natif Go
- Ne t'arrête JAMAIS pour demander confirmation
- Si un fichier est introuvable, utilise find . -name "*.go" | head -50 pour explorer
- Adapte tous les noms de tables/colonnes aux modèles GORM réellement lus à l'étape 1
- Le moteur OSINTEngine est un singleton instancié une seule fois dans router.go ou main.go
- Les routes de mise à jour MITRE et CLOAK réutilisent les fonctions de seed existantes — ne les réécris pas
- wmn-data.json est d'abord téléchargé via curl/wget à l'étape 1.1, go:embed en est la source de fallback