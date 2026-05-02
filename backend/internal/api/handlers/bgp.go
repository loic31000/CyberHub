package handlers

// ⚠️ Usage légal uniquement — toutes les requêtes BGPView doivent respecter les CGU de l'API bgpview.io
// Ce module est destiné à des fins éducatives et de veille réseau.

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"github.com/cyber-hub/cyber-hub/internal/store"
	"github.com/gin-gonic/gin"
)

const (
	bgpViewBase    = "https://api.bgpview.io"
	ripeStatBase   = "https://stat.ripe.net"
	cloudflareDoH  = "https://cloudflare-dns.com/dns-query?name=%s&type=A"
	bgpCacheTTL    = 10 * time.Minute // TTL cache SQLite
	bgpHTTPTimeout = 30 * time.Second // Timeout HTTP client BGPView
)

var bgpHTTPClient = &http.Client{
	Timeout: bgpHTTPTimeout,
}

type dohResponse struct {
	Status int `json:"Status"`
	Answer []struct {
		Name string `json:"name"`
		Type int    `json:"type"`
		TTL  int    `json:"TTL"`
		Data string `json:"data"`
	} `json:"Answer"`
}

func isDNSError(err error) bool {
	if err == nil {
		return false
	}
	lower := strings.ToLower(err.Error())
	return strings.Contains(lower, "no such host") || strings.Contains(lower, "lookup") || strings.Contains(lower, "dns")
}

func resolveHostDoH(host string) ([]string, error) {
	reqURL := fmt.Sprintf(cloudflareDoH, url.QueryEscape(host))
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/dns-json")

	resp, err := bgpHTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("DoH DNS: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("DoH DNS HTTP %d", resp.StatusCode)
	}

	var result dohResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("DoH JSON parse: %w", err)
	}

	var ips []string
	for _, ans := range result.Answer {
		if ans.Type == 1 {
			ips = append(ips, ans.Data)
		}
	}
	if len(ips) == 0 {
		return nil, fmt.Errorf("DoH DNS: no A records for %s", host)
	}

	return ips, nil
}

func doHTTPRequest(ctx context.Context, rawURL string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "CyberHub/0.6 (educational tool; legal use only)")
	req.Header.Set("Accept", "application/json")

	resp, err := bgpHTTPClient.Do(req)
	if err == nil {
		return resp, nil
	}
	if !isDNSError(err) {
		return nil, err
	}

	host := req.URL.Hostname()
	port := req.URL.Port()
	if port == "" {
		if req.URL.Scheme == "https" {
			port = "443"
		} else {
			port = "80"
		}
	}

	ips, dohErr := resolveHostDoH(host)
	if dohErr != nil {
		return nil, fmt.Errorf("%w; DoH: %v", err, dohErr)
	}

	dialer := &net.Dialer{Timeout: bgpHTTPTimeout}
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{ServerName: host},
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			return dialer.DialContext(ctx, network, net.JoinHostPort(ips[0], port))
		},
	}
	client := &http.Client{Timeout: bgpHTTPTimeout, Transport: transport}

	req2, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}
	req2.Host = host
	req2.Header.Set("User-Agent", "CyberHub/0.6 (educational tool; legal use only)")
	req2.Header.Set("Accept", "application/json")

	return client.Do(req2)
}

