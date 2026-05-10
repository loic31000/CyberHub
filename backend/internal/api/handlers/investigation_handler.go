package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/cyber-hub/cyber-hub/internal/store"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type InvestigationHandler struct {
	db *gorm.DB
}

func NewInvestigationHandler(db *gorm.DB) *InvestigationHandler {
	return &InvestigationHandler{db: db}
}

var validInvestigationStatuses = map[string]bool{
	"open": true, "closed": true, "archived": true,
}

var validEventTypes = map[string]bool{
	"ioc": true, "note": true, "cve": true, "bgp": true,
	"mitre": true, "playbook": true, "manual": true,
}

var validEventSeverities = map[string]bool{
	"info": true, "low": true, "medium": true, "high": true, "critical": true,
}

func (h *InvestigationHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	f := store.InvestigationFilter{
		Status: c.Query("status"),
		Query:  c.Query("q"),
		Page:   page,
		Limit:  limit,
	}
	items, total, err := store.ListInvestigations(f)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "total": total, "page": page, "limit": limit})
}

func (h *InvestigationHandler) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	inv, err := store.GetInvestigationByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "investigation introuvable"})
		return
	}
	c.JSON(http.StatusOK, inv)
}

func (h *InvestigationHandler) Create(c *gin.Context) {
	var body struct {
		Title       string `json:"title"       binding:"required"`
		Description string `json:"description"`
		Status      string `json:"status"`
		Tags        string `json:"tags"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	status := strings.ToLower(body.Status)
	if status == "" {
		status = "open"
	}
	if !validInvestigationStatuses[status] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status invalide (open|closed|archived)"})
		return
	}
	inv := &models.Investigation{
		Title:       strings.TrimSpace(body.Title),
		Description: strings.TrimSpace(body.Description),
		Status:      models.InvestigationStatus(status),
		Tags:        body.Tags,
	}
	if err := store.CreateInvestigation(inv); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, inv)
}

func (h *InvestigationHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	allowed := map[string]bool{"title": true, "description": true, "status": true, "tags": true}
	updates := make(map[string]interface{})
	for k, v := range body {
		if allowed[k] {
			updates[k] = v
		}
	}
	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "aucun champ valide"})
		return
	}
	inv, err := store.UpdateInvestigation(uint(id), updates)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, inv)
}

func (h *InvestigationHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	if err := store.DeleteInvestigation(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "investigation supprimée"})
}

func (h *InvestigationHandler) ListEvents(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	f := store.EventFilter{
		EventType: c.Query("event_type"),
		Severity:  c.Query("severity"),
		Order:     c.DefaultQuery("order", "asc"),
	}
	events, err := store.ListEvents(uint(id), f)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": events, "total": len(events)})
}

func (h *InvestigationHandler) CreateEvent(c *gin.Context) {
	invID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	if _, lookupErr := store.GetInvestigationByID(uint(invID)); lookupErr != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "investigation introuvable"})
		return
	}
	var body struct {
		Timestamp      string `json:"timestamp"`
		Title          string `json:"title"            binding:"required"`
		Description    string `json:"description"`
		EventType      string `json:"event_type"`
		Severity       string `json:"severity"`
		SourceModule   string `json:"source_module"`
		SourceEntityID string `json:"source_entity_id"`
		Metadata       string `json:"metadata"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	eventType := strings.ToLower(body.EventType)
	if eventType == "" {
		eventType = "manual"
	}
	if !validEventTypes[eventType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "event_type invalide (ioc|note|cve|bgp|mitre|playbook|manual)"})
		return
	}
	severity := strings.ToLower(body.Severity)
	if severity == "" {
		severity = "info"
	}
	if !validEventSeverities[severity] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "severity invalide (info|low|medium|high|critical)"})
		return
	}
	var ts time.Time
	if body.Timestamp != "" {
		parsed, parseErr := time.Parse(time.RFC3339, body.Timestamp)
		if parseErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "timestamp invalide (format RFC3339)"})
			return
		}
		ts = parsed
	} else {
		ts = time.Now()
	}
	event := &models.InvestigationEvent{
		InvestigationID: uint(invID),
		Timestamp:       ts,
		Title:           strings.TrimSpace(body.Title),
		Description:     strings.TrimSpace(body.Description),
		EventType:       models.EventType(eventType),
		Severity:        models.EventSeverity(severity),
		SourceModule:    body.SourceModule,
		SourceEntityID:  body.SourceEntityID,
		Metadata:        body.Metadata,
	}
	if err := store.CreateEvent(event); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, event)
}

func (h *InvestigationHandler) UpdateEvent(c *gin.Context) {
	eventID, err := strconv.ParseUint(c.Param("eventId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "eventId invalide"})
		return
	}
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	allowed := map[string]bool{
		"timestamp": true, "title": true, "description": true,
		"event_type": true, "severity": true, "source_module": true,
		"source_entity_id": true, "metadata": true,
	}
	updates := make(map[string]interface{})
	for k, v := range body {
		if allowed[k] {
			updates[k] = v
		}
	}
	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "aucun champ valide"})
		return
	}
	event, err := store.UpdateEvent(uint(eventID), updates)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, event)
}

func (h *InvestigationHandler) DeleteEvent(c *gin.Context) {
	eventID, err := strconv.ParseUint(c.Param("eventId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "eventId invalide"})
		return
	}
	if err := store.DeleteEvent(uint(eventID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "événement supprimé"})
}
