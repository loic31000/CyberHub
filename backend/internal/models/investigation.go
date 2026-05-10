package models

import "time"

type InvestigationStatus string

const (
	InvestigationStatusOpen     InvestigationStatus = "open"
	InvestigationStatusClosed   InvestigationStatus = "closed"
	InvestigationStatusArchived InvestigationStatus = "archived"
)

type EventType string

const (
	EventTypeIOC      EventType = "ioc"
	EventTypeNote     EventType = "note"
	EventTypeCVE      EventType = "cve"
	EventTypeBGP      EventType = "bgp"
	EventTypeMITRE    EventType = "mitre"
	EventTypePlaybook EventType = "playbook"
	EventTypeManual   EventType = "manual"
)

type EventSeverity string

const (
	EventSeverityInfo     EventSeverity = "info"
	EventSeverityLow      EventSeverity = "low"
	EventSeverityMedium   EventSeverity = "medium"
	EventSeverityHigh     EventSeverity = "high"
	EventSeverityCritical EventSeverity = "critical"
)

type Investigation struct {
	ID          uint                `json:"id"          gorm:"primaryKey;autoIncrement"`
	Title       string              `json:"title"       gorm:"type:text;not null"`
	Description string              `json:"description" gorm:"type:text"`
	Status      InvestigationStatus `json:"status"      gorm:"type:text;not null;default:'open';index"`
	Tags        string              `json:"tags"        gorm:"type:text"`
	CreatedAt   time.Time           `json:"created_at"`
	UpdatedAt   time.Time           `json:"updated_at"`
}

type InvestigationEvent struct {
	ID              uint          `json:"id"               gorm:"primaryKey;autoIncrement"`
	InvestigationID uint          `json:"investigation_id" gorm:"not null;index"`
	Timestamp       time.Time     `json:"timestamp"        gorm:"not null;index"`
	Title           string        `json:"title"            gorm:"type:text;not null"`
	Description     string        `json:"description"      gorm:"type:text"`
	EventType       EventType     `json:"event_type"       gorm:"type:text;not null;default:'manual';index"`
	Severity        EventSeverity `json:"severity"         gorm:"type:text;default:'info'"`
	SourceModule    string        `json:"source_module"    gorm:"type:text"`
	SourceEntityID  string        `json:"source_entity_id" gorm:"type:text"`
	Metadata        string        `json:"metadata"         gorm:"type:text"`
	CreatedAt       time.Time     `json:"created_at"`
	UpdatedAt       time.Time     `json:"updated_at"`
}
