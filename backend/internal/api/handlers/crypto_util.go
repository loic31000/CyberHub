package handlers

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"gorm.io/gorm"
)

// getAESKey dérive une clé AES-256 depuis le secret JWT stocké en DB.
func getAESKey(db *gorm.DB) ([]byte, error) {
	var s models.Settings
	if err := db.First(&s).Error; err != nil {
		return nil, errors.New("impossible de lire le secret JWT")
	}
	key := sha256.Sum256([]byte(s.JWTSecret))
	return key[:], nil
}

// encryptSetting chiffre plaintext avec AES-256-GCM.
// Format de stockage : base64(nonce || ciphertext+tag).
func encryptSetting(db *gorm.DB, plaintext string) (string, error) {
	key, err := getAESKey(db)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	sealed := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(sealed), nil
}

// decryptSetting déchiffre une valeur produite par encryptSetting.
// Retourne ("", false) si le déchiffrement échoue (ex : valeur en clair antérieure).
func decryptSetting(db *gorm.DB, ciphertext string) (string, bool) {
	key, err := getAESKey(db)
	if err != nil {
		return "", false
	}
	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", false
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", false
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", false
	}
	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", false
	}
	plaintext, err := gcm.Open(nil, data[:nonceSize], data[nonceSize:], nil)
	if err != nil {
		return "", false
	}
	return string(plaintext), true
}
