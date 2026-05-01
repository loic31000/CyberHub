package store

import (
	"strings"

	"github.com/cyber-hub/cyber-hub/internal/models"
)

// IOCFilter regroupe les critères de filtrage pour ListIOCs.
type IOCFilter struct {
	Type   string // ip | domain | hash | url | email
	Status string // active | archived | false_positive
	TLP    string // white | green | amber | red
	Query  string // recherche sur value, source, notes
	Page   int
	Limit  int
}

// ListIOCs retourne les IOC filtrés et paginés + total.
func ListIOCs(f IOCFilter) ([]models.IOC, int64, error) {
	q := DB.Model(&models.IOC{})

	if f.Type != "" {
		q = q.Where("type = ?", f.Type)
	}
	if f.Status != "" {
		q = q.Where("status = ?", f.Status)
	} else {
		// Par défaut : masquer les false positives archivés
		q = q.Where("status != ?", "false_positive")
	}
	if f.TLP != "" {
		q = q.Where("tlp = ?", f.TLP)
	}
	if f.Query != "" {
		like := "%" + strings.ToLower(f.Query) + "%"
		q = q.Where(
			"LOWER(value) LIKE ? OR LOWER(source) LIKE ? OR LOWER(notes) LIKE ? OR LOWER(tags) LIKE ?",
			like, like, like, like,
		)
	}

	var total int64
	q.Count(&total)

	limit := f.Limit
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	page := f.Page
	if page < 1 {
		page = 1
	}
	offset := (page - 1) * limit

	var iocs []models.IOC
	err := q.Order("created_at DESC").
		Offset(offset).
		Limit(limit).
		Find(&iocs).Error

	return iocs, total, err
}

// GetIOCByID retourne un IOC par son ID.
func GetIOCByID(id uint) (*models.IOC, error) {
	var ioc models.IOC
	err := DB.First(&ioc, id).Error
	if err != nil {
		return nil, err
	}
	return &ioc, nil
}

// CreateIOC insère un nouvel IOC.
// ⚠️ Validation métier à faire dans le handler avant d'appeler cette fonction.
func CreateIOC(ioc *models.IOC) error {
	return DB.Create(ioc).Error
}

// UpdateIOC met à jour un IOC existant (par son ID).
func UpdateIOC(id uint, updates map[string]interface{}) (*models.IOC, error) {
	if err := DB.Model(&models.IOC{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, err
	}
	return GetIOCByID(id)
}

// DeleteIOC supprime un IOC par son ID.
func DeleteIOC(id uint) error {
	return DB.Delete(&models.IOC{}, id).Error
}

// IOCStats retourne un résumé statistique des IOC pour le dashboard.
func IOCStats() (map[string]interface{}, error) {
	type countRow struct {
		Type  string
		Count int64
	}
	var rows []countRow
	if err := DB.Model(&models.IOC{}).
		Select("type, count(*) as count").
		Where("status = ?", "active").
		Group("type").
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	var total int64
	DB.Model(&models.IOC{}).Where("status = ?", "active").Count(&total)

	byType := make(map[string]int64)
	for _, r := range rows {
		byType[r.Type] = r.Count
	}

	return map[string]interface{}{
		"total":   total,
		"by_type": byType,
	}, nil
}
