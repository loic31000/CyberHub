package store

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// ExportPayload contient toutes les données exportables du hub.
type ExportPayload struct {
	ExportedAt  string              `json:"exported_at"`
	Version     string              `json:"version"`
	Tools       []models.Tool       `json:"tools"`
	CTFWriteups []models.CTFWriteup `json:"ctf_writeups"`
	CVEEntries  []models.CVEEntry   `json:"cve_entries"`
	Playbooks   []exportPlaybook    `json:"playbooks"`
}

type exportPlaybook struct {
	Title       string                `json:"title"`
	Scenario    string                `json:"scenario"`
	Description string                `json:"description"`
	Steps       []models.PlaybookStep `json:"steps"`
}

// ImportResult résume les opérations effectuées lors d'un import.
type ImportResult struct {
	Tools     importCount `json:"tools"`
	CTF       importCount `json:"ctf"`
	CVE       importCount `json:"cve"`
	Playbooks importCount `json:"playbooks"`
}

type importCount struct {
	Created int `json:"created"`
	Skipped int `json:"skipped"`
}

// ExportAll sérialise toutes les données de la BDD en ExportPayload.
func ExportAll() (*ExportPayload, error) {
	tools, _, err := ListTools("", "", "", "", 0, 0)
	if err != nil {
		return nil, fmt.Errorf("tools: %w", err)
	}
	ctf, _, err := ListCTF("", "", "", 0, 0)
	if err != nil {
		return nil, fmt.Errorf("ctf: %w", err)
	}
	cves, _, err := ListCVE("", "", "", 0, 0)
	if err != nil {
		return nil, fmt.Errorf("cve: %w", err)
	}
	playbooks, _, err := ListPlaybooks(0, 0)
	if err != nil {
		return nil, fmt.Errorf("playbooks: %w", err)
	}

	ep := make([]exportPlaybook, 0, len(playbooks))
	for _, p := range playbooks {
		ep = append(ep, exportPlaybook{
			Title: p.Title, Scenario: p.Scenario,
			Description: p.Description, Steps: p.Steps,
		})
	}

	return &ExportPayload{
		ExportedAt:  time.Now().Format(time.RFC3339),
		Version:     "0.3",
		Tools:       tools,
		CTFWriteups: ctf,
		CVEEntries:  cves,
		Playbooks:   ep,
	}, nil
}

// ImportAll importe les données d'un ExportPayload de façon non-destructive (upsert).
func ImportAll(payload *ExportPayload) (*ImportResult, error) {
	result := &ImportResult{}

	// --- Outils ---
	for _, t := range payload.Tools {
		var count int64
		DB.Model(&models.Tool{}).Where("name = ?", t.Name).Count(&count)
		if count > 0 {
			result.Tools.Skipped++
			continue
		}
		req := &models.ToolCreateRequest{
			Name: t.Name, Category: t.Category, SubCategory: t.SubCategory,
			OS: t.OS, Description: t.Description, Install: t.Install,
			Usage: t.Usage, Examples: t.Examples, Defense: t.Defense,
			Procedure: t.Procedure, EthicalLevel: t.EthicalLevel,
			LegalNotes: t.LegalNotes, EthicalUseCases: t.EthicalUseCases,
			CommandTemplate: t.CommandTemplate, InputSchema: t.InputSchema,
			UserNotes: t.UserNotes, Tags: t.Tags,
		}
		if _, err := CreateTool(req); err == nil {
			result.Tools.Created++
		}
	}

	// --- CTF Writeups ---
	for _, w := range payload.CTFWriteups {
		var count int64
		DB.Model(&models.CTFWriteup{}).Where("title = ?", w.Title).Count(&count)
		if count > 0 {
			result.CTF.Skipped++
			continue
		}
		req := &models.CTFCreateRequest{
			Title: w.Title, Platform: w.Platform, MachineName: w.MachineName,
			Difficulty: w.Difficulty, Category: w.Category, Content: w.Content,
			Flags: w.Flags, Tags: w.Tags, Completed: w.Completed,
		}
		if _, err := CreateCTF(req); err == nil {
			result.CTF.Created++
		}
	}

	// --- CVE ---
	for _, v := range payload.CVEEntries {
		var count int64
		DB.Model(&models.CVEEntry{}).Where("cve_id = ?", v.CVEID).Count(&count)
		if count > 0 {
			result.CVE.Skipped++
			continue
		}
		req := &models.CVECreateRequest{
			CVEID: v.CVEID, Description: v.Description, CVSSScore: v.CVSSScore,
			Severity: v.Severity, Products: v.Products, Status: v.Status,
			Notes: v.Notes, PublishedAt: v.PublishedAt,
		}
		if _, err := CreateCVE(req); err == nil {
			result.CVE.Created++
		}
	}

	// --- Playbooks ---
	for _, p := range payload.Playbooks {
		var count int64
		DB.Model(&models.Playbook{}).Where("title = ?", p.Title).Count(&count)
		if count > 0 {
			result.Playbooks.Skipped++
			continue
		}
		steps := make([]models.PlaybookStepRequest, 0, len(p.Steps))
		for _, s := range p.Steps {
			steps = append(steps, models.PlaybookStepRequest{Content: s.Content, Order: s.Order})
		}
		req := &models.PlaybookCreateRequest{
			Title: p.Title, Scenario: p.Scenario,
			Description: p.Description, Steps: steps,
		}
		if _, err := CreatePlaybook(req); err == nil {
			result.Playbooks.Created++
		}
	}

	return result, nil
}

