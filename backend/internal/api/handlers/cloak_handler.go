package handlers

// ⚠️ CLOAK — usage légal et éducatif uniquement.
// Ce handler gère les modifications et ajouts custom sur le framework CLOAK.

import (
	"net/http"
	"strconv"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/cyber-hub/cyber-hub/internal/store"
	"github.com/gin-gonic/gin"
)

// ListCloakOverrides GET /api/cloak/overrides
// Retourne toutes les entrées modifiées ou custom.
func ListCloakOverrides(c *gin.Context) {
	overrides, err := store.ListCloakOverrides()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Impossible de charger les overrides CLOAK"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"overrides": overrides, "count": len(overrides)})
}

// UpsertCloakOverride POST /api/cloak/overrides
// Crée ou met à jour un override (modification d'une entrée officielle ou ajout custom).
func UpsertCloakOverride(c *gin.Context) {
	var req models.CloakOverrideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	override, err := store.UpsertCloakOverride(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de la sauvegarde"})
		return
	}
	c.JSON(http.StatusOK, override)
}

// DeleteCloakOverride DELETE /api/cloak/overrides/:id
// Supprime un override (reset vers l'officiel, ou suppression d'un custom).
func DeleteCloakOverride(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}

	// Vérifier que l'entrée existe
	if _, err := store.GetCloakOverride(uint(id)); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Override introuvable"})
		return
	}

	if err := store.DeleteCloakOverride(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de la suppression"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Override supprimé"})
}
