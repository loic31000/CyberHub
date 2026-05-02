package models

import "time"

// HashCache met en cache les résultats MalwareBazaar pour éviter les requêtes répétées.
// TTL : 6h. Indexé par hash (SHA256 / MD5 / SHA1).
type HashCache struct {
	ID        uint      `json:"id"         gorm:"primaryKey;autoIncrement"`
	Hash      string    `json:"hash"       gorm:"uniqueIndex;not null"`
	Source    string    `json:"source"`
	Result    string    `json:"result"     gorm:"type:text"` // JSON brut de l'API
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at" gorm:"index"`
}
