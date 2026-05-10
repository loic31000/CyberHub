package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	malwareBazaarAPI = "https://mb-api.abuse.ch/api/v1/"
	threatFoxAPI     = "https://threatfox-api.abuse.ch/api/v1/"
	urlhausAPI       = "https://urlhaus-api.abuse.ch/v1/payload/"
	virusTotalAPI    = "https://www.virustotal.com/api/v3/files/"
)

// ── Structs de réponse ────────────────────────────────────────────────────────

type HashAnalysisResponse struct {
	Hash       string             `json:"hash"`
	HashType   string             `json:"hash_type"` // "md5" | "sha256"
	Found      bool               `json:"found"`
	Sources    []HashSourceResult `json:"sources"`
	BestResult *HashSourceResult  `json:"best_result"`
	FromCache  bool               `json:"from_cache"`
}

type HashSourceResult struct {
	Source string      `json:"source"` // "malwarebazaar" | "threatfox" | "urlhaus" | "virustotal"
	Status string      `json:"status"` // "found" | "not_found" | "error" | "skipped" | "not_configured"
	Found  bool        `json:"found"`
	Data   interface{} `json:"data,omitempty"`
	Error  string      `json:"error,omitempty"`
}

type MalwareBazaarData struct {
	FileType    string                 `json:"file_type"`
	FileName    string                 `json:"file_name"`
	FirstSeen   string                 `json:"first_seen"`
	LastSeen    string                 `json:"last_seen"`
	Signature   string                 `json:"signature"`
	Tags        []string               `json:"tags"`
	Reporter    string                 `json:"reporter"`
	VendorIntel map[string]interface{} `json:"vendor_intel,omitempty"`
}

type ThreatFoxData struct {
	Malware         string   `json:"malware"`
	ConfidenceLevel int      `json:"confidence_level"`
	IOCType         string   `json:"ioc_type"`
	ThreatType      string   `json:"threat_type"`
	FirstSeen       string   `json:"first_seen"`
	LastSeen        string   `json:"last_seen"`
	Tags            []string `json:"tags"`
}

type URLhausData struct {
	FileType         string `json:"file_type"`
	URLsCount        int    `json:"urls_count"`
	URLhausReference string `json:"urlhaus_reference"`
	Signature        string `json:"signature"`
}

type VirusTotalData struct {
	MeaningfulName   string                    `json:"meaningful_name"`
	TypeDescription  string                    `json:"type_description"`
	FirstSeen        string                    `json:"first_seen"`
	LastAnalysis     string                    `json:"last_analysis"`
	Stats            VTStats                   `json:"stats"`
	MaliciousEngines map[string]VTEngineResult `json:"malicious_engines"`
	Tags             []string                  `json:"tags"`
	ThreatLabel      string                    `json:"threat_label"`
	DetectionScore   int                       `json:"detection_score"`
}

type VTStats struct {
	Malicious  int `json:"malicious"`
	Suspicious int `json:"suspicious"`
	Undetected int `json:"undetected"`
	Harmless   int `json:"harmless"`
}

type VTEngineResult struct {
	Category string `json:"category"`
	Result   string `json:"result"`
}

// ── Handler ───────────────────────────────────────────────────────────────────

type HashHandler struct {
	db         *gorm.DB
	httpClient *http.Client
}

func NewHashHandler(db *gorm.DB) *HashHandler {
	return &HashHandler{
		db:         db,
		httpClient: &http.Client{Timeout: 20 * time.Second},
	}
}

// GET /api/hash/analyze/:hash
func (h *HashHandler) Analyze(c *gin.Context) {
	hash := strings.ToLower(strings.TrimSpace(c.Param("hash")))
	if len(hash) != 32 && len(hash) != 64 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "hash invalide (MD5=32 chars, SHA256=64 chars)"})
		return
	}

	result := h.analyzeHashFull(c.Request.Context(), hash)
	c.JSON(http.StatusOK, result)
}

