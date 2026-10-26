package models

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

// Finding — something that deserves the user's attention (#79).
//
// A Finding is NOT automatically a compromise, a confirmed attack, a critical
// alert or an incident: it is a signal to review. Producers (future
// connectors, #94) provide what they really know; nothing is inferred here —
// no severity derived from a title, no generated explanation.
//
// Identity and deduplication rest on Fingerprint, computed by the backend
// from the stable identity fields only (see FindingIdentity). Those fields
// are immutable after creation; enrichment fields stay editable.
//
// Investigations (#87) will reference a Finding through the existing
// InvestigationEvent provenance fields:
//
//	source_module = "finding", source_entity_id = "<finding id>"
//
// Assets do not exist yet: AssetID is a free, optional reference kept for
// compatibility with a future asset model.

// FindingStatus is the analyst state of a Finding.
type FindingStatus string

const (
	FindingStatusNew           FindingStatus = "new"
	FindingStatusNeedsReview   FindingStatus = "needs_review"
	FindingStatusConfirmed     FindingStatus = "confirmed"
	FindingStatusFalsePositive FindingStatus = "false_positive"
	FindingStatusResolved      FindingStatus = "resolved"
)

// Severities reuse the scale of investigation events, preceded by "unknown":
// a producer may honestly provide no severity, and none is ever invented.
// Conceptual order: unknown, info, low, medium, high, critical.
const FindingSeverityUnknown = "unknown"

var findingSeverities = map[string]bool{FindingSeverityUnknown: true, "info": true, "low": true, "medium": true, "high": true, "critical": true}

// findingTransitions lists, for each status, the statuses it may move to.
// Staying on the same status is always allowed (idempotent). "new" is only
// an initial state. A resolved or false-positive Finding is reopened through
// needs_review; a confirmed one can be resolved or sent back to review.
var findingTransitions = map[FindingStatus][]FindingStatus{
	FindingStatusNew:           {FindingStatusNeedsReview, FindingStatusConfirmed, FindingStatusFalsePositive, FindingStatusResolved},
	FindingStatusNeedsReview:   {FindingStatusConfirmed, FindingStatusFalsePositive, FindingStatusResolved},
	FindingStatusConfirmed:     {FindingStatusResolved, FindingStatusNeedsReview},
	FindingStatusFalsePositive: {FindingStatusNeedsReview},
	FindingStatusResolved:      {FindingStatusNeedsReview},
}

// Size limits (characters, or items for Evidence).
const (
	FindingMaxKey          = 64   // source_type, source, category
	FindingMaxTitle        = 200  //
	FindingMaxRef          = 256  // asset_id, entity_ref
	FindingMaxDescription  = 4000 //
	FindingMaxText         = 2000 // explanation, limitation, next_action
	FindingMaxEvidence     = 50   // items
	FindingMaxEvidenceText = 2000 // evidence value
	FindingMaxEvidenceKey  = 120  // evidence label and source
)

// FindingEvidence is one traceable fact: which data, from which source,
// observed when (if known).
type FindingEvidence struct {
	Label      string     `json:"label"`
	Value      string     `json:"value"`
	Source     string     `json:"source,omitempty"`
	ObservedAt *time.Time `json:"observed_at,omitempty"`
}

