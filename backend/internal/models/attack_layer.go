package models

import "time"

type AttackLayer struct {
	ID          uint      `json:"id"          gorm:"primaryKey;autoIncrement"`
	Name        string    `json:"name"        gorm:"type:text;not null"`
	Description string    `json:"description" gorm:"type:text"`
	Domain      string    `json:"domain"      gorm:"type:text;not null;default:'enterprise-attack'"`
	Version     string    `json:"version"     gorm:"type:text;not null;default:'4.5'"`
	LayerData   string    `json:"layer_data"  gorm:"type:text"` // JSON array of LayerEntry
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
