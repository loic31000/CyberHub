package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/gin-gonic/gin"
)

// Findings API tests. The package TestMain provides an in-memory SQLite DB
// shared by all handler tests, so every test uses its own source value.

func findingRouter() *gin.Engine {
	r := gin.New()
	g := r.Group("/api/findings")
	g.GET("", ListFindings)
	g.POST("", CreateFinding)
	g.GET("/:id", GetFinding)
	g.PUT("/:id", UpdateFinding)
	g.PATCH("/:id/status", UpdateFindingStatus)
	g.DELETE("/:id", DeleteFinding)
	return r
}

func call(t *testing.T, r *gin.Engine, method, path, body string) (*httptest.ResponseRecorder, map[string]any) {
	t.Helper()
	req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w, out
}

func findingBody(source, title string) string {
	return fmt.Sprintf(`{"source_type":"network_detection","source":%q,"category":"ids_alert","title":%q,"severity":"medium",
		"evidence":[{"label":"Règle","value":"ET SCAN","source":"suricata"}],"first_seen":"2026-10-01T08:00:00Z","last_seen":"2026-10-01T08:00:00Z"}`, source, title)
}

func createFinding(t *testing.T, r *gin.Engine, source string) int {
	t.Helper()
	w, out := call(t, r, http.MethodPost, "/api/findings", findingBody(source, "ET SCAN Nmap"))
	if w.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", w.Code, w.Body.String())
	}
	return int(out["finding"].(map[string]any)["id"].(float64))
}

func TestFindingsAPICreateAndDuplicate(t *testing.T) {
	r := findingRouter()
	w, out := call(t, r, http.MethodPost, "/api/findings", findingBody("h-create", "ET SCAN Nmap"))
	if w.Code != http.StatusCreated || out["created"] != true {
		t.Fatalf("first POST: %d %s", w.Code, w.Body.String())
	}
	finding := out["finding"].(map[string]any)
	if finding["status"] != "new" || len(finding["fingerprint"].(string)) != 64 || finding["confidence"] != nil {
		t.Fatalf("unexpected finding %v", finding)
	}
	if evidence := finding["evidence"].([]any); len(evidence) != 1 || evidence[0].(map[string]any)["label"] != "Règle" {
		t.Fatalf("evidence must be exposed as a structure, got %v", finding["evidence"])
	}
	w, again := call(t, r, http.MethodPost, "/api/findings", findingBody("h-create", "  et   scan NMAP "))
	if w.Code != http.StatusOK || again["created"] != false || again["finding"].(map[string]any)["id"] != finding["id"] {
		t.Fatalf("duplicate POST must merge into the same finding: %d %s", w.Code, w.Body.String())
	}
}

func TestFindingsAPICreateValidation(t *testing.T) {
	r := findingRouter()
	for name, body := range map[string]string{
		"invalid json":       `{bad`,
		"empty body":         ``,
		"unknown field":      `{"source_type":"a","source":"b","category":"c","title":"t","severity":"low","threat_level":"x"}`,
		"missing source":     `{"source_type":"a","category":"c","title":"t","severity":"low"}`,
		"missing title":      `{"source_type":"a","source":"b","category":"c","severity":"low"}`,
		"invalid severity":   `{"source_type":"a","source":"b","category":"c","title":"t","severity":"urgent"}`,
		"confidence":         `{"source_type":"a","source":"b","category":"c","title":"t","severity":"low","confidence":1.5}`,
		"timestamps":         `{"source_type":"a","source":"b","category":"c","title":"t","severity":"low","first_seen":"2026-10-02T00:00:00Z","last_seen":"2026-10-01T00:00:00Z"}`,
		"status not allowed": `{"source_type":"a","source":"b","category":"c","title":"t","severity":"low","status":"confirmed"}`,
		"bad evidence":       `{"source_type":"a","source":"b","category":"c","title":"t","severity":"low","evidence":[{"label":"only label"}]}`,
		"two objects":        `{"source_type":"a","source":"b","category":"c","title":"t","severity":"low"}{}`,
	} {
		t.Run(name, func(t *testing.T) {
			if w, _ := call(t, r, http.MethodPost, "/api/findings", body); w.Code != http.StatusBadRequest {
				t.Fatalf("want 400, got %d %s", w.Code, w.Body.String())
			}
		})
	}
}