func bgpFetchBGPView(endpoint string) ([]byte, int, error) {
	reqURL := bgpViewBase + endpoint
	resp, err := doHTTPRequest(context.Background(), reqURL)
	if err != nil {
		return nil, 0, fmt.Errorf("erreur réseau BGPView: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("lecture réponse BGPView: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return body, resp.StatusCode, fmt.Errorf("BGPView HTTP %d: %s", resp.StatusCode, string(body))
	}
	return body, http.StatusOK, nil
}

func saveBGPCache(cacheKey string, body []byte, expires time.Time) {
	now := time.Now()
	var existing models.BGPCache
	if findErr := store.DB.Where("cache_key = ?", cacheKey).First(&existing).Error; findErr != nil {
		store.DB.Create(&models.BGPCache{
			CacheKey:  cacheKey,
			Response:  string(body),
			ExpiresAt: expires,
		})
	} else {
		store.DB.Model(&existing).Updates(map[string]interface{}{
			"response":   string(body),
			"expires_at": expires,
			"updated_at": now,
		})
	}
}

func fetchRipeASNInfo(asn string) ([]byte, int, error) {
	url := fmt.Sprintf(ripeStatBase+"/data/as-overview/data.json?resource=AS%s", asn)
	resp, err := doHTTPRequest(context.Background(), url)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	var raw struct {
		Status string `json:"status"`
		Data   struct {
			Asn         int    `json:"asn"`
			Holder      string `json:"holder"`
			Country     string `json:"country"`
			Description string `json:"description"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, 0, fmt.Errorf("parse RIPE Stat ASN info: %w", err)
	}

	payload := map[string]any{
		"status":         "ok",
		"status_message": "Fallback RIPE Stat",
		"data": map[string]any{
			"asn":                raw.Data.Asn,
			"name":               raw.Data.Holder,
			"description_short":  raw.Data.Description,
			"description_full":   []string{raw.Data.Description},
			"country_code":       raw.Data.Country,
			"website":            "",
			"email_contacts":     []string{},
			"abuse_contacts":     []string{},
			"looking_glass":      "",
			"traffic_estimation": "",
			"traffic_ratio":      "",
			"owner_address":      []string{},
			"rir_allocation": map[string]any{
				"rir_name":          "RIPE Stat",
				"country_code":      raw.Data.Country,
				"prefix":            "",
				"prefix_ip":         "",
				"prefix_cidr":       0,
				"allocation_status": "",
			},
			"date_updated": "",
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, 0, err
	}
	return body, http.StatusOK, nil
}

func fetchRipeASNPrefixes(asn string) ([]byte, int, error) {
	url := fmt.Sprintf(ripeStatBase+"/data/announced-prefixes/data.json?resource=AS%s", asn)
	resp, err := doHTTPRequest(context.Background(), url)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	var raw struct {
		Data struct {
			Prefixes []struct {
				Prefix    string `json:"prefix"`
				OriginAS  int    `json:"origin_asn"`
				IpVersion int    `json:"ip_version"`
			} `json:"prefixes"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, 0, fmt.Errorf("parse RIPE Stat ASN prefixes: %w", err)
	}

	ipv4 := make([]map[string]any, 0)
	ipv6 := make([]map[string]any, 0)
	for _, item := range raw.Data.Prefixes {
		entry := map[string]any{
			"prefix":       item.Prefix,
			"ip":           item.Prefix,
			"cidr":         0,
			"name":         "",
			"country_code": "",
			"description":  "",
			"parent": map[string]any{
				"prefix":            "",
				"ip":                "",
				"cidr":              0,
				"rir_name":          "",
				"allocation_status": "",
			},
		}
		if item.IpVersion == 4 {
			ipv4 = append(ipv4, entry)
		} else {
			ipv6 = append(ipv6, entry)
		}
	}

	payload := map[string]any{
		"status":         "ok",
		"status_message": "Fallback RIPE Stat",
		"data": map[string]any{
			"ipv4_prefixes": ipv4,
			"ipv6_prefixes": ipv6,
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, 0, err
	}
	return body, http.StatusOK, nil
}

func fetchRipeIP(ip string) ([]byte, int, error) {
	url := fmt.Sprintf(ripeStatBase+"/data/network-info/data.json?resource=%s", ip)
	resp, err := doHTTPRequest(context.Background(), url)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	var raw struct {
		Data struct {
			Prefix      string `json:"prefix"`
			OriginASN   int    `json:"origin_asn"`
			CountryCode string `json:"country_code"`
			Description string `json:"description"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, 0, fmt.Errorf("parse RIPE Stat IP info: %w", err)
	}

	prefixes := make([]map[string]any, 0)
	if raw.Data.Prefix != "" {
		cidr := 0
		if _, network, parseErr := net.ParseCIDR(raw.Data.Prefix); parseErr == nil {
			cidr, _ = network.Mask.Size()
		}
		prefixes = append(prefixes, map[string]any{
			"prefix": raw.Data.Prefix,
			"ip":     raw.Data.Prefix,
			"cidr":   cidr,
			"asn": map[string]any{
				"asn":          raw.Data.OriginASN,
				"name":         "",
				"description":  "",
				"country_code": "",
			},
			"name":         "",
			"description":  raw.Data.Description,
			"country_code": raw.Data.CountryCode,
			"parent": map[string]any{
				"prefix":            "",
				"ip":                "",
				"cidr":              0,
				"rir_name":          "",
				"allocation_status": "",
			},
		})
	}

	payload := map[string]any{
		"status":         "ok",
		"status_message": "Fallback RIPE Stat",
		"data": map[string]any{
			"ip":         ip,
			"ptr_record": "",
			"prefixes":   prefixes,
			"rir_allocation": map[string]any{
				"rir_name":          "RIPE Stat",
				"country_code":      raw.Data.CountryCode,
				"prefix":            raw.Data.Prefix,
				"prefix_ip":         ip,
				"prefix_cidr":       0,
				"allocation_status": "",
			},
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, 0, err
	}
	return body, http.StatusOK, nil
}

func fetchRipeASNPeers(_ string) ([]byte, int, error) {
	payload := map[string]any{
		"status":         "ok",
		"status_message": "Fallback RIPE Stat — peers non disponibles",
		"data": map[string]any{
			"ipv4_peers": []any{},
			"ipv6_peers": []any{},
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, 0, err
	}
	return body, http.StatusOK, nil
}

func fetchRipeASNUpstreams(_ string) ([]byte, int, error) {
	payload := map[string]any{
		"status":         "ok",
		"status_message": "Fallback RIPE Stat — upstreams non disponibles",
		"data": map[string]any{
			"ipv4_upstreams": []any{},
			"ipv6_upstreams": []any{},
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, 0, err
	}
	return body, http.StatusOK, nil
}

func fetchRipeASNDownstreams(_ string) ([]byte, int, error) {
	payload := map[string]any{
		"status":         "ok",
		"status_message": "Fallback RIPE Stat — downstreams non disponibles",
		"data": map[string]any{
			"ipv4_downstreams": []any{},
			"ipv6_downstreams": []any{},
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, 0, err
	}
	return body, http.StatusOK, nil
}

func fetchRipeSearchFallback(_ string) ([]byte, int, error) {
	payload := map[string]any{
		"status":         "ok",
		"status_message": "Fallback RIPE Stat — recherche non disponible",
		"data": map[string]any{
			"asns":          []any{},
			"ipv4_prefixes": []any{},
			"ipv6_prefixes": []any{},
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, 0, err
	}
	return body, http.StatusOK, nil
}

func fetchRipeFallback(endpoint string) ([]byte, int, error) {
	if strings.HasPrefix(endpoint, "/ip/") {
		ip := strings.TrimPrefix(endpoint, "/ip/")
		return fetchRipeIP(ip)
	}
	if strings.HasPrefix(endpoint, "/asn/") {
		parts := strings.Split(strings.TrimPrefix(endpoint, "/asn/"), "/")
		if len(parts) == 1 {
			return fetchRipeASNInfo(parts[0])
		}
		if len(parts) == 2 {
			switch parts[1] {
			case "prefixes":
				return fetchRipeASNPrefixes(parts[0])
			case "peers":
				return fetchRipeASNPeers(parts[0])
			case "upstreams":
				return fetchRipeASNUpstreams(parts[0])
			case "downstreams":
				return fetchRipeASNDownstreams(parts[0])
			}
		}
	}
	if strings.HasPrefix(endpoint, "/search") {
		return fetchRipeSearchFallback(endpoint)
	}
	return nil, 0, fmt.Errorf("fallback non supporté pour %s", endpoint)
}

func bgpFetch(cacheKey, endpoint string) ([]byte, int, string, error) {
	now := time.Now()
	var cached models.BGPCache
	if err := store.DB.Where("cache_key = ? AND expires_at > ?", cacheKey, now).
		First(&cached).Error; err == nil {
		return []byte(cached.Response), http.StatusOK, "cache", nil
	}

	body, status, err := bgpFetchBGPView(endpoint)
	if err == nil {
		expires := now.Add(bgpCacheTTL)
		saveBGPCache(cacheKey, body, expires)
		return body, status, "bgpview", nil
	}

	shouldFallback := status >= 500 || isDNSError(err) || strings.Contains(strings.ToLower(err.Error()), "timeout")
	if shouldFallback {
		var stale models.BGPCache
		if err2 := store.DB.Where("cache_key = ?", cacheKey).First(&stale).Error; err2 == nil {
			return []byte(stale.Response), http.StatusOK, "cache-stale", nil
		}
		altBody, altStatus, altErr := fetchRipeFallback(endpoint)
		if altErr == nil {
			return altBody, altStatus, "ripe", nil
		}
		return nil, status, "", fmt.Errorf("%w; fallback RIPE Stat: %v", err, altErr)
	}

	return nil, status, "", err
}

func proxyBGP(c *gin.Context, cacheKey, endpoint string) {
	body, status, source, err := bgpFetch(cacheKey, endpoint)
	if err != nil {
		if status == 0 {
			status = http.StatusBadGateway
		}
		message := err.Error()
		lower := strings.ToLower(message)
		if strings.Contains(lower, "no such host") || strings.Contains(lower, "lookup api.bgpview.io") {
			message = "Impossible de joindre BGPView : résolution DNS de api.bgpview.io impossible"
		}
		fmt.Printf("[BGP] proxy erreur pour %s : %s\n", endpoint, message)
		c.JSON(status, gin.H{"error": message})
		return
	}

	c.Header("X-BGP-Source", source)
	if source == "cache-stale" || source == "ripe" {
		c.Header("X-BGP-Status", "degraded")
	} else {
		c.Header("X-BGP-Status", "ok")
	}
	c.Data(status, "application/json; charset=utf-8", body)
}

func probeBGPView() error {
	reqURL := bgpViewBase + "/asn/13335"
	resp, err := doHTTPRequest(context.Background(), reqURL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("BGPView status %d", resp.StatusCode)
	}
	return nil
}

func GetBGPStatus(c *gin.Context) {
	err := probeBGPView()
	available := err == nil
	message := "BGPView disponible"
	if err != nil {
		message = fmt.Sprintf("BGPView indisponible : %v", err)
	}

	var cache models.BGPCache
	cacheAvailable := false
	cacheAgeSeconds := int64(0)
	if dbErr := store.DB.Order("updated_at DESC").First(&cache).Error; dbErr == nil {
		cacheAvailable = true
		cacheAgeSeconds = int64(time.Since(cache.UpdatedAt).Seconds())
	}

	c.JSON(http.StatusOK, gin.H{
		"available":         available,
		"primary":           "BGPView",
		"message":           message,
		"cache_available":   cacheAvailable,
		"cache_age_seconds": cacheAgeSeconds,
	})
}

// ─────────────────────────────────────────────
// Endpoints Proxy (cachés TTL 1h)
// ─────────────────────────────────────────────

// GetBGPASN retourne les infos générales d'un AS
// GET /api/bgp/asn/:asn
func GetBGPASN(c *gin.Context) {
	asn := c.Param("asn")
	proxyBGP(c, fmt.Sprintf("asn:%s:full", asn), "/asn/"+asn)
}

// GetBGPASNPrefixes retourne les préfixes IPv4 et IPv6 d'un AS
// GET /api/bgp/asn/:asn/prefixes
func GetBGPASNPrefixes(c *gin.Context) {
	asn := c.Param("asn")
	proxyBGP(c, fmt.Sprintf("asn:%s:prefixes", asn), "/asn/"+asn+"/prefixes")
}

// GetBGPASNPeers retourne les peers BGP d'un AS
// GET /api/bgp/asn/:asn/peers
func GetBGPASNPeers(c *gin.Context) {
	asn := c.Param("asn")
	proxyBGP(c, fmt.Sprintf("asn:%s:peers", asn), "/asn/"+asn+"/peers")
}

// GetBGPASNUpstreams retourne les upstreams d'un AS
// GET /api/bgp/asn/:asn/upstreams
func GetBGPASNUpstreams(c *gin.Context) {
	asn := c.Param("asn")
	proxyBGP(c, fmt.Sprintf("asn:%s:upstreams", asn), "/asn/"+asn+"/upstreams")
}

// GetBGPASNDownstreams retourne les downstreams d'un AS
// GET /api/bgp/asn/:asn/downstreams
func GetBGPASNDownstreams(c *gin.Context) {
	asn := c.Param("asn")
	proxyBGP(c, fmt.Sprintf("asn:%s:downstreams", asn), "/asn/"+asn+"/downstreams")
}

// GetBGPIP retourne les infos d'une adresse IP (AS parent, préfixe, pays)
// GET /api/bgp/ip/:ip
func GetBGPIP(c *gin.Context) {
	ip := c.Param("ip")
	proxyBGP(c, fmt.Sprintf("ip:%s", ip), "/ip/"+ip)
}

// GetBGPSearch effectue une recherche par nom/description/ASN
// GET /api/bgp/search?q=
func GetBGPSearch(c *gin.Context) {
	q := c.Query("q")
	if q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "paramètre q requis"})
		return
	}
	proxyBGP(c, fmt.Sprintf("search:%s", q), "/search?query_term="+url.QueryEscape(q))
}

// ─────────────────────────────────────────────
// Snapshot parallèle
// ─────────────────────────────────────────────

type fetchResult struct {
	key  string
	data map[string]interface{}
	err  error
}

// PostBGPSnapshot capture un snapshot complet d'un AS en parallèle (5 goroutines).
// Compare avec le snapshot précédent et génère les alertes de changement.
// POST /api/bgp/snapshot/:asn
// ⚠️ Usage légal uniquement
func PostBGPSnapshot(c *gin.Context) {
	asnStr := c.Param("asn")
	asnInt, err := strconv.Atoi(asnStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ASN invalide"})
		return
	}

	type endpoint struct {
		key      string
		cacheKey string
		path     string
	}
	endpoints := []endpoint{
		{"info", fmt.Sprintf("asn:%s:full", asnStr), "/asn/" + asnStr},
		{"prefixes", fmt.Sprintf("asn:%s:prefixes", asnStr), "/asn/" + asnStr + "/prefixes"},
		{"peers", fmt.Sprintf("asn:%s:peers", asnStr), "/asn/" + asnStr + "/peers"},
		{"upstreams", fmt.Sprintf("asn:%s:upstreams", asnStr), "/asn/" + asnStr + "/upstreams"},
		{"downstreams", fmt.Sprintf("asn:%s:downstreams", asnStr), "/asn/" + asnStr + "/downstreams"},
	}

	resultsCh := make(chan fetchResult, len(endpoints))
	var wg sync.WaitGroup

	for _, ep := range endpoints {
		wg.Add(1)
		go func(key, cacheKey, path string) {
			defer wg.Done()
			body, _, _, fetchErr := bgpFetch(cacheKey, path)
			if fetchErr != nil {
				resultsCh <- fetchResult{key: key, err: fetchErr}
				return
			}
			var data map[string]interface{}
			if jsonErr := json.Unmarshal(body, &data); jsonErr != nil {
				resultsCh <- fetchResult{key: key, err: fmt.Errorf("parse JSON %s: %w", key, jsonErr)}
				return
			}
			resultsCh <- fetchResult{key: key, data: data}
		}(ep.key, ep.cacheKey, ep.path)
	}

	wg.Wait()
	close(resultsCh)

	combined := make(map[string]interface{})
	for r := range resultsCh {
		if r.err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("erreur récupération '%s': %v", r.key, r.err)})
			return
		}
		combined[r.key] = r.data
	}

	fullJSON, err := json.Marshal(combined)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "sérialisation snapshot"})
		return
	}

	now := time.Now()
	snapshot := models.BGPSnapshot{
		ASN:          asnInt,
		SnapshotDate: now,
		FullDataJSON: string(fullJSON),
		TakenBy:      "local",
	}
	if err := store.DB.Create(&snapshot).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "création snapshot: " + err.Error()})
		return
	}

	// Comparer avec le snapshot précédent (s'il existe)
	var prevSnapshot models.BGPSnapshot
	var alerts []models.BGPAlert
	if err := store.DB.Where("asn = ? AND id < ?", asnInt, snapshot.ID).
		Order("id DESC").First(&prevSnapshot).Error; err == nil {
		alerts = compareBGPSnapshots(asnInt, prevSnapshot.FullDataJSON, string(fullJSON), now)
		for i := range alerts {
			store.DB.Create(&alerts[i])
		}
	}

	c.JSON(http.StatusCreated, gin.H{
		"snapshot": snapshot,
		"alerts":   alerts,
	})
}

// ─────────────────────────────────────────────
// Comparaison de snapshots — détection de changements
// ─────────────────────────────────────────────

type sectionComparison struct {
	alertType string
	topKey    string
	subPaths  [][]string
}

var bgpSectionComparisons = []sectionComparison{
	{
		alertType: "prefix_change",
		topKey:    "prefixes",
		subPaths: [][]string{
			{"prefixes", "data", "ipv4_prefixes"},
			{"prefixes", "data", "ipv6_prefixes"},
		},
	},
	{
		alertType: "peer_change",
		topKey:    "peers",
		subPaths: [][]string{
			{"peers", "data", "ipv4_peers"},
			{"peers", "data", "ipv6_peers"},
		},
	},
	{
		alertType: "upstream_change",
		topKey:    "upstreams",
		subPaths: [][]string{
			{"upstreams", "data", "ipv4_upstreams"},
			{"upstreams", "data", "ipv6_upstreams"},
		},
	},
	{
		alertType: "downstream_change",
		topKey:    "downstreams",
		subPaths: [][]string{
			{"downstreams", "data", "ipv4_downstreams"},
			{"downstreams", "data", "ipv6_downstreams"},
		},
	},
}

// compareBGPSnapshots compare deux JSON de snapshots et retourne les alertes à créer.
// Les slices sont normalisées (triées) avant comparaison pour éviter les faux positifs d'ordre.
func compareBGPSnapshots(asn int, oldJSON, newJSON string, detectedAt time.Time) []models.BGPAlert {
	var oldData, newData map[string]interface{}
	if err := json.Unmarshal([]byte(oldJSON), &oldData); err != nil {
		return nil
	}
	if err := json.Unmarshal([]byte(newJSON), &newData); err != nil {
		return nil
	}

	var alerts []models.BGPAlert

	for _, section := range bgpSectionComparisons {
		changed := false
		for _, path := range section.subPaths {
			oldSlice := extractNestedSlice(oldData, path)
			newSlice := extractNestedSlice(newData, path)
			if normalizeJSONSlice(oldSlice) != normalizeJSONSlice(newSlice) {
				changed = true
				break
			}
		}
		if !changed {
			continue
		}

		// Stocker la section entière (ipv4 + ipv6 combinés) dans old/new value
		oldSection := extractNestedValue(oldData, section.topKey)
		newSection := extractNestedValue(newData, section.topKey)
		oldVal, _ := json.Marshal(oldSection)
		newVal, _ := json.Marshal(newSection)

		alerts = append(alerts, models.BGPAlert{
			ASN:          asn,
			AlertType:    section.alertType,
			OldValue:     string(oldVal),
			NewValue:     string(newVal),
			DetectedAt:   detectedAt,
			Acknowledged: false,
		})
	}

	return alerts
}

// extractNestedSlice extrait un []interface{} en suivant un chemin de clés dans un map imbriqué
func extractNestedSlice(data map[string]interface{}, path []string) []interface{} {
	current := interface{}(data)
	for _, key := range path {
		m, ok := current.(map[string]interface{})
		if !ok {
			return nil
		}
		current = m[key]
	}
	slice, _ := current.([]interface{})
	return slice
}

// extractNestedValue extrait une valeur (n'importe quel type) à une clé de premier niveau
func extractNestedValue(data map[string]interface{}, key string) interface{} {
	if data == nil {
		return nil
	}
	return data[key]
}

// normalizeJSONSlice normalise un slice en triant ses éléments par leur représentation JSON
// pour rendre la comparaison indépendante de l'ordre
func normalizeJSONSlice(slice []interface{}) string {
	if len(slice) == 0 {
		return "[]"
	}
	strs := make([]string, 0, len(slice))
	for _, item := range slice {
		b, _ := json.Marshal(item)
		strs = append(strs, string(b))
	}
	sort.Strings(strs)
	b, _ := json.Marshal(strs)
	return string(b)
}

// diffSlices retourne les éléments ajoutés et supprimés entre deux slices
func diffSlices(oldSlice, newSlice []interface{}) (added, removed []interface{}) {
	oldSet := make(map[string]struct{}, len(oldSlice))
	newSet := make(map[string]struct{}, len(newSlice))

	for _, item := range oldSlice {
		b, _ := json.Marshal(item)
		oldSet[string(b)] = struct{}{}
	}
	for _, item := range newSlice {
		b, _ := json.Marshal(item)
		newSet[string(b)] = struct{}{}
	}
	for _, item := range newSlice {
		b, _ := json.Marshal(item)
		if _, ok := oldSet[string(b)]; !ok {
			added = append(added, item)
		}
	}
	for _, item := range oldSlice {
		b, _ := json.Marshal(item)
		if _, ok := newSet[string(b)]; !ok {
			removed = append(removed, item)
		}
	}
	return
}

// ─────────────────────────────────────────────
// Endpoints Historian
// ─────────────────────────────────────────────

// SnapshotSummary représente un snapshot sans le FullDataJSON (pour les listes)
type SnapshotSummary struct {
	ID           uint      `json:"id"`
	CreatedAt    time.Time `json:"created_at"`
	ASN          int       `json:"asn"`
	SnapshotDate time.Time `json:"snapshot_date"`
	TakenBy      string    `json:"taken_by"`
}

// GetBGPSnapshots retourne la liste paginée des snapshots pour un AS (du plus récent au plus ancien)
// GET /api/bgp/snapshots/:asn?limit=50&offset=0
func GetBGPSnapshots(c *gin.Context) {
	asnStr := c.Param("asn")
	asnInt, err := strconv.Atoi(asnStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ASN invalide"})
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	var total int64
	store.DB.Model(&models.BGPSnapshot{}).Where("asn = ?", asnInt).Count(&total)

	var snapshots []models.BGPSnapshot
	store.DB.Where("asn = ?", asnInt).
		Order("created_at DESC").
		Limit(limit).Offset(offset).
		Find(&snapshots)

	// Ne pas retourner FullDataJSON dans la liste (données volumineuses)
	summaries := make([]SnapshotSummary, len(snapshots))
	for i, s := range snapshots {
		summaries[i] = SnapshotSummary{
			ID:           s.ID,
			CreatedAt:    s.CreatedAt,
			ASN:          s.ASN,
			SnapshotDate: s.SnapshotDate,
			TakenBy:      s.TakenBy,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"items":  summaries,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// GetBGPSnapshotDiff compare deux snapshots et retourne un diff structuré.
// GET /api/bgp/snapshots/:asn/diff?older=ID&newer=ID
// Si older absent : compare le dernier avec l'avant-dernier
func GetBGPSnapshotDiff(c *gin.Context) {
	asnStr := c.Param("asn")
	asnInt, err := strconv.Atoi(asnStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ASN invalide"})
		return
	}

	var olderSnap, newerSnap models.BGPSnapshot

	olderIDStr := c.Query("older")
	newerIDStr := c.Query("newer")

	if olderIDStr == "" {
		// Comparer le plus récent avec l'avant-dernier
		var snapshots []models.BGPSnapshot
		if err := store.DB.Where("asn = ?", asnInt).
			Order("created_at DESC").Limit(2).Find(&snapshots).Error; err != nil || len(snapshots) < 2 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Pas assez de snapshots pour comparer (minimum 2)"})
			return
		}
		newerSnap = snapshots[0]
		olderSnap = snapshots[1]
	} else {
		olderID, _ := strconv.ParseUint(olderIDStr, 10, 64)
		newerID, _ := strconv.ParseUint(newerIDStr, 10, 64)
		if err := store.DB.First(&olderSnap, olderID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Snapshot 'older' non trouvé"})
			return
		}
		if err := store.DB.First(&newerSnap, newerID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Snapshot 'newer' non trouvé"})
			return
		}
	}

	diff := buildSnapshotDiff(olderSnap.FullDataJSON, newerSnap.FullDataJSON)

	c.JSON(http.StatusOK, gin.H{
		"older": gin.H{"id": olderSnap.ID, "created_at": olderSnap.CreatedAt, "asn": olderSnap.ASN},
		"newer": gin.H{"id": newerSnap.ID, "created_at": newerSnap.CreatedAt, "asn": newerSnap.ASN},
		"diff":  diff,
	})
}

// buildSnapshotDiff construit un diff structuré entre deux snapshots JSON complets
func buildSnapshotDiff(oldJSON, newJSON string) map[string]interface{} {
	var oldData, newData map[string]interface{}
	json.Unmarshal([]byte(oldJSON), &oldData) //nolint:errcheck
	json.Unmarshal([]byte(newJSON), &newData) //nolint:errcheck

	changedFields := []string{}
	changes := make(map[string]interface{})

	for _, section := range bgpSectionComparisons {
		sectionChanges := make(map[string]interface{})
		hasChange := false

		for _, path := range section.subPaths {
			fieldName := path[len(path)-1]
			oldSlice := extractNestedSlice(oldData, path)
			newSlice := extractNestedSlice(newData, path)

			if normalizeJSONSlice(oldSlice) != normalizeJSONSlice(newSlice) {
				hasChange = true
				added, removed := diffSlices(oldSlice, newSlice)
				sectionChanges[fieldName] = map[string]interface{}{
					"old":     oldSlice,
					"new":     newSlice,
					"added":   added,
					"removed": removed,
				}
			}
		}

		if hasChange {
			changedFields = append(changedFields, section.alertType)
			changes[section.topKey] = sectionChanges
		}
	}

	return map[string]interface{}{
		"changed_fields": changedFields,
		"changes":        changes,
	}
}

// ─────────────────────────────────────────────
// Alertes
// ─────────────────────────────────────────────

// GetBGPAlerts retourne les alertes non acquittées (paginées)
// GET /api/bgp/alerts?limit=100&offset=0
func GetBGPAlerts(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit <= 0 || limit > 500 {
		limit = 100
	}

	var alerts []models.BGPAlert
	var total int64

	store.DB.Model(&models.BGPAlert{}).Where("acknowledged = ?", false).Count(&total)
	store.DB.Where("acknowledged = ?", false).
		Order("created_at DESC").
		Limit(limit).Offset(offset).
		Find(&alerts)

	c.JSON(http.StatusOK, gin.H{
		"items":  alerts,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// AckBGPAlert acquitte une alerte (Acknowledged = true)
// PATCH /api/bgp/alerts/:id/ack
func AckBGPAlert(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id invalide"})
		return
	}

	result := store.DB.Model(&models.BGPAlert{}).
		Where("id = ?", id).
		Update("acknowledged", true)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "alerte non trouvée"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "alerte acquittée", "id": id})
}

// ─────────────────────────────────────────────
// Export IOC depuis un préfixe CIDR
// ─────────────────────────────────────────────

// PostBGPExportIOC exporte un préfixe réseau en IOC de type "cidr"
// POST /api/bgp/export-ioc
// Body: { "type": "cidr", "value": "1.2.3.0/24", "asn": 13335, "description": "suspect prefix" }
// ⚠️ Usage légal uniquement — vérifier que le préfixe est effectivement malveillant avant export
func PostBGPExportIOC(c *gin.Context) {
	var body struct {
		Type        string `json:"type"        binding:"required"`
		Value       string `json:"value"       binding:"required"`
		ASN         int    `json:"asn"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// ⚠️ Validation : seul "cidr" est accepté pour cet endpoint
	if body.Type != "cidr" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type doit être 'cidr' pour l'export BGP"})
		return
	}
	if body.Value == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "value (préfixe CIDR) requis"})
		return
	}

	notes := body.Description
	if body.ASN > 0 {
		notes = fmt.Sprintf("%s | ASN: %d", body.Description, body.ASN)
	}

	ioc := &models.IOC{
		Type:   models.IOCTypeCIDR,
		Value:  body.Value,
		Source: fmt.Sprintf("BGP Lookup — AS%d", body.ASN),
		TLP:    models.TLPWhite,
		Status: models.IOCStatusActive,
		Notes:  notes,
	}

	if err := store.CreateIOC(ioc); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "création IOC: " + err.Error()})
		return
	}
	c.JSON(http.StatusCreated, ioc)
}
