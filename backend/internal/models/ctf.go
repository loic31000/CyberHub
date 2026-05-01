package models

import "time"

type CTFPlatform string

const (
	PlatformTHM    CTFPlatform = "TryHackMe"
	PlatformHTB    CTFPlatform = "HackTheBox"
	PlatformRootMe CTFPlatform = "Root-Me"
	PlatformPico   CTFPlatform = "PicoCTF"
	PlatformOther  CTFPlatform = "Autre"
)

type CTFDifficulty string

const (
	DiffEasy   CTFDifficulty = "easy"
	DiffMedium CTFDifficulty = "medium"
	DiffHard   CTFDifficulty = "hard"
	DiffInsane CTFDifficulty = "insane"
)

// CTFWriteup représente un writeup de challenge CTF
type CTFWriteup struct {
	ID          uint          `json:"id"           gorm:"primaryKey;autoIncrement"`
	Title       string        `json:"title"        gorm:"not null"`
	Platform    CTFPlatform   `json:"platform"     gorm:"not null"`
	MachineName string        `json:"machine_name"`
	Difficulty  CTFDifficulty `json:"difficulty"`
	Category    string        `json:"category"`  // web, crypto, pwn, reverse, forensics, misc
	Content     string        `json:"content"`   // Markdown
	Flags       string        `json:"flags"`     // CSV des flags trouvés
	Tags        string        `json:"tags"`
	Completed   bool          `json:"completed"    gorm:"default:true"`
	CreatedAt   time.Time     `json:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at"`
}

type CTFCreateRequest struct {
	Title       string        `json:"title"       binding:"required,min=2"`
	Platform    CTFPlatform   `json:"platform"    binding:"required"`
	MachineName string        `json:"machine_name"`
	Difficulty  CTFDifficulty `json:"difficulty"`
	Category    string        `json:"category"`
	Content     string        `json:"content"`
	Flags       string        `json:"flags"`
	Tags        string        `json:"tags"`
	Completed   bool          `json:"completed"`
}
