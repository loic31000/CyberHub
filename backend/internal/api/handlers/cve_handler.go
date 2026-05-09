package handlers

import (
	"log"
	"net/http"
	"strconv"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/cyber-hub/cyber-hub/internal/store"
	"github.com/gin-gonic/gin"
)

// ListCVE retourne les CVE avec filtres et pagination
// GET /api/cve?severity=critical&status=new&search=apache&page=1&limit=20
func ListCVE(c *gin.Context) {
	severity := c.Query("severity")
	status := c.Query("status")
	search := c.Query("search")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "0"))

	items, total, err := store.ListCVE(severity, status, search, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur récupération CVE"})
		return
	}
	resp := gin.H{"cves": items, "count": total}
	if page > 0 && limit > 0 {
		totalPages := int(total) / limit
		if int(total)%limit != 0 {
			totalPages++
		}
		resp["page"] = page
		resp["limit"] = limit
		resp["total_pages"] = totalPages
	}
	c.JSON(http.StatusOK, resp)
}

// GetCVE retourne une CVE par son ID
// GET /api/cve/:id
func GetCVE(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		return
	}

	item, err := store.GetCVEByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "CVE non trouvée"})
		return
	}
	c.JSON(http.StatusOK, item)
}

// CreateCVE crée une nouvelle entrée CVE
// POST /api/cve
func CreateCVE(c *gin.Context) {
	var req models.CVECreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item, err := store.CreateCVE(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur création CVE"})
		return
	}
	c.JSON(http.StatusCreated, item)
}

// UpdateCVE met à jour une CVE
// PUT /api/cve/:id
func UpdateCVE(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		return
	}

	var req models.CVECreateRequest
	if err = c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item, err := store.UpdateCVE(id, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur mise à jour CVE"})
		return
	}
	c.JSON(http.StatusOK, item)
}

// DeleteCVE supprime une CVE
// DELETE /api/cve/:id
func DeleteCVE(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		return
	}

	if err = store.DeleteCVE(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur suppression CVE"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "CVE supprimée"})
}

// ImportNVD importe un flux NVD JSON 2.0
// POST /api/cve/import-nvd
// Body : { "vulnerabilities": [...] }  (format NVD API 2.0)
func ImportNVD(c *gin.Context) {
	var req models.NVDImportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format JSON invalide : " + err.Error()})
		return
	}

	if len(req.Vulnerabilities) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Aucune vulnérabilité dans le payload"})
		return
	}

	created, skipped, err := store.ImportNVD(req.Vulnerabilities)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de l'import NVD"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Import NVD terminé",
		"created": created,
		"skipped": skipped,
		"total":   len(req.Vulnerabilities),
	})
}

// FetchNVDOnline importe des CVE directement depuis l'API NVD publique.
// POST /api/cve/fetch-from-nvd
func FetchNVDOnline(c *gin.Context) {
	var req models.NVDOnlineRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Paramètres invalides: " + err.Error()})
		return
	}

	log.Printf("[NVD] FetchNVDOnline — paramètres reçus: pubStartDate=%q, pubEndDate=%q, cvssMin=%.1f, keyword=%q, resultsPerPage=%d, page=%d",
		req.PubStartDate, req.PubEndDate, req.CVSSMin, req.Keyword, req.ResultsPerPage, req.Page)

	// Validation simple
	if req.PubStartDate == "" && req.Keyword == "" && req.CVSSMin == 0 {
		log.Printf("[NVD] Requête rejetée : aucun critère fourni")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Au moins un critère (date début, keyword, ou CVSS min) est requis"})
		return
	}

	created, skipped, totalAvailable, totalRemote, err := store.FetchAndImportNVDAll(req)
	if err != nil {
		log.Printf("[NVD] Erreur import paginé: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de l'import NVD: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":         "Import depuis NVD réussi",
		"created":         created,
		"skipped":         skipped,
		"total_available": totalAvailable,
		"total_remote":    totalRemote,
	})
}
