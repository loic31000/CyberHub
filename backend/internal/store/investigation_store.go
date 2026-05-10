package store

import (
	"strings"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/models"
)

type InvestigationFilter struct {
	Status string
	Query  string
	Page   int
	Limit  int
}

func ListInvestigations(f InvestigationFilter) ([]models.Investigation, int64, error) {
	q := DB.Model(&models.Investigation{})
	if f.Status != "" {
		q = q.Where("status = ?", f.Status)
	}
	if f.Query != "" {
		like := "%" + strings.ToLower(f.Query) + "%"
		q = q.Where("LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(tags) LIKE ?", like, like, like)
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
	var items []models.Investigation
	err := q.Order("created_at DESC").Offset(offset).Limit(limit).Find(&items).Error
	return items, total, err
}

func GetInvestigationByID(id uint) (*models.Investigation, error) {
	var inv models.Investigation
	if err := DB.First(&inv, id).Error; err != nil {
		return nil, err
	}
	return &inv, nil
}

func CreateInvestigation(inv *models.Investigation) error {
	return DB.Create(inv).Error
}

func UpdateInvestigation(id uint, updates map[string]interface{}) (*models.Investigation, error) {
	if err := DB.Model(&models.Investigation{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, err
	}
	return GetInvestigationByID(id)
}

func DeleteInvestigation(id uint) error {
	if err := DB.Where("investigation_id = ?", id).Delete(&models.InvestigationEvent{}).Error; err != nil {
		return err
	}
	return DB.Delete(&models.Investigation{}, id).Error
}

type EventFilter struct {
	EventType string
	Severity  string
	Order     string
}

func ListEvents(investigationID uint, f EventFilter) ([]models.InvestigationEvent, error) {
	q := DB.Model(&models.InvestigationEvent{}).Where("investigation_id = ?", investigationID)
	if f.EventType != "" {
		q = q.Where("event_type = ?", f.EventType)
	}
	if f.Severity != "" {
		q = q.Where("severity = ?", f.Severity)
	}
	dir := "ASC"
	if strings.ToLower(f.Order) == "desc" {
		dir = "DESC"
	}
	var events []models.InvestigationEvent
	err := q.Order("timestamp " + dir + ", id " + dir).Find(&events).Error
	return events, err
}

func CreateEvent(event *models.InvestigationEvent) error {
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}
	return DB.Create(event).Error
}

func UpdateEvent(id uint, updates map[string]interface{}) (*models.InvestigationEvent, error) {
	if err := DB.Model(&models.InvestigationEvent{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, err
	}
	var event models.InvestigationEvent
	if err := DB.First(&event, id).Error; err != nil {
		return nil, err
	}
	return &event, nil
}

func DeleteEvent(id uint) error {
	return DB.Delete(&models.InvestigationEvent{}, id).Error
}
