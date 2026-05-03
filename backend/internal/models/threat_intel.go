package models

import (
	"time"

	"gorm.io/gorm"
)

type CISAKEVEntry struct {
	gorm.Model
	CveID             string `gorm:"uniqueIndex" json:"cve_id"`
	VendorProject     string `json:"vendor_project"`
	Product           string `json:"product"`
	VulnerabilityName string `json:"vulnerability_name"`
	DateAdded         string `json:"date_added"`
	ShortDescription  string `json:"short_description"`
	RequiredAction    string `json:"required_action"`
	DueDate           string `json:"due_date"`
	Notes             string `json:"notes"`
}

type EPSSScore struct {
	gorm.Model
	CveID      string    `gorm:"uniqueIndex" json:"cve_id"`
	Score      float64   `json:"score"`
	Percentile float64   `json:"percentile"`
	Date       string    `json:"date"`
	FetchedAt  time.Time `json:"fetched_at"`
	ExpiresAt  time.Time `json:"expires_at"`
}

type ThreatFeedSync struct {
	gorm.Model
	FeedName  string    `gorm:"uniqueIndex" json:"feed_name"`
	LastSync  time.Time `json:"last_sync"`
	ItemCount int       `json:"item_count"`
	NewItems  int       `json:"new_items"`
}
