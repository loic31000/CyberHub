package handlers

// ⚠️ Usage légal uniquement — toutes les requêtes sont destinées à des fins éducatives et de veille réseau.

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
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
	"gorm.io/gorm"
)

const (
	ripeStatBase   = "https://stat.ripe.net"
	cloudflareDoH  = "https://cloudflare-dns.com/dns-query?name=%s&type=A"
	bgpCacheTTL    = 10 * time.Minute
	bgpHTTPTimeout = 30 * time.Second
)

var bgpRipeFetcher = bgpFetchRipe

var bgpHTTPClient = &http.Client{
	Timeout: bgpHTTPTimeout,
}

var bgpCacheWriteMu sync.Mutex

type bgpHTTPStatusError struct {
	StatusCode int
}

func (e *bgpHTTPStatusError) Error() string { return fmt.Sprintf("RIPE Stat HTTP %d", e.StatusCode) }

func acceptBGPHTTPResponse(resp *http.Response) (*http.Response, error) {
	if resp.StatusCode == http.StatusOK {
		return resp, nil
	}
	status := resp.StatusCode
	resp.Body.Close()
	return nil, &bgpHTTPStatusError{StatusCode: status}
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
		return acceptBGPHTTPResponse(resp)
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

	resp, err = client.Do(req2)
	if err != nil {
		return nil, err
	}
	return acceptBGPHTTPResponse(resp)
}

// ─────────────────────────────────────────────
// Cache SQLite
// ─────────────────────────────────────────────

