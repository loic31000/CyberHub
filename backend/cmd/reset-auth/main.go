// reset-auth — Outil local de réinitialisation de l'authentification Cyber-Hub.
//
// Usage :
//   cd backend
//   go run ./cmd/reset-auth                  → cible ./cyber-hub.db
//   go run ./cmd/reset-auth -db chemin.db    → cible une autre DB
//
// Effet :
//   - Vide la table `settings` (où sont stockés PasswordHash et JWTSecret)
//   - Toutes les autres tables (CTF, IOC, MITRE, playbooks, outils…) sont conservées
//   - Au prochain démarrage du backend, l'app retombe en mode "First Setup"
//     et tu peux choisir un nouveau mot de passe via l'UI
//
// ⚠️  À utiliser uniquement en local. Aucun usage prévu en prod.
package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	dbPath := flag.String("db", "cyber-hub.db", "chemin vers le fichier SQLite Cyber-Hub")
	yes := flag.Bool("yes", false, "ne pas demander de confirmation")
	flag.Parse()

	abs, err := filepath.Abs(*dbPath)
	if err != nil {
		log.Fatalf("chemin invalide : %v", err)
	}
	if _, err := os.Stat(abs); os.IsNotExist(err) {
		log.Fatalf("DB introuvable : %s\nLance la commande depuis le dossier backend/", abs)
	}

	fmt.Printf("⚠️  Cyber-Hub — Reset Auth\n")
	fmt.Printf("   Cible : %s\n", abs)
	fmt.Printf("   Effet : la table 'settings' va être vidée (mot de passe + JWT secret).\n")
	fmt.Printf("           Toutes les autres données seront conservées.\n\n")

	if !*yes {
		fmt.Print("Continuer ? [y/N] ")
		var resp string
		fmt.Scanln(&resp)
		if resp != "y" && resp != "Y" && resp != "yes" {
			fmt.Println("Annulé.")
			return
		}
	}

	db, err := gorm.Open(sqlite.Open(abs), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		log.Fatalf("ouverture SQLite échouée : %v", err)
	}

	// Compter les enregistrements actuels (pour info)
	var count int64
	if err := db.Table("settings").Count(&count).Error; err != nil {
		// Table inexistante → rien à faire, l'app est déjà en mode setup
		fmt.Println("✓ Table 'settings' absente — l'app est déjà en mode First Setup.")
		return
	}

	if count == 0 {
		fmt.Println("✓ Table 'settings' déjà vide — l'app est déjà en mode First Setup.")
		return
	}

	// Suppression complète des settings (un seul enregistrement attendu, mais on couvre tous les cas)
	if err := db.Exec("DELETE FROM settings").Error; err != nil {
		log.Fatalf("DELETE échoué : %v", err)
	}

	fmt.Printf("✓ %d enregistrement(s) supprimé(s) de la table 'settings'.\n", count)
	fmt.Println()
	fmt.Println("Prochaines étapes :")
	fmt.Println("  1. Relance le backend :        cd .. && go run main.go")
	fmt.Println("  2. Ouvre http://localhost:5173 (ou 7743)")
	fmt.Println("  3. L'écran 'First Setup' s'affiche → choisis un nouveau mot de passe")
}
