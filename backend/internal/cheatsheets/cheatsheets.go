package cheatsheets

import (
	_ "embed"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

//go:embed cheatsheets.json
var cheatsheetsJSON []byte

// Command représente une commande d'outil avec ses variables.
type Command struct {
	Title string   `json:"title"`
	Cmd   string   `json:"cmd"`
	Vars  []string `json:"vars"`
}

// Cheatsheet représente la fiche complète d'un outil.
type Cheatsheet struct {
	Tool        string    `json:"tool"`
	Category    string    `json:"category"`
	Description string    `json:"description"`
	Commands    []Command `json:"commands"`
}

type cheatsheetsFile struct {
	Cheatsheets []Cheatsheet `json:"cheatsheets"`
}

// CheatsheetsHandler expose les endpoints de la cheatsheet.
type CheatsheetsHandler struct {
	data []Cheatsheet
}

// NewCheatsheetsHandler charge le JSON embarqué et retourne le handler.
func NewCheatsheetsHandler() *CheatsheetsHandler {
	var file cheatsheetsFile
	if err := json.Unmarshal(cheatsheetsJSON, &file); err != nil {
		log.Fatalf("cheatsheets.json invalide : %v", err)
	}
	return &CheatsheetsHandler{data: file.Cheatsheets}
}

// GET /api/cheatsheets — liste résumée {tool, category, description, nb_commands}
func (h *CheatsheetsHandler) List(c *gin.Context) {
	type summary struct {
		Tool        string `json:"tool"`
		Category    string `json:"category"`
		Description string `json:"description"`
		NbCommands  int    `json:"nb_commands"`
	}

	result := make([]summary, 0, len(h.data))
	for _, cs := range h.data {
		result = append(result, summary{
			Tool:        cs.Tool,
			Category:    cs.Category,
			Description: cs.Description,
			NbCommands:  len(cs.Commands),
		})
	}
	c.JSON(http.StatusOK, gin.H{"cheatsheets": result, "total": len(result)})
}

// GET /api/cheatsheets/:tool_name — cheatsheet complète d'un outil
func (h *CheatsheetsHandler) GetByTool(c *gin.Context) {
	toolName := strings.ToLower(c.Param("tool_name"))
	for _, cs := range h.data {
		if strings.EqualFold(cs.Tool, toolName) {
			c.JSON(http.StatusOK, cs)
			return
		}
	}
	c.JSON(http.StatusNotFound, gin.H{"error": "cheatsheet introuvable pour " + toolName})
}
