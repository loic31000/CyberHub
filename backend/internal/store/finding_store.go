package store

import (
	"errors"
	"strings"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"gorm.io/gorm"
)

// Findings store (#79). One row per fingerprint: a re-observation of the
// same logical signal is merged into the existing row instead of creating a
// duplicate. Analyst decisions (status) and values already present are never
// overwritten by a producer.

type FindingFilter struct {
	Status     string
	Severity   string
	Source     string
	SourceType string
	Category   string
	Page       int
	Limit      int
}

const (
	findingDefaultLimit = 50
	findingMaxLimit     = 200
)

// NormalizePage returns the effective page and limit used by ListFindings.
func (f FindingFilter) NormalizePage() (int, int) {
	page, limit := f.Page, f.Limit
	if page < 1 {
		page = 1
	}
	if limit <= 0 || limit > findingMaxLimit {
		limit = findingDefaultLimit
	}
	return page, limit
}

func ListFindings(f FindingFilter) ([]models.Finding, int64, error) {
	q := DB.Model(&models.Finding{})
	for column, value := range map[string]string{"status": f.Status, "severity": f.Severity, "source": f.Source, "source_type": f.SourceType, "category": f.Category} {
		if value != "" {
			q = q.Where(column+" = ?", value)
		}
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	page, limit := f.NormalizePage()
	items := []models.Finding{}
	err := q.Order("last_seen DESC").Order("id DESC").Offset((page - 1) * limit).Limit(limit).Find(&items).Error
	return items, total, err
}

func GetFindingByID(id uint) (*models.Finding, error) {
	var finding models.Finding
	if err := DB.First(&finding, id).Error; err != nil {
		return nil, err
	}
	return &finding, nil
}

// UpsertFinding normalizes and validates input, computes its fingerprint and
// either creates a new Finding (status "new") or merges the observation into
// the existing one. It reports whether a row was created.
func UpsertFinding(input models.Finding, now time.Time) (*models.Finding, bool, error) {
	input.Normalize(now)
	if err := input.Validate(); err != nil {
		return nil, false, err
	}
	input.Fingerprint = models.FindingFingerprint(input.Identity())

	var result models.Finding
	created := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		var existing models.Finding
		err := tx.Where("fingerprint = ?", input.Fingerprint).First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			input.ID, input.Status = 0, models.FindingStatusNew
			input.CreatedAt, input.UpdatedAt = time.Time{}, time.Time{}
			if err := tx.Create(&input).Error; err != nil {
				return err
			}
			result, created = input, true
			return nil
		}
		if err != nil {
			return err
		}
		mergeObservation(&existing, input)
		if err := tx.Model(&existing).Select("first_seen", "last_seen", "evidence", "description", "explanation", "limitation", "next_action", "confidence").Updates(&existing).Error; err != nil {
			return err
		}
		return tx.First(&result, existing.ID).Error
	})
	if err != nil {
		return nil, false, err
	}
	return &result, created, nil
}

// mergeObservation applies a new occurrence of the same signal:
//   - first_seen moves back to an earlier observation, last_seen only forward;
//   - evidence is merged without duplicates (models.MergeEvidence);
//   - empty enrichment fields are filled, present ones are kept (they may
//     carry analyst edits); severity and status are never touched here.
func mergeObservation(existing *models.Finding, incoming models.Finding) {
	if incoming.FirstSeen.Before(existing.FirstSeen) {
		existing.FirstSeen = incoming.FirstSeen
	}
	if incoming.LastSeen.After(existing.LastSeen) {
		existing.LastSeen = incoming.LastSeen
	}
	existing.Evidence = models.MergeEvidence(existing.Evidence, incoming.Evidence)
	for _, pair := range []struct {
		target *string
		value  string
	}{
		{&existing.Description, incoming.Description},
		{&existing.Explanation, incoming.Explanation},
		{&existing.Limitation, incoming.Limitation},
		{&existing.NextAction, incoming.NextAction},
	} {
		if *pair.target == "" {
			*pair.target = pair.value
		}
	}
	if existing.Confidence == nil {
		existing.Confidence = incoming.Confidence
	}
}

// FindingEnrichment lists the only fields an update may change. Identity
// fields (source_type, source, category, title, asset_id, entity_ref) are
// immutable: changing them would change the fingerprint. Status has its own
// route. A nil pointer means "unchanged"; ClearConfidence removes it.
type FindingEnrichment struct {
	Description     *string
	Severity        *string
	Confidence      *float64
	ClearConfidence bool
	Explanation     *string
	Limitation      *string
	NextAction      *string
	Evidence        *[]models.FindingEvidence
}

func UpdateFindingEnrichment(id uint, change FindingEnrichment) (*models.Finding, error) {
	finding, err := GetFindingByID(id)
	if err != nil {
		return nil, err
	}
	// Only the edited fields are normalized; identity fields are never touched.
	for _, pair := range []struct {
		target *string
		value  *string
	}{
		{&finding.Description, change.Description}, {&finding.Explanation, change.Explanation},
		{&finding.Limitation, change.Limitation}, {&finding.NextAction, change.NextAction},
	} {
		if pair.value != nil {
			*pair.target = strings.TrimSpace(*pair.value)
		}
	}
	if change.Severity != nil {
		finding.Severity = strings.ToLower(strings.TrimSpace(*change.Severity))
	}
	if change.ClearConfidence {
		finding.Confidence = nil
	} else if change.Confidence != nil {
		finding.Confidence = change.Confidence
	}
	if change.Evidence != nil {
		finding.Evidence = models.NormalizeEvidence(*change.Evidence)
	}
	if err := finding.Validate(); err != nil {
		return nil, err
	}
	if err := DB.Model(finding).Select("description", "severity", "confidence", "explanation", "limitation", "next_action", "evidence").Updates(finding).Error; err != nil {
		return nil, err
	}
	return GetFindingByID(id)
}

// ErrFindingTransition marks a refused status change.
var ErrFindingTransition = errors.New("transition de statut refusée")

func UpdateFindingStatus(id uint, to models.FindingStatus) (*models.Finding, error) {
	finding, err := GetFindingByID(id)
	if err != nil {
		return nil, err
	}
	if err := models.ValidateFindingTransition(finding.Status, to); err != nil {
		return nil, errors.Join(ErrFindingTransition, err)
	}
	if finding.Status == to {
		return finding, nil
	}
	if err := DB.Model(finding).Update("status", to).Error; err != nil {
		return nil, err
	}
	return GetFindingByID(id)
}

func DeleteFinding(id uint) error {
	result := DB.Delete(&models.Finding{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
