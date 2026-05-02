package api

import (
	"time"

	"github.com/cyber-hub/cyber-hub/internal/api/handlers"
	"github.com/cyber-hub/cyber-hub/internal/api/middleware"
	"github.com/cyber-hub/cyber-hub/internal/correlation"
	"github.com/cyber-hub/cyber-hub/internal/store"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// NewRouter configure et retourne le router Gin
func NewRouter(correlationEngine *correlation.CorrelationEngine) *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	r.Use(func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
		c.Next()
	})

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:7743", "http://127.0.0.1:7743", "http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length", "Content-Disposition"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}))

	getSecret := func() string {
		s, _ := store.GetSettings()
		if s == nil {
			return ""
		}
		return s.JWTSecret
	}

	loginLimiter := middleware.NewRateLimiter(8, time.Minute)

	api := r.Group("/api")
	{
		auth := api.Group("/auth")
		{
			auth.GET("/status", handlers.GetStatus)
			auth.POST("/setup", handlers.Setup)
			auth.POST("/login", loginLimiter.Middleware(), handlers.Login)
		}

		protected := api.Group("")
		protected.Use(middleware.AuthRequired(getSecret))
		{
			protected.GET("/stats", handlers.GetStats)
			protected.GET("/search", handlers.GlobalSearch)

			tools := protected.Group("/tools")
			{
				tools.GET("", handlers.ListTools)
				tools.GET("/categories", handlers.GetSubCategories)
				tools.GET("/:id", handlers.GetTool)
				tools.GET("/:id/commands", handlers.GetToolCommands)
				tools.POST("", handlers.CreateTool)
				tools.PUT("/:id", handlers.UpdateTool)
				tools.DELETE("/:id", handlers.DeleteTool)
			}

			ctf := protected.Group("/ctf")
			{
				ctf.GET("", handlers.ListCTF)
				ctf.GET("/:id", handlers.GetCTF)
				ctf.POST("", handlers.CreateCTF)
				ctf.PUT("/:id", handlers.UpdateCTF)
				ctf.DELETE("/:id", handlers.DeleteCTF)
			}

			cve := protected.Group("/cve")
			{
				cve.GET("", handlers.ListCVE)
				cve.GET("/:id", handlers.GetCVE)
				cve.POST("", handlers.CreateCVE)
				cve.PUT("/:id", handlers.UpdateCVE)
				cve.DELETE("/:id", handlers.DeleteCVE)
				cve.POST("/import-nvd", handlers.ImportNVD)
			}

			playbooks := protected.Group("/playbooks")
			{
				playbooks.GET("", handlers.ListPlaybooks)
				playbooks.GET("/:id", handlers.GetPlaybook)
				playbooks.POST("", handlers.CreatePlaybook)
				playbooks.PUT("/:id", handlers.UpdatePlaybook)
				playbooks.DELETE("/:id", handlers.DeletePlaybook)
				playbooks.POST("/:id/reset", handlers.ResetPlaybook)
				playbooks.PATCH("/:id/steps/:stepId/toggle", handlers.ToggleStep)
			}

			cloak := protected.Group("/cloak")
			{
				cloak.GET("/overrides", handlers.ListCloakOverrides)
				cloak.POST("/overrides", handlers.UpsertCloakOverride)
				cloak.DELETE("/overrides/:id", handlers.DeleteCloakOverride)
				cloak.GET("/annotations", handlers.ListCloakAnnotations)
				cloak.POST("/annotations", handlers.UpsertCloakAnnotation)
				cloak.DELETE("/annotations/:id", handlers.DeleteCloakAnnotation)
				cloak.DELETE("/annotations/ref/*ref", handlers.DeleteCloakAnnotationByRef)
			}

			mitre := protected.Group("/mitre")
			{
				mitre.GET("/status", handlers.GetMITREStatus)
				mitre.GET("/tactics", handlers.ListMITRETactics)
				mitre.GET("/techniques", handlers.ListMITRETechniques)
				mitre.GET("/techniques/:id", handlers.GetMITRETechnique)
			}

			ioc := protected.Group("/ioc")
			{
				ioc.GET("", handlers.ListIOCs)
				ioc.GET("/stats", handlers.GetIOCStats)
				ioc.GET("/export", handlers.ExportIOCsCSV)
				ioc.GET("/:id", handlers.GetIOC)
				ioc.POST("", handlers.CreateIOC)
				ioc.PUT("/:id", handlers.UpdateIOC)
				ioc.DELETE("/:id", handlers.DeleteIOC)
			}

			settings := protected.Group("/settings")
			{
				settings.GET("/export", handlers.ExportData)
				settings.POST("/import", handlers.ImportData)
				settings.POST("/backup", handlers.TriggerBackup)
			}

			// BGP / AS Lookup + Historian
			bgp := protected.Group("/bgp")
			{
				bgp.GET("/asn/:asn", handlers.GetBGPASN)
				bgp.GET("/asn/:asn/prefixes", handlers.GetBGPASNPrefixes)
				bgp.GET("/asn/:asn/peers", handlers.GetBGPASNPeers)
				bgp.GET("/asn/:asn/upstreams", handlers.GetBGPASNUpstreams)
				bgp.GET("/asn/:asn/downstreams", handlers.GetBGPASNDownstreams)
				bgp.GET("/ip/:ip", handlers.GetBGPIP)
				bgp.GET("/status", handlers.GetBGPStatus)
				bgp.GET("/search", handlers.GetBGPSearch)
				bgp.POST("/snapshot/:asn", handlers.PostBGPSnapshot)
				bgp.GET("/snapshots/:asn", handlers.GetBGPSnapshots)
				bgp.GET("/snapshots/:asn/diff", handlers.GetBGPSnapshotDiff)
				bgp.GET("/alerts", handlers.GetBGPAlerts)
				bgp.PATCH("/alerts/:id/ack", handlers.AckBGPAlert)
				bgp.POST("/export-ioc", handlers.PostBGPExportIOC)
			}

			// Corrélation globale
			corrHandlers := handlers.MakeCorrelationHandlers(correlationEngine)
			correlation := protected.Group("/correlation")
			{
				correlation.GET("/ioc/:id", corrHandlers.GetCorrelationByIOC)
				correlation.POST("/analyze", corrHandlers.PostCorrelationAnalyze)
				correlation.GET("/history", corrHandlers.GetCorrelationHistory)
				correlation.DELETE("/cache/:ioc_value", corrHandlers.DeleteCorrelationCache)
			}
		}
	}

	return r
}
