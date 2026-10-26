package store

import (
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"gorm.io/gorm"
)

// Each test runs on its own temporary SQLite file created by InitDB; no
// personal database is ever opened.
func withFindingDB(t *testing.T) {
	t.Helper()
	previousDB, previousPath := DB, activeDBPath
	if err := InitDB(filepath.Join(t.TempDir(), "findings.db")); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { closeCurrentDB(t); DB, activeDBPath = previousDB, previousPath })
}

var base = time.Date(2026, 10, 1, 8, 0, 0, 0, time.UTC)

func observation(seen time.Time, evidence ...models.FindingEvidence) models.Finding {
	return models.Finding{
		SourceType: "network_detection", Source: "suricata", Category: "ids_alert",
		Title: "ET SCAN Nmap", EntityRef: "sid:2000001", Severity: "medium",
		FirstSeen: seen, LastSeen: seen, Evidence: evidence,
	}
}

func countFindings(t *testing.T) int64 {
	t.Helper()
	var n int64
	DB.Model(&models.Finding{}).Count(&n)
	return n
}

func TestUpsertFindingCreatesMinimalFinding(t *testing.T) {
	withFindingDB(t)
	f, created, err := UpsertFinding(models.Finding{SourceType: "appsec", Source: "appsec-audit", Category: "dependency", Title: "Vulnerable package", Severity: "low"}, base)
	if err != nil || !created {
		t.Fatalf("created=%v err=%v", created, err)
	}
	if f.ID == 0 || f.Status != models.FindingStatusNew || len(f.Fingerprint) != 64 {
		t.Fatalf("unexpected finding %+v", f)
	}
	if !f.FirstSeen.Equal(base) || !f.LastSeen.Equal(base) || f.Confidence != nil || f.Evidence == nil {
		t.Fatalf("defaults: first=%v last=%v confidence=%v evidence=%v", f.FirstSeen, f.LastSeen, f.Confidence, f.Evidence)
	}
}

func TestUpsertFindingRejectsInvalidInput(t *testing.T) {
	withFindingDB(t)
	_, _, err := UpsertFinding(models.Finding{Source: "suricata", Category: "x", Title: "t", Severity: "medium"}, base)
	if !errors.Is(err, models.ErrFindingInvalid) {
		t.Fatalf("missing source_type must be refused, got %v", err)
	}
	if countFindings(t) != 0 {
		t.Fatal("an invalid finding must not be stored")
	}
}

func TestUpsertFindingDeduplicatesAndMergesObservations(t *testing.T) {
	withFindingDB(t)
	rule := models.FindingEvidence{Label: "Règle", Value: "ET SCAN Nmap", Source: "suricata"}
	first, _, err := UpsertFinding(observation(base, rule), base)
	if err != nil {
		t.Fatal(err)
	}
	ip := models.FindingEvidence{Label: "IP source", Value: "198.51.100.7", Source: "suricata"}
	later := base.Add(2 * time.Hour)
	second, created, err := UpsertFinding(observation(later, rule, ip), later)
	if err != nil || created {
		t.Fatalf("a duplicate must merge: created=%v err=%v", created, err)
	}
	if countFindings(t) != 1 || second.ID != first.ID || second.Fingerprint != first.Fingerprint {
		t.Fatal("same fingerprint must keep a single row")
	}
	if !second.FirstSeen.Equal(base) || !second.LastSeen.Equal(later) {
		t.Fatalf("first_seen must be kept, last_seen advanced: %v / %v", second.FirstSeen, second.LastSeen)
	}
	if len(second.Evidence) != 2 || second.Evidence[0] != rule || second.Evidence[1] != ip {
		t.Fatalf("evidence must be merged without duplicates, got %+v", second.Evidence)
	}
}

func TestUpsertFindingTimestampsNeverMoveLastSeenBack(t *testing.T) {
	withFindingDB(t)
	if _, _, err := UpsertFinding(observation(base), base); err != nil {
		t.Fatal(err)
	}
	earlier := base.Add(-24 * time.Hour)
	merged, _, err := UpsertFinding(observation(earlier), base)
	if err != nil {
		t.Fatal(err)
	}
	if !merged.LastSeen.Equal(base) {
		t.Fatalf("an older occurrence must not move last_seen back, got %v", merged.LastSeen)
	}
	if !merged.FirstSeen.Equal(earlier) {
		t.Fatalf("an older occurrence must move first_seen back, got %v", merged.FirstSeen)
	}
}

