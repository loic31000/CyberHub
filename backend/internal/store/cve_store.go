package store

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/models"
)

func ListCVE(severity, status, search string, page, limit int) ([]models.CVEEntry, int64, error) {
	q := DB.Model(&models.CVEEntry{})
	if severity != "" {
		q = q.Where("severity = ?", severity)
	}
	if status != "" {
		q = q.Where("status = ?", status)
	}
	if search != "" {
		t := "%" + strings.ToLower(search) + "%"
		q = q.Where("LOWER(cve_id) LIKE ? OR LOWER(description) LIKE ? OR LOWER(products) LIKE ?", t, t, t)
	}
	var total int64
	q.Count(&total)

	q = q.Order("published_at DESC")
	if page > 0 && limit > 0 {
		q = q.Offset((page - 1) * limit).Limit(limit)
	}
	var items []models.CVEEntry
	err := q.Find(&items).Error
	return items, total, err
}

func GetCVEByID(id uint) (*models.CVEEntry, error) {
	var item models.CVEEntry
	err := DB.First(&item, id).Error
	return &item, err
}

func CreateCVE(req *models.CVECreateRequest) (*models.CVEEntry, error) {
	item := models.CVEEntry{
		CVEID: req.CVEID, Description: req.Description,
		CVSSScore: req.CVSSScore, Severity: req.Severity,
		Products: req.Products, Status: req.Status,
		Notes: req.Notes, PublishedAt: req.PublishedAt,
	}
	if item.Status == "" {
		item.Status = models.CVEStatusNew
	}
	err := DB.Create(&item).Error
	return &item, err
}

func UpdateCVE(id uint, req *models.CVECreateRequest) (*models.CVEEntry, error) {
	item, err := GetCVEByID(id)
	if err != nil {
		return nil, err
	}
	item.Description = req.Description
	item.CVSSScore = req.CVSSScore
	item.Severity = req.Severity
	item.Products = req.Products
	item.Status = req.Status
	item.Notes = req.Notes
	item.PublishedAt = req.PublishedAt
	err = DB.Save(item).Error
	return item, err
}

func DeleteCVE(id uint) error {
	return DB.Delete(&models.CVEEntry{}, id).Error
}

// ImportNVD importe un flux NVD JSON 2.0 et crée les CVE manquants (ignore les doublons)
func ImportNVD(items []models.NVDImportItem) (int, int, error) {
	created, skipped := 0, 0
	for _, nvd := range items {
		cveID := nvd.CVE.ID
		if cveID == "" {
			continue
		}

		// Vérifier si déjà présent
		var count int64
		DB.Model(&models.CVEEntry{}).Where("cve_id = ?", cveID).Count(&count)
		if count > 0 {
			skipped++
			continue
		}

		// Description EN
		desc := ""
		for _, d := range nvd.CVE.Descriptions {
			if d.Lang == "en" {
				desc = d.Value
				break
			}
		}

		// Score CVSS (V3.1 > V3.0 > V2)
		var score float64
		var severity models.CVESeverity
		if len(nvd.CVE.Metrics.V31) > 0 {
			score = nvd.CVE.Metrics.V31[0].CVSSData.BaseScore
			severity = normalizeSeverity(nvd.CVE.Metrics.V31[0].CVSSData.BaseSeverity)
		} else if len(nvd.CVE.Metrics.V30) > 0 {
			score = nvd.CVE.Metrics.V30[0].CVSSData.BaseScore
			severity = normalizeSeverity(nvd.CVE.Metrics.V30[0].CVSSData.BaseSeverity)
		} else if len(nvd.CVE.Metrics.V2) > 0 {
			score = nvd.CVE.Metrics.V2[0].CVSSData.BaseScore
			severity = normalizeSeverity(nvd.CVE.Metrics.V2[0].BaseSeverity)
		}

		// Date de publication
		pub := time.Now()
		if nvd.CVE.Published != "" {
			if t, err := time.Parse("2006-01-02T15:04:05.999", nvd.CVE.Published); err == nil {
				pub = t
			}
		}

		entry := models.CVEEntry{
			CVEID: cveID, Description: desc,
			CVSSScore: score, Severity: severity,
			Status: models.CVEStatusNew, PublishedAt: pub,
		}
		if err := DB.Create(&entry).Error; err != nil {
			continue
		}
		created++
	}
	return created, skipped, nil
}

