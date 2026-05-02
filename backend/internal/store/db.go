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

// InitDB initialise la connexion SQLite et execute les migrations
func InitDB(dbPath string) error {
	var err error

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

	DB.Exec("PRAGMA foreign_keys = ON")
	DB.Exec("PRAGMA journal_mode = WAL")

	if err = DB.AutoMigrate(
		&models.Settings{},
		&models.Tool{},
		&models.ToolCommand{},
		&models.CTFWriteup{},
		&models.CVEEntry{},
		&models.Playbook{},
		&models.PlaybookStep{},
		&models.MITRETactic{},
		&models.MITRETechnique{},
		&models.IOC{},
		&models.CloakOverride{},
		&models.CloakAnnotation{},
		&models.BGPCache{},
		&models.BGPSnapshot{},
		&models.BGPAlert{},
		&models.CorrelationCache{},
	); err != nil {
		return err
	}

	for _, t := range []string{"run_histories", "osint_histories", "spiderfoot_scans"} {
		DB.Exec("DROP TABLE IF EXISTS " + t)
	}

	log.Printf("[DB] Base de donnees initialisee : %s", dbPath)
	return nil
}
