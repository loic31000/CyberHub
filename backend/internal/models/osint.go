package models

import "time"

// OSINTJob représente un job OSINT lancé par un utilisateur.
// ⚠️ Utilisation légale uniquement — OSINT sur systèmes autorisés seulement.
type OSINTJob struct {
	ID            uint      `json:"id"             gorm:"primaryKey;autoIncrement"`
	CreatedAt     time.Time `json:"created_at"`
	Tool          string    `json:"tool"           gorm:"not null"` // theHarvester|sherlock|maigret
	Target        string    `json:"target"         gorm:"not null"`
	Status        string    `json:"status"         gorm:"not null;default:'pending'"` // pending|running|done|error
	Output        string    `json:"output"         gorm:"type:text"`
	IOCsExtracted string    `json:"iocs_extracted" gorm:"type:text"` // JSON array
	Duration      int64     `json:"duration"`                        // milliseconds
	LaunchedBy    string    `json:"launched_by"`
}
