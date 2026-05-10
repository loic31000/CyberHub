package correlation

import (
	"fmt"
	"net"
	"net/url"
	"regexp"
	"strconv"
	"strings"
)

var (
	// domainRegex : labels alphanum + tirets, au moins deux niveaux, TLD 2-63 chars
	domainRegex = regexp.MustCompile(
		`^(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$`,
	)
	// hashRegex : MD5 (32), SHA1 (40), SHA256 (64) hex uniquement
	hashRegex = regexp.MustCompile(`^[a-fA-F0-9]{32}$|^[a-fA-F0-9]{40}$|^[a-fA-F0-9]{64}$`)
	// emailRegex : format standard user@domain.tld
	emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
)

// validateIPv4Strict vérifie qu'une chaîne est une IPv4 avec exactement 4 octets décimaux valides (0-255).
// net.ParseIP peut accepter des formes abrégées sur certaines plateformes — cette fonction est stricte.
func validateIPv4Strict(s string) bool {
	parts := strings.Split(s, ".")
	if len(parts) != 4 {
		return false
	}
	for _, part := range parts {
		if part == "" {
			return false
		}
		// Pas de zéro en tête (sauf "0" seul)
		if len(part) > 1 && part[0] == '0' {
			return false
		}
		n, err := strconv.Atoi(part)
		if err != nil || n < 0 || n > 255 {
			return false
		}
	}
	return true
}

// validateIOCValue vérifie que la valeur est cohérente avec son type déclaré.
// Retourne (true, "") si valide, (false, rationale lisible) si invalide.
func validateIOCValue(iocType, iocValue string) (bool, string) {
	v := strings.TrimSpace(iocValue)
	if v == "" {
		return false, "Valeur IOC vide."
	}

	switch iocType {
	case "ip":
		// Vérifier d'abord si c'est une IPv6 (contient ':')
		if strings.Contains(v, ":") {
			if net.ParseIP(v) == nil {
				return false, fmt.Sprintf("'%s' n'est pas une adresse IPv6 valide.", v)
			}
			// IPv6 validée par net.ParseIP
			break
		}
		// IPv4 : validation stricte 4 octets (rejet des formes partielles comme "5.101.221")
		if !validateIPv4Strict(v) {
			return false, fmt.Sprintf("'%s' n'est pas une adresse IPv4 valide (4 octets décimaux 0-255 requis).", v)
		}
		ip := net.ParseIP(v)
		if ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
			return false, fmt.Sprintf("'%s' est une adresse locale/loopback, non corrélable avec la threat intel.", v)
		}

	case "cidr":
		_, _, err := net.ParseCIDR(v)
		if err != nil {
			return false, fmt.Sprintf("'%s' n'est pas un préfixe CIDR valide (ex: 192.168.1.0/24).", v)
		}

	case "domain":
		clean := strings.TrimPrefix(strings.TrimPrefix(v, "https://"), "http://")
		clean = strings.Split(clean, "/")[0]
		if !domainRegex.MatchString(clean) || len(clean) > 253 {
			return false, fmt.Sprintf("'%s' n'est pas un nom de domaine plausible.", v)
		}

	case "hash":
		if !hashRegex.MatchString(v) {
			return false, fmt.Sprintf("'%s' n'est pas un hash reconnu — MD5 (32), SHA1 (40) ou SHA256 (64) hex attendu.", v)
		}

	case "url":
		u, err := url.Parse(v)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
			return false, fmt.Sprintf("'%s' n'est pas une URL valide (schéma http/https + hôte requis).", v)
		}

	case "email":
		if !emailRegex.MatchString(v) {
			return false, fmt.Sprintf("'%s' n'est pas une adresse email valide.", v)
		}
	}

	return true, ""
}
