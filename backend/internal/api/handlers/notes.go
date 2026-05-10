package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type NotesHandler struct {
	db *gorm.DB
}

func NewNotesHandler(db *gorm.DB) *NotesHandler {
	return &NotesHandler{db: db}
}

type noteRequest struct {
	Title            string `json:"title"             binding:"required"`
	Content          string `json:"content"`
	Tags             string `json:"tags"`
	LinkedIOCs       string `json:"linked_iocs"`
	LinkedTechniques string `json:"linked_techniques"`
	LinkedCVEs       string `json:"linked_cves"`
}

// GET /api/notes
func (h *NotesHandler) List(c *gin.Context) {
	var notes []models.Note
	h.db.Order("updated_at DESC").Limit(200).Find(&notes)
	c.JSON(http.StatusOK, gin.H{"notes": notes, "total": len(notes)})
}

// POST /api/notes
func (h *NotesHandler) Create(c *gin.Context) {
	var req noteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	createdBy := "unknown"
	if sub, ok := c.Get("sub"); ok {
		if s, ok := sub.(string); ok {
			createdBy = s
		}
	}

	note := models.Note{
		Title:            req.Title,
		Content:          req.Content,
		Tags:             req.Tags,
		LinkedIOCs:       req.LinkedIOCs,
		LinkedTechniques: req.LinkedTechniques,
		LinkedCVEs:       req.LinkedCVEs,
		CreatedBy:        createdBy,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}
	if err := h.db.Create(&note).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "impossible de créer la note"})
		return
	}
	c.JSON(http.StatusCreated, note)
}

// GET /api/notes/search?q=
func (h *NotesHandler) Search(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "paramètre q requis"})
		return
	}
	like := "%" + strings.ToLower(q) + "%"
	var notes []models.Note
	h.db.Where("LOWER(title) LIKE ? OR LOWER(content) LIKE ? OR LOWER(tags) LIKE ?",
		like, like, like).
		Order("updated_at DESC").Limit(100).Find(&notes)
	c.JSON(http.StatusOK, gin.H{"notes": notes, "total": len(notes)})
}

// GET /api/notes/:id
func (h *NotesHandler) GetByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	var note models.Note
	if err := h.db.First(&note, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "note introuvable"})
		return
	}
	c.JSON(http.StatusOK, note)
}

// PUT /api/notes/:id
func (h *NotesHandler) Update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	var note models.Note
	if err := h.db.First(&note, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "note introuvable"})
		return
	}

	var req noteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	note.Title            = req.Title
	note.Content          = req.Content
	note.Tags             = req.Tags
	note.LinkedIOCs       = req.LinkedIOCs
	note.LinkedTechniques = req.LinkedTechniques
	note.LinkedCVEs       = req.LinkedCVEs
	note.UpdatedAt        = time.Now()

	if err := h.db.Save(&note).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "impossible de modifier la note"})
		return
	}
	c.JSON(http.StatusOK, note)
}

// DELETE /api/notes/:id
func (h *NotesHandler) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	if err := h.db.Delete(&models.Note{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "impossible de supprimer"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}