func saveBGPCache(cacheKey string, body []byte, expires time.Time) error {
	bgpCacheWriteMu.Lock()
	defer bgpCacheWriteMu.Unlock()
	now := time.Now()
	var existing models.BGPCache
	if findErr := store.DB.Where("cache_key = ?", cacheKey).First(&existing).Error; errors.Is(findErr, gorm.ErrRecordNotFound) {
		return store.DB.Create(&models.BGPCache{
			CacheKey:  cacheKey,
			Response:  string(body),
			ExpiresAt: expires,
		}).Error
	} else if findErr != nil {
		return findErr
	}
	return store.DB.Model(&existing).Updates(map[string]interface{}{
		"response":   string(body),
		"expires_at": expires,
		"updated_at": now,
	}).Error
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
		Data   *struct {
			Holder      string `json:"holder"`
			Country     string `json:"country"`
			Description string `json:"description"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, 0, fmt.Errorf("parse RIPE Stat ASN info: %w", err)
	}
	if err := validateRIPEEnvelope(raw.Status); err != nil {
		return nil, 0, fmt.Errorf("RIPE Stat ASN info: %w", err)
	}
	if raw.Data == nil {
		return nil, 0, fmt.Errorf("RIPE Stat ASN info: objet data absent")
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

func validateRIPEEnvelope(status string) error {
	if status != "" && status != "ok" {
		return fmt.Errorf("statut source %q", status)
	}
	return nil
}

func fetchRipeASNPrefixes(asn string) ([]byte, int, error) {
	reqURL := fmt.Sprintf(ripeStatBase+"/data/announced-prefixes/data.json?resource=AS%s", asn)
	resp, err := doHTTPRequest(context.Background(), reqURL)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	var raw struct {
		Status string `json:"status"`
		Data   *struct {
			Prefixes []struct {
				Prefix string `json:"prefix"`
			} `json:"prefixes"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, 0, fmt.Errorf("parse RIPE Stat ASN prefixes: %w", err)
	}
	if err := validateRIPEEnvelope(raw.Status); err != nil {
		return nil, 0, fmt.Errorf("RIPE Stat ASN prefixes: %w", err)
	}
	if raw.Data == nil || raw.Data.Prefixes == nil {
		return nil, 0, fmt.Errorf("RIPE Stat ASN prefixes: liste data.prefixes absente")
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
		Status string `json:"status"`
		Data   *struct {
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
	if err := validateRIPEEnvelope(raw.Status); err != nil {
		return nil, 0, fmt.Errorf("RIPE Stat ASN peers: %w", err)
	}
	if raw.Data == nil || raw.Data.Neighbours == nil {
		return nil, 0, fmt.Errorf("RIPE Stat ASN peers: liste data.neighbours absente")
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
		Status string `json:"status"`
		Data   *struct {
			Neighbours []struct {
				ASN  int    `json:"asn"`
				Type string `json:"type"`
			} `json:"neighbours"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, 0, fmt.Errorf("parse RIPE Stat upstreams: %w", err)
	}
	if err := validateRIPEEnvelope(raw.Status); err != nil {
		return nil, 0, fmt.Errorf("RIPE Stat upstreams: %w", err)
	}
	if raw.Data == nil || raw.Data.Neighbours == nil {
		return nil, 0, fmt.Errorf("RIPE Stat upstreams: liste data.neighbours absente")
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
		Status string `json:"status"`
		Data   *struct {
			Neighbours []struct {
				ASN  int    `json:"asn"`
				Type string `json:"type"`
			} `json:"neighbours"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, 0, fmt.Errorf("parse RIPE Stat downstreams: %w", err)
	}
	if err := validateRIPEEnvelope(raw.Status); err != nil {
		return nil, 0, fmt.Errorf("RIPE Stat downstreams: %w", err)
	}
	if raw.Data == nil || raw.Data.Neighbours == nil {
		return nil, 0, fmt.Errorf("RIPE Stat downstreams: liste data.neighbours absente")
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

type bgpDataProvenance struct {
	Source     string     `json:"source"`
	FetchedAt  *time.Time `json:"fetched_at,omitempty"`
	AgeSeconds *int64     `json:"age_seconds,omitempty"`
}

func cacheProvenance(source string, updatedAt, now time.Time) bgpDataProvenance {
	result := bgpDataProvenance{Source: source}
	if !updatedAt.IsZero() {
		fetchedAt := updatedAt
		ageSeconds := int64(now.Sub(updatedAt).Seconds())
		result.FetchedAt = &fetchedAt
		result.AgeSeconds = &ageSeconds
	}
	return result
}

func bgpFetch(cacheKey, endpoint string, queryParam ...string) ([]byte, int, string, error) {
	body, status, provenance, err := bgpFetchDetailed(cacheKey, endpoint, queryParam...)
	return body, status, provenance.Source, err
}

func bgpFetchDetailed(cacheKey, endpoint string, queryParam ...string) ([]byte, int, bgpDataProvenance, error) {
	now := time.Now()

	// 1. Cache valide
	var cached models.BGPCache
	if err := store.DB.Where("cache_key = ? AND expires_at > ?", cacheKey, now).
		First(&cached).Error; err == nil {
		return []byte(cached.Response), http.StatusOK, cacheProvenance("cache", cached.UpdatedAt, now), nil
	}

	// 2. RIPE Stat (source primaire)
	body, status, err := bgpRipeFetcher(endpoint, queryParam...)
	if err == nil {
		expires := now.Add(bgpCacheTTL)
		fetchedAt := time.Now()
		if cacheErr := saveBGPCache(cacheKey, body, expires); cacheErr != nil {
			fmt.Printf("[BGP] échec écriture cache %s : %v\n", cacheKey, cacheErr)
		}
		zeroAge := int64(0)
		return body, status, bgpDataProvenance{Source: "ripe", FetchedAt: &fetchedAt, AgeSeconds: &zeroAge}, nil
	}
	var statusErr *bgpHTTPStatusError
	if errors.As(err, &statusErr) {
		status = statusErr.StatusCode
	}

	// 3. Cache périmé (stale) si RIPE échoue
	var stale models.BGPCache
	if err2 := store.DB.Where("cache_key = ?", cacheKey).First(&stale).Error; err2 == nil {
		return []byte(stale.Response), http.StatusOK, cacheProvenance("cache-stale", stale.UpdatedAt, now), nil
	}

	return nil, status, bgpDataProvenance{}, fmt.Errorf("RIPE Stat indisponible: %w", err)
}

func proxyBGP(c *gin.Context, cacheKey, endpoint string, queryParam ...string) {
	body, status, source, err := bgpFetch(cacheKey, endpoint, queryParam...)
	if err != nil {
		// An upstream failure is a gateway error, not an internal one; 4xx stay
		// meaningful to the client (404 unknown resource, 429 rate limit).
		if status == 0 || status >= http.StatusInternalServerError {
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
// Snapshot parallèle avec provenance de chaque section.
// ─────────────────────────────────────────────

type fetchResult struct {
	key        string
	data       map[string]interface{}
	provenance bgpDataProvenance
	err        error
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
			body, _, provenance, fetchErr := bgpFetchDetailed(cacheKey, path)
			if fetchErr != nil {
				resultsCh <- fetchResult{key: key, err: fetchErr}
				return
			}
			var data map[string]interface{}
			if jsonErr := json.Unmarshal(body, &data); jsonErr != nil {
				resultsCh <- fetchResult{key: key, err: fmt.Errorf("parse JSON %s: %w", key, jsonErr)}
				return
			}
			if validationErr := validateSnapshotSection(key, data); validationErr != nil {
				resultsCh <- fetchResult{key: key, err: validationErr}
				return
			}
			resultsCh <- fetchResult{key: key, data: data, provenance: provenance}
		}(ep.key, ep.cacheKey, ep.path)
	}

	wg.Wait()
	close(resultsCh)

	combined := make(map[string]interface{})
	provenance := make(map[string]bgpDataProvenance, len(endpoints))
	for r := range resultsCh {
		if r.err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("erreur récupération '%s': %v", r.key, r.err)})
			return
		}
		combined[r.key] = r.data
		provenance[r.key] = r.provenance
	}

	fullJSON, err := json.Marshal(combined)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "sérialisation snapshot"})
		return
	}
	provenanceJSON, err := json.Marshal(provenance)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "sérialisation provenance snapshot"})
		return
	}

	now := time.Now()
	snapshot := models.BGPSnapshot{
		ASN:                asnInt,
		SnapshotDate:       now,
		FullDataJSON:       string(fullJSON),
		DataProvenanceJSON: string(provenanceJSON),
		TakenBy:            "local",
	}
	var alerts []models.BGPAlert
	comparison := gin.H{"status": "no_previous", "previous_snapshot_id": nil}
	if err := store.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&snapshot).Error; err != nil {
			return err
		}
		var previous models.BGPSnapshot
		err := tx.Where("asn = ? AND id < ?", asnInt, snapshot.ID).Order("id DESC").First(&previous).Error
		if err == nil {
			var status string
			alerts, status = compareBGPSnapshots(asnInt, previous.FullDataJSON, string(fullJSON), now)
			comparison = gin.H{"status": status, "previous_snapshot_id": previous.ID}
			if status != "complete" {
				fmt.Printf("[BGP] comparaison AS%d snapshot %d → %d : %s\n", asnInt, previous.ID, snapshot.ID, status)
			}
			if len(alerts) > 0 {
				if err := tx.Create(&alerts).Error; err != nil {
					return err
				}
			}
			return nil
		}
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "création snapshot ou alertes: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"snapshot":        snapshot,
		"alerts":          alerts,
		"data_provenance": provenance,
		"comparison":      comparison,
	})
}

