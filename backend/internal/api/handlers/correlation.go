package handlers

import (
	"net/http"
	"strconv"

	"github.com/cyber-hub/cyber-hub/internal/correlation"
	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/cyber-hub/cyber-hub/internal/store"
	"github.com/gin-gonic/gin"
)

// MakeCORelationHandlers crée les handlers de corrélation avec injection du moteur
func MakeCorrelationHandlers(engine *correlation.CorrelationEngine) struct {
	GetCorrelationByIOC    func(*gin.Context)
	PostCorrelationAnalyze func(*gin.Context)
	GetCorrelationHistory  func(*gin.Context)
	DeleteCorrelationCache func(*gin.Context)
} {
	return struct {
		GetCorrelationByIOC    func(*gin.Context)
		PostCorrelationAnalyze func(*gin.Context)
		GetCorrelationHistory  func(*gin.Context)
		DeleteCorrelationCache func(*gin.Context)
	}{
		GetCorrelationByIOC: func(c *gin.Context) {
			id, err := strconv.ParseUint(c.Param("id"), 10, 64)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
				return
			}
			ioc, err := store.GetIOCByID(uint(id))
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "IOC non trouvé"})
				return
			}
			result := engine.Analyze(string(ioc.Type), ioc.Value)
			c.JSON(http.StatusOK, result)
		},
		PostCorrelationAnalyze: func(c *gin.Context) {
			var body struct {
				Type  string `json:"type"  binding:"required"`
				Value string `json:"value" binding:"required"`
			}
			if err := c.ShouldBindJSON(&body); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			result := engine.Analyze(body.Type, body.Value)
			c.JSON(http.StatusOK, result)
		},
		GetCorrelationHistory: func(c *gin.Context) {
			var caches []models.CorrelationCache
			store.DB.Order("created_at DESC").Limit(20).Find(&caches)

			type HistoryItem struct {
				IOCType     string `json:"ioc_type"`
				IOCValue    string `json:"ioc_value"`
				GeneratedAt string `json:"generated_at"`
				FromCache   bool   `json:"from_cache"`
			}
			history := make([]HistoryItem, 0)
			for _, c := range caches {
				history = append(history, HistoryItem{
					IOCType:     c.IOCType,
					IOCValue:    c.IOCValue,
					GeneratedAt: c.CreatedAt.Format("2006-01-02 15:04:05"),
					FromCache:   false,
				})
			}
			c.JSON(http.StatusOK, gin.H{"items": history})
		},
		DeleteCorrelationCache: func(c *gin.Context) {
			iocValue := c.Param("ioc_value")
			if err := engine.InvalidateCache(iocValue); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"message": "cache invalidé"})
		},
	}
}
