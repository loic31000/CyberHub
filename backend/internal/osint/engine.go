// Package osint implémente un moteur WhatsMyName natif Go.
// ⚠️ Usage légal uniquement — vérification de username sur systèmes autorisés.
package osint

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"gorm.io/gorm"

	_ "embed"
)

//go:embed wmn-data.json
var wmnDataRaw []byte

// WMNSite représente un site WhatsMyName (format réel du JSON).
type WMNSite struct {
	Name     string `json:"name"`
	URICheck string `json:"uri_check"`
	ECode    int    `json:"e_code"`    // code HTTP attendu si trouvé
	EString  string `json:"e_string"`  // chaîne dans le body si trouvé
	MString  string `json:"m_string"`  // chaîne dans le body si absent
	MCode    int    `json:"m_code"`    // code HTTP si absent
	Category string `json:"cat"`
}

// WMNData est la structure racine du JSON WhatsMyName.
type WMNData struct {
	Sites []WMNSite `json:"sites"`
}

// OSINTEngine gère le moteur de lookup WhatsMyName.
type OSINTEngine struct {
	db       *gorm.DB
	data     WMNData
	dataPath string // chemin vers un wmn-data.json local mis à jour
	mu       sync.RWMutex
}

// NewOSINTEngine crée et initialise le moteur.
// Si dataPath existe sur disque → utilise cette version mise à jour.
// Sinon → utilise wmnDataRaw (version embarquée).
func NewOSINTEngine(db *gorm.DB, dataPath string) *OSINTEngine {
	e := &OSINTEngine{
		db:       db,
		dataPath: dataPath,
	}
	e.loadData()
	return e
}

// loadData charge les données WMN depuis le fichier local ou l'embed.
func (e *OSINTEngine) loadData() {
	var raw []byte
	if _, err := os.Stat(e.dataPath); err == nil {
		if data, err := os.ReadFile(e.dataPath); err == nil {
			raw = data
		}
	}
	if raw == nil {
		raw = wmnDataRaw
	}

	var d WMNData
	if err := json.Unmarshal(raw, &d); err != nil {
		// Fallback silencieux sur l'embed
		_ = json.Unmarshal(wmnDataRaw, &d)
	}
	// Exclure les sites archivés
	filtered := d.Sites[:0]
	for _, s := range d.Sites {
		if s.Category != "archived" {
			filtered = append(filtered, s)
		}
	}
	d.Sites = filtered

	e.mu.Lock()
	e.data = d
	e.mu.Unlock()
}

// GetCategories retourne la liste des catégories uniques triées.
func (e *OSINTEngine) GetCategories() []string {
	e.mu.RLock()
	defer e.mu.RUnlock()
	seen := map[string]struct{}{}
	for _, s := range e.data.Sites {
		if s.Category != "" {
			seen[s.Category] = struct{}{}
		}
	}
	cats := make([]string, 0, len(seen))
	for c := range seen {
		cats = append(cats, c)
	}
	sort.Strings(cats)
	return cats
}

// GetSiteCount retourne le nombre de sites (filtrés par catégorie si précisé).
func (e *OSINTEngine) GetSiteCount(category string) int {
	e.mu.RLock()
	defer e.mu.RUnlock()
	if category == "" {
		return len(e.data.Sites)
	}
	n := 0
	for _, s := range e.data.Sites {
		if s.Category == category {
			n++
		}
	}
	return n
}

// CheckUsername lance le lookup username en parallèle (max 50 goroutines).
// Les résultats sont envoyés dans progressChan, puis le job est mis à jour en DB.
func (e *OSINTEngine) CheckUsername(
	ctx context.Context,
	jobID uint,
	username string,
	category string,
	progressChan chan<- models.OSINTResult,
) error {
	e.mu.RLock()
	sites := make([]WMNSite, 0, len(e.data.Sites))
	for _, s := range e.data.Sites {
		if category == "" || s.Category == category {
			sites = append(sites, s)
		}
	}
	e.mu.RUnlock()

	start := time.Now()
	// Mettre à jour TotalSites
	e.db.Model(&models.OSINTJob{}).Where("id = ?", jobID).Updates(map[string]interface{}{
		"status":      "running",
		"total_sites": len(sites),
	})

	sem := make(chan struct{}, 50)
	var wg sync.WaitGroup
	var mu sync.Mutex
	checkedCount := 0
	allResults := make([]models.OSINTResult, 0, len(sites))

	client := &http.Client{
		Timeout: 8 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 3 {
				return http.ErrUseLastResponse
			}
			return nil
		},
	}

	for _, site := range sites {
		wg.Add(1)
		site := site // capture
		sem <- struct{}{}

		go func() {
			defer wg.Done()
			defer func() { <-sem }()

			result := e.checkSite(ctx, client, site, username)

			mu.Lock()
			allResults = append(allResults, result)
			checkedCount++
			cnt := checkedCount
			mu.Unlock()

			// Mise à jour du compteur en DB toutes les 10 vérifications
			if cnt%10 == 0 {
				e.db.Model(&models.OSINTJob{}).Where("id = ?", jobID).Update("checked_sites", cnt)
			}

			// Envoyer dans le channel de progression
			select {
			case progressChan <- result:
			case <-ctx.Done():
			}
		}()
	}

	wg.Wait()
	close(progressChan)

	// Compter les trouvés
	foundCount := 0
	for _, r := range allResults {
		if r.Status == "found" {
			foundCount++
		}
	}

	resultsJSON, _ := json.Marshal(allResults)
	duration := time.Since(start).Milliseconds()

	e.db.Model(&models.OSINTJob{}).Where("id = ?", jobID).Updates(map[string]interface{}{
		"status":        "done",
		"results":       string(resultsJSON),
		"found_count":   foundCount,
		"checked_sites": len(sites),
		"duration":      duration,
	})

	// Mettre à jour WMNMeta si elle existe
	var meta models.WMNMeta
	e.db.First(&meta)
	if meta.ID > 0 {
		e.db.Model(&meta).Update("last_updated", time.Now())
	}

	return nil
}

