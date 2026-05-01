// Package mitre gère le téléchargement et le parsing des données MITRE ATT&CK Enterprise.
// ⚠️ Usage légal uniquement — données publiques MITRE CC BY 4.0
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
	// URL officielle du JSON MITRE ATT&CK Enterprise (format STIX 2.0)
	mitreURL = "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json"

	// Timeout pour le téléchargement du JSON (~68 MB)
	downloadTimeout = 5 * time.Minute

	// Taille du batch d'insertion SQLite
	batchSize = 100
)

// seeding indique qu'un seed est en cours (atomic pour thread-safety)
var seeding atomic.Bool

// IsSeeding retourne true si le seed MITRE est en cours
func IsSeeding() bool { return seeding.Load() }

// ─── Types STIX 2.0 (subset minimal pour ATT&CK) ────────────────────────────

type stixBundle struct {
	Objects []json.RawMessage `json:"objects"`
}

// stixObject contient tous les champs que l'on peut rencontrer —
// les champs inconnus sont simplement ignorés par encoding/json.
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
		PhaseName     string `json:"phase_name"` // shortname tactic
	} `json:"kill_chain_phases"`

	XMitrePlatforms      []string `json:"x_mitre_platforms"`
	XMitreIsSubtechnique bool     `json:"x_mitre_is_subtechnique"`
	XMitreDetection      string   `json:"x_mitre_detection"`
	XMitreDeprecated     bool     `json:"x_mitre_deprecated"`
	XMitreRevoked        bool     `json:"x_mitre_revoked"`
	XMitreShortname      string   `json:"x_mitre_shortname"`    // pour x-mitre-tactic
	XMitreDataSources    []string `json:"x_mitre_data_sources"` // sources de détection
}

// ─── Ordre display de la kill chain ─────────────────────────────────────────

// tacticOrder définit l'ordre canonique des tactiques dans la kill chain.
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

// ─── Seeder principal ────────────────────────────────────────────────────────

// SeedIfNeeded lance le seed MITRE en arrière-plan si les tables sont vides.
// N'est pas bloquant — le seed s'exécute dans une goroutine.
func SeedIfNeeded() {
	if store.IsMITRESeeded() {
		log.Printf("[MITRE] Données déjà en base — skip seed")
		return
	}
	log.Printf("[MITRE] Démarrage du seed MITRE ATT&CK en arrière-plan…")
	go func() {
		if err := runSeed(); err != nil {
			log.Printf("[MITRE] Erreur seed : %v", err)
			seeding.Store(false)
		}
	}()
}

// runSeed télécharge le JSON MITRE, le parse et remplit la BDD.
func runSeed() error {
	seeding.Store(true)
	defer seeding.Store(false)

	start := time.Now()
	log.Printf("[MITRE] Téléchargement de %s …", mitreURL)

	// ── 1. Téléchargement ──────────────────────────────────────────────────
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

	// ── 2. Parsing JSON ────────────────────────────────────────────────────
	// On lit tout en mémoire puis on parse — le JSON fait ~68 MB, acceptable.
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("lecture body : %w", err)
	}

	var bundle stixBundle
	if err := json.Unmarshal(body, &bundle); err != nil {
		return fmt.Errorf("unmarshal STIX bundle : %w", err)
	}
	body = nil // libérer la mémoire

	log.Printf("[MITRE] %d objets STIX trouvés — filtrage…", len(bundle.Objects))

	// ── 3. Tri des objets ──────────────────────────────────────────────────
	var (
		tactics    []models.MITRETactic
		techniques []models.MITRETechnique
	)

	for _, raw := range bundle.Objects {
		var obj stixObject
		if err := json.Unmarshal(raw, &obj); err != nil {
			continue
		}

		switch obj.Type {
		case "x-mitre-tactic":
			t := parseTactic(obj)
			if t != nil {
				tactics = append(tactics, *t)
			}

		case "attack-pattern":
			if obj.XMitreDeprecated || obj.XMitreRevoked {
				continue
			}
			t := parseTechnique(obj)
			if t != nil {
				techniques = append(techniques, *t)
			}
		}
	}
	bundle.Objects = nil // libérer la mémoire

	log.Printf("[MITRE] %d tactiques, %d techniques/sous-techniques extraites", len(tactics), len(techniques))

	// ── 4. Persistance en BDD ──────────────────────────────────────────────
	if err := store.SeedMITRE(tactics, techniques); err != nil {
		return fmt.Errorf("persistance BDD : %w", err)
	}

	log.Printf("[MITRE] ✓ Seed terminé en %s (%d techniques)", time.Since(start).Round(time.Millisecond), len(techniques))
	return nil
}

// ─── Helpers de parsing ──────────────────────────────────────────────────────

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
	order := tacticOrder[obj.XMitreShortname]
	return &models.MITRETactic{
		TacticID:     tacticID,
		Name:         obj.Name,
		ShortName:    obj.XMitreShortname,
		Description:  truncate(obj.Description, 2000),
		URL:          url,
		DisplayOrder: order,
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

	// Tactiques associées (kill chain phases ATT&CK uniquement)
	var tacticNames []string
	for _, kc := range obj.KillChainPhases {
		if kc.KillChainName == "mitre-attack" {
			tacticNames = append(tacticNames, kc.PhaseName)
		}
	}

	// Parent ID pour les sous-techniques (T1046.001 → T1046)
	parentID := ""
	if obj.XMitreIsSubtechnique {
		parts := strings.SplitN(techniqueID, ".", 2)
		if len(parts) == 2 {
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

// truncate coupe une chaîne à max caractères sans couper en milieu de mot (approx).
func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}