// SeedCVEEntries insère les CVE critiques de référence si absents.
func SeedCVEEntries() error {
	type cveSeed struct {
		id          string
		description string
		cvss        float64
		severity    models.CVESeverity
		products    string
		notes       string
		published   string
	}

	seeds := []cveSeed{
		{
			id:   "CVE-2021-44228",
			cvss: 10.0, severity: models.SeverityCritical,
			products:  "Apache Log4j 2.0-beta9 à 2.14.1",
			published: "2021-12-10",
			description: "Log4Shell — RCE non authentifiée via la fonctionnalité JNDI de Log4j 2. " +
				"L'injection de chaînes ${jndi:ldap://...} dans tout log traité par Log4j permet l'exécution de code arbitraire à distance. " +
				"Impact catastrophique : millions de serveurs Java affectés (Minecraft, iCloud, VMware, Twitter...).",
			notes: "Vecteur : chaîne JNDI dans User-Agent, username, ou tout champ loggé. " +
				"Patch : mettre à jour vers Log4j ≥ 2.17.1. Mitigation rapide : -Dlog4j2.formatMsgNoLookups=true",
		},
		{
			id:   "CVE-2017-0144",
			cvss: 9.3, severity: models.SeverityCritical,
			products:  "Windows XP, Vista, 7, Server 2003/2008 — SMBv1",
			published: "2017-03-14",
			description: "EternalBlue — RCE dans l'implémentation SMBv1 de Windows. " +
				"Exploit développé par la NSA et divulgué par Shadow Brokers en 2017. " +
				"Utilisé massivement par WannaCry (2017) et NotPetya. " +
				"Aucune authentification requise, propagation automatique en ver réseau.",
			notes: "Patch KB4012212 (Windows 7) / KB4012215. Désactiver SMBv1 immédiatement. " +
				"Bloquer le port 445/TCP en entrée depuis Internet.",
		},
		{
			id:   "CVE-2021-34527",
			cvss: 8.8, severity: models.SeverityCritical,
			products:  "Windows Print Spooler — toutes versions Windows",
			published: "2021-07-01",
			description: "PrintNightmare — RCE et LPE via le service Windows Print Spooler. " +
				"Permet à un utilisateur authentifié d'exécuter du code arbitraire en tant que SYSTEM " +
				"en chargeant un driver d'imprimante malveillant. " +
				"Deux variantes : RCE réseau (CVE-2021-34527) et LPE locale (CVE-2021-1675).",
			notes: "Patch : KB5004945 et suivants. Mitigation : désactiver le Print Spooler sur les DC et serveurs critiques. " +
				"Bloquer l'accès SMB au Spooler depuis les hôtes non-imprimantes.",
		},
		{
			id:   "CVE-2021-26855",
			cvss: 9.8, severity: models.SeverityCritical,
			products:  "Microsoft Exchange Server 2013/2016/2019 (on-premise)",
			published: "2021-03-02",
			description: "ProxyLogon — SSRF pré-authentification dans Exchange permettant de bypasser l'authentification " +
				"et d'écrire des webshells arbitraires. " +
				"Chaîne de 4 CVE (26855, 26857, 26858, 27065) exploitée massivement par HAFNIUM (APT chinois) " +
				"avant le patch. Des centaines de milliers de serveurs compromis.",
			notes: "Patch : mises à jour de sécurité Microsoft Exchange de mars 2021. " +
				"Vérifier les webshells dans C:\\inetpub\\wwwroot\\aspnet_client\\. " +
				"Utiliser le script MSERT de Microsoft pour scanner les compromissions.",
		},
		{
			id:   "CVE-2022-30190",
			cvss: 7.8, severity: models.SeverityHigh,
			products:  "Microsoft Support Diagnostic Tool (MSDT) — Windows 10/11, Server 2019/2022",
			published: "2022-05-30",
			description: "Follina — RCE via l'outil de diagnostic MSDT appelé depuis un document Word. " +
				"Aucune macro requise, déclenché à l'ouverture (preview incluse dans Explorer). " +
				"Exploite le protocole ms-msdt:// pour exécuter des commandes PowerShell arbitraires.",
			notes: "Mitigation : désactiver le protocole MSDT (reg delete HKLM\\Software\\Classes\\ms-msdt /f). " +
				"Patch : KB5014699 (Windows 10), KB5014697 (Windows 11).",
		},
		{
			id:   "CVE-2023-23397",
			cvss: 9.8, severity: models.SeverityCritical,
			products:  "Microsoft Outlook pour Windows (toutes versions before March 2023)",
			published: "2023-03-14",
			description: "Vol de hash NTLM zero-click via Outlook. " +
				"L'envoi d'un email avec une tâche ou un rendez-vous pointant vers un partage UNC distant " +
				"déclenche une authentification NTLM automatique à l'ouverture d'Outlook, sans interaction utilisateur. " +
				"Utilisé par APT28 (Fancy Bear) contre des cibles européennes.",
			notes: "Patch : mise à jour Outlook de mars 2023. " +
				"Mitigation : bloquer TCP 445 sortant, ajouter les utilisateurs au groupe 'Protected Users', " +
				"désactiver NTLMv1.",
		},
		{
			id:   "CVE-2014-0160",
			cvss: 7.5, severity: models.SeverityHigh,
			products:  "OpenSSL 1.0.1 à 1.0.1f — nombreux serveurs web et VPN (2012-2014)",
			published: "2014-04-07",
			description: "Heartbleed — Fuite de mémoire dans l'extension Heartbeat d'OpenSSL. " +
				"Permet de lire jusqu'à 64 Ko de mémoire du processus OpenSSL par requête, " +
				"exposant potentiellement les clés privées, mots de passe, tokens de session. " +
				"Affecte des millions de serveurs HTTPS, VPN, mail.",
			notes: "Patch : OpenSSL 1.0.1g. Toujours vérifier avec : nmap --script ssl-heartbleed. " +
				"Révoquer et renouveler tous les certificats SSL des serveurs affectés.",
		},
		{
			id:   "CVE-2024-3094",
			cvss: 10.0, severity: models.SeverityCritical,
			products:  "XZ Utils 5.6.0 et 5.6.1 (liblzma) — distributions Linux rolling (Arch, Fedora Rawhide, Debian sid)",
			published: "2024-03-29",
			description: "Backdoor dans XZ Utils — l'une des supply chain attacks les plus sophistiquées jamais découvertes. " +
				"Un attaquant (JiaT75 / Jia Tan) a passé 2 ans à construire de la confiance pour devenir co-mainteneur de XZ, " +
				"puis a injecté un backdoor dans liblzma permettant un bypass d'authentification SSH sur les systèmes affectés. " +
				"Découverte par hasard par Andres Freund (Microsoft) via une anomalie de performance dans sshd.",
			notes: "Mitigation : rétrograder vers XZ Utils ≤ 5.4.6. " +
				"Seules les distributions en mode rolling et certains packages Debian/Fedora non-stables étaient affectées. " +
				"Leçon : surveiller l'activité Git suspecte sur les dépendances critiques.",
		},
		{
			id:   "CVE-2022-22965",
			cvss: 9.8, severity: models.SeverityCritical,
			products:  "Spring Framework 5.3.0-17 et 5.2.0-19 — JDK ≥ 9",
			published: "2022-03-31",
			description: "Spring4Shell — RCE dans Spring Framework via l'injection de paramètres dans les DataBinders. " +
				"Permet l'écriture de webshells JSP sur le serveur Tomcat. " +
				"Nécessite Spring MVC ou Spring WebFlux avec JDK 9+ et déployé sur Tomcat.",
			notes: "Patch : Spring Framework 5.3.18 / 5.2.20. " +
				"Mitigation : mettre à jour Spring Boot ≥ 2.6.6 ou ≥ 2.5.12.",
		},
		{
			id:   "CVE-2021-41773",
			cvss: 7.5, severity: models.SeverityHigh,
			products:  "Apache HTTP Server 2.4.49",
			published: "2021-10-05",
			description: "Path traversal et RCE dans Apache 2.4.49. " +
				"Faille dans la normalisation des chemins permettant un directory traversal hors de la racine web. " +
				"Si mod_cgi est activé, conduit à une RCE. Corrigé en 2.4.50, mais 2.4.50 avait aussi une variante (CVE-2021-42013). " +
				"Exploitation massive dans les heures suivant la publication.",
			notes: "Patch : Apache HTTP Server ≥ 2.4.51. " +
				"Vérifier : curl -s --path-as-is http://<IP>/cgi-bin/.%2e/.%2e/etc/passwd",
		},
		{
			id:   "CVE-2023-44487",
			cvss: 7.5, severity: models.SeverityHigh,
			products:  "HTTP/2 — serveurs nginx, Apache, Node.js, Go, AWS, Google Cloud, Cloudflare",
			published: "2023-10-10",
			description: "HTTP/2 Rapid Reset Attack — technique DDoS exploitant le multiplexage HTTP/2. " +
				"L'attaquant ouvre des milliers de streams HTTP/2 et les annule immédiatement (RST_STREAM), " +
				"saturant le serveur sans nécessiter de botnet massif. " +
				"Utilisé pour générer les plus grosses attaques DDoS jamais observées (398 Mpps chez Google). " +
				"Affecte pratiquement tous les serveurs et proxies supportant HTTP/2.",
			notes: "Mitigation : mettre à jour nginx/Apache/HAProxy, configurer des limites de streams HTTP/2 " +
				"(nginx: http2_max_concurrent_streams 128), activer un service anti-DDoS en amont.",
		},
		{
			id:   "CVE-2024-21762",
			cvss: 9.8, severity: models.SeverityCritical,
			products:  "Fortinet FortiOS 6.0-7.4, FortiProxy — SSL VPN",
			published: "2024-02-08",
			description: "RCE non authentifiée dans le SSL VPN de FortiOS (out-of-bounds write). " +
				"Exploitable via une requête HTTP spécialement forgée sans authentification. " +
				"Exploitation active confirmée in-the-wild par Fortinet au moment de la publication. " +
				"Cible favorite des groupes APT chinois et ransomware pour compromission initiale.",
			notes: "Patch : FortiOS ≥ 7.4.3, ≥ 7.2.7, ≥ 7.0.14, ≥ 6.4.15. " +
				"Workaround : désactiver l'accès SSL VPN si non utilisé (config vpn ssl settings > set status disable). " +
				"Vérifier les IOCs de compromission avant application du patch.",
		},
		{
			id:   "CVE-2024-6387",
			cvss: 8.1, severity: models.SeverityCritical,
			products:  "OpenSSH 8.5p1 à 9.7p1 — serveurs Linux (glibc)",
			published: "2024-07-01",
			description: "regreSSHion — RCE non authentifiée dans OpenSSH serveur (sshd). " +
				"Condition de race dans le handler de signal SIGALRM permettant une corruption mémoire. " +
				"Régression d'une vuln corrigée en 2006 (CVE-2006-5051). " +
				"Exploitation difficile (race condition ~10 000 tentatives) mais possible en ~1h sur systèmes 32-bit. " +
				"Systèmes 64-bit protégés par ASLR mais théoriquement vulnérables.",
			notes: "Patch : OpenSSH ≥ 9.8p1. " +
				"Mitigation rapide : LoginGraceTime 0 dans sshd_config (mais crée un vecteur DoS). " +
				"Appliquer rate-limiting des connexions SSH via fail2ban ou firewall.",
		},
		{
			id:   "CVE-2021-3156",
			cvss: 7.8, severity: models.SeverityHigh,
			products:  "sudo ≤ 1.9.5p1 — Linux/Unix (toutes distributions)",
			published: "2021-01-26",
			description: "Baron Samedit — heap buffer overflow dans sudo permettant une élévation de privilèges locale vers root. " +
				"Un utilisateur non-root peut exploiter ce bug via 'sudoedit -s' pour obtenir un shell root " +
				"sans connaître son mot de passe ou être dans le fichier sudoers. " +
				"Présent depuis 10 ans dans sudo (depuis 2011, version 1.8.2). " +
				"Exploit PoC public disponible dès la divulgation.",
			notes: "Patch : sudo ≥ 1.9.5p2. " +
				"Vérifier la version : sudo --version. " +
				"Test de vulnérabilité (non exploitant) : sudoedit -s '\\' $(python3 -c 'print(\"A\"*65536)') " +
				"— si crash, la version est vulnérable.",
		},
		{
			id:   "CVE-2022-1388",
			cvss: 9.8, severity: models.SeverityCritical,
			products:  "F5 BIG-IP 13.1.x, 14.1.x, 15.1.x, 16.1.x — iControl REST API",
			published: "2022-05-04",
			description: "Bypass d'authentification dans l'API REST iControl de F5 BIG-IP. " +
				"Permet l'exécution de commandes arbitraires avec les droits root sans authentification " +
				"en contournant l'auth via des headers HTTP spécifiques (Connection: keep-alive, X-F5-Auth-Token). " +
				"Exploitation massive en quelques heures après publication, déploiement de webshells et backdoors.",
			notes: "Patch : mettre à jour BIG-IP vers les versions corrigées. " +
				"Mitigation : bloquer l'accès à l'interface d'administration depuis Internet. " +
				"L'API iControl REST ne devrait jamais être exposée publiquement.",
		},
		{
			id:   "CVE-2023-20198",
			cvss: 10.0, severity: models.SeverityCritical,
			products:  "Cisco IOS XE — Web UI (HTTP server activé)",
			published: "2023-10-16",
			description: "Création de compte admin non authentifiée dans l'interface Web de Cisco IOS XE. " +
				"Exploitation zero-day active avant publication du patch. " +
				"L'attaquant peut créer un compte avec les droits admin niveau 15 " +
				"puis déployer un implant Lua (backdoor) persistant après redémarrage. " +
				"Des dizaines de milliers de routeurs Cisco compromis détectés via Shodan en octobre 2023.",
			notes: "Patch : mises à jour Cisco IOS XE 17.9.4a et suivantes. " +
				"Mitigation URGENTE : désactiver le serveur HTTP/HTTPS (no ip http server / no ip http secure-server). " +
				"Scanner Shodan avec 'http.html_hash:-1076109428' pour identifier les devices compromis.",
		},
		{
			id:   "CVE-2023-34362",
			cvss: 9.8, severity: models.SeverityCritical,
			products:  "Progress MOVEit Transfer (toutes versions avant juin 2023)",
			published: "2023-06-01",
			description: "Injection SQL dans MOVEit Transfer permettant un accès non authentifié à la base de données. " +
				"Exploitée massivement par le groupe CL0P (ransomware) depuis fin mai 2023 en tant que zero-day. " +
				"Permet l'exfiltration de données de milliers d'organisations (gouvernements, banques, universités). " +
				"Plus de 1000 organisations victimes dont Shell, BA, BBC, US DoE. " +
				"L'une des plus grandes campagnes d'exploitation coordonnée de 2023.",
			notes: "Patch : appliquer immédiatement les correctifs Progress. " +
				"Vérifier les IOCs : fichiers .aspx dans le dossier wwwroot de MOVEit. " +
				"Surveiller Event ID 5312 dans les logs Windows IIS. " +
				"Contacter les autorités si compromission avérée (données personnelles).",
		},
		{
			id:   "CVE-2024-1709",
			cvss: 10.0, severity: models.SeverityCritical,
			products:  "ConnectWise ScreenConnect ≤ 23.9.7",
			published: "2024-02-21",
			description: "Bypass d'authentification critique dans ConnectWise ScreenConnect. " +
				"Exploitable sans authentification pour créer un compte administrateur et accéder " +
				"à toutes les machines gérées via l'outil de télémaintenance. " +
				"Associé à CVE-2024-1708 (path traversal) pour un impact maximum. " +
				"Utilisé par des groupes ransomware pour déployer LockBit et BlackSuit via les instances MSP compromises.",
			notes: "Patch : ScreenConnect ≥ 23.9.8. " +
				"Si hébergé en cloud ConnectWise : patché automatiquement. " +
				"Si on-premise : mise à jour urgente requise. " +
				"Vérifier les comptes administrateurs créés récemment et les sessions suspectes.",
		},
		{
			id:   "CVE-2023-4863",
			cvss: 8.8, severity: models.SeverityCritical,
			products:  "libwebp — Chrome, Firefox, Safari, Electron, Android, Edge (avant sept. 2023)",
			published: "2023-09-12",
			description: "Heap buffer overflow dans la bibliothèque libwebp lors du décodage d'images WebP malformées. " +
				"Découvert par Google TAG comme zero-day exploité par des vendeurs de spyware commercial. " +
				"Lié à CVE-2023-41064 (même bug découvert dans iOS par Citizen Lab — exploit BLASTPASS de NSO Group). " +
				"Affecte pratiquement toutes les applications affichant des images WebP sur toutes plateformes.",
			notes: "Patch : mettre à jour Chrome ≥ 116.0.5845.187, Firefox ≥ 117.0.1, iOS ≥ 16.6.1/17. " +
				"Mettre à jour libwebp ≥ 1.3.2 pour toutes les applications l'embarquant. " +
				"Si spyware suspecté : contacter Citizen Lab ou Amnesty Tech.",
		},
		{
			id:   "CVE-2021-26084",
			cvss: 9.8, severity: models.SeverityCritical,
			products:  "Atlassian Confluence Server et Data Center — toutes versions avant 6.13.23/7.4.11/7.11.6/7.12.5/7.13.0",
			published: "2021-08-25",
			description: "OGNL injection pré-authentification dans Atlassian Confluence. " +
				"Permet l'exécution de code arbitraire sans authentification via une requête HTTP vers l'endpoint /pages/createpage-entervariables.action. " +
				"Exploitation massive in-the-wild dans les 72h suivant la publication, notamment pour déployer des crypto-miners (Kinsing, Muhstik). " +
				"Des serveurs exposés sur Internet compromis en quelques minutes.",
			notes: "Patch : mettre à jour Confluence vers les versions corrigées. " +
				"Si impossible à patcher immédiatement : désactiver Confluence ou le mettre hors ligne. " +
				"Ne jamais exposer Confluence directement sur Internet sans authentification renforcée.",
		},
		{
			id:   "CVE-2022-47966",
			cvss: 9.8, severity: models.SeverityCritical,
			products:  "Zoho ManageEngine — 24+ produits (ServiceDesk Plus, ADSelfService, Endpoint Central...)",
			published: "2023-01-10",
			description: "RCE non authentifiée dans de nombreux produits Zoho ManageEngine via une vulnérabilité SAML. " +
				"Exploite une version vulnérable d'Apache Santuario (xmlsec) lors du traitement des assertions SAML. " +
				"Exploitable uniquement si SAML SSO est/a été activé au moins une fois. " +
				"Exploitée par des groupes APT (espionnage) et ransomware dès les premiers jours.",
			notes: "Patch : mettre à jour chaque produit ManageEngine vers la version corrigée (liste sur site Zoho). " +
				"Vérifier si SAML SSO est activé : Settings > Authentication > SAML SSO. " +
				"Auditer les logs pour des accès non authentifiés anormaux.",
		},
	}

	for _, s := range seeds {
		var count int64
		DB.Model(&models.CVEEntry{}).Where("cve_id = ?", s.id).Count(&count)
		if count > 0 {
			continue
		}
		pub := time.Now()
		if s.published != "" {
			if t, err := time.Parse("2006-01-02", s.published); err == nil {
				pub = t
			}
		}
		entry := models.CVEEntry{
			CVEID:       s.id,
			Description: s.description,
			CVSSScore:   s.cvss,
			Severity:    s.severity,
			Products:    s.products,
			Notes:       s.notes,
			Status:      models.CVEStatusNew,
			PublishedAt: pub,
		}
		if err := DB.Create(&entry).Error; err != nil {
			return err
		}
	}
	return nil
}

