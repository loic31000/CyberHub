package store

import (
	"log"
	"os"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// InitDB initialise la connexion SQLite et exécute les migrations
func InitDB(dbPath string) error {
	var err error

	// Configuration GORM : logs uniquement en cas d'erreur en production
	logLevel := logger.Error
	if os.Getenv("GIN_MODE") != "release" {
		logLevel = logger.Info
	}

	DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
	})
	if err != nil {
		return err
	}

	// Activer les foreign keys SQLite
	DB.Exec("PRAGMA foreign_keys = ON")
	DB.Exec("PRAGMA journal_mode = WAL") // Meilleures performances concurrent

	// Auto-migration des modèles (v0.7 — pivot knowledge base)
	if err = DB.AutoMigrate(
		&models.Settings{},
		&models.Tool{},
		&models.ToolCommand{}, // templates de commandes paramétrables (générateur dans les fiches)
		&models.CTFWriteup{},
		&models.CVEEntry{},
		&models.Playbook{},
		&models.PlaybookStep{},
		&models.MITRETactic{},    // tactiques MITRE ATT&CK
		&models.MITRETechnique{}, // techniques MITRE ATT&CK
		&models.IOC{},            // IOC Manager — Phase 3
	); err != nil {
		return err
	}

	// Cleanup tables retirées au pivot v0.7 (silencieux si déjà absentes)
	for _, t := range []string{"run_histories", "osint_histories", "spiderfoot_scans"} {
		DB.Exec("DROP TABLE IF EXISTS " + t)
	}

	log.Printf("[DB] Base de données initialisée : %s", dbPath)
	return nil
}