// BackupDB crée un instantané SQLite cohérent, y compris les écritures présentes dans le WAL.
func BackupDB() (string, error) {
	if DB == nil {
		return "", fmt.Errorf("base de données non initialisée")
	}
	path := activeDBPath
	if path == "" {
		path = "cyber-hub.db"
	}
	return createBackup(path, backupManual)
}

type backupKind string

const (
	backupManual       backupKind = "manual"
	backupAutomatic    backupKind = "auto"
	backupPreMigration backupKind = "pre-migration"
)

var managedBackupName = regexp.MustCompile(`^cyber-hub-(auto|pre-migration)-[0-9]{8}T[0-9]{6}\.[0-9]{9}Z\.db\.bak$`)

func createBackup(dbPath string, kind backupKind) (string, error) {
	backupPath := filepath.Join(filepath.Dir(dbPath), fmt.Sprintf("cyber-hub-%s-%s.db.bak", kind, time.Now().UTC().Format("20060102T150405.000000000Z")))
	if err := DB.Exec("VACUUM INTO ?", backupPath).Error; err != nil {
		_ = os.Remove(backupPath)
		log.Printf("[BACKUP] Échec de création %s : %v", kind, err)
		return "", fmt.Errorf("sauvegarde SQLite : %w", err)
	}
	if err := verifyBackup(backupPath); err != nil {
		_ = os.Remove(backupPath)
		log.Printf("[BACKUP] Échec de vérification %s : %v", kind, err)
		return "", fmt.Errorf("vérification sauvegarde SQLite : %w", err)
	}
	log.Printf("[BACKUP] Sauvegarde %s créée et vérifiée : %s", kind, backupPath)
	if kind != backupManual {
		limit := retentionLimit(kind)
		if err := pruneBackups(filepath.Dir(dbPath), kind, limit); err != nil {
			log.Printf("[BACKUP] Échec du nettoyage %s : %v", kind, err)
		}
	}
	return backupPath, nil
}

func verifyBackup(path string) error {
	backup, err := gorm.Open(sqlite.Open(path), &gorm.Config{})
	if err != nil {
		return err
	}
	sqlDB, err := backup.DB()
	if err != nil {
		return err
	}
	defer sqlDB.Close()
	var result string
	if err := backup.Raw("PRAGMA integrity_check").Scan(&result).Error; err != nil {
		return err
	}
	if result != "ok" {
		return fmt.Errorf("integrity_check: %s", result)
	}
	return nil
}

func retentionLimit(kind backupKind) int {
	defaultLimit, minimum, env := 14, 1, "CYBER_HUB_AUTO_BACKUP_KEEP"
	if kind == backupPreMigration {
		defaultLimit, minimum, env = 3, 3, "CYBER_HUB_PRE_MIGRATION_BACKUP_KEEP"
	}
	value := os.Getenv(env)
	if value == "" {
		return defaultLimit
	}
	limit, err := strconv.Atoi(value)
	if err != nil || limit < minimum {
		log.Printf("[BACKUP] Valeur %s invalide (%q), utilisation de %d", env, value, defaultLimit)
		return defaultLimit
	}
	return limit
}

func pruneBackups(dir string, kind backupKind, keep int) error {
	if keep < 1 {
		return fmt.Errorf("rétention invalide: %d", keep)
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}
	var names []string
	for _, entry := range entries {
		name := entry.Name()
		if entry.Type().IsRegular() && managedBackupName.MatchString(name) &&
			strings.HasPrefix(name, "cyber-hub-"+string(kind)+"-") {
			names = append(names, name)
		}
	}
	sort.Sort(sort.Reverse(sort.StringSlice(names)))
	if len(names) <= keep {
		return nil
	}
	for _, name := range names[keep:] {
		path := filepath.Join(dir, name)
		if err := os.Remove(path); err != nil {
			return err
		}
		log.Printf("[BACKUP] Ancienne sauvegarde %s supprimée : %s", kind, path)
	}
	return nil
}

// AutoBackup est appelé au démarrage : backup immédiat + goroutine quotidienne.
func AutoBackup() {
	// Backup immédiat au démarrage
	backupAndLog()

	// Backup automatique toutes les 24h
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			backupAndLog()
		}
	}()
}

func backupAndLog() {
	if DB == nil {
		log.Printf("[BACKUP] Échec de la sauvegarde : base de données non initialisée")
		return
	}
	path := activeDBPath
	if path == "" {
		path = "cyber-hub.db"
	}
	_, err := createBackup(path, backupAutomatic)
	if err != nil {
		log.Printf("[BACKUP] Échec de la sauvegarde : %v", err)
	}
}

// --- helpers JSON pour l'export (serialize via json.Marshal) ---
var _ = json.Marshal // garde l'import actif
