package models

import "time"

// IOCType catégorise le type d'indicateur de compromission
type IOCType string

const (
	IOCTypeIP     IOCType = "ip"
	IOCTypeDomain IOCType = "domain"
	IOCTypeHash   IOCType = "hash"
	IOCTypeURL    IOCType = "url"
	IOCTypeEmail  IOCType = "email"
	IOCTypeCIDR   IOCType = "cidr" // Ajout BGP Lookup
)

// IOCTLP represente le niveau de sensibilite TLP
type IOCTLP string

const (
	TLPWhite IOCTLP = "white"
	TLPGreen IOCTLP = "green"
	TLPAmber IOCTLP = "amber"
	TLPRed   IOCTLP = "red"
)

// IOCStatus represente l'etat de l'indicateur
type IOCStatus string

const (
	IOCStatusActive        IOCStatus = "active"
	IOCStatusArchived      IOCStatus = "archived"
	IOCStatusFalsePositive IOCStatus = "false_positive"
)

// IOC - Indicateur de Compromission
type IOC struct {
	ID          uint      `json:"id"            gorm:"primaryKey;autoIncrement"`
	Type        IOCType   `json:"type"          gorm:"type:text;not null;index"`
	Value       string    `json:"value"         gorm:"type:text;not null;index"`
	Source      string    `json:"source"        gorm:"type:text"`
	TLP         IOCTLP    `json:"tlp"           gorm:"type:text;not null;default:'white'"`
	Status      IOCStatus `json:"status"        gorm:"type:text;not null;default:'active';index"`
	Tags        string    `json:"tags"          gorm:"type:text"`
	Notes       string    `json:"notes"         gorm:"type:text"`
	MitreTechID string    `json:"mitre_tech_id" gorm:"type:text;index"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
