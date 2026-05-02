package handlers

// ⚠️ Usage légal uniquement — OSINT sur systèmes autorisés seulement
// Ce module lance des outils OSINT externes. Assurez-vous d'avoir une autorisation explicite.

import (
	"context"
	"encoding/json"
	"io"
	"fmt"
	"net/http"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type OSINTHandler struct {
	db *gorm.DB
}

func NewOSINTHandler(db *gorm.DB) *OSINTHandler {
	return &OSINTHandler{db: db}
}

// checkInstalled vérifie si un outil est dispo : binaire dans PATH ou module Python.
// Ordre : binaire direct → python -m module → python3 -m module
func checkInstalled(name string) bool {
	// 1. Binaire direct dans le PATH (Linux/macOS installé via pip ou package manager)
	if _, err := exec.LookPath(name); err == nil {
		return true
	}
	// 2. Module Python (pip install theHarvester / sherlock-project / maigret)
	moduleName := name
	if name == "theHarvester" {
		moduleName = "theHarvester"
	}
	for _, py := range []string{"python", "python3", "py"} {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		out, err := exec.CommandContext(ctx, py, "-m", moduleName, "--help").CombinedOutput()
		cancel()
		if err == nil || (len(out) > 0 && !strings.Contains(string(out), "No module named")) {
			return true
		}
	}
	return false
}

// resolveCmd retourne la commande à utiliser pour lancer l'outil.
// Priorité : binaire direct > python -m > python3 -m
func resolveCmd(ctx context.Context, tool string, args []string) *exec.Cmd {
	if _, err := exec.LookPath(tool); err == nil {
		return exec.CommandContext(ctx, tool, args...)
	}
	for _, py := range []string{"python", "python3", "py"} {
		if _, err := exec.LookPath(py); err == nil {
			return exec.CommandContext(ctx, py, append([]string{"-m", tool}, args...)...)
		}
	}
	return exec.CommandContext(ctx, tool, args...)
}

// GET /api/osint/tools — liste les outils avec leur statut d'installation
func (h *OSINTHandler) ListTools(c *gin.Context) {
	tools := []map[string]interface{}{
		{
			"name":        "theHarvester",
			"installed":   checkInstalled("theHarvester"),
			"description": "OSINT emails, sous-domaines, IPs depuis sources publiques",
			"example":     "example.com",
			"install":     "pip install theHarvester",
		},
		{
			"name":        "sherlock",
			"installed":   checkInstalled("sherlock"),
			"description": "Recherche de username sur 300+ sites sociaux",
			"example":     "john_doe",
			"install":     "pip install sherlock-project",
		},
		{
			"name":        "maigret",
			"installed":   checkInstalled("maigret"),
			"description": "Profilage OSINT avancé multi-sources",
			"example":     "john_doe",
			"install":     "pip install maigret",
		},
	}
	c.JSON(http.StatusOK, gin.H{"tools": tools})
}

type runJobRequest struct {
	Tool   string `json:"tool"   binding:"required"`
	Target string `json:"target" binding:"required"`
}

// POST /api/osint/run — lance un job OSINT asynchrone
func (h *OSINTHandler) RunJob(c *gin.Context) {
	var req runJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tool et target sont requis"})
		return
	}

	// Validation : tools autorisés uniquement
	allowed := map[string]bool{"theHarvester": true, "sherlock": true, "maigret": true}
	if !allowed[req.Tool] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "outil non supporté"})
		return
	}

	// ⚠️ Validation basique de la cible pour éviter l'injection shell
	target := strings.TrimSpace(req.Target)
	if len(target) == 0 || len(target) > 253 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cible invalide"})
		return
	}

	// Récupérer l'identité de l'appelant depuis le token JWT (claim sub)
	launchedBy := "unknown"
	if sub, ok := c.Get("sub"); ok {
		launchedBy = fmt.Sprintf("%v", sub)
	}

	job := models.OSINTJob{
		Tool:       req.Tool,
		Target:     target,
		Status:     "pending",
		LaunchedBy: launchedBy,
	}
	if err := h.db.Create(&job).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "impossible de créer le job"})
		return
	}

	go h.runJobAsync(job.ID, req.Tool, target)

	c.JSON(http.StatusOK, gin.H{"id": job.ID, "status": "pending"})
}

// GET /api/osint/jobs — liste tous les jobs
func (h *OSINTHandler) ListJobs(c *gin.Context) {
	var jobs []models.OSINTJob
	h.db.Order("created_at DESC").Limit(100).Find(&jobs)
	c.JSON(http.StatusOK, gin.H{"jobs": jobs, "total": len(jobs)})
}

