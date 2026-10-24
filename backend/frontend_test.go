package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/gin-gonic/gin"
)

func TestEmbeddedLandingDocumentAndNoJavaScriptFallback(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	files := fstest.MapFS{
		"web/index.html":         {Data: []byte("<main>Console entry</main>")},
		"web/welcome/index.html": {Data: []byte("<main>De la commande à la compréhension <noscript>Démo fictive</noscript></main>")},
		"web/assets/welcome.js":  {Data: []byte("public landing bundle")},
	}
	if err := registerEmbeddedFrontend(router, files); err != nil {
		t.Fatalf("registerEmbeddedFrontend() error = %v", err)
	}

	request := httptest.NewRequest(http.MethodGet, "/welcome", nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusPermanentRedirect {
		t.Fatalf("GET /welcome status = %d, want %d", response.Code, http.StatusPermanentRedirect)
	}
	if got := response.Header().Get("Location"); got != "/welcome/" {
		t.Fatalf("GET /welcome Location = %q, want /welcome/", got)
	}

	request = httptest.NewRequest(http.MethodGet, "/welcome/", nil)
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("GET /welcome/ status = %d, want %d", response.Code, http.StatusOK)
	}
	if !strings.Contains(response.Body.String(), "Démo fictive") || !strings.Contains(response.Body.String(), "<noscript>") {
		t.Fatalf("GET /welcome/ did not serve the static no-JavaScript Landing document: %s", response.Body.String())
	}

	request = httptest.NewRequest(http.MethodGet, "/assets/welcome.js", nil)
	response = httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), "public landing bundle") {
		t.Fatalf("GET Landing asset status/body = %d/%q", response.Code, response.Body.String())
	}
}

func TestEmbeddedFrontendKeepsConsoleFallback(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	files := fstest.MapFS{"web/index.html": {Data: []byte("<main>Console entry</main>")}}
	if err := registerEmbeddedFrontend(router, files); err != nil {
		t.Fatalf("registerEmbeddedFrontend() error = %v", err)
	}

	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/dashboard", nil))
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), "Console entry") {
		t.Fatalf("GET /dashboard fallback = %d/%q", response.Code, response.Body.String())
	}
}

func TestBuiltLandingIsServedFromEmbeddedFrontend(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	if err := registerEmbeddedFrontend(router, webFiles); err != nil {
		t.Fatalf("registerEmbeddedFrontend(webFiles) error = %v", err)
	}

	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/welcome/", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("GET /welcome/ status = %d, want %d", response.Code, http.StatusOK)
	}
	for _, expected := range []string{
		"De la commande à la compréhension",
		"198.51.100.42",
		"no-script-note",
		"/landing/terminal-mark.svg",
	} {
		if !strings.Contains(response.Body.String(), expected) {
			t.Errorf("embedded Landing document is missing %q", expected)
		}
	}
	if strings.Contains(response.Body.String(), "LANDING_STATIC_MARKUP") {
		t.Fatal("embedded Landing document still contains the Vite static-markup placeholder")
	}
}
