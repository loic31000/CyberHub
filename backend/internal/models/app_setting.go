package models

import "gorm.io/gorm"

// AppSetting stocke des paires clé/valeur de configuration (ex: clés API).
// SECURITE: les valeurs sensibles (clés API) doivent être stockées ici,
// jamais en dur dans le code.
type AppSetting struct {
	gorm.Model
	Key   string `gorm:"uniqueIndex" json:"key"`
	Value string `json:"value"`
}
