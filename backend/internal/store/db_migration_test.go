package store

import (
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func closeCurrentDB(t *testing.T) {
	t.Helper()
	if DB != nil {
		sqlDB, err := DB.DB()
		if err != nil {
			t.Fatal(err)
		}
		if err := sqlDB.Close(); err != nil {
			t.Fatal(err)
		}
	}
}

func TestInitDBFreshAndExistingSchema(t *testing.T) {
	previousDB, previousPath := DB, activeDBPath
	defer func() { DB, activeDBPath = previousDB, previousPath }()
	dbPath := filepath.Join(t.TempDir(), "cyber-hub.db")
	if err := InitDB(dbPath); err != nil {
		t.Fatal(err)
	}
	if err := DB.Exec("INSERT INTO osint_jobs (id, username, status) VALUES (42, 'existing', 'pending')").Error; err != nil {
		t.Fatal(err)
	}
	if err := DB.Exec("CREATE UNIQUE INDEX custom_osint_status ON osint_jobs(status, username)").Error; err != nil {
		t.Fatal(err)
	}
	closeCurrentDB(t)
	if err := InitDB(dbPath); err != nil {
		t.Fatal(err)
	}
	defer closeCurrentDB(t)
	var username string
	if err := DB.Raw("SELECT username FROM osint_jobs WHERE id = 42").Scan(&username).Error; err != nil || username != "existing" {
		t.Fatalf("existing row: %q, %v", username, err)
	}
	if !DB.Migrator().HasIndex("osint_jobs", "custom_osint_status") {
		t.Fatal("custom index was lost")
	}
	if err := DB.Exec("INSERT INTO osint_jobs (username, status) VALUES ('existing', 'pending')").Error; err == nil {
		t.Fatal("unique constraint was lost")
	}
}

func TestInitDBAddsMissingColumnsWithoutRebuilding(t *testing.T) {
	previousDB, previousPath := DB, activeDBPath
	defer func() { DB, activeDBPath = previousDB, previousPath }()
	dbPath := filepath.Join(t.TempDir(), "cyber-hub.db")
	partial, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	for _, query := range []string{
		"CREATE TABLE osint_jobs (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'pending', future_value TEXT)",
		"INSERT INTO osint_jobs (id, username, future_value) VALUES (88, 'partial', 'untouched')",
	} {
		if err := partial.Exec(query).Error; err != nil {
			t.Fatal(err)
		}
	}
	partialSQL, _ := partial.DB()
	partialSQL.Close()
	if err := InitDB(dbPath); err != nil {
		t.Fatal(err)
	}
	defer closeCurrentDB(t)
	if !DB.Migrator().HasColumn(&models.OSINTJob{}, "results") || !DB.Migrator().HasColumn(&models.OSINTJob{}, "duration") {
		t.Fatal("missing model columns were not added")
	}
	var futureValue string
	if err := DB.Raw("SELECT future_value FROM osint_jobs WHERE id = 88").Scan(&futureValue).Error; err != nil || futureValue != "untouched" {
		t.Fatalf("extra column or data lost: %q, %v", futureValue, err)
	}
	if err := DB.Exec("INSERT INTO osint_jobs (username) VALUES ('partial')").Error; err == nil {
		t.Fatal("existing UNIQUE constraint was lost")
	}
}

func TestInitDBBackupRestoresLegacyWALData(t *testing.T) {
	previousDB, previousPath := DB, activeDBPath
	defer func() { DB, activeDBPath = previousDB, previousPath }()
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "cyber-hub.db")
	legacy, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	legacySQL, err := legacy.DB()
	if err != nil {
		t.Fatal(err)
	}
	defer legacySQL.Close()
	legacySQL.SetMaxOpenConns(1)
	for _, statement := range []string{
		"PRAGMA journal_mode=WAL", "PRAGMA wal_autocheckpoint=0",
		`CREATE TABLE osint_jobs (
			id INTEGER PRIMARY KEY AUTOINCREMENT, created_at DATETIME, updated_at DATETIME,
			tool TEXT NOT NULL, username TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
			total_sites INTEGER DEFAULT 0, checked_sites INTEGER DEFAULT 0, found_count INTEGER DEFAULT 0,
			filter_category TEXT DEFAULT '', results TEXT DEFAULT '', duration INTEGER DEFAULT 0,
			launched_by TEXT DEFAULT '')`,
		"PRAGMA wal_checkpoint(TRUNCATE)",
		"CREATE UNIQUE INDEX custom_osint_username ON osint_jobs(username)",
		"INSERT INTO osint_jobs (id, tool, username) VALUES (42, 'legacy-tool', 'saved-user')",
	} {
		if err := legacy.Exec(statement).Error; err != nil {
			t.Fatal(err)
		}
	}
	if info, err := os.Stat(dbPath + "-wal"); err != nil || info.Size() == 0 {
		t.Fatalf("expected WAL data before migration: %v", err)
	}
	initErr := InitDB(dbPath)
	if DB != nil {
		defer func() { sqlDB, _ := DB.DB(); sqlDB.Close() }()
	}
	if initErr != nil {
		t.Fatal(initErr)
	}
	var username string
	if err := DB.Raw("SELECT username FROM osint_jobs WHERE id = 42").Scan(&username).Error; err != nil || username != "saved-user" {
		t.Fatalf("migrated row = %q, err = %v", username, err)
	}
	var toolColumns int
	if err := DB.Raw("SELECT COUNT(*) FROM pragma_table_info('osint_jobs') WHERE name='tool'").Scan(&toolColumns).Error; err != nil || toolColumns != 0 {
		t.Fatalf("legacy column remains: count=%d, err=%v", toolColumns, err)
	}
	if !DB.Migrator().HasIndex("osint_jobs", "custom_osint_username") {
		t.Fatal("legacy index was lost")
	}
	backups, err := filepath.Glob(filepath.Join(dir, "cyber-hub-*.db.bak"))
	if err != nil || len(backups) != 1 {
		t.Fatalf("pre-migration backups = %v, err = %v", backups, err)
	}
	restoredPath := filepath.Join(dir, "restored.db")
	src, err := os.Open(backups[0])
	if err != nil {
		t.Fatal(err)
	}
	defer src.Close()
	dst, err := os.Create(restoredPath)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := io.Copy(dst, src); err != nil {
		t.Fatal(err)
	}
	if err := dst.Close(); err != nil {
		t.Fatal(err)
	}
	restored, err := gorm.Open(sqlite.Open(restoredPath), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	defer func() { sqlDB, _ := restored.DB(); sqlDB.Close() }()
	var legacyTool string
	if err := restored.Raw("SELECT tool FROM osint_jobs WHERE username = ?", "saved-user").Scan(&legacyTool).Error; err != nil || legacyTool != "legacy-tool" {
		t.Fatalf("restored legacy value = %q, err = %v", legacyTool, err)
	}
	if !restored.Migrator().HasIndex("osint_jobs", "custom_osint_username") {
		t.Fatal("restored legacy index was lost")
	}
}

func TestFailedMigrationLeavesDatabaseAndBackupRestorable(t *testing.T) {
	previousDB, previousPath := DB, activeDBPath
	defer func() { DB, activeDBPath = previousDB, previousPath }()
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "cyber-hub.db")
	legacy, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	for _, query := range []string{
		"CREATE TABLE osint_jobs (id INTEGER PRIMARY KEY, tool TEXT NOT NULL, username TEXT NOT NULL)",
		"CREATE INDEX legacy_tool_index ON osint_jobs(tool)",
		"INSERT INTO osint_jobs (id, tool, username) VALUES (47, 'preserved', 'person')",
	} {
		if err := legacy.Exec(query).Error; err != nil {
			t.Fatal(err)
		}
	}
	closeLegacy, _ := legacy.DB()
	closeLegacy.Close()
	if err := InitDB(dbPath); err == nil {
		t.Fatal("expected DROP COLUMN to fail when index depends on tool")
	}
	closeCurrentDB(t)
	check := func(path string) {
		t.Helper()
		opened, err := gorm.Open(sqlite.Open(path), &gorm.Config{})
		if err != nil {
			t.Fatal(err)
		}
		defer func() { sqlDB, _ := opened.DB(); sqlDB.Close() }()
		var tool string
		if err := opened.Raw("SELECT tool FROM osint_jobs WHERE id = 47").Scan(&tool).Error; err != nil || tool != "preserved" {
			t.Fatalf("data lost in %s: %q, %v", path, tool, err)
		}
		if !opened.Migrator().HasIndex("osint_jobs", "legacy_tool_index") {
			t.Fatalf("index lost in %s", path)
		}
	}
	check(dbPath)
	backups, err := filepath.Glob(filepath.Join(dir, "cyber-hub-pre-migration-*.db.bak"))
	if err != nil || len(backups) != 1 {
		t.Fatalf("backups = %v, %v", backups, err)
	}
	restored := filepath.Join(dir, "restored.db")
	content, err := os.ReadFile(backups[0])
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(restored, content, 0600); err != nil {
		t.Fatal(err)
	}
	check(restored)
}
