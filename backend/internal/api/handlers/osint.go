package handlers

// ⚠️ Usage légal uniquement — OSINT sur systèmes autorisés seulement

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/cyber-hub/cyber-hub/internal/osint"
	"github.com/cyber-hub/cyber-hub/internal/store"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var usernameRe = regexp.MustCompile(`^[a-zA-Z0-9_\-]{1,50}$`)

type OSINTHandler struct {
	db     *gorm.DB
	engine *osint.OSINTEngine
}

func NewOSINTHandler(db *gorm.DB, engine *osint.OSINTEngine) *OSINTHandler {
	return &OSINTHandler{db: db, engine: engine}
}

func (h *OSINTHandler) GetMeta(c *gin.Context) {
	meta := h.engine.GetOrCreateMeta()
	cats := h.engine.GetCategories()
	c.JSON(http.StatusOK, gin.H{
		"last_updated": meta.LastUpdated,
		"site_count":   meta.SiteCount,
		"categories":   cats,
	})
}

func (h *OSINTHandler) UpdateDB(c *gin.Context) {
	count, err := h.engine.UpdateDatabase()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"site_count": count,
		"updated_at": time.Now(),
	})
}

type osintRunRequest struct {
	Username string `json:"username" binding:"required"`
	Category string `json:"category"`
}

func (h *OSINTHandler) RunJob(c *gin.Context) {
	var req osintRunRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username requis"})
		return
	}
	if !usernameRe.MatchString(req.Username) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username invalide (alphanumérique + tirets + underscores, 1-50 chars)"})
		return
	}
	launchedBy := "unknown"
	if sub, ok := c.Get("sub"); ok {
		launchedBy = fmt.Sprintf("%v", sub)
	}
	job := models.OSINTJob{
		Username:       req.Username,
		Status:         "pending",
		FilterCategory: req.Category,
		LaunchedBy:     launchedBy,
	}
	if err := h.db.Create(&job).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "impossible de créer le job"})
		return
	}
	go func() {
		progressChan := make(chan models.OSINTResult, 200)
		go func() {
			for range progressChan {
			}
		}()
		// Utiliser context.Background() — le job doit survivre à la requête HTTP
		h.engine.CheckUsername(context.Background(), job.ID, req.Username, req.Category, progressChan)
	}()
	c.JSON(http.StatusOK, gin.H{"job_id": job.ID})
}

func (h *OSINTHandler) ListJobs(c *gin.Context) {
	type jobRow struct {
		ID             uint      `json:"id"`
		CreatedAt      time.Time `json:"created_at"`
		Username       string    `json:"username"`
		Status         string    `json:"status"`
		TotalSites     int       `json:"total_sites"`
		CheckedSites   int       `json:"checked_sites"`
		FoundCount     int       `json:"found_count"`
		FilterCategory string    `json:"filter_category"`
		Duration       int64     `json:"duration"`
		LaunchedBy     string    `json:"launched_by"`
	}
	var jobs []jobRow
	h.db.Model(&models.OSINTJob{}).
		Select("id, created_at, username, status, total_sites, checked_sites, found_count, filter_category, duration, launched_by").
		Order("created_at DESC").
		Limit(100).
		Scan(&jobs)
	if jobs == nil {
		jobs = []jobRow{}
	}
	c.JSON(http.StatusOK, gin.H{"jobs": jobs, "total": len(jobs)})
}

func (h *OSINTHandler) GetJob(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	var job models.OSINTJob
	if err := h.db.First(&job, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "job introuvable"})
		return
	}
	var results []models.OSINTResult
	if job.Results != "" {
		_ = json.Unmarshal([]byte(job.Results), &results)
	}
	if results == nil {
		results = []models.OSINTResult{}
	}
	c.JSON(http.StatusOK, gin.H{
		"id":              job.ID,
		"created_at":      job.CreatedAt,
		"username":        job.Username,
		"status":          job.Status,
		"total_sites":     job.TotalSites,
		"checked_sites":   job.CheckedSites,
		"found_count":     job.FoundCount,
		"filter_category": job.FilterCategory,
		"duration":        job.Duration,
		"launched_by":     job.LaunchedBy,
		"results":         results,
	})
}

func (h *OSINTHandler) StreamJob(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	ctx := c.Request.Context()
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			var job models.OSINTJob
			if err := h.db.First(&job, id).Error; err != nil {
				return
			}
			var latestFound []models.OSINTResult
			if job.Results != "" {
				var all []models.OSINTResult
				_ = json.Unmarshal([]byte(job.Results), &all)
				for _, r := range all {
					if r.Status == "found" {
						latestFound = append(latestFound, r)
					}
				}
				if len(latestFound) > 5 {
					latestFound = latestFound[len(latestFound)-5:]
				}
			}
			if latestFound == nil {
				latestFound = []models.OSINTResult{}
			}
			payload, _ := json.Marshal(gin.H{
				"checked_sites":  job.CheckedSites,
				"total_sites":    job.TotalSites,
				"found_count":    job.FoundCount,
				"status":         job.Status,
				"latest_results": latestFound,
				"finished":       (job.Status == "done" || job.Status == "error"),
			})
			fmt.Fprintf(c.Writer, "data: %s\n\n", payload)
			c.Writer.Flush()
			if job.Status == "done" || job.Status == "error" {
				return
			}
		}
	}
}

func (h *OSINTHandler) DeleteJob(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	if err := h.db.Delete(&models.OSINTJob{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "impossible de supprimer"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

func (h *OSINTHandler) ExportIOC(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	var job models.OSINTJob
	if err := h.db.First(&job, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "job introuvable"})
		return
	}
	var results []models.OSINTResult
	if job.Results != "" {
		_ = json.Unmarshal([]byte(job.Results), &results)
	}
	type iocExport struct {
		Type        string `json:"type"`
		Value       string `json:"value"`
		Description string `json:"description"`
	}
	exports := make([]iocExport, 0)
	for _, r := range results {
		if r.Status == "found" {
			exports = append(exports, iocExport{
				Type:        "url",
				Value:       r.URL,
				Description: fmt.Sprintf("OSINT: %s", r.SiteName),
			})
		}
	}
	c.JSON(http.StatusOK, gin.H{"iocs": exports, "count": len(exports)})
}

func (h *OSINTHandler) ImportIOC(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	var job models.OSINTJob
	if err := h.db.First(&job, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "job introuvable"})
		return
	}
	var results []models.OSINTResult
	if job.Results != "" {
		_ = json.Unmarshal([]byte(job.Results), &results)
	}
	created := 0
	skipped := 0
	for _, r := range results {
		if r.Status != "found" {
			continue
		}
		var existing models.IOC
		if err := store.DB.Where("value = ?", r.URL).First(&existing).Error; err == nil {
			skipped++
			continue
		}
		ioc := models.IOC{
			Type:   models.IOCTypeURL,
			Value:  r.URL,
			Source: fmt.Sprintf("OSINT WMN — %s", job.Username),
			TLP:    models.TLPWhite,
			Status: models.IOCStatusActive,
			Notes:  fmt.Sprintf("WhatsMyName: %s (%s)", r.SiteName, r.Category),
		}
		if err := store.DB.Create(&ioc).Error; err == nil {
			created++
		}
	}
	c.JSON(http.StatusOK, gin.H{"created": created, "skipped": skipped})
}
