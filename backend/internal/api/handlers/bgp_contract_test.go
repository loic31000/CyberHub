package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/cyber-hub/cyber-hub/internal/store"
	"github.com/gin-gonic/gin"
)

// The frontend reads these files in src/bgp/contracts.test.ts. They are the
// real handler responses for representative snapshots, so a change of the
// HTTP contract fails here first. Regenerate with BGP_CONTRACTS_UPDATE=1.
var bgpContractDir = filepath.Join("..", "..", "..", "..", "frontend", "src", "bgp", "__contracts__")

const bgpContractTime = "2026-10-24T12:00:00Z"

// Fields whose values depend on the clock of the run.
var bgpVolatileFields = map[string]bool{"fetched_at": true, "CreatedAt": true, "SnapshotDate": true, "created_at": true, "snapshot_date": true, "detected_at": true, "DetectedAt": true}

func normalizeContract(value interface{}) interface{} {
	switch v := value.(type) {
	case map[string]interface{}:
		for key, item := range v {
			if _, isString := item.(string); isString && bgpVolatileFields[key] {
				v[key] = bgpContractTime
				continue
			}
			v[key] = normalizeContract(item)
		}
	case []interface{}:
		for i := range v {
			v[i] = normalizeContract(v[i])
		}
	}
	return value
}

func checkContract(t *testing.T, name string, recorder *httptest.ResponseRecorder, volatile bool) {
	t.Helper()
	var decoded interface{}
	if err := json.Unmarshal(recorder.Body.Bytes(), &decoded); err != nil {
		t.Fatalf("%s: %v", name, err)
	}
	if volatile {
		decoded = normalizeContract(decoded)
	}
	encoded, err := json.MarshalIndent(map[string]interface{}{"http_status": recorder.Code, "body": decoded}, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	encoded = append(encoded, '\n')
	path := filepath.Join(bgpContractDir, name+".json")
	if os.Getenv("BGP_CONTRACTS_UPDATE") == "1" {
		if err := os.MkdirAll(bgpContractDir, 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, encoded, 0o644); err != nil {
			t.Fatal(err)
		}
		return
	}
	existing, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("%s: %v (run with BGP_CONTRACTS_UPDATE=1)", name, err)
	}
	if !bytes.Equal(bytes.ReplaceAll(existing, []byte("\r\n"), []byte("\n")), encoded) {
		t.Fatalf("contract %s drifted from the frontend fixture:\n%s", name, encoded)
	}
}

func contractSnapshotJSON(t *testing.T, prefixes []interface{}, withPeers bool) string {
	t.Helper()
	snapshot := validSnapshotJSON()
	snapshot["prefixes"].(map[string]interface{})["data"].(map[string]interface{})["ipv4_prefixes"] = prefixes
	if !withPeers {
		snapshot["peers"] = map[string]interface{}{"data": map[string]interface{}{}}
	}
	return marshalSnapshotJSON(t, snapshot)
}

