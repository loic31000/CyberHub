package store

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/models"
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
	return backupDBAt(path)
}

func backupDBAt(dbPath string) (string, error) {
	backupPath := filepath.Join(filepath.Dir(dbPath), fmt.Sprintf("cyber-hub-%s.db.bak", time.Now().Format("2006-01-02-150405.000000000")))
	if err := DB.Exec("VACUUM INTO ?", backupPath).Error; err != nil {
		_ = os.Remove(backupPath)
		return "", fmt.Errorf("sauvegarde SQLite : %w", err)
	}
	return backupPath, nil
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
	path, err := BackupDB()
	if err != nil {
		log.Printf("[BACKUP] Échec de la sauvegarde : %v", err)
		return
	}
	log.Printf("[BACKUP] Sauvegarde créée : %s", path)
}

// --- helpers JSON pour l'export (serialize via json.Marshal) ---
var _ = json.Marshal // garde l'import actif