func TestFindingsAPIListFiltersAndGet(t *testing.T) {
	r := findingRouter()
	id := createFinding(t, r, "h-list")
	call(t, r, http.MethodPost, "/api/findings", findingBody("h-list", "Other signal"))
	w, out := call(t, r, http.MethodGet, "/api/findings?source=h-list&severity=medium&limit=1", "")
	if w.Code != http.StatusOK || out["total"].(float64) != 2 || len(out["items"].([]any)) != 1 || out["limit"].(float64) != 1 {
		t.Fatalf("list: %d %s", w.Code, w.Body.String())
	}
	for _, query := range []string{"status=done", "severity=urgent"} {
		if w, _ := call(t, r, http.MethodGet, "/api/findings?"+query, ""); w.Code != http.StatusBadRequest {
			t.Fatalf("invalid filter %s: want 400, got %d", query, w.Code)
		}
	}
	if w, _ := call(t, r, http.MethodGet, fmt.Sprintf("/api/findings/%d", id), ""); w.Code != http.StatusOK {
		t.Fatalf("get: %d", w.Code)
	}
	if w, _ := call(t, r, http.MethodGet, "/api/findings/999999", ""); w.Code != http.StatusNotFound {
		t.Fatalf("missing id: want 404, got %d", w.Code)
	}
	if w, _ := call(t, r, http.MethodGet, "/api/findings/abc", ""); w.Code != http.StatusBadRequest {
		t.Fatalf("bad id: want 400, got %d", w.Code)
	}
}

func TestFindingsAPIUpdateContract(t *testing.T) {
	r := findingRouter()
	id := createFinding(t, r, "h-update")
	path := fmt.Sprintf("/api/findings/%d", id)
	w, out := call(t, r, http.MethodPut, path, `{"severity":"high","confidence":0.7,"explanation":"Règle IDS déclenchée","evidence":[{"label":"Analyste","value":"vérifié"}]}`)
	if w.Code != http.StatusOK || out["severity"] != "high" || out["confidence"].(float64) != 0.7 || len(out["evidence"].([]any)) != 1 {
		t.Fatalf("update: %d %s", w.Code, w.Body.String())
	}
	if w, out := call(t, r, http.MethodPut, path, `{"confidence":null}`); w.Code != http.StatusOK || out["confidence"] != nil {
		t.Fatalf("confidence must be clearable: %d %s", w.Code, w.Body.String())
	}
	for name, body := range map[string]string{
		"identity source":  `{"source":"zeek"}`,
		"identity title":   `{"title":"renamed"}`,
		"identity asset":   `{"asset_id":"a-1"}`,
		"status":           `{"status":"confirmed"}`,
		"unknown field":    `{"threat_level":"high"}`,
		"invalid severity": `{"severity":"urgent"}`,
		"wrong type":       `{"severity":3}`,
		"empty":            `{}`,
	} {
		t.Run(name, func(t *testing.T) {
			if w, _ := call(t, r, http.MethodPut, path, body); w.Code != http.StatusBadRequest {
				t.Fatalf("want 400, got %d %s", w.Code, w.Body.String())
			}
		})
	}
	if w, _ := call(t, r, http.MethodPut, "/api/findings/999999", `{"severity":"low"}`); w.Code != http.StatusNotFound {
		t.Fatalf("missing id: want 404, got %d", w.Code)
	}
}