func TestBGPHistorianHTTPContracts(t *testing.T) {
	useBGPTestDB(t)
	gin.SetMode(gin.TestMode)
	at := func(day int) time.Time { return time.Date(2026, 10, day, 9, 0, 0, 0, time.UTC) }
	prefix := func(p string) map[string]interface{} { return map[string]interface{}{"prefix": p, "cidr": float64(24)} }
	provenance := `{"info":{"source":"ripe","fetched_at":"2026-10-23T09:00:00Z","age_seconds":0},` +
		`"prefixes":{"source":"cache","fetched_at":"2026-10-23T08:56:00Z","age_seconds":240},` +
		`"peers":{"source":"cache-stale","fetched_at":"2026-10-23T05:30:00Z","age_seconds":12600},` +
		`"upstreams":{"source":"ripe","fetched_at":"2026-10-23T09:00:00Z","age_seconds":0},` +
		`"downstreams":{"source":"ripe","fetched_at":"2026-10-23T09:00:00Z","age_seconds":0}}`
	snapshots := []models.BGPSnapshot{
		// 1: legacy, before provenance and without peers lists.
		{ASN: 64496, CreatedAt: at(20), SnapshotDate: at(20), TakenBy: "local", FullDataJSON: contractSnapshotJSON(t, []interface{}{prefix("192.0.2.0/24")}, false)},
		// 2 and 3: identical data, with provenance.
		{ASN: 64496, CreatedAt: at(22), SnapshotDate: at(22), TakenBy: "local", FullDataJSON: contractSnapshotJSON(t, []interface{}{prefix("192.0.2.0/24")}, true), DataProvenanceJSON: provenance},
		{ASN: 64496, CreatedAt: at(23), SnapshotDate: at(23), TakenBy: "local", FullDataJSON: contractSnapshotJSON(t, []interface{}{prefix("192.0.2.0/24")}, true), DataProvenanceJSON: provenance},
		// 4: a real change of prefixes.
		{ASN: 64496, CreatedAt: at(24), SnapshotDate: at(24), TakenBy: "local", FullDataJSON: contractSnapshotJSON(t, []interface{}{prefix("203.0.113.0/24")}, true), DataProvenanceJSON: provenance},
		// 5: unreadable.
		{ASN: 64496, CreatedAt: at(21), SnapshotDate: at(21), TakenBy: "local", FullDataJSON: "{invalid"},
	}
	if err := store.DB.Create(&snapshots).Error; err != nil {
		t.Fatal(err)
	}
	alert := models.BGPAlert{ASN: 64496, AlertType: "prefix_change", CreatedAt: at(24), DetectedAt: at(24),
		OldValue: `{"data":{"ipv4_prefixes":[{"prefix":"192.0.2.0/24"}],"ipv6_prefixes":[]}}`,
		NewValue: `{"data":{"ipv4_prefixes":[{"prefix":"203.0.113.0/24"}],"ipv6_prefixes":[]}}`}
	if err := store.DB.Create(&alert).Error; err != nil {
		t.Fatal(err)
	}

	router := gin.New()
	router.GET("/api/bgp/snapshots/:asn", GetBGPSnapshots)
	router.GET("/api/bgp/snapshots/:asn/diff", GetBGPSnapshotDiff)
	router.GET("/api/bgp/alerts", GetBGPAlerts)
	router.POST("/api/bgp/snapshot/:asn", PostBGPSnapshot)
	get := func(path string) *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
		return recorder
	}
	diff := func(a, b uint) *httptest.ResponseRecorder {
		return get(fmt.Sprintf("/api/bgp/snapshots/64496/diff?id_a=%d&id_b=%d", a, b))
	}

	checkContract(t, "snapshots", get("/api/bgp/snapshots/64496"), false)
	checkContract(t, "diff-identical", diff(snapshots[2].ID, snapshots[1].ID), false)
	checkContract(t, "diff-changed", diff(snapshots[2].ID, snapshots[3].ID), false)
	checkContract(t, "diff-partial", diff(snapshots[0].ID, snapshots[1].ID), false)
	checkContract(t, "diff-impossible", diff(snapshots[4].ID, snapshots[1].ID), false)
	checkContract(t, "alerts", get("/api/bgp/alerts"), false)

	previousFetcher := bgpRipeFetcher
	t.Cleanup(func() { bgpRipeFetcher = previousFetcher })
	bgpRipeFetcher = fakeRIPESections
	post := func(asn int) *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/bgp/snapshot/%d", asn), nil))
		return recorder
	}
	checkContract(t, "post-snapshot-first", post(64510), true)
	if err := store.DB.Create(&models.BGPSnapshot{ASN: 64511, SnapshotDate: at(20), FullDataJSON: "{invalid"}).Error; err != nil {
		t.Fatal(err)
	}
	checkContract(t, "post-snapshot-unreadable-previous", post(64511), true)
}
