package correlation

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	_ "embed"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"gorm.io/gorm"
)

//go:embed correlation-rules.json
var rulesJSON []byte

type CorrelationTechnique struct {
	TechniqueID string `json:"technique_id"`
	Name        string `json:"name"`
	Tactic      string `json:"tactic"`
}

type CorrelationCloakTactic struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type CorrelationTool struct {
	Name     string `json:"name"`
	Category string `json:"category"`
}

type CorrelationPlaybook struct {
	ID    uint   `json:"id"`
	Title string `json:"title"`
}

type CorrelationCVE struct {
	CVEID       string  `json:"cve_id"`
	Description string  `json:"description"`
	CVSSScore   float64 `json:"cvss_score"`
}

type CorrelationResult struct {
	IOCType      string                   `json:"ioc_type"`
	IOCValue     string                   `json:"ioc_value"`
	Techniques   []CorrelationTechnique   `json:"techniques"`
	CloakTactics []CorrelationCloakTactic `json:"cloak_tactics"`
	Tools        []CorrelationTool        `json:"tools"`
	Playbooks    []CorrelationPlaybook    `json:"playbooks"`
	CVEs         []CorrelationCVE         `json:"cves"`
	GeneratedAt  time.Time                `json:"generated_at"`
	FromCache    bool                     `json:"from_cache"`
}

type CorrelationRules struct {
	IP struct {
		MitreTechniqueIDs []string `json:"mitre_technique_ids"`
		CloakTactics      []string `json:"cloak_tactics"`
		ToolNames         []string `json:"tool_names"`
		PlaybookKeywords  []string `json:"playbook_keywords"`
		CVELookup         bool     `json:"cve_lookup"`
	} `json:"ip"`
	Domain struct {
		MitreTechniqueIDs []string `json:"mitre_technique_ids"`
		CloakTactics      []string `json:"cloak_tactics"`
		ToolNames         []string `json:"tool_names"`
		PlaybookKeywords  []string `json:"playbook_keywords"`
		CVELookup         bool     `json:"cve_lookup"`
	} `json:"domain"`
	Hash struct {
		MitreTechniqueIDs []string `json:"mitre_technique_ids"`
		CloakTactics      []string `json:"cloak_tactics"`
		ToolNames         []string `json:"tool_names"`
		PlaybookKeywords  []string `json:"playbook_keywords"`
		CVELookup         bool     `json:"cve_lookup"`
	} `json:"hash"`
	URL struct {
		MitreTechniqueIDs []string `json:"mitre_technique_ids"`
		CloakTactics      []string `json:"cloak_tactics"`
		ToolNames         []string `json:"tool_names"`
		PlaybookKeywords  []string `json:"playbook_keywords"`
		CVELookup         bool     `json:"cve_lookup"`
	} `json:"url"`
	Email struct {
		MitreTechniqueIDs []string `json:"mitre_technique_ids"`
		CloakTactics      []string `json:"cloak_tactics"`
		ToolNames         []string `json:"tool_names"`
		PlaybookKeywords  []string `json:"playbook_keywords"`
		CVELookup         bool     `json:"cve_lookup"`
	} `json:"email"`
	CIDR struct {
		MitreTechniqueIDs []string `json:"mitre_technique_ids"`
		CloakTactics      []string `json:"cloak_tactics"`
		ToolNames         []string `json:"tool_names"`
		PlaybookKeywords  []string `json:"playbook_keywords"`
		CVELookup         bool     `json:"cve_lookup"`
	} `json:"cidr"`
}

type CorrelationEngine struct {
	db    *gorm.DB
	rules CorrelationRules
}

func NewCorrelationEngine(db *gorm.DB) *CorrelationEngine {
	var rules CorrelationRules
	if err := json.Unmarshal(rulesJSON, &rules); err != nil {
		fmt.Printf("Erreur parsing règles de corrélation : %v\n", err)
	}
	return &CorrelationEngine{
		db:    db,
		rules: rules,
	}
}

