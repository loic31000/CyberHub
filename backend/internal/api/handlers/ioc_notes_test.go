package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/cyber-hub/cyber-hub/internal/store"
	"github.com/gin-gonic/gin"
)

// TestMain initialise une DB SQLite in-memory partagée par tous les tests
// du package handlers. store.InitDB positionne store.DB et exécute les
// migrations, ce qui suffit pour tester CreateIOC et NotesHandler.
func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)
	if err := store.InitDB(":memory:"); err != nil {
		panic("impossible d'initialiser la DB de test : " + err.Error())
	}
	os.Exit(m.Run())
}

// newTestRouter construit un routeur Gin minimal pour un seul handler.
func newTestRouter(method, path string, handler gin.HandlerFunc) *gin.Engine {
	r := gin.New()
	r.Handle(method, path, handler)
	return r
}

// --------------------------------------------------------------------------
// Tests CreateIOC
// --------------------------------------------------------------------------

func TestCreateIOC_InvalidJSON(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		wantStatus int
	}{
		{"empty body", ``, http.StatusBadRequest},
		{"bad json", `{bad json}`, http.StatusBadRequest},
		{"missing required fields", `{"source":"test"}`, http.StatusBadRequest},
		{"invalid type", `{"type":"unknown_type","value":"1.2.3.4"}`, http.StatusBadRequest},
		{"invalid tlp", `{"type":"ip","value":"1.2.3.4","tlp":"purple"}`, http.StatusBadRequest},
		{"invalid status", `{"type":"ip","value":"1.2.3.4","status":"deleted"}`, http.StatusBadRequest},
	}

	router := newTestRouter(http.MethodPost, "/api/ioc", CreateIOC)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/ioc", bytes.NewBufferString(tt.body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("TestCreateIOC_InvalidJSON/%s : got %d, want %d — body: %s",
					tt.name, w.Code, tt.wantStatus, w.Body.String())
			}
		})
	}
}

func TestCreateIOC_ValidJSON(t *testing.T) {
	tests := []struct {
		name       string
		body       map[string]string
		wantStatus int
	}{
		{
			"ip valide",
			map[string]string{"type": "ip", "value": "192.168.1.1"},
			http.StatusCreated,
		},
		{
			"domain avec tlp green",
			map[string]string{"type": "domain", "value": "malware.example.com", "tlp": "green"},
			http.StatusCreated,
		},
		{
			"hash avec status archived",
			map[string]string{
				"type":   "hash",
				"value":  "d41d8cd98f00b204e9800998ecf8427e",
				"status": "archived",
			},
			http.StatusCreated,
		},
		{
			"url valide",
			map[string]string{"type": "url", "value": "http://evil.example.com/malware"},
			http.StatusCreated,
		},
	}

	router := newTestRouter(http.MethodPost, "/api/ioc", CreateIOC)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			bodyBytes, _ := json.Marshal(tt.body)
			req := httptest.NewRequest(http.MethodPost, "/api/ioc", bytes.NewBuffer(bodyBytes))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("TestCreateIOC_ValidJSON/%s : got %d, want %d — body: %s",
					tt.name, w.Code, tt.wantStatus, w.Body.String())
			}

			// Vérifier que la réponse est du JSON valide avec un id
			if w.Code == http.StatusCreated {
				var resp map[string]any
				if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
					t.Errorf("réponse non-JSON : %v", err)
				}
				if _, ok := resp["id"]; !ok {
					t.Error("champ 'id' absent de la réponse")
				}
			}
		})
	}
}

// --------------------------------------------------------------------------
// Tests NotesHandler
// --------------------------------------------------------------------------

// newNotesRouter construit un routeur Gin minimal avec le NotesHandler
// branché sur store.DB (initialisé dans TestMain avec :memory:).
func newNotesRouter() *gin.Engine {
	h := NewNotesHandler(store.DB)
	r := gin.New()
	r.POST("/api/notes", h.Create)
	r.GET("/api/notes", h.List)
	r.GET("/api/notes/:id", h.GetByID)
	r.DELETE("/api/notes/:id", h.Delete)
	return r
}

func TestCreateNote_InvalidJSON(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		wantStatus int
	}{
		{"empty body", ``, http.StatusBadRequest},
		{"bad json", `{bad json}`, http.StatusBadRequest},
		{"missing title", `{"content":"du contenu sans titre"}`, http.StatusBadRequest},
	}

	router := newNotesRouter()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/notes", bytes.NewBufferString(tt.body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("TestCreateNote_InvalidJSON/%s : got %d, want %d — body: %s",
					tt.name, w.Code, tt.wantStatus, w.Body.String())
			}
		})
	}
}

func TestCreateNote_ValidJSON(t *testing.T) {
	tests := []struct {
		name       string
		body       map[string]string
		wantStatus int
	}{
		{
			"title seul",
			map[string]string{"title": "Ma note de test"},
			http.StatusCreated,
		},
		{
			"title + content + tags",
			map[string]string{
				"title":   "Incident APT29",
				"content": "Analyse de l'incident du 2024-01-15",
				"tags":    "apt29,russia,cozy-bear",
			},
			http.StatusCreated,
		},
		{
			"note avec linked_iocs",
			map[string]string{
				"title":       "IOC liés",
				"content":     "Liste d'IOCs confirmés",
				"linked_iocs": "[1,2,3]",
			},
			http.StatusCreated,
		},
	}

	router := newNotesRouter()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			bodyBytes, _ := json.Marshal(tt.body)
			req := httptest.NewRequest(http.MethodPost, "/api/notes", bytes.NewBuffer(bodyBytes))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("TestCreateNote_ValidJSON/%s : got %d, want %d — body: %s",
					tt.name, w.Code, tt.wantStatus, w.Body.String())
			}

			// Vérifier que la réponse contient bien un id et le title
			if w.Code == http.StatusCreated {
				var resp map[string]any
				if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
					t.Errorf("réponse non-JSON : %v", err)
				}
				if _, ok := resp["id"]; !ok {
					t.Error("champ 'id' absent de la réponse")
				}
				if resp["title"] != tt.body["title"] {
					t.Errorf("title attendu %q, got %q", tt.body["title"], resp["title"])
				}
			}
		})
	}
}
