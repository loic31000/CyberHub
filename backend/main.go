package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/cyber-hub/cyber-hub/internal/api"
	"github.com/cyber-hub/cyber-hub/internal/api/handlers"
	"github.com/cyber-hub/cyber-hub/internal/cisa"
	"github.com/cyber-hub/cyber-hub/internal/correlation"
	"github.com/cyber-hub/cyber-hub/internal/lolbins"
	"github.com/cyber-hub/cyber-hub/internal/mitre"
	"github.com/cyber-hub/cyber-hub/internal/store"
	"github.com/gin-gonic/gin"
)

// web contient le build React embarqué (dossier web/ généré par vite build)
//
//go:embed web
var webFiles embed.FS

const (
	port    = "7743"
	dbPath  = "cyber-hub.db"
	pidFile = "cyber-hub.pid"
)

func main() {
	fmt.Println()
	fmt.Println("╔══════════════════════════════════════╗")
	fmt.Println("║           CYBER-HUB v0.6             ║")
	fmt.Println("║   Hub de cybersécurité local         ║")
	fmt.Println("╚══════════════════════════════════════╝")
	fmt.Println()

	// Instance unique : tuer l'ancienne instance si elle tourne encore
	ensureSingleInstance()

	// Backup automatique : sauvegarde immédiate + planifiée toutes les 24h
	store.AutoBackup()
	log.Printf("[BACKUP] Sauvegarde automatique activée (backup au démarrage + toutes les 24h)")

	// Initialisation de la base de données SQLite
	if err := store.InitDB(dbPath); err != nil {
		log.Fatalf("[FATAL] Impossible d'initialiser la base de données : %v", err)
	}

	// Seed des outils (upsert — ajoute les nouveaux sans toucher aux existants)
	if err := store.SeedTools(); err != nil {
		log.Printf("[WARN] Erreur seed outils : %v", err)
	}
	// Seed des suggestions de commandes (autocomplétion Docker Runner)
	if err := store.SeedToolCommands(); err != nil {
		log.Printf("[WARN] Erreur seed commandes : %v", err)
	}
	// Seed des playbooks (upsert — ajoute les nouveaux scénarios)
	if err := store.SeedPlaybooks(); err != nil {
		log.Printf("[WARN] Erreur seed playbooks : %v", err)
	}
	// Seed des writeups CTF de référence
	if err := store.SeedCTFWriteups(); err != nil {
		log.Printf("[WARN] Erreur seed CTF : %v", err)
	}
	// Seed des CVE critiques de référence
	if err := store.SeedCVEEntries(); err != nil {
		log.Printf("[WARN] Erreur seed CVE : %v", err)
	}
	// Seed MITRE ATT&CK — téléchargement + parsing en arrière-plan (si pas déjà fait)
	mitre.SeedIfNeeded()
	// Seed CISA KEV (Known Exploited Vulnerabilities)
	cisa.SeedKEV(store.DB)
	// Seed LOLBins (LOLBAS Windows + GTFOBins Linux)
	lolbins.SeedLOLBins(store.DB)

	// Mode production (pas de logs Gin colorisés)
	gin.SetMode(gin.ReleaseMode)

	// Initialisation du moteur de corrélation (singleton)
	cloakData, _ := fs.ReadFile(webFiles, "web/data/cloak.json")
	correlationEngine := correlation.NewCorrelationEngine(store.DB, cloakData)
	// Initialiser le moteur global pour les handlers
	handlers.InitCorrelationEngine(correlationEngine)

	// Initialisation du router API
	r := api.NewRouter(correlationEngine)

	// Servir le frontend React embarqué
	staticFS, err := fs.Sub(webFiles, "web")
	if err != nil {
		log.Println("[WARN] Impossible de lire les fichiers embarqués")
	} else {
		indexFile, indexErr := staticFS.Open("index.html")
		if indexErr != nil {
			log.Println("[INFO] Mode développement : pas de frontend embarqué")
			log.Printf("[INFO] Lance le frontend Vite séparément : cd frontend && npm run dev")
		} else {
			indexFile.Close()

			// SPA routing : assets statiques → direct, toute autre route → index.html
			// Cela permet à React Router de gérer /tools/:id, /dashboard, etc.
			r.NoRoute(func(c *gin.Context) {
				reqPath := c.Request.URL.Path

				// Essayer de servir le fichier statique s'il existe (JS, CSS, images…)
				f, ferr := staticFS.Open(reqPath[1:]) // retirer le / initial
				if ferr == nil {
					f.Close()
					http.FileServer(http.FS(staticFS)).ServeHTTP(c.Writer, c.Request)
					return
				}

				// Fichier non trouvé → renvoyer index.html (React Router gère la route côté client)
				indexContent, readErr := fs.ReadFile(staticFS, "index.html")
				if readErr != nil {
					c.Status(http.StatusInternalServerError)
					return
				}
				// ⚠️ index.html ne doit jamais être mis en cache — le hash du bundle change à chaque build
				c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
				c.Header("Pragma", "no-cache")
				c.Header("Expires", "0")
				c.Data(http.StatusOK, "text/html; charset=utf-8", indexContent)
			})
		}
	}

	addr := "127.0.0.1:" + port
	url := "http://localhost:" + port

	log.Printf("[INFO] Démarrage du serveur sur %s", url)

	// Ouvrir le navigateur après un court délai
	go func() {
		time.Sleep(500 * time.Millisecond)
		openBrowser(url)
	}()

	fmt.Printf("\n  ✓ Cyber-Hub disponible sur : %s\n\n", url)
	fmt.Println("  Appuyez sur Ctrl+C pour arrêter")
	fmt.Println()

	if err := r.Run(addr); err != nil {
		log.Fatalf("[FATAL] Erreur serveur : %v", err)
	}
}

