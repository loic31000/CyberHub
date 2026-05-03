package models

import "time"

// OSINTJob represente un job WhatsMyName (username lookup natif Go).
type OSINTJob struct {
	ID             uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	Username       string    `json:"username" gorm:"not null;index"`
	Status         string    `json:"status" gorm:"not null;default:'pending'"`
	TotalSites     int       `json:"total_sites"`
	CheckedSites   int       `json:"checked_sites"`
	FoundCount     int       `json:"found_count"`
	FilterCategory string    `json:"filter_category"`
	Results        string    `json:"results" gorm:"type:text"`
	Duration       int64     `json:"duration"`
	LaunchedBy     string    `json:"launched_by"`
}

// OSINTResult decrit le resultat d'un check sur un site.
type OSINTResult struct {
	SiteName     string `json:"site_name"`
	Category     string `json:"category"`
	URL          string `json:"url"`
	Status       string `json:"status"`
	ResponseTime int64  `json:"response_time"`
}

// WMNMeta stocke les metadonnees de la base WhatsMyName.
type WMNMeta struct {
	ID          uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	LastUpdated time.Time `json:"last_updated"`
	Version     string    `json:"version"`
	SiteCount   int       `json:"site_count"`
}
