package cisa

import (
	_ "embed"
	"encoding/json"
	"log"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"gorm.io/gorm"
)

//go:embed kev.json
var kevDataRaw []byte

type kevJSON struct {
	Vulnerabilities []struct {
		CveID             string `json:"cveID"`
		VendorProject     string `json:"vendorProject"`
		Product           string `json:"product"`
		VulnerabilityName string `json:"vulnerabilityName"`
		DateAdded         string `json:"dateAdded"`
		ShortDescription  string `json:"shortDescription"`
		RequiredAction    string `json:"requiredAction"`
		DueDate           string `json:"dueDate"`
		Notes             string `json:"notes"`
	} `json:"vulnerabilities"`
}

func SeedKEV(db *gorm.DB) {
	var count int64
	db.Model(&models.CISAKEVEntry{}).Count(&count)
	if count > 0 {
		return
	}
	var kev kevJSON
	if err := json.Unmarshal(kevDataRaw, &kev); err != nil {
		log.Printf("[CISA] Erreur parsing kev.json: %v", err)
		return
	}
	batch := make([]models.CISAKEVEntry, 0, 100)
	for _, v := range kev.Vulnerabilities {
		batch = append(batch, models.CISAKEVEntry{
			CveID:             v.CveID,
			VendorProject:     v.VendorProject,
			Product:           v.Product,
			VulnerabilityName: v.VulnerabilityName,
			DateAdded:         v.DateAdded,
			ShortDescription:  v.ShortDescription,
			RequiredAction:    v.RequiredAction,
			DueDate:           v.DueDate,
			Notes:             v.Notes,
		})
		if len(batch) >= 100 {
			db.CreateInBatches(batch, 100)
			batch = batch[:0]
		}
	}
	if len(batch) > 0 {
		db.CreateInBatches(batch, 100)
	}
	log.Printf("[CISA] KEV seeded: %d entrées", len(kev.Vulnerabilities))
}