// ensureSingleInstance garantit qu'une seule instance de Cyber-Hub tourne à la fois.
//
// Comportement :
//  1. Si un fichier cyber-hub.pid existe → lire le PID → tuer ce processus
//  2. Écrire le PID courant dans cyber-hub.pid
//  3. Enregistrer un handler de signal (Ctrl+C / SIGTERM) pour nettoyer le fichier PID à la sortie
//
// Ainsi, relancer l'exe coupe automatiquement l'ancienne instance avant de démarrer.
func ensureSingleInstance() {
	// Lire le PID de l'instance précédente
	if data, err := os.ReadFile(pidFile); err == nil {
		pidStr := strings.TrimSpace(string(data))
		if pid, err := strconv.Atoi(pidStr); err == nil && pid > 0 && pid != os.Getpid() {
			if proc, err := os.FindProcess(pid); err == nil {
				if killErr := proc.Kill(); killErr == nil {
					log.Printf("[INFO] Instance précédente (PID %d) arrêtée automatiquement", pid)
					// Laisser le temps au port 7743 de se libérer avant de rebinder
					time.Sleep(600 * time.Millisecond)
				}
			}
		}
	}

	// Écrire notre PID
	_ = os.WriteFile(pidFile, []byte(strconv.Itoa(os.Getpid())), 0600)

	// Nettoyer le fichier PID lors d'un arrêt propre (Ctrl+C, SIGTERM)
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	go func() {
		sig := <-c
		log.Printf("[INFO] Signal %v reçu — arrêt de Cyber-Hub", sig)
		_ = os.Remove(pidFile)
		os.Exit(0)
	}()
}

// openBrowser ouvre l'URL dans le navigateur par défaut
func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	if err := cmd.Start(); err != nil {
		log.Printf("[WARN] Impossible d'ouvrir le navigateur automatiquement : %v", err)
	}
	go func() {
		if cmd.Process != nil {
			cmd.Wait()
		}
	}()
	if os.Getenv("DISPLAY") == "" && runtime.GOOS == "linux" {
		log.Printf("[INFO] Pas de display détecté. Ouvre : %s", url)
	}
}
