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

type CorrelationInvestigation struct {
	ID     uint   `json:"id"`
	Title  string `json:"title"`
	Status string `json:"status"`
}

type CorrelationAttackLayer struct {
	ID   uint   `json:"id"`
	Name string `json:"name"`
}

type CorrelationNote struct {
	ID      uint   `json:"id"`
	Title   string `json:"title"`
	Excerpt string `json:"excerpt"`
}

type CorrelationResult struct {
	IOCType        string                     `json:"ioc_type"`
	IOCValue       string                     `json:"ioc_value"`
	Techniques     []CorrelationTechnique     `json:"techniques"`
	CloakTactics   []CorrelationCloakTactic   `json:"cloak_tactics"`
	Tools          []CorrelationTool          `json:"tools"`
	Playbooks      []CorrelationPlaybook      `json:"playbooks"`
	CVEs           []CorrelationCVE           `json:"cves"`
	LOLBins        []CorrelationLOLBin        `json:"lolbins"`
	Investigations []CorrelationInvestigation `json:"investigations"`
	AttackLayers   []CorrelationAttackLayer   `json:"attack_layers"`
	Notes          []CorrelationNote          `json:"notes"`
	Confidence     float64                    `json:"confidence"`
	Rationale      string                     `json:"rationale"`
	NextActions    []string                   `json:"next_actions"`
	GeneratedAt    time.Time                  `json:"generated_at"`
	FromCache      bool                       `json:"from_cache"`
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

type cloakJSONData struct {
	Tactics []cloakJSONTactic `json:"tactics"`
}

type cloakJSONTactic struct {
	ID          json.RawMessage      `json:"id"`
	Name        string               `json:"name"`
	Description string               `json:"description"`
	Techniques  []cloakJSONTechnique `json:"techniques"`
}

type cloakJSONTechnique struct {
	ID          json.RawMessage `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
}

type CorrelationEngine struct {
	db        *gorm.DB
	rules     CorrelationRules
	cloakData cloakJSONData
}

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

func (ce *CorrelationEngine) lookupCloakTactics(tacticNames []string) []CorrelationCloakTactic {
	result := make([]CorrelationCloakTactic, 0)
	for _, ruleName := range tacticNames {
		for _, tactic := range ce.cloakData.Tactics {
			if strings.EqualFold(tactic.Name, ruleName) {
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
				break
			}
		}
	}
	return result
}

// computeEnrichment calcule le score de confiance, la rationale et les actions suivantes
// à partir des résultats collectés. Déterministe et auditable.
func computeEnrichment(iocType, iocValue string, r CorrelationResult) (float64, string, []string) {
	score := 0
	if len(r.Techniques) > 0 {
		score += 25
	}
	if len(r.Playbooks) > 0 {
		score += 15
	}
	if len(r.Investigations) > 0 {
		score += 25
	}
	if len(r.Notes) > 0 {
		score += 10
	}
	if len(r.CVEs) > 0 {
		score += 10
	}
	if len(r.LOLBins) > 0 {
		score += 10
	}
	if len(r.CloakTactics) > 0 {
		score += 10
	}
	if len(r.AttackLayers) > 0 {
		score += 5
	}
	if score > 100 {
		score = 100
	}
	confidence := float64(score) / 100.0

	parts := make([]string, 0, 6)
	if len(r.Techniques) > 0 {
		ids := make([]string, 0, len(r.Techniques))
		for _, t := range r.Techniques {
			ids = append(ids, t.TechniqueID)
		}
		parts = append(parts, fmt.Sprintf("%d technique(s) MITRE (%s)", len(r.Techniques), strings.Join(ids, ", ")))
	}
	if len(r.Investigations) > 0 {
		parts = append(parts, fmt.Sprintf("présent dans %d investigation(s)", len(r.Investigations)))
	}
	if len(r.Playbooks) > 0 {
		parts = append(parts, fmt.Sprintf("%d playbook(s) correspondant(s)", len(r.Playbooks)))
	}
	if len(r.CVEs) > 0 {
		parts = append(parts, fmt.Sprintf("%d CVE(s) ≥ 7.0 liée(s)", len(r.CVEs)))
	}
	if len(r.Notes) > 0 {
		parts = append(parts, fmt.Sprintf("%d note(s) pertinente(s)", len(r.Notes)))
	}
	if len(r.AttackLayers) > 0 {
		parts = append(parts, fmt.Sprintf("%d layer(s) ATT&CK contenant ces techniques", len(r.AttackLayers)))
	}

	var rationale string
	if len(parts) == 0 {
		rationale = fmt.Sprintf("[%s] Aucun signal fort dans les bases locales — CVE et playbooks génériques supprimés.", strings.ToUpper(iocType))
	} else {
		rationale = fmt.Sprintf("[%s] %s.", strings.ToUpper(iocType), strings.Join(parts, " · "))
	}

	actions := make([]string, 0, 6)
	switch iocType {
	case "ip":
		actions = append(actions, "Vérifier l'ASN dans BGP Lookup")
		actions = append(actions, "Rechercher dans Threat Feeds (Feodo, URLhaus)")
	case "domain":
		actions = append(actions, "Vérifier la réputation dans URLhaus / Threat Feeds")
		actions = append(actions, "Lancer une recherche OSINT (theHarvester, Gobuster)")
	case "hash":
		actions = append(actions, "Analyser avec VirusTotal / MalwareBazaar")
		actions = append(actions, "Reverser le binaire avec Ghidra ou YARA")
	case "url":
		actions = append(actions, "Scanner avec OWASP ZAP ou SQLmap")
		actions = append(actions, "Vérifier dans URLhaus / Threat Feeds")
	case "email":
		actions = append(actions, "Rechercher via OSINT Runner (Maigret, Sherlock)")
		actions = append(actions, "Vérifier les fuites de credentials")
	case "cidr":
		actions = append(actions, "Scanner le range avec Nmap ou Masscan")
		actions = append(actions, "Vérifier les ASN associés dans BGP Historian")
	}
	if len(r.Investigations) > 0 {
		actions = append(actions, fmt.Sprintf("Ajouter un événement dans l'investigation « %s »", r.Investigations[0].Title))
	}
	if len(r.Playbooks) > 0 {
		actions = append(actions, fmt.Sprintf("Exécuter le playbook « %s »", r.Playbooks[0].Title))
	}
	if len(r.CVEs) > 0 {
		actions = append(actions, "Vérifier le statut KEV pour les CVE trouvées")
	}

	return confidence, rationale, actions
}

func (ce *CorrelationEngine) Analyze(iocType, iocValue string) CorrelationResult {
	result := CorrelationResult{
		IOCType:        iocType,
		IOCValue:       iocValue,
		Techniques:     []CorrelationTechnique{},
		CloakTactics:   []CorrelationCloakTactic{},
		Tools:          []CorrelationTool{},
		Playbooks:      []CorrelationPlaybook{},
		CVEs:           []CorrelationCVE{},
		LOLBins:        []CorrelationLOLBin{},
		Investigations: []CorrelationInvestigation{},
		AttackLayers:   []CorrelationAttackLayer{},
		Notes:          []CorrelationNote{},
		NextActions:    []string{},
		GeneratedAt:    time.Now(),
		FromCache:      false,
	}

	// Validation stricte en premier — aucun cache ni goroutine pour une valeur invalide
	if ok, reason := validateIOCValue(iocType, iocValue); !ok {
		result.Rationale = reason
		result.Confidence = 0
		result.NextActions = []string{"Vérifier la valeur saisie et corriger le type d'IOC si nécessaire."}
		return result
	}

	now := time.Now()
	var cached models.CorrelationCache
	if err := ce.db.Where("ioc_type = ? AND ioc_value = ? AND expires_at > ?", iocType, iocValue, now).
		First(&cached).Error; err == nil {
		var cachedResult CorrelationResult
		if err := json.Unmarshal([]byte(cached.Result), &cachedResult); err == nil {
			cachedResult.FromCache = true
			// Garantir que les slices nil du cache deviennent des slices vides
			if cachedResult.Investigations == nil {
				cachedResult.Investigations = []CorrelationInvestigation{}
			}
			if cachedResult.AttackLayers == nil {
				cachedResult.AttackLayers = []CorrelationAttackLayer{}
			}
			if cachedResult.Notes == nil {
				cachedResult.Notes = []CorrelationNote{}
			}
			if cachedResult.NextActions == nil {
				cachedResult.NextActions = []string{}
			}
			// Appliquer le signal gating même sur les résultats cachés (corrige les anciens caches pré-patch)
			hasStrongSignal := len(cachedResult.Techniques) > 0 || len(cachedResult.Investigations) > 0
			if !hasStrongSignal {
				cachedResult.CVEs      = []CorrelationCVE{}
				cachedResult.Playbooks = []CorrelationPlaybook{}
			}
			return cachedResult
		}
	}

	rules := ce.getRulesForType(iocType)
	if rules == nil {
		return result
	}

	var wg sync.WaitGroup
	techsChan     := make(chan []CorrelationTechnique, 1)
	cloakChan     := make(chan []CorrelationCloakTactic, 1)
	toolsChan     := make(chan []CorrelationTool, 1)
	playbooksChan := make(chan []CorrelationPlaybook, 1)
	cvesChan      := make(chan []CorrelationCVE, 1)
	lolbinsChan   := make(chan []CorrelationLOLBin, 1)
	invsChan      := make(chan []CorrelationInvestigation, 1)
	layersChan    := make(chan []CorrelationAttackLayer, 1)
	notesChan     := make(chan []CorrelationNote, 1)

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

	// Goroutine 5 : CVEs (si activé pour ce type)
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

	// Goroutine 6 : LOLBins — si hash ou domaine, cherche correspondance par nom
	wg.Add(1)
	go func() {
		defer wg.Done()
		r := make([]CorrelationLOLBin, 0)
		if iocType == "hash" || iocType == "domain" {
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

	// Goroutine 7 : Investigations — recherche directe + via événements
	wg.Add(1)
	go func() {
		defer wg.Done()
		like := "%" + strings.ToLower(iocValue) + "%"
		var directInvs []models.Investigation
		ce.db.Where(
			"LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(tags) LIKE ?",
			like, like, like,
		).Limit(5).Find(&directInvs)

		seen := make(map[uint]bool)
		r := make([]CorrelationInvestigation, 0)
		for _, inv := range directInvs {
			seen[inv.ID] = true
			r = append(r, CorrelationInvestigation{ID: inv.ID, Title: inv.Title, Status: string(inv.Status)})
		}

		if len(r) < 5 {
			var events []models.InvestigationEvent
			ce.db.Where(
				"LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(metadata) LIKE ?",
				like, like, like,
			).Limit(10).Find(&events)
			extraIDs := make([]uint, 0)
			for _, ev := range events {
				if !seen[ev.InvestigationID] {
					seen[ev.InvestigationID] = true
					extraIDs = append(extraIDs, ev.InvestigationID)
				}
			}
			if len(extraIDs) > 0 {
				remaining := 5 - len(r)
				var moreInvs []models.Investigation
				ce.db.Where("id IN ?", extraIDs).Limit(remaining).Find(&moreInvs)
				for _, inv := range moreInvs {
					r = append(r, CorrelationInvestigation{ID: inv.ID, Title: inv.Title, Status: string(inv.Status)})
				}
			}
		}
		invsChan <- r
	}()

	// Goroutine 8 : ATT&CK Layers contenant les techniques de la règle
	wg.Add(1)
	go func() {
		defer wg.Done()
		r := make([]CorrelationAttackLayer, 0)
		if len(rules.MitreTechniqueIDs) == 0 {
			layersChan <- r
			return
		}
		query := ce.db.Model(&models.AttackLayer{})
		for i, tid := range rules.MitreTechniqueIDs {
			pattern := `%"technique_id":"` + tid + `"%`
			if i == 0 {
				query = query.Where("layer_data LIKE ?", pattern)
			} else {
				query = query.Or("layer_data LIKE ?", pattern)
			}
		}
		var layers []models.AttackLayer
		query.Limit(5).Find(&layers)
		for _, l := range layers {
			r = append(r, CorrelationAttackLayer{ID: l.ID, Name: l.Name})
		}
		layersChan <- r
	}()

	// Goroutine 9 : Notes contenant la valeur de l'IOC
	wg.Add(1)
	go func() {
		defer wg.Done()
		like := "%" + strings.ToLower(iocValue) + "%"
		var notes []models.Note
		ce.db.Where("LOWER(title) LIKE ? OR LOWER(content) LIKE ? OR LOWER(tags) LIKE ?", like, like, like).
			Limit(5).Find(&notes)
		r := make([]CorrelationNote, 0)
		for _, n := range notes {
			excerpt := n.Content
			if len(excerpt) > 120 {
				excerpt = excerpt[:120] + "…"
			}
			r = append(r, CorrelationNote{ID: n.ID, Title: n.Title, Excerpt: excerpt})
		}
		notesChan <- r
	}()

	wg.Wait()
	close(techsChan)
	close(cloakChan)
	close(toolsChan)
	close(playbooksChan)
	close(cvesChan)
	close(lolbinsChan)
	close(invsChan)
	close(layersChan)
	close(notesChan)

	result.Techniques     = <-techsChan
	result.CloakTactics   = <-cloakChan
	result.Tools          = <-toolsChan
	result.Playbooks      = <-playbooksChan
	result.CVEs           = <-cvesChan
	result.LOLBins        = <-lolbinsChan
	result.Investigations = <-invsChan
	result.AttackLayers   = <-layersChan
	result.Notes          = <-notesChan

	// Signal gating : CVE et playbooks ne remontent que si un signal concret (MITRE ou investigation) existe.
	// Sans signal fort, ces résultats seraient des faux positifs génériques non liés à l'IOC.
	hasStrongSignal := len(result.Techniques) > 0 || len(result.Investigations) > 0
	if !hasStrongSignal {
		result.CVEs      = []CorrelationCVE{}
		result.Playbooks = []CorrelationPlaybook{}
	}

	result.Confidence, result.Rationale, result.NextActions = computeEnrichment(iocType, iocValue, result)

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