func TestUpsertFindingKeepsAnalystStatusAndExistingValues(t *testing.T) {
	withFindingDB(t)
	input := observation(base)
	input.Description = "Original description"
	f, _, err := UpsertFinding(input, base)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := UpdateFindingStatus(f.ID, models.FindingStatusConfirmed); err != nil {
		t.Fatal(err)
	}
	confidence := 0.4
	again := observation(base.Add(time.Hour))
	again.Severity, again.Description, again.Explanation, again.Confidence = "critical", "Producer rewrite", "Filled explanation", &confidence
	merged, _, err := UpsertFinding(again, base)
	if err != nil {
		t.Fatal(err)
	}
	if merged.Status != models.FindingStatusConfirmed {
		t.Fatalf("a re-observation must not reset the analyst status, got %s", merged.Status)
	}
	if merged.Severity != "medium" || merged.Description != "Original description" {
		t.Fatalf("existing severity/description must be kept, got %s / %s", merged.Severity, merged.Description)
	}
	if merged.Explanation != "Filled explanation" || merged.Confidence == nil || *merged.Confidence != 0.4 {
		t.Fatalf("empty fields may be filled: explanation=%q confidence=%v", merged.Explanation, merged.Confidence)
	}
}

func TestUpsertFindingDistinctIdentitiesCreateDistinctRows(t *testing.T) {
	withFindingDB(t)
	a := observation(base)
	b := observation(base)
	b.AssetID = "asset-42"
	if _, _, err := UpsertFinding(a, base); err != nil {
		t.Fatal(err)
	}
	if _, created, err := UpsertFinding(b, base); err != nil || !created {
		t.Fatalf("another asset is another finding: created=%v err=%v", created, err)
	}
	if countFindings(t) != 2 {
		t.Fatal("want two rows")
	}
}

func TestUpdateFindingEnrichmentContract(t *testing.T) {
	withFindingDB(t)
	f, _, _ := UpsertFinding(observation(base), base)
	severity, description, confidence := "HIGH", "  Reviewed  ", 0.8
	evidence := []models.FindingEvidence{{Label: "Note", Value: "analyst"}}
	updated, err := UpdateFindingEnrichment(f.ID, FindingEnrichment{Severity: &severity, Description: &description, Confidence: &confidence, Evidence: &evidence})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Severity != "high" || updated.Description != "Reviewed" || *updated.Confidence != 0.8 || len(updated.Evidence) != 1 {
		t.Fatalf("enrichment not applied: %+v", updated)
	}
	if updated.Fingerprint != f.Fingerprint || updated.Title != f.Title || updated.Source != f.Source || updated.Status != f.Status {
		t.Fatal("enrichment must not change identity, fingerprint or status")
	}
	cleared, err := UpdateFindingEnrichment(f.ID, FindingEnrichment{ClearConfidence: true})
	if err != nil || cleared.Confidence != nil {
		t.Fatalf("confidence must be clearable: %v %v", cleared, err)
	}
	bad := "urgent"
	if _, err := UpdateFindingEnrichment(f.ID, FindingEnrichment{Severity: &bad}); !errors.Is(err, models.ErrFindingInvalid) {
		t.Fatalf("invalid severity must be refused, got %v", err)
	}
	if _, err := UpdateFindingEnrichment(9999, FindingEnrichment{Severity: &severity}); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("missing finding must be not found, got %v", err)
	}
}

func TestUpdateFindingStatusTransitions(t *testing.T) {
	withFindingDB(t)
	f, _, _ := UpsertFinding(observation(base), base)
	for _, step := range []struct {
		to models.FindingStatus
		ok bool
	}{
		{models.FindingStatusNew, true},            // idempotent
		{models.FindingStatusResolved, true},       // new → resolved
		{models.FindingStatusConfirmed, false},     // resolved → confirmed refused
		{models.FindingStatusNeedsReview, true},    // reopen
		{models.FindingStatusFalsePositive, true},  // needs_review → false_positive
		{models.FindingStatusNew, false},           // never back to new
		{models.FindingStatusNeedsReview, true},    // reopen a false positive
		{models.FindingStatusConfirmed, true},      // needs_review → confirmed
		{models.FindingStatusFalsePositive, false}, // confirmed → false_positive refused (via review)
	} {
		_, err := UpdateFindingStatus(f.ID, step.to)
		if (err == nil) != step.ok {
			t.Fatalf("→ %s: ok=%v err=%v", step.to, step.ok, err)
		}
		if err != nil && !errors.Is(err, ErrFindingTransition) {
			t.Fatalf("refusals must be ErrFindingTransition, got %v", err)
		}
	}
	current, _ := GetFindingByID(f.ID)
	if current.Status != models.FindingStatusConfirmed {
		t.Fatalf("refused transitions must not change the status, got %s", current.Status)
	}
}

