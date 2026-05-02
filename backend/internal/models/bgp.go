package models

import "time"

// BGPCache stocke les réponses de l'API BGPView avec TTL 1h (clés composites)
// ⚠️ Usage légal uniquement — respecter les CGU de bgpview.io
type BGPCache struct {
	ID        uint      `gorm:"primarykey"`
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
	ID           uint      `gorm:"primarykey"`
	CreatedAt    time.Time
	ASN          int       `gorm:"index"`
	SnapshotDate time.Time `gorm:"index"`
	// FullDataJSON : JSON complet (info + prefixes + peers + upstreams + downstreams)
	FullDataJSON string `gorm:"type:text"`
	TakenBy      string // username JWT
}

// BGPAlert représente une alerte générée lors d'une comparaison de deux snapshots
// AlertType : "prefix_change" | "upstream_change" | "peer_change" | "downstream_change"
type BGPAlert struct {
	ID           uint      `gorm:"primarykey"`
	CreatedAt    time.Time
	ASN          int       `gorm:"index"`
	AlertType    string    // "prefix_change" | "upstream_change" | "peer_change" | "downstream_change"
	OldValue     string    `gorm:"type:text"` // JSON du champ avant changement
	NewValue     string    `gorm:"type:text"` // JSON du champ après changement
	DetectedAt   time.Time
	Acknowledged bool `gorm:"index"`
}
