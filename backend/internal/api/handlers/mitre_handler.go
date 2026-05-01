package handlers

import (
	"net/http"
	"strconv"

	"github.com/cyber-hub/cyber-hub/internal/mitre"
	"github.com/cyber-hub/cyber-hub/internal/store"
	"github.com/gin-gonic/gin"
)

// GetMITREStatus retourne l'état du seed MITRE.
// GET /api/mitre/status
func GetMITREStatus(c *gin.Context) {
	seeded := store.IsMITRESeeded()
	seeding := mitre.IsSeeding()

	var count int64
	if seeded {
		store.DB.Raw("SELECT COUNT(*) FROM mitre_techniques").Scan(&count)
	}

	c.JSON(http.StatusOK, gin.H{
		"seeded":  seeded,
		"seeding": seeding,
		"count":   count,
	})
}

// ListMITRETactics retourne toutes les tactiques triées par ordre kill chain.
// GET /api/mitre/tactics
func ListMITRETactics(c *gin.Context) {
	tactics, err := store.ListMITRETactics()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, tactics)
}

// ListMITRETechniques retourne les techniques filtrées.
// GET /api/mitre/techniques?tactic=&platform=&q=&only_techniques=&page=&limit=
func ListMITRETechniques(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	onlyTechniques := c.Query("only_techniques") == "true"

	f := store.MITRETechniquesFilter{
		Tactic:         c.Query("tactic"),
		Platform:       c.Query("platform"),
		Query:          c.Query("q"),
		OnlyTechniques: onlyTechniques,
		Page:           page,
		Limit:          limit,
	}

	techniques, total, err := store.ListMITRETechniques(f)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"items": techniques,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GetMITRETechnique retourne une technique complète par son ID (ex: T1046).
// GET /api/mitre/techniques/:id
func GetMITRETechnique(c *gin.Context) {
	techniqueID := c.Param("id")
	if techniqueID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id requis"})
		return
	}

	t, err := store.GetMITRETechniqueByID(techniqueID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "technique non trouvée"})
		return
	}
	c.JSON(http.StatusOK, t)
}
