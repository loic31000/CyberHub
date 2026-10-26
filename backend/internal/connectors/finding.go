package connectors

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/models"
)

var (
	// ErrNotAFindingProducer: the connector does not declare produce_findings.
	ErrNotAFindingProducer = errors.New("connector does not produce findings")
	// ErrMissingEntityRef: the source has natural identifiers but none was given.
	ErrMissingEntityRef = errors.New("entity_ref is required for this connector")
)

// FindingDraft is what a connector knows about one signal. Provenance
// (source_type, source, evidence source) is not part of it: it comes from
// the connector definition, so a connector cannot misattribute its data.
type FindingDraft struct {
	Category string
	Title    string
	AssetID  string
	// EntityRef is the source's own stable identifier for the signal, e.g.
	// "sid:2010937" for a Suricata rule. Never a human title.
	EntityRef   string
	Severity    string
	Confidence  *float64
	Description string
	Explanation string
	Limitation  string
	NextAction  string
	Evidence    []models.FindingEvidence
	// ObservedAt is when the source saw the signal; zero means now.
	ObservedAt time.Time
}

// NewFinding builds a validated Finding from a connector's draft, ready for
// store.UpsertFinding. It does not write anything.
func (d Definition) NewFinding(draft FindingDraft, now time.Time) (models.Finding, error) {
	if !d.HasCapability(CapabilityProduceFindings) {
		return models.Finding{}, fmt.Errorf("%w: %s", ErrNotAFindingProducer, d.ID)
	}
	entityRef := strings.TrimSpace(draft.EntityRef)
	if d.NaturalEntityRef && entityRef == "" {
		return models.Finding{}, fmt.Errorf("%w: %s", ErrMissingEntityRef, d.ID)
	}
	observed := draft.ObservedAt
	if observed.IsZero() {
		observed = now
	}
	evidence := make([]models.FindingEvidence, len(draft.Evidence))
	for i, e := range draft.Evidence {
		if strings.TrimSpace(e.Source) == "" {
			e.Source = d.Source
		}
		evidence[i] = e
	}
	f := models.Finding{
		SourceType:  string(d.Type),
		Source:      d.Source,
		Category:    draft.Category,
		Title:       draft.Title,
		AssetID:     draft.AssetID,
		EntityRef:   entityRef,
		Severity:    draft.Severity,
		Confidence:  draft.Confidence,
		Description: draft.Description,
		Explanation: draft.Explanation,
		Limitation:  draft.Limitation,
		NextAction:  draft.NextAction,
		Evidence:    evidence,
		FirstSeen:   observed,
		LastSeen:    observed,
	}
	f.Normalize(now)
	if err := f.Validate(); err != nil {
		return models.Finding{}, err
	}
	return f, nil
}
