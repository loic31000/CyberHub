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

	// Migration : supprime la colonne legacy 'tool NOT NULL' de osint_jobs si elle existe.
	// SQLite ne supporte pas ALTER COLUMN, on recree la table sans cette colonne.
	var toolColExists int
	DB.Raw("SELECT COUNT(*) FROM pragma_table_info('osint_jobs') WHERE name='tool'").Scan(&toolColExists)
	if toolColExists > 0 {
		log.Println("[DB] Migration osint_jobs : suppression colonne legacy 'tool'")
		DB.Exec(`CREATE TABLE IF NOT EXISTS osint_jobs_v2 (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			created_at DATETIME,
			updated_at DATETIME,
			username TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			total_sites INTEGER DEFAULT 0,
			checked_sites INTEGER DEFAULT 0,
			found_count INTEGER DEFAULT 0,
			filter_category TEXT DEFAULT '',
			results TEXT DEFAULT '',
			duration INTEGER DEFAULT 0,
			launched_by TEXT DEFAULT ''
		)`)
		DB.Exec(`INSERT OR IGNORE INTO osint_jobs_v2
			SELECT id, created_at, updated_at, username, status,
			       total_sites, checked_sites, found_count,
			       filter_category, results, duration, launched_by
			FROM osint_jobs`)
		DB.Exec(`DROP TABLE osint_jobs`)
		DB.Exec(`ALTER TABLE osint_jobs_v2 RENAME TO osint_jobs`)
	}

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
		&models.OSINTJob{},
		&models.WMNMeta{},
		&models.Note{},
		&models.HashCache{},
		&models.AppSetting{},
	); err != nil {
		return err
	}

	for _, t := range []string{"run_histories", "osint_histories", "spiderfoot_scans"} {
		DB.Exec("DROP TABLE IF EXISTS " + t)
	}

	log.Printf("[DB] Base initialisee : %s", dbPath)
	return nil
}
