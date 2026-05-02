package models

import "time"

// CloakOverride représente une modification utilisateur sur une entrée CLOAK officielle,
// ou une entrée entièrement nouvelle (custom).
// Les données officielles restent dans public/data/cloak.json (source de vérité).
// Usage légal et éducatif uniquement.
type CloakOverride struct {
	ID          uint      `json:"id"           gorm:"primaryKey;autoIncrement"`
	Ref         string    `json:"ref"          gorm:"index;default:''"` // ex: "tac-3:te-9" — vide si custom pur
	Kind        string    `json:"kind"         gorm:"not null"`         // "technique" | "subtechnique" | "procedure"
	TacticID    int       `json:"tactic_id"`
	TacticName  string    `json:"tactic_name"`
	ParentRef   string    `json:"parent_ref"   gorm:"default:''"` // ref du parent (pour sous-tech/proc)
	Name        string    `json:"name"         gorm:"not null"`
	Description string    `json:"description"  gorm:"type:text"`
	ItemType    string    `json:"item_type"    gorm:"default:''"` // "Technical" | "Behavioral" | "Physical"
	IsCustom    bool      `json:"is_custom"    gorm:"default:false"` // true = entrée 100% nouvelle
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// CloakOverrideRequest est le payload pour créer ou mettre à jour un override.
type CloakOverrideRequest struct {
	Ref         string `json:"ref"`
	Kind        string `json:"kind"        binding:"required,oneof=technique subtechnique procedure"`
	TacticID    int    `json:"tactic_id"`
	TacticName  string `json:"tactic_name"`
	ParentRef   string `json:"parent_ref"`
	Name        string `json:"name"        binding:"required,min=2"`
	Description string `json:"description"`
	ItemType    string `json:"item_type"   binding:"omitempty,oneof=Technical Behavioral Physical ''"`
	IsCustom    bool   `json:"is_custom"`
}
