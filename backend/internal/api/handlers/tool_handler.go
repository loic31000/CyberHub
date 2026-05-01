package handlers

import (
	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/cyber-hub/cyber-hub/internal/store"
	"github.com/gin-gonic/gin"
	"net/http"
	"strconv"
)

// ListTools retourne les outils avec filtres et pagination optionnels.
// GET /api/tools?category=offensive&os=linux&search=nmap&page=1&limit=20
func ListTools(c *gin.Context) {
	category := c.Query("category")
	subCategory := c.Query("sub_category")
	os := c.Query("os")
	search := c.Query("search")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "0"))

	tools, total, err := store.ListTools(category, subCategory, os, search, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur récupération outils"})
		return
	}
	resp := gin.H{"tools": tools, "count": total}
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

// GetTool retourne un outil par son ID
// GET /api/tools/:id
func GetTool(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		return
	}

	tool, err := store.GetToolByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Outil non trouvé"})
		return
	}
	c.JSON(http.StatusOK, tool)
}

// CreateTool crée un nouvel outil
// POST /api/tools
func CreateTool(c *gin.Context) {
	var req models.ToolCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tool, err := store.CreateTool(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur création outil"})
		return
	}
	c.JSON(http.StatusCreated, tool)
}

// UpdateTool met à jour un outil
// PUT /api/tools/:id
func UpdateTool(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		return
	}

	var req models.ToolCreateRequest
	if err = c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tool, err := store.UpdateTool(id, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur mise à jour outil"})
		return
	}
	c.JSON(http.StatusOK, tool)
}

// DeleteTool supprime un outil
// DELETE /api/tools/:id
func DeleteTool(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		return
	}

	if err = store.DeleteTool(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur suppression outil"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Outil supprimé"})
}

// GetSubCategories retourne la liste des sous-catégories disponibles
// GET /api/tools/categories
func GetSubCategories(c *gin.Context) {
	cats, err := store.GetSubCategories()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur récupération catégories"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"categories": cats})
}

// GetStats retourne les statistiques du dashboard
// GET /api/stats
func GetStats(c *gin.Context) {
	stats, err := store.GetStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur statistiques"})
		return
	}
	c.JSON(http.StatusOK, stats)
}

// GetToolCommands retourne les suggestions de commandes pour un outil (autocomplétion).
// GET /api/tools/:id/commands?q=<query>
func GetToolCommands(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		return
	}
	query := c.Query("q")
	commands, err := store.ListCommandsForTool(id, query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur récupération suggestions"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"commands": commands})
}

// parseID parse l'ID depuis les params de route et répond en cas d'erreur
func parseID(c *gin.Context) (uint, error) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return 0, err
	}
	return uint(id), nil
}
