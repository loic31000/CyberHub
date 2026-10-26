package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/cyber-hub/cyber-hub/internal/store"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Findings API (#79), under /api/findings (protected).
//
//	GET    /findings             list — filters status, severity, source, source_type, category; page, limit
//	GET    /findings/:id         one Finding
//	POST   /findings             create or merge by fingerprint (201 created, 200 merged)
//	PUT    /findings/:id         enrichment fields only (identity and status are refused)
//	PATCH  /findings/:id/status  status change through the central transition rules
//	DELETE /findings/:id
//
// Server errors return a generic message: evidence and inputs are never logged.

const findingMaxBody = 256 << 10 // 256 KiB, well above the field limits

var findingIdentityFields = map[string]bool{"source_type": true, "source": true, "category": true, "title": true, "asset_id": true, "entity_ref": true}
var findingEditableFields = map[string]bool{"description": true, "severity": true, "confidence": true, "explanation": true, "limitation": true, "next_action": true, "evidence": true}

func findingID(c *gin.Context) (uint, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return 0, false
	}
	return uint(id), true
}

// findingError maps store/model errors to HTTP responses.
func findingError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, models.ErrFindingInvalid):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	case errors.Is(err, store.ErrFindingTransition):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	case errors.Is(err, gorm.ErrRecordNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "finding introuvable"})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erreur interne"})
	}
}

// readFindingBody reads a bounded JSON object, rejecting unknown fields.
func readFindingBody(c *gin.Context, target any) bool {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, findingMaxBody)
	decoder := json.NewDecoder(c.Request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON invalide : " + err.Error()})
		return false
	}
	if decoder.More() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON invalide : un seul objet attendu"})
		return false
	}
	return true
}

func ListFindings(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	filter := store.FindingFilter{
		Status:     strings.TrimSpace(c.Query("status")),
		Severity:   strings.ToLower(strings.TrimSpace(c.Query("severity"))),
		Source:     strings.ToLower(strings.TrimSpace(c.Query("source"))),
		SourceType: strings.ToLower(strings.TrimSpace(c.Query("source_type"))),
		Category:   strings.ToLower(strings.TrimSpace(c.Query("category"))),
		Page:       page,
		Limit:      limit,
	}
	if filter.Status != "" && !models.IsFindingStatus(filter.Status) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status invalide"})
		return
	}
	if filter.Severity != "" && !models.IsFindingSeverity(filter.Severity) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "severity invalide"})
		return
	}
	items, total, err := store.ListFindings(filter)
	if err != nil {
		findingError(c, err)
		return
	}
	page, limit = filter.NormalizePage()
	c.JSON(http.StatusOK, gin.H{"items": items, "total": total, "page": page, "limit": limit})
}

func GetFinding(c *gin.Context) {
	id, ok := findingID(c)
	if !ok {
		return
	}
	finding, err := store.GetFindingByID(id)
	if err != nil {
		findingError(c, err)
		return
	}
	c.JSON(http.StatusOK, finding)
}

// CreateFinding creates a Finding, or merges a new occurrence of an existing
// one (same fingerprint). A producer cannot set the analyst status.
func CreateFinding(c *gin.Context) {
	var body struct {
		SourceType  string                   `json:"source_type"`
		Source      string                   `json:"source"`
		Category    string                   `json:"category"`
		Title       string                   `json:"title"`
		AssetID     string                   `json:"asset_id"`
		EntityRef   string                   `json:"entity_ref"`
		Severity    string                   `json:"severity"`
		Confidence  *float64                 `json:"confidence"`
		Description string                   `json:"description"`
		Evidence    []models.FindingEvidence `json:"evidence"`
		Explanation string                   `json:"explanation"`
		Limitation  string                   `json:"limitation"`
		NextAction  string                   `json:"next_action"`
		FirstSeen   *time.Time               `json:"first_seen"`
		LastSeen    *time.Time               `json:"last_seen"`
		Status      string                   `json:"status"`
	}
	if !readFindingBody(c, &body) {
		return
	}
	if body.Status != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status ne se fixe pas à la création : utiliser PATCH /findings/:id/status"})
		return
	}
	input := models.Finding{
		SourceType: body.SourceType, Source: body.Source, Category: body.Category, Title: body.Title,
		AssetID: body.AssetID, EntityRef: body.EntityRef, Severity: body.Severity, Confidence: body.Confidence,
		Description: body.Description, Evidence: body.Evidence, Explanation: body.Explanation,
		Limitation: body.Limitation, NextAction: body.NextAction,
	}
	if body.FirstSeen != nil {
		input.FirstSeen = *body.FirstSeen
	}
	if body.LastSeen != nil {
		input.LastSeen = *body.LastSeen
	}
	finding, created, err := store.UpsertFinding(input, time.Now().UTC())
	if err != nil {
		findingError(c, err)
		return
	}
	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	c.JSON(status, gin.H{"finding": finding, "created": created})
}

