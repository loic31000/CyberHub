package store

import (
	"errors"

	"github.com/cyber-hub/cyber-hub/internal/models"
	"gorm.io/gorm"
)

func ListPlaybooks(page, limit int, search ...string) ([]models.Playbook, int64, error) {
	var total int64

	base := DB.Model(&models.Playbook{})
	// Filtre de recherche (variadic pour rétrocompatibilité avec les appelants existants)
	if len(search) > 0 && search[0] != "" {
		like := "%" + search[0] + "%"
		base = base.Where("title LIKE ? OR scenario LIKE ? OR description LIKE ?", like, like, like)
	}
	base.Count(&total)

	q := base.Preload("Steps", func(db *gorm.DB) *gorm.DB {
		return db.Order("\"order\" ASC")
	}).Order("created_at DESC")
	if page > 0 && limit > 0 {
		q = q.Offset((page - 1) * limit).Limit(limit)
	}
	var items []models.Playbook
	err := q.Find(&items).Error
	return items, total, err
}

func GetPlaybookByID(id uint) (*models.Playbook, error) {
	var item models.Playbook
	err := DB.Preload("Steps", func(db *gorm.DB) *gorm.DB {
		return db.Order("\"order\" ASC")
	}).First(&item, id).Error
	return &item, err
}

func CreatePlaybook(req *models.PlaybookCreateRequest) (*models.Playbook, error) {
	pb := models.Playbook{
		Title: req.Title, Scenario: req.Scenario, Description: req.Description,
	}
	for i, s := range req.Steps {
		order := s.Order
		if order == 0 {
			order = i + 1
		}
		pb.Steps = append(pb.Steps, models.PlaybookStep{Content: s.Content, Order: order})
	}
	err := DB.Create(&pb).Error
	return &pb, err
}

func UpdatePlaybook(id uint, req *models.PlaybookCreateRequest) (*models.Playbook, error) {
	pb, err := GetPlaybookByID(id)
	if err != nil {
		return nil, err
	}

	pb.Title = req.Title
	pb.Scenario = req.Scenario
	pb.Description = req.Description

	// Remplacer les steps : supprimer les anciens, recréer
	DB.Where("playbook_id = ?", id).Delete(&models.PlaybookStep{})
	pb.Steps = nil
	for i, s := range req.Steps {
		order := s.Order
		if order == 0 {
			order = i + 1
		}
		pb.Steps = append(pb.Steps, models.PlaybookStep{PlaybookID: id, Content: s.Content, Order: order})
	}

	if err = DB.Session(&gorm.Session{FullSaveAssociations: true}).Save(pb).Error; err != nil {
		return nil, err
	}
	return GetPlaybookByID(id)
}

func DeletePlaybook(id uint) error {
	return DB.Delete(&models.Playbook{}, id).Error
}

// ToggleStep coche/décoche une étape d'un playbook
func ToggleStep(playbookID, stepID uint) (*models.PlaybookStep, error) {
	var step models.PlaybookStep
	if err := DB.Where("id = ? AND playbook_id = ?", stepID, playbookID).First(&step).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("étape non trouvée")
		}
		return nil, err
	}
	step.Checked = !step.Checked
	err := DB.Save(&step).Error
	return &step, err
}

// ResetPlaybook remet toutes les étapes à non-cochées
func ResetPlaybook(id uint) error {
	return DB.Model(&models.PlaybookStep{}).
		Where("playbook_id = ?", id).
		Update("checked", false).Error
}

