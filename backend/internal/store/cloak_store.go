package store

import (
	"github.com/cyber-hub/cyber-hub/internal/models"
)

// ListCloakOverrides retourne toutes les modifications/entrées custom CLOAK.
func ListCloakOverrides() ([]models.CloakOverride, error) {
	var overrides []models.CloakOverride
	err := DB.Order("tactic_id ASC, id ASC").Find(&overrides).Error
	return overrides, err
}

// UpsertCloakOverride crée ou met à jour un override.
// Pour une entrée officielle modifiée (IsCustom=false) : upsert par Ref.
// Pour une entrée custom (IsCustom=true) : toujours créée nouvelle si Ref vide.
func UpsertCloakOverride(req models.CloakOverrideRequest) (*models.CloakOverride, error) {
	override := models.CloakOverride{
		Ref:         req.Ref,
		Kind:        req.Kind,
		TacticID:    req.TacticID,
		TacticName:  req.TacticName,
		ParentRef:   req.ParentRef,
		Name:        req.Name,
		Description: req.Description,
		ItemType:    req.ItemType,
		IsCustom:    req.IsCustom,
	}

	// Si Ref non vide et pas custom : upsert (1 seule entrée par Ref)
	if req.Ref != "" && !req.IsCustom {
		var existing models.CloakOverride
		if err := DB.Where("ref = ?", req.Ref).First(&existing).Error; err == nil {
			// Met à jour l'existant
			override.ID = existing.ID
			override.CreatedAt = existing.CreatedAt
			if err := DB.Save(&override).Error; err != nil {
				return nil, err
			}
			return &override, nil
		}
	}

	// Sinon : création
	if err := DB.Create(&override).Error; err != nil {
		return nil, err
	}
	return &override, nil
}

// DeleteCloakOverride supprime un override par son ID.
func DeleteCloakOverride(id uint) error {
	return DB.Delete(&models.CloakOverride{}, id).Error
}

// GetCloakOverride retourne un override par ID.
func GetCloakOverride(id uint) (*models.CloakOverride, error) {
	var o models.CloakOverride
	err := DB.First(&o, id).Error
	return &o, err
}
