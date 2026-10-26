package handlers

import (
	"net/http"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/connectors"
	"github.com/gin-gonic/gin"
)

// ConnectorsHandler exposes the read-only view of the internal connectors
// (#94): definitions, user choice and runtime state. There is no endpoint to
// install, upload or run anything.
type ConnectorsHandler struct {
	registry *connectors.Registry
	now      func() time.Time
}

func NewConnectorsHandler(registry *connectors.Registry) *ConnectorsHandler {
	return &ConnectorsHandler{registry: registry, now: time.Now}
}

// List returns every known connector, sorted by id.
func (h *ConnectorsHandler) List(c *gin.Context) {
	items := h.registry.Snapshots(h.now())
	c.JSON(http.StatusOK, gin.H{"items": items, "total": len(items)})
}

// Get returns one connector.
func (h *ConnectorsHandler) Get(c *gin.Context) {
	id := c.Param("id")
	if !connectors.IsValidID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id de connecteur invalide"})
		return
	}
	snapshot, ok := h.registry.Snapshot(id, h.now())
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "connecteur introuvable"})
		return
	}
	c.JSON(http.StatusOK, snapshot)
}