func (ce *CorrelationEngine) getRulesForType(iocType string) *struct {
	MitreTechniqueIDs []string
	CloakTactics      []string
	ToolNames         []string
	PlaybookKeywords  []string
	CVELookup         bool
} {
	switch iocType {
	case "ip":
		return &struct {
			MitreTechniqueIDs []string
			CloakTactics      []string
			ToolNames         []string
			PlaybookKeywords  []string
			CVELookup         bool
		}{
			MitreTechniqueIDs: ce.rules.IP.MitreTechniqueIDs,
			CloakTactics:      ce.rules.IP.CloakTactics,
			ToolNames:         ce.rules.IP.ToolNames,
			PlaybookKeywords:  ce.rules.IP.PlaybookKeywords,
			CVELookup:         ce.rules.IP.CVELookup,
		}
	case "domain":
		return &struct {
			MitreTechniqueIDs []string
			CloakTactics      []string
			ToolNames         []string
			PlaybookKeywords  []string
			CVELookup         bool
		}{
			MitreTechniqueIDs: ce.rules.Domain.MitreTechniqueIDs,
			CloakTactics:      ce.rules.Domain.CloakTactics,
			ToolNames:         ce.rules.Domain.ToolNames,
			PlaybookKeywords:  ce.rules.Domain.PlaybookKeywords,
			CVELookup:         ce.rules.Domain.CVELookup,
		}
	case "hash":
		return &struct {
			MitreTechniqueIDs []string
			CloakTactics      []string
			ToolNames         []string
			PlaybookKeywords  []string
			CVELookup         bool
		}{
			MitreTechniqueIDs: ce.rules.Hash.MitreTechniqueIDs,
			CloakTactics:      ce.rules.Hash.CloakTactics,
			ToolNames:         ce.rules.Hash.ToolNames,
			PlaybookKeywords:  ce.rules.Hash.PlaybookKeywords,
			CVELookup:         ce.rules.Hash.CVELookup,
		}
	case "url":
		return &struct {
			MitreTechniqueIDs []string
			CloakTactics      []string
			ToolNames         []string
			PlaybookKeywords  []string
			CVELookup         bool
		}{
			MitreTechniqueIDs: ce.rules.URL.MitreTechniqueIDs,
			CloakTactics:      ce.rules.URL.CloakTactics,
			ToolNames:         ce.rules.URL.ToolNames,
			PlaybookKeywords:  ce.rules.URL.PlaybookKeywords,
			CVELookup:         ce.rules.URL.CVELookup,
		}
	case "email":
		return &struct {
			MitreTechniqueIDs []string
			CloakTactics      []string
			ToolNames         []string
			PlaybookKeywords  []string
			CVELookup         bool
		}{
			MitreTechniqueIDs: ce.rules.Email.MitreTechniqueIDs,
			CloakTactics:      ce.rules.Email.CloakTactics,
			ToolNames:         ce.rules.Email.ToolNames,
			PlaybookKeywords:  ce.rules.Email.PlaybookKeywords,
			CVELookup:         ce.rules.Email.CVELookup,
		}
	case "cidr":
		return &struct {
			MitreTechniqueIDs []string
			CloakTactics      []string
			ToolNames         []string
			PlaybookKeywords  []string
			CVELookup         bool
		}{
			MitreTechniqueIDs: ce.rules.CIDR.MitreTechniqueIDs,
			CloakTactics:      ce.rules.CIDR.CloakTactics,
			ToolNames:         ce.rules.CIDR.ToolNames,
			PlaybookKeywords:  ce.rules.CIDR.PlaybookKeywords,
			CVELookup:         ce.rules.CIDR.CVELookup,
		}
	default:
		return nil
	}
}

