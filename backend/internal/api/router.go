package api

import (
	"time"

	"github.com/cyber-hub/cyber-hub/internal/api/handlers"
	"github.com/cyber-hub/cyber-hub/internal/api/middleware"
	"github.com/cyber-hub/cyber-hub/internal/store"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// NewRouter configure et retourne le router Gin
func NewRouter() *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	// ⚠️ Security headers — défense en profondeur
	r.Use(func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
		c.Next()
	})

	// CORS : uniquement localhost (sécurité : pas d'accès depuis des origines externes)
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:7743", "http://127.0.0.1:7743", "http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length", "Content-Disposition"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}))

	// Fonction qui récupère le secret JWT depuis la DB (lazy — settings peut ne pas exister au boot)
	getSecret := func() string {
		s, _ := store.GetSettings()
		if s == nil {
			return ""
		}
		return s.JWTSecret
	}

	// Rate limiter pour la route de login : 8 tentatives par minute par IP
	loginLimiter := middleware.NewRateLimiter(8, time.Minute)

	api := r.Group("/api")
	{
		// Routes publiques (auth)
		auth := api.Group("/auth")
		{
			auth.GET("/status", handlers.GetStatus)
			auth.POST("/setup", handlers.Setup)
			// Rate limiting sur le login pour prévenir le brute force
			auth.POST("/login", loginLimiter.Middleware(), handlers.Login)
		}

		// Routes protégées (JWT requis)
		protected := api.Group("")
		protected.Use(middleware.AuthRequired(getSecret))
		{
			// Statistiques dashboard
			protected.GET("/stats", handlers.GetStats)

			// Recherche globale — tous modules (outils, CTF, CVE, playbooks)
			protected.GET("/search", handlers.GlobalSearch)

			// Outils — fiches éducatives éditables
			tools := protected.Group("/tools")
			{
				tools.GET("", handlers.ListTools)
				tools.GET("/categories", handlers.GetSubCategories)
				tools.GET("/:id", handlers.GetTool)
				tools.GET("/:id/commands", handlers.GetToolCommands) // autocomplétion
				tools.POST("", handlers.CreateTool)
				tools.PUT("/:id", handlers.UpdateTool)
				tools.DELETE("/:id", handlers.DeleteTool)
			}

			// Writeups CTF
			ctf := protected.Group("/ctf")
			{
				ctf.GET("", handlers.ListCTF)
				ctf.GET("/:id", handlers.GetCTF)
				ctf.POST("", handlers.CreateCTF)
				ctf.PUT("/:id", handlers.UpdateCTF)
				ctf.DELETE("/:id", handlers.DeleteCTF)
			}

			// Veille CVE
			cve := protected.Group("/cve")
			{
				cve.GET("", handlers.ListCVE)
				cve.GET("/:id", handlers.GetCVE)
				cve.POST("", handlers.CreateCVE)
				cve.PUT("/:id", handlers.UpdateCVE)
				cve.DELETE("/:id", handlers.DeleteCVE)
				cve.POST("/import-nvd", handlers.ImportNVD) // Import JSON NVD 2.0
			}

			// Playbooks de réponse à incident
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

			// CLOAK — overrides et entrées custom utilisateur
			// ⚠️ Usage légal et éducatif uniquement
			cloak := protected.Group("/cloak")
			{
				cloak.GET("/overrides", handlers.ListCloakOverrides)
				cloak.POST("/overrides", handlers.UpsertCloakOverride)
				cloak.DELETE("/overrides/:id", handlers.DeleteCloakOverride)

				// Annotations personnelles (couche séparée — source CLOAK inchangée)
				cloak.GET("/annotations", handlers.ListCloakAnnotations)
				cloak.POST("/annotations", handlers.UpsertCloakAnnotation)
				cloak.DELETE("/annotations/:id", handlers.DeleteCloakAnnotation)
				cloak.DELETE("/annotations/ref/*ref", handlers.DeleteCloakAnnotationByRef)
			}

			// MITRE ATT&CK — tactiques, techniques, statut seed
			mitre := protected.Group("/mitre")
			{
				mitre.GET("/status", handlers.GetMITREStatus)
				mitre.GET("/tactics", handlers.ListMITRETactics)
				mitre.GET("/techniques", handlers.ListMITRETechniques)
				mitre.GET("/techniques/:id", handlers.GetMITRETechnique)
			}

			// IOC Manager — Indicateurs de Compromission
			// ⚠️ Usage légal uniquement — données sensibles (TLP à respecter)
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

			// Paramètres — export / import / backup
			settings := protected.Group("/settings")
			{
				settings.GET("/export", handlers.ExportData)     // Export JSON complet
				settings.POST("/import", handlers.ImportData)    // Import JSON
				settings.POST("/backup", handlers.TriggerBackup) // Backup manuel BDD
			}
		}
	}

	return r
}
