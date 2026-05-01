package handlers

import (
	"net/http"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/store"
	"github.com/gin-gonic/gin"
)

// ExportData exporte toutes les données en JSON téléchargeable.
// GET /api/settings/export
func ExportData(c *gin.Context) {
	data, err := store.ExportAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur export : " + err.Error()})
		return
	}
	filename := "cyber-hub-export-" + time.Now().Format("2006-01-02") + ".json"
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.JSON(http.StatusOK, data)
}

// ImportData importe des données depuis un JSON (ajout non-destructif).
// POST /api/settings/import
func ImportData(c *gin.Context) {
	var payload store.ExportPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON invalide : " + err.Error()})
		return
	}
	result, err := store.ImportAll(&payload)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur import : " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

// TriggerBackup déclenche une sauvegarde manuelle de la base de données.
// POST /api/settings/backup
func TriggerBackup(c *gin.Context) {
	path, err := store.BackupDB()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur backup : " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"message": "Backup créé avec succès",
		"path":    path,
	})
}
