package handlers

// ⚠️ CLOAK Annotations — couche personnelle au-dessus du framework CLOAK.
// Le contenu source CLOAK est en lecture seule ; seules les annotations sont modifiables.

import (
	"net/http"
	"strconv"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/cyber-hub/cyber-hub/internal/store"
	"github.com/gin-gonic/gin"
)

// ListCloakAnnotations GET /api/cloak/annotations
// Retourne toutes les annotations utilisateur (pour hydrater la page CLOAK côté client).
func ListCloakAnnotations(c *gin.Context) {
	items, err := store.ListCloakAnnotations()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Impossible de charger les annotations CLOAK"})
		return
	}
	c.JSON(http.StatusOK, items)
}

// UpsertCloakAnnotation POST /api/cloak/annotations
// Crée ou met à jour une annotation (upsert par technique_ref).
func UpsertCloakAnnotation(c *gin.Context) {
	var req models.CloakAnnotationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Requête invalide : " + err.Error()})
		return
	}

	// Validation : status doit être une valeur connue ou vide
	validStatuses := map[string]bool{"": true, "a_tester": true, "vu_en_lab": true, "maitrise": true}
	if !validStatuses[req.Status] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Statut invalide"})
		return
	}

	ann, err := store.UpsertCloakAnnotation(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de la sauvegarde"})
		return
	}
	c.JSON(http.StatusOK, ann)
}

// DeleteCloakAnnotation DELETE /api/cloak/annotations/:id
// Supprime une annotation par ID (reset — la fiche CLOAK originale est inchangée).
func DeleteCloakAnnotation(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}
	if err := store.DeleteCloakAnnotation(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de la suppression"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": id})
}

// DeleteCloakAnnotationByRef DELETE /api/cloak/annotations/ref/:ref
// Supprime une annotation par technique_ref (pratique côté frontend).
func DeleteCloakAnnotationByRef(c *gin.Context) {
	ref := c.Param("ref")
	if ref == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ref manquant"})
		return
	}
	if err := store.DeleteCloakAnnotationByRef(ref); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur lors de la suppression"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": ref})
}