// SeedPlaybooks insère les playbooks de référence s'ils sont absents (upsert par titre).
func SeedPlaybooks() error {
	playbooks := []models.PlaybookCreateRequest{
		{
			Title: "Réponse Ransomware", Scenario: "ransomware",
			Description: "Procédure de réponse à une infection ransomware. Contenir, éradiquer, récupérer.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🔴 ISOLER immédiatement les machines infectées du réseau (débrancher câble / désactiver WiFi)"},
				{Content: "📸 Prendre des captures d'écran des messages du ransomware et noter l'heure de détection"},
				{Content: "🔍 Identifier les systèmes affectés via les logs de l'EDR/SIEM"},
				{Content: "🚫 Bloquer les communications C2 au firewall (IPs/domaines suspects dans les logs réseau)"},
				{Content: "💾 Vérifier l'état des sauvegardes (sont-elles compromises ?)"},
				{Content: "🔬 Collecter un dump mémoire des machines infectées avant extinction (Volatility)"},
				{Content: "🏷️ Identifier la famille de ransomware (ID Ransomware : https://id-ransomware.malwarehunterteam.com)"},
				{Content: "📢 Notifier les responsables et l'équipe juridique (obligation légale RGPD si données personnelles)"},
				{Content: "🔄 Restaurer depuis sauvegardes propres après nettoyage complet"},
				{Content: "🔐 Changer tous les mots de passe compromis (AD, services exposés)"},
				{Content: "📝 Rédiger le rapport d'incident avec timeline complète"},
				{Content: "✅ Post-mortem : identifier le vecteur initial et corriger la faille"},
			},
		},
		{
			Title: "Investigation Phishing", Scenario: "phishing",
			Description: "Analyse d'un email de phishing signalé et réponse aux compromissions éventuelles.",
			Steps: []models.PlaybookStepRequest{
				{Content: "📧 Récupérer le mail suspect (headers complets + pièces jointes en sandbox)"},
				{Content: "🔍 Analyser les headers : vérifier SPF/DKIM/DMARC, tracer le serveur d'envoi"},
				{Content: "🔗 Extraire et analyser les URLs (VirusTotal, URLScan.io) — NE PAS cliquer directement"},
				{Content: "📎 Scanner les pièces jointes en sandbox (Any.run, Joe Sandbox)"},
				{Content: "👥 Identifier tous les destinataires du mail suspect"},
				{Content: "❓ Vérifier si des utilisateurs ont cliqué sur les liens (proxy logs, DNS logs)"},
				{Content: "🔑 Si credentials saisis : forcer le reset des mots de passe concernés"},
				{Content: "🖥️ Si exécution de payload : isoler les machines et lancer une investigation forensique"},
				{Content: "🚫 Bloquer le domaine/IP expéditeur au filtre email et au firewall"},
				{Content: "📤 Supprimer le mail de toutes les boîtes de réception (purge admin)"},
				{Content: "🎓 Informer les utilisateurs concernés et sensibiliser l'équipe"},
				{Content: "📝 Documenter l'incident et les IOCs dans la base de veille"},
			},
		},
		{
			Title: "Brute Force SSH/RDP détecté", Scenario: "brute-force",
			Description: "Réponse à une tentative de brute force détectée sur les services d'accès distant.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🚨 Confirmer la détection : analyser les logs auth (/var/log/auth.log ou Event ID 4625)"},
				{Content: "📊 Quantifier l'attaque : nb de tentatives, IPs sources, comptes ciblés, plage horaire"},
				{Content: "🚫 Bloquer l'IP attaquante immédiatement (iptables, firewall, fail2ban)"},
				{Content: "🌍 Vérifier si l'IP source est un VPN/proxy/TOR (AbuseIPDB, Shodan)"},
				{Content: "🔓 Vérifier si une connexion a réussi (Event ID 4624 / sshd: Accepted)"},
				{Content: "🔍 Si connexion réussie : auditer toutes les actions du compte compromis"},
				{Content: "🔐 Forcer le reset du mot de passe du/des comptes ciblés"},
				{Content: "🔑 Activer l'authentification par clé SSH, désactiver le password auth"},
				{Content: "⚙️ Configurer fail2ban ou Windows Account Lockout Policy"},
				{Content: "🔒 Changer le port SSH/RDP par défaut si ce n'est pas fait"},
				{Content: "📝 Enregistrer les IOCs et documenter l'incident"},
			},
		},
		{
			Title: "Compromission Active Directory", Scenario: "active-directory",
			Description: "Réponse à une suspicion de compromission du domaine Active Directory.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🚨 Identifier les premiers indicateurs : EventID 4768/4769 (Kerberoasting), 4728 (ajout groupe Admin)"},
				{Content: "🔍 Lancer BloodHound en lecture seule pour cartographier les chemins d'attaque"},
				{Content: "🔑 Vérifier les comptes admin domain : qui est dans Domain Admins ? Changements récents ?"},
				{Content: "📋 Auditer les GPO modifiées récemment (Get-GPO -All | Sort LastModified)"},
				{Content: "🖥️ Vérifier les connexions admin récentes sur les DC (Event ID 4624 sur les contrôleurs)"},
				{Content: "💾 Vérifier si NTDS.dit a été dumped (accès suspect à C:\\Windows\\NTDS)"},
				{Content: "🔐 Réinitialiser le mot de passe KRBTGT (2 fois, 10h entre les deux réinitialisation)"},
				{Content: "👤 Désactiver les comptes compromis et forcer reset de tous les comptes Admin"},
				{Content: "🛡️ Appliquer la stratégie de Tiering AD (T0/T1/T2)"},
				{Content: "🔒 Activer Protected Users Security Group pour les comptes sensibles"},
				{Content: "📡 Activer la journalisation avancée (Audit Policy) sur les DC"},
				{Content: "📝 Rédiger le rapport et planifier un pentest AD pour valider le remediation"},
			},
		},
		{
			Title: "Détection Exfiltration de Données", Scenario: "data-exfiltration",
			Description: "Réponse à une suspicion d'exfiltration de données sensibles.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🔍 Analyser les logs réseau : volumes de données sortants anormaux, destinations inconnues"},
				{Content: "🌐 Identifier les IPs/domaines de destination (Threat Intel, VirusTotal, Shodan)"},
				{Content: "🖥️ Identifier la machine source des transferts suspects"},
				{Content: "🔬 Audit forensique de la machine : processus, connexions, historique navigateur, transferts FTP/cloud"},
				{Content: "🚫 Bloquer les destinations au firewall et isoler la machine si compromission confirmée"},
				{Content: "📁 Identifier les données exfiltrées : classification, volume, sensibilité"},
				{Content: "📢 Notifier DPO + RSSI (obligation RGPD : 72h pour notifier la CNIL si données personnelles)"},
				{Content: "🔑 Révoquer les accès de la machine/compte compromis"},
				{Content: "📸 Préserver les preuves : dumps, logs, captures réseau (chaîne de custody)"},
				{Content: "🕵️ Remonter à l'infection initiale : comment l'attaquant est entré ?"},
				{Content: "📝 Documenter l'incident complet avec timeline pour le rapport légal"},
			},
		},
		{
			Title: "Web Shell Détecté", Scenario: "web-shell",
			Description: "Réponse à la découverte d'un web shell sur un serveur web. Contenir, éradiquer et renforcer.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🚨 Confirmer la détection : analyser le fichier suspect (extension .php/.aspx/.jsp, nom inhabituel, modification récente)"},
				{Content: "📸 Préserver le fichier et les logs sans le supprimer (preuves pour analyse forensique)"},
				{Content: "🔍 Analyser le contenu du web shell : fonctionnalités (exec, upload, reverse shell), obfuscation"},
				{Content: "📋 Examiner les logs du serveur web (access.log) : IP sources, User-Agents, requêtes vers le shell"},
				{Content: "🕐 Déterminer la date de dépôt du shell et les actions effectuées depuis"},
				{Content: "🔎 Chercher d'autres shells : find /var/www -name '*.php' -newer /var/www/index.php"},
				{Content: "🌐 Identifier les IPs attaquantes et bloquer au firewall"},
				{Content: "🔑 Auditer tous les comptes du serveur : mots de passe, clés SSH, crontabs"},
				{Content: "🔒 Isoler le serveur du réseau pendant l'investigation si compromission confirmée"},
				{Content: "🗑️ Supprimer le web shell et tous les fichiers déposés par l'attaquant"},
				{Content: "🔧 Identifier et corriger la vulnérabilité initiale (upload non sécurisé, RCE, LFI...)"},
				{Content: "⚙️ Renforcer : désactiver exec PHP si non nécessaire, WAF, monitoring d'intégrité (AIDE/Tripwire)"},
				{Content: "📝 Documenter la timeline complète et les IOCs"},
			},
		},
		{
			Title: "Supply Chain Attack", Scenario: "supply-chain",
			Description: "Réponse à une compromission via la chaîne d'approvisionnement logicielle (dépendance, build, update).",
			Steps: []models.PlaybookStepRequest{
				{Content: "🚨 Identifier le composant compromis : dépendance npm/pip/maven, binaire, image Docker, update système"},
				{Content: "📦 Identifier toutes les applications/systèmes utilisant le composant compromis"},
				{Content: "🔍 Analyser le code malveillant injecté : nature (backdoor, exfiltration, crypto-miner), portée"},
				{Content: "📋 Vérifier les logs d'installation : quand le composant compromis a-t-il été installé ?"},
				{Content: "🖥️ Auditer les systèmes exposés : connexions sortantes anormales, nouveaux processus, modifications"},
				{Content: "🚫 Isoler les systèmes compromis du réseau"},
				{Content: "🔄 Remplacer le composant compromis par une version saine et vérifiée (hash/signature)"},
				{Content: "🔑 Considérer toutes les credentials présentes sur les systèmes affectés comme compromises — rotation complète"},
				{Content: "🔎 Rechercher des artefacts de persistance : crontabs, services, clés de registre, backdoors"},
				{Content: "📢 Notifier les parties prenantes et fournisseur du composant compromis"},
				{Content: "🛡️ Mettre en place le lock des versions (package-lock.json, requirements.txt pinné, Dockerfile FROM sha256)"},
				{Content: "✅ Implémenter un SBOM (Software Bill of Materials) pour tracer toutes les dépendances"},
				{Content: "📝 Post-mortem : évaluer les contrôles de sécurité de la chaîne CI/CD et améliorer"},
			},
		},
		{
			Title: "Attaque DDoS", Scenario: "ddos",
			Description: "Réponse à une attaque par déni de service distribué ciblant l'infrastructure.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🚨 Confirmer l'attaque : analyser les métriques réseau (bande passante, PPS, connexions simultanées)"},
				{Content: "🔍 Identifier le type d'attaque : volumétrique (UDP flood, ICMP), protocole (SYN flood), applicatif (HTTP flood, Slowloris)"},
				{Content: "📊 Quantifier l'impact : services affectés, latence, taux de perte de paquets"},
				{Content: "📞 Contacter le FAI / opérateur upstream pour demander un blackholing ou filtrage en amont (BGP Blackhole)"},
				{Content: "🛡️ Activer le service anti-DDoS s'il existe (Cloudflare, Akamai, OVH VAC, AWS Shield)"},
				{Content: "🔒 Activer le mode 'Under Attack' sur le WAF/CDN (challenge CAPTCHA, JS challenge)"},
				{Content: "⚙️ Appliquer des règles de rate-limiting au firewall/load balancer sur les IPs sources identifiées"},
				{Content: "🌐 Identifier les IPs sources (attention : souvent spoofées) — se concentrer sur les ASN et ranges"},
				{Content: "📡 Mettre en place un scrubbing center ou router le trafic via un service de mitigation"},
				{Content: "🔄 Activer les serveurs de secours / CDN géographiques pour absorber le trafic"},
				{Content: "📈 Surveiller les métriques en temps réel jusqu'à retour à la normale"},
				{Content: "📝 Post-mortem : documenter la timeline, améliorer le plan de capacité et les règles de mitigation"},
			},
		},
		{
			Title: "Menace Interne (Insider Threat)", Scenario: "insider-threat",
			Description: "Investigation sur un employé ou prestataire suspecté de comportement malveillant.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🔐 Limiter la diffusion de l'information : impliquer uniquement RH, juridique et RSSI"},
				{Content: "📋 Définir le périmètre : quels systèmes, données ou accès le suspect possède-t-il ?"},
				{Content: "🔍 Collecter silencieusement les logs (SIEM, DLP, badge, proxy) sans alerter le suspect"},
				{Content: "💾 Analyser les logs de copie de données : clé USB, email sortant, cloud personnel (OneDrive, Dropbox perso)"},
				{Content: "🌐 Examiner les logs proxy/DNS : accès à des sites de partage de fichiers ou dark web"},
				{Content: "🖥️ Vérifier les accès inhabituels : heures anormales, systèmes auxquels il n'a pas accès normalement"},
				{Content: "📊 Corréler avec les données DLP : fichiers sensibles ouverts, imprimés ou téléchargés récemment"},
				{Content: "📸 Préserver les preuves légalement (chain of custody) avant toute action disciplinaire"},
				{Content: "⚖️ Consulter le service juridique avant de procéder à des actions sur le compte"},
				{Content: "🔑 Révoquer les accès de manière coordonnée avec RH (lors d'un entretien si licenciement)"},
				{Content: "🔒 Auditer tous les accès tiers (VPN, API keys, comptes partagés) liés à la personne"},
				{Content: "📝 Documenter chaque étape pour dossier légal — respecter le RGPD dans la collecte de preuves"},
			},
		},
		{
			Title: "Compromission Cloud AWS/Azure", Scenario: "cloud-breach",
			Description: "Réponse à une compromission d'un compte ou de ressources cloud (AWS, Azure, GCP).",
			Steps: []models.PlaybookStepRequest{
				{Content: "🚨 Identifier les IOCs : accès inhabituels dans CloudTrail/Activity Logs, nouvelles ressources, régions inhabituelles"},
				{Content: "🔑 Identifier les credentials compromises : clé API, rôle IAM, compte utilisateur"},
				{Content: "🚫 Révoquer immédiatement les clés d'accès compromises (IAM > Access Keys > Delete)"},
				{Content: "🔍 Lister toutes les ressources créées/modifiées par les credentials compromises (CloudTrail, Azure Monitor)"},
				{Content: "💰 Vérifier la facturation : ressources coûteuses créées (instances GPU pour crypto-mining ?)"},
				{Content: "🌍 Vérifier les nouvelles règles de firewall/Security Group : ports ouverts au monde (0.0.0.0/0)"},
				{Content: "📁 Vérifier les buckets S3/Blob Storage : accès publics, données exfiltrées, politiques modifiées"},
				{Content: "👤 Auditer les nouveaux utilisateurs IAM/AAD créés par l'attaquant (persistance)"},
				{Content: "🔬 Analyser les instances EC2/VM compromises : snapshots forensiques avant suppression"},
				{Content: "🔄 Appliquer le principe de moindre privilège sur tous les rôles IAM (refonte des permissions)"},
				{Content: "🛡️ Activer AWS GuardDuty / Microsoft Defender for Cloud si non actif"},
				{Content: "📝 Documenter l'incident et vérifier les obligations de notification (selon données stockées)"},
			},
		},
		{
			Title: "Zero-Day — Réponse d'Urgence", Scenario: "zero-day",
			Description: "Procédure de réponse d'urgence lors de la publication d'une vulnérabilité zero-day activement exploitée.",
			Steps: []models.PlaybookStepRequest{
				{Content: "📰 Confirmer la vulnérabilité : lire l'advisory officiel (CERT-FR, NVD, vendor) — noter CVE, CVSS, vecteur"},
				{Content: "🔎 Inventorier les systèmes affectés : quelles versions sont déployées en prod, staging, DMZ ?"},
				{Content: "⚡ Évaluer l'exploitabilité : exploit public disponible ? Exploitation active in-the-wild ?"},
				{Content: "🛡️ Appliquer les mitigations temporaires du vendor : désactiver feature, règle WAF, workaround"},
				{Content: "🔒 Isoler les systèmes les plus exposés (accessibles depuis Internet) le temps du patch"},
				{Content: "🔍 Chercher les IOCs de compromission : le système était-il déjà exploité avant la découverte ?"},
				{Content: "📦 Tester le patch en environnement de staging avant déploiement production"},
				{Content: "🚀 Déployer le patch en production selon la criticité (CVSS ≥ 9 : < 24h, CVSS 7-8 : < 72h)"},
				{Content: "🛡️ Ajouter une règle IDS/IPS et WAF pour détecter les tentatives d'exploitation"},
				{Content: "📊 Surveiller les logs des systèmes patchés pendant 48h post-déploiement"},
				{Content: "📝 Mettre à jour le registre des vulnérabilités et la veille CVE"},
			},
		},
		{
			Title: "Mouvement Latéral Détecté", Scenario: "lateral-movement",
			Description: "Investigation sur un attaquant se déplaçant horizontalement dans le réseau après compromission initiale.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🚨 Identifier le point d'entrée initial : quelle machine est le patient zéro ?"},
				{Content: "🗺️ Cartographier le mouvement : quelles machines ont été atteintes, dans quel ordre ?"},
				{Content: "🔍 Analyser les méthodes utilisées : Pass-the-Hash (Event 4624 type 3), PsExec, WMI, SMB"},
				{Content: "📋 Identifier les credentials utilisées : hash NTLM, tickets Kerberos, mots de passe en clair"},
				{Content: "🖥️ Vérifier les connexions RDP/SMB entre postes (Event ID 4624, 4648) sur la période suspecte"},
				{Content: "🚫 Segmenter le réseau : bloquer les connexions SMB/RDP inter-postes via ACL ou firewall"},
				{Content: "🔑 Réinitialiser tous les comptes dont les credentials ont été utilisées dans le mouvement"},
				{Content: "🔐 Activer Credential Guard sur les machines Windows pour prévenir l'extraction de hash"},
				{Content: "🧹 Éradiquer les artefacts : outils déposés (Mimikatz, PsExec), schedulé tasks, services créés"},
				{Content: "🔬 Analyse forensique des machines compromises pour identifier les données accédées"},
				{Content: "🛡️ Implémenter la micro-segmentation réseau et le principe de moindre privilège"},
				{Content: "📝 Documenter la kill chain complète (MITRE ATT&CK) pour le rapport d'incident"},
			},
		},
		{
			Title: "Escalade de Privilèges Détectée", Scenario: "privilege-escalation",
			Description: "Réponse à une escalade de privilèges locale ou de domaine détectée sur un système.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🚨 Identifier le compte ciblé et le niveau de privilège atteint (SYSTEM, root, Domain Admin)"},
				{Content: "🔍 Analyser la technique utilisée : CVE d'OS, mauvaise configuration sudo, token impersonation, DLL hijacking"},
				{Content: "📋 Examiner les logs : Event ID 4672 (token spécial), sudo logs, auth.log"},
				{Content: "🖥️ Identifier les actions effectuées avec les privilèges élevés"},
				{Content: "🚫 Révoquer immédiatement les tokens/sessions actifs du compte compromis"},
				{Content: "🔑 Forcer le changement de mot de passe et invalider toutes les sessions"},
				{Content: "🔧 Appliquer le patch si escalade via CVE système non patché"},
				{Content: "⚙️ Corriger la mauvaise configuration exploitée (sudo, SUID, permissions excessives)"},
				{Content: "🔬 Vérifier la persistance installée (crontab root, service, compte admin créé)"},
				{Content: "🛡️ Auditer toutes les configurations sudo, SUID/SGID, capabilities Linux"},
				{Content: "📊 Mettre en place l'audit des commandes sudo (sudoers avec log)"},
				{Content: "📝 Documenter et corriger la vulnérabilité racine"},
			},
		},
		{
			Title: "Injection SQL en Production", Scenario: "sql-injection",
			Description: "Réponse à une exploitation d'injection SQL sur une application en production.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🚨 Identifier l'endpoint vulnérable : analyser les logs WAF/nginx/Apache pour les payloads SQLi"},
				{Content: "🔒 Bloquer immédiatement l'IP attaquante et l'endpoint au WAF ou au niveau reverse proxy"},
				{Content: "📋 Analyser les requêtes SQL exécutées : quelles tables ont été accédées ou modifiées ?"},
				{Content: "💾 Déterminer si des données ont été exfiltrées (SELECT INTO OUTFILE, UNION SELECT)"},
				{Content: "🔑 Vérifier si l'attaquant a tenté d'écrire des webshells (INTO OUTFILE '/var/www/...')"},
				{Content: "👤 Vérifier si des comptes admin ont été créés dans l'application ou la BDD"},
				{Content: "📸 Préserver les logs WAF, applicatifs et base de données comme preuves"},
				{Content: "🔧 Corriger la vulnérabilité : utiliser des requêtes préparées (parameterized queries)"},
				{Content: "🔐 Appliquer le principe de moindre privilège sur le compte DB (pas de FILE, pas de SUPER)"},
				{Content: "📢 Évaluer si des données personnelles ont été exposées → obligation RGPD de notification"},
				{Content: "🛡️ Déployer un WAF avec règles OWASP ModSecurity en mode blocage"},
				{Content: "✅ Scanner toute l'application avec sqlmap pour détecter d'autres points vulnérables"},
			},
		},
		{
			Title: "Infection Malware (non-Ransomware)", Scenario: "malware",
			Description: "Réponse à une infection par malware : trojan, backdoor, crypto-miner, spyware, rootkit.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🚨 Confirmer l'infection : alertes AV/EDR, processus suspects, connexions C2 détectées au SIEM"},
				{Content: "🔍 Identifier le type de malware : analyse comportementale (Any.run) ou statique (VirusTotal, CAPE Sandbox)"},
				{Content: "🖥️ Identifier toutes les machines infectées dans le réseau"},
				{Content: "📸 Prendre un dump mémoire (Volatility) et un snapshot disque avant intervention"},
				{Content: "🚫 Isoler les machines infectées du réseau (VLAN quarantaine ou débranchement câble)"},
				{Content: "🌐 Bloquer les domaines/IPs C2 identifiés au firewall et DNS sinkhole"},
				{Content: "🔎 Chercher les mécanismes de persistance : Run keys, services, tâches planifiées, startup"},
				{Content: "🧹 Éradiquer le malware : supprimer les fichiers, nettoyer le registre, désactiver les services malveillants"},
				{Content: "🔑 Considérer tous les credentials présents sur la machine comme compromis — rotation"},
				{Content: "🔄 Réinstaller le système depuis une image propre si rootkit ou doute sur l'intégrité"},
				{Content: "🔐 Vérifier les autres machines pour propagation (scan réseau, logs SIEM)"},
				{Content: "📝 Analyser le vecteur d'infection initial (pièce jointe, site web, clé USB) et corriger"},
			},
		},
		{
			Title: "Violation API / Tokens Exposés", Scenario: "api-breach",
			Description: "Réponse à une exposition de tokens API, secrets, ou abus d'une API non sécurisée.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🚨 Identifier le token/secret exposé : GitHub leak, logs, code source public, Pastebin, OSINT"},
				{Content: "⚡ Révoquer IMMÉDIATEMENT le token exposé avant toute autre action"},
				{Content: "🔍 Vérifier les logs d'utilisation du token : quand a-t-il été utilisé ? Depuis quelles IPs ?"},
				{Content: "📋 Identifier les actions effectuées avec le token (API calls : GET, POST, DELETE)"},
				{Content: "💾 Vérifier si des données ont été extraites via l'API"},
				{Content: "🌐 Bloquer les IPs suspectes ayant utilisé le token au WAF/firewall"},
				{Content: "🔑 Générer un nouveau token et le stocker dans un gestionnaire de secrets (Vault, AWS Secrets Manager)"},
				{Content: "🔎 Scanner tout le dépôt de code pour d'autres secrets exposés (git-secrets, truffleHog, gitleaks)"},
				{Content: "📢 Évaluer si des données personnelles ont été accédées → notification RGPD si applicable"},
				{Content: "⚙️ Implémenter la rotation automatique des secrets (TTL court)"},
				{Content: "🛡️ Mettre en place des rate limits et une authentification forte sur l'API (OAuth2, OIDC)"},
				{Content: "📝 Documenter et sensibiliser les équipes de dev sur la gestion des secrets"},
			},
		},
		{
			Title: "Pentest Web — Reconnaissance", Scenario: "pentest-web",
			Description: "Phase de reconnaissance méthodique lors d'un test d'intrusion sur une application web.",
			Steps: []models.PlaybookStepRequest{
				{Content: "📋 Valider le périmètre autorisé : lire attentivement le scope du pentest et les règles d'engagement"},
				{Content: "🌐 Enumération passive : WHOIS, DNS (subdomains via amass/subfinder), certificats SSL (crt.sh)"},
				{Content: "🔍 Identifier les technologies : Wappalyzer, whatweb, headers HTTP (X-Powered-By, Server)"},
				{Content: "🗺️ Cartographier l'application : pages, formulaires, endpoints API (spider BurpSuite)"},
				{Content: "🔎 Rechercher des fichiers sensibles exposés : robots.txt, sitemap.xml, .git/, backup.zip, .env"},
				{Content: "📁 Tester les méthodes HTTP autorisées (OPTIONS, PUT, DELETE) sur chaque endpoint"},
				{Content: "🔑 Identifier les mécanismes d'authentification : type, politique de mots de passe, MFA"},
				{Content: "🛡️ Analyser les headers de sécurité : CSP, HSTS, X-Frame-Options, Permissions-Policy"},
				{Content: "⚙️ Scanner les vulnérabilités avec OWASP ZAP (mode actif sur scope autorisé uniquement)"},
				{Content: "💉 Tester manuellement les OWASP Top 10 : SQLi, XSS, IDOR, SSRF, XXE, SSTI"},
				{Content: "📝 Documenter chaque finding avec : preuve, impact, reproduction pas-à-pas, recommandation"},
				{Content: "📊 Classer par criticité CVSS et rédiger le rapport final avec executive summary"},
			},
		},
		{
			Title: "Incident Cloud — Bucket S3 Public", Scenario: "s3-exposure",
			Description: "Réponse à la découverte d'un bucket S3 (ou Azure Blob) accessible publiquement.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🚨 Confirmer l'exposition : tester l'accès public (curl https://<bucket>.s3.amazonaws.com/?list-type=2)"},
				{Content: "🔒 Bloquer l'accès public immédiatement (S3 > Block Public Access > Enable all)"},
				{Content: "📁 Inventorier le contenu exposé : données personnelles ? Credentials ? Propriété intellectuelle ?"},
				{Content: "📋 Analyser les logs d'accès S3 (CloudTrail + S3 Access Logs) : qui a accédé et quand ?"},
				{Content: "🌍 Identifier les IPs ayant accédé au bucket pendant la période d'exposition"},
				{Content: "💾 Vérifier si des données ont été copiées (taille transférée, ListObjects suivi de GetObject massif)"},
				{Content: "🔑 Auditer les permissions IAM : qui a le droit de rendre ce bucket public ?"},
				{Content: "📢 Si données personnelles exposées : notifier DPO → CNIL sous 72h (RGPD)"},
				{Content: "⚙️ Activer AWS Config Rule 's3-bucket-public-read-prohibited' pour prévenir les récidives"},
				{Content: "🛡️ Activer Amazon Macie pour détecter les données sensibles dans S3 automatiquement"},
				{Content: "📝 Documenter l'incident, la durée d'exposition estimée et les actions correctives"},
			},
		},
		{
			Title: "Audit Sécurité Active Directory", Scenario: "ad-audit",
			Description: "Audit de sécurité d'une infrastructure Active Directory pour identifier les faiblesses.",
			Steps: []models.PlaybookStepRequest{
				{Content: "📋 Valider le périmètre et les autorisations écrites avant de commencer"},
				{Content: "🗺️ Collecter les données AD avec BloodHound/SharpHound (mode utilisateur, sans privilège admin)"},
				{Content: "🔑 Identifier les comptes avec droits excessifs : AdminSDHolder, AdminCount=1, Unconstrained Delegation"},
				{Content: "👤 Lister les comptes de service avec SPN (cibles Kerberoasting) : Get-ADUser -Filter {ServicePrincipalName -ne '$null'}"},
				{Content: "🔐 Vérifier la politique de mots de passe : Fine-Grained Password Policy, comptes sans expiration"},
				{Content: "🛡️ Rechercher les GPO dangereuses : scripts logon, logoff avec credentials, droits admin locaux"},
				{Content: "🖥️ Vérifier la configuration des contrôleurs de domaine : LDAP signing, SMB signing, IPv6"},
				{Content: "🔍 Identifier les relations de confiance inter-domaines / inter-forêts"},
				{Content: "⚙️ Tester les attaques AS-REP Roasting : comptes sans pré-auth Kerberos requise"},
				{Content: "🌐 Vérifier les ACL dangereuses : WriteDACL, GenericAll sur des objets sensibles"},
				{Content: "📊 Générer le rapport BloodHound avec les shortest paths vers Domain Admin"},
				{Content: "📝 Rédiger le rapport avec les recommandations de remediation par priorité (Quick wins vs Long terme)"},
			},
		},
	}

	for _, p := range playbooks {
		// Upsert par titre : ne pas recréer si déjà présent
		var count int64
		DB.Model(&models.Playbook{}).Where("title = ?", p.Title).Count(&count)
		if count > 0 {
			continue
		}
		if _, err := CreatePlaybook(&p); err != nil {
			return err
		}
	}
	return nil
}
