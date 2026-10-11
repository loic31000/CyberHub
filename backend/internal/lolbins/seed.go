package lolbins

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"log"
	"sort"
	"strings"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"gorm.io/gorm"
)

//go:embed lolbas.json
var lolbasRaw []byte

//go:embed gtfobins.json
var gtfobinsRaw []byte

type lolbasEntry struct {
	Name        string            `json:"Name"`
	Description string            `json:"Description"`
	Commands    []json.RawMessage `json:"Commands"`
	FullPath    []struct {
		Path string `json:"Path"`
	} `json:"Full_Path"`
}

type lolbasCommand struct {
	Category string              `json:"Category"`
	MitreID  string              `json:"MitreID"`
	Tags     []map[string]string `json:"Tags"`
}

type gtfobinsEntry struct {
	Functions []json.RawMessage `json:"functions"`
}

func parseLOLBAS(data []byte) ([]models.LOLBin, error) {
	var entries []lolbasEntry
	if err := json.Unmarshal(data, &entries); err != nil {
		return nil, fmt.Errorf("lolbas.json: %w", err)
	}
	if len(entries) == 0 {
		return nil, fmt.Errorf("lolbas.json: aucune entrée")
	}
	items := make([]models.LOLBin, 0, len(entries))
	for _, entry := range entries {
		if strings.TrimSpace(entry.Name) == "" {
			return nil, fmt.Errorf("lolbas.json: nom vide")
		}
		mitreSet, tagSet := map[string]struct{}{}, map[string]struct{}{}
		category := ""
		for _, raw := range entry.Commands {
			var cmd lolbasCommand
			if err := json.Unmarshal(raw, &cmd); err != nil {
				return nil, fmt.Errorf("lolbas.json %s: commande invalide: %w", entry.Name, err)
			}
			if cmd.MitreID != "" {
				mitreSet[cmd.MitreID] = struct{}{}
			}
			if category == "" && cmd.Category != "" {
				category = cmd.Category
			}
			for _, tag := range cmd.Tags {
				for key, value := range tag {
					tagSet[key+":"+value] = struct{}{}
				}
			}
		}
		mitreJSON, err := json.Marshal(sortedKeys(mitreSet))
		if err != nil {
			return nil, err
		}
		tagsJSON, err := json.Marshal(sortedKeys(tagSet))
		if err != nil {
			return nil, err
		}
		cmdsJSON, err := json.Marshal(entry.Commands)
		if err != nil {
			return nil, err
		}
		paths := make([]string, 0, len(entry.FullPath))
		for _, path := range entry.FullPath {
			paths = append(paths, path.Path)
		}
		items = append(items, models.LOLBin{
			Name: entry.Name, OS: "windows", Description: entry.Description,
			FullPath: strings.Join(paths, "; "), Commands: string(cmdsJSON),
			MitreTech: string(mitreJSON), Tags: string(tagsJSON), Category: category,
		})
	}
	return items, nil
}

func parseGTFOBins(data []byte) ([]models.LOLBin, error) {
	var entries map[string]gtfobinsEntry
	if err := json.Unmarshal(data, &entries); err != nil {
		return nil, fmt.Errorf("gtfobins.json: %w", err)
	}
	if len(entries) == 0 {
		return nil, fmt.Errorf("gtfobins.json: aucune entrée")
	}
	names := make([]string, 0, len(entries))
	for name := range entries {
		names = append(names, name)
	}
	sort.Strings(names)
	items := make([]models.LOLBin, 0, len(names))
	for _, name := range names {
		if strings.TrimSpace(name) == "" {
			return nil, fmt.Errorf("gtfobins.json: nom vide")
		}
		entry := entries[name]
		category := ""
		for i, raw := range entry.Functions {
			var function struct {
				Type string `json:"type"`
			}
			if err := json.Unmarshal(raw, &function); err != nil {
				return nil, fmt.Errorf("gtfobins.json %s: fonction invalide: %w", name, err)
			}
			if i == 0 {
				category = function.Type
			}
		}
		cmdsJSON, err := json.Marshal(entry.Functions)
		if err != nil {
			return nil, err
		}
		items = append(items, models.LOLBin{
			Name: name, OS: "linux", Description: "GTFOBin — " + name,
			FullPath: "/usr/bin/" + name, Commands: string(cmdsJSON),
			MitreTech: "[]", Tags: "[]", Category: category,
		})
	}
	return items, nil
}

func sortedKeys(set map[string]struct{}) []string {
	keys := make([]string, 0, len(set))
	for key := range set {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

// SeedLOLBins importe uniquement les couples (OS, nom) absents.
func SeedLOLBins(db *gorm.DB) error {
	return seedLOLBins(db, lolbasRaw, gtfobinsRaw)
}

func seedLOLBins(db *gorm.DB, lolbasData, gtfoData []byte) error {
	windows, err := parseLOLBAS(lolbasData)
	if err != nil {
		return err
	}
	linux, err := parseGTFOBins(gtfoData)
	if err != nil {
		return err
	}
	var winExisting, linuxExisting, winAdded, linuxAdded int
	err = db.Transaction(func(tx *gorm.DB) error {
		var existing []models.LOLBin
		if err := tx.Select("name", "os").Find(&existing).Error; err != nil {
			return fmt.Errorf("lecture LOLBins existants: %w", err)
		}
		known := make(map[string]struct{}, len(existing)+len(windows)+len(linux))
		for _, item := range existing {
			known[strings.ToLower(item.OS)+"\x00"+strings.ToLower(item.Name)] = struct{}{}
			switch strings.ToLower(item.OS) {
			case "windows":
				winExisting++
			case "linux":
				linuxExisting++
			}
		}
		missing := make([]models.LOLBin, 0, len(windows)+len(linux))
		for _, item := range append(windows, linux...) {
			key := item.OS + "\x00" + strings.ToLower(item.Name)
			if _, ok := known[key]; ok {
				continue
			}
			known[key] = struct{}{}
			missing = append(missing, item)
			if item.OS == "windows" {
				winAdded++
			} else {
				linuxAdded++
			}
		}
		if len(missing) > 0 {
			if err := tx.CreateInBatches(missing, 100).Error; err != nil {
				return fmt.Errorf("insertion LOLBins: %w", err)
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	log.Printf("[LOLBins] Chargement terminé : Windows %d existants + %d importés, Linux %d existants + %d importés", winExisting, winAdded, linuxExisting, linuxAdded)
	return nil
}
