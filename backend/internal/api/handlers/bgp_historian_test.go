package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/cyber-hub/cyber-hub/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func useBGPTestDB(t *testing.T) {
	t.Helper()
	previousDB := store.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(1)
	if err := db.AutoMigrate(&models.BGPCache{}, &models.BGPSnapshot{}, &models.BGPAlert{}); err != nil {
		t.Fatal(err)
	}
	store.DB = db
	t.Cleanup(func() {
		store.DB = previousDB
		_ = sqlDB.Close()
	})
}

func validSnapshotJSON() map[string]interface{} {
	return map[string]interface{}{
		"info":        map[string]interface{}{"data": map[string]interface{}{}},
		"prefixes":    map[string]interface{}{"data": map[string]interface{}{"ipv4_prefixes": []interface{}{}, "ipv6_prefixes": []interface{}{}}},
		"peers":       map[string]interface{}{"data": map[string]interface{}{"ipv4_peers": []interface{}{}, "ipv6_peers": []interface{}{}}},
		"upstreams":   map[string]interface{}{"data": map[string]interface{}{"ipv4_upstreams": []interface{}{}, "ipv6_upstreams": []interface{}{}}},
		"downstreams": map[string]interface{}{"data": map[string]interface{}{"ipv4_downstreams": []interface{}{}, "ipv6_downstreams": []interface{}{}}},
	}
}

func marshalSnapshotJSON(t *testing.T, snapshot map[string]interface{}) string {
	t.Helper()
	encoded, err := json.Marshal(snapshot)
	if err != nil {
		t.Fatal(err)
	}
	return string(encoded)
}

func getMap(t *testing.T, value interface{}) map[string]interface{} {
	t.Helper()
	result, ok := value.(map[string]interface{})
	if !ok {
		t.Fatalf("expected object, got %T", value)
	}
	return result
}

func TestComputeDiffReportsEveryListAsIdentical(t *testing.T) {
	encoded := marshalSnapshotJSON(t, validSnapshotJSON())
	diff := computeDiff(encoded, encoded)
	if diff["status"] != "complete" {
		t.Fatalf("status = %v, want complete", diff["status"])
	}
	statuses := getMap(t, diff["list_status"])
	if len(statuses) != 8 {
		t.Fatalf("got %d list statuses, want 8", len(statuses))
	}
	for key, raw := range statuses {
		if got := getMap(t, raw)["status"]; got != "identical" {
			t.Errorf("%s status = %v, want identical", key, got)
		}
	}
	if got := diff["changed_fields"].([]string); len(got) != 0 {
		t.Fatalf("changed_fields = %v, want empty", got)
	}
}

func TestComputeDiffClassifiesListChanges(t *testing.T) {
	tests := []struct {
		name        string
		before      []interface{}
		after       []interface{}
		wantAdded   int
		wantRemoved int
	}{
		{name: "addition", before: []interface{}{}, after: []interface{}{"192.0.2.0/24"}, wantAdded: 1},
		{name: "removal", before: []interface{}{"192.0.2.0/24"}, after: []interface{}{}, wantRemoved: 1},
		{name: "modification", before: []interface{}{map[string]interface{}{"asn": float64(1), "name": "old"}}, after: []interface{}{map[string]interface{}{"asn": float64(1), "name": "new"}}, wantAdded: 1, wantRemoved: 1},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			oldData, newData := validSnapshotJSON(), validSnapshotJSON()
			oldData["prefixes"].(map[string]interface{})["data"].(map[string]interface{})["ipv4_prefixes"] = test.before
			newData["prefixes"].(map[string]interface{})["data"].(map[string]interface{})["ipv4_prefixes"] = test.after
			diff := computeDiff(marshalSnapshotJSON(t, oldData), marshalSnapshotJSON(t, newData))
			field := getMap(t, getMap(t, diff["list_status"])["prefixes.data.ipv4_prefixes"])
			if field["status"] != "changed" {
				t.Fatalf("list status = %v, want changed", field["status"])
			}
			change := getMap(t, getMap(t, diff["changes"])["prefixes"])["ipv4_prefixes"]
			changeMap := getMap(t, change)
			if got := len(changeMap["added"].([]interface{})); got != test.wantAdded {
				t.Errorf("added count = %d, want %d", got, test.wantAdded)
			}
			if got := len(changeMap["removed"].([]interface{})); got != test.wantRemoved {
				t.Errorf("removed count = %d, want %d", got, test.wantRemoved)
			}
		})
	}
}