func normalizeSeverity(s string) models.CVESeverity {
	switch strings.ToLower(s) {
	case "critical":
		return models.SeverityCritical
	case "high":
		return models.SeverityHigh
	case "medium":
		return models.SeverityMedium
	case "low":
		return models.SeverityLow
	default:
		return models.SeverityNone
	}
}

// FetchNVDOnline appelle l'API NVD v2 avec les paramètres fournis et retourne la réponse prête à être importée.
// Si une clé API est stockée dans AppSetting (key "nvd_api_key"), elle sera utilisée pour augmenter les limites.
func FetchNVDOnline(req models.NVDOnlineRequest) (*models.NVDOnlineResponse, error) {
	// Valeurs par défaut
	if req.ResultsPerPage <= 0 {
		req.ResultsPerPage = 100
	}
	if req.ResultsPerPage > 2000 {
		req.ResultsPerPage = 2000
	}
	if req.Page <= 0 {
		req.Page = 1
	}
	startIndex := (req.Page - 1) * req.ResultsPerPage

	// Récupérer la clé API si configurée
	var apiKey string
	var setting models.AppSetting
	if err := DB.Where("key = ?", "nvd_api_key").First(&setting).Error; err == nil {
		apiKey = setting.Value
	}

	// Construction de l'URL NVD v2.
	// Règle importante : pubStartDate et pubEndDate doivent TOUJOURS être fournis ensemble.
	// Si seul pubStartDate est renseigné, on calcule automatiquement pubEndDate = pubStartDate + 30j
	// (plafonné à maintenant pour éviter les dates futures sans données).
	baseURL := "https://services.nvd.nist.gov/rest/json/cves/2.0"

	startDate, endDate := resolveNVDDateRange(req.PubStartDate, req.PubEndDate)

	params := url.Values{}
	if startDate != "" {
		params.Set("pubStartDate", startDate)
		params.Set("pubEndDate", endDate)
	}
	if req.CVSSMin >= 9.0 {
		params.Set("cvssV3Severity", "CRITICAL")
	}
	if req.Keyword != "" {
		params.Set("keywordSearch", req.Keyword)
	}
	params.Set("resultsPerPage", fmt.Sprintf("%d", req.ResultsPerPage))
	params.Set("startIndex", fmt.Sprintf("%d", startIndex))

	fullURL := baseURL + "?" + params.Encode()

	log.Printf("[NVD] URL appelée: %s", fullURL)
	if apiKey != "" {
		log.Printf("[NVD] Clé API configurée (rate limit élevé)")
	} else {
		log.Printf("[NVD] Aucune clé API — limite: 5 req/30s (configurez 'nvd_api_key' dans les paramètres)")
	}

	// Préparer la requête HTTP
	httpReq, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, fmt.Errorf("construction requête: %w", err)
	}
	if apiKey != "" {
		httpReq.Header.Set("apiKey", apiKey)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("appel API NVD: %w", err)
	}
	defer resp.Body.Close()

	log.Printf("[NVD] Réponse HTTP status: %d", resp.StatusCode)

	if resp.StatusCode == http.StatusNotFound {
		// NVD retourne 404 quand aucune CVE ne correspond aux criteres (comportement documente).
		// Ce n'est pas une erreur : on retourne une reponse vide.
		log.Printf("[NVD] 404 = aucune CVE trouvee pour ces criteres (normal)")
		return &models.NVDOnlineResponse{}, nil
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("[NVD] Erreur NVD body: %s", string(body))
		return nil, fmt.Errorf("NVD API erreur %d: %s", resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("lecture réponse: %w", err)
	}

	log.Printf("[NVD] Body reçu (%d octets), décodage JSON...", len(body))

	var nvdResp models.NVDOnlineResponse
	if err := json.Unmarshal(body, &nvdResp); err != nil {
		log.Printf("[NVD] Erreur décodage JSON: %v — début du body: %.200s", err, string(body))
		return nil, fmt.Errorf("décodage JSON: %w", err)
	}

	if req.CVSSMin > 0 {
		filtered := nvdResp.Vulnerabilities[:0]
		for _, item := range nvdResp.Vulnerabilities {
			if extractNVDItemScore(item) >= req.CVSSMin {
				filtered = append(filtered, item)
			}
		}
		nvdResp.Vulnerabilities = filtered
	}

	log.Printf("[NVD] Décodage OK — totalResults=%d, vulnerabilities=%d, itemsPerPage=%d",
		nvdResp.TotalResults, len(nvdResp.Vulnerabilities), nvdResp.ItemsPerPage)

	return &nvdResp, nil
}