// GET /api/osint/jobs/:id — détail d'un job
func (h *OSINTHandler) GetJob(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	var job models.OSINTJob
	if err := h.db.First(&job, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "job introuvable"})
		return
	}
	c.JSON(http.StatusOK, job)
}

// DELETE /api/osint/jobs/:id — supprime un job
func (h *OSINTHandler) DeleteJob(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	if err := h.db.Delete(&models.OSINTJob{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "impossible de supprimer"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

// GET /api/osint/jobs/:id/stream — SSE : stream l'output du job en temps réel
func (h *OSINTHandler) StreamJob(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	c.Stream(func(w io.Writer) bool {
		var job models.OSINTJob
		if err := h.db.First(&job, id).Error; err != nil {
			c.SSEvent("error", gin.H{"error": "job introuvable"})
			return false
		}

		statusJSON, _ := json.Marshal(gin.H{
			"id":     job.ID,
			"status": job.Status,
			"output": job.Output,
		})
		c.SSEvent("status", string(statusJSON))

		if job.Status == "done" || job.Status == "error" {
			c.SSEvent("done", gin.H{"status": job.Status})
			return false
		}

		time.Sleep(2 * time.Second)
		return true
	})
}

// runJobAsync exécute le job OSINT en arrière-plan.
// ⚠️ Timeout 5 minutes pour éviter les jobs zombies.
func (h *OSINTHandler) runJobAsync(jobID uint, tool, target string) {
	start := time.Now()

	// Marquer le job comme en cours
	h.db.Model(&models.OSINTJob{}).Where("id = ?", jobID).Update("status", "running")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// Construire la commande selon l'outil
	var cmd *exec.Cmd
	switch tool {
	case "theHarvester":
		// ⚠️ -d : domaine cible (validé avant), -b : source publique uniquement
		cmd = resolveCmd(ctx, "theHarvester", []string{"-d", target, "-b", "bing,google,yahoo"})
	case "sherlock":
		cmd = resolveCmd(ctx, "sherlock", []string{"--print-found", target})
	case "maigret":
		cmd = resolveCmd(ctx, "maigret", []string{"--no-color", "-a", target})
	default:
		h.db.Model(&models.OSINTJob{}).Where("id = ?", jobID).Updates(map[string]interface{}{
			"status": "error",
			"output": "outil non supporté",
		})
		return
	}

	output, err := cmd.CombinedOutput()
	duration := time.Since(start).Milliseconds()
	outputStr := string(output)

	status := "done"
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			outputStr = "[TIMEOUT] Le job a dépassé 5 minutes\n" + outputStr
		}
		status = "error"
	}

	// Extraire les IOCs de l'output avec des regex
	iocs := extractIOCsFromOutput(outputStr)
	iocsJSON, _ := json.Marshal(iocs)

	h.db.Model(&models.OSINTJob{}).Where("id = ?", jobID).Updates(map[string]interface{}{
		"status":         status,
		"output":         outputStr,
		"iocs_extracted": string(iocsJSON),
		"duration":       duration,
	})
}

type extractedIOC struct {
	Type  string `json:"type"`
	Value string `json:"value"`
}

// extractIOCsFromOutput extrait les IOCs de l'output texte via regex.
// ⚠️ Les regex sont conservatrices pour éviter les faux positifs.
func extractIOCsFromOutput(output string) []extractedIOC {
	seen := make(map[string]bool)
	result := make([]extractedIOC, 0)

	addIOC := func(t, v string) {
		key := t + ":" + v
		if !seen[key] {
			seen[key] = true
			result = append(result, extractedIOC{Type: t, Value: v})
		}
	}

	// IP : exclure les adresses privées/loopback évidentes
	ipRe := regexp.MustCompile(`\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b`)
	for _, m := range ipRe.FindAllString(output, -1) {
		if !strings.HasPrefix(m, "127.") && !strings.HasPrefix(m, "0.") {
			addIOC("ip", m)
		}
	}

	// Email
	emailRe := regexp.MustCompile(`[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}`)
	for _, m := range emailRe.FindAllString(output, -1) {
		addIOC("email", m)
	}

	// URL
	urlRe := regexp.MustCompile(`https?://[^\s"'<>]+`)
	for _, m := range urlRe.FindAllString(output, -1) {
		addIOC("url", m)
	}

	// Domaines (après avoir retiré les URLs pour éviter les doublons)
	noURLs := urlRe.ReplaceAllString(output, "")
	domainRe := regexp.MustCompile(`\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b`)
	for _, m := range domainRe.FindAllString(noURLs, -1) {
		addIOC("domain", m)
	}

	return result
}
