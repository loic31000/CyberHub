package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type rlEntry struct {
	count   int
	resetAt time.Time
}

// RateLimiter implémente un compteur de requêtes par IP en mémoire.
// Thread-safe via sync.Mutex. Nettoyage automatique des entrées expirées.
type RateLimiter struct {
	mu      sync.Mutex
	entries map[string]*rlEntry
	max     int
	window  time.Duration
}

// NewRateLimiter crée un limiter : au plus max requêtes sur la durée window.
// Exemple : NewRateLimiter(5, time.Minute) = 5 requêtes par minute par IP.
func NewRateLimiter(max int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		entries: make(map[string]*rlEntry),
		max:     max,
		window:  window,
	}
	// Goroutine de nettoyage des entrées expirées
	go func() {
		ticker := time.NewTicker(window)
		defer ticker.Stop()
		for range ticker.C {
			rl.mu.Lock()
			now := time.Now()
			for k, e := range rl.entries {
				if now.After(e.resetAt) {
					delete(rl.entries, k)
				}
			}
			rl.mu.Unlock()
		}
	}()
	return rl
}

// Middleware retourne le handler Gin à insérer sur une route.
func (rl *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.ClientIP()

		rl.mu.Lock()
		now := time.Now()
		e, exists := rl.entries[key]
		if !exists || now.After(e.resetAt) {
			rl.entries[key] = &rlEntry{count: 1, resetAt: now.Add(rl.window)}
			rl.mu.Unlock()
			c.Next()
			return
		}
		e.count++
		if e.count > rl.max {
			rl.mu.Unlock()
			remaining := time.Until(e.resetAt).Round(time.Second)
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "Trop de tentatives. Réessayez dans " + remaining.String() + ".",
			})
			return
		}
		rl.mu.Unlock()
		c.Next()
	}
}
