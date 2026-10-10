package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func TestAuthRequired(t *testing.T) {
	gin.SetMode(gin.TestMode)
	secret := "test-secret"
	valid, err := GenerateToken(secret)
	if err != nil {
		t.Fatal(err)
	}
	sign := func(method jwt.SigningMethod, claims jwt.RegisteredClaims) string {
		t.Helper()
		token, err := jwt.NewWithClaims(method, claims).SignedString([]byte(secret))
		if err != nil {
			t.Fatal(err)
		}
		return token
	}
	claims := jwt.RegisteredClaims{Issuer: "cyber-hub", ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))}
	tests := []struct {
		name, header, query string
		secret              string
		want                int
	}{
		{"valid", "Bearer " + valid, "", secret, http.StatusNoContent},
		{"query token refused", "", "?token=" + valid, secret, http.StatusUnauthorized},
		{"wrong algorithm", "Bearer " + sign(jwt.SigningMethodHS384, claims), "", secret, http.StatusUnauthorized},
		{"wrong issuer", "Bearer " + sign(jwt.SigningMethodHS256, jwt.RegisteredClaims{Issuer: "other", ExpiresAt: claims.ExpiresAt}), "", secret, http.StatusUnauthorized},
		{"missing expiry", "Bearer " + sign(jwt.SigningMethodHS256, jwt.RegisteredClaims{Issuer: "cyber-hub"}), "", secret, http.StatusUnauthorized},
		{"empty secret", "Bearer " + valid, "", "", http.StatusUnauthorized},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			r := gin.New()
			r.GET("/protected", AuthRequired(func() string { return tc.secret }), func(c *gin.Context) { c.Status(http.StatusNoContent) })
			req := httptest.NewRequest(http.MethodGet, "/protected"+tc.query, nil)
			if tc.header != "" {
				req.Header.Set("Authorization", tc.header)
			}
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			if w.Code != tc.want {
				t.Fatalf("status = %d, want %d", w.Code, tc.want)
			}
		})
	}
}