func (ce *CorrelationEngine) Analyze(iocType, iocValue string) CorrelationResult {
	result := CorrelationResult{
		IOCType:      iocType,
		IOCValue:     iocValue,
		Techniques:   []CorrelationTechnique{},
		CloakTactics: []CorrelationCloakTactic{},
		Tools:        []CorrelationTool{},
		Playbooks:    []CorrelationPlaybook{},
		CVEs:         []CorrelationCVE{},
		GeneratedAt:  time.Now(),
		FromCache:    false,
	}

	// 1. Vérifier le cache
	now := time.Now()
	var cached models.CorrelationCache
	if err := ce.db.Where("ioc_type = ? AND ioc_value = ? AND expires_at > ?", iocType, iocValue, now).
		First(&cached).Error; err == nil {
		var cachedResult CorrelationResult
		if err := json.Unmarshal([]byte(cached.Result), &cachedResult); err == nil {
			cachedResult.FromCache = true
			return cachedResult
		}
	}

	// 2. Charger les règles
	rules := ce.getRulesForType(iocType)
	if rules == nil {
		return result
	}

	// 3. Lancer 5 goroutines en parallèle
	var wg sync.WaitGroup
	techsChan := make(chan []CorrelationTechnique, 1)
	cloakChan := make(chan []CorrelationCloakTactic, 1)
	toolsChan := make(chan []CorrelationTool, 1)
	playbooksChan := make(chan []CorrelationPlaybook, 1)
	cvesChan := make(chan []CorrelationCVE, 1)

	// Goroutine 1 : MITRE Techniques
	wg.Add(1)
	go func() {
		defer wg.Done()
		var techs []models.MITRETechnique
		ce.db.Where("technique_id IN ?", rules.MitreTechniqueIDs).Find(&techs)
		result := make([]CorrelationTechnique, 0)
		for _, t := range techs {
			result = append(result, CorrelationTechnique{
				TechniqueID: t.TechniqueID,
				Name:        t.Name,
				Tactic:      t.Tactics,
			})
		}
		techsChan <- result
	}()

	// Goroutine 2 : CLOAK Tactics
	wg.Add(1)
	go func() {
		defer wg.Done()
		var cloaks []models.CloakOverride
		ce.db.Where("tactic_name IN ?", rules.CloakTactics).Find(&cloaks)
		result := make([]CorrelationCloakTactic, 0)
		for _, c := range cloaks {
			result = append(result, CorrelationCloakTactic{
				Name:        c.TacticName,
				Description: c.Description,
			})
		}
		cloakChan <- result
	}()

	// Goroutine 3 : Tools
	wg.Add(1)
	go func() {
		defer wg.Done()
		var tools []models.Tool
		ce.db.Where("name IN ?", rules.ToolNames).Find(&tools)
		result := make([]CorrelationTool, 0)
		for _, t := range tools {
			result = append(result, CorrelationTool{
				Name:     t.Name,
				Category: string(t.Category),
			})
		}
		toolsChan <- result
	}()

	// Goroutine 4 : Playbooks
	wg.Add(1)
	go func() {
		defer wg.Done()
		var playbooks []models.Playbook
		query := ce.db
		for i, kw := range rules.PlaybookKeywords {
			if i == 0 {
				query = query.Where("LOWER(title) LIKE ? OR LOWER(description) LIKE ?", "%"+kw+"%", "%"+kw+"%")
			} else {
				query = query.Or("LOWER(title) LIKE ? OR LOWER(description) LIKE ?", "%"+kw+"%", "%"+kw+"%")
			}
		}
		query.Find(&playbooks)

		// Dédupliqué par ID
		seen := make(map[uint]bool)
		result := make([]CorrelationPlaybook, 0)
		for _, p := range playbooks {
			if !seen[p.ID] {
				result = append(result, CorrelationPlaybook{ID: p.ID, Title: p.Title})
				seen[p.ID] = true
			}
		}
		playbooksChan <- result
	}()

	// Goroutine 5 : CVEs (si activé)
	wg.Add(1)
	go func() {
		defer wg.Done()
		result := make([]CorrelationCVE, 0)
		if rules.CVELookup {
			var cves []models.CVEEntry
			ce.db.Where("cvss_score >= ?", 7.0).Order("cvss_score DESC").Limit(5).Find(&cves)
			for _, c := range cves {
				result = append(result, CorrelationCVE{
					CVEID:       c.CVEID,
					Description: c.Description,
					CVSSScore:   c.CVSSScore,
				})
			}
		}
		cvesChan <- result
	}()

	wg.Wait()
	close(techsChan)
	close(cloakChan)
	close(toolsChan)
	close(playbooksChan)
	close(cvesChan)

	result.Techniques = <-techsChan
	result.CloakTactics = <-cloakChan
	result.Tools = <-toolsChan
	result.Playbooks = <-playbooksChan
	result.CVEs = <-cvesChan

	// 4. Sérialiser et upsert dans le cache
	resultJSON, _ := json.Marshal(result)
	cache := models.CorrelationCache{
		IOCType:   iocType,
		IOCValue:  iocValue,
		Result:    string(resultJSON),
		CreatedAt: now,
		ExpiresAt: now.Add(24 * time.Hour),
	}
	ce.db.Where("ioc_type = ? AND ioc_value = ?", iocType, iocValue).
		Delete(&models.CorrelationCache{})
	ce.db.Create(&cache)

	return result
}

func (ce *CorrelationEngine) InvalidateCache(iocValue string) error {
	return ce.db.Where("ioc_value = ?", iocValue).Delete(&models.CorrelationCache{}).Error
}
