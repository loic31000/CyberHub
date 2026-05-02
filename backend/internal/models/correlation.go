package models

import "time"

// CorrelationCache représente un cache des résultats de corrélation
// TTL : 24 heures
type CorrelationCache struct {
	ID        uint      `json:"id"         gorm:"primaryKey;autoIncrement"`
	IOCType   string    `json:"ioc_type"   gorm:"index;not null"`
	IOCValue  string    `json:"ioc_value"  gorm:"index;not null"`
	Result    string    `json:"result"     gorm:"type:text"` // JSON sérialisé du CorrelationResult
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at" gorm:"index"`
}
