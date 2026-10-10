package store

import (
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

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
		"INSERT INTO osint_jobs (tool, username) VALUES ('legacy-tool', 'saved-user')",
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
	if err := DB.Raw("SELECT username FROM osint_jobs WHERE id = 1").Scan(&username).Error; err != nil || username != "saved-user" {
		t.Fatalf("migrated row = %q, err = %v", username, err)
	}
	var toolColumns int
	if err := DB.Raw("SELECT COUNT(*) FROM pragma_table_info('osint_jobs') WHERE name='tool'").Scan(&toolColumns).Error; err != nil || toolColumns != 0 {
		t.Fatalf("legacy column remains: count=%d, err=%v", toolColumns, err)
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
}