// checkSite vérifie la présence d'un username sur un site donné.
func (e *OSINTEngine) checkSite(ctx context.Context, client *http.Client, site WMNSite, username string) models.OSINTResult {
	url := strings.ReplaceAll(site.URICheck, "{account}", username)
	start := time.Now()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return models.OSINTResult{
			SiteName: site.Name, Category: site.Category, URL: url,
			Status: "error", ResponseTime: time.Since(start).Milliseconds(),
		}
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; CyberHub OSINT)")

	resp, err := client.Do(req)
	elapsed := time.Since(start).Milliseconds()
	if err != nil {
		status := "error"
		if ctx.Err() != nil {
			status = "timeout"
		}
		return models.OSINTResult{
			SiteName: site.Name, Category: site.Category, URL: url,
			Status: status, ResponseTime: elapsed,
		}
	}
	defer resp.Body.Close()

	// Lire le body (max 500 KB)
	bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 512*1024))
	body := string(bodyBytes)

	// Logique de détection
	status := "not_found"
	if site.ECode > 0 && resp.StatusCode == site.ECode {
		if site.EString == "" || strings.Contains(body, site.EString) {
			// Vérifier que le m_string n'est pas présent
			if site.MString == "" || !strings.Contains(body, site.MString) {
				status = "found"
			}
		}
	} else if resp.StatusCode == 404 || (site.MCode > 0 && resp.StatusCode == site.MCode) {
		status = "not_found"
	} else if site.MString != "" && strings.Contains(body, site.MString) {
		status = "not_found"
	}

	return models.OSINTResult{
		SiteName: site.Name, Category: site.Category, URL: url,
		Status: status, ResponseTime: elapsed,
	}
}

// UpdateDatabase télécharge la dernière version de wmn-data.json depuis GitHub,
// valide le contenu, sauvegarde et recharge le moteur.
func (e *OSINTEngine) UpdateDatabase() (int, error) {
	const wmnURL = "https://raw.githubusercontent.com/WebBreacher/WhatsMyName/main/wmn-data.json"

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(wmnURL)
	if err != nil {
		return 0, fmt.Errorf("téléchargement échoué : %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, fmt.Errorf("lecture body : %w", err)
	}

	var d WMNData
	if err := json.Unmarshal(data, &d); err != nil {
		return 0, fmt.Errorf("JSON invalide : %w", err)
	}
	if len(d.Sites) < 50 {
		return 0, fmt.Errorf("trop peu de sites (%d) — JSON suspect", len(d.Sites))
	}

	// Sauvegarder dans dataPath
	if err := os.MkdirAll(strings.TrimSuffix(e.dataPath, "/wmn-data.json"), 0755); err != nil {
		return 0, err
	}
	if err := os.WriteFile(e.dataPath, data, 0644); err != nil {
		return 0, fmt.Errorf("sauvegarde fichier : %w", err)
	}

	// Recharger le moteur
	e.loadData()

	// Mettre à jour WMNMeta en DB
	count := e.GetSiteCount("")
	var meta models.WMNMeta
	e.db.First(&meta)
	if meta.ID == 0 {
		meta = models.WMNMeta{SiteCount: count, LastUpdated: time.Now()}
		e.db.Create(&meta)
	} else {
		e.db.Model(&meta).Updates(map[string]interface{}{
			"site_count":   count,
			"last_updated": time.Now(),
		})
	}

	return count, nil
}

// GetOrCreateMeta retourne (ou initialise) les métadonnées WMN.
func (e *OSINTEngine) GetOrCreateMeta() models.WMNMeta {
	var meta models.WMNMeta
	e.db.First(&meta)
	if meta.ID == 0 {
		meta = models.WMNMeta{
			SiteCount:   e.GetSiteCount(""),
			LastUpdated: time.Time{}, // jamais mis à jour
		}
		e.db.Create(&meta)
	}
	return meta
}
