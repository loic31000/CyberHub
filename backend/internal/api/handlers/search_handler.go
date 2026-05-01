package handlers

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/cyber-hub/cyber-hub/internal/store"
	"github.com/gin-gonic/gin"
)

// SearchResult représente un résultat de recherche globale.
// Chaque résultat contient la catégorie source, l'ID, le titre principal,
// un sous-titre contextuel et la route frontend vers laquelle naviguer.
type SearchResult struct {
	ID       uint   `json:"id"`
	Category string `json:"category"` // "tool" | "ctf" | "cve" | "playbook"
	Title    string `json:"title"`
	Subtitle string `json:"subtitle"`
	Path     string `json:"path"` // Route frontend (ex: "/tools/3")
}

// GlobalSearch effectue une recherche plein texte dans tous les modules.
// GET /api/search?q=nmap
// ⚠️ Requête en lecture seule — pas d'exposition de données sensibles.
func GlobalSearch(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		c.JSON(http.StatusOK, gin.H{"results": []SearchResult{}})
		return
	}

	// Limite la longueur de la query pour prévenir les abus
	if len(q) > 100 {
		q = q[:100]
	}

	var results []SearchResult

	// ---- Outils ----
	tools, _, err := store.ListTools("", "", "", q, 0, 8)
	if err == nil {
		for _, t := range tools {
			results = append(results, SearchResult{
				ID:       t.ID,
				Category: "tool",
				Title:    t.Name,
				Subtitle: t.SubCategory,
				Path:     fmt.Sprintf("/tools/%d", t.ID),
			})
		}
	}

	// ---- CTF Writeups ----
	ctfs, _, err := store.ListCTF("", "", q, 0, 8)
	if err == nil {
		for _, w := range ctfs {
			results = append(results, SearchResult{
				ID:       w.ID,
				Category: "ctf",
				Title:    w.Title,
				Subtitle: string(w.Platform) + " · " + string(w.Difficulty),
				Path:     fmt.Sprintf("/ctf/%d", w.ID),
			})
		}
	}

	// ---- CVE ----
	cves, _, err := store.ListCVE("", "", q, 0, 8)
	if err == nil {
		for _, v := range cves {
			results = append(results, SearchResult{
				ID:       v.ID,
				Category: "cve",
				Title:    v.CVEID,
				Subtitle: string(v.Severity) + " · " + truncate(v.Description, 60),
				Path:     fmt.Sprintf("/cve/%d", v.ID),
			})
		}
	}

	// ---- Playbooks ----
	playbooks, _, err := store.ListPlaybooks(0, 8, q)
	if err == nil {
		for _, p := range playbooks {
			results = append(results, SearchResult{
				ID:       p.ID,
				Category: "playbook",
				Title:    p.Title,
				Subtitle: p.Scenario,
				Path:     fmt.Sprintf("/playbooks/%d", p.ID),
			})
		}
	}

	if results == nil {
		results = []SearchResult{}
	}

	c.JSON(http.StatusOK, gin.H{"results": results})
}

// truncate coupe une chaîne à max caractères et ajoute "…" si nécessaire.
func truncate(s string, max int) string {
	runes := []rune(s)
	if len(runes) <= max {
		return s
	}
	return string(runes[:max]) + "…"
}