func validateSnapshotSection(section string, data map[string]interface{}) error {
	if data == nil {
		return fmt.Errorf("section %s absente ou non objet", section)
	}
	sectionData, ok := data["data"].(map[string]interface{})
	if !ok {
		return fmt.Errorf("section %s: data absente ou non objet", section)
	}
	fields := map[string][]string{
		"prefixes":    {"ipv4_prefixes", "ipv6_prefixes"},
		"peers":       {"ipv4_peers", "ipv6_peers"},
		"upstreams":   {"ipv4_upstreams", "ipv6_upstreams"},
		"downstreams": {"ipv4_downstreams", "ipv6_downstreams"},
	}[section]
	for _, field := range fields {
		if _, ok := sectionData[field].([]interface{}); !ok {
			return fmt.Errorf("section %s: liste %s absente ou non tableau", section, field)
		}
	}
	return nil
}

// ─────────────────────────────────────────────
// Comparaison de snapshots pour la génération d'alertes.
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

// compareBGPSnapshots returns the alerts for lists that really changed and the
// comparison status: "complete", "incomplete" (a list is missing on one side,
// so it was not compared) or "error" (a snapshot cannot be read). A list that
// could not be compared never produces an alert, nor counts as unchanged.
func compareBGPSnapshots(asn int, oldJSON, newJSON string, detectedAt time.Time) ([]models.BGPAlert, string) {
	var oldData, newData map[string]interface{}
	oldErr := json.Unmarshal([]byte(oldJSON), &oldData)
	newErr := json.Unmarshal([]byte(newJSON), &newData)
	if oldErr != nil || newErr != nil {
		return nil, "error"
	}

	var alerts []models.BGPAlert
	status := "complete"

	for _, section := range bgpSectionComparisons {
		changed := false
		for _, path := range section.subPaths {
			oldSlice, oldStatus, oldListErr := comparisonList(oldData, path, nil)
			newSlice, newStatus, newListErr := comparisonList(newData, path, nil)
			switch {
			case oldListErr != nil || newListErr != nil:
				status = "error"
			case oldStatus != "available" || newStatus != "available":
				if status != "error" {
					status = "incomplete"
				}
			case normalizeJSONSlice(oldSlice) != normalizeJSONSlice(newSlice):
				changed = true
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
	return alerts, status
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
// Historian — snapshots, provenance, comparaisons et alertes.
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
	if err := store.DB.Model(&models.BGPSnapshot{}).Where("asn = ?", asnInt).Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "lecture snapshots: " + err.Error()})
		return
	}

	var snapshots []models.BGPSnapshot
	// Same chronology as the diff endpoint: snapshot_date, then id.
	if err := store.DB.Where("asn = ?", asnInt).
		Order("snapshot_date DESC, id DESC").
		Limit(limit).Offset(offset).
		Find(&snapshots).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "lecture snapshots: " + err.Error()})
		return
	}

	type snapshotDTO struct {
		ID               uint                         `json:"id"`
		CreatedAt        string                       `json:"created_at"`
		ASN              int                          `json:"asn"`
		SnapshotDate     string                       `json:"snapshot_date"`
		TakenBy          string                       `json:"taken_by"`
		ProvenanceStatus string                       `json:"provenance_status"`
		DataProvenance   map[string]bgpDataProvenance `json:"data_provenance"`
	}
	items := make([]snapshotDTO, 0, len(snapshots))
	for _, s := range snapshots {
		dataProvenance := decodeProvenance(s.DataProvenanceJSON)
		provenanceStatus := "known"
		if dataProvenance == nil {
			provenanceStatus = "unknown"
		}
		items = append(items, snapshotDTO{
			ID:               s.ID,
			CreatedAt:        s.CreatedAt.Format(time.RFC3339),
			ASN:              s.ASN,
			SnapshotDate:     s.SnapshotDate.Format(time.RFC3339),
			TakenBy:          s.TakenBy,
			ProvenanceStatus: provenanceStatus,
			DataProvenance:   dataProvenance,
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
	if snapshotChronology(snapB).Before(snapshotChronology(snapA)) ||
		(snapshotChronology(snapB).Equal(snapshotChronology(snapA)) && snapB.ID < snapA.ID) {
		older, newer = snapB, snapA
	}

	diff := computeDiff(older.FullDataJSON, newer.FullDataJSON)

	c.JSON(http.StatusOK, gin.H{
		"older": snapshotDiffMetadata(older),
		"newer": snapshotDiffMetadata(newer),
		"diff":  diff,
	})
}

func snapshotDiffMetadata(snapshot models.BGPSnapshot) gin.H {
	provenance := decodeProvenance(snapshot.DataProvenanceJSON)
	status := "known"
	if provenance == nil {
		status = "unknown"
	}
	return gin.H{
		"id": snapshot.ID, "created_at": snapshot.CreatedAt.Format(time.RFC3339),
		"snapshot_date": snapshot.SnapshotDate.Format(time.RFC3339), "asn": snapshot.ASN,
		"provenance_status": status, "data_provenance": provenance,
	}
}

func snapshotChronology(snapshot models.BGPSnapshot) time.Time {
	if !snapshot.SnapshotDate.IsZero() {
		return snapshot.SnapshotDate
	}
	return snapshot.CreatedAt
}

func decodeProvenance(raw string) map[string]bgpDataProvenance {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	var provenance map[string]bgpDataProvenance
	if err := json.Unmarshal([]byte(raw), &provenance); err != nil {
		return nil
	}
	return provenance
}

func computeDiff(oldJSON, newJSON string) map[string]interface{} {
	var oldData, newData map[string]interface{}
	oldErr := json.Unmarshal([]byte(oldJSON), &oldData)
	newErr := json.Unmarshal([]byte(newJSON), &newData)

	changes := make(map[string]interface{})
	changedFields := make([]string, 0)
	listStatuses := make(map[string]interface{}, 8)
	decodeErrors := make(map[string]interface{})
	if oldErr != nil {
		decodeErrors["older"] = oldErr.Error()
	}
	if newErr != nil {
		decodeErrors["newer"] = newErr.Error()
	}
	status := "complete"
	if oldErr != nil || newErr != nil {
		status = "error"
	}

	for _, section := range bgpSectionComparisons {
		sectionChanges := make(map[string]interface{})
		sectionChanged := false

		for _, path := range section.subPaths {
			fieldName := path[len(path)-1]
			key := strings.Join(path, ".")
			oldSlice, oldStatus, oldListErr := comparisonList(oldData, path, oldErr)
			newSlice, newStatus, newListErr := comparisonList(newData, path, newErr)
			listStatus := "identical"
			statusMeta := map[string]interface{}{"status": listStatus}
			switch {
			case oldListErr != nil || newListErr != nil:
				listStatus = "error"
				if oldListErr != nil {
					statusMeta["older_error"] = oldListErr.Error()
				}
				if newListErr != nil {
					statusMeta["newer_error"] = newListErr.Error()
				}
				status = "error"
			case oldStatus != "available" || newStatus != "available":
				listStatus = "missing/unavailable"
				if status != "error" {
					status = "incomplete"
				}
			case normalizeJSONSlice(oldSlice) != normalizeJSONSlice(newSlice):
				listStatus = "changed"
			}
			statusMeta["status"] = listStatus
			listStatuses[key] = statusMeta
			if listStatus != "changed" {
				continue
			}

			added := diffSlices(newSlice, oldSlice)
			removed := diffSlices(oldSlice, newSlice)

			sectionChanged = true
			sectionChanges[fieldName] = map[string]interface{}{
				"old":     oldSlice,
				"new":     newSlice,
				"added":   added,
				"removed": removed,
			}
		}

		if sectionChanged {
			changes[section.topKey] = sectionChanges
			changedFields = append(changedFields, section.topKey)
		}
	}

	result := map[string]interface{}{
		"status":         status,
		"changed_fields": changedFields,
		"changes":        changes,
		"list_status":    listStatuses,
	}
	if len(decodeErrors) > 0 {
		result["decode_errors"] = decodeErrors
	}
	return result
}

func comparisonList(data map[string]interface{}, path []string, rootErr error) ([]interface{}, string, error) {
	if rootErr != nil {
		return nil, "error", rootErr
	}
	var current interface{} = data
	for index, key := range path {
		object, ok := current.(map[string]interface{})
		if !ok {
			return nil, "error", fmt.Errorf("%s: expected object", strings.Join(path[:index], "."))
		}
		value, exists := object[key]
		if !exists || value == nil {
			return nil, "unavailable", nil
		}
		if index == len(path)-1 {
			list, ok := value.([]interface{})
			if !ok {
				return nil, "error", fmt.Errorf("%s: expected array, got %T", strings.Join(path, "."), value)
			}
			return list, "available", nil
		}
		current = value
	}
	return nil, "unavailable", nil
}

func diffSlices(a, b []interface{}) []interface{} {
	bSet := make(map[string]int)
	for _, item := range b {
		key, _ := json.Marshal(item)
		bSet[string(key)]++
	}
	var result []interface{}
	for _, item := range a {
		key, _ := json.Marshal(item)
		if bSet[string(key)] > 0 {
			bSet[string(key)]--
		} else {
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
	if err := store.DB.Model(&models.BGPAlert{}).Where("acknowledged = false").Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "lecture alertes: " + err.Error()})
		return
	}

	var alerts []models.BGPAlert
	if err := store.DB.Where("acknowledged = false").
		Order("created_at DESC").
		Limit(limit).Offset(offset).
		Find(&alerts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "lecture alertes: " + err.Error()})
		return
	}

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

	if err := store.DB.Model(&alert).Update("acknowledged", true).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "acquittement alerte: " + err.Error()})
		return
	}
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
