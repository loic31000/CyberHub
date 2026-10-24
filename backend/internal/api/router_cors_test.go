package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func TestDevelopmentFrontendOriginsAreAllowedWithoutWildcard(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(cors.New(corsConfig()))
	router.GET("/api/auth/status", func(c *gin.Context) { c.Status(http.StatusOK) })

	for _, origin := range []string{"http://localhost:5173", "http://127.0.0.1:5173"} {
		t.Run(origin, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodOptions, "/api/auth/status", nil)
			req.Header.Set("Origin", origin)
			req.Header.Set("Access-Control-Request-Method", http.MethodGet)
			response := httptest.NewRecorder()
			router.ServeHTTP(response, req)

			if response.Code != http.StatusNoContent {
				t.Fatalf("status = %d, want %d", response.Code, http.StatusNoContent)
			}
			if got := response.Header().Get("Access-Control-Allow-Origin"); got != origin {
				t.Fatalf("Access-Control-Allow-Origin = %q, want %q", got, origin)
			}
		})
	}

	t.Run("unlisted origin remains blocked", func(t *testing.T) {
		const origin = "https://untrusted.example"
		req := httptest.NewRequest(http.MethodOptions, "/api/auth/status", nil)
		req.Header.Set("Origin", origin)
		req.Header.Set("Access-Control-Request-Method", http.MethodGet)
		response := httptest.NewRecorder()
		router.ServeHTTP(response, req)

		if response.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want %d", response.Code, http.StatusForbidden)
		}
		if got := response.Header().Get("Access-Control-Allow-Origin"); got == "*" {
			t.Fatal("untrusted origin must not receive wildcard CORS access")
		}
	})
}
