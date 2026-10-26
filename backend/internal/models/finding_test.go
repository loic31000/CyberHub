package models

import (
	"errors"
	"math"
	"strings"
	"testing"
	"time"
)

var t0 = time.Date(2026, 10, 1, 8, 0, 0, 0, time.UTC)

// Golden fingerprints, computed independently (Python hashlib) from the
// documented canonical form, so they also cross-check the Go implementation:
//   - with entity_ref (title not part of the identity);
//   - without entity_ref (normalized title as fallback, non-ASCII on purpose).
const (
	goldenFingerprintWithRef    = "bcad00ada771c8e6213b4f13480e5ae3fc2c5695d09cc288af3f9d6aff42aa52"
	goldenFingerprintWithoutRef = "268a6ffc8e77fdf1ecafc06ee6db51e422bf3800102b040058ec787d96b86604"
)

func validFinding() Finding {
	f := Finding{SourceType: "network_detection", Source: "suricata", Category: "ids_alert", Title: "ET SCAN Nmap", Severity: "medium"}
	f.Normalize(t0)
	return f
}

func ptr[T any](v T) *T { return &v }

func TestFindingMinimalIsValid(t *testing.T) {
	f := validFinding()
	if err := f.Validate(); err != nil {
		t.Fatalf("minimal finding should be valid: %v", err)
	}
	if !f.FirstSeen.Equal(t0) || !f.LastSeen.Equal(t0) {
		t.Fatalf("missing timestamps must default to now, got %v / %v", f.FirstSeen, f.LastSeen)
	}
	if f.Confidence != nil {
		t.Fatal("absent confidence must stay absent, not 0")
	}
}

func TestFindingValidation(t *testing.T) {
	cases := map[string]func(*Finding){
		"empty source":                func(f *Finding) { f.Source = "" },
		"empty source_type":           func(f *Finding) { f.SourceType = "   " },
		"empty category":              func(f *Finding) { f.Category = "" },
		"empty title":                 func(f *Finding) { f.Title = "" },
		"invalid severity":            func(f *Finding) { f.Severity = "urgent" },
		"blank severity unnormalized": func(f *Finding) { f.Severity = "" }, // Normalize turns "" into unknown; Validate alone does not guess
		"confidence above 1":          func(f *Finding) { f.Confidence = ptr(1.01) },
		"confidence below 0":          func(f *Finding) { f.Confidence = ptr(-0.1) },
		"confidence NaN":              func(f *Finding) { f.Confidence = ptr(math.NaN()) },
		"first after last":            func(f *Finding) { f.FirstSeen, f.LastSeen = t0.Add(time.Hour), t0 },
		"title too long":              func(f *Finding) { f.Title = strings.Repeat("a", FindingMaxTitle+1) },
		"description too long":        func(f *Finding) { f.Description = strings.Repeat("a", FindingMaxDescription+1) },
		"explanation too long":        func(f *Finding) { f.Explanation = strings.Repeat("a", FindingMaxText+1) },
		"control character":           func(f *Finding) { f.Title = "bad\x00title" },
		"evidence without value":      func(f *Finding) { f.Evidence = []FindingEvidence{{Label: "rule"}} },
		"evidence value too long": func(f *Finding) {
			f.Evidence = []FindingEvidence{{Label: "rule", Value: strings.Repeat("v", FindingMaxEvidenceText+1)}}
		},
		"too many evidence items": func(f *Finding) {
			for i := 0; i <= FindingMaxEvidence; i++ {
				f.Evidence = append(f.Evidence, FindingEvidence{Label: "l", Value: strings.Repeat("v", i+1)})
			}
		},
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			f := validFinding()
			mutate(&f)
			err := f.Validate()
			if !errors.Is(err, ErrFindingInvalid) {
				t.Fatalf("want ErrFindingInvalid, got %v", err)
			}
		})
	}
}

func TestFindingValidConfidenceBounds(t *testing.T) {
	for _, c := range []float64{0, 0.5, 1} {
		f := validFinding()
		f.Confidence = ptr(c)
		if err := f.Validate(); err != nil {
			t.Fatalf("confidence %v should be valid: %v", c, err)
		}
	}
}

func TestFindingNormalizeTimestamps(t *testing.T) {
	f := Finding{LastSeen: t0}
	f.Normalize(t0.Add(time.Hour))
	if !f.FirstSeen.Equal(t0) {
		t.Fatalf("missing first_seen must take last_seen, got %v", f.FirstSeen)
	}
	g := Finding{FirstSeen: t0}
	g.Normalize(t0.Add(time.Hour))
	if !g.LastSeen.Equal(t0) {
		t.Fatalf("missing last_seen must take first_seen, got %v", g.LastSeen)
	}
}

