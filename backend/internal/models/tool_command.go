package models

// ToolCommand représente une commande pré-définie suggérée pour un outil.
// Ces suggestions s'affichent sous l'input d'arguments dans le Docker Runner,
// filtrant en temps réel selon la saisie de l'utilisateur.
type ToolCommand struct {
	ID          uint   `json:"id"          gorm:"primaryKey;autoIncrement"`
	ToolID      uint   `json:"tool_id"     gorm:"not null;index"`
	Label       string `json:"label"       gorm:"not null"` // texte court affiché (ex: "-sV — Détection de version")
	Command     string `json:"command"     gorm:"not null"` // args pré-remplis dans l'input
	Description string `json:"description"`                  // explication détaillée (tooltip)
	SortOrder   int    `json:"sort_order"  gorm:"default:0"`
}