func TestListFindingsFiltersPaginationAndOrder(t *testing.T) {
	withFindingDB(t)
	mk := func(title, severity, source, sourceType, category string, seen time.Time) {
		t.Helper()
		if _, _, err := UpsertFinding(models.Finding{SourceType: sourceType, Source: source, Category: category, Title: title, Severity: severity, FirstSeen: seen, LastSeen: seen}, base); err != nil {
			t.Fatal(err)
		}
	}
	mk("A", "high", "suricata", "network_detection", "ids_alert", base)
	mk("B", "low", "suricata", "network_detection", "ids_alert", base.Add(3*time.Hour))
	mk("C", "high", "netalertx", "network_inventory", "new_device", base.Add(time.Hour))
	mk("D", "info", "appsec-audit", "appsec", "dependency", base.Add(2*time.Hour))

	all, total, err := ListFindings(FindingFilter{})
	if err != nil || total != 4 {
		t.Fatalf("total=%d err=%v", total, err)
	}
	if got := [4]string{all[0].Title, all[1].Title, all[2].Title, all[3].Title}; got != [4]string{"B", "D", "C", "A"} {
		t.Fatalf("default order must be last_seen DESC, got %v", got)
	}
	for name, filter := range map[string]FindingFilter{
		"severity":    {Severity: "high"},
		"source":      {Source: "suricata"},
		"source_type": {SourceType: "network_detection"},
		"category":    {Category: "ids_alert"},
	} {
		if _, n, _ := ListFindings(filter); n != 2 {
			t.Errorf("filter %s: want 2, got %d", name, n)
		}
	}
	f, _ := GetFindingByID(all[0].ID)
	UpdateFindingStatus(f.ID, models.FindingStatusResolved)
	if _, n, _ := ListFindings(FindingFilter{Status: "resolved"}); n != 1 {
		t.Errorf("status filter: want 1, got %d", n)
	}
	page2, total, _ := ListFindings(FindingFilter{Page: 2, Limit: 3})
	if total != 4 || len(page2) != 1 || page2[0].Title != "A" {
		t.Fatalf("pagination: total=%d page2=%v", total, page2)
	}
	if page, limit := (FindingFilter{Limit: 5000}).NormalizePage(); page != 1 || limit != 50 {
		t.Fatalf("limits must be bounded, got %d/%d", page, limit)
	}
}

func TestDeleteFinding(t *testing.T) {
	withFindingDB(t)
	f, _, _ := UpsertFinding(observation(base), base)
	if err := DeleteFinding(f.ID); err != nil {
		t.Fatal(err)
	}
	if countFindings(t) != 0 {
		t.Fatal("finding not deleted")
	}
	if err := DeleteFinding(f.ID); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("deleting a missing finding must be not found, got %v", err)
	}
}

func TestUpsertFindingWithoutSeverityStoresUnknown(t *testing.T) {
	withFindingDB(t)
	f, _, err := UpsertFinding(models.Finding{SourceType: "network_inventory", Source: "netalertx", Category: "new_device", Title: "Nouvel appareil", EntityRef: "mac:00:11:22:33:44:55"}, base)
	if err != nil || f.Severity != models.FindingSeverityUnknown {
		t.Fatalf("absent severity must be stored as unknown, got %q (%v)", f.Severity, err)
	}
	if _, n, _ := ListFindings(FindingFilter{Severity: "unknown"}); n != 1 {
		t.Fatalf("severity=unknown filter: want 1, got %d", n)
	}
}

func TestUpsertFindingTitleIdentity(t *testing.T) {
	withFindingDB(t)
	withRef := observation(base)
	if _, _, err := UpsertFinding(withRef, base); err != nil {
		t.Fatal(err)
	}
	reworded := observation(base.Add(time.Hour))
	reworded.Title = "Scan Nmap détecté par la règle ET"
	merged, created, err := UpsertFinding(reworded, base)
	if err != nil || created {
		t.Fatalf("with an entity_ref, a reworded title must merge: created=%v err=%v", created, err)
	}
	if merged.Title != withRef.Title {
		t.Fatalf("the first title is kept on merge, got %q", merged.Title)
	}

	a, b := observation(base), observation(base)
	a.EntityRef, b.EntityRef = "", ""
	a.Title, b.Title = "Port 22 ouvert", "Port 3389 ouvert"
	if _, created, _ := UpsertFinding(a, base); !created {
		t.Fatal("first finding without entity_ref must be created")
	}
	if _, created, _ := UpsertFinding(b, base); !created {
		t.Fatal("without an entity_ref, a different title must be a different finding")
	}
	if countFindings(t) != 3 {
		t.Fatalf("want 3 rows, got %d", countFindings(t))
	}
}
