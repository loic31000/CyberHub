package handlers

import (
	"github.com/cyber-hub/cyber-hub/internal/api/middleware"
	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/cyber-hub/cyber-hub/internal/store"
	"github.com/gin-gonic/gin"
	"net/http"
)

// GetStatus vérifie si l'application est déjà configurée
// GET /api/auth/status
func GetStatus(c *gin.Context) {
	settings, err := store.GetSettings()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur base de données"})
		return
	}
	c.JSON(http.StatusOK, models.StatusResponse{
		IsSetup: settings != nil && settings.IsSetup,
	})
}

// Setup configure le mot de passe initial (appelé une seule fois)
// POST /api/auth/setup
func Setup(c *gin.Context) {
	var req models.SetupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	settings, err := store.SetupPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Émettre un token JWT immédiatement après le setup
	token, err := middleware.GenerateToken(settings.JWTSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur génération token"})
		return
	}

	c.JSON(http.StatusOK, models.AuthResponse{
		Token:   token,
		Message: "Configuration initiale réussie",
	})
}

// Login vérifie le mot de passe et retourne un JWT
// POST /api/auth/login
func Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	settings, err := store.VerifyPassword(req.Password)
	if err != nil {
		// Sécurité : même message d'erreur pour "mauvais pass" et "non configuré"
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Mot de passe incorrect"})
		return
	}

	token, err := middleware.GenerateToken(settings.JWTSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erreur génération token"})
		return
	}

	c.JSON(http.StatusOK, models.AuthResponse{
		Token:   token,
		Message: "Connexion réussie",
	})
}
