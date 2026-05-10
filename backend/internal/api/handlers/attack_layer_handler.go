package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/cyber-hub/cyber-hub/internal/store"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type AttackLayerHandler struct {
	db *gorm.DB
}

func NewAttackLayerHandler(db *gorm.DB) *AttackLayerHandler {
	return &AttackLayerHandler{db: db}
}

// layerEntry est le format interne de stockage d'une entrée de technique dans un layer.
type layerEntry struct {
	TechniqueID string `json:"technique_id"`
	Name        string `json:"name"`
	Color       string `json:"color"`
	Comment     string `json:"comment"`
	Score       int    `json:"score"`
	Enabled     bool   `json:"enabled"`
}

// navigatorLayer est le format JSON ATT&CK Navigator (import/export).
type navigatorLayer struct {
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Domain      string            `json:"domain"`
	Versions    map[string]string `json:"versions"`
	Techniques  []navTechnique    `json:"techniques"`
}

type navTechnique struct {
	TechniqueID string `json:"techniqueID"`
	Tactic      string `json:"tactic"`
	Color       string `json:"color"`
	Comment     string `json:"comment"`
	Score       int    `json:"score"`
	Enabled     bool   `json:"enabled"`
}

func (h *AttackLayerHandler) List(c *gin.Context) {
	layers, err := store.ListAttackLayers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": layers, "total": len(layers)})
}

func (h *AttackLayerHandler) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	layer, err := store.GetAttackLayerByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "layer introuvable"})
		return
	}
	c.JSON(http.StatusOK, layer)
}

func (h *AttackLayerHandler) Create(c *gin.Context) {
	var body struct {
		Name        string `json:"name"        binding:"required"`
		Description string `json:"description"`
		Domain      string `json:"domain"`
		Version     string `json:"version"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	domain := body.Domain
	if domain == "" {
		domain = "enterprise-attack"
	}
	version := body.Version
	if version == "" {
		version = "4.5"
	}
	layer := &models.AttackLayer{
		Name:        strings.TrimSpace(body.Name),
		Description: strings.TrimSpace(body.Description),
		Domain:      domain,
		Version:     version,
		LayerData:   "[]",
	}
	if err := store.CreateAttackLayer(layer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, layer)
}

func (h *AttackLayerHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	allowed := map[string]bool{
		"name": true, "description": true, "domain": true, "version": true, "layer_data": true,
	}
	updates := make(map[string]interface{})
	for k, v := range body {
		if allowed[k] {
			updates[k] = v
		}
	}
	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "aucun champ valide"})
		return
	}
	layer, err := store.UpdateAttackLayer(uint(id), updates)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, layer)
}

func (h *AttackLayerHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	if err := store.DeleteAttackLayer(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "layer supprimé"})
}

// Import accepte un JSON ATT&CK Navigator et le sauvegarde comme nouveau layer.
// POST /api/mitre/layers/import
func (h *AttackLayerHandler) Import(c *gin.Context) {
	var nav navigatorLayer
	if err := c.ShouldBindJSON(&nav); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON invalide : " + err.Error()})
		return
	}
	if nav.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "le champ 'name' est requis dans le JSON"})
		return
	}

	entries := make([]layerEntry, 0, len(nav.Techniques))
	for _, t := range nav.Techniques {
		if t.TechniqueID == "" {
			continue
		}
		enabled := t.Enabled
		if !enabled && t.Color == "" && t.Score == 0 {
			enabled = true
		}
		entries = append(entries, layerEntry{
			TechniqueID: t.TechniqueID,
			Name:        "",
			Color:       t.Color,
			Comment:     t.Comment,
			Score:       t.Score,
			Enabled:     enabled,
		})
	}

	layerDataBytes, err := json.Marshal(entries)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erreur sérialisation"})
		return
	}

	domain := nav.Domain
	if domain == "" {
		domain = "enterprise-attack"
	}
	version := "4.5"
	if v, ok := nav.Versions["layer"]; ok && v != "" {
		version = v
	}

	layer := &models.AttackLayer{
		Name:        nav.Name,
		Description: nav.Description,
		Domain:      domain,
		Version:     version,
		LayerData:   string(layerDataBytes),
	}
	if err := store.CreateAttackLayer(layer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"layer": layer, "imported": len(entries)})
}

// Export génère un JSON ATT&CK Navigator valide.
// GET /api/mitre/layers/:id/export
func (h *AttackLayerHandler) Export(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	layer, err := store.GetAttackLayerByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "layer introuvable"})
		return
	}

	var entries []layerEntry
	if layer.LayerData != "" && layer.LayerData != "[]" {
		if parseErr := json.Unmarshal([]byte(layer.LayerData), &entries); parseErr != nil {
			entries = []layerEntry{}
		}
	}

	navTechs := make([]navTechnique, 0, len(entries))
	for _, e := range entries {
		navTechs = append(navTechs, navTechnique{
			TechniqueID: e.TechniqueID,
			Color:       e.Color,
			Comment:     e.Comment,
			Score:       e.Score,
			Enabled:     e.Enabled,
		})
	}

	nav := navigatorLayer{
		Name:        layer.Name,
		Description: layer.Description,
		Domain:      layer.Domain,
		Versions: map[string]string{
			"attack":    "14",
			"navigator": "4.9",
			"layer":     layer.Version,
		},
		Techniques: navTechs,
	}

	filename := fmt.Sprintf("layer-%s-%s.json",
		strings.ReplaceAll(strings.ToLower(layer.Name), " ", "-"),
		time.Now().Format("2006-01-02"),
	)
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.Header("Content-Type", "application/json; charset=utf-8")
	c.JSON(http.StatusOK, nav)
}
