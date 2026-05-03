package correlation

import (
	"encoding/json"
	"fmt"
	"strings"
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

type CorrelationLOLBin struct {
	Name     string `json:"name"`
	OS       string `json:"os"`
	Category string `json:"category"`
}

type CorrelationResult struct {
	IOCType      string                   `json:"ioc_type"`
	IOCValue     string                   `json:"ioc_value"`
	Techniques   []CorrelationTechnique   `json:"techniques"`
	CloakTactics []CorrelationCloakTactic `json:"cloak_tactics"`
	Tools        []CorrelationTool        `json:"tools"`
	Playbooks    []CorrelationPlaybook    `json:"playbooks"`
	CVEs         []CorrelationCVE         `json:"cves"`
	LOLBins      []CorrelationLOLBin      `json:"lolbins"`
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

// cloakJSONData représente le format du fichier cloak.json embarqué
type cloakJSONData struct {
	Tactics []cloakJSONTactic `json:"tactics"`
}

type cloakJSONTactic struct {
	ID          int                `json:"id"`
	Name        string             `json:"name"`
	Description string             `json:"description"`
	Techniques  []cloakJSONTechnique `json:"techniques"`
}

type cloakJSONTechnique struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type CorrelationEngine struct {
	db         *gorm.DB
	rules      CorrelationRules
	cloakData  cloakJSONData
}

// NewCorrelationEngine crée le moteur de corrélation.
// cloakData contient le JSON embarqué de cloak.json (lue depuis le FS embed du main).
func NewCorrelationEngine(db *gorm.DB, cloakData []byte) *CorrelationEngine {
	var rules CorrelationRules
	if err := json.Unmarshal(rulesJSON, &rules); err != nil {
		fmt.Printf("Erreur parsing règles de corrélation : %v\n", err)
	}

	var cloak cloakJSONData
	if len(cloakData) > 0 {
		if err := json.Unmarshal(cloakData, &cloak); err != nil {
			fmt.Printf("Erreur parsing cloak.json : %v\n", err)
		} else {
			fmt.Printf("[CLOAK] %d tactiques chargées en mémoire\n", len(cloak.Tactics))
		}
	}

	return &CorrelationEngine{
		db:        db,
		rules:     rules,
		cloakData: cloak,
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

// lookupCloakTactics fait un lookup in-memory case-insensitive dans le JSON CLOAK embarqué.
// Retourne les tactiques trouvées avec leurs 5 premières techniques.
func (ce *CorrelationEngine) lookupCloakTactics(tacticNames []string) []CorrelationCloakTactic {
	result := make([]CorrelationCloakTactic, 0)
	for _, ruleName := range tacticNames {
		for _, tactic := range ce.cloakData.Tactics {
			if strings.EqualFold(tactic.Name, ruleName) {
				// Construire la description avec les techniques (max 5)
				desc := tactic.Description
				if len(tactic.Techniques) > 0 {
					techNames := make([]string, 0, 5)
					for i, tech := range tactic.Techniques {
						if i >= 5 {
							break
						}
						techNames = append(techNames, tech.Name)
					}
					desc = strings.Join(techNames, ", ")
				}
				result = append(result, CorrelationCloakTactic{
					Name:        tactic.Name,
					Description: desc,
				})
				break // Une tactique trouvée par nom de règle suffit
			}
		}
	}
	return result
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
		LOLBins:      []CorrelationLOLBin{},
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

	// 3. Lancer 6 goroutines en parallèle
	var wg sync.WaitGroup
	techsChan     := make(chan []CorrelationTechnique, 1)
	cloakChan     := make(chan []CorrelationCloakTactic, 1)
	toolsChan     := make(chan []CorrelationTool, 1)
	playbooksChan := make(chan []CorrelationPlaybook, 1)
	cvesChan      := make(chan []CorrelationCVE, 1)
	lolbinsChan   := make(chan []CorrelationLOLBin, 1)

	// Goroutine 1 : MITRE Techniques
	wg.Add(1)
	go func() {
		defer wg.Done()
		var techs []models.MITRETechnique
		ce.db.Where("technique_id IN ?", rules.MitreTechniqueIDs).Find(&techs)
		r := make([]CorrelationTechnique, 0)
		for _, t := range techs {
			r = append(r, CorrelationTechnique{
				TechniqueID: t.TechniqueID,
				Name:        t.Name,
				Tactic:      t.Tactics,
			})
		}
		techsChan <- r
	}()

	// Goroutine 2 : CLOAK Tactics — lookup in-memory depuis cloak.json embarqué
	// ⚠️ Ne pas interroger la DB cloak_overrides (généralement vide) — utiliser les données JSON officielles
	wg.Add(1)
	go func() {
		defer wg.Done()
		cloakChan <- ce.lookupCloakTactics(rules.CloakTactics)
	}()

	// Goroutine 3 : Tools
	wg.Add(1)
	go func() {
		defer wg.Done()
		var tools []models.Tool
		ce.db.Where("name IN ?", rules.ToolNames).Find(&tools)
		r := make([]CorrelationTool, 0)
		for _, t := range tools {
			r = append(r, CorrelationTool{
				Name:     t.Name,
				Category: string(t.Category),
			})
		}
		toolsChan <- r
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

		seen := make(map[uint]bool)
		r := make([]CorrelationPlaybook, 0)
		for _, p := range playbooks {
			if !seen[p.ID] {
				r = append(r, CorrelationPlaybook{ID: p.ID, Title: p.Title})
				seen[p.ID] = true
			}
		}
		playbooksChan <- r
	}()

	// Goroutine 5 : CVEs (si activé)
	wg.Add(1)
	go func() {
		defer wg.Done()
		r := make([]CorrelationCVE, 0)
		if rules.CVELookup {
			var cves []models.CVEEntry
			ce.db.Where("cvss_score >= ?", 7.0).Order("cvss_score DESC").Limit(5).Find(&cves)
			for _, c := range cves {
				r = append(r, CorrelationCVE{
					CVEID:       c.CVEID,
					Description: c.Description,
					CVSSScore:   c.CVSSScore,
				})
			}
		}
		cvesChan <- r
	}()

	// Goroutine 6 : LOLBins — si l'IOC est un hash ou domaine, cherche correspondance par nom
	wg.Add(1)
	go func() {
		defer wg.Done()
		r := make([]CorrelationLOLBin, 0)
		if iocType == "hash" || iocType == "domain" {
			// Cherche un LOLBin dont le nom correspond (ex: "certutil.exe" dans la valeur)
			nameLike := "%" + strings.ToLower(iocValue) + "%"
			var bins []models.LOLBin
			ce.db.Where("LOWER(name) LIKE ? OR LOWER(full_path) LIKE ?", nameLike, nameLike).
				Limit(5).Find(&bins)
			for _, b := range bins {
				r = append(r, CorrelationLOLBin{
					Name:     b.Name,
					OS:       b.OS,
					Category: b.Category,
				})
			}
		}
		lolbinsChan <- r
	}()

	wg.Wait()
	close(techsChan)
	close(cloakChan)
	close(toolsChan)
	close(playbooksChan)
	close(cvesChan)
	close(lolbinsChan)

	result.Techniques   = <-techsChan
	result.CloakTactics = <-cloakChan
	result.Tools        = <-toolsChan
	result.Playbooks    = <-playbooksChan
	result.CVEs         = <-cvesChan
	result.LOLBins      = <-lolbinsChan

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
