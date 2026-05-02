package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	malwareBazaarAPI = "https://mb-api.abuse.ch/api/v1/"
	hashCacheTTL     = 6 * time.Hour
	hashHTTPTimeout  = 15 * time.Second
)

type HashHandler struct {
	db         *gorm.DB
	httpClient *http.Client
}

func NewHashHandler(db *gorm.DB) *HashHandler {
	return &HashHandler{
		db: db,
		httpClient: &http.Client{
			Timeout: hashHTTPTimeout,
		},
	}
}

// GET /api/hash/analyze/:hash — analyse un hash via MalwareBazaar (avec cache 6h)
func (h *HashHandler) Analyze(c *gin.Context) {
	hash := c.Param("hash")
	if len(hash) < 32 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "hash invalide (min 32 chars)"})
		return
	}

	result, err := h.analyzeHash(hash)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

type bulkRequest struct {
	Hashes []string `json:"hashes" binding:"required"`
}

// POST /api/hash/bulk — analyse jusqu'à 10 hashs en parallèle
func (h *HashHandler) BulkAnalyze(c *gin.Context) {
	var req bulkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// ⚠️ Limiter à 10 hashs pour éviter le rate-limiting MalwareBazaar
	if len(req.Hashes) > 10 {
		req.Hashes = req.Hashes[:10]
	}

	type hashResult struct {
		Hash   string      `json:"hash"`
		Result interface{} `json:"result"`
		Error  string      `json:"error,omitempty"`
	}

	results := make([]hashResult, len(req.Hashes))
	var wg sync.WaitGroup

	for i, hash := range req.Hashes {
		wg.Add(1)
		go func(idx int, h2 string) {
			defer wg.Done()
			res, err := h.analyzeHash(h2)
			if err != nil {
				results[idx] = hashResult{Hash: h2, Error: err.Error()}
			} else {
				results[idx] = hashResult{Hash: h2, Result: res}
			}
		}(i, hash)
	}

	wg.Wait()
	c.JSON(http.StatusOK, gin.H{"results": results})
}

// analyzeHash vérifie le cache puis appelle MalwareBazaar si nécessaire.
func (h *HashHandler) analyzeHash(hash string) (map[string]interface{}, error) {
	now := time.Now()

	// Vérifier le cache DB
	var cached models.HashCache
	if err := h.db.Where("hash = ? AND expires_at > ?", hash, now).First(&cached).Error; err == nil {
		var result map[string]interface{}
		if err := json.Unmarshal([]byte(cached.Result), &result); err == nil {
			result["from_cache"] = true
			return result, nil
		}
	}

	// Appel API MalwareBazaar
	payload := map[string]string{"query": "get_info", "hash": hash}
	payloadBytes, _ := json.Marshal(payload)

	resp, err := h.httpClient.Post(
		malwareBazaarAPI,
		"application/json",
		bytes.NewReader(payloadBytes),
	)
	if err != nil {
		return nil, fmt.Errorf("erreur réseau MalwareBazaar : %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("erreur lecture réponse : %w", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("réponse JSON invalide : %w", err)
	}

	// Mettre en cache (upsert)
	resultStr := string(body)
	h.db.Where("hash = ?", hash).Delete(&models.HashCache{})
	h.db.Create(&models.HashCache{
		Hash:      hash,
		Source:    "malwarebazaar",
		Result:    resultStr,
		CreatedAt: now,
		ExpiresAt: now.Add(hashCacheTTL),
	})

	result["from_cache"] = false
	return result, nil
}