type Finding struct {
	ID          uint              `json:"id"          gorm:"primaryKey;autoIncrement"`
	Fingerprint string            `json:"fingerprint" gorm:"type:text;not null;uniqueIndex:idx_findings_fingerprint"`
	SourceType  string            `json:"source_type" gorm:"type:text;not null;index:idx_findings_source,priority:1"`
	Source      string            `json:"source"      gorm:"type:text;not null;index:idx_findings_source,priority:2"`
	Category    string            `json:"category"    gorm:"type:text;not null"`
	Title       string            `json:"title"       gorm:"type:text;not null"`
	AssetID     string            `json:"asset_id"    gorm:"type:text"`
	EntityRef   string            `json:"entity_ref"  gorm:"type:text"`
	Severity    string            `json:"severity"    gorm:"type:text;not null;default:'unknown';index:idx_findings_severity"`
	Confidence  *float64          `json:"confidence"`
	Status      FindingStatus     `json:"status"      gorm:"type:text;not null;default:'new';index:idx_findings_status"`
	Description string            `json:"description" gorm:"type:text"`
	Evidence    []FindingEvidence `json:"evidence"    gorm:"type:text;not null;serializer:json"`
	Explanation string            `json:"explanation" gorm:"type:text"`
	Limitation  string            `json:"limitation"  gorm:"type:text"`
	NextAction  string            `json:"next_action" gorm:"type:text"`
	FirstSeen   time.Time         `json:"first_seen"  gorm:"not null"`
	LastSeen    time.Time         `json:"last_seen"   gorm:"not null;index:idx_findings_last_seen"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// FindingIdentity is the stable identity of a logical signal. Severity,
// confidence, texts, evidence, timestamps and status are deliberately absent:
// a re-observation or an analyst decision never changes what the signal is.
// Title only counts as a fallback when EntityRef is empty (FindingFingerprint);
// it stays immutable after creation so that fallback remains stable.
type FindingIdentity struct {
	SourceType string
	Source     string
	Category   string
	Title      string
	AssetID    string
	EntityRef  string
}

func (f *Finding) Identity() FindingIdentity {
	return FindingIdentity{f.SourceType, f.Source, f.Category, f.Title, f.AssetID, f.EntityRef}
}

// normalizeKey trims, lowercases and collapses inner whitespace.
func normalizeKey(value string) string {
	return strings.Join(strings.FieldsFunc(strings.ToLower(value), unicode.IsSpace), " ")
}

// FindingFingerprint is SHA-256 over a versioned, field-labelled canonical
// form of the normalized identity. Field labels and the version prefix keep
// it unambiguous; changing the algorithm means a new version prefix.
//
// A human title may be reworded without the signal changing, so it is not
// identity when the producer gives a stable entity_ref. Without entity_ref,
// the normalized title is the V1 fallback, so that unrelated signals lacking
// a stable reference are not merged together. (#94 will define how
// connectors provide entity_ref.)
func FindingFingerprint(id FindingIdentity) string {
	entityRef := strings.TrimSpace(id.EntityRef)
	fallback := ""
	if entityRef == "" {
		fallback = normalizeKey(id.Title)
	}
	canonical := strings.Join([]string{
		"finding:v1",
		"source_type=" + normalizeKey(id.SourceType),
		"source=" + normalizeKey(id.Source),
		"category=" + normalizeKey(id.Category),
		"asset_id=" + strings.TrimSpace(id.AssetID),
		"entity_ref=" + entityRef,
		"identity_fallback=" + fallback,
	}, "\x1f")
	sum := sha256.Sum256([]byte(canonical))
	return hex.EncodeToString(sum[:])
}

// IsFindingSeverity reports whether s is one of unknown, info, low, medium, high, critical.
func IsFindingSeverity(s string) bool { return findingSeverities[s] }

// IsFindingStatus reports whether s is one of the five V1 statuses.
func IsFindingStatus(s string) bool { _, ok := findingTransitions[FindingStatus(s)]; return ok }

// ValidateFindingTransition is the single place deciding status changes.
func ValidateFindingTransition(from, to FindingStatus) error {
	if !IsFindingStatus(string(to)) {
		return fmt.Errorf("statut inconnu %q (new|needs_review|confirmed|false_positive|resolved)", to)
	}
	if from == to {
		return nil
	}
	for _, allowed := range findingTransitions[from] {
		if allowed == to {
			return nil
		}
	}
	return fmt.Errorf("transition interdite : %s → %s", from, to)
}

// ErrFindingInvalid wraps every validation failure so handlers can map it to 400.
var ErrFindingInvalid = errors.New("finding invalide")

func invalid(format string, args ...any) error {
	return fmt.Errorf("%w : %s", ErrFindingInvalid, fmt.Sprintf(format, args...))
}

func checkText(field, value string, max int, required bool) error {
	if required && strings.TrimSpace(value) == "" {
		return invalid("%s est requis", field)
	}
	if utf8.RuneCountInString(value) > max {
		return invalid("%s dépasse %d caractères", field, max)
	}
	for _, r := range value {
		if unicode.IsControl(r) && r != '\n' && r != '\t' && r != '\r' {
			return invalid("%s contient des caractères de contrôle", field)
		}
	}
	return nil
}

// Normalize trims every text field, removes empty evidence entries and
// fills missing observation times; it never invents business content.
func (f *Finding) Normalize(now time.Time) {
	for _, field := range []*string{&f.SourceType, &f.Source, &f.Category, &f.Title, &f.AssetID, &f.EntityRef, &f.Description, &f.Explanation, &f.Limitation, &f.NextAction} {
		*field = strings.TrimSpace(*field)
	}
	f.SourceType, f.Source, f.Category = strings.ToLower(f.SourceType), strings.ToLower(f.Source), strings.ToLower(f.Category)
	f.Severity = strings.ToLower(strings.TrimSpace(f.Severity))
	if f.Severity == "" {
		f.Severity = FindingSeverityUnknown // absent ≠ info: nothing is invented
	}
	f.Evidence = NormalizeEvidence(f.Evidence)
	switch {
	case f.FirstSeen.IsZero() && f.LastSeen.IsZero():
		f.FirstSeen, f.LastSeen = now, now
	case f.FirstSeen.IsZero():
		f.FirstSeen = f.LastSeen
	case f.LastSeen.IsZero():
		f.LastSeen = f.FirstSeen
	}
	f.FirstSeen, f.LastSeen = f.FirstSeen.UTC(), f.LastSeen.UTC()
}

// Validate checks a normalized Finding.
func (f *Finding) Validate() error {
	for _, field := range []struct {
		name, value string
		max         int
		required    bool
	}{
		{"source_type", f.SourceType, FindingMaxKey, true},
		{"source", f.Source, FindingMaxKey, true},
		{"category", f.Category, FindingMaxKey, true},
		{"title", f.Title, FindingMaxTitle, true},
		{"asset_id", f.AssetID, FindingMaxRef, false},
		{"entity_ref", f.EntityRef, FindingMaxRef, false},
		{"description", f.Description, FindingMaxDescription, false},
		{"explanation", f.Explanation, FindingMaxText, false},
		{"limitation", f.Limitation, FindingMaxText, false},
		{"next_action", f.NextAction, FindingMaxText, false},
	} {
		if err := checkText(field.name, field.value, field.max, field.required); err != nil {
			return err
		}
	}
	if err := ValidateFindingSeverity(f.Severity); err != nil {
		return err
	}
	if err := ValidateFindingConfidence(f.Confidence); err != nil {
		return err
	}
	if f.LastSeen.Before(f.FirstSeen) {
		return invalid("first_seen doit être antérieur ou égal à last_seen")
	}
	return ValidateEvidence(f.Evidence)
}

func ValidateFindingSeverity(severity string) error {
	if !IsFindingSeverity(severity) {
		return invalid("severity invalide (unknown|info|low|medium|high|critical)")
	}
	return nil
}

// ValidateFindingConfidence: optional; when present, the same 0–1 scale as Correlation.
func ValidateFindingConfidence(c *float64) error {
	if c != nil && (math.IsNaN(*c) || *c < 0 || *c > 1) {
		return invalid("confidence doit être comprise entre 0 et 1")
	}
	return nil
}

// NormalizeEvidence trims entries and drops those without label or value.
func NormalizeEvidence(items []FindingEvidence) []FindingEvidence {
	out := make([]FindingEvidence, 0, len(items))
	for _, item := range items {
		item.Label, item.Value, item.Source = strings.TrimSpace(item.Label), strings.TrimSpace(item.Value), strings.TrimSpace(item.Source)
		if item.Label == "" && item.Value == "" {
			continue
		}
		if item.ObservedAt != nil {
			at := item.ObservedAt.UTC()
			item.ObservedAt = &at
		}
		out = append(out, item)
	}
	return out
}

func ValidateEvidence(items []FindingEvidence) error {
	if len(items) > FindingMaxEvidence {
		return invalid("evidence dépasse %d éléments", FindingMaxEvidence)
	}
	for i, item := range items {
		if item.Label == "" || item.Value == "" {
			return invalid("evidence[%d] : label et value sont requis", i)
		}
		for _, check := range []struct {
			name, value string
			max         int
		}{{"label", item.Label, FindingMaxEvidenceKey}, {"value", item.Value, FindingMaxEvidenceText}, {"source", item.Source, FindingMaxEvidenceKey}} {
			if err := checkText(fmt.Sprintf("evidence[%d].%s", i, check.name), check.value, check.max, false); err != nil {
				return err
			}
		}
	}
	return nil
}

// evidenceKey identifies an evidence entry for deduplication (observed_at excluded:
// the same fact seen again is not a new fact).
func evidenceKey(item FindingEvidence) string {
	key, _ := json.Marshal([]string{item.Label, item.Value, item.Source})
	return string(key)
}

// MergeEvidence keeps the existing entries in order and appends the new
// distinct ones, up to FindingMaxEvidence; overflow is dropped
// deterministically. For a fact already present, the earliest observed_at wins.
func MergeEvidence(existing, incoming []FindingEvidence) []FindingEvidence {
	merged := append([]FindingEvidence{}, existing...)
	index := make(map[string]int, len(merged))
	for i, item := range merged {
		index[evidenceKey(item)] = i
	}
	for _, item := range incoming {
		if i, ok := index[evidenceKey(item)]; ok {
			if item.ObservedAt != nil && (merged[i].ObservedAt == nil || item.ObservedAt.Before(*merged[i].ObservedAt)) {
				merged[i].ObservedAt = item.ObservedAt
			}
			continue
		}
		if len(merged) >= FindingMaxEvidence {
			continue
		}
		index[evidenceKey(item)] = len(merged)
		merged = append(merged, item)
	}
	return merged
}
