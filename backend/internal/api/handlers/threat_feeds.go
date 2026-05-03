package handlers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/cyber-hub/cyber-hub/internal/store"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ThreatFeedsHandler struct {
	db *gorm.DB
}

func NewThreatFeedsHandler(db *gorm.DB) *ThreatFeedsHandler {
	return &ThreatFeedsHandler{db: db}
}

func (h *ThreatFeedsHandler) GetStatus(c *gin.Context) {
	var feeds []models.ThreatFeedSync
	h.db.Find(&feeds)
	result := map[string]interface{}{}
	for _, f := range feeds {
		result[f.FeedName] = f
	}
	c.JSON(http.StatusOK, result)
}

func (h *ThreatFeedsHandler) SyncFeodo(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet,
		"https://feodotracker.abuse.ch/downloads/ipblocklist.json", nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var feed struct {
		Blocklist []struct {
			IPAddress string `json:"ip_address"`
			Port      int    `json:"port"`
			Status    string `json:"status"`
			Hostname  string `json:"hostname"`
			ASNumber  int    `json:"as_number"`
			ASName    string `json:"as_name"`
			Country   string `json:"country"`
			Malware   string `json:"malware"`
			FirstSeen string `json:"first_seen"`
		} `json:"blocklist"`
	}
	if err2 := json.Unmarshal(body, &feed); err2 != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err2.Error()})
		return
	}

	newIOCs := 0
	skipped := 0
	for _, item := range feed.Blocklist {
		if item.IPAddress == "" {
			continue
		}
		var existing models.IOC
		if store.DB.Where("value = ?", item.IPAddress).First(&existing).Error == nil {
			skipped++
			continue
		}
		tagsJSON, _ := json.Marshal([]string{"C2", item.Malware, "feodo-tracker"})
		notes := "C2 " + item.Malware
		if item.ASNumber != 0 {
			notes += " — AS" + itoa(item.ASNumber) + " (" + item.ASName + ") · " + item.Country
		}
		ioc := models.IOC{
			Type:   models.IOCTypeIP,
			Value:  item.IPAddress,
			TLP:    models.TLPAmber,
			Status: models.IOCStatusActive,
			Source: "Feodo Tracker",
			Notes:  notes,
			Tags:   string(tagsJSON),
		}
		if store.DB.Create(&ioc).Error == nil {
			newIOCs++
		}
	}

	now := time.Now()
	syncRecord := models.ThreatFeedSync{
		FeedName:  "feodo",
		LastSync:  now,
		ItemCount: len(feed.Blocklist),
		NewItems:  newIOCs,
	}
	h.db.Where("feed_name = ?", "feodo").Delete(&models.ThreatFeedSync{})
	h.db.Create(&syncRecord)

	c.JSON(http.StatusOK, gin.H{
		"new_iocs":           newIOCs,
		"skipped_duplicates": skipped,
		"total_in_feed":      len(feed.Blocklist),
	})
}

func (h *ThreatFeedsHandler) SyncURLhaus(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet,
		"https://urlhaus-api.abuse.ch/v1/urls/recent/", nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var feed struct {
		URLs []struct {
			URL        string   `json:"url"`
			URLStatus  string   `json:"url_status"`
			DateAdded  string   `json:"date_added"`
			Threat     string   `json:"threat"`
			Tags       []string `json:"tags"`
			URLhausRef string   `json:"urlhaus_reference"`
		} `json:"urls"`
	}
	if err2 := json.Unmarshal(body, &feed); err2 != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err2.Error()})
		return
	}

	newIOCs := 0
	skipped := 0
	totalOnline := 0
	for _, item := range feed.URLs {
		if item.URLStatus != "online" {
			continue
		}
		totalOnline++
		var existing models.IOC
		if store.DB.Where("value = ?", item.URL).First(&existing).Error == nil {
			skipped++
			continue
		}
		allTags := append(item.Tags, "urlhaus", "malware-distribution")
		tagsJSON, _ := json.Marshal(allTags)
		ioc := models.IOC{
			Type:   models.IOCTypeURL,
			Value:  item.URL,
			TLP:    models.TLPRed,
			Status: models.IOCStatusActive,
			Source: "URLhaus",
			Notes:  item.Threat + " — URLhaus",
			Tags:   string(tagsJSON),
		}
		if store.DB.Create(&ioc).Error == nil {
			newIOCs++
		}
	}

	now := time.Now()
	syncRecord := models.ThreatFeedSync{
		FeedName:  "urlhaus",
		LastSync:  now,
		ItemCount: totalOnline,
		NewItems:  newIOCs,
	}
	h.db.Where("feed_name = ?", "urlhaus").Delete(&models.ThreatFeedSync{})
	h.db.Create(&syncRecord)

	c.JSON(http.StatusOK, gin.H{
		"new_iocs":           newIOCs,
		"skipped_duplicates": skipped,
		"total_online":       totalOnline,
	})
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	result := ""
	neg := n < 0
	if neg {
		n = -n
	}
	for n > 0 {
		result = string(rune('0'+n%10)) + result
		n /= 10
	}
	if neg {
		result = "-" + result
	}
	return result
}