// UpdateFinding edits enrichment fields only. Identity fields would change
// the fingerprint, and status has its own route: both are refused explicitly.
func UpdateFinding(c *gin.Context) {
	id, ok := findingID(c)
	if !ok {
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, findingMaxBody)
	var raw map[string]json.RawMessage
	if err := json.NewDecoder(c.Request.Body).Decode(&raw); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON invalide : " + err.Error()})
		return
	}
	if len(raw) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "aucun champ à modifier"})
		return
	}
	var change store.FindingEnrichment
	for key, value := range raw {
		switch {
		case findingIdentityFields[key]:
			c.JSON(http.StatusBadRequest, gin.H{"error": "champ d'identité non modifiable : " + key})
			return
		case key == "status":
			c.JSON(http.StatusBadRequest, gin.H{"error": "status se modifie via PATCH /findings/:id/status"})
			return
		case !findingEditableFields[key]:
			c.JSON(http.StatusBadRequest, gin.H{"error": "champ inconnu : " + key})
			return
		}
		if err := decodeEnrichment(key, value, &change); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "valeur invalide pour " + key})
			return
		}
	}
	finding, err := store.UpdateFindingEnrichment(id, change)
	if err != nil {
		findingError(c, err)
		return
	}
	c.JSON(http.StatusOK, finding)
}

func decodeEnrichment(key string, value json.RawMessage, change *store.FindingEnrichment) error {
	strict := func(target any) error {
		decoder := json.NewDecoder(bytes.NewReader(value))
		decoder.DisallowUnknownFields()
		return decoder.Decode(target)
	}
	text := func(target **string) error { var s string; err := strict(&s); *target = &s; return err }
	switch key {
	case "description":
		return text(&change.Description)
	case "severity":
		return text(&change.Severity)
	case "explanation":
		return text(&change.Explanation)
	case "limitation":
		return text(&change.Limitation)
	case "next_action":
		return text(&change.NextAction)
	case "confidence":
		if string(value) == "null" {
			change.ClearConfidence = true
			return nil
		}
		var c float64
		if err := strict(&c); err != nil {
			return err
		}
		change.Confidence = &c
		return nil
	case "evidence":
		var items []models.FindingEvidence
		if err := strict(&items); err != nil {
			return err
		}
		change.Evidence = &items
		return nil
	}
	return errors.New("champ non éditable")
}

// UpdateFindingStatus is the only way to change a status; transitions are
// validated by models.ValidateFindingTransition (409 when refused).
func UpdateFindingStatus(c *gin.Context) {
	id, ok := findingID(c)
	if !ok {
		return
	}
	var body struct {
		Status string `json:"status"`
	}
	if !readFindingBody(c, &body) {
		return
	}
	to := models.FindingStatus(strings.TrimSpace(body.Status))
	if !models.IsFindingStatus(string(to)) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status invalide (new|needs_review|confirmed|false_positive|resolved)"})
		return
	}
	finding, err := store.UpdateFindingStatus(id, to)
	if err != nil {
		findingError(c, err)
		return
	}
	c.JSON(http.StatusOK, finding)
}

func DeleteFinding(c *gin.Context) {
	id, ok := findingID(c)
	if !ok {
		return
	}
	if err := store.DeleteFinding(id); err != nil {
		findingError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
