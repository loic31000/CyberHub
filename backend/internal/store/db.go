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
var activeDBPath string

// InitDB initialise la connexion SQLite et execute les migrations
func InitDB(dbPath string) error {
	var err error
	var existingDB bool
	if dbPath != ":memory:" {
		_, statErr := os.Stat(dbPath)
		if statErr != nil && !os.IsNotExist(statErr) {
			return statErr
		}
		existingDB = statErr == nil
	}

	DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.New(log.Default(), logger.Config{LogLevel: logger.Error, ParameterizedQueries: true}),
	})
	if err != nil {
		return err
	}
	activeDBPath = dbPath
	if existingDB {
		backupPath, err := BackupDB()
		if err != nil {
			log.Printf("[BACKUP] Échec avant migration : %v", err)
			return err
		}
		log.Printf("[BACKUP] Instantané avant migration : %s", backupPath)
	}

	if err := DB.Exec("PRAGMA foreign_keys = ON").Error; err != nil {
		return err
	}
	if err := DB.Exec("PRAGMA journal_mode = WAL").Error; err != nil {
		return err
	}

	// Migration : supprime la colonne legacy 'tool NOT NULL' de osint_jobs si elle existe.
	// SQLite ne supporte pas ALTER COLUMN, on recree la table sans cette colonne.
	var toolColExists int
	if err := DB.Raw("SELECT COUNT(*) FROM pragma_table_info('osint_jobs') WHERE name='tool'").Scan(&toolColExists).Error; err != nil {
		return err
	}
	if toolColExists > 0 {
		log.Println("[DB] Migration osint_jobs : suppression colonne legacy 'tool'")
		if err := DB.Transaction(func(tx *gorm.DB) error {
			if err := tx.Exec("DROP TABLE IF EXISTS osint_jobs_v2").Error; err != nil {
				return err
			}
			if err := tx.Exec(`CREATE TABLE osint_jobs_v2 (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			created_at DATETIME,
			updated_at DATETIME,
			username TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			total_sites INTEGER,
			checked_sites INTEGER,
			found_count INTEGER,
			filter_category TEXT,
			results TEXT,
			duration INTEGER,
			launched_by TEXT
		)`).Error; err != nil {
				return err
			}
			if err := tx.Exec(`INSERT INTO osint_jobs_v2
			SELECT id, created_at, updated_at, username, status,
			       total_sites, checked_sites, found_count,
			       filter_category, results, duration, launched_by
			FROM osint_jobs`).Error; err != nil {
				return err
			}
			if err := tx.Exec("DROP TABLE osint_jobs").Error; err != nil {
				return err
			}
			if err := tx.Exec("ALTER TABLE osint_jobs_v2 RENAME TO osint_jobs").Error; err != nil {
				return err
			}
			return tx.Exec("CREATE INDEX IF NOT EXISTS idx_osint_jobs_username ON osint_jobs(username)").Error
		}); err != nil {
			return err
		}
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
		&models.WMNMeta{},
		&models.Note{},
		&models.HashCache{},
		&models.AppSetting{},
		&models.CISAKEVEntry{},
		&models.EPSSScore{},
		&models.ThreatFeedSync{},
		&models.LOLBin{},
		&models.Investigation{},
		&models.InvestigationEvent{},
		&models.AttackLayer{},
	); err != nil {
		return err
	}
	// La table legacy vient d'être migrée explicitement. Le migrateur SQLite de GORM
	// peut reconstruire cette table et omettre username lors d'une copie.
	if !DB.Migrator().HasTable(&models.OSINTJob{}) {
		if err := DB.AutoMigrate(&models.OSINTJob{}); err != nil {
			return err
		}
	}

	log.Printf("[DB] Base initialisee : %s", dbPath)
	return nil
}
