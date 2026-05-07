package handlers

// ⚠️ Usage légal uniquement — toutes les requêtes sont destinées à des fins éducatives et de veille réseau.

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
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
	ripeStatBase   = "https://stat.ripe.net"
	cloudflareDoH  = "https://cloudflare-dns.com/dns-query?name=%s&type=A"
	bgpCacheTTL    = 10 * time.Minute
	bgpHTTPTimeout = 30 * time.Second
)

var bgpHTTPClient = &http.Client{
	Timeout: bgpHTTPTimeout,
}

// ─────────────────────────────────────────────
// DNS / HTTP helpers (inchangés)
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// Cache SQLite
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// RIPE Stat — source primaire
// ─────────────────────────────────────────────

func fetchRipeASNInfo(asn string) ([]byte, int, error) {
	reqURL := fmt.Sprintf(ripeStatBase+"/data/as-overview/data.json?resource=AS%s", asn)
	resp, err := doHTTPRequest(context.Background(), reqURL)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	var raw struct {
		Status string `json:"status"`
		Data   struct {
			Holder      string `json:"holder"`
			Country     string `json:"country"`
			Description string `json:"description"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, 0, fmt.Errorf("parse RIPE Stat ASN info: %w", err)
	}

	// Parser l'ASN depuis le paramètre string (RIPE ne le retourne pas dans la réponse)
	asnInt, _ := strconv.Atoi(asn)

	description := raw.Data.Description
	if description == "" {
		description = raw.Data.Holder
	}

	payload := map[string]any{
		"status":         "ok",
		"status_message": "RIPE Stat",
		"data": map[string]any{
			"asn":                asnInt,
			"name":               raw.Data.Holder,
			"description_short":  description,
			"description_full":   []string{description},
			"country_code":       raw.Data.Country,
			"website":            "",
			"email_contacts":     []string{},
			"abuse_contacts":     []string{},
			"looking_glass":      nil,
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
	reqURL := fmt.Sprintf(ripeStatBase+"/data/announced-prefixes/data.json?resource=AS%s", asn)
	resp, err := doHTTPRequest(context.Background(), reqURL)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	var raw struct {
		Data struct {
			Prefixes []struct {
				Prefix string `json:"prefix"`
			} `json:"prefixes"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, 0, fmt.Errorf("parse RIPE Stat ASN prefixes: %w", err)
	}

	ipv4 := make([]map[string]any, 0)
	ipv6 := make([]map[string]any, 0)

	for _, item := range raw.Data.Prefixes {
		// Extraire le CIDR depuis le préfixe (ex: "1.2.3.0/24" → 24)
		cidr := 0
		if _, network, parseErr := net.ParseCIDR(item.Prefix); parseErr == nil {
			cidr, _ = network.Mask.Size()
		} else if parts := strings.Split(item.Prefix, "/"); len(parts) == 2 {
			cidr, _ = strconv.Atoi(parts[1])
		}

		entry := map[string]any{
			"prefix":       item.Prefix,
			"ip":           item.Prefix,
			"cidr":         cidr,
			"name":         "",
			"country_code": "",
			"description":  "",
			"parent": map[string]any{
				"prefix": "", "ip": "", "cidr": 0,
				"rir_name": "", "allocation_status": "",
			},
		}

		// Détecter IPv4 vs IPv6 via le préfixe lui-même
		ip, _, _ := net.ParseCIDR(item.Prefix)
		if ip != nil && ip.To4() != nil {
			ipv4 = append(ipv4, entry)
		} else {
			ipv6 = append(ipv6, entry)
		}
	}

	payload := map[string]any{
		"status":         "ok",
		"status_message": "RIPE Stat",
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

func fetchRipeASNPeers(asn string) ([]byte, int, error) {
	reqURL := fmt.Sprintf(ripeStatBase+"/data/asn-neighbours/data.json?resource=AS%s", asn)
	resp, err := doHTTPRequest(context.Background(), reqURL)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	var raw struct {
		Data struct {
			Neighbours []struct {
				ASN     int    `json:"asn"`
				Type    string `json:"type"` // "left", "right", "uncertain"
				Power   int    `json:"power"`
				V4Peers int    `json:"v4_peers"`
				V6Peers int    `json:"v6_peers"`
			} `json:"neighbours"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, 0, fmt.Errorf("parse RIPE Stat ASN peers: %w", err)
	}

	ipv4Peers := make([]map[string]any, 0)
	ipv6Peers := make([]map[string]any, 0)
	for _, n := range raw.Data.Neighbours {
		entry := map[string]any{
			"asn":          n.ASN,
			"name":         fmt.Sprintf("AS%d", n.ASN),
			"description":  "",
			"country_code": "",
		}
		if n.V4Peers > 0 {
			ipv4Peers = append(ipv4Peers, entry)
		}
		if n.V6Peers > 0 {
			ipv6Peers = append(ipv6Peers, entry)
		}
		if n.V4Peers == 0 && n.V6Peers == 0 {
			ipv4Peers = append(ipv4Peers, entry)
		}
	}

	payload := map[string]any{
		"status":         "ok",
		"status_message": "RIPE Stat",
		"data": map[string]any{
			"ipv4_peers": ipv4Peers,
			"ipv6_peers": ipv6Peers,
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, 0, err
	}
	return body, http.StatusOK, nil
}

func fetchRipeASNUpstreams(asn string) ([]byte, int, error) {
	reqURL := fmt.Sprintf(ripeStatBase+"/data/asn-neighbours/data.json?resource=AS%s", asn)
	resp, err := doHTTPRequest(context.Background(), reqURL)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	var raw struct {
		Data struct {
			Neighbours []struct {
				ASN  int    `json:"asn"`
				Type string `json:"type"`
			} `json:"neighbours"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, 0, fmt.Errorf("parse RIPE Stat upstreams: %w", err)
	}

	upstreams := make([]map[string]any, 0)
	for _, n := range raw.Data.Neighbours {
		// "left" = upstream dans la terminologie RIPE
		if n.Type == "left" {
			upstreams = append(upstreams, map[string]any{
				"asn":          n.ASN,
				"name":         fmt.Sprintf("AS%d", n.ASN),
				"description":  "",
				"country_code": "",
			})
		}
	}

	payload := map[string]any{
		"status":         "ok",
		"status_message": "RIPE Stat",
		"data": map[string]any{
			"ipv4_upstreams": upstreams,
			"ipv6_upstreams": []any{},
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, 0, err
	}
	return body, http.StatusOK, nil
}

func fetchRipeASNDownstreams(asn string) ([]byte, int, error) {
	reqURL := fmt.Sprintf(ripeStatBase+"/data/asn-neighbours/data.json?resource=AS%s", asn)
	resp, err := doHTTPRequest(context.Background(), reqURL)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	var raw struct {
		Data struct {
			Neighbours []struct {
				ASN  int    `json:"asn"`
				Type string `json:"type"`
			} `json:"neighbours"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, 0, fmt.Errorf("parse RIPE Stat downstreams: %w", err)
	}

	downstreams := make([]map[string]any, 0)
	for _, n := range raw.Data.Neighbours {
		// "right" = downstream dans la terminologie RIPE
		if n.Type == "right" {
			downstreams = append(downstreams, map[string]any{
				"asn":          n.ASN,
				"name":         fmt.Sprintf("AS%d", n.ASN),
				"description":  "",
				"country_code": "",
			})
		}
	}

	payload := map[string]any{
		"status":         "ok",
		"status_message": "RIPE Stat",
		"data": map[string]any{
			"ipv4_downstreams": downstreams,
			"ipv6_downstreams": []any{},
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, 0, err
	}
	return body, http.StatusOK, nil
}

func fetchRipeIP(ip string) ([]byte, int, error) {
	// 1. network-info pour prefix + ASN
	reqURL := fmt.Sprintf(ripeStatBase+"/data/network-info/data.json?resource=%s", ip)
	resp, err := doHTTPRequest(context.Background(), reqURL)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	var raw struct {
		Data struct {
			Prefix string            `json:"prefix"`
			Asns   []json.RawMessage `json:"asns"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, 0, fmt.Errorf("parse RIPE Stat IP info: %w", err)
	}

	// Si RIPE ne retourne pas de prefix pour cette IP (adresse réseau, etc.)
	// on construit quand même une réponse valide avec les données disponibles
	prefixes := make([]map[string]any, 0)
	if raw.Data.Prefix != "" {
		cidr := 0
		if _, network, parseErr := net.ParseCIDR(raw.Data.Prefix); parseErr == nil {
			cidr, _ = network.Mask.Size()
		} else if parts := strings.Split(raw.Data.Prefix, "/"); len(parts) == 2 {
			cidr, _ = strconv.Atoi(parts[1])
		}

		originASN := 0
		if len(raw.Data.Asns) > 0 {
			asnStr := strings.Trim(string(raw.Data.Asns[0]), `"`)
			originASN, _ = strconv.Atoi(asnStr)
		}

		prefixes = append(prefixes, map[string]any{
			"prefix": raw.Data.Prefix,
			"ip":     ip,
			"cidr":   cidr,
			"asn": map[string]any{
				"asn":          originASN,
				"name":         fmt.Sprintf("AS%d", originASN),
				"description":  "",
				"country_code": "",
			},
			"name":         "",
			"description":  "",
			"country_code": "",
			"parent": map[string]any{
				"prefix": "", "ip": "", "cidr": 0,
				"rir_name": "", "allocation_status": "",
			},
		})
	}

	payload := map[string]any{
		"status":         "ok",
		"status_message": "RIPE Stat",
		"data": map[string]any{
			"ip":         ip,
			"ptr_record": "",
			"prefixes":   prefixes,
			"rir_allocation": map[string]any{
				"rir_name":          "RIPE Stat",
				"country_code":      "",
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

func fetchRipeSearch(q string) ([]byte, int, error) {
	reqURL := fmt.Sprintf(ripeStatBase+"/data/searchcomplete/data.json?resource=%s", url.QueryEscape(q))
	resp, err := doHTTPRequest(context.Background(), reqURL)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	var raw struct {
		Data struct {
			Suggestions []struct {
				Value string `json:"value"`
				Label string `json:"label"`
				Type  string `json:"type"`
			} `json:"suggestions"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, 0, fmt.Errorf("parse RIPE search: %w", err)
	}

	asns := make([]map[string]any, 0)
	for _, s := range raw.Data.Suggestions {
		if s.Type == "asn" || strings.HasPrefix(strings.ToLower(s.Value), "as") {
			asnStr := strings.TrimPrefix(strings.ToUpper(s.Value), "AS")
			asnInt, _ := strconv.Atoi(asnStr)
			if asnInt > 0 {
				asns = append(asns, map[string]any{
					"asn":          asnInt,
					"name":         s.Label,
					"description":  s.Label,
					"country_code": "",
					"email":        "",
					"rir_name":     "RIPE Stat",
				})
			}
		}
	}

	payload := map[string]any{
		"status":         "ok",
		"status_message": "RIPE Stat",
		"data": map[string]any{
			"asns":          asns,
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

// ─────────────────────────────────────────────
// Routeur principal fetch → cache → RIPE Stat
// ─────────────────────────────────────────────

func bgpFetchRipe(endpoint string, queryParam ...string) ([]byte, int, error) {
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
		q := ""
		if len(queryParam) > 0 {
			q = queryParam[0]
		}
		return fetchRipeSearch(q)
	}
	return nil, 0, fmt.Errorf("endpoint non supporté : %s", endpoint)
}

func bgpFetch(cacheKey, endpoint string, queryParam ...string) ([]byte, int, string, error) {
	now := time.Now()

	// 1. Cache valide
	var cached models.BGPCache
	if err := store.DB.Where("cache_key = ? AND expires_at > ?", cacheKey, now).
		First(&cached).Error; err == nil {
		return []byte(cached.Response), http.StatusOK, "cache", nil
	}

	// 2. RIPE Stat (source primaire)
	body, status, err := bgpFetchRipe(endpoint, queryParam...)
	if err == nil {
		expires := now.Add(bgpCacheTTL)
		saveBGPCache(cacheKey, body, expires)
		return body, status, "ripe", nil
	}

	// 3. Cache périmé (stale) si RIPE échoue
	var stale models.BGPCache
	if err2 := store.DB.Where("cache_key = ?", cacheKey).First(&stale).Error; err2 == nil {
		return []byte(stale.Response), http.StatusOK, "cache-stale", nil
	}

	return nil, status, "", fmt.Errorf("RIPE Stat indisponible: %w", err)
}

func proxyBGP(c *gin.Context, cacheKey, endpoint string, queryParam ...string) {
	body, status, source, err := bgpFetch(cacheKey, endpoint, queryParam...)
	if err != nil {
		if status == 0 {
			status = http.StatusBadGateway
		}
		fmt.Printf("[BGP] erreur pour %s : %s\n", endpoint, err.Error())
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.Header("X-BGP-Source", source)
	if source == "cache-stale" {
		c.Header("X-BGP-Status", "degraded")
	} else {
		c.Header("X-BGP-Status", "ok")
	}
	c.Data(status, "application/json; charset=utf-8", body)
}

// ─────────────────────────────────────────────
// Status — probe RIPE Stat
// ─────────────────────────────────────────────

func probeRipeStat() error {
	reqURL := ripeStatBase + "/data/as-overview/data.json?resource=AS13335"
	resp, err := doHTTPRequest(context.Background(), reqURL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("RIPE Stat HTTP %d", resp.StatusCode)
	}
	return nil
}

func GetBGPStatus(c *gin.Context) {
	err := probeRipeStat()
	available := err == nil
	message := "RIPE Stat disponible"
	if err != nil {
		message = fmt.Sprintf("RIPE Stat indisponible : %v", err)
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
		"primary":           "RIPE Stat",
		"message":           message,
		"cache_available":   cacheAvailable,
		"cache_age_seconds": cacheAgeSeconds,
	})
}

// ─────────────────────────────────────────────
// Endpoints Proxy (cachés TTL 10min)
// ─────────────────────────────────────────────

// GET /api/bgp/asn/:asn
func GetBGPASN(c *gin.Context) {
	asn := c.Param("asn")
	proxyBGP(c, fmt.Sprintf("asn:%s:full", asn), "/asn/"+asn)
}

// GET /api/bgp/asn/:asn/prefixes
func GetBGPASNPrefixes(c *gin.Context) {
	asn := c.Param("asn")
	proxyBGP(c, fmt.Sprintf("asn:%s:prefixes", asn), "/asn/"+asn+"/prefixes")
}

// GET /api/bgp/asn/:asn/peers
func GetBGPASNPeers(c *gin.Context) {
	asn := c.Param("asn")
	proxyBGP(c, fmt.Sprintf("asn:%s:peers", asn), "/asn/"+asn+"/peers")
}

// GET /api/bgp/asn/:asn/upstreams
func GetBGPASNUpstreams(c *gin.Context) {
	asn := c.Param("asn")
	proxyBGP(c, fmt.Sprintf("asn:%s:upstreams", asn), "/asn/"+asn+"/upstreams")
}

// GET /api/bgp/asn/:asn/downstreams
func GetBGPASNDownstreams(c *gin.Context) {
	asn := c.Param("asn")
	proxyBGP(c, fmt.Sprintf("asn:%s:downstreams", asn), "/asn/"+asn+"/downstreams")
}

// GET /api/bgp/ip/:ip
func GetBGPIP(c *gin.Context) {
	ip := c.Param("ip")
	proxyBGP(c, fmt.Sprintf("ip:%s", ip), "/ip/"+ip)
}

// GET /api/bgp/search?q=
func GetBGPSearch(c *gin.Context) {
	q := c.Query("q")
	if q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "paramètre q requis"})
		return
	}
	proxyBGP(c, fmt.Sprintf("search:%s", q), "/search", q)
}

// ─────────────────────────────────────────────
// Snapshot parallèle (logique inchangée)
// ─────────────────────────────────────────────

type fetchResult struct {
	key  string
	data map[string]interface{}
	err  error
}

// POST /api/bgp/snapshot/:asn
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
// Comparaison snapshots — inchangée
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

		oldSection := extractNestedValue(oldData, section.topKey)
		newSection := extractNestedValue(newData, section.topKey)
		oldVal, _ := json.Marshal(oldSection)
		newVal, _ := json.Marshal(newSection)

		alerts = append(alerts, models.BGPAlert{
			ASN:        asn,
			AlertType:  section.alertType,
			OldValue:   string(oldVal),
			NewValue:   string(newVal),
			DetectedAt: detectedAt,
		})
	}
	return alerts
}

func extractNestedValue(data map[string]interface{}, keys ...string) interface{} {
	current := interface{}(data)
	for _, key := range keys {
		m, ok := current.(map[string]interface{})
		if !ok {
			return nil
		}
		current = m[key]
	}
	return current
}

func extractNestedSlice(data map[string]interface{}, path []string) []interface{} {
	val := extractNestedValue(data, path...)
	if val == nil {
		return nil
	}
	slice, ok := val.([]interface{})
	if !ok {
		return nil
	}
	return slice
}

func normalizeJSONSlice(items []interface{}) string {
	strs := make([]string, 0, len(items))
	for _, item := range items {
		b, err := json.Marshal(item)
		if err == nil {
			strs = append(strs, string(b))
		}
	}
	sort.Strings(strs)
	b, _ := json.Marshal(strs)
	return string(b)
}

// ─────────────────────────────────────────────
// Historian — Snapshots & Alertes & Diff (inchangé)
// ─────────────────────────────────────────────

// GET /api/bgp/snapshots/:asn
func GetBGPSnapshots(c *gin.Context) {
	asnStr := c.Param("asn")
	asnInt, err := strconv.Atoi(asnStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ASN invalide"})
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	var total int64
	store.DB.Model(&models.BGPSnapshot{}).Where("asn = ?", asnInt).Count(&total)

	var snapshots []models.BGPSnapshot
	store.DB.Where("asn = ?", asnInt).
		Order("created_at DESC").
		Limit(limit).Offset(offset).
		Find(&snapshots)

	type snapshotDTO struct {
		ID           uint   `json:"id"`
		CreatedAt    string `json:"created_at"`
		ASN          int    `json:"asn"`
		SnapshotDate string `json:"snapshot_date"`
		TakenBy      string `json:"taken_by"`
	}
	items := make([]snapshotDTO, 0, len(snapshots))
	for _, s := range snapshots {
		items = append(items, snapshotDTO{
			ID:           s.ID,
			CreatedAt:    s.CreatedAt.Format(time.RFC3339),
			ASN:          s.ASN,
			SnapshotDate: s.SnapshotDate.Format(time.RFC3339),
			TakenBy:      s.TakenBy,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"items":  items,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// GET /api/bgp/snapshots/:asn/diff?id_a=&id_b=
func GetBGPSnapshotDiff(c *gin.Context) {
	asnStr := c.Param("asn")
	asnInt, err := strconv.Atoi(asnStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ASN invalide"})
		return
	}

	idA, errA := strconv.Atoi(c.Query("id_a"))
	idB, errB := strconv.Atoi(c.Query("id_b"))
	if errA != nil || errB != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id_a et id_b requis"})
		return
	}

	var snapA, snapB models.BGPSnapshot
	if err := store.DB.Where("id = ? AND asn = ?", idA, asnInt).First(&snapA).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "snapshot A non trouvé"})
		return
	}
	if err := store.DB.Where("id = ? AND asn = ?", idB, asnInt).First(&snapB).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "snapshot B non trouvé"})
		return
	}

	older, newer := snapA, snapB
	if snapB.ID < snapA.ID {
		older, newer = snapB, snapA
	}

	diff := computeDiff(older.FullDataJSON, newer.FullDataJSON)

	c.JSON(http.StatusOK, gin.H{
		"older": gin.H{"id": older.ID, "created_at": older.CreatedAt.Format(time.RFC3339), "asn": older.ASN},
		"newer": gin.H{"id": newer.ID, "created_at": newer.CreatedAt.Format(time.RFC3339), "asn": newer.ASN},
		"diff":  diff,
	})
}

func computeDiff(oldJSON, newJSON string) map[string]interface{} {
	var oldData, newData map[string]interface{}
	json.Unmarshal([]byte(oldJSON), &oldData)
	json.Unmarshal([]byte(newJSON), &newData)

	changes := make(map[string]interface{})
	changedFields := make([]string, 0)

	for _, section := range bgpSectionComparisons {
		sectionChanges := make(map[string]interface{})
		sectionChanged := false

		for _, path := range section.subPaths {
			fieldName := path[len(path)-1]
			oldSlice := extractNestedSlice(oldData, path)
			newSlice := extractNestedSlice(newData, path)

			added := diffSlices(oldSlice, newSlice)
			removed := diffSlices(newSlice, oldSlice)

			if len(added) > 0 || len(removed) > 0 {
				sectionChanged = true
				sectionChanges[fieldName] = map[string]interface{}{
					"old":     oldSlice,
					"new":     newSlice,
					"added":   added,
					"removed": removed,
				}
			}
		}

		if sectionChanged {
			changes[section.topKey] = sectionChanges
			changedFields = append(changedFields, section.topKey)
		}
	}

	return map[string]interface{}{
		"changed_fields": changedFields,
		"changes":        changes,
	}
}

func diffSlices(a, b []interface{}) []interface{} {
	bSet := make(map[string]bool)
	for _, item := range b {
		key, _ := json.Marshal(item)
		bSet[string(key)] = true
	}
	var result []interface{}
	for _, item := range a {
		key, _ := json.Marshal(item)
		if !bSet[string(key)] {
			result = append(result, item)
		}
	}
	if result == nil {
		return []interface{}{}
	}
	return result
}

// GET /api/bgp/alerts
func GetBGPAlerts(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	var total int64
	store.DB.Model(&models.BGPAlert{}).Where("acknowledged = false").Count(&total)

	var alerts []models.BGPAlert
	store.DB.Where("acknowledged = false").
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

// PATCH /api/bgp/alerts/:id/ack
func AckBGPAlert(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}

	var alert models.BGPAlert
	if err := store.DB.First(&alert, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "alerte non trouvée"})
		return
	}

	store.DB.Model(&alert).Update("acknowledged", true)
	c.JSON(http.StatusOK, gin.H{"message": "alerte acquittée"})
}

// POST /api/bgp/export-ioc
// Accepte uniquement le type "cidr" — les ASN ne sont pas des IOC valides dans ce système.
func PostBGPExportIOC(c *gin.Context) {
	var body struct {
		Type        string `json:"type" binding:"required"`
		Value       string `json:"value" binding:"required"`
		ASN         int    `json:"asn"`
		Source      string `json:"source"`
		Description string `json:"description"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Seul le type "cidr" est accepté pour l'export BGP
	if body.Type != "cidr" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type doit être 'cidr' pour l'export BGP"})
		return
	}

	// Validation stricte : la valeur doit être un préfixe CIDR valide
	// ⚠️ Sécurité : empêche l'injection d'un numéro ASN brut (ex: "13335") comme valeur CIDR
	if _, _, err := net.ParseCIDR(body.Value); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("valeur CIDR invalide : %q — format attendu : x.x.x.x/n ou ::/n", body.Value)})
		return
	}

	// Construction de la source : priorité au champ fourni par le frontend,
	// sinon auto-génération depuis l'ASN, sinon fallback générique.
	source := strings.TrimSpace(body.Source)
	if source == "" {
		if body.ASN > 0 {
			source = fmt.Sprintf("BGP Lookup — AS%d", body.ASN)
		} else {
			source = "BGP Lookup"
		}
	}

	// Notes : enrichissement avec l'ASN si disponible
	notes := strings.TrimSpace(body.Description)
	if body.ASN > 0 {
		if notes != "" {
			notes = fmt.Sprintf("%s | ASN: %d", notes, body.ASN)
		} else {
			notes = fmt.Sprintf("ASN: %d", body.ASN)
		}
	}

	ioc := &models.IOC{
		Type:   models.IOCTypeCIDR,
		Value:  body.Value,
		Source: source,
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