func TestComputeDiffDistinguishesMissingAndInvalidLists(t *testing.T) {
	t.Run("valid empty list", func(t *testing.T) {
		empty := marshalSnapshotJSON(t, validSnapshotJSON())
		diff := computeDiff(empty, empty)
		if got := getMap(t, getMap(t, diff["list_status"])["prefixes.data.ipv4_prefixes"])["status"]; got != "identical" {
			t.Fatalf("empty valid list status = %v", got)
		}
	})

	t.Run("missing list", func(t *testing.T) {
		oldData := validSnapshotJSON()
		delete(oldData["prefixes"].(map[string]interface{})["data"].(map[string]interface{}), "ipv4_prefixes")
		diff := computeDiff(marshalSnapshotJSON(t, oldData), marshalSnapshotJSON(t, validSnapshotJSON()))
		if got := getMap(t, getMap(t, diff["list_status"])["prefixes.data.ipv4_prefixes"])["status"]; got != "missing/unavailable" {
			t.Fatalf("missing list status = %v", got)
		}
		if diff["status"] != "incomplete" {
			t.Fatalf("overall status = %v, want incomplete", diff["status"])
		}
	})

	t.Run("invalid json", func(t *testing.T) {
		diff := computeDiff("{invalid", marshalSnapshotJSON(t, validSnapshotJSON()))
		if diff["status"] != "error" || len(diff["changed_fields"].([]string)) != 0 {
			t.Fatalf("invalid JSON was treated as a comparison: %#v", diff)
		}
		if len(getMap(t, diff["decode_errors"])) != 1 {
			t.Fatalf("decode_errors = %#v", diff["decode_errors"])
		}
		for key, raw := range getMap(t, diff["list_status"]) {
			if got := getMap(t, raw)["status"]; got != "error" {
				t.Errorf("%s status = %v, want error", key, got)
			}
		}
	})

	t.Run("wrong list type", func(t *testing.T) {
		bad := validSnapshotJSON()
		bad["peers"].(map[string]interface{})["data"].(map[string]interface{})["ipv4_peers"] = "not a list"
		diff := computeDiff(marshalSnapshotJSON(t, bad), marshalSnapshotJSON(t, validSnapshotJSON()))
		if got := getMap(t, getMap(t, diff["list_status"])["peers.data.ipv4_peers"])["status"]; got != "error" {
			t.Fatalf("wrong type status = %v, want error", got)
		}
	})
}

func TestGetBGPSnapshotDiffOrdersBySnapshotDate(t *testing.T) {
	useBGPTestDB(t)
	gin.SetMode(gin.TestMode)
	first := models.BGPSnapshot{ASN: 64500, SnapshotDate: time.Date(2026, 10, 24, 12, 0, 0, 0, time.UTC), FullDataJSON: marshalSnapshotJSON(t, validSnapshotJSON())}
	second := models.BGPSnapshot{ASN: 64500, SnapshotDate: time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC), FullDataJSON: marshalSnapshotJSON(t, validSnapshotJSON())}
	if err := store.DB.Create(&first).Error; err != nil {
		t.Fatal(err)
	}
	if err := store.DB.Create(&second).Error; err != nil {
		t.Fatal(err)
	}
	router := gin.New()
	router.GET("/api/bgp/snapshots/:asn/diff", GetBGPSnapshotDiff)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/bgp/snapshots/64500/diff?id_a=1&id_b=2", nil)
	router.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("HTTP status = %d: %s", recorder.Code, recorder.Body.String())
	}
	var response map[string]interface{}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if got := getMap(t, response["older"])["id"]; got != float64(second.ID) {
		t.Fatalf("older id = %v, want %d based on snapshot_date", got, second.ID)
	}
	if got := getMap(t, response["newer"])["id"]; got != float64(first.ID) {
		t.Fatalf("newer id = %v, want %d based on snapshot_date", got, first.ID)
	}
}

