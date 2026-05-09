package store

import (
	"encoding/json"
	"strings"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"gorm.io/gorm/clause"
)

// ─── Seed / état ─────────────────────────────────────────────────────────────

// IsMITRESeeded retourne true si la table mitre_techniques contient au moins une entrée.
func IsMITRESeeded() bool {
	var count int64
	DB.Model(&models.MITRETechnique{}).Count(&count)
	return count > 0
}

// SeedMITRE insère ou met à jour les tactiques et techniques (ON CONFLICT DO UPDATE).
func SeedMITRE(tactics []models.MITRETactic, techniques []models.MITRETechnique) error {
	const batch = 200

	tacticCols := clause.OnConflict{
		Columns: []clause.Column{{Name: "tactic_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"name", "short_name", "description", "url", "display_order",
		}),
	}
	if err := DB.Clauses(tacticCols).CreateInBatches(tactics, batch).Error; err != nil {
		return err
	}

	techCols := clause.OnConflict{
		Columns: []clause.Column{{Name: "technique_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"name", "description", "tactics", "platforms",
			"is_subtechnique", "parent_id", "detection", "url", "data_sources",
		}),
	}
	return DB.Clauses(techCols).CreateInBatches(techniques, batch).Error
}

// ─── Lecture ─────────────────────────────────────────────────────────────────

// ListMITRETactics retourne toutes les tactiques triées par ordre kill chain.
func ListMITRETactics() ([]models.MITRETactic, error) {
	var tactics []models.MITRETactic
	err := DB.Order("display_order ASC").Find(&tactics).Error
	return tactics, err
}

// MITRETechniquesFilter regroupe les filtres de ListMITRETechniques.
type MITRETechniquesFilter struct {
	Tactic         string // shortname tactic (ex: "discovery")
	Platform       string // ex: "Windows"
	Query          string // recherche full-text (name + technique_id)
	OnlyTechniques bool   // exclure les sous-techniques
	Page           int
	Limit          int
}

// ListMITRETechniques retourne les techniques avec filtres, pagination et total.
func ListMITRETechniques(f MITRETechniquesFilter) ([]models.MITRETechnique, int64, error) {
	q := DB.Model(&models.MITRETechnique{})

	// Filtre tactic (JSON array contient le shortname)
	if f.Tactic != "" {
		q = q.Where("tactics LIKE ?", "%"+f.Tactic+"%")
	}
	// Filtre platform
	if f.Platform != "" {
		q = q.Where("platforms LIKE ?", "%"+f.Platform+"%")
	}
	// Recherche texte
	if f.Query != "" {
		like := "%" + strings.ToLower(f.Query) + "%"
		q = q.Where("LOWER(name) LIKE ? OR LOWER(technique_id) LIKE ?", like, like)
	}
	// Sous-techniques
	if f.OnlyTechniques {
		q = q.Where("is_subtechnique = ?", false)
	}

	var total int64
	q.Count(&total)

	// Pagination
	limit := f.Limit
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	page := f.Page
	if page < 1 {
		page = 1
	}
	offset := (page - 1) * limit

	var techniques []models.MITRETechnique
	err := q.Order("technique_id ASC").
		Offset(offset).
		Limit(limit).
		// Ne pas retourner description/detection dans la liste (performance)
		Select("id, technique_id, name, tactics, platforms, is_subtechnique, parent_id, url, created_at").
		Find(&techniques).Error

	return techniques, total, err
}

// GetMITRETechniqueByID retourne une technique complète (avec description + detection).
func GetMITRETechniqueByID(techniqueID string) (*models.MITRETechnique, error) {
	var t models.MITRETechnique
	err := DB.Where("technique_id = ?", techniqueID).First(&t).Error
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// ─── Helpers JSON ────────────────────────────────────────────────────────────

// ParseJSONStringSlice désérialise un champ JSON text stocké en BDD.
func ParseJSONStringSlice(raw string) []string {
	var s []string
	_ = json.Unmarshal([]byte(raw), &s)
	return s
}