func TestFindingFingerprint(t *testing.T) {
	base := FindingIdentity{SourceType: "network_detection", Source: "suricata", Category: "ids_alert", Title: "ET SCAN Nmap", AssetID: "asset-1", EntityRef: "sid:2000001"}
	fp := FindingFingerprint(base)
	if len(fp) != 64 || strings.Trim(fp, "0123456789abcdef") != "" {
		t.Fatalf("fingerprint must be a hex SHA-256, got %q", fp)
	}
	if FindingFingerprint(base) != fp {
		t.Fatal("fingerprint must be deterministic")
	}
	// Golden value: an unnoticed change of the algorithm would silently split
	// existing Findings; a real change must bump the "finding:v1" prefix.
	if fp != goldenFingerprintWithRef {
		t.Fatalf("fingerprint algorithm changed: got %s", fp)
	}

	normalized := FindingIdentity{SourceType: "  Network_Detection ", Source: "SURICATA", Category: "ids_alert", Title: "  ET   scan\tNMAP ", AssetID: " asset-1 ", EntityRef: "sid:2000001"}
	if FindingFingerprint(normalized) != fp {
		t.Fatal("same identity after normalization must give the same fingerprint")
	}

	for name, other := range map[string]FindingIdentity{
		"source":      {base.SourceType, "zeek", base.Category, base.Title, base.AssetID, base.EntityRef},
		"source_type": {"appsec", base.Source, base.Category, base.Title, base.AssetID, base.EntityRef},
		"category":    {base.SourceType, base.Source, "other", base.Title, base.AssetID, base.EntityRef},
		"asset_id":    {base.SourceType, base.Source, base.Category, base.Title, "asset-2", base.EntityRef},
		"entity_ref":  {base.SourceType, base.Source, base.Category, base.Title, base.AssetID, "sid:2000002"},
		"no ref":      {base.SourceType, base.Source, base.Category, base.Title, base.AssetID, ""},
		"field shift": {base.SourceType, base.Source, base.Category, base.Title, "", "asset-1"},
	} {
		if FindingFingerprint(other) == fp {
			t.Fatalf("a different %s must give a different fingerprint", name)
		}
	}
}

func TestFindingFingerprintTitleRole(t *testing.T) {
	withRef := FindingIdentity{SourceType: "network_inventory", Source: "netalertx", Category: "new_device", AssetID: "asset-7", EntityRef: "mac:00:11:22:33:44:55"}
	a, b := withRef, withRef
	a.Title, b.Title = "Nouvel appareil détecté", "Nouvel appareil sur le réseau"
	if FindingFingerprint(a) != FindingFingerprint(b) {
		t.Fatal("with an entity_ref, a reworded title must keep the same fingerprint")
	}

	noRef := FindingIdentity{SourceType: "network_inventory", Source: "netalertx", Category: "new_device", Title: "Nouvel appareil détecté"}
	if got := FindingFingerprint(noRef); got != goldenFingerprintWithoutRef {
		t.Fatalf("fallback fingerprint changed: got %s", got)
	}
	other := noRef
	other.Title = "Nouvel appareil sur le réseau"
	if FindingFingerprint(noRef) == FindingFingerprint(other) {
		t.Fatal("without an entity_ref, different titles must stay different findings")
	}
	spaced := noRef
	spaced.Title, spaced.EntityRef = "  NOUVEL   appareil détecté ", "   "
	if FindingFingerprint(noRef) != FindingFingerprint(spaced) {
		t.Fatal("the title fallback is normalized and a blank entity_ref counts as absent")
	}
}

func TestFindingFingerprintIgnoresNonIdentityFields(t *testing.T) {
	for _, entityRef := range []string{"", "sid:2000001"} {
		changes := map[string]func(*Finding){
			"severity":   func(f *Finding) { f.Severity = "critical" },
			"confidence": func(f *Finding) { f.Confidence = ptr(0.9) },
			"status":     func(f *Finding) { f.Status = FindingStatusConfirmed },
			"evidence":   func(f *Finding) { f.Evidence = []FindingEvidence{{Label: "rule", Value: "x"}} },
			"timestamps": func(f *Finding) {
				f.FirstSeen, f.LastSeen, f.CreatedAt, f.UpdatedAt = t0.Add(-time.Hour), t0.Add(time.Hour), t0, t0
			},
			"texts": func(f *Finding) { f.Description, f.Explanation, f.Limitation, f.NextAction = "d", "e", "l", "n" },
		}
		for name, change := range changes {
			a := validFinding()
			a.EntityRef = entityRef
			b := a
			change(&b)
			if FindingFingerprint(a.Identity()) != FindingFingerprint(b.Identity()) {
				t.Fatalf("entity_ref=%q: a different %s must not change the fingerprint", entityRef, name)
			}
		}
	}
}

