package handlers

import (
	"net/http"
	"strconv"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/cyber-hub/cyber-hub/internal/store"
	"github.com/gin-gonic/gin"
)

// ListCTF retourne les writeups CTF avec filtres et pagination
// GET /api/ctf?platform=hackthebox&difficulty=medium&search=privesc&page=1&limit=20
func ListCTF(c *gin.Context) {
	platform := c.Query("platform")
	difficulty := c.Query("difficulty")
	search := c.Query("search")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "0"))

	items, total, err := store.ListCTF(platform, difficulty, search, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur récupération writeups CTF"})
		return
	}
	resp := gin.H{"writeups": items, "count": total}
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

// GetCTF retourne un writeup CTF par son ID
// GET /api/ctf/:id
func GetCTF(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		return
	}

	item, err := store.GetCTFByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Writeup CTF non trouvé"})
		return
	}
	c.JSON(http.StatusOK, item)
}

// CreateCTF crée un nouveau writeup CTF
// POST /api/ctf
func CreateCTF(c *gin.Context) {
	var req models.CTFCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item, err := store.CreateCTF(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur création writeup CTF"})
		return
	}
	c.JSON(http.StatusCreated, item)
}

// UpdateCTF met à jour un writeup CTF
// PUT /api/ctf/:id
func UpdateCTF(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		return
	}

	var req models.CTFCreateRequest
	if err = c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item, err := store.UpdateCTF(id, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur mise à jour writeup CTF"})
		return
	}
	c.JSON(http.StatusOK, item)
}

// DeleteCTF supprime un writeup CTF
// DELETE /api/ctf/:id
func DeleteCTF(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		return
	}

	if err = store.DeleteCTF(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur suppression writeup CTF"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Writeup CTF supprimé"})
}
