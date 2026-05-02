package models

import "time"

// CloakAnnotation — couche d'annotation personnelle au-dessus du framework CLOAK.
// ⚠️ Le contenu source CLOAK reste intact et immuable.
// Seule cette table est modifiée ; un reset supprime la ligne, pas la fiche CLOAK.
type CloakAnnotation struct {
	ID           uint      `json:"id"            gorm:"primaryKey"`
	TechniqueRef string    `json:"technique_ref" gorm:"not null;uniqueIndex"` // ex: "tac-3:te-9" ou "tac-3:te-9:sub-2"
	UserNotes    string    `json:"user_notes"`    // markdown libre (observations, commandes testées…)
	Status       string    `json:"status"`        // "a_tester" | "vu_en_lab" | "maitrise" | ""
	CounterNotes string    `json:"counter_notes"` // contre-mesures personnelles (règles Sigma, SIEM…)
	Tags         string    `json:"tags"`          // JSON array ou CSV libre
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type CloakAnnotationRequest struct {
	TechniqueRef string `json:"technique_ref" binding:"required"`
	UserNotes    string `json:"user_notes"`
	Status       string `json:"status"`
	CounterNotes string `json:"counter_notes"`
	Tags         string `json:"tags"`
}