func TestFindingsAPIStatusTransitions(t *testing.T) {
	r := findingRouter()
	id := createFinding(t, r, "h-status")
	path := fmt.Sprintf("/api/findings/%d/status", id)
	if w, out := call(t, r, http.MethodPatch, path, `{"status":"resolved"}`); w.Code != http.StatusOK || out["status"] != "resolved" {
		t.Fatalf("new → resolved: %d %s", w.Code, w.Body.String())
	}
	if w, _ := call(t, r, http.MethodPatch, path, `{"status":"confirmed"}`); w.Code != http.StatusConflict {
		t.Fatalf("resolved → confirmed must be 409, got %d", w.Code)
	}
	if w, out := call(t, r, http.MethodPatch, path, `{"status":"needs_review"}`); w.Code != http.StatusOK || out["status"] != "needs_review" {
		t.Fatalf("reopen: %d %s", w.Code, w.Body.String())
	}
	if w, _ := call(t, r, http.MethodPatch, path, `{"status":"accepted_risk"}`); w.Code != http.StatusBadRequest {
		t.Fatalf("unknown status must be 400, got %d", w.Code)
	}
	if w, _ := call(t, r, http.MethodPatch, "/api/findings/999999/status", `{"status":"resolved"}`); w.Code != http.StatusNotFound {
		t.Fatalf("missing id: want 404, got %d", w.Code)
	}
}

func TestFindingsAPIDelete(t *testing.T) {
	r := findingRouter()
	id := createFinding(t, r, "h-delete")
	path := fmt.Sprintf("/api/findings/%d", id)
	if w, _ := call(t, r, http.MethodDelete, path, ""); w.Code != http.StatusNoContent {
		t.Fatalf("delete: %d", w.Code)
	}
	if w, _ := call(t, r, http.MethodDelete, path, ""); w.Code != http.StatusNotFound {
		t.Fatalf("second delete: want 404, got %d", w.Code)
	}
}

func TestFindingsAPISeverityUnknown(t *testing.T) {
	r := findingRouter()
	w, out := call(t, r, http.MethodPost, "/api/findings", `{"source_type":"network_inventory","source":"h-unknown","category":"new_device","title":"Nouvel appareil"}`)
	if w.Code != http.StatusCreated || out["finding"].(map[string]any)["severity"] != "unknown" {
		t.Fatalf("POST without severity must store unknown: %d %s", w.Code, w.Body.String())
	}
	if w, _ := call(t, r, http.MethodPost, "/api/findings", `{"source_type":"network_inventory","source":"h-unknown","category":"new_device","title":"Autre","severity":"unknown"}`); w.Code != http.StatusCreated {
		t.Fatalf("explicit unknown must be accepted, got %d %s", w.Code, w.Body.String())
	}
	w, list := call(t, r, http.MethodGet, "/api/findings?source=h-unknown&severity=unknown", "")
	if w.Code != http.StatusOK || list["total"].(float64) != 2 {
		t.Fatalf("severity=unknown filter: %d %s", w.Code, w.Body.String())
	}
	if w, _ := call(t, r, http.MethodPost, "/api/findings", `{"source_type":"a","source":"h-unknown","category":"c","title":"t","severity":"urgent"}`); w.Code != http.StatusBadRequest {
		t.Fatalf("an invalid severity must still be refused, got %d", w.Code)
	}
}

// An id one past the native uint range (2^32 or 2^64) must be refused by
// the parser with 400, before any store access, on every :id route.
func TestFindingsAPIRejectsOutOfRangeID(t *testing.T) {
	r := findingRouter()
	tooLarge := new(big.Int).Lsh(big.NewInt(1), strconv.IntSize).String()
	for _, route := range []struct{ method, path, body string }{
		{http.MethodGet, "/api/findings/" + tooLarge, ""},
		{http.MethodPut, "/api/findings/" + tooLarge, `{"severity":"low"}`},
		{http.MethodPatch, "/api/findings/" + tooLarge + "/status", `{"status":"resolved"}`},
		{http.MethodDelete, "/api/findings/" + tooLarge, ""},
	} {
		w, out := call(t, r, route.method, route.path, route.body)
		if w.Code != http.StatusBadRequest || out["error"] != "id invalide" {
			t.Fatalf("%s %s: want 400 id invalide, got %d %s", route.method, route.path, w.Code, w.Body.String())
		}
	}
}
