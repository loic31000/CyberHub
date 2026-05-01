package store

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"github.com/cyber-hub/cyber-hub/internal/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// GetSettings récupère la configuration (crée un enregistrement vide si absent)
func GetSettings() (*models.Settings, error) {
	var s models.Settings
	err := DB.First(&s).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil // pas encore configuré
	}
	return &s, err
}

// SetupPassword configure le mot de passe initial et génère le secret JWT
func SetupPassword(password string) (*models.Settings, error) {
	// Vérifier qu'on n'est pas déjà configuré
	existing, err := GetSettings()
	if err != nil {
		return nil, err
	}
	if existing != nil && existing.IsSetup {
		return nil, errors.New("application déjà configurée")
	}

	// Hash bcrypt du mot de passe (coût 12 — bon équilibre sécurité/vitesse)
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return nil, err
	}

	// Génération d'un secret JWT aléatoire (32 bytes = 256 bits)
	jwtSecretBytes := make([]byte, 32)
	if _, err = rand.Read(jwtSecretBytes); err != nil {
		return nil, err
	}
	jwtSecret := hex.EncodeToString(jwtSecretBytes)

	settings := models.Settings{
		ID:           1, // entrée unique
		PasswordHash: string(hash),
		JWTSecret:    jwtSecret,
		IsSetup:      true,
	}

	if err = DB.Save(&settings).Error; err != nil {
		return nil, err
	}

	return &settings, nil
}

// VerifyPassword vérifie le mot de passe fourni contre le hash stocké
func VerifyPassword(password string) (*models.Settings, error) {
	settings, err := GetSettings()
	if err != nil {
		return nil, err
	}
	if settings == nil || !settings.IsSetup {
		return nil, errors.New("application non configurée")
	}

	if err = bcrypt.CompareHashAndPassword([]byte(settings.PasswordHash), []byte(password)); err != nil {
		return nil, errors.New("mot de passe incorrect")
	}

	return settings, nil
}
