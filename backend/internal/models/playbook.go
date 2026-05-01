package models

import "time"

// PlaybookStep représente une étape d'un playbook (case à cocher)
type PlaybookStep struct {
	ID         uint   `json:"id"          gorm:"primaryKey;autoIncrement"`
	PlaybookID uint   `json:"playbook_id" gorm:"not null;index"`
	Order      int    `json:"order"`
	Content    string `json:"content"     gorm:"not null"`
	Checked    bool   `json:"checked"     gorm:"default:false"`
}

// Playbook représente un scénario de réponse à incident avec checklist
type Playbook struct {
	ID          uint           `json:"id"          gorm:"primaryKey;autoIncrement"`
	Title       string         `json:"title"       gorm:"not null"`
	Scenario    string         `json:"scenario"`   // ransomware, phishing, brute-force...
	Description string         `json:"description"`
	Steps       []PlaybookStep `json:"steps"       gorm:"foreignKey:PlaybookID;constraint:OnDelete:CASCADE"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

type PlaybookStepRequest struct {
	Content string `json:"content" binding:"required"`
	Order   int    `json:"order"`
}

type PlaybookCreateRequest struct {
	Title       string                `json:"title"       binding:"required,min=2"`
	Scenario    string                `json:"scenario"`
	Description string                `json:"description"`
	Steps       []PlaybookStepRequest `json:"steps"`
}
