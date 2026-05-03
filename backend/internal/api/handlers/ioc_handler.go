package handlers

import (
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/correlation"
	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/cyber-hub/cyber-hub/internal/store"
	"github.com/gin-gonic/gin"
)

// validIOCTypes - "cidr" ajoute pour les prefixes reseau BGP
var validIOCTypes = map[string]bool{
	"ip": true, "domain": true, "hash": true, "url": true, "email": true, "cidr": true,
}

var validTLPs = map[string]bool{
	"white": true, "green": true, "amber": true, "red": true,
}

var validStatuses = map[string]bool{
	"active": true, "archived": true, "false_positive": true,
}

// Variable globale pour le moteur de corrélation (initialisée par main.go)
var CorrelationEngineGlobal *correlation.CorrelationEngine

// InitCorrelationEngine initialise le moteur de corrélation global (appelé par main.go)
func InitCorrelationEngine(engine *correlation.CorrelationEngine) {
	CorrelationEngineGlobal = engine
}

func ListIOCs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	f := store.IOCFilter{
		Type:   c.Query("type"),
		Status: c.Query("status"),
		TLP:    c.Query("tlp"),
		Query:  c.Query("q"),
		Page:   page,
		Limit:  limit,
	}
	iocs, total, err := store.ListIOCs(f)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": iocs, "total": total, "page": page, "limit": limit})
}

func GetIOC(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	ioc, err := store.GetIOCByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "IOC non trouve"})
		return
	}
	c.JSON(http.StatusOK, ioc)
}

