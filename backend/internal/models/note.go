package models

import "time"

// Note représente une note opérationnelle liée à des IOCs, techniques ou CVE.
type Note struct {
	ID               uint      `json:"id"                  gorm:"primaryKey;autoIncrement"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
	Title            string    `json:"title"               gorm:"not null"`
	Content          string    `json:"content"             gorm:"type:text"`
	Tags             string    `json:"tags"                gorm:"type:text"` // JSON array
	LinkedIOCs       string    `json:"linked_iocs"         gorm:"type:text"` // JSON array of IDs
	LinkedTechniques string    `json:"linked_techniques"   gorm:"type:text"` // JSON array
	LinkedCVEs       string    `json:"linked_cves"         gorm:"type:text"` // JSON array
	CreatedBy        string    `json:"created_by"`
}
