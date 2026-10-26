package store

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// TestInitDBAddsFindingsToALegacyDatabase starts from a database created
// before #79 (no findings table, existing IOC and investigation data) and
// checks that InitDB only adds the new table: historical rows and table
// definitions are untouched, the findings table and its indexes exist.
func TestInitDBAddsFindingsToALegacyDatabase(t *testing.T) {
	previousDB, previousPath := DB, activeDBPath
	defer func() { DB, activeDBPath = previousDB, previousPath }()
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "cyber-hub.db")

	legacy, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := legacy.AutoMigrate(&models.IOC{}, &models.Investigation{}, &models.InvestigationEvent{}); err != nil {
		t.Fatal(err)
	}
	if legacy.Migrator().HasTable("findings") {
		t.Fatal("the legacy fixture must not contain findings")
	}
	ioc := models.IOC{Type: models.IOCTypeIP, Value: "203.0.113.42", Source: "lab", TLP: models.TLPAmber, Status: models.IOCStatusActive, Tags: "c2"}
	investigation := models.Investigation{Title: "Campagne fictive", Status: models.InvestigationStatusOpen}
	if err := legacy.Create(&ioc).Error; err != nil {
		t.Fatal(err)
	}
	if err := legacy.Create(&investigation).Error; err != nil {
		t.Fatal(err)
	}
	event := models.InvestigationEvent{InvestigationID: investigation.ID, Timestamp: time.Date(2026, 10, 1, 8, 0, 0, 0, time.UTC), Title: "IOC ajouté", EventType: models.EventTypeIOC, Severity: models.EventSeverityMedium, SourceModule: "ioc", SourceEntityID: "1", Metadata: `{"value":"203.0.113.42"}`}
	if err := legacy.Create(&event).Error; err != nil {
		t.Fatal(err)
	}
	schemaOf := func(db *gorm.DB) map[string]string {
		rows := map[string]string{}
		var items []struct{ Name, SQL string }
		db.Raw("SELECT name, sql FROM sqlite_master WHERE tbl_name IN ('iocs','investigations','investigation_events') AND sql IS NOT NULL").Scan(&items)
		for _, item := range items {
			rows[item.Name] = item.SQL
		}
		return rows
	}
	before := schemaOf(legacy)
	legacySQL, _ := legacy.DB()
	legacySQL.Close()

	if err := InitDB(dbPath); err != nil {
		t.Fatal(err)
	}
	defer closeCurrentDB(t)

	// Historical tables: same definitions (not rebuilt), same rows.
	after := schemaOf(DB)
	if len(after) != len(before) {
		t.Fatalf("historical schema objects changed: before %d, after %d", len(before), len(after))
	}
	for name, sql := range before {
		if after[name] != sql {
			t.Fatalf("%s was modified:\nbefore: %s\nafter:  %s", name, sql, after[name])
		}
	}
	var gotIOC models.IOC
	if err := DB.First(&gotIOC, ioc.ID).Error; err != nil || gotIOC.Value != ioc.Value || gotIOC.TLP != ioc.TLP || gotIOC.Tags != ioc.Tags {
		t.Fatalf("IOC changed: %+v, %v", gotIOC, err)
	}
	var gotEvent models.InvestigationEvent
	if err := DB.First(&gotEvent, event.ID).Error; err != nil || gotEvent.SourceModule != "ioc" || gotEvent.Metadata != event.Metadata || gotEvent.InvestigationID != investigation.ID {
		t.Fatalf("investigation event changed: %+v, %v", gotEvent, err)
	}

	// New table and only the expected indexes.
	if !DB.Migrator().HasTable(&models.Finding{}) {
		t.Fatal("findings table missing")
	}
	// severity is NOT NULL with a default of "unknown": checked by behaviour,
	// a row inserted without severity reads back as unknown.
	var severityNotNull int
	DB.Raw("SELECT \"notnull\" FROM pragma_table_info('findings') WHERE name = 'severity'").Scan(&severityNotNull)
	if severityNotNull != 1 {
		t.Fatal("severity must be NOT NULL")
	}
	if err := DB.Exec("INSERT INTO findings (fingerprint, source_type, source, category, title, status, evidence, first_seen, last_seen) VALUES ('default-check', 'x', 'x', 'x', 'x', 'new', '[]', ?, ?)", time.Now(), time.Now()).Error; err != nil {
		t.Fatal(err)
	}
	var defaultSeverity string
	DB.Raw("SELECT severity FROM findings WHERE fingerprint = 'default-check'").Scan(&defaultSeverity)
	if defaultSeverity != "unknown" {
		t.Fatalf("severity default = %q, want unknown", defaultSeverity)
	}
	DB.Exec("DELETE FROM findings WHERE fingerprint = 'default-check'")
	var indexes []struct {
		Name   string
		Unique bool
	}
	DB.Raw("SELECT name, \"unique\" FROM pragma_index_list('findings') WHERE origin = 'c'").Scan(&indexes)
	want := map[string]bool{"idx_findings_fingerprint": true, "idx_findings_status": false, "idx_findings_severity": false, "idx_findings_last_seen": false, "idx_findings_source": false}
	if len(indexes) != len(want) {
		t.Fatalf("findings indexes = %+v", indexes)
	}
	for _, index := range indexes {
		unique, ok := want[index.Name]
		if !ok || unique != index.Unique {
			t.Fatalf("unexpected index %+v", index)
		}
	}
	var sourceColumns []string
	DB.Raw("SELECT name FROM pragma_index_info('idx_findings_source') ORDER BY seqno").Scan(&sourceColumns)
	if len(sourceColumns) != 2 || sourceColumns[0] != "source_type" || sourceColumns[1] != "source" {
		t.Fatalf("idx_findings_source columns = %v", sourceColumns)
	}

	// The unique fingerprint is enforced by SQLite itself.
	f, _, err := UpsertFinding(models.Finding{SourceType: "appsec", Source: "appsec-audit", Category: "dependency", Title: "t", Severity: "low"}, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if err := DB.Exec("INSERT INTO findings (fingerprint, source_type, source, category, title, severity, status, evidence, first_seen, last_seen) VALUES (?, 'x', 'x', 'x', 'x', 'low', 'new', '[]', ?, ?)", f.Fingerprint, time.Now(), time.Now()).Error; err == nil {
		t.Fatal("duplicate fingerprint must be rejected by the unique index")
	}

	// A backup was taken before migrating the existing database.
	if backups, _ := filepath.Glob(filepath.Join(dir, "cyber-hub-pre-migration-*.db.bak")); len(backups) != 1 {
		t.Fatalf("pre-migration backups = %v", backups)
	}

	// A second start keeps everything as is.
	closeCurrentDB(t)
	if err := InitDB(dbPath); err != nil {
		t.Fatal(err)
	}
	var findings, iocs int64
	DB.Model(&models.Finding{}).Count(&findings)
	DB.Model(&models.IOC{}).Count(&iocs)
	if findings != 1 || iocs != 1 {
		t.Fatalf("after restart: findings=%d iocs=%d", findings, iocs)
	}
}
