package store

import (
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// legacyBGPSnapshot is the BGPSnapshot model as it was before per-section
// provenance, so the test starts from the schema GORM actually produced.
type legacyBGPSnapshot struct {
	ID           uint `gorm:"primarykey"`
	CreatedAt    time.Time
	ASN          int       `gorm:"index"`
	SnapshotDate time.Time `gorm:"index"`
	FullDataJSON string    `gorm:"type:text"`
	TakenBy      string
}

func (legacyBGPSnapshot) TableName() string { return "bgp_snapshots" }

func TestInitDBAddsBGPProvenanceToExistingSnapshots(t *testing.T) {
	previousDB, previousPath := DB, activeDBPath
	defer func() { DB, activeDBPath = previousDB, previousPath }()
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "cyber-hub.db")

	legacy, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := legacy.AutoMigrate(&legacyBGPSnapshot{}, &models.BGPAlert{}, &models.BGPCache{}); err != nil {
		t.Fatal(err)
	}
	taken := time.Date(2026, 10, 20, 8, 0, 0, 0, time.UTC)
	snapshots := []legacyBGPSnapshot{
		{ASN: 64500, SnapshotDate: taken, FullDataJSON: `{"prefixes":{"data":{"ipv4_prefixes":["192.0.2.0/24"]}}}`, TakenBy: "legacy"},
		{ASN: 64500, SnapshotDate: taken.Add(time.Hour), FullDataJSON: `{invalid`, TakenBy: "legacy"},
	}
	if err := legacy.Create(&snapshots).Error; err != nil {
		t.Fatal(err)
	}
	if err := legacy.Create(&models.BGPAlert{ASN: 64500, AlertType: "prefix_change", OldValue: "[]", NewValue: "[]"}).Error; err != nil {
		t.Fatal(err)
	}
	if err := legacy.Create(&models.BGPCache{CacheKey: "asn:64500:full", Response: "{}", ExpiresAt: taken}).Error; err != nil {
		t.Fatal(err)
	}
	var legacySchema string
	legacy.Raw("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'bgp_snapshots'").Scan(&legacySchema)
	legacySQL, _ := legacy.DB()
	legacySQL.Close()

	if err := InitDB(dbPath); err != nil {
		t.Fatal(err)
	}
	defer closeCurrentDB(t)

	if !DB.Migrator().HasColumn(&models.BGPSnapshot{}, "DataProvenanceJSON") {
		t.Fatal("provenance column was not added")
	}
	var migratedSchema string
	DB.Raw("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'bgp_snapshots'").Scan(&migratedSchema)
	if !strings.HasPrefix(migratedSchema, strings.TrimSuffix(legacySchema, ")")) {
		t.Fatalf("bgp_snapshots was rebuilt instead of extended:\nbefore: %s\nafter:  %s", legacySchema, migratedSchema)
	}
	var migrated []models.BGPSnapshot
	if err := DB.Order("id").Find(&migrated).Error; err != nil || len(migrated) != 2 {
		t.Fatalf("snapshots after migration = %d, err = %v", len(migrated), err)
	}
	for i, snapshot := range migrated {
		if snapshot.ID != snapshots[i].ID || snapshot.FullDataJSON != snapshots[i].FullDataJSON ||
			!snapshot.SnapshotDate.Equal(snapshots[i].SnapshotDate) || snapshot.DataProvenanceJSON != "" {
			t.Fatalf("snapshot %d changed during migration: %#v", snapshots[i].ID, snapshot)
		}
	}
	for _, index := range []string{"idx_bgp_snapshots_asn", "idx_bgp_snapshots_snapshot_date"} {
		if !DB.Migrator().HasIndex(&models.BGPSnapshot{}, index) {
			t.Fatalf("index %s lost", index)
		}
	}
	var alerts, caches int64
	DB.Model(&models.BGPAlert{}).Count(&alerts)
	DB.Model(&models.BGPCache{}).Count(&caches)
	if alerts != 1 || caches != 1 {
		t.Fatalf("alerts = %d, caches = %d after migration", alerts, caches)
	}
	if backups, _ := filepath.Glob(filepath.Join(dir, "cyber-hub-pre-migration-*.db.bak")); len(backups) != 1 {
		t.Fatalf("pre-migration backups = %v", backups)
	}

	// A second start must be a no-op for existing rows.
	closeCurrentDB(t)
	if err := InitDB(dbPath); err != nil {
		t.Fatal(err)
	}
	var count int64
	DB.Model(&models.BGPSnapshot{}).Count(&count)
	if count != 2 {
		t.Fatalf("snapshots after second start = %d", count)
	}
}
