package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// Claims représente le payload JWT (usage personnel = pas d'ID utilisateur)
type Claims struct {
	jwt.RegisteredClaims
}

// GenerateToken crée un JWT signé avec le secret fourni (durée 24h)
func GenerateToken(secret string) (string, error) {
	claims := Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "cyber-hub",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// AuthRequired est le middleware Gin qui vérifie le JWT.
// Accepte le token via :
//   - Header  : Authorization: Bearer <token>
func AuthRequired(getSecret func() string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenStr string

		// 1) Header Authorization
		if authHeader := c.GetHeader("Authorization"); authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && parts[0] == "Bearer" {
				tokenStr = parts[1]
			} else {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
					"error": "Format Authorization invalide (attendu: Bearer <token>)",
				})
				return
			}
		}

		if tokenStr == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Token manquant (header Authorization requis)",
			})
			return
		}

		secret := getSecret()
		if secret == "" {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}
		token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
			return []byte(secret), nil
		}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}), jwt.WithIssuer("cyber-hub"), jwt.WithExpirationRequired())

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Token invalide ou expiré",
			})
			return
		}

		// Extraire le sub si présent (utilisé dans certains handlers)
		if claims, ok := token.Claims.(*Claims); ok {
			if claims.Subject != "" {
				c.Set("sub", claims.Subject)
			}
		}

		c.Next()
	}
}
