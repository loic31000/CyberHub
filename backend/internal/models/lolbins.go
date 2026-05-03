package models

import "gorm.io/gorm"

type LOLBin struct {
	gorm.Model
	Name        string `gorm:"index" json:"name"`
	OS          string `gorm:"index" json:"os"`
	Description string `json:"description"`
	FullPath    string `json:"full_path"`
	Commands    string `json:"commands"`
	MitreTech   string `json:"mitre_tech"`
	Tags        string `json:"tags"`
	Category    string `gorm:"index" json:"category"`
}