func TestGetBGPSnapshotDiffSurfacesDecodeErrorsOverHTTP(t *testing.T) {
	useBGPTestDB(t)
	gin.SetMode(gin.TestMode)
	snapshots := []models.BGPSnapshot{
		{ASN: 64500, SnapshotDate: time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC), FullDataJSON: "{invalid"},
		{ASN: 64500, SnapshotDate: time.Date(2026, 10, 24, 12, 0, 0, 0, time.UTC), FullDataJSON: marshalSnapshotJSON(t, validSnapshotJSON())},
	}
	if err := store.DB.Create(&snapshots).Error; err != nil {
		t.Fatal(err)
	}
	router := gin.New()
	router.GET("/api/bgp/snapshots/:asn/diff", GetBGPSnapshotDiff)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/bgp/snapshots/64500/diff?id_a=1&id_b=2", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("HTTP status = %d: %s", recorder.Code, recorder.Body.String())
	}
	var response map[string]interface{}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	diff := getMap(t, response["diff"])
	if diff["status"] != "error" || len(diff["changed_fields"].([]interface{})) != 0 {
		t.Fatalf("HTTP diff concealed invalid snapshot JSON: %s", recorder.Body.String())
	}
}

func TestBGPAlertJSONIncludesCanonicalAndLegacyNames(t *testing.T) {
	alert := models.BGPAlert{ID: 8, ASN: 64500, AlertType: "prefix_change", OldValue: "[]", NewValue: "[]", Acknowledged: false}
	encoded, err := json.Marshal(alert)
	if err != nil {
		t.Fatal(err)
	}
	var fields map[string]interface{}
	if err := json.Unmarshal(encoded, &fields); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"id", "asn", "alert_type", "old_value", "new_value", "created_at", "detected_at", "acknowledged", "ID", "ASN", "AlertType", "Acknowledged"} {
		if _, ok := fields[key]; !ok {
			t.Errorf("JSON contract omitted %q: %s", key, encoded)
		}
	}
	if fields["acknowledged"] != false || fields["Acknowledged"] != false {
		t.Fatalf("alert acknowledgment changed during serialization: %s", encoded)
	}
}

