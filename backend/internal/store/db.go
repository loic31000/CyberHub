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
		backupPath, err := createBackup(dbPath, backupPreMigration)
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
	if err := migrateOSINTJob(DB); err != nil {
		return err
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
	log.Printf("[DB] Base initialisee : %s", dbPath)
	return nil
}

// Existing tables are changed only with additive ALTER TABLE operations. GORM's
// SQLite AutoMigrate can rebuild an existing table and lose data or constraints.
func migrateOSINTJob(db *gorm.DB) error {
	model := &models.OSINTJob{}
	if !db.Migrator().HasTable(model) {
		return db.AutoMigrate(model)
	}
	return db.Transaction(func(tx *gorm.DB) error {
		if tx.Migrator().HasColumn(model, "tool") {
			log.Println("[DB] Migration osint_jobs : suppression colonne legacy 'tool'")
			if err := tx.Exec("ALTER TABLE osint_jobs DROP COLUMN tool").Error; err != nil {
				return err
			}
		}
		stmt := &gorm.Statement{DB: tx}
		if err := stmt.Parse(model); err != nil {
			return err
		}
		for _, field := range stmt.Schema.Fields {
			if field.DBName != "" && !tx.Migrator().HasColumn(model, field.DBName) {
				if err := tx.Migrator().AddColumn(model, field.Name); err != nil {
					return err
				}
			}
		}
		for _, index := range stmt.Schema.ParseIndexes() {
			if !tx.Migrator().HasIndex(model, index.Name) {
				if err := tx.Migrator().CreateIndex(model, index.Name); err != nil {
					return err
				}
			}
		}
		return nil
	})
}
