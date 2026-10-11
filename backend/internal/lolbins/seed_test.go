package lolbins

import (
	"bytes"
	"encoding/json"
	"log"
	"path/filepath"
	"strings"
	"testing"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func openTestDB(t *testing.T, path string) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(path), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.LOLBin{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func closeTestDB(t *testing.T, db *gorm.DB) {
	t.Helper()
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	if err := sqlDB.Close(); err != nil {
		t.Fatal(err)
	}
}

func countOS(t *testing.T, db *gorm.DB, osName string) int64 {
	t.Helper()
	var count int64
	if err := db.Model(&models.LOLBin{}).Where("os = ?", osName).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	return count
}

func TestParseCompleteEmbeddedData(t *testing.T) {
	windows, err := parseLOLBAS(lolbasRaw)
	if err != nil {
		t.Fatal(err)
	}
	linux, err := parseGTFOBins(gtfobinsRaw)
	if err != nil {
		t.Fatal(err)
	}
	if len(windows) != 232 || len(linux) != 15 {
		t.Fatalf("embedded data: Windows=%d Linux=%d", len(windows), len(linux))
	}
	var addin *models.LOLBin
	for i := range windows {
		if windows[i].Name == "AddinUtil.exe" {
			addin = &windows[i]
			break
		}
	}
	if addin == nil {
		t.Fatal("AddinUtil.exe missing")
	}
	var commands []map[string]json.RawMessage
	if err := json.Unmarshal([]byte(addin.Commands), &commands); err != nil || len(commands) == 0 {
		t.Fatalf("commands invalid: %v", err)
	}
	if len(commands[0]["OperatingSystem"]) == 0 {
		t.Fatal("command metadata was discarded")
	}
	var tags []map[string]string
	if err := json.Unmarshal(commands[0]["Tags"], &tags); err != nil || len(tags) == 0 || tags[0]["Execute"] == "" {
		t.Fatalf("object tags were lost: %v, %v", tags, err)
	}
	if !strings.Contains(addin.Tags, "Execute:") || !strings.Contains(addin.MitreTech, "T1218") {
		t.Fatalf("derived tags or MITRE missing: %s, %s", addin.Tags, addin.MitreTech)
	}
}

func TestSeedFreshExistingAndRestart(t *testing.T) {
	path := filepath.Join(t.TempDir(), "lolbins.db")
	db := openTestDB(t, path)
	defer func() { closeTestDB(t, db) }()
	if err := SeedLOLBins(db); err != nil {
		t.Fatal(err)
	}
	if countOS(t, db, "windows") != 232 || countOS(t, db, "linux") != 15 {
		t.Fatal("fresh import counts are wrong")
	}
	var custom models.LOLBin
	if err := db.Where("os = ? AND name = ?", "windows", "AddinUtil.exe").First(&custom).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Model(&custom).Update("description", "user annotation").Error; err != nil {
		t.Fatal(err)
	}
	deleted := db.Where("os = ? AND name = ?", "windows", "Tracker.exe").Delete(&models.LOLBin{})
	if deleted.Error != nil || deleted.RowsAffected != 1 {
		t.Fatalf("test fixture could not remove a Windows entry: %v, rows=%d", deleted.Error, deleted.RowsAffected)
	}
	if countOS(t, db, "windows") != 231 {
		t.Fatal("test fixture did not remove one Windows entry")
	}
	if err := SeedLOLBins(db); err != nil {
		t.Fatal(err)
	}
	if countOS(t, db, "windows") != 232 || countOS(t, db, "linux") != 15 {
		t.Fatal("partial import was not repaired or made duplicates")
	}
	closeTestDB(t, db)
	db = openTestDB(t, path)
	if err := SeedLOLBins(db); err != nil {
		t.Fatal(err)
	}
	if countOS(t, db, "windows") != 232 || countOS(t, db, "linux") != 15 {
		t.Fatal("restart made duplicates")
	}
	var retained models.LOLBin
	if err := db.First(&retained, custom.ID).Error; err != nil || retained.Description != "user annotation" {
		t.Fatalf("existing data modified: %q, %v", retained.Description, err)
	}
}

func TestSeedRejectsMalformedJSONWithoutInsert(t *testing.T) {
	db := openTestDB(t, filepath.Join(t.TempDir(), "lolbins.db"))
	defer closeTestDB(t, db)
	if err := seedLOLBins(db, []byte(`[{"Name":"bad","Commands":[{"Tags":["not an object"]}]}]`), gtfobinsRaw); err == nil {
		t.Fatal("malformed command tags accepted")
	}
	if err := seedLOLBins(db, lolbasRaw, []byte(`{"broken":{"functions":"bad"}}`)); err == nil {
		t.Fatal("malformed GTFOBins functions accepted")
	}
	if countOS(t, db, "windows") != 0 || countOS(t, db, "linux") != 0 {
		t.Fatal("malformed input partially inserted")
	}
}

func TestSeedInsertionFailureRollsBackAndDoesNotLogSuccess(t *testing.T) {
	db := openTestDB(t, filepath.Join(t.TempDir(), "lolbins.db"))
	defer closeTestDB(t, db)
	if err := db.Exec(`CREATE TRIGGER reject_linux BEFORE INSERT ON lol_bins
		WHEN NEW.os = 'linux' BEGIN SELECT RAISE(FAIL, 'forced insert failure'); END`).Error; err != nil {
		t.Fatal(err)
	}
	var output bytes.Buffer
	previousWriter := log.Writer()
	log.SetOutput(&output)
	defer log.SetOutput(previousWriter)
	err := SeedLOLBins(db)
	if err == nil || !strings.Contains(err.Error(), "insertion LOLBins") {
		t.Fatalf("insertion failure was ignored: %v", err)
	}
	if strings.Contains(output.String(), "Chargement terminé") {
		t.Fatalf("success logged after failure: %s", output.String())
	}
	if countOS(t, db, "windows") != 0 || countOS(t, db, "linux") != 0 {
		t.Fatal("transaction did not roll back")
	}
}
