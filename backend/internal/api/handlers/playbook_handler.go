package handlers

import (
	"net/http"
	"strconv"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/cyber-hub/cyber-hub/internal/store"
	"github.com/gin-gonic/gin"
)

// ListPlaybooks retourne les playbooks avec pagination optionnelle
// GET /api/playbooks?page=1&limit=10
func ListPlaybooks(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "0"))

	items, total, err := store.ListPlaybooks(page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur récupération playbooks"})
		return
	}
	resp := gin.H{"playbooks": items, "count": total}
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

// GetPlaybook retourne un playbook par son ID (avec ses étapes ordonnées)
// GET /api/playbooks/:id
func GetPlaybook(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		return
	}

	item, err := store.GetPlaybookByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Playbook non trouvé"})
		return
	}
	c.JSON(http.StatusOK, item)
}

// CreatePlaybook crée un nouveau playbook avec ses étapes
// POST /api/playbooks
func CreatePlaybook(c *gin.Context) {
	var req models.PlaybookCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item, err := store.CreatePlaybook(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur création playbook"})
		return
	}
	c.JSON(http.StatusCreated, item)
}

// UpdatePlaybook met à jour un playbook (recrée toutes les étapes)
// PUT /api/playbooks/:id
func UpdatePlaybook(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		return
	}

	var req models.PlaybookCreateRequest
	if err = c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item, err := store.UpdatePlaybook(id, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur mise à jour playbook"})
		return
	}
	c.JSON(http.StatusOK, item)
}

// DeletePlaybook supprime un playbook et toutes ses étapes (CASCADE)
// DELETE /api/playbooks/:id
func DeletePlaybook(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		return
	}

	if err = store.DeletePlaybook(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur suppression playbook"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Playbook supprimé"})
}

// ToggleStep coche ou décoche une étape d'un playbook
// PATCH /api/playbooks/:id/steps/:stepId/toggle
func ToggleStep(c *gin.Context) {
	playbookID, err := parseID(c)
	if err != nil {
		return
	}

	stepIDStr := c.Param("stepId")
	stepIDRaw, err := strconv.ParseUint(stepIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "stepId invalide"})
		return
	}

	step, err := store.ToggleStep(playbookID, uint(stepIDRaw))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, step)
}

// ResetPlaybook remet toutes les étapes d'un playbook à non-cochées
// POST /api/playbooks/:id/reset
func ResetPlaybook(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		return
	}

	if err = store.ResetPlaybook(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur reset playbook"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Playbook réinitialisé"})
}
