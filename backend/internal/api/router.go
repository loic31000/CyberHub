package api

import (
	"os"
	"path/filepath"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/api/handlers"
	"github.com/cyber-hub/cyber-hub/internal/api/middleware"
	"github.com/cyber-hub/cyber-hub/internal/cheatsheets"
	"github.com/cyber-hub/cyber-hub/internal/correlation"
	"github.com/cyber-hub/cyber-hub/internal/osint"
	"github.com/cyber-hub/cyber-hub/internal/store"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

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

	dataDir := filepath.Dir(getDBPath())
	wmnPath := filepath.Join(dataDir, "wmn-data.json")
	osintEngine := osint.NewOSINTEngine(store.DB, wmnPath)

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
				cve.POST("/fetch-from-nvd", handlers.FetchNVDOnline)
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
				ioc.POST("/import", handlers.ImportIOCs)
				ioc.GET("/:id", handlers.GetIOC)
				ioc.POST("", handlers.CreateIOC)
				ioc.PUT("/:id", handlers.UpdateIOC)
				ioc.DELETE("/:id", handlers.DeleteIOC)
			}

			cisaH := handlers.NewCISAHandler(store.DB)
			cisa := protected.Group("/cisa")
			{
				cisa.GET("/kev/check/:cve_id", cisaH.CheckKEV)
				cisa.GET("/kev/batch", cisaH.BatchCheckKEV)
				cisa.GET("/kev/stats", cisaH.GetStats)
				cisa.POST("/kev/update", cisaH.UpdateKEV)
			}
			protected.GET("/epss/:cve_id", cisaH.GetEPSS)

			lolbinsH := handlers.NewLOLBinsHandler(store.DB)
			lolbinsGroup := protected.Group("/lolbins")
			{
				lolbinsGroup.GET("", lolbinsH.List)
				lolbinsGroup.GET("/categories", lolbinsH.GetCategories)
				lolbinsGroup.GET("/mitre/:technique_id", lolbinsH.GetByMitre)
				lolbinsGroup.GET("/:name", lolbinsH.GetByName)
			}

			threatFeedsH := handlers.NewThreatFeedsHandler(store.DB)
			threatFeeds := protected.Group("/threat-feeds")
			{
				threatFeeds.GET("/status", threatFeedsH.GetStatus)
				threatFeeds.POST("/sync/feodo", threatFeedsH.SyncFeodo)
				threatFeeds.POST("/sync/urlhaus", threatFeedsH.SyncURLhaus)
			}

			hashH := handlers.NewHashHandler(store.DB)

			settings := protected.Group("/settings")
			{
				settings.GET("/export", handlers.ExportData)
				settings.POST("/import", handlers.ImportData)
				settings.POST("/backup", handlers.TriggerBackup)
				settings.GET("/db-versions", handlers.GetDBVersions)
				settings.POST("/update-mitre", handlers.UpdateMITRE)
				settings.POST("/update-cloak", handlers.UpdateCLOAK)
				settings.GET("/virustotal", hashH.GetVTConfig)
				settings.POST("/virustotal", hashH.SaveVTKey)
				settings.DELETE("/virustotal", hashH.DeleteVTKey)
				settings.GET("/nvd-key", handlers.GetNVDAPIKey)
				settings.POST("/nvd-key", handlers.SetNVDAPIKey)
				settings.DELETE("/nvd-key", handlers.DeleteNVDAPIKey)
			}

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

			corrHandlers := handlers.MakeCorrelationHandlers(correlationEngine)
			corrGroup := protected.Group("/correlation")
			{
				corrGroup.GET("/ioc/:id", corrHandlers.GetCorrelationByIOC)
				corrGroup.POST("/analyze", corrHandlers.PostCorrelationAnalyze)
				corrGroup.GET("/history", corrHandlers.GetCorrelationHistory)
				corrGroup.DELETE("/cache/:ioc_value", corrHandlers.DeleteCorrelationCache)
			}

			osintH := handlers.NewOSINTHandler(store.DB, osintEngine)
			osintGroup := protected.Group("/osint")
			{
				osintGroup.GET("/meta", osintH.GetMeta)
				osintGroup.POST("/update-db", osintH.UpdateDB)
				osintGroup.POST("/run", osintH.RunJob)
				osintGroup.GET("/jobs", osintH.ListJobs)
				osintGroup.GET("/jobs/:id", osintH.GetJob)
				osintGroup.GET("/jobs/:id/stream", osintH.StreamJob)
				osintGroup.DELETE("/jobs/:id", osintH.DeleteJob)
				osintGroup.GET("/jobs/:id/export-ioc", osintH.ExportIOC)
				osintGroup.POST("/jobs/:id/import-ioc", osintH.ImportIOC)
			}

			notesH := handlers.NewNotesHandler(store.DB)
			notes := protected.Group("/notes")
			{
				notes.GET("", notesH.List)
				notes.POST("", notesH.Create)
				notes.GET("/search", notesH.Search)
				notes.GET("/:id", notesH.GetByID)
				notes.PUT("/:id", notesH.Update)
				notes.DELETE("/:id", notesH.Delete)
			}

			hash := protected.Group("/hash")
			{
				hash.GET("/analyze/:hash", hashH.Analyze)
				hash.POST("/bulk", hashH.BulkAnalyze)
				hash.DELETE("/cache/:hash", hashH.DeleteCache)
			}

			threat := protected.Group("/threat")
			{
				threat.GET("/feeds", handlers.GetThreatFeeds)
				threat.GET("/alerts", handlers.GetThreatAlerts)
				threat.POST("/run/:name", handlers.RunThreatFeed)
			}

			cheatH := cheatsheets.NewCheatsheetsHandler()
			cheat := protected.Group("/cheatsheets")
			{
				cheat.GET("", cheatH.List)
				cheat.GET("/:tool_name", cheatH.GetByTool)
			}

			protected.GET("/revshell", handlers.GetRevShell)
		}
	}

	return r
}

func getDBPath() string {
	if p := os.Getenv("CYBER_HUB_DB"); p != "" {
		return p
	}
	return filepath.Join(".", "cyber_hub.db")
}
