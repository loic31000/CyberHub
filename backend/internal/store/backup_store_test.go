package store

import (
	"bytes"
	"log"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestBackupDBIncludesWALWrites(t *testing.T) {
	previousDB := DB
	previousPath := activeDBPath
	activeDBPath = "source.db"
	defer func() { DB = previousDB; activeDBPath = previousPath }()
	previousDir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(t.TempDir()); err != nil {
		t.Fatal(err)
	}
	defer os.Chdir(previousDir)

	DB, err = gorm.Open(sqlite.Open("source.db"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	defer func() { sqlDB, _ := DB.DB(); sqlDB.Close() }()
	sqlDB, err := DB.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(1)
	for _, statement := range []string{
		"PRAGMA journal_mode=WAL", "PRAGMA wal_autocheckpoint=0",
		"CREATE TABLE records (value TEXT)", "PRAGMA wal_checkpoint(TRUNCATE)",
		"INSERT INTO records (value) VALUES ('latest')",
	} {
		if err := DB.Exec(statement).Error; err != nil {
			t.Fatal(err)
		}
	}
	if info, err := os.Stat("source.db-wal"); err != nil || info.Size() == 0 {
		t.Fatalf("expected nonempty WAL: %v", err)
	}
	backupPath, err := BackupDB()
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(backupPath)
	if filepath.Ext(backupPath) != ".bak" {
		t.Fatalf("unexpected backup path %q", backupPath)
	}
	if !strings.HasPrefix(filepath.Base(backupPath), "cyber-hub-manual-") {
		t.Fatalf("manual backup is not identified: %q", backupPath)
	}
	backup, err := gorm.Open(sqlite.Open(backupPath), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	defer func() { db, _ := backup.DB(); db.Close() }()
	var value string
	if err := backup.Raw("SELECT value FROM records").Scan(&value).Error; err != nil {
		t.Fatal(err)
	}
	if value != "latest" {
		t.Fatalf("backup contains %q, want latest", value)
	}
}

func TestBackupRetentionKeepsManualAndMinimumPreMigration(t *testing.T) {
	previousDB, previousPath := DB, activeDBPath
	defer func() { DB, activeDBPath = previousDB, previousPath }()
	dir := t.TempDir()
	path := filepath.Join(dir, "cyber-hub.db")
	var err error
	DB, err = gorm.Open(sqlite.Open(path), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	defer closeCurrentDB(t)
	activeDBPath = path
	if err := DB.Exec("CREATE TABLE data (value TEXT)").Error; err != nil {
		t.Fatal(err)
	}
	t.Setenv("CYBER_HUB_AUTO_BACKUP_KEEP", "2")
	t.Setenv("CYBER_HUB_PRE_MIGRATION_BACKUP_KEEP", "1") // floor is three
	manual, err := BackupDB()
	if err != nil {
		t.Fatal(err)
	}
	legacyManual := filepath.Join(dir, "cyber-hub-2020-01-01-000000.db.bak")
	foreign := filepath.Join(dir, "other-auto-20200101T000000.000000000Z.db.bak")
	for _, file := range []string{legacyManual, foreign} {
		if err := os.WriteFile(file, []byte("keep"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	for i := 0; i < 5; i++ {
		if _, err := createBackup(path, backupAutomatic); err != nil {
			t.Fatal(err)
		}
		if _, err := createBackup(path, backupPreMigration); err != nil {
			t.Fatal(err)
		}
	}
	for _, item := range []struct {
		kind backupKind
		want int
	}{{backupAutomatic, 2}, {backupPreMigration, 3}} {
		files, err := filepath.Glob(filepath.Join(dir, "cyber-hub-"+string(item.kind)+"-*.db.bak"))
		if err != nil || len(files) != item.want {
			t.Fatalf("%s backups = %v, err %v", item.kind, files, err)
		}
		for _, file := range files {
			if err := verifyBackup(file); err != nil {
				t.Fatalf("retained backup %s invalid: %v", file, err)
			}
		}
	}
	for _, file := range []string{manual, legacyManual, foreign} {
		if _, err := os.Stat(file); err != nil {
			t.Fatalf("unmanaged backup removed: %s, %v", file, err)
		}
	}
}

func TestBackupDiskFailureDoesNotPrune(t *testing.T) {
	previousDB, previousPath := DB, activeDBPath
	defer func() { DB, activeDBPath = previousDB, previousPath }()
	dir := t.TempDir()
	var err error
	DB, err = gorm.Open(sqlite.Open(filepath.Join(dir, "source.db")), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	defer closeCurrentDB(t)
	old, err := createBackup(filepath.Join(dir, "source.db"), backupAutomatic)
	if err != nil {
		t.Fatal(err)
	}
	_, err = createBackup(filepath.Join(dir, "missing-directory", "source.db"), backupAutomatic)
	if err == nil || !strings.Contains(err.Error(), "sauvegarde SQLite") {
		t.Fatalf("expected disk/path error, got %v", err)
	}
	if _, err := os.Stat(old); err != nil {
		t.Fatalf("old backup deleted after failure: %v", err)
	}
}

func TestBackupRetentionDefaultsAndBounds(t *testing.T) {
	t.Setenv("CYBER_HUB_AUTO_BACKUP_KEEP", "")
	t.Setenv("CYBER_HUB_PRE_MIGRATION_BACKUP_KEEP", "")
	if retentionLimit(backupAutomatic) != 14 || retentionLimit(backupPreMigration) != 3 {
		t.Fatal("wrong default retention")
	}
	t.Setenv("CYBER_HUB_AUTO_BACKUP_KEEP", "0")
	t.Setenv("CYBER_HUB_PRE_MIGRATION_BACKUP_KEEP", "2")
	if retentionLimit(backupAutomatic) != 14 || retentionLimit(backupPreMigration) != 3 {
		t.Fatal("minimum retention was not enforced")
	}
	t.Setenv("CYBER_HUB_AUTO_BACKUP_KEEP", "1")
	t.Setenv("CYBER_HUB_PRE_MIGRATION_BACKUP_KEEP", "5")
	if retentionLimit(backupAutomatic) != 1 || retentionLimit(backupPreMigration) != 5 {
		t.Fatal("valid retention settings ignored")
	}
}

func TestBackupFailureIsLogged(t *testing.T) {
	previousDB := DB
	DB = nil
	defer func() { DB = previousDB }()
	var output bytes.Buffer
	log.SetOutput(&output)
	defer log.SetOutput(os.Stderr)
	backupAndLog()
	if !bytes.Contains(output.Bytes(), []byte("Échec de la sauvegarde")) {
		t.Fatalf("missing backup failure log: %q", output.String())
	}
}
