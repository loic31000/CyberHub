package models

// Settings stocke la configuration de sécurité locale (un seul enregistrement)
type Settings struct {
	ID           uint   `gorm:"primaryKey"`
	PasswordHash string `gorm:"not null"`  // bcrypt hash du mot de passe
	JWTSecret    string `gorm:"not null"`  // secret JWT généré aléatoirement au setup
	IsSetup      bool   `gorm:"default:false"`
}

// SetupRequest est le payload de configuration initiale du mot de passe
type SetupRequest struct {
	Password string `json:"password" binding:"required,min=8"`
}

// LoginRequest est le payload de connexion
type LoginRequest struct {
	Password string `json:"password" binding:"required"`
}

// AuthResponse est la réponse après connexion réussie
type AuthResponse struct {
	Token   string `json:"token"`
	Message string `json:"message"`
}

// StatusResponse indique si l'application est configurée
type StatusResponse struct {
	IsSetup bool `json:"is_setup"`
}
