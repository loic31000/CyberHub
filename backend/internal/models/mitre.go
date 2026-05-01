package models

import "time"

// MITRETactic représente une tactique MITRE ATT&CK (ex: TA0001 - Initial Access)
type MITRETactic struct {
	ID           uint      `json:"id"         gorm:"primaryKey;autoIncrement"`
	TacticID     string    `json:"tactic_id"  gorm:"uniqueIndex;not null"` // TA0001
	Name         string    `json:"name"        gorm:"not null"`
	ShortName    string    `json:"short_name"  gorm:"not null"` // initial-access
	Description  string    `json:"description" gorm:"type:text"`
	URL          string    `json:"url"`
	DisplayOrder int       `json:"display_order" gorm:"not null;default:0"` // ordre kill chain
	CreatedAt    time.Time `json:"created_at"`
}

// MITRETechnique représente une technique ou sous-technique MITRE ATT&CK
// (ex: T1046 - Network Service Discovery)
type MITRETechnique struct {
	ID             uint      `json:"id"              gorm:"primaryKey;autoIncrement"`
	TechniqueID    string    `json:"technique_id"    gorm:"uniqueIndex;not null"` // T1046 ou T1046.001
	Name           string    `json:"name"            gorm:"not null"`
	Description    string    `json:"description"     gorm:"type:text"`
	Tactics        string    `json:"tactics"         gorm:"type:text"` // JSON array ["discovery","collection"]
	Platforms      string    `json:"platforms"       gorm:"type:text"` // JSON array ["Windows","Linux"]
	IsSubtechnique bool      `json:"is_subtechnique" gorm:"not null;default:false"`
	ParentID       string    `json:"parent_id"       gorm:"index"` // ex: T1046 pour T1046.001
	Detection      string    `json:"detection"       gorm:"type:text"`
	URL            string    `json:"url"`
	DataSources    string    `json:"data_sources"    gorm:"type:text"` // JSON array
	CreatedAt      time.Time `json:"created_at"`
}