func TestFindingSeverityUnknown(t *testing.T) {
	absent := Finding{SourceType: "network_inventory", Source: "netalertx", Category: "new_device", Title: "t"}
	absent.Normalize(t0)
	if absent.Severity != FindingSeverityUnknown || absent.Validate() != nil {
		t.Fatalf("absent severity must become unknown and be valid, got %q", absent.Severity)
	}
	for _, value := range []string{"unknown", " UNKNOWN ", "info", "critical"} {
		f := validFinding()
		f.Severity = value
		f.Normalize(t0)
		if err := f.Validate(); err != nil {
			t.Fatalf("severity %q must be accepted: %v", value, err)
		}
	}
	invalidSeverity := validFinding()
	invalidSeverity.Severity = "urgent"
	invalidSeverity.Normalize(t0)
	if !errors.Is(invalidSeverity.Validate(), ErrFindingInvalid) {
		t.Fatal("an explicitly invalid severity must still be refused")
	}
}

func TestFindingTransitions(t *testing.T) {
	all := []FindingStatus{FindingStatusNew, FindingStatusNeedsReview, FindingStatusConfirmed, FindingStatusFalsePositive, FindingStatusResolved}
	allowed := map[[2]FindingStatus]bool{
		{FindingStatusNew, FindingStatusNeedsReview}: true, {FindingStatusNew, FindingStatusConfirmed}: true,
		{FindingStatusNew, FindingStatusFalsePositive}: true, {FindingStatusNew, FindingStatusResolved}: true,
		{FindingStatusNeedsReview, FindingStatusConfirmed}: true, {FindingStatusNeedsReview, FindingStatusFalsePositive}: true,
		{FindingStatusNeedsReview, FindingStatusResolved}: true,
		{FindingStatusConfirmed, FindingStatusResolved}:   true, {FindingStatusConfirmed, FindingStatusNeedsReview}: true,
		{FindingStatusFalsePositive, FindingStatusNeedsReview}: true,
		{FindingStatusResolved, FindingStatusNeedsReview}:      true,
	}
	for _, from := range all {
		for _, to := range all {
			err := ValidateFindingTransition(from, to)
			want := from == to || allowed[[2]FindingStatus{from, to}]
			if (err == nil) != want {
				t.Errorf("%s → %s: allowed=%v, err=%v", from, to, want, err)
			}
		}
	}
	if ValidateFindingTransition(FindingStatusNew, "accepted_risk") == nil {
		t.Fatal("unknown statuses must be refused")
	}
}

func TestMergeEvidence(t *testing.T) {
	early, late := t0, t0.Add(time.Hour)
	existing := []FindingEvidence{{Label: "rule", Value: "ET SCAN", Source: "suricata", ObservedAt: &late}}
	incoming := []FindingEvidence{
		{Label: "rule", Value: "ET SCAN", Source: "suricata", ObservedAt: &early}, // same fact, earlier
		{Label: "src_ip", Value: "198.51.100.7", Source: "suricata"},
		{Label: "src_ip", Value: "198.51.100.7", Source: "suricata"}, // duplicate inside the batch
	}
	merged := MergeEvidence(existing, incoming)
	if len(merged) != 2 {
		t.Fatalf("want 2 distinct facts, got %d: %+v", len(merged), merged)
	}
	if !merged[0].ObservedAt.Equal(early) {
		t.Fatal("for a fact already present, the earliest observed_at must win")
	}
	if merged[1].Label != "src_ip" {
		t.Fatal("new facts are appended after existing ones, in order")
	}

	full := make([]FindingEvidence, FindingMaxEvidence)
	for i := range full {
		full[i] = FindingEvidence{Label: "l", Value: strings.Repeat("v", i+1)}
	}
	if got := MergeEvidence(full, []FindingEvidence{{Label: "extra", Value: "x"}}); len(got) != FindingMaxEvidence {
		t.Fatalf("merge must never exceed %d items, got %d", FindingMaxEvidence, len(got))
	}
}

func TestNormalizeEvidenceDropsEmptyEntries(t *testing.T) {
	got := NormalizeEvidence([]FindingEvidence{{Label: "  ", Value: " "}, {Label: " rule ", Value: " x "}})
	if len(got) != 1 || got[0].Label != "rule" || got[0].Value != "x" {
		t.Fatalf("got %+v", got)
	}
}
