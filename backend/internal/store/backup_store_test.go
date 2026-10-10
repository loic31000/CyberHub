package store

import (
	"bytes"
	"log"
	"os"
	"path/filepath"
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
