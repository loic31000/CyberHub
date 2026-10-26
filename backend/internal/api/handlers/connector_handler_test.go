package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/connectors"
	"github.com/gin-gonic/gin"
)

func connectorRouter(t *testing.T) (*gin.Engine, *connectors.Registry) {
	t.Helper()
	registry := connectors.MustNewRegistry(connectors.Definition{
		ID: "zeek", Name: "Zeek", Type: connectors.TypeNetworkTraffic, Source: "zeek",
		Capabilities: []connectors.Capability{connectors.CapabilityRead, connectors.CapabilityProduceObservations},
		Permissions:  connectors.Permissions{LocalRead: true},
		Inputs:       []connectors.Input{{Kind: connectors.InputFile, Format: "Zeek JSON logs"}},
		Outputs:      []connectors.Output{{Kind: connectors.OutputObservation}},
		StaleAfter:   time.Hour,
		Limits:       connectors.Limits{Timeout: 30 * time.Second, Streaming: true},
	})
	h := NewConnectorsHandler(registry)
	h.now = func() time.Time { return time.Date(2026, 10, 26, 12, 0, 0, 0, time.UTC) }
	r := gin.New()
	r.GET("/api/connectors", h.List)
	r.GET("/api/connectors/:id", h.Get)
	return r, registry
}

func getConnector(r *gin.Engine, path string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
	return w
}

func TestConnectorsAPIList(t *testing.T) {
	r, _ := connectorRouter(t)
	w := getConnector(r, "/api/connectors")
	var out struct {
		Items []map[string]any `json:"items"`
		Total int              `json:"total"`
	}
	if w.Code != http.StatusOK || json.Unmarshal(w.Body.Bytes(), &out) != nil || out.Total != 1 {
		t.Fatalf("list: %d %s", w.Code, w.Body.String())
	}
	item := out.Items[0]
	if item["id"] != "zeek" || item["enabled"] != false || item["status"] != "disabled" || item["never_synced"] != true {
		t.Fatalf("unexpected item %v", item)
	}
	// Only the documented contract is exposed: no configuration, no secret.
	allowed := map[string]bool{"id": true, "name": true, "type": true, "source": true, "description": true, "capabilities": true, "permissions": true,
		"inputs": true, "outputs": true, "natural_entity_ref": true, "enabled_by_default": true, "enabled": true, "status": true,
		"last_sync": true, "last_success": true, "never_synced": true, "stale": true, "last_error": true, "limits": true}
	for key := range item {
		if !allowed[key] {
			t.Fatalf("unexpected field %q exposed", key)
		}
	}
	// The error is historical: no field named "error" next to status.
	if _, ok := item["error"]; ok {
		t.Fatal("the public error field must be last_error")
	}
	limits := item["limits"].(map[string]any)
	if len(limits) != 3 || limits["timeout_ms"] != float64(30000) || limits["streaming"] != true || limits["max_payload_bytes"] != float64(0) {
		t.Fatalf("limits must expose only timeout_ms, max_payload_bytes, streaming: %v", limits)
	}
}

func TestConnectorsAPIGet(t *testing.T) {
	r, registry := connectorRouter(t)
	at := time.Date(2026, 10, 26, 8, 0, 0, 0, time.UTC)
	registry.States.SyncFailed("zeek", connectors.NewError("source_absent", "Zeek n'est pas installé", at), true)
	w := getConnector(r, "/api/connectors/zeek")
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"code":"source_absent"`) {
		t.Fatalf("get: %d %s", w.Code, w.Body.String())
	}
	if w := getConnector(r, "/api/connectors/suricata"); w.Code != http.StatusNotFound {
		t.Fatalf("unknown id: want 404, got %d", w.Code)
	}
	for _, id := range []string{"Zeek", "zeek_1", "-zeek", strings.Repeat("a", 65)} {
		if w := getConnector(r, "/api/connectors/"+id); w.Code != http.StatusBadRequest {
			t.Fatalf("invalid id %q: want 400, got %d", id, w.Code)
		}
	}
}

func TestConnectorsAPIDefaultRegistryIsEmpty(t *testing.T) {
	r := gin.New()
	h := NewConnectorsHandler(connectors.Default)
	r.GET("/api/connectors", h.List)
	if w := getConnector(r, "/api/connectors"); w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"items":[]`) {
		t.Fatalf("default list: %d %s", w.Code, w.Body.String())
	}
}
