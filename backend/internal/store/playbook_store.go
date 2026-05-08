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
		{
			Title: "Analyse Forensique Mémoire (Volatility)", Scenario: "memory-forensics",
			Description: "Acquisition et analyse d'un dump mémoire pour détecter des processus malveillants, rootkits et artefacts.",
			Steps: []models.PlaybookStepRequest{
				{Content: "📸 Acquérir la mémoire vive : `winpmem` ou `LiME` selon l'OS, stocker sur disque externe"},
				{Content: "🔍 Identifier le profil du système : `volatility -f dump.mem imageinfo`"},
				{Content: "📋 Lister les processus suspects : `pslist`, `psscan`, `pstree` — rechercher noms anormaux, PPID étranges"},
				{Content: "🌐 Vérifier les connexions réseau : `netscan` (IPs C2, ports inhabituels)"},
				{Content: "💾 Extraire les DLL injectées : `malfind` puis `dumpfiles` pour analyse"},
				{Content: "🔑 Rechercher des hash de mots de passe : `hashdump` (LSASS)"},
				{Content: "🧵 Analyser les hooks et appels système : `apihooks`, `ssdt`"},
				{Content: "📝 Sauvegarder les artefacts pertinents pour le rapport"},
			},
		},
		{
			Title: "Investigation Logs SIEM (ELK/Splunk)", Scenario: "siem-investigation",
			Description: "Recherche d'attaques via requêtes sur les logs centralisés (Windows, Linux, firewall).",
			Steps: []models.PlaybookStepRequest{
				{Content: "🔍 Définir la fenêtre temporelle suspecte (heure de détection ± 2h)"},
				{Content: "📊 Requêter les logs d'authentification : `4625` (échec), `4624` (succès), trier par IP source"},
				{Content: "🖥️ Chercher exécutions anormales : `4688` (processus créés) avec noms suspects (powershell, wmic, certutil)"},
				{Content: "🔌 Identifier les connexions réseau sortantes : logs firewall vers IPs externes non autorisées"},
				{Content: "🧾 Analyser les modifications de registre : `4657`, `4663` (accès aux objets)"},
				{Content: "📂 Vérifier accès à des fichiers sensibles : `4663` avec `ObjectName` contenant `NTDS.dit` ou `SAM`"},
				{Content: "🤖 Appliquer des règles Sigma connues (via outils comme `sigmac` ou SIEM intégré)"},
				{Content: "📈 Corréler avec les logs EDR pour enrichir les alertes"},
			},
		},
		{
			Title: "CTF — Exploitation de Buffer Overflow", Scenario: "ctf-bof",
			Description: "Démarche pour exploiter un buffer overflow dans un binaire (CTF / lab).",
			Steps: []models.PlaybookStepRequest{
				{Content: "🔍 Identifier la vulnérabilité : `checksec` (NX, ASLR, Canary), `file`, `strings`"},
				{Content: "🐞 Tester le crash : entrée longue (`python -c 'print(\"A\"*100)'`)"},
				{Content: "📏 Calculer l'offset : pattern `msf-pattern_create`, `pattern_offset`"},
				{Content: "🎯 Contourner les protections : si ASLR désactivé, utiliser adresse PLT/GOT"},
				{Content: "🛠️ Construire le payload : shellcode + padding + adresse de retour"},
				{Content: "🔒 Si NX activé, utiliser `ret2libc` ou `ROP`"},
				{Content: "💥 Tester localement, puis sur cible distante (netcat)"},
				{Content: "📝 Documenter l'exploitation : script Python final et preuve capture"},
			},
		},
		{
			Title: "OSINT sur un Nom de Domaine", Scenario: "osint-domain",
			Description: "Collecte d'informations publiques sur un domaine : sous-domaines, historiques, certificats.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🌐 WHOIS : `whois domain.com` (enregistrant, dates, DNS)"},
				{Content: "🔍 Sous-domaines passifs : `sublist3r`, `amass enum -passive -d domain.com`"},
				{Content: "📜 Certificats SSL : `crt.sh` (recherche par domaine, wildcard)"},
				{Content: "🗄️ Archives DNS : `SecurityTrails` (gratuit limité), `DNSdumpster`"},
				{Content: "📧 Emails associés : `theHarvester -d domain.com -b google,bing,linkedin`"},
				{Content: "📸 Captures historiques : `Wayback Machine` (web.archive.org) pour endpoints exposés"},
				{Content: "⚙️ Technologies : `Wappalyzer`, `whatweb`"},
				{Content: "📝 Compiler dans un rapport avec recommandations (surface d'attaque)"},
			},
		},
		{
			Title: "Cheatsheet — Commandes Nmap avancées", Scenario: "nmap-cheatsheet",
			Description: "Guide rapide pour les scans Nmap les plus utiles en investigation.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🔍 Scan rapide des ports courants : `nmap -F <target>`"},
				{Content: "📋 Scan complet TCP avec détection de version : `nmap -sV -sC -p- <target>`"},
				{Content: "🛡️ Scan furtif (SYN) : `nmap -sS -Pn -p <ports> <target>`"},
				{Content: "📡 Découverte réseau : `nmap -sn 192.168.1.0/24` (ping sweep)"},
				{Content: "🖥️ Scripts spécifiques : `nmap --script http-enum,smb-os-discovery <target>`"},
				{Content: "🔑 Vulnérabilités : `nmap --script vuln <target>` (attention : bruyant)"},
				{Content: "⚡ Scan UDP : `nmap -sU -p 53,161,137 <target>`"},
				{Content: "💾 Sauvegarde des résultats : `-oA scan_name` (normal, XML, grepable)"},
			},
		},
		{
			Title: "Détection de Backdoor sur Serveur Linux", Scenario: "linux-backdoor",
			Description: "Recherche de backdoors utilisateur ou noyau sur un serveur Linux compromis.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🔍 Lister les processus anormaux : `ps auxf`, `lsof -i`, `netstat -tulpn`"},
				{Content: "📁 Vérifier les crontabs (root et utilisateurs) : `/etc/crontab`, `crontab -l`"},
				{Content: "🔑 Vérifier les clés SSH : `~/.ssh/authorized_keys` pour chaque compte"},
				{Content: "🧹 Chercher des setuid binaires : `find / -perm -4000 -type f 2>/dev/null`"},
				{Content: "📦 Vérifier les packages installés (rootkits): `rkhunter`, `chkrootkit`"},
				{Content: "🌐 Analyser les modules noyau : `lsmod`, chercher modules inconnus"},
				{Content: "🔄 Examiner les services systemd : `systemctl list-units --type=service --all`"},
				{Content: "📝 Sauvegarder les artefacts suspects pour analyse hors ligne"},
			},
		},
		{
			Title: "Réponse à Incident Kubernetes", Scenario: "k8s-incident",
			Description: "Investigation d'une compromission dans un cluster Kubernetes.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🚨 Identifier le namespace et le pod suspect : `kubectl get pods --all-namespaces`"},
				{Content: "🔍 Voir les logs du pod : `kubectl logs <pod> -n <namespace>`"},
				{Content: "🖥️ Exécuter une commande dans le conteneur : `kubectl exec -it <pod> -- /bin/sh`"},
				{Content: "📋 Vérifier les RBAC : `kubectl get roles,clusterroles,rolebindings --all-namespaces`"},
				{Content: "🔒 Isoler le pod : créer un NetworkPolicy pour bloquer le trafic"},
				{Content: "📸 Capture du manifeste : `kubectl get pod <pod> -o yaml > pod.yaml`"},
				{Content: "🔑 Vérifier les secrets : `kubectl get secrets -n <namespace>` — tokens exposés"},
				{Content: "📡 Auditer l'API server : `kubectl get events --all-namespaces`"},
				{Content: "🚫 Supprimer le pod malveillant et recréer depuis une image propre"},
			},
		},
		{
			Title: "Analyse de Téléchargement Malveillant (Sandbox)", Scenario: "malware-sandbox",
			Description: "Exécution sécurisée d'un fichier suspect dans une sandbox (Cuckoo, CAPE, Any.run).",
			Steps: []models.PlaybookStepRequest{
				{Content: "📥 Télécharger l'échantillon dans un environnement isolé (VM sans réseau ou host-only)"},
				{Content: "📸 Prendre un snapshot avant exécution"},
				{Content: "🧪 Exécuter l'échantillon (si exe) avec monitoring : Process Monitor, Wireshark"},
				{Content: "🌐 Observer les connexions réseau : captures pcap, DNS, HTTP requests"},
				{Content: "📁 Vérifier modifications du système : fichiers créés, clés registre"},
				{Content: "🧠 Analyser les processus enfants et injections"},
				{Content: "🔍 Extraire les IOCs (IP, domaines, hash) via un outil comme `flare-floss` ou manual"},
				{Content: "📤 Partager les IOCs dans Threat Intelligence (si TLP:AMBER)"},
				{Content: "🧹 Restaurer snapshot après analyse"},
			},
		},
		{
			Title: "Configuration de Fail2ban pour SSH", Scenario: "fail2ban-ssh",
			Description: "Mise en place et optimisation de Fail2ban pour protéger SSH contre brute force.",
			Steps: []models.PlaybookStepRequest{
				{Content: "📦 Installer fail2ban : `apt install fail2ban` ou `yum install fail2ban`"},
				{Content: "⚙️ Créer `/etc/fail2ban/jail.local` avec section `[sshd]`"},
				{Content: "📝 Configurer : `enabled = true`, `maxretry = 3`, `bantime = 3600`"},
				{Content: "📁 Définir le fichier log : `logpath = /var/log/auth.log` (Debian) ou `/var/log/secure` (RHEL)"},
				{Content: "🔍 Tester la configuration : `fail2ban-client test`"},
				{Content: "🚀 Démarrer et activer : `systemctl enable fail2ban && systemctl start fail2ban`"},
				{Content: "📊 Voir les règles actives : `fail2ban-client status sshd`"},
				{Content: "🔓 Débloquer une IP : `fail2ban-client set sshd unbanip <IP>`"},
				{Content: "📈 Surveiller les logs : `tail -f /var/log/fail2ban.log`"},
			},
		},
		{
			Title: "CTF — Web SQLi Union-Based", Scenario: "ctf-sqli-union",
			Description: "Exploitation d'une injection SQL UNION pour extraire des données.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🔍 Détecter la vulnérabilité : ajouter `'` ou `\"` dans paramètre, observer erreur SQL"},
				{Content: "📏 Déterminer nombre de colonnes : `ORDER BY n` jusqu'à erreur"},
				{Content: "🔎 Trouver colonnes affichées : UNION SELECT NULL, NULL,... — repérer où les données s'affichent"},
				{Content: "🗄️ Récupérer la base de données : `UNION SELECT database(), user()`"},
				{Content: "📋 Lister les tables : `UNION SELECT table_name FROM information_schema.tables WHERE table_schema=database()`"},
				{Content: "🔑 Extraire les colonnes sensibles (username, password) puis les données"},
				{Content: "✍️ Utiliser `GROUP_CONCAT` pour regrouper plusieurs lignes en une requête"},
				{Content: "📝 Documenter l'exploit avec `sqlmap` automatisé pour confirmation, mais preuve manuelle demandée"},
			},
		},
		{
			Title: "Investigation d'Incident BGP — Détournement de préfixe", Scenario: "bgp-hijack",
			Description: "Réaction à un détournement BGP suspect (route leak, hijack).",
			Steps: []models.PlaybookStepRequest{
				{Content: "🌐 Identifier le préfixe anormal : vérifier via BGPView / RIPE RIS"},
				{Content: "📊 Comparer les routes annoncées : `bgp.he.net` ou `bgp.tools` — AS path suspect"},
				{Content: "🔍 Vérifier si l'AS d'origine est légitime : RPKI, IRR"},
				{Content: "📞 Contacter le NOC de l'AS fautif si connu (via contacts Whois)"},
				{Content: "🚫 Bloquer le préfixe falsifié en local (null route) ou demander upstream filtering"},
				{Content: "📈 Surveiller les logs de flux réseau pour exfiltration de données via ce préfixe"},
				{Content: "📢 Notifier les pairs et les équipes sécurité (MANRS, NANOG)"},
				{Content: "✍️ Documenter l'incident et améliorer les filtres RPKI / ROA"},
			},
		},
		{
			Title: "CTF — Stéganographie (image)", Scenario: "ctf-stego-image",
			Description: "Extraction de données cachées dans une image (LSB, métadonnées).",
			Steps: []models.PlaybookStepRequest{
				{Content: "🔍 Examiner les métadonnées : `exiftool image.png` (commentaires, copyright)"},
				{Content: "📁 Vérifier des fichiers zip cachés : `binwalk image.png`"},
				{Content: "🖼️ Analyser LSB : utiliser `zsteg` pour PNG/BMP, `stegsolve`"},
				{Content: "🎨 Passer en niveaux de gris et canaux : `stegsolve` > \"Analyse des plans de bits\""},
				{Content: "🔑 Si stéganographie avec mot de passe : `steghide extract -sf image.jpg -p pass`"},
				{Content: "🖥️ Outils supplémentaires : `outguess`, `jsteg`"},
				{Content: "📝 Extraire le flag et vérifier son format (CTF classique flag{...})"},
			},
		},
		{
			Title: "Durcissement Windows (Securité basique)", Scenario: "windows-hardening",
			Description: "Mesures de base pour durcir un poste Windows contre les attaques courantes.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🔒 Désactiver SMBv1 : `Set-SmbServerConfiguration -EnableSMB1Protocol $false`"},
				{Content: "🛡️ Activer Windows Defender avec cloud-delivered protection"},
				{Content: "🔑 Activer UAC au niveau maximum (Always notify)"},
				{Content: "📝 Désactiver PowerShell version 2 (vulnérabilités connues)"},
				{Content: "🌐 Configurer Windows Firewall : bloquer toutes entrantes sauf nécessaires"},
				{Content: "🔐 Activer BitLocker pour les disques"},
				{Content: "⚙️ Désactiver les services inutiles (Print Spooler si non utilisé, SMB2/3 signature)"},
				{Content: "📊 Appliquer les dernières mises à jour de sécurité"},
			},
		},
		{
			Title: "Recherche de C2 avec Zeek (Bro)", Scenario: "zeek-c2",
			Description: "Utilisation de Zeek (ex-Bro) pour détecter des communications C2 sur le réseau.",
			Steps: []models.PlaybookStepRequest{
				{Content: "📡 Capturer le trafic réseau sur le point de sortie : `tcpdump -i eth0 -w capture.pcap`"},
				{Content: "⚙️ Analyser avec Zeek : `zeek -r capture.pcap` génère logs (conn.log, http.log, dns.log)"},
				{Content: "🔎 Chercher des connexions persistantes : `zeek-cut id.orig_h id.resp_h proto duration < conn.log | sort -k4 -nr`"},
				{Content: "🌐 Analyser les DNS suspects (domaines générés DGA) : `zeek-cut query answers < dns.log | grep -v '\\.[a-z]{2,6}$'`"},
				{Content: "🕸️ HTTP : requêtes avec User-Agent anormaux, méthodes rares (TRACE, OPTIONS)"},
				{Content: "📊 Utiliser `zeek-sumstats` pour détecter les hauts débits vers une même IP"},
				{Content: "🤖 Exécuter des scripts Zeek maison (ex: detect-beacon.zeek)"},
				{Content: "📝 Exporter les IOCs via `zeek-cut` et les intégrer à l'IOC Manager"},
			},
		},
		{
			Title: "OSINT — Trouver des emails de collaborateurs", Scenario: "osint-emails",
			Description: "Collecte d'adresses email d'une organisation via Google, LinkedIn, etc.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🔍 Recherche Google : `site:linkedin.com/in \"Company Name\" email`"},
				{Content: "📧 Outil : `theHarvester -d company.com -b google,bing,linkedin,github`"},
				{Content: "🗂️ Vérifier les fuites : `haveibeenpwned.com/domain/company.com`"},
				{Content: "📝 Valider les emails : `emailhippo.com` ou `hunter.io` (vérification format)"},
				{Content: "🔎 Chercher les emails dans les dépôts GitHub : `github.com/search?q=@company.com`"},
				{Content: "📊 Établir une cartographie (rôle, ancienneté)"},
				{Content: "⚠️ Ne jamais utiliser pour du spear-phishing sans autorisation — usage légal seulement"},
			},
		},
		{
			Title: "Réponse à Incident — Serveur Web Nginx compromis", Scenario: "nginx-compromise",
			Description: "Investigation d'un serveur Nginx ayant subi une intrusion.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🚨 Isoler le serveur (débrancher ou iptables DROP sauf SSH admin)"},
				{Content: "📁 Vérifier les logs Nginx : `/var/log/nginx/access.log` et `error.log` — chercher codes 404, POST anormaux"},
				{Content: "🔍 Scanner les fichiers web : chercher webshells : `grep -r 'eval(' /var/www/html/`, `lfi`"},
				{Content: "🔐 Vérifier les processus : `ps aux | grep nginx`, vérifier modules chargés"},
				{Content: "📂 Examiner les fichiers de configuration : `nginx.conf`, sites-enabled"},
				{Content: "🧹 Supprimer les fichiers malveillants, mettre à jour Nginx/PHP"},
				{Content: "🔄 Rebuild depuis une image propre si possible"},
				{Content: "📝 Analyser le vecteur : plugin vulnérable, credentials faibles ?"},
			},
		},
		{
			Title: "Cheatsheet — Commandes SQLmap avancées", Scenario: "sqlmap-cheatsheet",
			Description: "Outil d'injection SQL automatisé — paramètres utiles pour CTF et pentest.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🔍 Détection basique : `sqlmap -u \"http://target/page?id=1\"`"},
				{Content: "🗄️ Lister bases : `--dbs`"},
				{Content: "📋 Lister tables d'une base : `-D database --tables`"},
				{Content: "🔑 Dump d'une table : `-D database -T users --dump`"},
				{Content: "⚙️ Niveau de risque : `--level=5 --risk=3` (plus aggressif)"},
				{Content: "💾 Récupération shell : `--os-shell` (si privilèges suffisants)"},
				{Content: "📸 Éviter les faux positifs : `--no-cast`, `--hex`"},
				{Content: "✍️ Sauvegarder la requête : `-r request.txt` (si besoin d'ajouter headers)"},
			},
		},
		{
			Title: "Audit de Sécurité AWS — CIS Benchmark", Scenario: "aws-cis-benchmark",
			Description: "Vérification des bonnes pratiques de sécurité AWS selon CIS Foundations.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🔍 Activer CloudTrail dans toutes les régions"},
				{Content: "🔑 Configuration de mots de passe : longueur ≥14, expiration, réutilisation interdite"},
				{Content: "🚫 Désactiver les clés d'accès inutilisées (> 90 jours)"},
				{Content: "📊 Activer les logs S3 Access Logs sur les buckets sensibles"},
				{Content: "🛡️ Appliquer des Security Groups stricts (refuser 0.0.0.0/0 pour SSH/RDP)"},
				{Content: "🔐 Activer MFA sur tous les comptes root et utilisateurs avec console"},
				{Content: "📈 Configurer AWS Config + GuardDuty"},
				{Content: "📝 Utiliser l'outil `prowler` pour automatiser l'audit CIS"},
			},
		},
		{
			Title: "CTF — Reverse Engineering avec Ghidra", Scenario: "ctf-reversing",
			Description: "Analyse statique d'un binaire avec Ghidra pour trouver un flag.",
			Steps: []models.PlaybookStepRequest{
				{Content: "📥 Ouvrir le binaire dans Ghidra, créer un projet"},
				{Content: "⚙️ L'analyse automatique (analyse headless recommandée)"},
				{Content: "🔍 Chercher la fonction `main` — souvent à partir de `entry`"},
				{Content: "📝 Renommer les variables et fonctions pour comprendre la logique"},
				{Content: "🔎 Rechercher des strings suspectes (flags, appels à `strcmp`)"},
				{Content: "🔄 Vérifier les conditions : si `strcmp(input, secret) == 0` le secret est le flag"},
				{Content: "✍️ Extraire le flag en hexdump ou via script Ghidra Python"},
				{Content: "📝 Valider le flag sur le CTF"},
			},
		},
		{
			Title: "Configuration de Suricata IDS/IPS", Scenario: "suricata-setup",
			Description: "Installation et règles de base pour Suricata en mode IDS.",
			Steps: []models.PlaybookStepRequest{
				{Content: "📦 Installer Suricata : `apt install suricata` (ou depuis source)"},
				{Content: "⚙️ Configurer `/etc/suricata/suricata.yaml` : interface réseau (eth0), home_net"},
				{Content: "📥 Télécharger les règles Emerging Threats : `suricata-update`"},
				{Content: "🧪 Tester la configuration : `suricata -T -c /etc/suricata/suricata.yaml`"},
				{Content: "🚀 Démarrer : `suricata -c suricata.yaml -i eth0 --af-packet`"},
				{Content: "📊 Logs dans `/var/log/suricata/` : `fast.log`, `eve.json` (format JSON)"},
				{Content: "🔍 Chercher des alertes : `jq 'select(.alert.severity==1)' eve.json`"},
				{Content: "📈 Intégrer à ELK ou Splunk via filebeat"},
			},
		},
		{
			Title: "Investigation de Fuite de Données GitHub", Scenario: "github-leak",
			Description: "Réaction suite à la découverte de secrets exposés sur GitHub.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🚨 Confirmer le leak : rechercher sur GitHub Advanced Search, ou via outil `truffleHog`"},
				{Content: "🔑 Révoquer immédiatement le secret (clé API, token, mot de passe)"},
				{Content: "📞 Contacter l'organisation GitHub pour purge (DMCA ou support)"},
				{Content: "🔐 Changer tous les mots de passe qui auraient pu être exposés"},
				{Content: "📋 Auditer les logs d'accès (API, cloud) pour exploitation avant découverte"},
				{Content: "🛡️ Ajouter des pre-commit hooks (`git-secrets`) pour éviter récidive"},
				{Content: "📢 Notifier les clients si des données personnelles compromises"},
				{Content: "📝 Documenter et mettre en place un secret scanner continu"},
			},
		},
		{
			Title: "CTF — Attaque Hash Extension (SHA1/MD5)", Scenario: "ctf-hash-extension",
			Description: "Exploitation de la vulnérabilité d'extension de hash (length extension) pour forger des signatures.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🔍 Comprendre le contexte : serveur vérifie un paramètre signé (MAC=hash(secret + data))"},
				{Content: "📖 Connaître la longueur du secret (ou brute force)"},
				{Content: "🛠️ Utiliser outil `hash_extender` ou script Python `hashpumpy`"},
				{Content: "🧩 Forger un nouveau message : `data||padding||append` tout en recalculant le hash"},
				{Content: "📤 Envoyer la nouvelle signature et le message forgé au serveur"},
				{Content: "✅ Contourner l'authentification ou effectuer une action admin"},
				{Content: "📝 Documenter la vulnérabilité (utiliser SHA3/HMAC pour éviter)"},
			},
		},
		{
			Title: "Durcissement SSH (configuration avancée)", Scenario: "ssh-hardening",
			Description: "Configuration sécurisée du serveur SSH (OpenSSH).",
			Steps: []models.PlaybookStepRequest{
				{Content: "🔑 Désactiver login root : `PermitRootLogin no`"},
				{Content: "🔒 Utiliser clés SSH seulement : `PasswordAuthentication no`"},
				{Content: "🔄 Changer le port par défaut : `Port 2222` (obscurité faible mais réduit bruit)"},
				{Content: "⏱️ Limiter tentatives : `MaxAuthTries 3`, `MaxSessions 2`"},
				{Content: "🌐 Restreindre utilisateurs : `AllowUsers user1 user2`"},
				{Content: "🔐 Désactiver les protocoles faibles : `Ciphers ...` (chacha20-poly1305, aes256-gcm)"},
				{Content: "⚙️ Désactiver la forward agent : `AllowAgentForwarding no`"},
				{Content: "📝 Redémarrer SSH après modifications : `systemctl restart sshd`"},
			},
		},
		{
			Title: "Analyse d'un PDF Malveillant", Scenario: "pdf-malware",
			Description: "Analyse statique et dynamique d'un PDF suspect (phishing, exploit).",
			Steps: []models.PlaybookStepRequest{
				{Content: "📄 Extraire les métadonnées : `pdfinfo`, `exiftool`"},
				{Content: "📝 Vérifier les actions JavaScript : `pdf-parser.py --search /JavaScript`"},
				{Content: "🔍 Lister les objets : `pdf-parser.py -a`"},
				{Content: "🔓 Décompresser les flux : `pdftk file.pdf output uncompressed.pdf uncompress`"},
				{Content: "🌐 Chercher des URLs : `strings file.pdf | grep -E 'http'`"},
				{Content: "🧪 Exécuter dans un sandbox (VirusTotal, Hybrid Analysis) en environnement isolé"},
				{Content: "📤 Extraire les pièces jointes : `pdfdetach -saveall file.pdf`"},
				{Content: "⚠️ Ne jamais ouvrir directement sur un poste de travail"},
			},
		},
		{
			Title: "CTF — Cracking de mot de passe (John/Hashcat)", Scenario: "ctf-password-cracking",
			Description: "Récupération de mots de passe à partir de hash (MD5, NTLM, etc.) pour CTF.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🔍 Identifier le type de hash : `hashid` ou `hash-identifier`"},
				{Content: "📁 Sauvegarder le hash dans un fichier (ex: hash.txt)"},
				{Content: "📚 Utiliser un dictionnaire : `john --wordlist=rockyou.txt hash.txt`"},
				{Content: "⚡ Utiliser Hashcat pour plus de vitesse : `hashcat -m 0 -a 0 hash.txt rockyou.txt`"},
				{Content: "🛠️ Règles de mutilation : `--rules=best64`"},
				{Content: "🧠 Attaque par force brute : `-a 3 ?l?l?l?l` (si longueur connue)"},
				{Content: "✅ Récupérer le mot de passe et valider le flag"},
			},
		},
		{
			Title: "Configuration de pfSense — Règles firewall", Scenario: "pfsense-firewall",
			Description: "Mise en place et audit des règles pare-feu sur pfSense.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🌐 Accéder à l'interface web (https://IP:443)"},
				{Content: "🔍 Vérifier la règle par défaut : bloquer tout inbound"},
				{Content: "📝 Créer des alias (IPs, ports) pour simplifier les règles"},
				{Content: "🛡️ Ajouter règle pour autoriser SSH/WAN uniquement depuis IPs admin"},
				{Content: "📊 Activer la journalisation sur les règles critiques"},
				{Content: "⚠️ Désactiver la réponse ICMP (optionnel selon politique)"},
				{Content: "🔧 Configurer le NAT (1:1 ou redirection) si nécessaire"},
				{Content: "✅ Sauvegarder la configuration (Backup) après modifications"},
			},
		},
		{
			Title: "Investigation Forensic — Registre Windows", Scenario: "windows-registry",
			Description: "Analyse des ruches registre pour traces de compromission.",
			Steps: []models.PlaybookStepRequest{
				{Content: "📁 Extraire les ruches : `reg save HKLM\\SYSTEM system.hiv`, etc."},
				{Content: "🔍 Utiliser `RegRipper` ou `Registry Explorer`"},
				{Content: "🤖 Examiner les clés de run : `HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run`"},
				{Content: "📅 Vérifier les services : `HKLM\\System\\CurrentControlSet\\Services` — dates de création"},
				{Content: "🔑 Analyser les clés USB : `HKLM\\System\\CurrentControlSet\\Enum\\USBSTOR`"},
				{Content: "🌐 Vérifier les historique réseau : `HKLM\\Software\\Microsoft\\Windows NT\\CurrentVersion\\NetworkList`"},
				{Content: "👤 Examiner les comptes utilisateurs : `SAM` (hash + infos)"},
				{Content: "📝 Documenter les artefacts de persistance"},
			},
		},
		{
			Title: "Cheatsheet — Commandes Git avancées pour CTF", Scenario: "git-forensics",
			Description: "Exploration des dépôts Git pour retrouver des informations cachées (flag, historique).",
			Steps: []models.PlaybookStepRequest{
				{Content: "📜 Lister les commits : `git log --oneline`"},
				{Content: "🔍 Voir les différences : `git diff HEAD~1`"},
				{Content: "🗑️ Récupérer un fichier supprimé : `git show COMMIT_ID:path/to/file`"},
				{Content: "🌿 Explorer les branches : `git branch -a`"},
				{Content: "🎨 Chercher des flags dans les stash : `git stash list`, puis `git stash show`"},
				{Content: "🔄 Reflog : `git reflog` pour voir les HEAD mobiles"},
				{Content: "📝 Extraire tous les objets : `git cat-file -p`"},
			},
		},
		{
			Title: "Détection de Miner de Cryptomonnaie", Scenario: "cryptominer-detect",
			Description: "Identifier les signes de cryptominage illégal sur une infrastructure.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🔥 Consommation CPU anormale (100% sur plusieurs coeurs)"},
				{Content: "🌐 Connexions vers pools (stratum+tcp://)"},
				{Content: "📊 Analyser les processus : `top -c`, chercher process avec nom générique ou masqué"},
				{Content: "📁 Vérifier crontabs / systemd : ajout de service inconnu"},
				{Content: "🔍 Chercher fichiers dans /tmp (miner, config.json)"},
				{Content: "🚫 Bloquer les IPs/domaines de pools au firewall"},
				{Content: "🧹 Tuer processus, supprimer fichiers, patch vulnérabilité (souvent web)"},
			},
		},
		{
			Title: "CTF — Attaque XXE (XML External Entity)", Scenario: "ctf-xxe",
			Description: "Exploitation d'une vulnérabilité XXE pour lire des fichiers locaux.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🔍 Identifier une fonctionnalité XML (upload, SOAP, RSS)"},
				{Content: "📄 Injecter une entité externe : `<!ENTITY xxe SYSTEM \"file:///etc/passwd\">`"},
				{Content: "📤 Utiliser l'entité dans la réponse : `&xxe;`"},
				{Content: "🔎 Récupérer le contenu du fichier cible"},
				{Content: "🌐 Variante : XXE basé sur Out-Of-Band (OOB) via HTTP/DNS"},
				{Content: "🚫 Exfiltration possible avec paramètres : `%remote;%int;%send;`"},
				{Content: "⚠️ Désactiver les entités externes en prod (libxml_disable_entity_loader)"},
			},
		},
		{
			Title: "Réponse à Incident — Compromission de Compte Google Workspace", Scenario: "google-workspace-breach",
			Description: "Procédure suite au compromis d'un compte administrateur Google Workspace.",
			Steps: []models.PlaybookStepRequest{
				{Content: "🚨 Réinitialiser le mot de passe immédiatement et révoquer toutes les sessions"},
				{Content: "🔍 Vérifier les logs d'audit (Admin console > Reports) : modifications OAuth, ajout règles Gmail"},
				{Content: "🌐 Vérifier les comptes de messagerie : création de filtres de redirection"},
				{Content: "🔑 Passer en revue les clés API, applications tierces connectées"},
				{Content: "🧹 Supprimer toute règle de transfert malveillante"},
				{Content: "✅ Activer MFA obligatoire sur tous les comptes admin"},
				{Content: "📢 Notifier les utilisateurs si leurs boîtes ont été relues"},
			},
		},
		{
			Title: "Analyse de Réseau avec Wireshark (base)", Scenario: "wireshark-analysis",
			Description: "Utilisation de Wireshark pour analyser une capture réseau suspecte.",
			Steps: []models.PlaybookStepRequest{
				{Content: "📁 Ouvrir le fichier .pcap dans Wireshark"},
				{Content: "🔍 Appliquer filtre `http.request` pour voir les requêtes web"},
				{Content: "📊 Filtre `tcp.flags.syn==1` pour cartographier les connexions"},
				{Content: "🔎 Suivre un flux TCP : clic droit > Follow > TCP Stream"},
				{Content: "🕵️ Extraire des fichiers : `File > Export Objects > HTTP`"},
				{Content: "🌐 Identifier les DNS suspects : filtre `dns.qry.name contains \"malware\"`"},
				{Content: "📈 Statistiques > Conversations (trier par bytes) pour détecter exfiltration"},
				{Content: "📝 Exporter les IOC (IP) en CSV depuis le panel des endpoints"},
			},
		},
		{
			Title: "CTF — Attaque SSTI (Server Side Template Injection)", Scenario: "ctf-ssti",
			Description: "Injection de code dans un moteur de template (Jinja2, Twig, Freemarker).",
			Steps: []models.PlaybookStepRequest{
				{Content: "🔍 Détecter SSTI : injecter `{{7*7}}`, `${{7*7}}`, `${7*7}` selon moteur"},
				{Content: "🔬 Identifier le moteur : essayer des payloads spécifiques (Jinja2: `{{config}}`)"},
				{Content: "💣 Construire RCE : Jinja2 `{{''.__class__.__mro__[1].__subclasses__()}}`"},
				{Content: "🔑 Chercher subprocess.Popen : indexer les classes puis appeler `popen('id')`"},
				{Content: "🌐 Reverse shell : `python -c 'import socket...'` dans payload"},
				{Content: "⚠️ Ne pas détruire la cible, sortie propre"},
				{Content: "📝 Documenter la méthode et le flag"},
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
