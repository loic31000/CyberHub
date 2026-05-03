package handlers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CISAHandler struct {
	db *gorm.DB
}

func NewCISAHandler(db *gorm.DB) *CISAHandler {
	return &CISAHandler{db: db}
}

func (h *CISAHandler) CheckKEV(c *gin.Context) {
	cveID := strings.ToUpper(c.Param("cve_id"))
	var entry models.CISAKEVEntry
	err := h.db.Where("UPPER(cve_id) = ?", cveID).First(&entry).Error
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"exploited": false, "entry": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"exploited": true, "entry": entry})
}

func (h *CISAHandler) GetStats(c *gin.Context) {
	var count int64
	h.db.Model(&models.CISAKEVEntry{}).Count(&count)
	var last models.CISAKEVEntry
	h.db.Order("created_at DESC").First(&last)
	c.JSON(http.StatusOK, gin.H{
		"total_entries": count,
		"last_updated":  last.CreatedAt,
	})
}

type kevUpdateJSON struct {
	Vulnerabilities []struct {
		CveID             string `json:"cveID"`
		VendorProject     string `json:"vendorProject"`
		Product           string `json:"product"`
		VulnerabilityName string `json:"vulnerabilityName"`
		DateAdded         string `json:"dateAdded"`
		ShortDescription  string `json:"shortDescription"`
		RequiredAction    string `json:"requiredAction"`
		DueDate           string `json:"dueDate"`
		Notes             string `json:"notes"`
	} `json:"vulnerabilities"`
}

func (h *CISAHandler) UpdateKEV(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet,
		"https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json", nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "error": err.Error()})
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var kev kevUpdateJSON
	if err2 := json.Unmarshal(body, &kev); err2 != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err2.Error()})
		return
	}
	count := 0
	for _, v := range kev.Vulnerabilities {
		entry := models.CISAKEVEntry{
			CveID:             v.CveID,
			VendorProject:     v.VendorProject,
			Product:           v.Product,
			VulnerabilityName: v.VulnerabilityName,
			DateAdded:         v.DateAdded,
			ShortDescription:  v.ShortDescription,
			RequiredAction:    v.RequiredAction,
			DueDate:           v.DueDate,
			Notes:             v.Notes,
		}
		result := h.db.Where("cve_id = ?", v.CveID).FirstOrCreate(&entry)
		if result.RowsAffected > 0 {
			count++
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"count":      len(kev.Vulnerabilities),
		"new_items":  count,
		"updated_at": time.Now(),
	})
}

func (h *CISAHandler) GetEPSS(c *gin.Context) {
	cveID := strings.ToUpper(c.Param("cve_id"))
	var cached models.EPSSScore
	if h.db.Where("cve_id = ? AND expires_at > ?", cveID, time.Now()).First(&cached).Error == nil {
		c.JSON(http.StatusOK, gin.H{
			"cve_id":     cached.CveID,
			"score":      cached.Score,
			"percentile": cached.Percentile,
			"date":       cached.Date,
		})
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	url := "https://api.first.org/data/v1/epss?cve=" + cveID
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	defer resp.Body.Close()
	var result struct {
		Data []struct {
			CVE        string `json:"cve"`
			EPSS       string `json:"epss"`
			Percentile string `json:"percentile"`
			Date       string `json:"date"`
		} `json:"data"`
	}
	body, _ := io.ReadAll(resp.Body)
	if err2 := json.Unmarshal(body, &result); err2 != nil || len(result.Data) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "EPSS non disponible"})
		return
	}
	d := result.Data[0]
	var score, pct float64
	json.Unmarshal([]byte(d.EPSS), &score)       //nolint:errcheck
	json.Unmarshal([]byte(d.Percentile), &pct)   //nolint:errcheck
	now := time.Now()
	epss := models.EPSSScore{
		CveID:      cveID,
		Score:      score,
		Percentile: pct,
		Date:       d.Date,
		FetchedAt:  now,
		ExpiresAt:  now.Add(24 * time.Hour),
	}
	h.db.Where("cve_id = ?", cveID).Delete(&models.EPSSScore{})
	h.db.Create(&epss)
	c.JSON(http.StatusOK, gin.H{
		"cve_id":     cveID,
		"score":      score,
		"percentile": pct,
		"date":       d.Date,
	})
}
