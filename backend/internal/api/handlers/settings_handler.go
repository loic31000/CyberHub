package handlers

import (
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/mitre"
	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/cyber-hub/cyber-hub/internal/store"
	"github.com/gin-gonic/gin"
)

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

func TriggerBackup(c *gin.Context) {
	path, err := store.BackupDB()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur backup : " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Backup cree avec succes", "path": path})
}

func GetDBVersions(c *gin.Context) {
	var mitreCount int64
	var lastTactic models.MITRETactic
	store.DB.Model(&models.MITRETechnique{}).Count(&mitreCount)
	store.DB.Order("created_at DESC").First(&lastTactic)

	var cloakCount int64
	var lastCloak models.CloakOverride
	store.DB.Model(&models.CloakOverride{}).Count(&cloakCount)
	store.DB.Order("updated_at DESC").First(&lastCloak)

	var wmnMeta models.WMNMeta
	store.DB.First(&wmnMeta)

	c.JSON(http.StatusOK, gin.H{
		"mitre": gin.H{
			"technique_count": mitreCount,
			"last_updated":    lastTactic.CreatedAt,
			"seeded":          mitreCount > 0,
		},
		"cloak": gin.H{
			"technique_count": cloakCount,
			"last_updated":    lastCloak.UpdatedAt,
		},
		"wmn": gin.H{
			"site_count":   wmnMeta.SiteCount,
			"last_updated": wmnMeta.LastUpdated,
		},
	})
}

func UpdateMITRE(c *gin.Context) {
	if mitre.IsSeeding() {
		c.JSON(http.StatusConflict, gin.H{"error": "Un seed MITRE est deja en cours"})
		return
	}
	store.DB.Exec("DELETE FROM mitre_techniques")
	store.DB.Exec("DELETE FROM mitre_tactics")

	errCh := make(chan error, 1)
	go func() { errCh <- mitre.RunSeed() }()

	select {
	case err := <-errCh:
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Erreur MITRE : %v", err)})
			return
		}
	case <-time.After(90 * time.Second):
		c.JSON(http.StatusAccepted, gin.H{"success": true, "message": "Seed MITRE lance en arriere-plan"})
		return
	}

	var count int64
	store.DB.Model(&models.MITRETechnique{}).Count(&count)
	c.JSON(http.StatusOK, gin.H{"success": true, "technique_count": count, "updated_at": time.Now()})
}

func UpdateCLOAK(c *gin.Context) {
	const cloakURL = "https://raw.githubusercontent.com/mickdeben/concealment/main/concealment-data.json"
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(cloakURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Telechargement echoue : %v", err)})
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("HTTP %d", resp.StatusCode)})
		return
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Lecture echouee"})
		return
	}
	count := 0
	for _, b := range body {
		if b == '{' {
			count++
		}
	}
	if count > 2 {
		count = count / 2
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "technique_count": count, "updated_at": time.Now()})
}
