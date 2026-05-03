package lolbins

import (
	_ "embed"
	"encoding/json"
	"log"
	"strings"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"gorm.io/gorm"
)

//go:embed lolbas.json
var lolbasRaw []byte

//go:embed gtfobins.json
var gtfobinsRaw []byte

type lolbasEntry struct {
	Name        string `json:"Name"`
	Description string `json:"Description"`
	Commands    []struct {
		Command     string   `json:"Command"`
		Description string   `json:"Description"`
		Usecase     string   `json:"Usecase"`
		Category    string   `json:"Category"`
		Privileges  string   `json:"Privileges"`
		MitreID     string   `json:"MitreID"`
		Tags        []string `json:"Tags"`
	} `json:"Commands"`
	FullPath []struct {
		Path string `json:"Path"`
	} `json:"Full_Path"`
	Detection []struct {
		IOC string `json:"IOC"`
	} `json:"Detection"`
}

type gtfobinsEntry struct {
	Functions []struct {
		Type        string `json:"type"`
		Description string `json:"description"`
		Commands    string `json:"commands"`
	} `json:"functions"`
}

func SeedLOLBins(db *gorm.DB) {
	var winCount, linuxCount int64
	db.Model(&models.LOLBin{}).Where("os = ?", "windows").Count(&winCount)
	db.Model(&models.LOLBin{}).Where("os = ?", "linux").Count(&linuxCount)

	if winCount > 0 && linuxCount > 0 {
		return
	}

	batch := make([]models.LOLBin, 0, 100)

	// Seed LOLBAS (Windows)
	var lolbasList []lolbasEntry
	if winCount == 0 {
	if err := json.Unmarshal(lolbasRaw, &lolbasList); err != nil {
		log.Printf("[LOLBins] Erreur parsing lolbas.json: %v", err)
	}
	for _, e := range lolbasList {
		mitreSet := map[string]struct{}{}
		category := ""
		for _, cmd := range e.Commands {
			if cmd.MitreID != "" {
				mitreSet[cmd.MitreID] = struct{}{}
			}
			if category == "" && cmd.Category != "" {
				category = cmd.Category
			}
		}
		mitreTechs := make([]string, 0, len(mitreSet))
		for k := range mitreSet {
			mitreTechs = append(mitreTechs, k)
		}
		mitreJSON, _ := json.Marshal(mitreTechs)
		cmdsJSON, _ := json.Marshal(e.Commands)
		paths := make([]string, 0)
		for _, p := range e.FullPath {
			paths = append(paths, p.Path)
		}
		fullPath := strings.Join(paths, "; ")

		batch = append(batch, models.LOLBin{
			Name:        e.Name,
			OS:          "windows",
			Description: e.Description,
			FullPath:    fullPath,
			Commands:    string(cmdsJSON),
			MitreTech:   string(mitreJSON),
			Tags:        "[]",
			Category:    category,
		})
		if len(batch) >= 100 {
			db.CreateInBatches(batch, 100)
			batch = batch[:0]
		}
	}
	} // end winCount == 0

	// Seed GTFOBins (Linux)
	var gtfoMap map[string]gtfobinsEntry
	if linuxCount == 0 {
	if err := json.Unmarshal(gtfobinsRaw, &gtfoMap); err != nil {
		log.Printf("[LOLBins] Erreur parsing gtfobins.json: %v", err)
	}
	for name, entry := range gtfoMap {
		category := ""
		if len(entry.Functions) > 0 {
			category = entry.Functions[0].Type
		}
		cmdsJSON, _ := json.Marshal(entry.Functions)
		batch = append(batch, models.LOLBin{
			Name:        name,
			OS:          "linux",
			Description: "GTFOBin — " + name,
			FullPath:    "/usr/bin/" + name,
			Commands:    string(cmdsJSON),
			MitreTech:   "[]",
			Tags:        "[]",
			Category:    category,
		})
		if len(batch) >= 100 {
			db.CreateInBatches(batch, 100)
			batch = batch[:0]
		}
	}
	} // end linuxCount == 0

	// Flush dernier batch (Windows ou Linux)
	if len(batch) > 0 {
		db.CreateInBatches(batch, 100)
	}
	log.Printf("[LOLBins] Seeded: win=%d existing + %d new, linux=%d existing + %d new",
		winCount, len(lolbasList), linuxCount, len(gtfoMap))
}
