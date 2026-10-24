package models

import (
	"encoding/json"
	"time"
)

// BGPCache stocke les réponses RIPE Stat et leur expiration (clés composites).
// ⚠️ Usage légal uniquement — respecter les CGU de bgpview.io
type BGPCache struct {
	ID        uint `gorm:"primarykey"`
	CreatedAt time.Time
	UpdatedAt time.Time
	// CacheKey : clé composite ex: "asn:13335:full", "asn:13335:prefixes", "ip:8.8.8.8", "search:google"
	CacheKey  string    `gorm:"uniqueIndex;size:255"`
	Response  string    `gorm:"type:text"` // JSON brut de la réponse BGPView
	ExpiresAt time.Time `gorm:"index"`
}

// BGPSnapshot capture l'état complet d'un AS à un instant T
// FullDataJSON = { info, prefixes, peers, upstreams, downstreams }
type BGPSnapshot struct {
	ID           uint `gorm:"primarykey"`
	CreatedAt    time.Time
	ASN          int       `gorm:"index"`
	SnapshotDate time.Time `gorm:"index"`
	// FullDataJSON : JSON complet (info + prefixes + peers + upstreams + downstreams)
	FullDataJSON string `gorm:"type:text"`
	// DataProvenanceJSON stores per-section fetch origin and source retrieval time.
	// Empty on legacy snapshots, whose provenance is unknown.
	DataProvenanceJSON string `gorm:"type:text" json:"-"`
	TakenBy            string // username JWT
}

// BGPAlert représente une alerte générée lors d'une comparaison de deux snapshots
// AlertType : "prefix_change" | "upstream_change" | "peer_change" | "downstream_change"
type BGPAlert struct {
	ID           uint      `gorm:"primarykey" json:"id"`
	CreatedAt    time.Time `json:"created_at"`
	ASN          int       `gorm:"index" json:"asn"`
	AlertType    string    `json:"alert_type"`                 // "prefix_change" | "upstream_change" | "peer_change" | "downstream_change"
	OldValue     string    `gorm:"type:text" json:"old_value"` // JSON du champ avant changement
	NewValue     string    `gorm:"type:text" json:"new_value"` // JSON du champ après changement
	DetectedAt   time.Time `json:"detected_at"`
	Acknowledged bool      `gorm:"index" json:"acknowledged"`
}

// MarshalJSON emits the canonical snake_case contract and the historical Go
// field names for existing consumers. The PascalCase aliases can be removed
// only in a separately announced breaking API version.
func (a BGPAlert) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		ID                 uint      `json:"id"`
		CreatedAt          time.Time `json:"created_at"`
		ASN                int       `json:"asn"`
		AlertType          string    `json:"alert_type"`
		OldValue           string    `json:"old_value"`
		NewValue           string    `json:"new_value"`
		DetectedAt         time.Time `json:"detected_at"`
		Acknowledged       bool      `json:"acknowledged"`
		LegacyID           uint      `json:"ID"`
		LegacyCreatedAt    time.Time `json:"CreatedAt"`
		LegacyASN          int       `json:"ASN"`
		LegacyAlertType    string    `json:"AlertType"`
		LegacyOldValue     string    `json:"OldValue"`
		LegacyNewValue     string    `json:"NewValue"`
		LegacyDetectedAt   time.Time `json:"DetectedAt"`
		LegacyAcknowledged bool      `json:"Acknowledged"`
	}{
		ID: a.ID, CreatedAt: a.CreatedAt, ASN: a.ASN, AlertType: a.AlertType,
		OldValue: a.OldValue, NewValue: a.NewValue, DetectedAt: a.DetectedAt, Acknowledged: a.Acknowledged,
		LegacyID: a.ID, LegacyCreatedAt: a.CreatedAt, LegacyASN: a.ASN, LegacyAlertType: a.AlertType,
		LegacyOldValue: a.OldValue, LegacyNewValue: a.NewValue, LegacyDetectedAt: a.DetectedAt,
		LegacyAcknowledged: a.Acknowledged,
	})
}