func TestGetBGPAlertsKeepsAlertsUnacknowledgedAndEmitsBothContracts(t *testing.T) {
	useBGPTestDB(t)
	gin.SetMode(gin.TestMode)
	alerts := []models.BGPAlert{
		{ASN: 64500, AlertType: "prefix_change", OldValue: "[]", NewValue: "[]", Acknowledged: false},
		{ASN: 64501, AlertType: "peer_change", OldValue: "[]", NewValue: "[]", Acknowledged: true},
	}
	if err := store.DB.Create(&alerts).Error; err != nil {
		t.Fatal(err)
	}
	router := gin.New()
	router.GET("/api/bgp/alerts", GetBGPAlerts)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/bgp/alerts", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("HTTP status = %d: %s", recorder.Code, recorder.Body.String())
	}
	var response struct {
		Items []map[string]interface{} `json:"items"`
		Total int                      `json:"total"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Total != 1 || len(response.Items) != 1 {
		t.Fatalf("response includes unexpected alerts: %s", recorder.Body.String())
	}
	for _, key := range []string{"id", "ID", "alert_type", "AlertType", "acknowledged", "Acknowledged"} {
		if _, ok := response.Items[0][key]; !ok {
			t.Errorf("HTTP alert response omitted %q", key)
		}
	}
	if response.Items[0]["acknowledged"] != false || response.Items[0]["Acknowledged"] != false {
		t.Fatalf("HTTP response acknowledged alert: %s", recorder.Body.String())
	}
}

func TestPostBGPSnapshotStoresPerSectionProvenance(t *testing.T) {
	useBGPTestDB(t)
	gin.SetMode(gin.TestMode)
	previousFetcher := bgpRipeFetcher
	t.Cleanup(func() { bgpRipeFetcher = previousFetcher })
	var fetched int
	var fetchMu sync.Mutex
	bgpRipeFetcher = func(endpoint string, _ ...string) ([]byte, int, error) {
		fetchMu.Lock()
		fetched++
		fetchMu.Unlock()
		var payload string
		switch {
		case endpoint == "/asn/64500":
			payload = `{"status":"ok","data":{"name":"AS64500"}}`
		case strings.HasSuffix(endpoint, "/prefixes"):
			payload = `{"status":"ok","data":{"ipv4_prefixes":[],"ipv6_prefixes":[]}}`
		case strings.HasSuffix(endpoint, "/peers"):
			payload = `{"status":"ok","data":{"ipv4_peers":[],"ipv6_peers":[]}}`
		case strings.HasSuffix(endpoint, "/upstreams"):
			payload = `{"status":"ok","data":{"ipv4_upstreams":[],"ipv6_upstreams":[]}}`
		case strings.HasSuffix(endpoint, "/downstreams"):
			payload = `{"status":"ok","data":{"ipv4_downstreams":[],"ipv6_downstreams":[]}}`
		default:
			return nil, 0, fmt.Errorf("unexpected endpoint %s", endpoint)
		}
		return []byte(payload), http.StatusOK, nil
	}
	router := gin.New()
	router.POST("/api/bgp/snapshot/:asn", PostBGPSnapshot)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/api/bgp/snapshot/64500", nil))
	if recorder.Code != http.StatusCreated {
		t.Fatalf("HTTP status = %d: %s", recorder.Code, recorder.Body.String())
	}
	if fetched != 5 {
		t.Fatalf("RIPE fetches = %d, want five sections", fetched)
	}
	var response map[string]interface{}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	provenance := getMap(t, response["data_provenance"])
	if len(provenance) != 5 {
		t.Fatalf("response provenance has %d sections: %s", len(provenance), recorder.Body.String())
	}
	for _, section := range []string{"info", "prefixes", "peers", "upstreams", "downstreams"} {
		metadata := getMap(t, provenance[section])
		if metadata["source"] != "ripe" || metadata["fetched_at"] == nil || metadata["age_seconds"] != float64(0) {
			t.Errorf("%s provenance = %#v", section, metadata)
		}
	}
	var snapshots []models.BGPSnapshot
	if err := store.DB.Find(&snapshots).Error; err != nil || len(snapshots) != 1 {
		t.Fatalf("saved snapshots = %d, err=%v", len(snapshots), err)
	}
	if got := decodeProvenance(snapshots[0].DataProvenanceJSON); len(got) != 5 {
		t.Fatalf("stored provenance has %d sections", len(got))
	}
}

func TestBGPCacheProvenanceUsesCacheRetrievalTime(t *testing.T) {
	useBGPTestDB(t)
	previousFetcher := bgpRipeFetcher
	t.Cleanup(func() { bgpRipeFetcher = previousFetcher })

	freshAt := time.Now().Add(-2 * time.Minute).UTC().Truncate(time.Second)
	fresh := models.BGPCache{CacheKey: "fresh", Response: `{"data":{}}`, ExpiresAt: time.Now().Add(time.Minute), CreatedAt: freshAt, UpdatedAt: freshAt}
	if err := store.DB.Create(&fresh).Error; err != nil {
		t.Fatal(err)
	}
	bgpRipeFetcher = func(string, ...string) ([]byte, int, error) {
		t.Fatal("RIPE was called despite a fresh cache entry")
		return nil, 0, nil
	}
	_, _, freshProvenance, err := bgpFetchDetailed("fresh", "/unused")
	if err != nil || freshProvenance.Source != "cache" || freshProvenance.FetchedAt == nil || freshProvenance.AgeSeconds == nil || *freshProvenance.AgeSeconds < 100 {
		t.Fatalf("fresh cache provenance = %#v, err=%v", freshProvenance, err)
	}

	staleAt := time.Now().Add(-37 * time.Minute).UTC().Truncate(time.Second)
	stale := models.BGPCache{CacheKey: "stale", Response: `{"data":{}}`, ExpiresAt: staleAt, CreatedAt: staleAt, UpdatedAt: staleAt}
	if err := store.DB.Create(&stale).Error; err != nil {
		t.Fatal(err)
	}
	bgpRipeFetcher = func(string, ...string) ([]byte, int, error) {
		return nil, http.StatusServiceUnavailable, &bgpHTTPStatusError{StatusCode: http.StatusServiceUnavailable}
	}
	_, _, staleProvenance, err := bgpFetchDetailed("stale", "/unused")
	if err != nil || staleProvenance.Source != "cache-stale" || staleProvenance.FetchedAt == nil || staleProvenance.AgeSeconds == nil || *staleProvenance.AgeSeconds < 36*60 {
		t.Fatalf("stale cache provenance = %#v, err=%v", staleProvenance, err)
	}
}

func TestBGPSnapshotMigrationAddsProvenanceWithoutChangingRows(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, _ := db.DB()
	defer sqlDB.Close()
	if err := db.Exec(`CREATE TABLE bgp_snapshots (id INTEGER PRIMARY KEY, created_at DATETIME, asn INTEGER, snapshot_date DATETIME, full_data_json TEXT, taken_by TEXT)`).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Exec(`INSERT INTO bgp_snapshots (id, asn, full_data_json, taken_by) VALUES (1, 64500, '{"prefixes":{}}', 'legacy')`).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.BGPSnapshot{}); err != nil {
		t.Fatal(err)
	}
	var migrated models.BGPSnapshot
	if err := db.First(&migrated, 1).Error; err != nil {
		t.Fatal(err)
	}
	if migrated.FullDataJSON != `{"prefixes":{}}` || migrated.TakenBy != "legacy" || migrated.DataProvenanceJSON != "" {
		t.Fatalf("legacy snapshot changed: %#v", migrated)
	}
	if !db.Migrator().HasColumn(&models.BGPSnapshot{}, "DataProvenanceJSON") {
		t.Fatal("additive provenance column was not migrated")
	}
}

// useBGPFileDB opens a real database file through store.InitDB (WAL, pool of
// connections), unlike the single-connection in-memory database.
func useBGPFileDB(t *testing.T) {
	t.Helper()
	previousDB := store.DB
	if err := store.InitDB(filepath.Join(t.TempDir(), "cyber-hub.db")); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if sqlDB, err := store.DB.DB(); err == nil {
			_ = sqlDB.Close()
		}
		store.DB = previousDB
	})
}

// fakeRIPESections answers every snapshot section with valid empty lists.
func fakeRIPESections(endpoint string, _ ...string) ([]byte, int, error) {
	section := endpoint[strings.LastIndex(endpoint, "/")+1:]
	switch section {
	case "prefixes", "peers", "upstreams", "downstreams":
		return []byte(fmt.Sprintf(`{"status":"ok","data":{"ipv4_%[1]s":[],"ipv6_%[1]s":[]}}`, section)), http.StatusOK, nil
	}
	return []byte(`{"status":"ok","data":{}}`), http.StatusOK, nil
}

func postSnapshot(t *testing.T, asn int) (*httptest.ResponseRecorder, map[string]interface{}) {
	t.Helper()
	router := gin.New()
	router.POST("/api/bgp/snapshot/:asn", PostBGPSnapshot)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/bgp/snapshot/%d", asn), nil))
	var response map[string]interface{}
	_ = json.Unmarshal(recorder.Body.Bytes(), &response)
	return recorder, response
}

func TestCompareBGPSnapshotsNeverReadsUnusableDataAsNoChange(t *testing.T) {
	valid := marshalSnapshotJSON(t, validSnapshotJSON())
	detectedAt := time.Date(2026, 10, 24, 12, 0, 0, 0, time.UTC)

	t.Run("identical", func(t *testing.T) {
		alerts, status := compareBGPSnapshots(64500, valid, valid, detectedAt)
		if status != "complete" || len(alerts) != 0 {
			t.Fatalf("status = %s, alerts = %d", status, len(alerts))
		}
	})

	t.Run("change produces an alert", func(t *testing.T) {
		newer := validSnapshotJSON()
		newer["upstreams"].(map[string]interface{})["data"].(map[string]interface{})["ipv4_upstreams"] = []interface{}{map[string]interface{}{"asn": float64(64511)}}
		alerts, status := compareBGPSnapshots(64500, valid, marshalSnapshotJSON(t, newer), detectedAt)
		if status != "complete" || len(alerts) != 1 || alerts[0].AlertType != "upstream_change" || alerts[0].Acknowledged {
			t.Fatalf("status = %s, alerts = %#v", status, alerts)
		}
	})

	t.Run("invalid previous JSON", func(t *testing.T) {
		alerts, status := compareBGPSnapshots(64500, "{invalid", valid, detectedAt)
		if status != "error" || len(alerts) != 0 {
			t.Fatalf("status = %s, alerts = %d", status, len(alerts))
		}
	})

	t.Run("list missing from a legacy snapshot", func(t *testing.T) {
		older := validSnapshotJSON()
		delete(older["peers"].(map[string]interface{})["data"].(map[string]interface{}), "ipv4_peers")
		newer := validSnapshotJSON()
		newer["peers"].(map[string]interface{})["data"].(map[string]interface{})["ipv4_peers"] = []interface{}{map[string]interface{}{"asn": float64(64512)}}
		alerts, status := compareBGPSnapshots(64500, marshalSnapshotJSON(t, older), marshalSnapshotJSON(t, newer), detectedAt)
		if status != "incomplete" || len(alerts) != 0 {
			t.Fatalf("missing list was read as a change: status = %s, alerts = %#v", status, alerts)
		}
	})
}

func TestPostBGPSnapshotReportsComparisonStatus(t *testing.T) {
	useBGPTestDB(t)
	gin.SetMode(gin.TestMode)
	previousFetcher := bgpRipeFetcher
	t.Cleanup(func() { bgpRipeFetcher = previousFetcher })
	bgpRipeFetcher = fakeRIPESections

	_, first := postSnapshot(t, 64500)
	if comparison := getMap(t, first["comparison"]); comparison["status"] != "no_previous" || comparison["previous_snapshot_id"] != nil {
		t.Fatalf("first comparison = %#v", comparison)
	}

	legacy := models.BGPSnapshot{ASN: 64501, SnapshotDate: time.Now().Add(-time.Hour), FullDataJSON: "{invalid"}
	if err := store.DB.Create(&legacy).Error; err != nil {
		t.Fatal(err)
	}
	recorder, response := postSnapshot(t, 64501)
	if recorder.Code != http.StatusCreated {
		t.Fatalf("HTTP status = %d: %s", recorder.Code, recorder.Body.String())
	}
	comparison := getMap(t, response["comparison"])
	if comparison["status"] != "error" || comparison["previous_snapshot_id"] != float64(legacy.ID) {
		t.Fatalf("comparison with unreadable snapshot = %#v", comparison)
	}
	var alerts int64
	store.DB.Model(&models.BGPAlert{}).Count(&alerts)
	if alerts != 0 {
		t.Fatalf("alerts created from an unreadable snapshot: %d", alerts)
	}
}

func TestPostBGPSnapshotConcurrentCallsOnFileDatabase(t *testing.T) {
	useBGPFileDB(t)
	gin.SetMode(gin.TestMode)
	previousFetcher := bgpRipeFetcher
	t.Cleanup(func() { bgpRipeFetcher = previousFetcher })
	bgpRipeFetcher = fakeRIPESections
	const parallel = 8
	var wg sync.WaitGroup
	codes := make([]int, parallel)
	bodies := make([]string, parallel)
	for i := 0; i < parallel; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			recorder, _ := postSnapshot(t, 64500)
			codes[i], bodies[i] = recorder.Code, recorder.Body.String()
		}(i)
	}
	wg.Wait()
	for i, code := range codes {
		if code != http.StatusCreated {
			t.Errorf("call %d HTTP status = %d: %s", i, code, bodies[i])
		}
	}
	var snapshots, alerts int64
	store.DB.Model(&models.BGPSnapshot{}).Count(&snapshots)
	store.DB.Model(&models.BGPAlert{}).Count(&alerts)
	if snapshots != parallel || alerts != 0 {
		t.Fatalf("snapshots = %d (want %d), alerts = %d (identical data, want 0)", snapshots, parallel, alerts)
	}
}

func TestProxyBGPMapsUpstreamServerErrorsToBadGateway(t *testing.T) {
	useBGPTestDB(t)
	gin.SetMode(gin.TestMode)
	previousFetcher := bgpRipeFetcher
	t.Cleanup(func() { bgpRipeFetcher = previousFetcher })
	for _, test := range []struct{ upstream, want int }{
		{http.StatusInternalServerError, http.StatusBadGateway},
		{http.StatusServiceUnavailable, http.StatusBadGateway},
		{http.StatusTooManyRequests, http.StatusTooManyRequests},
		{http.StatusNotFound, http.StatusNotFound},
	} {
		upstream := test.upstream
		bgpRipeFetcher = func(string, ...string) ([]byte, int, error) {
			return nil, upstream, &bgpHTTPStatusError{StatusCode: upstream}
		}
		router := gin.New()
		router.GET("/api/bgp/asn/:asn", GetBGPASN)
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/bgp/asn/%d", 64000+upstream), nil))
		if recorder.Code != test.want {
			t.Errorf("upstream %d returned %d, want %d", upstream, recorder.Code, test.want)
		}
	}
}

func TestGetBGPSnapshotsListsChronologically(t *testing.T) {
	useBGPTestDB(t)
	gin.SetMode(gin.TestMode)
	base := time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC)
	snapshots := []models.BGPSnapshot{
		{ASN: 64500, SnapshotDate: base.Add(2 * time.Hour), CreatedAt: base, FullDataJSON: "{}"},
		{ASN: 64500, SnapshotDate: base, CreatedAt: base.Add(2 * time.Hour), FullDataJSON: "{}"},
		{ASN: 64500, SnapshotDate: base.Add(time.Hour), CreatedAt: base.Add(time.Hour), FullDataJSON: "{}", DataProvenanceJSON: `{"info":{"source":"ripe"}}`},
	}
	if err := store.DB.Create(&snapshots).Error; err != nil {
		t.Fatal(err)
	}
	router := gin.New()
	router.GET("/api/bgp/snapshots/:asn", GetBGPSnapshots)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/bgp/snapshots/64500", nil))
	var response struct {
		Items []map[string]interface{} `json:"items"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	var ids []float64
	for _, item := range response.Items {
		ids = append(ids, item["id"].(float64))
	}
	if fmt.Sprint(ids) != fmt.Sprint([]float64{1, 3, 2}) {
		t.Fatalf("ids = %v, want newest snapshot_date first", ids)
	}
	if response.Items[0]["provenance_status"] != "unknown" || response.Items[1]["provenance_status"] != "known" {
		t.Fatalf("provenance status = %v / %v", response.Items[0]["provenance_status"], response.Items[1]["provenance_status"])
	}
}

func TestBGPHTTPNonSuccessIsAnError(t *testing.T) {
	response := &http.Response{StatusCode: http.StatusServiceUnavailable, Body: http.NoBody}
	_, err := acceptBGPHTTPResponse(response)
	var statusErr *bgpHTTPStatusError
	if err == nil || !errors.As(err, &statusErr) || statusErr.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("non-success response error = %v", err)
	}
	if !strings.Contains(statusErr.Error(), "503") {
		t.Fatalf("status error omits HTTP code: %v", statusErr)
	}
}