// FetchAndImportNVDAll pagine l'API NVD complètement et importe chaque page en base au fil de l'eau.
// Retourne : created (insérées), skipped (doublons), total (totalResults NVD), fetched (reçues sur ce run).
// Respecte le rate limit NVD : 6 s entre pages sans clé API, 700 ms avec clé.
// Si MaxPages > 0 dans req, s'arrête après ce nombre de pages.
// Les erreurs HTTP sur une page sont loggées et n'interrompent pas l'import.
func FetchAndImportNVDAll(req models.NVDOnlineRequest) (created, skipped, total, fetched int, err error) {
	// Valeurs par défaut
	if req.ResultsPerPage <= 0 {
		req.ResultsPerPage = 100
	}
	if req.ResultsPerPage > 2000 {
		req.ResultsPerPage = 2000
	}

	// Récupérer la clé API une seule fois
	var apiKey string
	var setting models.AppSetting
	if dbErr := DB.Where("key = ?", "nvd_api_key").First(&setting).Error; dbErr == nil {
		apiKey = setting.Value
	}

	delay := 6 * time.Second
	if apiKey != "" {
		delay = 700 * time.Millisecond
	}

	baseURL := "https://services.nvd.nist.gov/rest/json/cves/2.0"
	startDate, endDate := resolveNVDDateRange(req.PubStartDate, req.PubEndDate)
	client := &http.Client{Timeout: 30 * time.Second}

	buildURL := func(startIndex int) string {
		params := url.Values{}
		if startDate != "" {
			params.Set("pubStartDate", startDate)
			params.Set("pubEndDate", endDate)
		}
		if req.CVSSMin >= 9.0 {
			params.Set("cvssV3Severity", "CRITICAL")
		}
		if req.Keyword != "" {
			params.Set("keywordSearch", req.Keyword)
		}
		params.Set("resultsPerPage", fmt.Sprintf("%d", req.ResultsPerPage))
		params.Set("startIndex", fmt.Sprintf("%d", startIndex))
		return baseURL + "?" + params.Encode()
	}

	fetchPage := func(startIndex int) (*models.NVDOnlineResponse, int, error) {
		fullURL := buildURL(startIndex)
		httpReq, reqErr := http.NewRequest("GET", fullURL, nil)
		if reqErr != nil {
			return nil, 0, reqErr
		}
		if apiKey != "" {
			httpReq.Header.Set("apiKey", apiKey)
		}
		resp, doErr := client.Do(httpReq)
		if doErr != nil {
			return nil, 0, doErr
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusNotFound {
			return &models.NVDOnlineResponse{}, 0, nil
		}
		body, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != http.StatusOK {
			return nil, 0, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body))
		}
		var nvdResp models.NVDOnlineResponse
		if jsonErr := json.Unmarshal(body, &nvdResp); jsonErr != nil {
			return nil, 0, fmt.Errorf("JSON: %w", jsonErr)
		}
		rawCount := len(nvdResp.Vulnerabilities)
		// Filtrage local par score si CVSSMin ne correspond pas à un niveau exact
		if req.CVSSMin > 0 {
			filtered := nvdResp.Vulnerabilities[:0]
			for _, item := range nvdResp.Vulnerabilities {
				if extractNVDItemScore(item) >= req.CVSSMin {
					filtered = append(filtered, item)
				}
			}
			nvdResp.Vulnerabilities = filtered
		}
		return &nvdResp, rawCount, nil
	}

	// Page 1 — découverte de totalResults
	log.Printf("[NVD] Démarrage import paginé — resultsPerPage=%d, cvssMin=%.1f, délai=%v",
		req.ResultsPerPage, req.CVSSMin, delay)

	firstPage, rawCount, fetchErr := fetchPage(0)
	if fetchErr != nil {
		return 0, 0, 0, 0, fmt.Errorf("page 1: %w", fetchErr)
	}

	total = firstPage.TotalResults
	totalPages := (total + req.ResultsPerPage - 1) / req.ResultsPerPage
	if totalPages == 0 {
		totalPages = 1
	}
	if req.MaxPages > 0 && totalPages > req.MaxPages {
		totalPages = req.MaxPages
	}

	log.Printf("[NVD] totalResults=%d → %d pages à importer", total, totalPages)

	// Import page 1
	fetched += rawCount
	c1, s1, _ := ImportNVD(firstPage.Vulnerabilities)
	created += c1
	skipped += s1
	log.Printf("[NVD] Page 1/%d — startIndex=0, brut=%d, après filtre=%d, créées=%d, skippées=%d",
		totalPages, rawCount, len(firstPage.Vulnerabilities), c1, s1)

	// Pages suivantes
	for pageNum := 2; pageNum <= totalPages; pageNum++ {
		time.Sleep(delay)
		startIndex := (pageNum - 1) * req.ResultsPerPage
		page, raw, pageErr := fetchPage(startIndex)
		if pageErr != nil {
			log.Printf("[NVD] Page %d/%d — erreur (ignorée): %v", pageNum, totalPages, pageErr)
			continue
		}
		fetched += raw
		c, s, _ := ImportNVD(page.Vulnerabilities)
		created += c
		skipped += s
		log.Printf("[NVD] Page %d/%d — startIndex=%d, brut=%d, après filtre=%d, créées=%d, skippées=%d",
			pageNum, totalPages, startIndex, raw, len(page.Vulnerabilities), c, s)
	}

	log.Printf("[NVD] Import terminé — totalResults NVD=%d, brut reçues=%d, après filtre=%d, créées=%d, skippées=%d",
		total, fetched, created+skipped, created, skipped)
	return created, skipped, total, fetched, nil
}