// POST /api/hash/bulk
func (h *HashHandler) BulkAnalyze(c *gin.Context) {
	var req struct {
		Hashes []string `json:"hashes" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// ⚠️ Limiter à 10 hashs pour éviter le rate-limiting
	if len(req.Hashes) > 10 {
		req.Hashes = req.Hashes[:10]
	}

	type bulkItem struct {
		Hash   string                `json:"hash"`
		Result *HashAnalysisResponse `json:"result,omitempty"`
		Error  string                `json:"error,omitempty"`
	}

	results := make([]bulkItem, len(req.Hashes))
	var wg sync.WaitGroup

	for i, hash := range req.Hashes {
		wg.Add(1)
		go func(idx int, h2 string) {
			defer wg.Done()
			h2 = strings.ToLower(strings.TrimSpace(h2))
			if len(h2) != 32 && len(h2) != 64 {
				results[idx] = bulkItem{Hash: h2, Error: "hash invalide (MD5=32 chars, SHA256=64 chars)"}
				return
			}
			res := h.analyzeHashFull(context.Background(), h2)
			results[idx] = bulkItem{Hash: h2, Result: &res}
		}(i, hash)
	}

	wg.Wait()
	c.JSON(http.StatusOK, gin.H{"results": results})
}

// DELETE /api/hash/cache/:hash
func (h *HashHandler) DeleteCache(c *gin.Context) {
	hash := strings.ToLower(strings.TrimSpace(c.Param("hash")))
	h.db.Where("hash = ?", hash).Delete(&models.HashCache{})
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

// GET /api/settings/virustotal
func (h *HashHandler) GetVTConfig(c *gin.Context) {
	var s models.AppSetting
	if err := h.db.Where("key = ?", "virustotal_api_key").First(&s).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"configured": false, "masked_key": ""})
		return
	}
	plain, ok := decryptSetting(h.db, s.Value)
	if !ok || plain == "" {
		c.JSON(http.StatusOK, gin.H{"configured": false, "masked_key": ""})
		return
	}
	masked := maskVTKey(plain)
	c.JSON(http.StatusOK, gin.H{"configured": true, "masked_key": masked})
}

// POST /api/settings/virustotal
func (h *HashHandler) SaveVTKey(c *gin.Context) {
	var req struct {
		APIKey string `json:"api_key"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if strings.TrimSpace(req.APIKey) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "api_key requis"})
		return
	}
	encrypted, encErr := encryptSetting(h.db, strings.TrimSpace(req.APIKey))
	if encErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur chiffrement"})
		return
	}
	h.db.Where("key = ?", "virustotal_api_key").Delete(&models.AppSetting{})
	h.db.Create(&models.AppSetting{Key: "virustotal_api_key", Value: encrypted})
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// DELETE /api/settings/virustotal
func (h *HashHandler) DeleteVTKey(c *gin.Context) {
	h.db.Where("key = ?", "virustotal_api_key").Delete(&models.AppSetting{})
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ── Logique interne ───────────────────────────────────────────────────────────

func maskVTKey(key string) string {
	if len(key) < 8 {
		return "VT-****"
	}
	first4 := key[:4]
	last4 := key[len(key)-4:]
	return fmt.Sprintf("VT-%s****%s", first4, last4)
}

func (h *HashHandler) analyzeHashFull(ctx context.Context, hash string) HashAnalysisResponse {
	hashType := "md5"
	if len(hash) == 64 {
		hashType = "sha256"
	}

	// Vérifier le cache
	var cached models.HashCache
	if err := h.db.Where("hash = ? AND expires_at > ?", hash, time.Now()).First(&cached).Error; err == nil {
		var result HashAnalysisResponse
		if err2 := json.Unmarshal([]byte(cached.Result), &result); err2 == nil && result.Sources != nil {
			result.FromCache = true
			return result
		}
		// Cache stale (format ancien sans Sources) — on le supprime pour forcer un refresh
		h.db.Where("hash = ?", hash).Delete(&models.HashCache{})
	}

	// Exécuter les 4 sources en parallèle
	sources := make([]HashSourceResult, 4)
	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		sources[0] = h.queryMalwareBazaar(hash)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		sources[1] = h.queryThreatFox(hash)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		if hashType == "sha256" {
			sources[2] = h.queryURLhaus(hash)
		} else {
			sources[2] = HashSourceResult{Source: "urlhaus", Status: "skipped", Found: false}
		}
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		sources[3] = h.queryVirusTotal(ctx, hash)
	}()

	wg.Wait()

	// Détecter si au moins une source a trouvé le hash
	found := false
	for _, s := range sources {
		if s.Found {
			found = true
			break
		}
	}

	// Meilleur résultat par priorité : virustotal > malwarebazaar > threatfox > urlhaus
	priority := []string{"virustotal", "malwarebazaar", "threatfox", "urlhaus"}
	var bestResult *HashSourceResult
outer:
	for _, prio := range priority {
		for i := range sources {
			if sources[i].Source == prio && sources[i].Found {
				cp := sources[i]
				bestResult = &cp
				break outer
			}
		}
	}

	response := HashAnalysisResponse{
		Hash:       hash,
		HashType:   hashType,
		Found:      found,
		Sources:    sources,
		BestResult: bestResult,
		FromCache:  false,
	}

	// Mise en cache : 6h si trouvé, 1h sinon
	ttl := 1 * time.Hour
	if found {
		ttl = 6 * time.Hour
	}
	now := time.Now()
	if resultJSON, err := json.Marshal(response); err == nil {
		h.db.Where("hash = ?", hash).Delete(&models.HashCache{})
		h.db.Create(&models.HashCache{
			Hash:      hash,
			Source:    "multi",
			Result:    string(resultJSON),
			CreatedAt: now,
			ExpiresAt: now.Add(ttl),
		})
	}

	return response
}

