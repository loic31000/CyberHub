package models

import "time"

// ToolCategory représente le type d'outil (offensif ou défensif)
type ToolCategory string

const (
	CategoryOffensive ToolCategory = "offensive"
	CategoryDefensive ToolCategory = "defensive"
	CategoryOSINT     ToolCategory = "osint"
)

// ToolOS représente les OS supportés
type ToolOS string

const (
	OSWindows ToolOS = "windows"
	OSLinux   ToolOS = "linux"
	OSBoth    ToolOS = "both"
)

// EthicalLevel : niveau d'encadrement éthique d'une fiche outil (v0.6).
//   - standard : 100% défensif/forensics ou OSINT pur (pas de warning particulier)
//   - elevated : légal en bug bounty / audit autorisé (LegalNotes obligatoires)
//   - warning  : référencé pédagogiquement, gros warning + rappel Art. 323-1
type EthicalLevel string

const (
	EthicalStandard EthicalLevel = "standard"
	EthicalElevated EthicalLevel = "elevated"
	EthicalWarning  EthicalLevel = "warning"
)

// Tool représente une fiche outil éducative du hub.
//
// v0.7 PIVOT :
//   - Plus de DockerImage / DockerCmd : aucun lancement local depuis cyber-hub
//   - Ajout des champs Procedure, CommandTemplate, InputSchema (générateur de commande)
//   - Ajout des champs UserNotes, LegalNotes, EthicalUseCases (encadrement)
//   - Ajout du champ EthicalLevel (3 niveaux : standard / elevated / warning)
type Tool struct {
	ID          uint         `json:"id"           gorm:"primaryKey;autoIncrement"`
	Name        string       `json:"name"         gorm:"not null;uniqueIndex"`
	Category    ToolCategory `json:"category"     gorm:"not null"` // offensive | defensive | osint
	SubCategory string       `json:"sub_category" gorm:"not null"` // network, web, ad, forensics, recon...
	OS          ToolOS       `json:"os"           gorm:"not null"` // windows | linux | both
	Description string       `json:"description"  gorm:"not null"`

	// Contenu pédagogique éditable (Markdown)
	Install   string `json:"install"`   // instructions d'installation
	Usage     string `json:"usage"`     // syntaxe et options principales
	Examples  string `json:"examples"`  // exemples de commandes
	Defense   string `json:"defense"`   // détection / contre-mesures
	Procedure string `json:"procedure"` // méthodologie pas-à-pas (étapes recommandées)

	// Encadrement éthique et légal — visible sur chaque fiche
	EthicalLevel    EthicalLevel `json:"ethical_level"     gorm:"default:'standard'"` // standard | elevated | warning
	LegalNotes      string       `json:"legal_notes"`                                 // ⚠️ rappel légal (Art. 323-1, etc.)
	EthicalUseCases string       `json:"ethical_use_cases"`                           // cas d'usage légitimes (lab perso, CTF, bug bounty)

	// Générateur de commande paramétrable
	CommandTemplate string `json:"command_template"` // ex: "sherlock {{username}} --timeout 10"
	InputSchema     string `json:"input_schema"`     // JSON Schema des paramètres : type, validation, label, placeholder

	// Notes personnelles de l'utilisateur (Markdown libre, isolé du contenu officiel)
	UserNotes string `json:"user_notes"`

	Tags      string    `json:"tags"` // CSV : "réseau,scan,recon"
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ToolCreateRequest est le payload de création/mise à jour
type ToolCreateRequest struct {
	Name        string       `json:"name"         binding:"required,min=2,max=100"`
	Category    ToolCategory `json:"category"     binding:"required,oneof=offensive defensive osint"`
	SubCategory string       `json:"sub_category" binding:"required"`
	OS          ToolOS       `json:"os"           binding:"required,oneof=windows linux both"`
	Description string       `json:"description"  binding:"required,min=10"`

	Install   string `json:"install"`
	Usage     string `json:"usage"`
	Examples  string `json:"examples"`
	Defense   string `json:"defense"`
	Procedure string `json:"procedure"`

	EthicalLevel    EthicalLevel `json:"ethical_level"     binding:"omitempty,oneof=standard elevated warning"`
	LegalNotes      string       `json:"legal_notes"`
	EthicalUseCases string       `json:"ethical_use_cases"`

	CommandTemplate string `json:"command_template"`
	InputSchema     string `json:"input_schema"`

	UserNotes string `json:"user_notes"`

	Tags string `json:"tags"`
}