// resolveNVDDateRange s'assure que les deux bornes de date sont présentes.
// L'API NVD v2 exige pubStartDate ET pubEndDate ensemble (max 120 jours d'écart).
// Si endDate est vide, on calcule endDate = startDate + 30 jours, plafonné à maintenant.
func resolveNVDDateRange(startISO, endISO string) (string, string) {
	if startISO == "" {
		return "", ""
	}

	start := parseAnyDate(startISO)
	if start.IsZero() {
		log.Printf("[NVD] Impossible de parser pubStartDate=%q", startISO)
		return startISO, endISO
	}

	var end time.Time
	if endISO != "" {
		end = parseAnyDate(endISO)
	}
	if end.IsZero() {
		// Auto-calculer : start + 30 jours, plafonné à maintenant
		end = start.AddDate(0, 0, 30)
		if end.After(time.Now().UTC()) {
			end = time.Now().UTC()
		}
		log.Printf("[NVD] pubEndDate absent — calculé automatiquement: %s", end.Format("2006-01-02"))
	}

	// Format NVD v2 : "yyyy-MM-ddTHH:mm:ss.000" (UTC implicite, sans timezone)
	return start.UTC().Format("2006-01-02T15:04:05.000"),
		end.UTC().Format("2006-01-02T15:04:05.000")
}

// parseAnyDate tente plusieurs formats courants pour parser une date.
func parseAnyDate(s string) time.Time {
	formats := []string{
		"2006-01-02T15:04:05.000Z",
		"2006-01-02T15:04:05Z",
		"2006-01-02T15:04:05.000 +0000",
		"2006-01-02T15:04:05",
		"2006-01-02",
	}
	for _, f := range formats {
		if t, err := time.Parse(f, s); err == nil {
			return t
		}
	}
	return time.Time{}
}

func extractNVDItemScore(item models.NVDImportItem) float64 {
	if len(item.CVE.Metrics.V31) > 0 {
		return item.CVE.Metrics.V31[0].CVSSData.BaseScore
	}
	if len(item.CVE.Metrics.V30) > 0 {
		return item.CVE.Metrics.V30[0].CVSSData.BaseScore
	}
	if len(item.CVE.Metrics.V2) > 0 {
		return item.CVE.Metrics.V2[0].CVSSData.BaseScore
	}
	return 0
}