// ── Sources ───────────────────────────────────────────────────────────────────

// queryMalwareBazaar interroge l'API MalwareBazaar (abuse.ch).
// IMPORTANT: l'API exige Content-Type: application/x-www-form-urlencoded (pas JSON).
func (h *HashHandler) queryMalwareBazaar(hash string) HashSourceResult {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Encodage form-urlencoded correct
	formData := url.Values{}
	formData.Set("query", "get_info")
	formData.Set("hash", hash)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, malwareBazaarAPI,
		strings.NewReader(formData.Encode()))
	if err != nil {
		return HashSourceResult{Source: "malwarebazaar", Status: "error", Found: false, Error: err.Error()}
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", "CyberHub/0.9")

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return HashSourceResult{Source: "malwarebazaar", Status: "error", Found: false, Error: err.Error()}
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return HashSourceResult{Source: "malwarebazaar", Status: "error", Found: false, Error: err.Error()}
	}

	var apiResp struct {
		QueryStatus string `json:"query_status"`
		Data        []struct {
			FileType    string                 `json:"file_type"`
			FileName    string                 `json:"file_name"`
			FirstSeen   string                 `json:"first_seen"`
			LastSeen    string                 `json:"last_seen"`
			Signature   string                 `json:"signature"`
			Tags        []string               `json:"tags"`
			Reporter    string                 `json:"reporter"`
			VendorIntel map[string]interface{} `json:"vendor_intel"`
		} `json:"data"`
	}

	if err := json.Unmarshal(body, &apiResp); err != nil {
		return HashSourceResult{Source: "malwarebazaar", Status: "error", Found: false, Error: "réponse JSON invalide"}
	}

	switch apiResp.QueryStatus {
	case "illegal_hash":
		return HashSourceResult{Source: "malwarebazaar", Status: "error", Found: false, Error: "hash invalide selon MalwareBazaar"}
	case "no_results":
		return HashSourceResult{Source: "malwarebazaar", Status: "not_found", Found: false}
	case "ok":
		if len(apiResp.Data) > 0 {
			d := apiResp.Data[0]
			tags := d.Tags
			if tags == nil {
				tags = []string{}
			}
			return HashSourceResult{
				Source: "malwarebazaar",
				Status: "found",
				Found:  true,
				Data: MalwareBazaarData{
					FileType:    d.FileType,
					FileName:    d.FileName,
					FirstSeen:   d.FirstSeen,
					LastSeen:    d.LastSeen,
					Signature:   d.Signature,
					Tags:        tags,
					Reporter:    d.Reporter,
					VendorIntel: d.VendorIntel,
				},
			}
		}
		return HashSourceResult{Source: "malwarebazaar", Status: "not_found", Found: false}
	default:
		return HashSourceResult{Source: "malwarebazaar", Status: "not_found", Found: false}
	}
}

