package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type LOLBinsHandler struct {
	db *gorm.DB
}

func NewLOLBinsHandler(db *gorm.DB) *LOLBinsHandler {
	return &LOLBinsHandler{db: db}
}

func (h *LOLBinsHandler) List(c *gin.Context) {
	os := c.Query("os")
	category := c.Query("category")
	search := c.Query("search")
	mitre := c.Query("mitre")

	query := h.db.Model(&models.LOLBin{})
	if os != "" {
		query = query.Where("os = ?", strings.ToLower(os))
	}
	if category != "" {
		query = query.Where("LOWER(category) = LOWER(?)", category)
	}
	if search != "" {
		like := "%" + strings.ToLower(search) + "%"
		query = query.Where("LOWER(name) LIKE ? OR LOWER(description) LIKE ?", like, like)
	}
	if mitre != "" {
		query = query.Where("mitre_tech LIKE ?", "%"+strings.ToUpper(mitre)+"%")
	}

	var total int64
	query.Count(&total)

	var items []models.LOLBin
	query.Limit(100).Find(&items)

	// DTO avec json:"id" explicite — gorm.Model sérialise ID en "ID" (majuscule) par défaut,
	// ce qui casse la comparaison item.id côté frontend.
	type LOLBinDTO struct {
		ID           uint   `json:"id"`
		Name         string `json:"name"`
		OS           string `json:"os"`
		Description  string `json:"description"`
		FullPath     string `json:"full_path"`
		Commands     string `json:"commands"`
		MitreTech    string `json:"mitre_tech"`
		Tags         string `json:"tags"`
		Category     string `json:"category"`
		CommandCount int    `json:"command_count"`
	}
	enriched := make([]LOLBinDTO, len(items))
	for i, item := range items {
		enriched[i] = LOLBinDTO{
			ID:           item.ID,
			Name:         item.Name,
			OS:           item.OS,
			Description:  item.Description,
			FullPath:     item.FullPath,
			Commands:     item.Commands,
			MitreTech:    item.MitreTech,
			Tags:         item.Tags,
			Category:     item.Category,
			CommandCount: parseCommandCount(item.Commands),
		}
	}

	var winCount, linuxCount int64
	h.db.Model(&models.LOLBin{}).Where("os = ?", "windows").Count(&winCount)
	h.db.Model(&models.LOLBin{}).Where("os = ?", "linux").Count(&linuxCount)

	c.JSON(http.StatusOK, gin.H{
		"items":       enriched,
		"total":       total,
		"win_count":   winCount,
		"linux_count": linuxCount,
	})
}

func (h *LOLBinsHandler) GetByName(c *gin.Context) {
	name := c.Param("name")
	var item models.LOLBin
	if err := h.db.Where("LOWER(name) = LOWER(?)", name).First(&item).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "non trouvé"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"id":          item.ID,
		"name":        item.Name,
		"os":          item.OS,
		"description": item.Description,
		"full_path":   item.FullPath,
		"commands":    item.Commands,
		"mitre_tech":  item.MitreTech,
		"tags":        item.Tags,
		"category":    item.Category,
	})
}

func (h *LOLBinsHandler) GetCategories(c *gin.Context) {
	type catRow struct {
		OS       string `json:"os"`
		Category string `json:"category"`
		Count    int    `json:"count"`
	}
	var rows []catRow
	h.db.Model(&models.LOLBin{}).
		Select("os, category, count(*) as count").
		Where("category != ''").
		Group("os, category").
		Order("os, count desc").
		Scan(&rows)
	c.JSON(http.StatusOK, rows)
}

func (h *LOLBinsHandler) GetByMitre(c *gin.Context) {
	techID := strings.ToUpper(c.Param("technique_id"))
	var items []models.LOLBin
	h.db.Where("mitre_tech LIKE ?", "%"+techID+"%").Find(&items)
	c.JSON(http.StatusOK, items)
}

// parseCommandCount retourne le nombre de commandes d'un LOLBin
func parseCommandCount(commandsJSON string) int {
	var arr []json.RawMessage
	if err := json.Unmarshal([]byte(commandsJSON), &arr); err != nil {
		return 0
	}
	return len(arr)
}
