package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/cyber-hub/cyber-hub/internal/store"
	"github.com/gin-gonic/gin"
)

type feedLog struct {
	FeedName    string `json:"feed_name"`
	Status      string `json:"status"`
	CvesAdded   int    `json:"cves_added"`
	CvesUpdated int    `json:"cves_updated"`
	LastRun     string `json:"last_run"`
	NextRun     string `json:"next_run"`
	ErrorMsg    string `json:"error_msg"`
}

func readFeedSetting(key string) string {
	var s models.AppSetting
	store.DB.Where("key = ?", key).First(&s)
	return s.Value
}

// GetThreatFeeds retourne l'état des feeds CVE (cisa_kev + nvd_api).
// GET /threat/feeds
func GetThreatFeeds(c *gin.Context) {
	feeds := make([]feedLog, 0, 2)
	for _, name := range []string{"cisa_kev", "nvd_api"} {
		f := feedLog{FeedName: name, Status: "pending"}
		if lastRun := readFeedSetting("tf_" + name + "_last_run"); lastRun != "" {
			f.LastRun = lastRun
			f.Status = "ok"
		}
		if errMsg := readFeedSetting("tf_" + name + "_error"); errMsg != "" {
			f.ErrorMsg = errMsg
			f.Status = "error"
		}
		added, _ := strconv.Atoi(readFeedSetting("tf_" + name + "_cves_added"))
		updated, _ := strconv.Atoi(readFeedSetting("tf_" + name + "_cves_updated"))
		f.CvesAdded = added
		f.CvesUpdated = updated
		feeds = append(feeds, f)
	}
	c.JSON(http.StatusOK, feeds)
}

// GetThreatAlerts retourne les CVE critiques (CVSS ≥ 9.0) des 7 derniers jours.
// GET /threat/alerts
func GetThreatAlerts(c *gin.Context) {
	since := time.Now().AddDate(0, 0, -7)
	var cves []models.CVEEntry
	store.DB.Where("cvss_score >= 9.0 AND published_at >= ?", since).
		Order("cvss_score DESC").
		Limit(20).
		Find(&cves)
	c.JSON(http.StatusOK, gin.H{
		"alerts": cves,
		"count":  len(cves),
		"since":  since.Format(time.RFC3339),
	})
}

// RunThreatFeed déclenche un feed CVE par son nom (cisa_kev ou nvd_api).
// POST /threat/run/:name
func RunThreatFeed(c *gin.Context) {
	name := c.Param("name")
	switch name {
	case "cisa_kev":
		NewCISAHandler(store.DB).UpdateKEV(c)
		if c.Writer.Status() == http.StatusOK {
			upsertSetting("tf_cisa_kev_last_run", time.Now().Format(time.RFC3339))
			upsertSetting("tf_cisa_kev_error", "")
		} else {
			upsertSetting("tf_cisa_kev_error", "Erreur lors de la mise à jour KEV")
		}

	case "nvd_api":
		end := time.Now().UTC()
		start := end.AddDate(0, 0, -7)
		req := models.NVDOnlineRequest{
			PubStartDate:   start.Format("2006-01-02T15:04:05.000Z"),
			PubEndDate:     end.Format("2006-01-02T15:04:05.000Z"),
			ResultsPerPage: 500,
			Page:           1,
		}
		nvdResp, err := store.FetchNVDOnline(req)
		if err != nil {
			upsertSetting("tf_nvd_api_error", err.Error())
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		created, skipped, _ := store.ImportNVD(nvdResp.Vulnerabilities)
		upsertSetting("tf_nvd_api_last_run", time.Now().Format(time.RFC3339))
		upsertSetting("tf_nvd_api_cves_added", fmt.Sprintf("%d", created))
		upsertSetting("tf_nvd_api_cves_updated", fmt.Sprintf("%d", skipped))
		upsertSetting("tf_nvd_api_error", "")
		c.JSON(http.StatusOK, gin.H{"created": created, "skipped": skipped})

	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "feed inconnu: " + name})
	}
}