// queryThreatFox interroge l'API ThreatFox (abuse.ch).
func (h *HashHandler) queryThreatFox(hash string) HashSourceResult {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	body, err := json.Marshal(map[string]string{
		"query":       "search_ioc",
		"search_term": hash,
	})
	if err != nil {
		return HashSourceResult{Source: "threatfox", Status: "error", Found: false, Error: err.Error()}
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, threatFoxAPI, bytes.NewReader(body))
	if err != nil {
		return HashSourceResult{Source: "threatfox", Status: "error", Found: false, Error: err.Error()}
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "CyberHub/0.9")

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return HashSourceResult{Source: "threatfox", Status: "error", Found: false, Error: err.Error()}
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return HashSourceResult{Source: "threatfox", Status: "error", Found: false, Error: err.Error()}
	}

	var apiResp struct {
		QueryStatus string `json:"query_status"`
		Data        []struct {
			Malware         string   `json:"malware"`
			ConfidenceLevel int      `json:"confidence_level"`
			IOCType         string   `json:"ioc_type"`
			ThreatType      string   `json:"threat_type"`
			FirstSeen       string   `json:"first_seen"`
			LastSeen        string   `json:"last_seen"`
			Tags            []string `json:"tags"`
		} `json:"data"`
	}

	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return HashSourceResult{Source: "threatfox", Status: "error", Found: false, Error: "réponse JSON invalide"}
	}

	if apiResp.QueryStatus == "no_results" || len(apiResp.Data) == 0 {
		return HashSourceResult{Source: "threatfox", Status: "not_found", Found: false}
	}

	d := apiResp.Data[0]
	tags := d.Tags
	if tags == nil {
		tags = []string{}
	}
	return HashSourceResult{
		Source: "threatfox",
		Status: "found",
		Found:  true,
		Data: ThreatFoxData{
			Malware:         d.Malware,
			ConfidenceLevel: d.ConfidenceLevel,
			IOCType:         d.IOCType,
			ThreatType:      d.ThreatType,
			FirstSeen:       d.FirstSeen,
			LastSeen:        d.LastSeen,
			Tags:            tags,
		},
	}
}

// queryURLhaus interroge l'API URLhaus (abuse.ch) — SHA256 uniquement.
func (h *HashHandler) queryURLhaus(hash string) HashSourceResult {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	formData := url.Values{}
	formData.Set("sha256_hash", hash)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, urlhausAPI,
		strings.NewReader(formData.Encode()))
	if err != nil {
		return HashSourceResult{Source: "urlhaus", Status: "error", Found: false, Error: err.Error()}
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", "CyberHub/0.9")

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return HashSourceResult{Source: "urlhaus", Status: "error", Found: false, Error: err.Error()}
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return HashSourceResult{Source: "urlhaus", Status: "error", Found: false, Error: err.Error()}
	}

	var apiResp struct {
		QueryStatus      string `json:"query_status"`
		FileType         string `json:"file_type"`
		URLsCount        int    `json:"urls_count"`
		URLhausReference string `json:"urlhaus_reference"`
		Signature        string `json:"signature"`
	}

	if err := json.Unmarshal(body, &apiResp); err != nil {
		return HashSourceResult{Source: "urlhaus", Status: "error", Found: false, Error: "réponse JSON invalide"}
	}

	if apiResp.QueryStatus == "no_results" {
		return HashSourceResult{Source: "urlhaus", Status: "not_found", Found: false}
	}

	return HashSourceResult{
		Source: "urlhaus",
		Status: "found",
		Found:  true,
		Data: URLhausData{
			FileType:         apiResp.FileType,
			URLsCount:        apiResp.URLsCount,
			URLhausReference: apiResp.URLhausReference,
			Signature:        apiResp.Signature,
		},
	}
}