func CreateIOC(c *gin.Context) {
	var body struct {
		Type        string `json:"type"          binding:"required"`
		Value       string `json:"value"         binding:"required"`
		Source      string `json:"source"`
		TLP         string `json:"tlp"`
		Status      string `json:"status"`
		Tags        string `json:"tags"`
		Notes       string `json:"notes"`
		MitreTechID string `json:"mitre_tech_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	iocType := strings.ToLower(strings.TrimSpace(body.Type))
	if !validIOCTypes[iocType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type invalide (ip|domain|hash|url|email|cidr)"})
		return
	}
	tlp := strings.ToLower(body.TLP)
	if tlp == "" {
		tlp = "white"
	}
	if !validTLPs[tlp] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tlp invalide (white|green|amber|red)"})
		return
	}
	status := strings.ToLower(body.Status)
	if status == "" {
		status = "active"
	}
	if !validStatuses[status] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status invalide (active|archived|false_positive)"})
		return
	}
	ioc := &models.IOC{
		Type:        models.IOCType(iocType),
		Value:       strings.TrimSpace(body.Value),
		Source:      strings.TrimSpace(body.Source),
		TLP:         models.IOCTLP(tlp),
		Status:      models.IOCStatus(status),
		Tags:        body.Tags,
		Notes:       strings.TrimSpace(body.Notes),
		MitreTechID: strings.TrimSpace(body.MitreTechID),
	}
	if err := store.CreateIOC(ioc); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Hook fire-and-forget : analyser la corrélation sans bloquer la réponse
	if CorrelationEngineGlobal != nil {
		go CorrelationEngineGlobal.Analyze(string(ioc.Type), ioc.Value)
	}

	c.JSON(http.StatusCreated, ioc)
}

func UpdateIOC(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	allowed := map[string]bool{
		"type": true, "value": true, "source": true, "tlp": true,
		"status": true, "tags": true, "notes": true, "mitre_tech_id": true,
	}
	updates := make(map[string]interface{})
	for k, v := range body {
		if allowed[k] {
			updates[k] = v
		}
	}
	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "aucun champ valide"})
		return
	}
	ioc, err := store.UpdateIOC(uint(id), updates)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ioc)
}

func DeleteIOC(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}
	if err := store.DeleteIOC(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "IOC supprime"})
}

func GetIOCStats(c *gin.Context) {
	stats, err := store.IOCStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}

func ExportIOCsCSV(c *gin.Context) {
	iocs, _, err := store.ListIOCs(store.IOCFilter{Status: "active", Limit: 10000, Page: 1})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	filename := fmt.Sprintf("ioc-export-%s.csv", time.Now().Format("2006-01-02"))
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.Header("Content-Type", "text/csv; charset=utf-8")
	w := csv.NewWriter(c.Writer)
	c.Writer.Write([]byte("\xef\xbb\xbf"))
	_ = w.Write([]string{"ID", "Type", "Value", "Source", "TLP", "Status", "Tags", "Notes", "MITRE Tech", "Created At"})
	for _, ioc := range iocs {
		_ = w.Write([]string{
			strconv.FormatUint(uint64(ioc.ID), 10),
			string(ioc.Type),
			ioc.Value,
			ioc.Source,
			string(ioc.TLP),
			string(ioc.Status),
			ioc.Tags,
			ioc.Notes,
			ioc.MitreTechID,
			ioc.CreatedAt.Format(time.RFC3339),
		})
	}
	w.Flush()
}

// ImportIOCs importe des IOCs depuis un fichier CSV ou TXT (multipart/form-data)
// POST /api/ioc/import
func ImportIOCs(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "fichier requis"})
		return
	}
	// Sécurité : limiter la taille du fichier à 10 MB
	if file.Size > 10*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "fichier trop grand (max 10MB)"})
		return
	}

	defaultTLP := c.DefaultPostForm("default_tlp", "white")
	defaultStatus := c.DefaultPostForm("default_status", "active")
	defaultSource := c.DefaultPostForm("source", "import")

	f, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer f.Close()

	data, _ := io.ReadAll(f)
	content := string(data)
	lines := strings.Split(strings.ReplaceAll(content, "\r\n", "\n"), "\n")

	imported := 0
	skippedDuplicates := 0
	skippedInvalid := 0
	errs := []string{}
	const maxIOCs = 10000

	isCSV := strings.HasSuffix(strings.ToLower(file.Filename), ".csv")
	if !isCSV && len(lines) > 0 {
		isCSV = strings.Contains(lines[0], ",")
	}

	type iocEntry struct {
		Value  string
		Type   string
		TLP    string
		Status string
		Source string
	}

	var entries []iocEntry
	if isCSV {
		firstLine := ""
		if len(lines) > 0 {
			firstLine = strings.ToLower(lines[0])
		}
		hasHeader := strings.Contains(firstLine, "value") ||
			strings.Contains(firstLine, "ioc") ||
			strings.Contains(firstLine, "type")
		startIdx := 0
		if hasHeader {
			startIdx = 1
		}
		for _, line := range lines[startIdx:] {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}
			cols := strings.Split(line, ",")
			if len(cols) == 0 {
				continue
			}
			value := strings.TrimSpace(strings.Trim(cols[0], "\""))
			if value == "" {
				continue
			}
			iocType := ""
			if len(cols) > 1 {
				iocType = strings.TrimSpace(strings.Trim(cols[1], "\""))
			}
			if iocType == "" {
				iocType = detectIOCType(value)
			}
			entries = append(entries, iocEntry{
				Value:  value,
				Type:   iocType,
				TLP:    defaultTLP,
				Status: defaultStatus,
				Source: defaultSource,
			})
		}
	} else {
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			entries = append(entries, iocEntry{
				Value:  line,
				Type:   detectIOCType(line),
				TLP:    defaultTLP,
				Status: defaultStatus,
				Source: defaultSource,
			})
		}
	}

	if len(entries) > maxIOCs {
		entries = entries[:maxIOCs]
	}

	seen := map[string]struct{}{}
	batch := make([]models.IOC, 0, 100)
	for _, e := range entries {
		if e.Type == "" || e.Type == "unknown" {
			skippedInvalid++
			continue
		}
		if _, ok := seen[e.Value]; ok {
			skippedDuplicates++
			continue
		}
		seen[e.Value] = struct{}{}

		var existing models.IOC
		if store.DB.Where("value = ?", e.Value).First(&existing).Error == nil {
			skippedDuplicates++
			continue
		}

		batch = append(batch, models.IOC{
			Type:   models.IOCType(e.Type),
			Value:  e.Value,
			TLP:    models.IOCTLP(e.TLP),
			Status: models.IOCStatus(e.Status),
			Source: e.Source,
		})
		if len(batch) >= 100 {
			if err := store.DB.CreateInBatches(batch, 100).Error; err != nil {
				errs = append(errs, err.Error())
			} else {
				imported += len(batch)
			}
			batch = batch[:0]
		}
	}
	if len(batch) > 0 {
		if err := store.DB.CreateInBatches(batch, 100).Error; err != nil {
			errs = append(errs, err.Error())
		} else {
			imported += len(batch)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"imported":           imported,
		"skipped_duplicates": skippedDuplicates,
		"skipped_invalid":    skippedInvalid,
		"errors":             errs,
	})
}

func detectIOCType(value string) string {
	ipv4Re := regexp.MustCompile(`^\d{1,3}(\.\d{1,3}){3}$`)
	cidrRe := regexp.MustCompile(`^\d{1,3}(\.\d{1,3}){3}/\d{1,2}$`)
	md5Re := regexp.MustCompile(`^[a-fA-F0-9]{32}$`)
	sha256Re := regexp.MustCompile(`^[a-fA-F0-9]{64}$`)
	emailRe := regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)
	urlRe := regexp.MustCompile(`^https?://`)
	ipv6Re := regexp.MustCompile(`^[0-9a-fA-F:]+:[0-9a-fA-F:]+$`)

	switch {
	case cidrRe.MatchString(value):
		return "cidr"
	case ipv4Re.MatchString(value):
		return "ip"
	case ipv6Re.MatchString(value):
		return "ip"
	case md5Re.MatchString(value):
		return "hash"
	case sha256Re.MatchString(value):
		return "hash"
	case emailRe.MatchString(value):
		return "email"
	case urlRe.MatchString(value):
		return "url"
	default:
		if strings.Contains(value, ".") && !strings.Contains(value, " ") {
			return "domain"
		}
		return "unknown"
	}
}
