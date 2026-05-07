package mitre

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync/atomic"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/cyber-hub/cyber-hub/internal/store"
)

const (
	mitreURL        = "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json"
	downloadTimeout = 5 * time.Minute
)

var seeding atomic.Bool

func IsSeeding() bool { return seeding.Load() }

type stixBundle struct {
	Objects []json.RawMessage `json:"objects"`
}

type stixObject struct {
	Type        string `json:"type"`
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`

	ExternalReferences []struct {
		SourceName string `json:"source_name"`
		ExternalID string `json:"external_id"`
		URL        string `json:"url"`
	} `json:"external_references"`

	KillChainPhases []struct {
		KillChainName string `json:"kill_chain_name"`
		PhaseName     string `json:"phase_name"`
	} `json:"kill_chain_phases"`

	XMitrePlatforms      []string `json:"x_mitre_platforms"`
	XMitreIsSubtechnique bool     `json:"x_mitre_is_subtechnique"`
	XMitreDetection      string   `json:"x_mitre_detection"`
	XMitreDeprecated     bool     `json:"x_mitre_deprecated"`
	XMitreRevoked        bool     `json:"x_mitre_revoked"`
	XMitreShortname      string   `json:"x_mitre_shortname"`
	XMitreDataSources    []string `json:"x_mitre_data_sources"`
}

var tacticOrder = map[string]int{
	"reconnaissance":       1,
	"resource-development": 2,
	"initial-access":       3,
	"execution":            4,
	"persistence":          5,
	"privilege-escalation": 6,
	"defense-evasion":      7,
	"credential-access":    8,
	"discovery":            9,
	"lateral-movement":     10,
	"collection":           11,
	"command-and-control":  12,
	"exfiltration":         13,
	"impact":               14,
}

func SeedIfNeeded() {
	if store.IsMITRESeeded() {
		log.Printf("[MITRE] Données déjà en base — skip seed")
		return
	}

	if !seeding.CompareAndSwap(false, true) {
		log.Printf("[MITRE] Seed déjà en cours — skip")
		return
	}

	log.Printf("[MITRE] Démarrage du seed MITRE ATT&CK en arrière-plan…")
	go func() {
		defer seeding.Store(false)
		if err := runSeed(); err != nil {
			log.Printf("[MITRE] Erreur seed : %v", err)
		}
	}()
}

func RunSeed() error {
	if !seeding.CompareAndSwap(false, true) {
		return fmt.Errorf("seed MITRE déjà en cours")
	}
	defer seeding.Store(false)
	return runSeed()
}

func runSeed() error {
	start := time.Now()
	log.Printf("[MITRE] Téléchargement de %s …", mitreURL)

	client := &http.Client{Timeout: downloadTimeout}
	resp, err := client.Get(mitreURL)
	if err != nil {
		return fmt.Errorf("téléchargement échoué : %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %d depuis %s", resp.StatusCode, mitreURL)
	}

	log.Printf("[MITRE] Téléchargement terminé — parsing STIX…")

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("lecture body : %w", err)
	}

	var bundle stixBundle
	if err := json.Unmarshal(body, &bundle); err != nil {
		return fmt.Errorf("unmarshal STIX bundle : %w", err)
	}

	body = nil
	log.Printf("[MITRE] %d objets STIX trouvés — filtrage…", len(bundle.Objects))

	tactics := make([]models.MITRETactic, 0, 32)
	techniques := make([]models.MITRETechnique, 0, 900)

	for _, raw := range bundle.Objects {
		var obj stixObject
		if err := json.Unmarshal(raw, &obj); err != nil {
			continue
		}

		switch obj.Type {
		case "x-mitre-tactic":
			if t := parseTactic(obj); t != nil {
				tactics = append(tactics, *t)
			}
		case "attack-pattern":
			if obj.XMitreDeprecated || obj.XMitreRevoked {
				continue
			}
			if t := parseTechnique(obj); t != nil {
				techniques = append(techniques, *t)
			}
		}
	}

	bundle.Objects = nil

	log.Printf("[MITRE] %d tactiques, %d techniques/sous-techniques extraites", len(tactics), len(techniques))

	if err := store.SeedMITRE(tactics, techniques); err != nil {
		return fmt.Errorf("persistance BDD : %w", err)
	}

	log.Printf("[MITRE] ✓ Seed terminé en %s (%d techniques)", time.Since(start).Round(time.Millisecond), len(techniques))
	return nil
}

func parseTactic(obj stixObject) *models.MITRETactic {
	if obj.XMitreShortname == "" {
		return nil
	}

	tacticID := ""
	url := ""
	for _, ref := range obj.ExternalReferences {
		if ref.SourceName == "mitre-attack" {
			tacticID = ref.ExternalID
			url = ref.URL
			break
		}
	}
	if tacticID == "" {
		return nil
	}

	return &models.MITRETactic{
		TacticID:     tacticID,
		Name:         obj.Name,
		ShortName:    obj.XMitreShortname,
		Description:  truncate(obj.Description, 2000),
		URL:          url,
		DisplayOrder: tacticOrder[obj.XMitreShortname],
	}
}

func parseTechnique(obj stixObject) *models.MITRETechnique {
	techniqueID := ""
	url := ""
	for _, ref := range obj.ExternalReferences {
		if ref.SourceName == "mitre-attack" {
			techniqueID = ref.ExternalID
			url = ref.URL
			break
		}
	}
	if techniqueID == "" {
		return nil
	}

	var tacticNames []string
	for _, kc := range obj.KillChainPhases {
		if kc.KillChainName == "mitre-attack" {
			tacticNames = append(tacticNames, kc.PhaseName)
		}
	}

	parentID := ""
	if obj.XMitreIsSubtechnique {
		if parts := strings.SplitN(techniqueID, ".", 2); len(parts) == 2 {
			parentID = parts[0]
		}
	}

	tacticsJSON, _ := json.Marshal(tacticNames)
	platformsJSON, _ := json.Marshal(obj.XMitrePlatforms)
	dataSourcesJSON, _ := json.Marshal(obj.XMitreDataSources)

	return &models.MITRETechnique{
		TechniqueID:    techniqueID,
		Name:           obj.Name,
		Description:    truncate(obj.Description, 4000),
		Tactics:        string(tacticsJSON),
		Platforms:      string(platformsJSON),
		IsSubtechnique: obj.XMitreIsSubtechnique,
		ParentID:       parentID,
		Detection:      truncate(obj.XMitreDetection, 3000),
		URL:            url,
		DataSources:    string(dataSourcesJSON),
	}
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}