// queryVirusTotal interroge l'API VirusTotal v3.
// La clé API est lue depuis la table app_settings (jamais en dur).
func (h *HashHandler) queryVirusTotal(ctx context.Context, hash string) HashSourceResult {
	// Lire la clé API depuis la base
	var setting models.AppSetting
	if err := h.db.Where("key = ?", "virustotal_api_key").First(&setting).Error; err != nil {
		return HashSourceResult{Source: "virustotal", Status: "not_configured", Found: false}
	}
	apiKey, ok := decryptSetting(h.db, strings.TrimSpace(setting.Value))
	if !ok || apiKey == "" {
		return HashSourceResult{Source: "virustotal", Status: "not_configured", Found: false}
	}

	vtCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	reqURL := virusTotalAPI + hash
	req, err := http.NewRequestWithContext(vtCtx, http.MethodGet, reqURL, nil)
	if err != nil {
		return HashSourceResult{Source: "virustotal", Status: "error", Found: false, Error: err.Error()}
	}
	// SECURITE: la clé API est transmise via header, pas dans l'URL
	req.Header.Set("x-apikey", apiKey)
	req.Header.Set("User-Agent", "CyberHub/0.9")

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return HashSourceResult{Source: "virustotal", Status: "error", Found: false, Error: err.Error()}
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return HashSourceResult{Source: "virustotal", Status: "not_found", Found: false}
	}
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return HashSourceResult{Source: "virustotal", Status: "error", Found: false, Error: "Clé API invalide"}
	}
	if resp.StatusCode != http.StatusOK {
		return HashSourceResult{Source: "virustotal", Status: "error", Found: false,
			Error: fmt.Sprintf("HTTP %d", resp.StatusCode)}
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return HashSourceResult{Source: "virustotal", Status: "error", Found: false, Error: err.Error()}
	}

	// Parsing de la réponse VT v3
	var vtResp struct {
		Data struct {
			Attributes struct {
				MeaningfulName      string `json:"meaningful_name"`
				TypeDescription     string `json:"type_description"`
				FirstSubmissionDate int64  `json:"first_submission_date"`
				LastAnalysisDate    int64  `json:"last_analysis_date"`
				LastAnalysisStats   struct {
					Malicious  int `json:"malicious"`
					Suspicious int `json:"suspicious"`
					Undetected int `json:"undetected"`
					Harmless   int `json:"harmless"`
				} `json:"last_analysis_stats"`
				LastAnalysisResults map[string]struct {
					Category string `json:"category"`
					Result   string `json:"result"`
				} `json:"last_analysis_results"`
				Tags []string `json:"tags"`
				PopularThreatClassification struct {
					SuggestedThreatLabel string `json:"suggested_threat_label"`
				} `json:"popular_threat_classification"`
			} `json:"attributes"`
		} `json:"data"`
	}

	if err := json.Unmarshal(body, &vtResp); err != nil {
		return HashSourceResult{Source: "virustotal", Status: "error", Found: false, Error: "réponse JSON invalide"}
	}

	attrs := vtResp.Data.Attributes
	stats := VTStats{
		Malicious:  attrs.LastAnalysisStats.Malicious,
		Suspicious: attrs.LastAnalysisStats.Suspicious,
		Undetected: attrs.LastAnalysisStats.Undetected,
		Harmless:   attrs.LastAnalysisStats.Harmless,
	}

	// Calculer le score de détection en pourcentage
	total := stats.Malicious + stats.Suspicious + stats.Undetected + stats.Harmless
	detectionScore := 0
	if total > 0 {
		detectionScore = stats.Malicious * 100 / total
	}

	// Filtrer uniquement les moteurs malveillants/suspects
	maliciousEngines := make(map[string]VTEngineResult)
	for engine, r := range attrs.LastAnalysisResults {
		if r.Category == "malicious" || r.Category == "suspicious" {
			maliciousEngines[engine] = VTEngineResult{
				Category: r.Category,
				Result:   r.Result,
			}
		}
	}

	tags := attrs.Tags
	if tags == nil {
		tags = []string{}
	}

	// Convertir les timestamps Unix en RFC3339
	firstSeen := ""
	if attrs.FirstSubmissionDate > 0 {
		firstSeen = time.Unix(attrs.FirstSubmissionDate, 0).UTC().Format(time.RFC3339)
	}
	lastAnalysis := ""
	if attrs.LastAnalysisDate > 0 {
		lastAnalysis = time.Unix(attrs.LastAnalysisDate, 0).UTC().Format(time.RFC3339)
	}

	return HashSourceResult{
		Source: "virustotal",
		Status: "found",
		Found:  true,
		Data: VirusTotalData{
			MeaningfulName:   attrs.MeaningfulName,
			TypeDescription:  attrs.TypeDescription,
			FirstSeen:        firstSeen,
			LastAnalysis:     lastAnalysis,
			Stats:            stats,
			MaliciousEngines: maliciousEngines,
			Tags:             tags,
			ThreatLabel:      attrs.PopularThreatClassification.SuggestedThreatLabel,
			DetectionScore:   detectionScore,
		},
	}
}
